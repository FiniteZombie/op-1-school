import { afterEach, describe, expect, test, vi } from 'vitest';
import type { NoteEvent } from '../../types/music';
import { FakeMidiAccess, FakeMidiInput, FakeMidiOutput, fakeMidiNavigator } from '../__fakes__/FakeMidiPort';
import { createFakeTransport } from '../__fakes__/FakeTransport';
import {
  type ClockMode,
  type MidiConnectionChange,
  type PortMemory,
  type PortRef,
  WebMidiBridge,
} from '../MidiBridge';

afterEach(() => {
  vi.restoreAllMocks();
});

class MemoryStore implements PortMemory {
  saved: Array<{ input: PortRef | null; output: PortRef | null }> = [];
  constructor(public stored: { input?: PortRef | null; output?: PortRef | null } = {}) {}
  load() {
    return this.stored;
  }
  save(ports: { input: PortRef | null; output: PortRef | null }) {
    this.saved.push(ports);
    this.stored = ports;
  }
}

async function grantedBridge(ports: Array<FakeMidiInput | FakeMidiOutput>, memory?: PortMemory, perfNow = () => 0) {
  const access = new FakeMidiAccess(ports);
  const bridge = new WebMidiBridge({ navigator: fakeMidiNavigator(access), memory, perfNow });
  expect(await bridge.requestAccess()).toBe('granted');
  return { access, bridge };
}

describe('requestAccess', () => {
  test('unsupported without requestMIDIAccess (Firefox for Android)', async () => {
    const bridge = new WebMidiBridge({ navigator: {} });
    expect(bridge.accessState()).toBe('unrequested');
    expect(await bridge.requestAccess()).toBe('unsupported');
    expect(bridge.accessState()).toBe('unsupported');
    expect(await bridge.available()).toBe(false);
  });

  test('denied when it rejects', async () => {
    const bridge = new WebMidiBridge({ navigator: fakeMidiNavigator(null) });
    expect(await bridge.available()).toBe(true);
    const pending = bridge.requestAccess();
    expect(bridge.accessState()).toBe('pending');
    expect(await pending).toBe('denied');
    expect(bridge.accessState()).toBe('denied');
    expect(await bridge.available()).toBe(false);
  });

  test('granted asks once, without sysex', async () => {
    const nav = fakeMidiNavigator(new FakeMidiAccess());
    const bridge = new WebMidiBridge({ navigator: nav });
    expect(await bridge.requestAccess()).toBe('granted');
    expect(await bridge.requestAccess()).toBe('granted');
    expect(nav.requests).toEqual([{ sysex: false }]);
    expect(bridge.accessState()).toBe('granted');
  });
});

describe('note input', () => {
  test('note-on velocity 0 on channel 10 is an off; velocity 64 is 0.504; perfTs is the timeStamp', async () => {
    const input = new FakeMidiInput('in-1', 'Some Keys');
    const { bridge } = await grantedBridge([input]);
    bridge.select('in-1');
    await bridge.start();
    const got: NoteEvent[] = [];
    bridge.onNote((e) => got.push(e));

    input.emit([0x99, 36, 64], 1234.5); // channel 10 note-on
    input.emit([0x99, 36, 0], 1300.25); // channel 10 note-on, velocity 0
    expect(got).toHaveLength(2);
    expect(got[0]).toMatchObject({ kind: 'on', note: 36, perfTs: 1234.5, source: 'midi' });
    expect(got[0]?.velocity).toBeCloseTo(0.504, 3);
    expect(got[1]).toEqual({ kind: 'off', note: 36, velocity: 0, perfTs: 1300.25, source: 'midi' });
  });

  test('0x80 note-off, any channel; other messages are ignored', async () => {
    const input = new FakeMidiInput('in-1', 'Keys');
    const { bridge } = await grantedBridge([input]);
    bridge.select('in-1');
    await bridge.start();
    const got: string[] = [];
    bridge.onNote((e) => got.push(`${e.kind} ${e.note} ${e.velocity}`));
    input.emit([0x90, 60, 127], 1);
    input.emit([0xb0, 1, 64], 2); // CC
    input.emit([0xe0, 0, 64], 3); // pitch bend
    input.emit([0x83, 60, 40], 4); // note-off on channel 4 doesn't match channel 1's note
    input.emit([0x80, 60, 40], 5);
    expect(got).toEqual(['on 60 1', 'off 60 0']);
  });

  test('unplugging the selected input with two held notes emits two offs at performance.now()', async () => {
    const input = new FakeMidiInput('in-1', 'Keys');
    const { access, bridge } = await grantedBridge([input], undefined, () => 777);
    bridge.select('in-1');
    await bridge.start();
    const got: NoteEvent[] = [];
    const changes: MidiConnectionChange[] = [];
    bridge.onNote((e) => got.push(e));
    bridge.onConnectionChange((e) => changes.push(e));
    input.emit([0x90, 53, 100], 10);
    input.emit([0x91, 55, 100], 11);
    access.unplug(input);
    expect(got.filter((e) => e.kind === 'off').map((e) => [e.note, e.perfTs])).toEqual([
      [53, 777],
      [55, 777],
    ]);
    expect(bridge.selected().input).toBeNull();
    expect(input.listenerCount()).toBe(0);
    expect(changes).toEqual([
      { type: 'port', kind: 'input', port: { id: 'in-1', name: 'Keys', manufacturer: 'fake' }, state: 'disconnected' },
      { type: 'selection', input: null, output: null },
    ]);
    expect(bridge.ports().inputs).toEqual([]);
  });

  test('nothing is emitted before start, and stop releases held notes', async () => {
    const input = new FakeMidiInput('in-1', 'Keys');
    const { bridge } = await grantedBridge([input], undefined, () => 50);
    bridge.select('in-1');
    const got: string[] = [];
    bridge.onNote((e) => got.push(`${e.kind} ${e.note} ${e.perfTs}`));
    input.emit([0x90, 60, 100], 1);
    await bridge.start();
    input.emit([0x80, 60, 0], 2); // its on was never seen
    input.emit([0x90, 62, 100], 3);
    bridge.stop();
    expect(got).toEqual(['on 62 3', 'off 62 50']);
  });
});

