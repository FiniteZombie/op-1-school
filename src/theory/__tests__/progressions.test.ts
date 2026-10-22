import { describe, expect, test } from 'vitest';
import type { ProgressionSpec } from '../../types/lessons';
import type { ChordQuality, Key, PitchClass } from '../../types/music';
import { chordTones } from '../chords';
import { degreeName, loadProgression, ProgressionError, realize, RomanNumeralError } from '../progressions';
import { A_MINOR_PEDAL, C_MAJOR_POP, F_MINOR_TURNAROUND, G_DORIAN_VAMP } from './fixtures';

const C_MAJOR: Key = { tonic: 0, mode: 'ionian' };
const F_MINOR: Key = { tonic: 5, mode: 'aeolian' };

const sorted = (xs: readonly number[]) => [...xs].sort((a, b) => a - b);

/** Each slot's chord tones as a sorted set, plus its bass when set. */
function realized(spec: ProgressionSpec) {
  return loadProgression(spec).slots.map(({ chord }) => ({
    tones: sorted(chordTones(chord)),
    bass: chord.bass,
  }));
}

describe('SPEC §5.3 fixtures (pitch-class sets)', () => {
  test('F minor ii°–V7–i–VI', () => {
    expect(realized(F_MINOR_TURNAROUND)).toEqual([
      { tones: sorted([7, 10, 1]), bass: undefined },
      { tones: sorted([0, 4, 7, 10]), bass: undefined },
      { tones: sorted([5, 8, 0]), bass: undefined },
      { tones: sorted([1, 5, 8]), bass: undefined },
    ]);
  });

  test('G dorian i–IV', () => {
    expect(realized(G_DORIAN_VAMP)).toEqual([
      { tones: sorted([7, 10, 2]), bass: undefined },
      { tones: sorted([0, 4, 7]), bass: undefined },
    ]);
  });

  test('C major I–V–vi–IV', () => {
    expect(realized(C_MAJOR_POP)).toEqual([
      { tones: sorted([0, 4, 7]), bass: undefined },
      { tones: sorted([7, 11, 2]), bass: undefined },
      { tones: sorted([9, 0, 4]), bass: undefined },
      { tones: sorted([5, 9, 0]), bass: undefined },
    ]);
  });

  test('A minor pedal i–iv/1–VII/1–i', () => {
    expect(realized(A_MINOR_PEDAL)).toEqual([
      { tones: sorted([9, 0, 4]), bass: undefined },
      { tones: sorted([2, 5, 9]), bass: 9 },
      { tones: sorted([7, 11, 2]), bass: 9 },
      { tones: sorted([9, 0, 4]), bass: undefined },
    ]);
  });
});

describe('degreeName (relative to the tonic major scale, decision 4)', () => {
  test('D♭ in F minor is b6', () => {
    expect(degreeName(1, F_MINOR)).toBe('b6');
  });

  test('F♯ in C major is #4', () => {
    expect(degreeName(6, C_MAJOR)).toBe('#4');
  });

  test('all twelve from the tonic', () => {
    const names = Array.from({ length: 12 }, (_, i) => degreeName(((5 + i) % 12) as PitchClass, F_MINOR));
    expect(names).toEqual(['1', 'b2', '2', 'b3', '3', '4', '#4', '5', 'b6', '6', 'b7', '7']);
  });

  test('chord VI and degree b6 name the same note in F minor', () => {
    expect(realize('VI', F_MINOR).root).toBe(1);
    expect(degreeName(1, F_MINOR)).toBe('b6');
  });
});

describe('realize: suffix case table (pre-flight R3)', () => {
  // [suffix, quality on upper case, quality on lower case]. Only bare, 7 and 6 follow case.
  const table: Array<[string, ChordQuality, ChordQuality]> = [
    ['', 'maj', 'min'],
    ['7', '7', 'm7'],
    ['6', '6', 'm6'],
    ['maj7', 'maj7', 'maj7'],
    ['m7', 'm7', 'm7'],
    ['ø7', 'm7b5', 'm7b5'],
    ['°', 'dim', 'dim'],
    ['°7', 'dim7', 'dim7'],
    ['sus2', 'sus2', 'sus2'],
    ['sus4', 'sus4', 'sus4'],
    ['m6', 'm6', 'm6'],
  ];

  test.each(table)('suffix "%s": upper %s, lower %s', (suffix, upper, lower) => {
    expect(realize(`V${suffix}`, C_MAJOR)).toEqual({ root: 7, quality: upper });
    expect(realize(`v${suffix}`, C_MAJOR)).toEqual({ root: 7, quality: lower });
  });

  test('chord tones for each suffix on G', () => {
    const tones = (roman: string) => sorted(chordTones(realize(roman, C_MAJOR)));
    expect(tones('V')).toEqual(sorted([7, 11, 2]));
    expect(tones('v')).toEqual(sorted([7, 10, 2]));
    expect(tones('V7')).toEqual(sorted([7, 11, 2, 5]));
    expect(tones('v7')).toEqual(sorted([7, 10, 2, 5]));
    expect(tones('V6')).toEqual(sorted([7, 11, 2, 4]));
    expect(tones('v6')).toEqual(sorted([7, 10, 2, 4]));
    expect(tones('Vmaj7')).toEqual(sorted([7, 11, 2, 6]));
    expect(tones('Vm7')).toEqual(sorted([7, 10, 2, 5]));
    expect(tones('vø7')).toEqual(sorted([7, 10, 1, 5]));
    expect(tones('v°')).toEqual(sorted([7, 10, 1]));
    expect(tones('v°7')).toEqual(sorted([7, 10, 1, 4]));
    expect(tones('Vsus2')).toEqual(sorted([7, 9, 2]));
    expect(tones('Vsus4')).toEqual(sorted([7, 0, 2]));
    expect(tones('Vm6')).toEqual(sorted([7, 10, 2, 4]));
  });
});

