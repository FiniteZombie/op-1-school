import { describe, expect, it } from 'vitest';
import {
  HeldNotes,
  KEY_COUNT,
  MIN_KEY_PX,
  PointerTracker,
  keyboardLayout,
  litKeys,
  locateNote,
} from '../keyboardLayout';

describe('keyboardLayout', () => {
  it('at 360 px shows one octave of 12 keys, each ≥ 40 px, and the toggle', () => {
    const l = keyboardLayout({ width: 360, baseNote: 53 });
    expect(l.octaves).toBe(1);
    expect(l.showToggle).toBe(true);
    expect(l.keys).toHaveLength(12);
    for (const k of l.keys) expect(k.width).toBeGreaterThanOrEqual(MIN_KEY_PX);
    expect(l.width).toBeLessThanOrEqual(360);
  });

  it('at 800 px shows all 24 keys and no toggle', () => {
    const l = keyboardLayout({ width: 800, baseNote: 53 });
    expect(l.octaves).toBe(2);
    expect(l.showToggle).toBe(false);
    expect(l.keys).toHaveLength(KEY_COUNT);
    expect(l.keys.map((k) => k.index)).toEqual([...Array(24).keys()]);
    for (const k of l.keys) expect(k.width).toBeGreaterThanOrEqual(MIN_KEY_PX);
  });

  it('lays out F…E as two offset rows: naturals below, sharps half a key over', () => {
    const l = keyboardLayout({ width: 360, baseNote: 53 });
    const w = l.keyWidth;
    const byNote = new Map(l.keys.map((k) => [k.note, k]));
    // F G A B C D E on whole columns
    expect([53, 55, 57, 59, 60, 62, 64].map((n) => byNote.get(n)?.x)).toEqual([0, 1, 2, 3, 4, 5, 6].map((c) => c * w));
    expect([53, 55, 57, 59, 60, 62, 64].every((n) => byNote.get(n)?.row === 'lower')).toBe(true);
    // F# G# A# between, then C# D#
    expect([54, 56, 58, 61, 63].map((n) => byNote.get(n)?.x)).toEqual([0.5, 1.5, 2.5, 4.5, 5.5].map((c) => c * w));
    expect([54, 56, 58, 61, 63].every((n) => byNote.get(n)?.row === 'upper')).toBe(true);
    // every key is one full key width
    expect(l.keys.every((k) => k.width === w)).toBe(true);
  });

  it('the toggle shows the upper octave', () => {
    const l = keyboardLayout({ width: 360, baseNote: 53, half: 1 });
    expect(l.keys[0]?.note).toBe(65);
    expect(l.keys[0]?.index).toBe(12);
    expect(l.keys[0]?.x).toBe(0);
    expect(l.keys.at(-1)?.note).toBe(76);
  });

  it('decides on the container width alone, at 14 natural columns × 40 px', () => {
    expect(keyboardLayout({ width: 559, baseNote: 53 }).octaves).toBe(1);
    expect(keyboardLayout({ width: 560, baseNote: 53 }).octaves).toBe(2);
  });

  it('handles a base note that is not F', () => {
    const l = keyboardLayout({ width: 1000, baseNote: 49 }); // C#
    expect(l.keys[0]?.row).toBe('upper');
    expect(Math.min(...l.keys.map((k) => k.x))).toBe(0);
  });
});

describe('locateNote', () => {
  const wide = keyboardLayout({ width: 800, baseNote: 53 });

  it('maps 53 to key 0 and 76 to key 23', () => {
    expect(locateNote(53, wide)).toEqual({ index: 0, outOfRange: false });
    expect(locateNote(76, wide)).toEqual({ index: 23, outOfRange: false });
  });

  it('lights note 41 on key 0 and counts it out of range', () => {
    expect(locateNote(41, wide)).toEqual({ index: 0, outOfRange: true });
    expect(locateNote(77, wide)).toEqual({ index: 12, outOfRange: true });
    expect(locateNote(100, wide).outOfRange).toBe(true);
  });

  it('in one-octave mode, a note in the hidden octave lights its equivalent and is not counted', () => {
    const lower = keyboardLayout({ width: 360, baseNote: 53, half: 0 });
    expect(locateNote(70, lower)).toEqual({ index: 5, outOfRange: false });
    const upper = keyboardLayout({ width: 360, baseNote: 53, half: 1 });
    expect(locateNote(53, upper)).toEqual({ index: 12, outOfRange: false });
    expect(locateNote(41, upper)).toEqual({ index: 12, outOfRange: true });
  });

  it('litKeys groups held notes by the key they light', () => {
    const lit = litKeys([53, 65, 41], keyboardLayout({ width: 360, baseNote: 53 }));
    expect(lit.get(0)).toEqual([53, 65, 41]);
  });
});

describe('HeldNotes', () => {
  it('tracks notes per source, and an off releases only its own source', () => {
    const h = new HeldNotes();
    expect(h.apply({ kind: 'on', note: 60, source: 'touch' })).toBe(true);
    expect(h.apply({ kind: 'on', note: 60, source: 'midi' })).toBe(true);
    expect(h.apply({ kind: 'on', note: 60, source: 'touch' })).toBe(false);
    expect(h.notes()).toEqual([60]);
    expect(h.apply({ kind: 'off', note: 60, source: 'touch' })).toBe(true);
    expect(h.notes()).toEqual([60]);
    expect(h.apply({ kind: 'off', note: 60, source: 'midi' })).toBe(true);
    expect(h.notes()).toEqual([]);
    expect(h.apply({ kind: 'off', note: 60, source: 'midi' })).toBe(false);
  });
});

describe('PointerTracker', () => {
  it('one pointer per key, released on up', () => {
    const t = new PointerTracker();
    expect(t.down(1, 53)).toBe(53);
    expect(t.down(2, 53)).toBeNull(); // key busy
    expect(t.down(1, 55)).toBeNull(); // pointer busy
    expect(t.down(2, 55)).toBe(55);
    expect(t.up(2)).toBe(55);
    expect(t.up(2)).toBeNull();
    expect(t.up(3)).toBeNull();
    expect(t.releaseAll()).toEqual([53]);
    expect(t.up(1)).toBeNull();
  });
});
