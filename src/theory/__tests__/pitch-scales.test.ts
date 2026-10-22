import { describe, expect, test } from 'vitest';
import { MODES, type Key, type PitchClass } from '../../types/music';
import { intervalUp, noteName, pitchClass, transpose, usesFlats } from '../pitch';
import { degreeInterval, hasMinorThird, inScale, parentMajorTonic, pentatonic, scale } from '../scales';

const key = (tonic: number, mode: Key['mode']): Key => ({ tonic: tonic as PitchClass, mode });

describe('pitch', () => {
  test('pitchClass wraps any integer', () => {
    expect([60, 0, 11, 12, -1, -13, 127].map(pitchClass)).toEqual([0, 0, 11, 0, 11, 11, 7]);
  });

  test('transpose and intervalUp', () => {
    expect(transpose(10, 4)).toBe(2);
    expect(transpose(1, -3)).toBe(10);
    expect(intervalUp(9, 2)).toBe(5);
    expect(intervalUp(2, 2)).toBe(0);
  });

  test('noteName: flats in flat keys, sharps otherwise', () => {
    const black = [1, 3, 6, 8, 10] as const;
    expect(black.map((pc) => noteName(pc, key(5, 'aeolian')))).toEqual(['D♭', 'E♭', 'G♭', 'A♭', 'B♭']); // F minor
    expect(black.map((pc) => noteName(pc, key(5, 'ionian')))).toEqual(['D♭', 'E♭', 'G♭', 'A♭', 'B♭']); // F major
    expect(black.map((pc) => noteName(pc, key(0, 'dorian')))).toEqual(['D♭', 'E♭', 'G♭', 'A♭', 'B♭']); // C dorian
    expect(black.map((pc) => noteName(pc, key(0, 'ionian')))).toEqual(['C♯', 'D♯', 'F♯', 'G♯', 'A♯']); // C major
    expect(black.map((pc) => noteName(pc, key(9, 'aeolian')))).toEqual(['C♯', 'D♯', 'F♯', 'G♯', 'A♯']); // A minor
    expect(black.map((pc) => noteName(pc, key(4, 'aeolian')))).toEqual(['C♯', 'D♯', 'F♯', 'G♯', 'A♯']); // E minor
    expect(black.map((pc) => noteName(pc))).toEqual(['D♭', 'E♭', 'G♭', 'A♭', 'B♭']); // no key
    expect(noteName(0, key(5, 'aeolian'))).toBe('C');
  });

  test('usesFlats follows the parent major', () => {
    expect(usesFlats(key(7, 'dorian'))).toBe(true); // G dorian: F major, one flat
    expect(usesFlats(key(2, 'dorian'))).toBe(false); // D dorian: C major
    expect(usesFlats(key(7, 'ionian'))).toBe(false); // G major
    expect(usesFlats(key(6, 'ionian'))).toBe(true); // G♭ / F♯ spelled with flats
  });
});

describe('scales', () => {
  test('modes as interval sets', () => {
    expect(scale(key(0, 'ionian'))).toEqual([0, 2, 4, 5, 7, 9, 11]);
    expect(scale(key(5, 'aeolian'))).toEqual([5, 7, 8, 10, 0, 1, 3]);
    expect(scale(key(7, 'dorian'))).toEqual([7, 9, 10, 0, 2, 4, 5]);
    expect(scale(key(4, 'phrygian'))).toEqual([4, 5, 7, 9, 11, 0, 2]);
    expect(scale(key(5, 'lydian'))).toEqual([5, 7, 9, 11, 0, 2, 4]);
    expect(scale(key(7, 'mixolydian'))).toEqual([7, 9, 11, 0, 2, 4, 5]);
    expect(scale(key(11, 'locrian'))).toEqual([11, 0, 2, 4, 5, 7, 9]);
  });

  test('every mode is a rotation of its parent major', () => {
    for (const mode of MODES) {
      const k = key(3, mode);
      expect(new Set(scale(k))).toEqual(new Set(scale(key(parentMajorTonic(k), 'ionian'))));
    }
  });

  test('inScale and degreeInterval', () => {
    expect(inScale(1, key(5, 'aeolian'))).toBe(true);
    expect(inScale(4, key(5, 'aeolian'))).toBe(false);
    expect(degreeInterval('aeolian', 6)).toBe(8);
    expect(() => degreeInterval('aeolian', 0)).toThrow(RangeError);
    expect(() => degreeInterval('aeolian', 8)).toThrow(RangeError);
  });

  test('pentatonic: minor when the mode has a minor third, else major', () => {
    expect(pentatonic(key(5, 'aeolian'))).toEqual([5, 8, 10, 0, 3]); // F minor pent
    expect(pentatonic(key(7, 'dorian'))).toEqual([7, 10, 0, 2, 5]);
    expect(pentatonic(key(0, 'ionian'))).toEqual([0, 2, 4, 7, 9]); // C major pent
    expect(pentatonic(key(0, 'lydian'))).toEqual([0, 2, 4, 7, 9]);
    expect(pentatonic(key(0, 'mixolydian'))).toEqual([0, 2, 4, 7, 9]);
    expect(pentatonic(key(4, 'phrygian'))).toEqual([4, 7, 9, 11, 2]);
    // Locrian: minor pentatonic as written, so its 5 is outside the mode (accepted).
    expect(pentatonic(key(11, 'locrian'))).toEqual([11, 2, 4, 6, 9]);
    expect(inScale(6, key(11, 'locrian'))).toBe(false);
  });

  test('hasMinorThird', () => {
    expect(MODES.filter(hasMinorThird)).toEqual(['dorian', 'phrygian', 'aeolian', 'locrian']);
  });
});
