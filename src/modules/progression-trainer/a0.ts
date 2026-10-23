// A0, hear the harmonic rhythm (plan L2; pre-flight technical answer 16).
//
// A change is a slot start whose chord differs from the slot before it (the
// loop's last slot before the first). A run's first downbeat is one only
// after the drill's own restart, against the chord heard just before it;
// otherwise there was silence before it. Each change takes the nearest
// unmatched tap (pad or any key) within half a slot, edges included; every
// other tap is extra. Matches are judged by `tapVerdict`. The score pools
// every completed loop: on ÷ (changes + extra), absent when any match is
// unscored (a source with no measurement).
import { offsetMs } from '../../audio/Clock';
import { tapVerdict, type TapVerdict } from '../../audio/tapWindow';
import type { InputSource, MidiNote, Progression, TimingOffset } from '../../types/music';
import { A0_STAGES, a0Stage, sameChord } from './arrange';
import { LABELS, stageLabel } from './labels';
import {
  LoopLedger,
  halfMs,
  type CountRow,
  type HeardNote,
  type LevelResult,
  type LevelScorer,
  type LiveView,
  type LoopStart,
  type ScoreContext,
} from './scoring';

/** A loop scoring at least this steps the stage down (SPEC §4's 70% gate). */
export const A0_STEP_SCORE = 0.7;
/** Loops at a stage before an unscored stage steps down. */
export const A0_UNSCORED_LOOPS = 2;

interface Change {
  run: number;
  iteration: number;
  absTick: number;
  loopTick: number;
  /** When it sounds (scheduled audio time). */
  audio: number;
  windowMs: number;
}

interface Tap {
  run: number;
  iteration: number;
  perfTs: number;
  source: InputSource;
  note: MidiNote;
}

interface Match {
  tap: Tap;
  offsetMs: number;
  calibrated: boolean;
  verdict: TapVerdict;
}

export class A0Scorer implements LevelScorer {
  readonly level = 'A0' as const;
  private stage = 0;
  private loopsAtStage = 0;
  private readonly changes: Change[] = [];
  private readonly taps: Tap[] = [];
  private readonly ledger = new LoopLedger();

  constructor(
    private readonly base: Progression,
    private readonly ctx: ScoreContext,
  ) {}

  current(): Progression {
    return a0Stage(this.base, this.stage);
  }

  /** The stage's beats per chord. */
  stageBeats(): number {
    return A0_STAGES[this.stage] ?? 2;
  }

  loopStart(l: LoopStart): void {
    const { slots } = l.prepared.progression;
    slots.forEach((slot, i) => {
      const before =
        i > 0 ? slots[i - 1]?.chord : l.firstOfRun ? l.chordBefore : slots[slots.length - 1]?.chord;
      if (!before || sameChord(before, slot.chord)) return;
      const loopTick = l.prepared.starts[i] ?? 0;
      const absTick = l.startTick + loopTick;
      this.changes.push({
        run: l.run,
        iteration: l.iteration,
        absTick,
        loopTick,
        audio: l.timeOf(absTick),
        windowMs: halfMs(l.prepared.lengths[i] ?? 0, l.bpm),
      });
    });
  }

  note(n: HeardNote): void {
    this.taps.push({ run: n.run, iteration: n.iteration, perfTs: n.perfTs, source: n.source, note: n.note });
  }

  loopEnd(run: number, iteration: number): Progression | null {
    this.ledger.complete(run, iteration);
    this.loopsAtStage += 1;
    if (this.stage >= A0_STAGES.length - 1) return null;
    const loop = this.tally((r, i) => r === run && i === iteration);
    const step =
      loop.score === undefined ? this.loopsAtStage >= A0_UNSCORED_LOOPS : loop.score >= A0_STEP_SCORE;
    if (!step) return null;
    this.stage += 1;
    this.loopsAtStage = 0;
    return this.current();
  }

  live(): LiveView {
    return { stage: stageLabel(this.stageBeats()) };
  }

  result(): LevelResult {
    const t = this.tally((r, i) => this.ledger.has(r, i));
    const counts: CountRow[] = [
      { label: LABELS.on, n: t.on, state: 'ok' },
      { label: LABELS.early, n: t.early, state: 'warn' },
      { label: LABELS.late, n: t.late, state: 'warn' },
      { label: LABELS.missed, n: t.missed, state: 'bad' },
      { label: LABELS.extra, n: t.extra, state: 'neutral' },
    ];
    if (t.unscored > 0) counts.push({ label: LABELS.timingNotScored, n: t.unscored, state: 'neutral' });
    return {
      score: t.score,
      offsets: t.offsets,
      data: {
        stageBeats: this.stageBeats(),
        changes: t.changes,
        on: t.on,
        early: t.early,
        late: t.late,
        missed: t.missed,
        extra: t.extra,
        unscored: t.unscored,
      },
      counts,
      reveal: [stageLabel(this.stageBeats())],
    };
  }

  // ---------------------------------------------------------------------

  /** Greedy per run, in change order: each change takes the nearest unmatched tap in its window. */
  private matches(): Map<Change, Match> {
    const out = new Map<Change, Match>();
    const used = new Set<Tap>();
    const changes = [...this.changes].sort((a, b) => a.run - b.run || a.absTick - b.absTick);
    for (const c of changes) {
      let best: Match | null = null;
      for (const tap of this.taps) {
        if (tap.run !== c.run || used.has(tap)) continue;
        const o = offsetMs(tap.perfTs, c.audio, this.ctx.clock, this.ctx.calibration[tap.source]);
        if (Math.abs(o.offsetMs) > c.windowMs + 1e-9) continue;
        if (best === null || Math.abs(o.offsetMs) < Math.abs(best.offsetMs)) {
          best = {
            tap,
            offsetMs: o.offsetMs,
            calibrated: o.calibrated,
            verdict: tapVerdict(o.offsetMs, tap.source, o.calibrated, this.ctx.tapOffsets),
          };
        }
      }
      if (best) {
        used.add(best.tap);
        out.set(c, best);
      }
    }
    return out;
  }

  /** Counts over the loops `inLoop` accepts. Taps matched to any change aren't extra. */
  private tally(inLoop: (run: number, iteration: number) => boolean) {
    const matches = this.matches();
    const matchedTaps = new Set([...matches.values()].map((m) => m.tap));
    const t = { changes: 0, on: 0, early: 0, late: 0, missed: 0, extra: 0, unscored: 0 };
    const offsets: TimingOffset[] = [];
    for (const c of this.changes) {
      if (!inLoop(c.run, c.iteration)) continue;
      t.changes += 1;
      const m = matches.get(c);
      if (!m) {
        t.missed += 1;
        continue;
      }
      if (m.verdict === 'unscored') t.unscored += 1;
      else t[m.verdict] += 1;
      offsets.push({
        note: m.tap.note,
        targetTick: c.loopTick,
        offsetMs: m.offsetMs,
        source: m.tap.source,
        calibrated: m.calibrated,
      });
    }
    for (const tap of this.taps) {
      if (inLoop(tap.run, tap.iteration) && !matchedTaps.has(tap)) t.extra += 1;
    }
    const denominator = t.changes + t.extra;
    const score = t.unscored > 0 ? undefined : denominator === 0 ? 0 : t.on / denominator;
    return { ...t, score, offsets };
  }
}
