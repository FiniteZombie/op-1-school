import { afterEach, describe, expect, test, vi } from 'vitest';
import type { NoteEvent, Unsubscribe } from '../../types/music';
import { NoteBus, type NoteInputSource } from '../NoteInput';
import { TouchInput } from '../TouchInput';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('NoteBus', () => {
  test('forwards notes only from started sources; active() lists them', async () => {
    const bus = new NoteBus();
    const touch = new TouchInput(() => 0);
    bus.register(touch);
    const got: NoteEvent[] = [];
    bus.onNote((e) => got.push(e));

    expect(bus.active()).toEqual([]);
    touch.press(60, 1); // not started: nothing
    await bus.start('touch');
    expect(bus.active()).toEqual(['touch']);
    touch.press(60, 2);
    touch.release(60, 3);
    bus.stop('touch');
    expect(bus.active()).toEqual([]);
    expect(got.map((e) => [e.kind, e.note, e.perfTs])).toEqual([
      ['on', 60, 2],
      ['off', 60, 3],
    ]);
  });

  test('a throwing subscriber is logged and the others still get the note', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bus = new NoteBus();
    const touch = new TouchInput();
    bus.register(touch);
    await bus.start('touch');
    const got: number[] = [];
    bus.onNote(() => {
      throw new Error('boom');
    });
    bus.onNote((e) => got.push(e.note));
    touch.press(64, 10);
    expect(got).toEqual([64]);
    expect(error).toHaveBeenCalledOnce();
  });

  test('a source registered twice, or an unknown id, throws', async () => {
    const bus = new NoteBus();
    bus.register(new TouchInput());
    expect(() => bus.register(new TouchInput())).toThrow(/already registered/);
    await expect(bus.start('midi')).rejects.toThrow(/no 'midi' source/);
  });

  test('a source whose start rejects is not active', async () => {
    const failing: NoteInputSource = {
      id: 'mic',
      available: () => Promise.resolve(false),
      start: () => Promise.reject(new Error('no mic')),
      stop: () => {},
      onNote: (): Unsubscribe => () => {},
    };
    const bus = new NoteBus();
    bus.register(failing);
    await expect(bus.start('mic')).rejects.toThrow('no mic');
    expect(bus.active()).toEqual([]);
  });

  test('unsubscribing stops delivery', async () => {
    const bus = new NoteBus();
    const touch = new TouchInput();
    bus.register(touch);
    await bus.start('touch');
    const got: number[] = [];
    const off = bus.onNote((e) => got.push(e.note));
    touch.press(60, 1);
    off();
    touch.press(61, 2);
    expect(got).toEqual([60]);
  });
});

describe('TouchInput', () => {
  test('velocity 1 on press, 0 on release, source touch, perfTs as given', async () => {
    const touch = new TouchInput();
    await touch.start();
    const got: NoteEvent[] = [];
    touch.onNote((e) => got.push(e));
    touch.press(53, 100.5);
    touch.release(53, 180.25);
    expect(got).toEqual([
      { kind: 'on', note: 53, velocity: 1, perfTs: 100.5, source: 'touch' },
      { kind: 'off', note: 53, velocity: 0, perfTs: 180.25, source: 'touch' },
    ]);
  });

  test('ignores a repeated press and a release of a note that is not down', async () => {
    const touch = new TouchInput();
    await touch.start();
    const got: string[] = [];
    touch.onNote((e) => got.push(`${e.kind} ${e.note}`));
    touch.release(53, 1);
    touch.press(53, 2);
    touch.press(53, 3);
    touch.release(53, 4);
    touch.release(53, 5);
    expect(got).toEqual(['on 53', 'off 53']);
  });

  test('stop releases every held note at performance.now()', async () => {
    const touch = new TouchInput(() => 999);
    await touch.start();
    const got: NoteEvent[] = [];
    touch.onNote((e) => got.push(e));
    touch.press(53, 1);
    touch.press(55, 2);
    touch.stop();
    expect(got.filter((e) => e.kind === 'off').map((e) => [e.note, e.perfTs])).toEqual([
      [53, 999],
      [55, 999],
    ]);
    touch.press(57, 3);
    expect(got).toHaveLength(4);
  });
});
