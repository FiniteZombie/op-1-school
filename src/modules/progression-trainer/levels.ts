// What each level plays and shows (plan L2's table), and which progressions it
// can use (`usableFor`, pre-flight technical answer 15).
import type { PartMask } from '../../audio/voicing';
import { chordTones, qualityFamily } from '../../theory';
import { DRILL_MODES, type DrillForm } from '../../types/drills';
import type { Progression } from '../../types/music';
import { sameChord } from './arrange';

export const LEVEL_IDS = DRILL_MODES['progression-trainer'];
export type LevelId = (typeof LEVEL_IDS)[number];

export function isLevelId(s: string | undefined): s is LevelId {
  return (LEVEL_IDS as readonly string[]).includes(s ?? '');
}

export interface LevelSpec {
  mask: PartMask;
  /** The heard chord's name is on screen. */
  showChord: boolean;
  /** `Keyboard24` classifies lit keys against the heard chord. */
  classify: boolean;
  /** Minutes when the launch gives none. */
  defaultMinutes: number;
  /** Writes `TimingOffset`s into the attempt. */
  timed: boolean;
  /** What `finish` needs first: a full loop, or (A4) an answered question. */
  finishUnit: 'loop' | 'answer';
}

const ALL: PartMask = { drums: true, bass: true, chords: true };

export const LEVELS: Readonly<Record<LevelId, LevelSpec>> = {
  A0: { mask: ALL, showChord: false, classify: false, defaultMinutes: 4, timed: true, finishUnit: 'loop' },
  A1: {
    mask: { drums: true, bass: true, chords: false },
    showChord: false,
    classify: false,
    defaultMinutes: 4,
    timed: false,
    finishUnit: 'loop',
  },
  A2: { mask: ALL, showChord: true, classify: false, defaultMinutes: 2, timed: false, finishUnit: 'loop' },
  A3: { mask: ALL, showChord: false, classify: false, defaultMinutes: 4, timed: false, finishUnit: 'loop' },
  A4: { mask: ALL, showChord: true, classify: false, defaultMinutes: 4, timed: false, finishUnit: 'answer' },
  A5: { mask: ALL, showChord: true, classify: true, defaultMinutes: 4, timed: false, finishUnit: 'loop' },
  A6: { mask: ALL, showChord: true, classify: true, defaultMinutes: 4, timed: true, finishUnit: 'loop' },
};

/**
 * Whether `level` can drill `p` (and, for A6, in `form`). Every rule also
 * keeps that level's scores off a zero denominator.
 */
export function usableFor(level: LevelId, p: Progression, form: DrillForm = 'phrase'): boolean {
  const chords = p.slots.map((s) => s.chord);
  const first = chords[0];
  if (!first) return false;
  const twoDistinct = chords.some((c) => !sameChord(c, first));
  switch (level) {
    case 'A0':
    case 'A4':
      // A4's pairs include last → first, so two distinct chords always give a differing pair.
      return twoDistinct;
    case 'A3':
      return chords.every((c) => qualityFamily(c.quality) !== null);
    case 'A5':
      return chords.every((c) => chordTones(c).length === 4);
    case 'A6':
      return p.bars % 2 === 0 && (form !== 'call-response' || p.bars === 4);
    case 'A1':
    case 'A2':
      return true;
  }
}
