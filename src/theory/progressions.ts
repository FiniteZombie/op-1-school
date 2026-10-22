// Roman numerals → chords in a key, degree names, and `ProgressionSpec` →
// `Progression` (plan decisions 3 and 4). Pure.

import { validateProgressionSpec, type ProgressionSpec } from '../types/lessons';
import type { Chord, ChordQuality, ChordSlot, Key, PitchClass, Progression } from '../types/music';
import { intervalUp, pitchClass } from './pitch';
import { degreeInterval } from './scales';

const DEGREE_NAMES = ['1', 'b2', '2', 'b3', '3', '4', '#4', '5', 'b6', '6', 'b7', '7'] as const;

/**
 * The note's degree name, **relative to the tonic's major scale** (plan
 * decision 4): `1 b2 2 b3 3 4 #4 5 b6 6 b7 7`, whatever the key's mode. So in
 * F minor, D♭ is `b6`, and F♯ in C major is `#4`.
 *
 * Roman numerals and the `/<degree>` bass in `realize` count degrees of the
 * key's *mode* instead (D♭ is chord `VI` in F minor). Different on purpose.
 */
export function degreeName(pc: PitchClass, key: Key): string {
  return DEGREE_NAMES[intervalUp(key.tonic, pc)] ?? '1';
}

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const;

/** Suffixes that ignore the numeral's case. */
const FIXED_SUFFIX: Readonly<Record<string, ChordQuality>> = {
  maj7: 'maj7',
  m7: 'm7',
  'ø7': 'm7b5',
  '°': 'dim',
  '°7': 'dim7',
  sus2: 'sus2',
  sus4: 'sus4',
  m6: 'm6',
};

/** Suffixes whose quality follows the numeral's case: [upper case, lower case]. */
const CASED_SUFFIX: Readonly<Record<string, readonly [ChordQuality, ChordQuality]>> = {
  '': ['maj', 'min'],
  '7': ['7', 'm7'],
  '6': ['6', 'm6'],
};

const ACCIDENTAL: Readonly<Record<string, number>> = { '': 0, b: -1, '♭': -1, '#': 1, '♯': 1 };

const ROMAN_RE =
  /^([b#♭♯]?)(VII|VI|V|IV|III|II|I|vii|vi|v|iv|iii|ii|i)(maj7|m7|ø7|°7|°|sus2|sus4|m6|7|6|)(?:\/([b#♭♯]?)([1-7]))?$/u;

/** Thrown by `realize` on a numeral it can't parse. */
export class RomanNumeralError extends Error {
  override readonly name = 'RomanNumeralError';
}

/**
 * Builds the chord a roman numeral names in `key`. This grammar is the
 * curriculum's contract (plan decision 3, pre-flight R3):
 *
 * `[accidental] numeral [suffix] [/ [accidental] degree]`
 *
 * - **numeral** `I`–`VII` / `i`–`vii`: a degree of the key's *mode*, so F
 *   minor's sixth chord is `VI` (D♭). All upper or all lower case.
 * - **accidental** `b` or `#` (`♭`/`♯` also accepted) moves that degree a
 *   semitone: `bVII` in C major is B♭.
 * - **suffix**, and what case does to it:
 *
 *   | suffix  | upper case (`V…`) | lower case (`v…`) |
 *   | ------- | ----------------- | ----------------- |
 *   | (none)  | maj               | min               |
 *   | `7`     | 7                 | m7                |
 *   | `6`     | 6                 | m6                |
 *   | `maj7`  | maj7              | maj7              |
 *   | `m7`    | m7                | m7                |
 *   | `ø7`    | m7b5              | m7b5              |
 *   | `°`     | dim               | dim               |
 *   | `°7`    | dim7              | dim7              |
 *   | `sus2`  | sus2              | sus2              |
 *   | `sus4`  | sus4              | sus4              |
 *   | `m6`    | m6                | m6                |
 *
 *   An explicit suffix wins over case; only bare, `7` and `6` follow it.
 * - **`/<degree>`** sets the bass to an arabic degree (1–7) of the key's
 *   *mode*, `b`/`#` allowed: `iv/1` in A minor is D minor over A. Unlike
 *   `degreeName`, which names notes against the tonic's major scale. A bass
 *   equal to the root is dropped.
 *
 * No spaces. Throws `RomanNumeralError` on anything else.
 */
export function realize(roman: string, key: Key): Chord {
  const m = ROMAN_RE.exec(roman);
  if (m === null) throw new RomanNumeralError(`can't parse roman numeral "${roman}"`);
  const [, acc = '', numeral = '', suffix = '', bassAcc = '', bassDegree] = m;

  const upper = numeral === numeral.toUpperCase();
  const degree = NUMERALS.indexOf(numeral.toUpperCase() as (typeof NUMERALS)[number]) + 1;
  const root = pitchClass(key.tonic + degreeInterval(key.mode, degree) + (ACCIDENTAL[acc] ?? 0));

  const cased = CASED_SUFFIX[suffix];
  const quality = cased !== undefined ? cased[upper ? 0 : 1] : FIXED_SUFFIX[suffix];
  if (quality === undefined) throw new RomanNumeralError(`unknown suffix "${suffix}" in "${roman}"`);

  const chord: Chord = { root, quality };
  if (bassDegree !== undefined) {
    const bass = pitchClass(
      key.tonic + degreeInterval(key.mode, Number(bassDegree)) + (ACCIDENTAL[bassAcc] ?? 0),
    );
    if (bass !== root) chord.bass = bass;
  }
  return chord;
}

/** Thrown by `loadProgression`; the message names the slot or field at fault. */
export class ProgressionError extends Error {
  override readonly name = 'ProgressionError';
}

/** Beats per bar. Progressions are 4/4 (the transport accepts only `[n, 4]`; the spec form has no time signature). */
const BEATS_PER_BAR = 4;

/**
 * Turns the JSON form into a `Progression`: checks the shape with
 * `validateProgressionSpec`, realizes each slot's numeral in the spec's key,
 * and checks that the slots' beats sum to `bars × 4`. Throws
 * `ProgressionError` naming the slot (`slots[2] "xii": …`) or the sum.
 */
export function loadProgression(spec: ProgressionSpec): Progression {
  const errors = validateProgressionSpec(spec);
  if (errors.length > 0) {
    throw new ProgressionError(`progression ${describe(spec)} is invalid: ${errors.join('; ')}`);
  }

  const slots: ChordSlot[] = spec.slots.map(({ roman, beats }, i) => {
    try {
      return { chord: realize(roman, spec.key), roman, beats };
    } catch (e) {
      const why = e instanceof Error ? e.message : String(e);
      throw new ProgressionError(`progression ${describe(spec)}, slots[${i}] "${roman}": ${why}`);
    }
  });

  const total = spec.slots.reduce((sum, s) => sum + s.beats, 0);
  const expected = spec.bars * BEATS_PER_BAR;
  if (Math.abs(total - expected) > 1e-9) {
    throw new ProgressionError(
      `progression ${describe(spec)}: slots' beats sum to ${total}, but ${spec.bars} bars need ${expected}`,
    );
  }

  return {
    id: spec.id,
    key: { ...spec.key },
    bpm: spec.bpm,
    swing: spec.swing,
    bars: spec.bars,
    slots,
    style: spec.style,
    family: spec.family,
  };
}

function describe(spec: ProgressionSpec): string {
  return typeof spec?.id === 'string' ? `"${spec.id}"` : '(no id)';
}
