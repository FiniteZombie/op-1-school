import { describe, expect, test } from 'vitest';
import { CHORD_QUALITIES, type Chord, type Key, type NoteClassification } from '../../types/music';
import {
  availableTensions,
  avoidNotes,
  chordName,
  chordTones,
  classify,
  commonTones,
  guideTones,
  QUALITY_FAMILIES,
  qualityFamily,
  voiceLead,
} from '../chords';
import { realize } from '../progressions';

const C_MAJOR: Key = { tonic: 0, mode: 'ionian' };
const F_MINOR: Key = { tonic: 5, mode: 'aeolian' };
const A_MINOR: Key = { tonic: 9, mode: 'aeolian' };

const sorted = (xs: readonly number[]) => [...xs].sort((a, b) => a - b);

/** classify over all 12 pitch classes, grouped by result. */
function classifyAll(chord: Chord, key: Key): Record<NoteClassification, number[]> {
  const out: Record<NoteClassification, number[]> = { 'chord-tone': [], tension: [], avoid: [], outside: [] };
  for (let pc = 0; pc < 12; pc++) out[classify(60 + pc, chord, key)].push(pc);
  return out;
}

describe('classify (decision 6, pre-flight R3 lists)', () => {
  test('G7 in C major', () => {
    expect(classifyAll({ root: 7, quality: '7' }, C_MAJOR)).toEqual({
      'chord-tone': [2, 5, 7, 11],
      tension: [4, 9],
      avoid: [0],
      outside: [1, 3, 6, 8, 10],
    });
  });

  test('C7 in F minor', () => {
    expect(classifyAll({ root: 0, quality: '7' }, F_MINOR)).toEqual({
      'chord-tone': [0, 4, 7, 10],
      tension: [1, 3, 8],
      avoid: [5],
      outside: [2, 6, 9, 11],
    });
  });

  test('Cmaj7 in C major: F is avoid', () => {
    expect(classify(65, { root: 0, quality: 'maj7' }, C_MAJOR)).toBe('avoid');
    expect(classifyAll({ root: 0, quality: 'maj7' }, C_MAJOR)).toMatchObject({ avoid: [5], tension: [2, 9] });
  });

  test('b9 / b13 exemption is for dominant chords only', () => {
    // Fm in F minor: G♭ isn't in the scale; D♭ (b6 of the key) is a half step above C → avoid.
    expect(classify(61, { root: 5, quality: 'min' }, F_MINOR)).toBe('avoid');
    // Am7 in A minor: F (b13 over A) is a half step above E → avoid on a non-dominant chord.
    expect(classify(65, { root: 9, quality: 'm7' }, A_MINOR)).toBe('avoid');
  });

  test('works on any octave of the MIDI note', () => {
    for (const note of [1, 49, 61, 121]) {
      expect(classify(note, { root: 0, quality: '7' }, F_MINOR)).toBe('tension');
    }
  });
});

describe('availableTensions / avoidNotes', () => {
  test('G7 in C major', () => {
    expect(availableTensions({ root: 7, quality: '7' }, C_MAJOR)).toEqual([9, 4]); // 9th, 13th
    expect(avoidNotes({ root: 7, quality: '7' }, C_MAJOR)).toEqual([0]);
  });

  test('C7 in F minor', () => {
    expect(availableTensions({ root: 0, quality: '7' }, F_MINOR)).toEqual([1, 3, 8]); // b9, #9, b13
    expect(avoidNotes({ root: 0, quality: '7' }, F_MINOR)).toEqual([5]);
  });
});

describe('chordTones', () => {
  test('every quality is root first, and 3–4 distinct notes', () => {
    for (const quality of CHORD_QUALITIES) {
      const tones = chordTones({ root: 2, quality });
      expect(tones[0]).toBe(2);
      expect(new Set(tones).size).toBe(tones.length);
      expect(tones.length).toBeGreaterThanOrEqual(3);
      expect(tones.length).toBeLessThanOrEqual(4);
    }
  });

  test('slash bass is not a chord tone', () => {
    expect(sorted(chordTones({ root: 7, quality: 'maj', bass: 9 }))).toEqual([2, 7, 11]);
  });
});

describe('guideTones', () => {
  test('third and seventh', () => {
    expect(guideTones({ root: 7, quality: '7' })).toEqual({ third: 11, seventh: 5 });
    expect(guideTones({ root: 2, quality: 'm7' })).toEqual({ third: 5, seventh: 0 });
    expect(guideTones({ root: 0, quality: 'maj7' })).toEqual({ third: 4, seventh: 11 });
    expect(guideTones({ root: 7, quality: 'm7b5' })).toEqual({ third: 10, seventh: 5 });
    expect(guideTones({ root: 7, quality: 'dim7' })).toEqual({ third: 10, seventh: 4 });
  });

  test('6 / m6 use the sixth; other triads the fifth', () => {
    expect(guideTones({ root: 0, quality: '6' })).toEqual({ third: 4, seventh: 9 });
    expect(guideTones({ root: 0, quality: 'm6' })).toEqual({ third: 3, seventh: 9 });
    expect(guideTones({ root: 0, quality: 'maj' })).toEqual({ third: 4, seventh: 7 });
    expect(guideTones({ root: 0, quality: 'min' })).toEqual({ third: 3, seventh: 7 });
    expect(guideTones({ root: 0, quality: 'dim' })).toEqual({ third: 3, seventh: 6 });
  });

  test('sus chords use the 2nd / 4th as the third', () => {
    expect(guideTones({ root: 0, quality: 'sus2' })).toEqual({ third: 2, seventh: 7 });
    expect(guideTones({ root: 0, quality: 'sus4' })).toEqual({ third: 5, seventh: 7 });
  });
});

