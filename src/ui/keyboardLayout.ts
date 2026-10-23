/**
 * `Keyboard24`'s maths, pure (decision 10: UI logic that needs a test lives
 * in a `.ts` file next to its component).
 *
 * Layout (pre-flight "Keyboard look"): OP-1 style, two offset rows, naturals
 * below and sharps above, offset by half a key, every key one full key width.
 * 24 keys up from the base note (`keyboardBaseNote + 12 × keyboardOctave`,
 * F by default). The layout reads the *container* width: when the 24 keys
 * would be narrower than `MIN_KEY_PX`, it shows one octave and a toggle that
 * picks which half is visible. Nothing here reads the viewport.
 *
 * Key `index` is `note − base` (0..23) whether or not that key is visible.
 */
import type { MidiNote, NoteEvent, PitchClass } from '../types/music';

export const KEY_COUNT = 24;
/** Keys never get narrower than this when one octave fits (SPEC §5.4). */
export const MIN_KEY_PX = 40;
/** placeholder: keys stop growing at this width on wide screens. */
export const MAX_KEY_PX = 72;

const BLACK_PCS = new Set([1, 3, 6, 8, 10]);

export function isBlack(note: MidiNote): boolean {
  return BLACK_PCS.has(((note % 12) + 12) % 12);
}

export type KeyRow = 'lower' | 'upper';

export interface KeyRect {
  /** `note − base`, 0..23. */
  index: number;
  note: MidiNote;
  /** Naturals are `lower`, sharps `upper`. */
  row: KeyRow;
  /** Left edge in px from the keyboard's left edge. */
  x: number;
  width: number;
}

export interface KeyboardLayout {
  baseNote: MidiNote;
  /** 2 when all 24 keys fit at ≥ `MIN_KEY_PX`. */
  octaves: 1 | 2;
  /** Shown in one-octave mode. */
  showToggle: boolean;
  /** The visible half in one-octave mode (0 = lower); 0 in two-octave mode. */
  half: 0 | 1;
  /** Index of the first visible key (0 or 12). */
  firstIndex: number;
  /** Visible keys (12 or 24). */
  visibleCount: number;
  keyWidth: number;
  /** The width the keys span, ≤ the container width unless one octave is narrower than `MIN_KEY_PX`. */
  width: number;
  /** The visible keys, in index order. */
  keys: KeyRect[];
}

export interface KeyboardLayoutInput {
  /** The keyboard container's width in px. */
  width: number;
  /** The lowest of the 24 keys. */
  baseNote: MidiNote;
  /** Which octave the one-octave mode shows; ignored in two-octave mode. */
  half?: 0 | 1;
}

/** Column (in key widths) of each note from `from` for `count` keys: naturals on whole columns, sharps between. */
function columns(from: MidiNote, count: number): { row: KeyRow; col: number }[] {
  const out: { row: KeyRow; col: number }[] = [];
  let naturals = 0;
  for (let i = 0; i < count; i++) {
    if (isBlack(from + i)) {
      out.push({ row: 'upper', col: naturals - 0.5 });
    } else {
      out.push({ row: 'lower', col: naturals });
      naturals += 1;
    }
  }
  const min = Math.min(...out.map((c) => c.col));
  return out.map((c) => ({ row: c.row, col: c.col - min }));
}

function span(cols: { col: number }[]): number {
  return Math.max(...cols.map((c) => c.col)) + 1;
}

export function keyboardLayout({ width, baseNote, half = 0 }: KeyboardLayoutInput): KeyboardLayout {
  const all = columns(baseNote, KEY_COUNT);
  const twoOctaves = width / span(all) >= MIN_KEY_PX;
  const firstIndex = twoOctaves ? 0 : half * 12;
  const visibleCount = twoOctaves ? KEY_COUNT : 12;
  const cols = twoOctaves ? all : columns(baseNote + firstIndex, visibleCount);
  const spanCols = span(cols);
  const keyWidth = Math.min(MAX_KEY_PX, width / spanCols);
  return {
    baseNote,
    octaves: twoOctaves ? 2 : 1,
    showToggle: !twoOctaves,
    half: twoOctaves ? 0 : half,
    firstIndex,
    visibleCount,
    keyWidth,
    width: keyWidth * spanCols,
    keys: cols.map((c, i) => ({
      index: firstIndex + i,
      note: baseNote + firstIndex + i,
      row: c.row,
      x: c.col * keyWidth,
      width: keyWidth,
    })),
  };
}

