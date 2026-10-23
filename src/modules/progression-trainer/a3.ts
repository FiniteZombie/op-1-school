// A3, chord quality: five buttons (`QUALITY_FAMILIES`); the first tap in each
// heard slot answers it, right when it equals the slot chord's
// `qualityFamily`. The reveal names the quality and lights its guide tones on
// the keyboard's guide. Score = right ÷ slots heard.
import { QUALITY_FAMILIES, guideTones, qualityFamily, type QualityFamily } from '../../theory';
import type { Progression } from '../../types/music';
import { LABELS } from './labels';
import {
  LoopLedger,
  SlotAnswers,
  previousSlot,
  type HeardRef,
  type LevelResult,
  type LevelScorer,
  type LiveView,
} from './scoring';

export function isQualityFamily(s: string): s is QualityFamily {
  return (QUALITY_FAMILIES as readonly string[]).includes(s);
}

export class A3Scorer implements LevelScorer {
  readonly level = 'A3' as const;
  private readonly answers = new SlotAnswers<{ family: QualityFamily; right: boolean }>();
  private readonly ledger = new LoopLedger();

  constructor(private readonly p: Progression) {}

  current(): Progression {
    return this.p;
  }

  loopStart(): void {}

  note(): void {}

  choose(value: string, at: HeardRef): boolean {
    const slot = this.p.slots[at.slot];
    if (at.iteration < 0 || !slot || !isQualityFamily(value) || this.answers.get(at)) return false;
    this.answers.set(at, { family: value, right: value === qualityFamily(slot.chord.quality) });
    return false;
  }

  loopEnd(run: number, iteration: number): Progression | null {
    this.ledger.complete(run, iteration);
    return null;
  }

  /** The slot heard now once it's answered, else the one before it. */
  live(at: HeardRef | null): LiveView {
    if (!at) return {};
    const ref = this.answers.get(at) ? at : previousSlot(at, this.p.slots.length);
    const slot = ref && this.p.slots[ref.slot];
    if (!ref || !slot) return {};
    const a = this.answers.get(ref);
    const g = guideTones(slot.chord);
    const word = a ? (a.right ? LABELS.right : LABELS.wrong) : LABELS.missed;
    return {
      reveal: { text: `${qualityFamily(slot.chord.quality) ?? '?'} · ${word}`, state: a?.right ? 'ok' : 'bad' },
      guide: [g.third, g.seventh],
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
      reveal: this.p.slots.map((s) => `${s.roman}: ${qualityFamily(s.chord.quality) ?? '?'}`),
    };
  }
}