describe('realize: degrees, accidentals and bass', () => {
  test('bVII in C major is B♭ major', () => {
    expect(realize('bVII', C_MAJOR)).toEqual({ root: 10, quality: 'maj' });
  });

  test('♭ and ♯ are accepted too', () => {
    expect(realize('♭VII', C_MAJOR)).toEqual(realize('bVII', C_MAJOR));
    expect(realize('♯iv°', C_MAJOR)).toEqual(realize('#iv°', C_MAJOR));
    expect(realize('#iv°', C_MAJOR)).toEqual({ root: 6, quality: 'dim' });
  });

  test('numerals are degrees of the key mode', () => {
    expect(realize('III', F_MINOR).root).toBe(8); // A♭
    expect(realize('VII', F_MINOR).root).toBe(3); // E♭
    expect(realize('IV', { tonic: 7, mode: 'dorian' }).root).toBe(0); // C, the dorian major IV
  });

  test('/<degree> is a degree of the key mode, b/# allowed', () => {
    expect(realize('iv/1', { tonic: 9, mode: 'aeolian' })).toEqual({ root: 2, quality: 'min', bass: 9 });
    expect(realize('I/3', C_MAJOR)).toEqual({ root: 0, quality: 'maj', bass: 4 });
    expect(realize('i/3', F_MINOR)).toEqual({ root: 5, quality: 'min', bass: 8 }); // A♭: the mode's 3rd
    expect(realize('I/b7', C_MAJOR)).toEqual({ root: 0, quality: 'maj', bass: 10 });
    expect(realize('V7/#4', C_MAJOR)).toEqual({ root: 7, quality: '7', bass: 6 });
  });

  test('a bass equal to the root is dropped', () => {
    expect(realize('I/1', C_MAJOR)).toEqual({ root: 0, quality: 'maj' });
  });

  test.each(['xii', 'Iv', 'iI', 'VIII', '', ' I', 'I ', 'V9', 'Vm', 'Vø', 'I/8', 'I/0', 'I/', 'bbVII', 'H'])(
    'rejects "%s"',
    (roman) => {
      expect(() => realize(roman, C_MAJOR)).toThrow(RomanNumeralError);
    },
  );
});

describe('loadProgression', () => {
  test('returns the progression with realized slots', () => {
    const p = loadProgression(F_MINOR_TURNAROUND);
    expect(p).toMatchObject({
      id: 'test-fminor',
      key: F_MINOR,
      bpm: 90,
      swing: 0.5,
      bars: 4,
      style: 'chillhop-rhodes',
      family: 'test-fixture',
    });
    expect(p.slots.map((s) => [s.roman, s.beats, s.chord.root, s.chord.quality])).toEqual([
      ['ii°', 4, 7, 'dim'],
      ['V7', 4, 0, '7'],
      ['i', 4, 5, 'min'],
      ['VI', 4, 1, 'maj'],
    ]);
  });

  test('throws on xii, naming the slot', () => {
    const spec = {
      ...F_MINOR_TURNAROUND,
      slots: [...F_MINOR_TURNAROUND.slots.slice(0, 2), { roman: 'xii', beats: 4 }, { roman: 'VI', beats: 4 }],
    };
    expect(() => loadProgression(spec)).toThrow(ProgressionError);
    expect(() => loadProgression(spec)).toThrow(/slots\[2\] "xii"/);
  });

  test('throws when beats sum to 15 for 4 bars', () => {
    const spec = {
      ...F_MINOR_TURNAROUND,
      slots: [
        { roman: 'ii°', beats: 4 },
        { roman: 'V7', beats: 4 },
        { roman: 'i', beats: 4 },
        { roman: 'VI', beats: 3 },
      ],
    };
    expect(() => loadProgression(spec)).toThrow(ProgressionError);
    expect(() => loadProgression(spec)).toThrow(/sum to 15.*need 16/);
  });

  test('fractional beats that sum right are fine', () => {
    const spec = {
      ...C_MAJOR_POP,
      bars: 1,
      slots: [
        { roman: 'I', beats: 1.5 },
        { roman: 'V', beats: 2.5 },
      ],
    };
    expect(loadProgression(spec).slots).toHaveLength(2);
  });

  test('throws on a shape error from validateProgressionSpec', () => {
    const spec = { ...C_MAJOR_POP, slots: [{ roman: 'I', beats: 0 }] };
    expect(() => loadProgression(spec)).toThrow(/beats/);
  });
});
