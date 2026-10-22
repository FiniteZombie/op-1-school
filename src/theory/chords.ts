// Chord construction and note classification (SPEC §4.1, §5.3; plan decision 6). Pure.

import type {
  Chord,
  ChordQuality,
  Key,
  MidiNote,
  NoteClassification,
  PitchClass,
} from '../types/music';
import { intervalUp, noteName, pitchClass } from './pitch';
import { inScale, scale } from './scales';

/**
 * Semitones above the root, in order root, 3rd (or the sus note), 5th, then
 * 7th or 6th when the quality has one.
 */
export const QUALITY_INTERVALS: Readonly<Record<ChordQuality, readonly number[]>> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  maj7: [0, 4, 7, 11],
  '7': [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  m7b5: [0, 3, 6, 10],
  dim7: [0, 3, 6, 9],
  mMaj7: [0, 3, 7, 11],
};

/** Chord-symbol suffix per quality, as `chordName` prints it. */
const QUALITY_SUFFIX: Readonly<Record<ChordQuality, string>> = {
  maj: '',
  min: 'm',
  dim: 'dim',
  sus2: 'sus2',
  sus4: 'sus4',
  '6': '6',
  m6: 'm6',
  maj7: 'maj7',
  '7': '7',
  m7: 'm7',
  m7b5: 'm7♭5',
  dim7: 'dim7',
  mMaj7: 'mMaj7', // placeholder spelling; the plan's list doesn't name one
};

/**
 * The chord's tones from its quality, in order root, 3rd, 5th, 7th (or 6th).
 * `extensions` and a slash `bass` are not chord tones here.
 */
export function chordTones(chord: Chord): PitchClass[] {
  return QUALITY_INTERVALS[chord.quality].map((i) => pitchClass(chord.root + i));
}

/**
 * Classifies a note against a chord in a key (plan decision 6):
 * - **chord-tone**: one of `chordTones(chord)`;
 * - **avoid**: another note of the key's scale a half step above a chord
 *   tone, except b9 and b13 over a dominant (`7`) chord, which are tensions;
 * - **tension**: any other note of the key's scale;
 * - **outside**: not in the key's scale and not a chord tone.
 *
 * G7 in C major: tensions A, E; avoid C. C7 in F minor: tensions D♭, E♭, A♭;
 * avoid F; B♮ outside.
 */
export function classify(note: MidiNote, chord: Chord, key: Key): NoteClassification {
  return classifyPitchClass(pitchClass(note), chord, key);
}

function classifyPitchClass(pc: PitchClass, chord: Chord, key: Key): NoteClassification {
  const tones = chordTones(chord);
  if (tones.includes(pc)) return 'chord-tone';
  if (!inScale(pc, key)) return 'outside';
  if (!tones.includes(pitchClass(pc - 1))) return 'tension';
  const fromRoot = intervalUp(chord.root, pc);
  if (chord.quality === '7' && (fromRoot === 1 || fromRoot === 8)) return 'tension';
  return 'avoid';
}

/** Scale notes of `key` that aren't chord tones, ordered by interval above the root. */
function nonChordScaleNotes(chord: Chord, key: Key): PitchClass[] {
  return scale(key)
    .filter((pc) => !chordTones(chord).includes(pc))
    .sort((a, b) => intervalUp(chord.root, a) - intervalUp(chord.root, b));
}

/** The key's notes that `classify` calls tensions over `chord`, lowest interval above the root first. */
export function availableTensions(chord: Chord, key: Key): PitchClass[] {
  return nonChordScaleNotes(chord, key).filter((pc) => classifyPitchClass(pc, chord, key) === 'tension');
}

/** The key's notes that `classify` calls avoid notes over `chord`, lowest interval above the root first. */
export function avoidNotes(chord: Chord, key: Key): PitchClass[] {
  return nonChordScaleNotes(chord, key).filter((pc) => classifyPitchClass(pc, chord, key) === 'avoid');
}

/**
 * The two notes that define the chord: its third and seventh. `sus2`/`sus4`
 * use the 2nd/4th as the third. Chords without a seventh use the sixth for
 * `6`/`m6` and the fifth otherwise.
 */
export function guideTones(chord: Chord): { third: PitchClass; seventh: PitchClass } {
  const [, third, fifth, seventh] = chordTones(chord);
  if (third === undefined || fifth === undefined) {
    throw new Error(`chord quality ${chord.quality} has fewer than three tones`);
  }
  return { third, seventh: seventh ?? fifth };
}

/** Chord tones of `a` that are also chord tones of `b`, in `a`'s order. */
export function commonTones(a: Chord, b: Chord): PitchClass[] {
  const bTones = chordTones(b);
  return chordTones(a).filter((pc) => bTones.includes(pc));
}

/**
 * Moves each chord tone of `a`, in order root, 3rd, 5th, 7th, to the nearest
 * chord tone of `b`. `semitones` is in −6..+6; a tie (including a tritone)
 * goes down. Dm7 → G7: D→D 0, F→F 0, A→G −2, C→B −1.
 */
export function voiceLead(a: Chord, b: Chord): Array<{ from: PitchClass; to: PitchClass; semitones: number }> {
  const targets = chordTones(b);
  return chordTones(a).map((from) => {
    let best: { to: PitchClass; semitones: number } | undefined;
    for (const to of targets) {
      const up = intervalUp(from, to);
      const semitones = up >= 6 ? up - 12 : up; // a tritone counts as −6
      if (
        best === undefined ||
        Math.abs(semitones) < Math.abs(best.semitones) ||
        (Math.abs(semitones) === Math.abs(best.semitones) && semitones < best.semitones)
      ) {
        best = { to, semitones };
      }
    }
    if (best === undefined) throw new Error('target chord has no tones');
    return { from, ...best };
  });
}

/**
 * A chord symbol: root name, quality suffix (`''`, `m`, `dim`, `7`, `maj7`,
 * `m7`, `m7♭5`, `dim7`, `sus2`, `sus4`, `6`, `m6`, `mMaj7`), then `/<bass>`
 * for a slash chord. Names follow `noteName`: spelled for `key` when given,
 * flats otherwise. `extensions` are not printed.
 */
export function chordName(chord: Chord, key?: Key): string {
  const bass = chord.bass !== undefined && chord.bass !== chord.root ? `/${noteName(chord.bass, key)}` : '';
  return `${noteName(chord.root, key)}${QUALITY_SUFFIX[chord.quality]}${bass}`;
}
