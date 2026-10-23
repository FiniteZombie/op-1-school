// A2, pentatonic safety net: unscored. A clash is an `on` whose pitch class
// isn't in `pentatonic(key)`; `data` keeps notes and clashes. The keyboard's
// guide shows the pentatonic, and nothing is classified (pre-flight technical
// answer 9).
import { noteName, pentatonic, pitchClass } from '../../theory';
import type { PitchClass, Progression } from '../../types/music';
import { LABELS } from './labels';
import { LoopLedger, loopKey, type HeardNote, type LevelResult, type LevelScorer, type LiveView } from './scoring';

export class A2Scorer implements LevelScorer {
  readonly level = 'A2' as const;
  private readonly scale: readonly PitchClass[];
  private readonly perLoop = new Map<string, { notes: number; clashes: number }>();
  private readonly ledger = new LoopLedger();

  constructor(private readonly p: Progression) {
    this.scale = pentatonic(p.key);
  }

  current(): Progression {
    return this.p;
  }

  loopStart(): void {}

  note(n: HeardNote): void {
    if (n.iteration < 0) return;
    const k = loopKey(n.run, n.iteration);
    const loop = this.perLoop.get(k) ?? { notes: 0, clashes: 0 };
    loop.notes += 1;
    if (!this.scale.includes(pitchClass(n.note))) loop.clashes += 1;
    this.perLoop.set(k, loop);
  }

  loopEnd(run: number, iteration: number): Progression | null {
    this.ledger.complete(run, iteration);
    return null;
  }

  live(): LiveView {
    return { guide: this.scale };
  }

  result(): LevelResult {
    let notes = 0;
    let clashes = 0;
    for (const { run, iteration } of this.ledger.loops) {
      const loop = this.perLoop.get(loopKey(run, iteration));
      notes += loop?.notes ?? 0;
      clashes += loop?.clashes ?? 0;
    }
    return {
      data: { notes, clashes },
      counts: [
        { label: LABELS.notes, n: notes, state: 'neutral' },
        { label: LABELS.clashes, n: clashes, state: 'bad' },
      ],
      reveal: [this.scale.map((pc) => noteName(pc, this.p.key)).join(' ')],
    };
  }
}
