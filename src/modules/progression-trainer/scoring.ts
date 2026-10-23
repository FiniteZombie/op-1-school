// What every level's scorer shares. `drill.ts` feeds a scorer; the scorer
// never touches the transport, so the levels' tests drive it through the real
// `DrillController` over the fake transport.
//
// Loops are keyed by `run` (one per transport start: a resume, or A0's and
// A4's own restarts, begins a new run) and `iteration` within it. Only loops
// the controller completes count; a partial loop (the transport stopped from
// outside, or `finish` mid-loop) is never completed, so its answers drop out.
import type { ClockBridge } from '../../audio/Clock';
import type { TapOffsets } from '../../audio/tapWindow';
import type { PreparedProgression } from '../../audio/voicing';
import type { Chord, InputSource, MidiNote, PitchClass, Progression, TimingOffset } from '../../types/music';
import type { LevelId } from './levels';

/** Where a played note (or tap) falls: the slot heard when it was played (plan decision 7). */
export interface HeardRef {
  run: number;
  /** Loop iteration within the run; −1 before the run's first downbeat. */
  iteration: number;
  /** The heard slot (`slotAtAudioTime`). */
  slot: number;
  /** The heard absolute tick in the run, rounded. */
  absTick: number;
  /** The heard audio time (`heardAudioTime`). */
  heard: number;
}

export interface HeardNote extends HeardRef {
  /** `PAD_NOTE` for A0's pad. */
  note: MidiNote;
  source: InputSource;
  perfTs: number;
}

export interface LoopStart {
  run: number;
  iteration: number;
  prepared: PreparedProgression;
  /** The loop's first absolute tick. */
  startTick: number;
  ticksPerBar: number;
  bpm: number;
  /** The run's first loop. */
  firstOfRun: boolean;
  /** For a run's first loop after one of the drill's own restarts: the chord heard just before. */
  chordBefore: Chord | null;
  /** Absolute tick → the audio time it sounds at, swing included. */
  timeOf(absTick: number): number;
}

export type CountState = 'ok' | 'warn' | 'bad' | 'neutral';

export interface CountRow {
  label: string;
  n: number;
  state: CountState;
}

export interface LevelResult {
  /** 0..1; absent when unscored. */
  score?: number;
  /** Timed levels only. */
  offsets?: TimingOffset[];
  /** The level's own detail for `Attempt.data`. */
  data: Record<string, unknown>;
  counts: CountRow[];
  reveal: string[];
  /** A5's voice-leading map, one line per pair. */
  map?: string[];
}

/** What a level puts on screen mid-drill for the slot heard now. */
export interface LiveView {
  /** The reveal of the slot just answered or just ended, with its state. */
  reveal?: { text: string; state: CountState };
  /** Pitch classes for `Keyboard24`'s guide. */
  guide?: readonly PitchClass[];
  /** A0's stage label. */
  stage?: string;
  /** A4: the question, the notes played for it, and whether `submit` is open. */
  prompt?: { label: string; played: string; open: boolean };
}

export interface ScoreContext {
  clock: Pick<ClockBridge, 'audibleAt'>;
  /** Injected in tests; the app passes `TAP_OFFSETS`. */
  tapOffsets: TapOffsets;
  /** Calibration per source, when there is one (none until Phase 3's B0). */
  calibration: Partial<Record<InputSource, number>>;
}

export interface LevelScorer {
  readonly level: LevelId;
  /** What to play now: the progression, A0's stage or A4's vamp. */
  current(): Progression;
  loopStart(l: LoopStart): void;
  /** Every `on` while a run plays (and A0's pad taps). */
  note(n: HeardNote): void;
  /** A3's quality buttons and A4's `submit`. True when it answered a question that counts toward `finish` (A4). */
  choose?(value: string, at: HeardRef): boolean;
  /** The loop is complete. Returns a progression to restart with at this loop end (A0's stage, A4's next pair), or null. */
  loopEnd(run: number, iteration: number): Progression | null;
  live(at: HeardRef | null): LiveView;
  result(): LevelResult;
}

export function loopKey(run: number, iteration: number): string {
  return `${run}:${iteration}`;
}

/** Completed loops, in order. */
export class LoopLedger {
  private readonly done = new Set<string>();
  readonly loops: Array<{ run: number; iteration: number }> = [];

  complete(run: number, iteration: number): void {
    const k = loopKey(run, iteration);
    if (this.done.has(k)) return;
    this.done.add(k);
    this.loops.push({ run, iteration });
  }

  has(run: number, iteration: number): boolean {
    return this.done.has(loopKey(run, iteration));
  }

  get count(): number {
    return this.loops.length;
  }
}

/** Half of `ticks` in ms at `bpm` (PPQ 192): a match window. */
export function halfMs(ticks: number, bpm: number): number {
  return ((ticks / 192) * (60_000 / bpm)) / 2;
}

/** Slot answers per loop, for the levels that answer each heard slot once (A1, A3, A5). */
export class SlotAnswers<T> {
  private readonly byLoop = new Map<string, Map<number, T>>();

  get(ref: Pick<HeardRef, 'run' | 'iteration' | 'slot'>): T | undefined {
    return this.byLoop.get(loopKey(ref.run, ref.iteration))?.get(ref.slot);
  }

  set(ref: Pick<HeardRef, 'run' | 'iteration' | 'slot'>, value: T): void {
    const k = loopKey(ref.run, ref.iteration);
    let m = this.byLoop.get(k);
    if (!m) this.byLoop.set(k, (m = new Map()));
    m.set(ref.slot, value);
  }
}

/** The slot heard just before `at` (the loop's last slot before slot 0), or null before the run's first slot ends. */
export function previousSlot(at: HeardRef, slots: number): Pick<HeardRef, 'run' | 'iteration' | 'slot'> | null {
  if (at.slot > 0) return { run: at.run, iteration: at.iteration, slot: at.slot - 1 };
  if (at.iteration <= 0) return null;
  return { run: at.run, iteration: at.iteration - 1, slot: slots - 1 };
}
