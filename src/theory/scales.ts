// Modes as interval sets, and the pentatonic safety net (SPEC §4.1 A2). Pure.

import type { Key, Mode, PitchClass } from '../types/music';

/** Semitones above the tonic of each of a mode's seven degrees, degree 1 first. */
export const MODE_INTERVALS: Readonly<Record<Mode, readonly number[]>> = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
};

/** How far each mode's tonic sits above its parent major's tonic. */
const MODE_OFFSET: Readonly<Record<Mode, number>> = {
  ionian: 0,
  dorian: 2,
  phrygian: 4,
  lydian: 5,
  mixolydian: 7,
  aeolian: 9,
  locrian: 11,
};

const MINOR_PENTATONIC = [0, 3, 5, 7, 10] as const;
const MAJOR_PENTATONIC = [0, 2, 4, 7, 9] as const;

function pc(n: number): PitchClass {
  return (((n % 12) + 12) % 12) as PitchClass;
}

/** The key's seven pitch classes, from the tonic up. */
export function scale(key: Key): PitchClass[] {
  return MODE_INTERVALS[key.mode].map((i) => pc(key.tonic + i));
}

/** True when `pitch` is one of the key's seven notes. */
export function inScale(pitch: PitchClass, key: Key): boolean {
  return scale(key).includes(pitch);
}

/** Semitones above the tonic of the mode's degree `degree` (1–7). Throws outside 1–7. */
export function degreeInterval(mode: Mode, degree: number): number {
  const interval = MODE_INTERVALS[mode][degree - 1];
  if (!Number.isInteger(degree) || interval === undefined) {
    throw new RangeError(`scale degree must be 1–7, got ${degree}`);
  }
  return interval;
}

/** The tonic of the major scale this mode is a rotation of (C for D dorian). */
export function parentMajorTonic(key: Key): PitchClass {
  return pc(key.tonic - MODE_OFFSET[key.mode]);
}

/** True when the mode's third is minor (dorian, phrygian, aeolian, locrian). */
export function hasMinorThird(mode: Mode): boolean {
  return MODE_INTERVALS[mode][2] === 3;
}

/**
 * The pentatonic to play over the key: minor pentatonic (`1 b3 4 5 b7`) when
 * the mode has a minor third, else major pentatonic (`1 2 3 5 6`), from the
 * tonic. Locrian gets minor pentatonic as written, so its 5 is outside the
 * mode (plan pre-flight, accepted).
 */
export function pentatonic(key: Key): PitchClass[] {
  const shape = hasMinorThird(key.mode) ? MINOR_PENTATONIC : MAJOR_PENTATONIC;
  return shape.map((i) => pc(key.tonic + i));
}
