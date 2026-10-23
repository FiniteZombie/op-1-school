// A4, common tones vs moving tone (plan L2; pre-flight technical answer 17).
// Each pair (`a4Pairs`) is a vamp that loops until its questions are
// submitted; the drill then restarts on the next pair at the loop end, and
// wraps to the first pair after the last. Per pair:
// - common tones: the set of pitch classes played since the last submit
//   equals `commonTones(a, b)` (an empty submit answers "none");
// - moving tone: the first chord's 7th (`guideTones(a).seventh`) and where
//   `voiceLead` sends it, as the last two notes played, in order. A 7th that
//   holds falls back to the first voice in `voiceLead`'s order that moves; a
//   pair where nothing moves has no moving-tone question.
// Score = right ÷ questions answered (0 when none were).
import { chordName, commonTones, guideTones, noteName, pitchClass, voiceLead } from '../../theory';
import type { Chord, PitchClass, Progression } from '../../types/music';
import { a4Pairs, a4Vamp } from './arrange';
import { LABELS } from './labels';
import { type HeardNote, type HeardRef, type LevelResult, type LevelScorer, type LiveView } from './scoring';

export type A4Question =
  | { kind: 'common'; tones: PitchClass[] }
  | { kind: 'moving'; from: PitchClass; to: PitchClass };

export function movingTone(a: Chord, b: Chord): { from: PitchClass; to: PitchClass } | null {
  const moves = voiceLead(a, b);
  const seventh = guideTones(a).seventh;
  const own = moves.find((m) => m.from === seventh && m.semitones !== 0);
  const m = own ?? moves.find((x) => x.semitones !== 0);
  return m ? { from: m.from, to: m.to } : null;
}

export function questionsFor(a: Chord, b: Chord): A4Question[] {
  const qs: A4Question[] = [{ kind: 'common', tones: commonTones(a, b) }];
  const move = movingTone(a, b);
  if (move) qs.push({ kind: 'moving', ...move });
  return qs;
}

/** Whether `played` (pitch classes since the last submit, in order) answers `q`. */
export function answers(q: A4Question, played: readonly PitchClass[]): boolean {
  if (q.kind === 'common') {
    const got = new Set(played);
    return got.size === q.tones.length && q.tones.every((pc) => got.has(pc));
  }
  const n = played.length;
  return n >= 2 && played[n - 2] === q.from && played[n - 1] === q.to;
}

export interface A4Answer {
  pair: number;
  kind: A4Question['kind'];
  right: boolean;
}

export class A4Scorer implements LevelScorer {
  readonly level = 'A4' as const;
  private readonly pairs: ReturnType<typeof a4Pairs>;
  private pair = 0;
  private question = 0;
  private played: PitchClass[] = [];
  readonly answered: A4Answer[] = [];

  constructor(private readonly base: Progression) {
    this.pairs = a4Pairs(base);
    if (this.pairs.length === 0) throw new Error(`A4 can't use "${base.id}": no two consecutive chords differ`);
  }

  current(): Progression {
    const pair = this.pairs[this.pair];
    if (!pair) throw new Error('A4: no pair');
    return a4Vamp(this.base, pair, this.pair);
  }

  /** The open question, or null while the pair waits for its loop end. */
  open(): A4Question | null {
    const pair = this.pairs[this.pair];
    if (!pair) return null;
    return questionsFor(pair[0].chord, pair[1].chord)[this.question] ?? null;
  }

  loopStart(): void {}

  note(n: HeardNote): void {
    if (this.open()) this.played.push(pitchClass(n.note));
  }

  choose(value: string, _at: HeardRef): boolean {
    const q = this.open();
    if (value !== 'submit' || !q) return false;
    this.answered.push({ pair: this.pair, kind: q.kind, right: answers(q, this.played) });
    this.question += 1;
    this.played = [];
    return true;
  }

  loopEnd(): Progression | null {
    if (this.open()) return null;
    this.pair = (this.pair + 1) % this.pairs.length;
    this.question = 0;
    this.played = [];
    return this.current();
  }

  live(): LiveView {
    const q = this.open();
    const key = this.base.key;
    const played = this.played.length ? this.played.map((pc) => noteName(pc, key)).join(' ') : LABELS.none;
    const last = this.answered[this.answered.length - 1];
    return {
      prompt: {
        label: q ? (q.kind === 'common' ? LABELS.commonTones : LABELS.movingTone) : LABELS.nextPair,
        played,
        open: q !== null,
      },
      reveal: last && { text: last.right ? LABELS.right : LABELS.wrong, state: last.right ? 'ok' : 'bad' },
    };
  }

  result(): LevelResult {
    const right = this.answered.filter((a) => a.right).length;
    const wrong = this.answered.length - right;
    const key = this.base.key;
    const names = (pcs: readonly PitchClass[]) => (pcs.length ? pcs.map((pc) => noteName(pc, key)).join(' ') : LABELS.none);
    return {
      score: this.answered.length === 0 ? 0 : right / this.answered.length,
      data: { questions: this.answered.length, right, wrong, answers: this.answered },
      counts: [
        { label: LABELS.right, n: right, state: 'ok' },
        { label: LABELS.wrong, n: wrong, state: 'bad' },
      ],
      reveal: this.pairs.map(([a, b]) => {
        const move = movingTone(a.chord, b.chord);
        const moving = move ? `${noteName(move.from, key)} → ${noteName(move.to, key)}` : LABELS.none;
        return `${chordName(a.chord, key)} → ${chordName(b.chord, key)}: ${LABELS.commonTones} ${names(
          commonTones(a.chord, b.chord),
        )}; ${LABELS.movingTone} ${moving}`;
      }),
    };
  }
}
