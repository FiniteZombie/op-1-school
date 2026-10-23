// A6, target-note phrasing (plan L2; pre-flight technical answer 18).
// Targets are the downbeats of the loop's odd bars (1, 3, 5, … within the
// loop), a run's first downbeat excepted (nothing could lead into it). Each
// target's candidate is the nearest `on` within half a beat, edges included;
// it lands when its pitch class is the target chord's 3rd and `tapVerdict`
// says `on` (pitch alone while unscored; the offset is kept either way).
// `call-response` (4-bar loops): bar 3 is the rest. Its downbeat is still a
// target, and any `on` heard after half a beat past it and before bar 4's
// downbeat breaks that loop's rest. No `extra`: notes between targets are the
// phrase.
// Score = landed ÷ targets, times (call-response) the share of loops with no
// rest break; 0 when no target was heard.
import { offsetMs } from '../../audio/Clock';
import { tapVerdict, type TapVerdict } from '../../audio/tapWindow';
import { BEAT_TICKS } from '../../audio/timing';
import { slotIndexAtTick } from '../../audio/voicing';
import { guideTones, noteName, pitchClass } from '../../theory';
import type { DrillForm } from '../../types/drills';
import type { InputSource, MidiNote, PitchClass, Progression, TimingOffset } from '../../types/music';
import { LABELS } from './labels';
import {
  LoopLedger,
  halfMs,
  loopKey,
  type CountRow,
  type HeardNote,
  type LevelResult,
  type LevelScorer,
  type LiveView,
  type LoopStart,
  type ScoreContext,
} from './scoring';

interface Target {
  run: number;
  iteration: number;
  loopTick: number;
  audio: number;
  pc: PitchClass;
  windowMs: number;
}

interface Played {
  run: number;
  absTick: number;
  perfTs: number;
  note: MidiNote;
  source: InputSource;
}

export class A6Scorer implements LevelScorer {
  readonly level = 'A6' as const;
  private readonly targets: Target[] = [];
  private readonly notes: Played[] = [];
  /** Per loop (call-response): the heard-tick window that must stay silent. */
  private readonly rests = new Map<string, { from: number; to: number }>();
  private readonly breaks = new Set<string>();
  private readonly ledger = new LoopLedger();

  constructor(
    private readonly p: Progression,
    readonly form: DrillForm,
    private readonly ctx: ScoreContext,
  ) {
    if (p.bars % 2 !== 0) throw new Error(`A6 needs an even number of bars; "${p.id}" has ${p.bars}`);
    if (form === 'call-response' && p.bars !== 4) throw new Error(`A6's call and response needs 4 bars; "${p.id}" has ${p.bars}`);
  }

  current(): Progression {
    return this.p;
  }

  loopStart(l: LoopStart): void {
    const beatTicks = BEAT_TICKS;
    for (let bar = 1; bar <= this.p.bars; bar += 2) {
      if (bar === 1 && l.firstOfRun) continue;
      const loopTick = (bar - 1) * l.ticksPerBar;
      const slot = this.p.slots[slotIndexAtTick(this.p.slots, loopTick)];
      if (!slot) continue;
      const absTick = l.startTick + loopTick;
      this.targets.push({
        run: l.run,
        iteration: l.iteration,
        loopTick,
        audio: l.timeOf(absTick),
        pc: guideTones(slot.chord).third,
        windowMs: halfMs(beatTicks, l.bpm),
      });
    }
    if (this.form === 'call-response') {
      const bar3 = l.startTick + 2 * l.ticksPerBar;
      this.rests.set(loopKey(l.run, l.iteration), { from: bar3 + beatTicks / 2, to: bar3 + l.ticksPerBar });
    }
  }

  note(n: HeardNote): void {
    this.notes.push({ run: n.run, absTick: n.absTick, perfTs: n.perfTs, note: n.note, source: n.source });
    const k = loopKey(n.run, n.iteration);
    const rest = this.rests.get(k);
    if (rest && n.absTick > rest.from && n.absTick < rest.to) this.breaks.add(k);
  }

  loopEnd(run: number, iteration: number): Progression | null {
    this.ledger.complete(run, iteration);
    return null;
  }

  live(): LiveView {
    return {};
  }

  result(): LevelResult {
    const t = { targets: 0, landed: 0, on: 0, early: 0, late: 0, missed: 0, unscored: 0 };
    const offsets: TimingOffset[] = [];
    for (const target of this.targets) {
      if (!this.ledger.has(target.run, target.iteration)) continue;
      t.targets += 1;
      const c = this.candidate(target);
      if (!c) {
        t.missed += 1;
        continue;
      }
      offsets.push({ note: c.note.note, targetTick: target.loopTick, offsetMs: c.offsetMs, source: c.note.source, calibrated: c.calibrated });
      if (pitchClass(c.note.note) !== target.pc) {
        t.missed += 1;
        continue;
      }
      if (c.verdict === 'unscored') t.unscored += 1;
      else t[c.verdict] += 1;
      if (c.verdict === 'on' || c.verdict === 'unscored') t.landed += 1;
    }
    const loops = this.ledger.count;
    const broken = this.ledger.loops.filter(({ run, iteration }) => this.breaks.has(loopKey(run, iteration))).length;
    const restShare = this.form === 'call-response' && loops > 0 ? (loops - broken) / loops : 1;
    const counts: CountRow[] = [
      { label: LABELS.on, n: t.on, state: 'ok' },
      { label: LABELS.early, n: t.early, state: 'warn' },
      { label: LABELS.late, n: t.late, state: 'warn' },
      { label: LABELS.missed, n: t.missed, state: 'bad' },
    ];
    if (t.unscored > 0) counts.push({ label: LABELS.timingNotScored, n: t.unscored, state: 'neutral' });
    if (this.form === 'call-response') counts.push({ label: LABELS.restBreaks, n: broken, state: 'bad' });
    return {
      score: t.targets === 0 ? 0 : (t.landed / t.targets) * restShare,
      offsets,
      data: { form: this.form, ...t, loops, restBreaks: broken },
      counts,
      reveal: this.revealLines(),
    };
  }

  /** Bar n: the 3rd to land on. */
  private revealLines(): string[] {
    const lines: string[] = [];
    for (let bar = 1; bar <= this.p.bars; bar += 2) {
      const slot = this.p.slots[slotIndexAtTick(this.p.slots, (bar - 1) * 4 * BEAT_TICKS)];
      if (slot) lines.push(`bar ${bar}: ${noteName(guideTones(slot.chord).third, this.p.key)}`);
    }
    return lines;
  }

  private candidate(target: Target): { note: Played; offsetMs: number; calibrated: boolean; verdict: TapVerdict } | null {
    let best: { note: Played; offsetMs: number; calibrated: boolean } | null = null;
    for (const n of this.notes) {
      if (n.run !== target.run) continue;
      const o = offsetMs(n.perfTs, target.audio, this.ctx.clock, this.ctx.calibration[n.source]);
      if (Math.abs(o.offsetMs) > target.windowMs + 1e-9) continue;
      if (!best || Math.abs(o.offsetMs) < Math.abs(best.offsetMs)) best = { note: n, ...o };
    }
    if (!best) return null;
    return { ...best, verdict: tapVerdict(best.offsetMs, best.note.source, best.calibrated, this.ctx.tapOffsets) };
  }
}
