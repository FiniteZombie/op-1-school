import { describe, expect, test } from 'vitest';
import type { PortMemory } from '../../input/MidiBridge';
import { createSettings, DEFAULT_SETTINGS, portMemory, SETTINGS_KEY, type StorageLike } from '../settings';

function memoryStorage(initial?: string): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  if (initial !== undefined) map.set(SETTINGS_KEY, initial);
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  };
}

const throwing: StorageLike = {
  getItem() {
    throw new Error('blocked');
  },
  setItem() {
    throw new Error('blocked');
  },
};

describe('settings', () => {
  test('no stored value gives the defaults, theme dark', () => {
    const s = createSettings(memoryStorage());
    expect(s.get()).toEqual(DEFAULT_SETTINGS);
    expect(s.get().theme).toBe('dark');
    expect(s.get().keyboardBaseNote).toBe(53);
  });

  test('corrupt JSON gives the defaults', () => {
    expect(createSettings(memoryStorage('{not json')).get()).toEqual(DEFAULT_SETTINGS);
  });

  test('a throwing storage gives the defaults and keeps saves in memory', () => {
    const s = createSettings(throwing);
    expect(s.get()).toEqual(DEFAULT_SETTINGS);
    s.save({ theme: 'light' });
    expect(s.get().theme).toBe('light');
  });

  test('no storage at all works from memory', () => {
    const s = createSettings(null);
    s.save({ theme: 'light' });
    expect(s.get().theme).toBe('light');
  });

  test('a wrong-typed field falls back on its own; the others are kept', () => {
    const s = createSettings(
      memoryStorage(JSON.stringify({ version: 1, theme: 'light', keyboardOctave: 'yes', keyboardBaseNote: 48, midiInput: { id: 3 } })),
    );
    expect(s.get()).toEqual({ ...DEFAULT_SETTINGS, theme: 'light', keyboardBaseNote: 48 });
  });

  test('save writes flat JSON with a version and drops unknown keys', () => {
    const storage = memoryStorage(JSON.stringify({ theme: 'light', stray: 1 }));
    const s = createSettings(storage);
    s.save({ keyboardOctave: 1, bogus: true } as never);
    const stored = JSON.parse(storage.map.get(SETTINGS_KEY) ?? '{}') as Record<string, unknown>;
    expect(stored).toEqual({ version: 1, ...DEFAULT_SETTINGS, theme: 'light', keyboardOctave: 1 });
    expect('stray' in stored).toBe(false);
    expect('bogus' in stored).toBe(false);
  });

  test('settings saved by one store are read by a new one', () => {
    const storage = memoryStorage();
    createSettings(storage).save({ midiInput: { id: 'in1', name: 'OP-1 Field' } });
    expect(createSettings(storage).get().midiInput).toEqual({ id: 'in1', name: 'OP-1 Field' });
  });

  test('subscribe fires on a change only, and unsubscribes', () => {
    const s = createSettings(memoryStorage());
    const seen: string[] = [];
    const off = s.subscribe((v) => seen.push(v.theme));
    s.save({ theme: 'light' });
    s.save({ theme: 'light' });
    off();
    s.save({ theme: 'dark' });
    expect(seen).toEqual(['light']);
  });

  test('a throwing subscriber does not stop the others', () => {
    const s = createSettings(memoryStorage());
    let n = 0;
    s.subscribe(() => {
      throw new Error('boom');
    });
    s.subscribe(() => void (n += 1));
    const err = console.error;
    console.error = () => {};
    try {
      s.save({ theme: 'light' });
    } finally {
      console.error = err;
    }
    expect(n).toBe(1);
  });

  test('portMemory fits PortMemory and round-trips through settings', () => {
    const s = createSettings(memoryStorage());
    const memory: PortMemory = portMemory(s);
    expect(memory.load()).toEqual({ input: null, output: null });
    memory.save({ input: { id: 'i', name: 'In' }, output: null });
    expect(memory.load()).toEqual({ input: { id: 'i', name: 'In' }, output: null });
  });
});
