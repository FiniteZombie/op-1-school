import { describe, expect, it } from 'vitest';
import { FakeMidiAccess, FakeMidiInput, fakeMidiNavigator } from '../../input/__fakes__/FakeMidiPort';
import { WebMidiBridge, type PortInfo, type PortMemory, type StoredPorts } from '../../input/MidiBridge';
import { COPY } from '../copy';
import { PortCounter, countInputs, midiConnectView, nextInput, openPortCounter } from '../midiConnectLogic';

const port = (id: string, name: string): PortInfo => ({ id, name, manufacturer: 'x' });

function memory(): PortMemory & { stored: StoredPorts } {
  const m = {
    stored: {} as StoredPorts,
    load: () => m.stored,
    save: (p: StoredPorts) => {
      m.stored = p;
    },
  };
  return m;
}

describe('midiConnectView', () => {
  const inputs = [port('a', 'OP-1'), port('b', 'USB Peripheral Port')];

  it('labels ports by message count, never by name', () => {
    const counts: Record<string, number> = { a: 0, b: 12 };
    const v = midiConnectView({ access: 'granted', inputs, selectedId: null, count: (id) => counts[id] ?? 0 });
    expect(v.rows.map((r) => r.label)).toEqual(['1: 0 msgs', '2: 12 msgs']);
    for (const r of v.rows) {
      expect(r.label).not.toContain('OP-1');
      expect(r.label).not.toContain('USB');
    }
  });

  it('the chosen port survives a port list refresh', () => {
    const before = midiConnectView({ access: 'granted', inputs, selectedId: 'b', count: () => 0 });
    expect(before.rows.find((r) => r.chosen)?.id).toBe('b');
    // A new port arrives ahead of it and the counts move: still `b`, by id.
    const after = midiConnectView({
      access: 'granted',
      inputs: [port('c', 'FlipSampler'), ...inputs],
      selectedId: 'b',
      count: (id) => (id === 'b' ? 5 : 0),
    });
    expect(after.rows.filter((r) => r.chosen).map((r) => r.id)).toEqual(['b']);
    expect(after.rows.find((r) => r.chosen)?.label).toBe('3: 5 msgs');
  });

  it('offers connect before access, and a line for denied, unsupported and no inputs', () => {
    expect(midiConnectView({ access: 'unrequested', inputs: [], selectedId: null, count: () => 0 })).toEqual({ canConnect: true, message: null, rows: [] });
    expect(midiConnectView({ access: 'denied', inputs, selectedId: null, count: () => 0 }).message).toBe(COPY.midiDenied);
    expect(midiConnectView({ access: 'unsupported', inputs: [], selectedId: null, count: () => 0 }).message).toBe(COPY.midiUnsupported);
    expect(midiConnectView({ access: 'granted', inputs: [], selectedId: null, count: () => 0 }).message).toBe(COPY.noMidi);
    expect(midiConnectView({ access: 'pending', inputs, selectedId: null, count: () => 0 }).rows).toEqual([]);
  });

  it('tapping the chosen port clears it; another selects that one', () => {
    expect(nextInput('a', 'a')).toBeUndefined();
    expect(nextInput('a', 'b')).toBe('b');
    expect(nextInput(null, 'a')).toBe('a');
  });
});

describe('counting messages', () => {
  it('counts every message on every input, including one plugged later', () => {
    const a = new FakeMidiInput('a', 'OP-1');
    const access = new FakeMidiAccess([a]);
    const counter = new PortCounter();
    let notified = 0;
    counter.subscribe(() => (notified += 1));
    const dispose = countInputs(access, counter);
    a.emit([0x90, 60, 100], 1);
    a.emit([0xf8], 2);
    a.emit([], 3); // empty: not a message
    const b = new FakeMidiInput('b', 'other');
    access.plug(b);
    b.emit([0x80, 60, 0], 4);
    expect(counter.count('a')).toBe(2);
    expect(counter.count('b')).toBe(1);
    expect(notified).toBe(3);
    dispose();
    expect(a.listenerCount()).toBe(0);
    expect(b.listenerCount()).toBe(0);
  });

  it('openPortCounter asks without sysex, and throws with no Web MIDI', async () => {
    const a = new FakeMidiInput('a', 'OP-1');
    const nav = fakeMidiNavigator(new FakeMidiAccess([a]));
    const { counter, dispose } = await openPortCounter(nav);
    expect(nav.requests).toEqual([{ sysex: false }]);
    a.emit([0x90, 60, 100], 1);
    expect(counter.count('a')).toBe(1);
    dispose();
    await expect(openPortCounter({})).rejects.toThrow();
  });
});

describe('with the real bridge over fakes', () => {
  it('the chosen input stays chosen when the port list refreshes', async () => {
    const field = new FakeMidiInput('native:port-in-1', 'USB Peripheral Port');
    const other = new FakeMidiInput('flip', 'FlipSampler');
    const access = new FakeMidiAccess([other, field]);
    const bridge = new WebMidiBridge({ memory: memory(), navigator: fakeMidiNavigator(access) });
    expect(await bridge.requestAccess()).toBe('granted');
    bridge.select(field.id);
    access.plug(new FakeMidiInput('zero', 'zerodebug'));
    const view = midiConnectView({
      access: bridge.accessState(),
      inputs: bridge.ports().inputs,
      selectedId: bridge.selected().input?.id ?? null,
      count: () => 0,
    });
    expect(view.rows).toHaveLength(3);
    expect(view.rows.filter((r) => r.chosen).map((r) => r.id)).toEqual([field.id]);
  });
});
