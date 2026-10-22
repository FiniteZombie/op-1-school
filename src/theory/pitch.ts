// Pitch-class maths and note names. Pure; no imports outside `src/types`.

import type { Key, MidiNote, PitchClass } from '../types/music';
import { parentMajorTonic } from './scales';

/** Any integer (a MIDI note, a pitch class plus an interval) to its pitch class, C = 0. */
export function pitchClass(n: MidiNote | number): PitchClass {
  return (((Math.round(n) % 12) + 12) % 12) as PitchClass;
}

/** `pc` moved up by `semitones` (negative moves down), wrapped to a pitch class. */
export function transpose(pc: PitchClass, semitones: number): PitchClass {
  return pitchClass(pc + semitones);
}

/** Semitones from `from` up to `to`, 0..11. */
export function intervalUp(from: PitchClass, to: PitchClass): number {
  return pitchClass(to - from);
}

const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'] as const;
const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'] as const;

/**
 * Parent-major tonics whose key signature has flats: F, B♭, E♭, A♭, D♭, G♭.
 * G♭ / F♯ (six of either) is spelled with flats.
 */
const FLAT_SIGNATURES: ReadonlySet<PitchClass> = new Set<PitchClass>([5, 10, 3, 8, 1, 6]);

/** True when `key`'s signature has flats (judged from the mode's parent major scale). */
export function usesFlats(key: Key): boolean {
  return FLAT_SIGNATURES.has(parentMajorTonic(key));
}

/**
 * The name of `pc`, spelled for `key`: flats when the key signature has flats
 * (F major, F minor, C dorian, …), sharps otherwise (C major, A minor, E
 * dorian, …). Black keys use Unicode ♭/♯. Without a key, black keys are
 * spelled with flats.
 */
export function noteName(pc: PitchClass, key?: Key): string {
  const names = key === undefined || usesFlats(key) ? FLAT_NAMES : SHARP_NAMES;
  return names[pc];
}
