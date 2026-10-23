import { describe, expect, test } from 'vitest';
import type { TransportConfig } from '../../audio/TransportEngine';
import { FakeMidiAccess, FakeMidiInput, FakeMidiOutput, fakeMidiNavigator } from '../__fakes__/FakeMidiPort';
import { createFakeTransport, FakeClockBridge } from '../../audio/__fakes__/FakeTransport';
import { percentile, WebMidiBridge } from '../MidiBridge';

const CFG: TransportConfig = { bpm: 120, swing: 0, bars: 4, timeSig: [4, 4] };
const PULSE_MS = 60000 / (120 * 24); // 20.833 ms

/** A bridge with clock out on, a fake transport and a clock where audioToPerf(t) = 5000 + 1000·t. */
async function setup(cfg: TransportConfig = CFG, opts: { loopback?: boolean } = {}) {
  const { transport, driver } = createFakeTransport();
  transport.configure(cfg);
  const clock = new FakeClockBridge(5000);
  const output = new FakeMidiOutput('out-1', 'Field');
  const input = new FakeMidiInput('in-1', 'Field');
  const access = new FakeMidiAccess([input, output]);
  // performance.now() follows the fake audio clock (render time), so headroom ≈ lookahead.
  const bridge = new WebMidiBridge({
    navigator: fakeMidiNavigator(access),
    perfNow: () => clock.audioToPerf(driver.currentTime()),
  });
  await bridge.requestAccess();
  bridge.select(opts.loopback ? 'in-1' : undefined, 'out-1');
  bridge.clockOut(true, transport, clock);
  return { transport, driver, clock, output, input, access, bridge };
}

const hex = (d: number[]) => d.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