describe('commonTones and voiceLead', () => {
  test('commonTones(Fm7, B♭m7) = {F, A♭} (SPEC §4.1 A4)', () => {
    expect(sorted(commonTones({ root: 5, quality: 'm7' }, { root: 10, quality: 'm7' }))).toEqual([5, 8]);
  });

  test('Dm7 → G7: D→D 0, F→F 0, A→G −2, C→B −1', () => {
    expect(voiceLead({ root: 2, quality: 'm7' }, { root: 7, quality: '7' })).toEqual([
      { from: 2, to: 2, semitones: 0 },
      { from: 5, to: 5, semitones: 0 },
      { from: 9, to: 7, semitones: -2 },
      { from: 0, to: 11, semitones: -1 },
    ]);
  });

  test('ties go down', () => {
    // From D to C major (C E G): C −2 and E +2 tie → C.
    expect(voiceLead({ root: 2, quality: 'min' }, { root: 0, quality: 'maj' })[0]).toEqual({
      from: 2,
      to: 0,
      semitones: -2,
    });
  });

  test('every move is in −6..+6', () => {
    for (const qa of CHORD_QUALITIES) {
      for (const qb of CHORD_QUALITIES) {
        for (const move of voiceLead({ root: 0, quality: qa }, { root: 6, quality: qb })) {
          expect(move.semitones).toBeGreaterThanOrEqual(-6);
          expect(move.semitones).toBeLessThanOrEqual(6);
        }
      }
    }
  });
});

describe('chordName', () => {
  test('R9 reads Gdim, C7, Fm, D♭ for F minor ii°–V7–i–VI', () => {
    expect(['ii°', 'V7', 'i', 'VI'].map((r) => chordName(realize(r, F_MINOR), F_MINOR))).toEqual([
      'Gdim',
      'C7',
      'Fm',
      'D♭',
    ]);
    expect(['ii°', 'V7', 'i', 'VI'].map((r) => chordName(realize(r, F_MINOR)))).toEqual([
      'Gdim',
      'C7',
      'Fm',
      'D♭',
    ]);
  });

  test('every quality suffix', () => {
    const names = Object.fromEntries(CHORD_QUALITIES.map((quality) => [quality, chordName({ root: 0, quality })]));
    expect(names).toEqual({
      maj: 'C',
      min: 'Cm',
      dim: 'Cdim',
      '7': 'C7',
      maj7: 'Cmaj7',
      m7: 'Cm7',
      m7b5: 'Cm7♭5',
      dim7: 'Cdim7',
      sus2: 'Csus2',
      sus4: 'Csus4',
      '6': 'C6',
      m6: 'Cm6',
      mMaj7: 'CmMaj7',
    });
  });

  test('slash bass', () => {
    expect(chordName(realize('iv/1', A_MINOR), A_MINOR)).toBe('Dm/A');
    expect(chordName(realize('VII/1', A_MINOR), A_MINOR)).toBe('G/A');
    expect(chordName({ root: 1, quality: 'maj', bass: 8 }, F_MINOR)).toBe('D♭/A♭');
  });

  test('spelled for the key when one is given', () => {
    const fSharp = { root: 6, quality: 'maj7' } as const;
    expect(chordName(fSharp, { tonic: 4, mode: 'ionian' })).toBe('F♯maj7'); // E major: sharps
    expect(chordName(fSharp, F_MINOR)).toBe('G♭maj7'); // F minor: flats
    expect(chordName(fSharp)).toBe('G♭maj7'); // no key: flats
  });
});

describe('qualityFamily', () => {
  test('maps every member of CHORD_QUALITIES', () => {
    const expected: Record<(typeof CHORD_QUALITIES)[number], ReturnType<typeof qualityFamily>> = {
      maj7: 'maj7',
      '7': '7',
      m7: 'm7',
      m7b5: 'm7b5',
      dim7: null,
      sus4: 'sus',
      sus2: 'sus',
      maj: null,
      min: null,
      mMaj7: null,
      '6': null,
      m6: null,
      dim: null,
    };
    for (const q of CHORD_QUALITIES) expect(qualityFamily(q), q).toBe(expected[q]);
    expect(Object.keys(expected).sort()).toEqual([...CHORD_QUALITIES].sort());
  });

  test('every family is reached by some quality', () => {
    const reached = new Set(CHORD_QUALITIES.map(qualityFamily).filter((f) => f !== null));
    expect([...reached].sort()).toEqual([...QUALITY_FAMILIES].sort());
  });
});