describe('ports and memory', () => {
  test('no default port: with nothing remembered, nothing is selected', async () => {
    const { bridge } = await grantedBridge([new FakeMidiInput('in-1', 'OP-1 Field'), new FakeMidiOutput('out-1', 'OP-1 Field')]);
    expect(bridge.selected()).toEqual({ input: null, output: null });
    expect(bridge.ports().inputs.map((p) => p.name)).toEqual(['OP-1 Field']);
    expect(bridge.ports().outputs.map((p) => p.id)).toEqual(['out-1']);
  });

  test('select persists by id and name; undefined clears; an unknown id selects none', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const memory = new MemoryStore();
    const { bridge } = await grantedBridge([new FakeMidiInput('in-1', 'Keys'), new FakeMidiOutput('out-1', 'Synth')], memory);
    bridge.select('in-1', 'out-1');
    expect(memory.stored).toEqual({ input: { id: 'in-1', name: 'Keys' }, output: { id: 'out-1', name: 'Synth' } });
    expect(bridge.selected().output?.name).toBe('Synth');
    bridge.select('in-1');
    expect(memory.stored).toEqual({ input: { id: 'in-1', name: 'Keys' }, output: null });
    bridge.select('nope');
    expect(bridge.selected().input).toBeNull();
    expect(console.warn).toHaveBeenCalledOnce();
  });

  test('a remembered port is reselected on access by id, then by name', async () => {
    const byId = new MemoryStore({ input: { id: 'in-1', name: 'Old name' } });
    const a = await grantedBridge([new FakeMidiInput('in-1', 'Keys'), new FakeMidiInput('in-2', 'Old name')], byId);
    expect(a.bridge.selected().input?.id).toBe('in-1');

    const byName = new MemoryStore({ input: { id: 'gone', name: 'Keys' }, output: { id: 'gone-too', name: 'Synth' } });
    const b = await grantedBridge([new FakeMidiInput('in-9', 'Keys'), new FakeMidiOutput('out-9', 'Synth')], byName);
    expect(b.bridge.selected()).toMatchObject({ input: { id: 'in-9' }, output: { id: 'out-9' } });
    // The new ids are remembered.
    expect(byName.stored).toEqual({ input: { id: 'in-9', name: 'Keys' }, output: { id: 'out-9', name: 'Synth' } });
  });

  test('a remembered port that reappears is reselected; connection events fire for it', async () => {
    const memory = new MemoryStore();
    const input = new FakeMidiInput('in-1', 'Keys');
    const changes: MidiConnectionChange[] = [];
    const { access, bridge } = await grantedBridge([input], memory);
    bridge.onConnectionChange((e) => changes.push(e));
    bridge.select('in-1');
    access.unplug(input);
    expect(bridge.selected().input).toBeNull();
    expect(memory.stored.input).toEqual({ id: 'in-1', name: 'Keys' }); // still remembered
    access.plug(input);
    expect(bridge.selected().input?.id).toBe('in-1');
    expect(changes.map((c) => (c.type === 'port' ? `port ${c.kind} ${c.state}` : `selection ${c.input?.id ?? 'none'}`))).toEqual([
      'selection in-1',
      'port input disconnected',
      'selection none',
      'port input connected',
      'selection in-1',
    ]);
  });

  test('ports present at grant fire connected events (for the power warning)', async () => {
    const access = new FakeMidiAccess([new FakeMidiInput('in-1', 'Keys')]);
    const bridge = new WebMidiBridge({ navigator: fakeMidiNavigator(access) });
    const changes: MidiConnectionChange[] = [];
    bridge.onConnectionChange((e) => changes.push(e));
    await bridge.requestAccess();
    expect(changes).toEqual([
      { type: 'port', kind: 'input', port: { id: 'in-1', name: 'Keys', manufacturer: 'fake' }, state: 'connected' },
    ]);
  });

  test('a port that is not remembered is never picked, whatever its name', async () => {
    const memory = new MemoryStore({ input: { id: 'x', name: 'Keys' } });
    const { access, bridge } = await grantedBridge([], memory);
    access.plug(new FakeMidiInput('in-1', 'OP-1 Field'));
    expect(bridge.selected().input).toBeNull();
  });
});