export interface NoteLocation {
  /** The visible key that lights for the note (`note − base` after folding by octaves). */
  index: number;
  /** Outside all 24 keys. A note in the hidden octave of one-octave mode is not out of range. */
  outOfRange: boolean;
}

/** Where a note lights: itself if visible, else its octave-equivalent among the visible keys. */
export function locateNote(note: MidiNote, layout: KeyboardLayout): NoteLocation {
  const base = layout.baseNote;
  const outOfRange = note < base || note > base + KEY_COUNT - 1;
  const low = base + layout.firstIndex;
  const high = low + layout.visibleCount - 1;
  let folded = note;
  while (folded < low) folded += 12;
  while (folded > high) folded -= 12;
  return { index: folded - base, outOfRange };
}

/** The held notes lighting each visible key index. */
export function litKeys(notes: Iterable<MidiNote>, layout: KeyboardLayout): Map<number, MidiNote[]> {
  const out = new Map<number, MidiNote[]>();
  for (const note of notes) {
    const { index } = locateNote(note, layout);
    const list = out.get(index);
    if (list) list.push(note);
    else out.set(index, [note]);
  }
  return out;
}

/**
 * Visible key indices that carry the guide mark: keys whose pitch class is in
 * `guide` and that aren't lit (a lit key shows its own state instead).
 */
export function guideKeys(
  layout: KeyboardLayout,
  lit: ReadonlyMap<number, readonly MidiNote[]>,
  guide: readonly PitchClass[],
): Set<number> {
  const pcs = new Set<number>(guide);
  const out = new Set<number>();
  for (const k of layout.keys) {
    const lights = lit.get(k.index);
    if (lights && lights.length > 0) continue;
    if (pcs.has(((k.note % 12) + 12) % 12)) out.add(k.index);
  }
  return out;
}

/** Notes held across sources, from `NoteBus` events. */
export class HeldNotes {
  private readonly held = new Map<string, MidiNote>();

  /** Applies an event; true when the held set changed. */
  apply(e: Pick<NoteEvent, 'kind' | 'note' | 'source'>): boolean {
    const id = `${e.source}:${e.note}`;
    if (e.kind === 'on') {
      if (this.held.has(id)) return false;
      this.held.set(id, e.note);
      return true;
    }
    return this.held.delete(id);
  }

  /** Distinct held notes. */
  notes(): MidiNote[] {
    return [...new Set(this.held.values())];
  }
}

/**
 * One pointer per key: a pointer holds at most one key, and a key held by one
 * pointer ignores others. Released on `pointerup` or `pointercancel`.
 */
export class PointerTracker {
  private readonly byPointer = new Map<number, MidiNote>();

  /** A pointer went down on a key: the note to press, or null if this pointer or that key is already busy. */
  down(pointerId: number, note: MidiNote): MidiNote | null {
    if (this.byPointer.has(pointerId)) return null;
    for (const held of this.byPointer.values()) if (held === note) return null;
    this.byPointer.set(pointerId, note);
    return note;
  }

  /** A pointer came up or was cancelled: the note to release, or null if it held none. */
  up(pointerId: number): MidiNote | null {
    const note = this.byPointer.get(pointerId);
    if (note === undefined) return null;
    this.byPointer.delete(pointerId);
    return note;
  }

  /** Every pointer's note, cleared (unmount). */
  releaseAll(): MidiNote[] {
    const notes = [...this.byPointer.values()];
    this.byPointer.clear();
    return notes;
  }
}