describe('clock out', () => {
  test('120 BPM, 4 beats: F2 00 00, FA, F8 at tick 0, 96 F8s on their ticks 20.833 ms apart, FC after stop', async () => {
    const { transport, driver, clock, output } = await setup();
    transport.start(1.0);
    driver.advanceTo(2.89); // now() = 2.99 s: tick 760 (2.979 s) is due, tick 768 (3.0 s) isn't
    transport.stop();

    const sent = output.sent;
    expect(sent.slice(0, 3).map(([d]) => hex(d))).toEqual(['F2 00 00', 'FA', 'F8']);
    const t0 = clock.audioToPerf(1.0);
    expect(sent.slice(0, 3).map(([, ts]) => ts)).toEqual([t0, t0, t0]);

    const pulses = output.sentWith(0xf8);
    expect(pulses).toHaveLength(96);
    pulses.forEach(([, ts], i) => {
      const tick = i * 8;
      expect(Math.abs((ts ?? NaN) - clock.audioToPerf(1.0 + tick / 384))).toBeLessThan(0.5);
      if (i > 0) expect((ts ?? NaN) - (pulses[i - 1]?.[1] ?? NaN)).toBeCloseTo(PULSE_MS, 6);
    });

    const last = sent[sent.length - 1];
    expect(hex(last?.[0] ?? [])).toBe('FC');
    const fcStamp = last?.[1] ?? NaN;
    expect(fcStamp).toBeCloseTo(clock.audioToPerf(2.99), 9); // audioToPerf(stopped.audioTime)
    expect(pulses.every(([, ts]) => (ts ?? Infinity) <= fcStamp)).toBe(true);
    expect(output.sentWith(0xfc)).toHaveLength(1);
  });

  test('no F8 after stop', async () => {
    const { transport, driver, output } = await setup();
    transport.start(1.0);
    driver.advanceTo(1.5);
    transport.stop();
    const n = output.sent.length;
    driver.advanceTo(4);
    expect(output.sent).toHaveLength(n);
  });

  test('swing 0.5 leaves every pulse timestamp unchanged', async () => {
    const run = async (swing: number) => {
      const { transport, driver, output } = await setup({ ...CFG, swing });
      transport.start(1.0);
      driver.advanceTo(5);
      transport.stop();
      return output.sentWith(0xf8).map(([, ts]) => ts);
    };
    const straight = await run(0);
    const swung = await run(0.5);
    expect(straight.length).toBeGreaterThan(140);
    expect(swung).toEqual(straight);
  });

  test('a restart sends FC, then F2/FA with the new tick 0', async () => {
    const { transport, driver, clock, output } = await setup();
    transport.start(1.0);
    driver.advanceTo(1.4);
    transport.start(2.0);
    driver.advanceTo(1.95);
    const msgs = output.sent.map(([d, ts]) => `${hex(d)}@${(ts ?? NaN).toFixed(3)}`);
    const fc = msgs.findIndex((m) => m.startsWith('FC'));
    expect(fc).toBeGreaterThan(0);
    expect(msgs.slice(fc + 1, fc + 4)).toEqual([
      `F2 00 00@${clock.audioToPerf(2).toFixed(3)}`,
      `FA@${clock.audioToPerf(2).toFixed(3)}`,
      `F8@${clock.audioToPerf(2).toFixed(3)}`,
    ]);
  });

  test('turned on while running: pulses from the next pulse, F2/FA at the next bar-1 downbeat', async () => {
    const { transport, driver, clock, output, bridge } = await setup({ ...CFG, bars: 1 });
    bridge.clockOut(false, transport, clock);
    output.sent.length = 0;
    transport.start(1.0);
    driver.advanceTo(1.3); // dispatched through 1.4 s
    bridge.clockOut(true, transport, clock);
    driver.advanceTo(3.2); // the loop is one bar = 2 s: the next downbeat is 3.0 s
    const msgs = output.sent.map(([d, ts]) => [hex(d), ts ?? NaN] as const);
    expect(msgs[0]?.[0]).toBe('F8');
    expect(msgs[0]?.[1]).toBeGreaterThan(clock.audioToPerf(1.4));
    const fa = msgs.findIndex(([d]) => d === 'FA');
    expect(msgs[fa - 1]).toEqual(['F2 00 00', clock.audioToPerf(3.0)]);
    expect(msgs[fa]?.[1]).toBe(clock.audioToPerf(3.0));
    expect(msgs[fa + 1]).toEqual(['F8', clock.audioToPerf(3.0)]);
    expect(msgs.filter(([d]) => d === 'FA')).toHaveLength(1);
  });

  test('turned off while running sends FC no earlier than the last F8; then nothing', async () => {
    const { transport, driver, clock, output, bridge } = await setup();
    transport.start(1.0);
    driver.advanceTo(1.5);
    const lastF8 = output.sentWith(0xf8).at(-1)?.[1] ?? NaN;
    bridge.clockOut(false, transport, clock);
    expect(bridge.clockMode()).toBe('internal');
    const fc = output.sent.at(-1);
    expect(hex(fc?.[0] ?? [])).toBe('FC');
    expect(fc?.[1]).toBeGreaterThanOrEqual(lastF8);
    const n = output.sent.length;
    driver.advanceTo(3);
    transport.stop();
    expect(output.sent).toHaveLength(n);
  });

  test('with no output selected, clock out is a no-op', async () => {
    const { transport, clock, bridge, output } = await setup();
    bridge.clockOut(false, transport, clock);
    bridge.select();
    bridge.clockOut(true, transport, clock);
    expect(bridge.clockMode()).toBe('internal');
    output.sent.length = 0;
    transport.start(1.0);
    expect(output.sent).toEqual([]);
  });

  test('the output disconnecting turns clock out off quietly', async () => {
    const { transport, driver, output, access, bridge } = await setup();
    transport.start(1.0);
    driver.advanceTo(1.2);
    const n = output.sent.length;
    access.unplug(output);
    expect(bridge.clockMode()).toBe('internal');
    expect(bridge.selected().output).toBeNull();
    driver.advanceTo(2);
    transport.stop();
    expect(output.sent).toHaveLength(n);
  });

  test('clockStats: headroom of every send over the last 1000, late count', async () => {
    const { transport, driver, bridge } = await setup();
    expect(bridge.clockStats()).toEqual({
      sends: 0,
      headroomMinMs: null,
      headroomP5Ms: null,
      headroomP50Ms: null,
      late: 0,
      loopback: null,
    });
    transport.start(0.2); // perfNow = render time, so the first sends are 100–200 ms ahead
    for (let t = 0; t <= 30; t += 0.01) driver.advanceTo(t);
    const s = bridge.clockStats();
    expect(s.sends).toBe(1000);
    expect(s.late).toBe(0);
    expect(s.headroomMinMs).toBeGreaterThan(0);
    expect(s.headroomMinMs).toBeLessThanOrEqual(100 + 1e-6);
    expect(s.headroomP50Ms).toBeGreaterThan(80);
    expect(s.loopback).toBeNull();
  });

  test('clockStats: loopback error when F8 comes back on the selected input', async () => {
    const { transport, driver, output, input, bridge } = await setup(CFG, { loopback: true });
    transport.start(1.0);
    driver.advanceTo(1.5);
    // Echo every F8 back 2 ms late, every fourth one 5 ms late.
    output.sentWith(0xf8).forEach(([, ts], i) => input.emit([0xf8], (ts ?? 0) + (i % 4 === 3 ? 5 : 2)));
    const lb = bridge.clockStats().loopback;
    expect(lb?.count).toBe(output.sentWith(0xf8).length);
    expect(lb?.absErrorP50Ms).toBeCloseTo(2, 9);
    expect(lb?.absErrorP95Ms).toBeCloseTo(5, 9);
    expect(lb?.jitterP95Ms).toBeCloseTo(3, 9);
  });

  test('percentile is nearest-rank', () => {
    const v = Array.from({ length: 100 }, (_, i) => 100 - i);
    expect(percentile(v, 5)).toBe(5);
    expect(percentile(v, 50)).toBe(50);
    expect(percentile([3], 95)).toBe(3);
    expect(Number.isNaN(percentile([], 50))).toBe(true);
  });
});
