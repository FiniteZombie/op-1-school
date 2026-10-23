// The progressions A0 and A4 play instead of the one they were given: A0's
// retimed stages and A4's two-chord vamps. Pure.
import type { Chord, ChordSlot, Progression } from '../../types/music';

const BEATS_PER_BAR = 4;

/** Same chord: root, quality and bass (`bass ?? root`). Extensions don't count. */
export function sameChord(a: Chord, b: Chord): boolean {
  return a.root === b.root && a.quality === b.quality && (a.bass ?? a.root) === (b.bass ?? b.root);
}

/**
 * Consecutive identical chords as one slot (beats summed). A last chord equal
 * to the first is folded into it, so the loop's wrap is no repeat either.
 */
export function mergeIdentical(slots: readonly ChordSlot[]): ChordSlot[] {
  const out: ChordSlot[] = [];
  for (const s of slots) {
    const prev = out[out.length - 1];
    if (prev && sameChord(prev.chord, s.chord)) prev.beats += s.beats;
    else out.push({ ...s });
  }
  const first = out[0];
  const last = out[out.length - 1];
  if (out.length > 1 && first && last && sameChord(first.chord, last.chord)) {
    first.beats += last.beats;
    out.pop();
  }
  return out;
}

/** The slots repeated until they fill whole 4/4 bars (at most 16 times). Throws when they never do. */
export function repeatToWholeBars(slots: readonly ChordSlot[]): { slots: ChordSlot[]; bars: number } {
  const total = slots.reduce((sum, s) => sum + s.beats, 0);
  for (let r = 1; r <= 16; r++) {
    const bars = (r * total) / BEATS_PER_BAR;
    if (bars >= 1 && Math.abs(bars - Math.round(bars)) < 1e-9) {
      const out: ChordSlot[] = [];
      for (let i = 0; i < r; i++) out.push(...slots.map((s) => ({ ...s })));
      return { slots: out, bars: Math.round(bars) };
    }
  }
  throw new Error(`can't repeat ${total} beats into whole bars`);
}

/** A0's stages, in beats per chord; the drill steps down through them. */
export const A0_STAGES = [8, 4, 2] as const;

/** A0's stage `stage` (an index into `A0_STAGES`): identical chords merged, each held for the stage's beats. */
export function a0Stage(p: Progression, stage: number): Progression {
  const beats = A0_STAGES[stage];
  if (beats === undefined) throw new RangeError(`A0 has no stage ${stage}`);
  const merged = mergeIdentical(p.slots).map((s) => ({ ...s, beats }));
  const { slots, bars } = repeatToWholeBars(merged);
  return { ...p, id: `${p.id}/a0-${beats}`, slots, bars };
}

/** A4's pairs: each slot with the next (the last with the first), identical pairs skipped. */
export function a4Pairs(p: Progression): Array<[ChordSlot, ChordSlot]> {
  const pairs: Array<[ChordSlot, ChordSlot]> = [];
  p.slots.forEach((a, i) => {
    const b = p.slots[(i + 1) % p.slots.length];
    if (b && !sameChord(a.chord, b.chord)) pairs.push([a, b]);
  });
  return pairs;
}

/** One pair as a vamp: each chord for its own beats, the pair repeated to whole bars. */
export function a4Vamp(p: Progression, pair: readonly [ChordSlot, ChordSlot], index: number): Progression {
  const { slots, bars } = repeatToWholeBars(pair);
  return { ...p, id: `${p.id}/a4-${index}`, slots, bars };
}
