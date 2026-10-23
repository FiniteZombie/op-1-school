// A1, bass root as degree: the first `on` in each heard slot answers it,
// right when its pitch class is the slot's bass. Score = right ÷ slots heard
// (unanswered is wrong). The reveal after each slot is the bass's degree.
import { chordName, degreeName, pitchClass } from '../../theory';
import type { Chord, PitchClass, Progression } from '../../types/music';
import { LABELS } from './labels';
import {
  LoopLedger,
  SlotAnswers,
  previousSlot,
  type HeardNote,
  type HeardRef,
  type LevelResult,
  type LevelScorer,
  type LiveView,
} from './scoring';

export function bassOf(chord: Chord): PitchClass {
  return chord.bass ?? chord.root;
}

export class A1Scorer implements LevelScorer {
  readonly level = 'A1' as const;
  private readonly answers = new SlotAnswers<{ note: number; right: boolean }>();
  private readonly ledger = new LoopLedger();

  constructor(private readonly p: Progression) {}

  current(): Progression {
    return this.p;
  }

  loopStart(): void {}

  note(n: HeardNote): void {
    const slot = this.p.slots[n.slot];
    if (n.iteration < 0 || !slot || this.answers.get(n)) return;
    this.answers.set(n, { note: n.note, right: pitchClass(n.note) === bassOf(slot.chord) });
  }

  /** The answer for a heard slot, if any (for tests and the live reveal). */
  answer(ref: Pick<HeardRef, 'run' | 'iteration' | 'slot'>): { note: number; right: boolean } | undefined {
    return this.answers.get(ref);
  }

  loopEnd(run: number, iteration: number): Progression | null {
    this.ledger.complete(run, iteration);
    return null;
  }

  live(at: HeardRef | null): LiveView {
    const prev = at && previousSlot(at, this.p.slots.length);
    const slot = prev && this.p.slots[prev.slot];
    if (!prev || !slot) return {};
    const a = this.answers.get(prev);
    const word = a ? (a.right ? LABELS.right : LABELS.wrong) : LABELS.missed;
    return {
      reveal: { text: `${degreeName(bassOf(slot.chord), this.p.key)} · ${word}`, state: a?.right ? 'ok' : 'bad' },
    };
  }

  result(): LevelResult {
    let right = 0;
    let wrong = 0;
    let missed = 0;
    for (const { run, iteration } of this.ledger.loops) {
      this.p.slots.forEach((_, slot) => {
        const a = this.answers.get({ run, iteration, slot });
        if (!a) missed += 1;
        else if (a.right) right += 1;
        else wrong += 1;
      });
    }
    const heard = right + wrong + missed;
    return {
      score: heard === 0 ? 0 : right / heard,
      data: { slotsHeard: heard, right, wrong, missed },
      counts: [
        { label: LABELS.right, n: right, state: 'ok' },
        { label: LABELS.wrong, n: wrong, state: 'bad' },
        { label: LABELS.missed, n: missed, state: 'bad' },
      ],
      reveal: this.p.slots.map(
        (s) => `${chordName(s.chord, this.p.key)}: ${degreeName(bassOf(s.chord), this.p.key)}`,
      ),
    };
  }
}
