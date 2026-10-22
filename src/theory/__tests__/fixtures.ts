// SPEC §5.3's four test progressions as `ProgressionSpec`s, one bar per slot
// at 90 BPM. Shared with later spine tests (row 5's voicing tests use them).

import type { ProgressionSpec } from '../../types/lessons';

function spec(
  id: string,
  key: ProgressionSpec['key'],
  romans: string[],
): ProgressionSpec {
  return {
    id,
    key,
    bpm: 90,
    swing: 0.5,
    bars: romans.length,
    slots: romans.map((roman) => ({ roman, beats: 4 })),
    style: 'chillhop-rhodes',
    family: 'test-fixture',
  };
}

/** F minor `ii°–V7–i–VI`: Gdim, C7, Fm, D♭. */
export const F_MINOR_TURNAROUND = spec('test-fminor', { tonic: 5, mode: 'aeolian' }, [
  'ii°',
  'V7',
  'i',
  'VI',
]);

/** G dorian `i–IV`: Gm, C. */
export const G_DORIAN_VAMP = spec('test-gdorian', { tonic: 7, mode: 'dorian' }, ['i', 'IV']);

/** C major `I–V–vi–IV`: C, G, Am, F. */
export const C_MAJOR_POP = spec('test-cmajor', { tonic: 0, mode: 'ionian' }, ['I', 'V', 'vi', 'IV']);

/** A minor pedal `i–iv/1–VII/1–i`: Am, Dm/A, G/A, Am. */
export const A_MINOR_PEDAL = spec('test-aminor-pedal', { tonic: 9, mode: 'aeolian' }, [
  'i',
  'iv/1',
  'VII/1',
  'i',
]);

export const SPEC_FIXTURES = [F_MINOR_TURNAROUND, G_DORIAN_VAMP, C_MAJOR_POP, A_MINOR_PEDAL] as const;
