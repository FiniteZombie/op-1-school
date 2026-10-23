import { describe, expect, test } from 'vitest';
import { type AudioClockContext, type ClockBridge, fitLine, offsetMs, WebAudioClockBridge } from '../Clock';

/** A fake context whose fields the test sets directly. */
function fakeContext(init: Partial<AudioClockContext> & { currentTime?: number; state?: string } = {}) {
  return {
    currentTime: 0,
    state: 'running',
    ...init,
  } as { -readonly [K in keyof AudioClockContext]: AudioClockContext[K] };
}

describe('SPEC §3.3 worked number', () => {
  // Fit path: audioToPerf(t) = 5000 + 1000·t ms, output latency 40 ms.
  const ctx = fakeContext({ currentTime: 10, outputLatency: 0.04 });
  const clock = new WebAudioClockBridge(ctx, () => 15000);
  clock.refresh();

  test('the fit path adds the output latency', () => {
    expect(clock.audioToPerf(10)).toBeCloseTo(15000, 9);
    expect(clock.perfToAudio(15000)).toBeCloseTo(10, 9);
    expect(clock.audibleAt(10)).toBeCloseTo(15040, 9);
    expect(clock.snapshot().path).toBe('fit');
  });

  test('a snare at 10.000 s played at perf 15062 reads +22 ms, uncalibrated', () => {
    const r = offsetMs(15062, 10, clock);
    expect(r.offsetMs).toBeCloseTo(22, 9);
    expect(r.calibrated).toBe(false);
  });

  test('with touch calibration 15 ms it reads +7 ms, calibrated', () => {
    const r = offsetMs(15062, 10, clock, 15);
    expect(r.offsetMs).toBeCloseTo(7, 9);
    expect(r.calibrated).toBe(true);
  });

  test('a structural fake works as a ClockBridge', () => {
    const fake: Pick<ClockBridge, 'audibleAt'> = { audibleAt: (t) => 5000 + 1000 * (t + 0.04) };
    expect(offsetMs(15062, 10, fake).offsetMs).toBeCloseTo(22, 9);
  });
});

describe('decision 7: the output timestamp is already audible time', () => {
  // The phone's readout at perf 15000: currentTime 10, gap 28.8 ms, outputLatency 24, baseLatency 5.
  const ctx = fakeContext({
    currentTime: 10,
    outputLatency: 0.024,
    baseLatency: 0.005,
    getOutputTimestamp: () => ({ contextTime: 9.9712, performanceTime: 15000 }),
  });
  const clock = new WebAudioClockBridge(ctx, () => 15000);
  clock.refresh();

  test('audibleAt is audioToPerf, with no latency added', () => {
    expect(clock.snapshot().path).toBe('output-timestamp');
    expect(clock.audibleAt(10)).toBeCloseTo(clock.audioToPerf(10), 9);
    expect(clock.audibleAt(10)).toBeCloseTo(15028.8, 9);
  });

  test('the fit path lands within the gap−latency mismatch of it', () => {
    // currentTime 10 paired with perf 15000, + 29 ms = 15029, vs 15028.8 from the output timestamp.
    const fit = new WebAudioClockBridge(fakeContext({ currentTime: 10, outputLatency: 0.024, baseLatency: 0.005 }), () => 15000);
    fit.refresh();
    expect(Math.abs(fit.audibleAt(10) - clock.audibleAt(10))).toBeLessThan(0.5);
  });
});

describe('outputLatencySec', () => {
  test('outputLatency plus baseLatency, each 0 when missing', () => {
    expect(new WebAudioClockBridge(fakeContext({ outputLatency: 0.03, baseLatency: 0.01 }), () => 0).outputLatencySec()).toBeCloseTo(0.04, 12);
    expect(new WebAudioClockBridge(fakeContext({ outputLatency: 0.03 }), () => 0).outputLatencySec()).toBe(0.03);
    expect(new WebAudioClockBridge(fakeContext({ baseLatency: 0.01 }), () => 0).outputLatencySec()).toBe(0.01);
    expect(new WebAudioClockBridge(fakeContext(), () => 0).outputLatencySec()).toBe(0);
  });
});