describe('follow', () => {
  function pulses(input: FakeMidiInput, count: number, intervalMs: number, t0: number): number {
    let t = t0;
    for (let i = 0; i < count; i += 1) input.emit([0xf8], (t = t0 + i * intervalMs));
    return t;
  }

  async function following(transport = createFakeTransport().transport) {
    const input = new FakeMidiInput('in-1', 'Field');
    const { bridge } = await grantedBridge([input]);
    bridge.select('in-1');
    bridge.follow(true, transport);
    return { input, bridge, transport, configure: vi.spyOn(transport, 'configure') };
  }

  test('sets the transport BPM once 24 intervals give confidence ≥ 0.8', async () => {
    const { input, bridge, transport, configure } = await following();
    expect(bridge.clockMode()).toBe('follow');
    pulses(input, 24, 25, 0); // 23 intervals: no estimate yet
    expect(configure).not.toHaveBeenCalled();
    expect(transport.bpm()).toBe(120);
    const t = pulses(input, 1, 25, 24 * 25); // 24 intervals: 100 BPM
    expect(transport.bpm()).toBeCloseTo(100, 6);
    expect(configure).toHaveBeenCalledTimes(1);
    pulses(input, 48, 25, t + 25); // steady: nothing to change
    expect(configure).toHaveBeenCalledTimes(1);
  });

  test('applies at most once a beat (24 pulses) while the estimate keeps moving', async () => {
    const { input, configure } = await following();
    // Intervals stretch by 0.01 ms per pulse, so every pulse moves the estimate.
    let t = 0;
    input.emit([0xf8], t);
    for (let i = 1; i <= 120; i += 1) input.emit([0xf8], (t += 25 + 0.01 * i));
    // Applied at pulses 24, 48, 72, 96 and 120.
    expect(configure).toHaveBeenCalledTimes(5);
  });

  test('clamps to 30–300', async () => {
    const fast = await following();
    pulses(fast.input, 30, 6.25, 0); // 400 BPM
    expect(fast.transport.bpm()).toBe(300);
    const slow = await following();
    pulses(slow.input, 30, 100, 0); // 25 BPM
    expect(slow.transport.bpm()).toBe(30);
  });

  test('low confidence leaves the BPM alone', async () => {
    const input = new FakeMidiInput('in-1', 'Field');
    const { bridge } = await grantedBridge([input]);
    bridge.select('in-1');
    const { transport } = createFakeTransport();
    bridge.follow(true, transport);
    // Alternating 15 / 35 ms: median 25, but no interval within ±5 %.
    let t = 0;
    for (let i = 0; i < 60; i += 1) input.emit([0xf8], (t += i % 2 ? 15 : 35));
    expect(bridge.follower().estimate().confidence).toBeLessThan(0.8);
    expect(transport.bpm()).toBe(120);
  });

  test('follow needs an input; clock out and follow are mutually exclusive', async () => {
    const input = new FakeMidiInput('in-1', 'Field');
    const output = new FakeMidiOutput('out-1', 'Field');
    const { bridge } = await grantedBridge([input, output]);
    const { transport } = createFakeTransport();
    const clock = { audioToPerf: (t: number) => t * 1000 } as never;
    bridge.follow(true, transport);
    expect(bridge.clockMode()).toBe('internal'); // no input: no-op
    bridge.select('in-1', 'out-1');
    const modes: ClockMode[] = [];
    bridge.onClockModeChange((m) => modes.push(m));
    bridge.follow(true, transport);
    bridge.clockOut(true, transport, clock);
    expect(bridge.clockMode()).toBe('clock out');
    bridge.follow(true, transport);
    expect(bridge.clockMode()).toBe('follow');
    bridge.follow(false, transport);
    expect(bridge.clockMode()).toBe('internal');
    expect(modes).toEqual(['follow', 'clock out', 'follow', 'internal']);
  });

  test('unplugging the input turns follow off; every F8 reaches onClockIn', async () => {
    const input = new FakeMidiInput('in-1', 'Field');
    const { access, bridge } = await grantedBridge([input]);
    bridge.select('in-1');
    const seen: number[] = [];
    bridge.onClockIn((ts) => seen.push(ts));
    bridge.follow(true, createFakeTransport().transport);
    input.emit([0xf8], 10);
    input.emit([0xfa], 11);
    input.emit([0xf8], 12);
    expect(seen).toEqual([10, 12]);
    expect(bridge.follower().estimate().phasePerfMs).toBe(12);
    access.unplug(input);
    expect(bridge.clockMode()).toBe('internal');
  });
});