/** Deterministic ±1 ms noise. */
function noise(i: number): number {
  return Math.sin(i * 12.9898) * 1;
}

describe('fallback fit', () => {
  test('20 pairs 250 ms apart with ±1 ms noise recover a slope within 0.5 % of 1000 ms/s', () => {
    const ctx = fakeContext({ currentTime: 3 });
    let perf = 0;
    const clock = new WebAudioClockBridge(ctx, () => perf);
    for (let i = 0; i < 20; i++) {
      ctx.currentTime = 3 + i * 0.25;
      perf = 7000 + 1000 * ctx.currentTime + noise(i);
      clock.refresh();
    }
    const { slope } = clock.fitLine();
    expect(Math.abs(slope - 1000) / 1000).toBeLessThan(0.005);
    expect(clock.snapshot()).toMatchObject({ path: 'fit', fitPairs: 20, hasGetOutputTimestamp: false });
    expect(Math.abs(clock.audioToPerf(5) - 12000)).toBeLessThan(1.5);
    expect(clock.perfToAudio(clock.audioToPerf(5))).toBeCloseTo(5, 9);
  });

  test('getOutputTimestamp returning zeros uses the fit', () => {
    const ctx = fakeContext({ currentTime: 2, getOutputTimestamp: () => ({ contextTime: 0, performanceTime: 0 }) });
    const clock = new WebAudioClockBridge(ctx, () => 4000);
    clock.refresh();
    const s = clock.snapshot();
    expect(s.path).toBe('fit');
    expect(s.hasGetOutputTimestamp).toBe(true);
    expect(s.gapMs).toBeNull();
    expect(clock.audioToPerf(2)).toBeCloseTo(4000, 9);
  });

  test('one seed pair at construction gives slope 1000 through it', () => {
    const clock = new WebAudioClockBridge(fakeContext({ currentTime: 1.5 }), () => 2500);
    expect(clock.audioToPerf(2)).toBeCloseTo(3000, 9);
    expect(fitLine([])).toEqual({ slope: 1000, intercept: 0 });
  });

  test('a refresh while suspended keeps the last good correlation', () => {
    const ctx = fakeContext({ currentTime: 1 });
    let perf = 1000;
    const clock = new WebAudioClockBridge(ctx, () => perf);
    ctx.currentTime = 2;
    perf = 2000;
    clock.refresh();
    const before = clock.audioToPerf(3);
    ctx.state = 'suspended';
    perf = 9000; // wall clock moves on, audio clock stands still
    clock.refresh();
    expect(clock.audioToPerf(3)).toBe(before);
  });

  test('fit pairs from before a suspension are dropped when it runs again', () => {
    const ctx = fakeContext({ currentTime: 1, state: 'suspended' });
    let perf = 1000;
    const clock = new WebAudioClockBridge(ctx, () => perf);
    ctx.state = 'running';
    ctx.currentTime = 1; // resumed where it stopped
    perf = 9000;
    clock.refresh();
    expect(clock.snapshot().fitPairs).toBe(1);
    expect(clock.audioToPerf(1)).toBeCloseTo(9000, 9);
  });
});

describe('snapshot', () => {
  test('reports the gap, latencies in ms and the active path', () => {
    const ctx = fakeContext({
      currentTime: 2.05,
      outputLatency: 0.04,
      baseLatency: 0.01,
      getOutputTimestamp: () => ({ contextTime: 2, performanceTime: 3000 }),
    });
    const clock = new WebAudioClockBridge(ctx, () => 3050);
    clock.refresh();
    const s = clock.snapshot();
    expect(s.path).toBe('output-timestamp');
    expect(s.outputContextTime).toBe(2);
    expect(s.gapMs).toBeCloseTo(50, 9);
    expect(s.outputLatencyMs).toBeCloseTo(40, 9);
    expect(s.baseLatencyMs).toBeCloseTo(10, 9);
    expect(s.hasOutputLatency).toBe(true);
  });
});
