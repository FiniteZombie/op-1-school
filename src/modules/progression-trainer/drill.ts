// Runs one drill on the spine: plays the level's progression on the
// transport, turns notes and taps into `HeardNote`s for the level's scorer,
// counts time in transport time, and drives `lifecycle.ts`. Tone-free: the
// backing synth is injected (`BackingLike`), so tests run it over
// `createFakeTransport()`.
//
// The drill's own stops (finishing, A0's and A4's restarts, `stop`) happen at
// the loop end: on the loop's last MIDI pulse, deferred (a microtask in the
// app) so the transport's other pulse subscribers (clock out) see that pulse
// before the stop. Any other stop (the page hidden) pauses the drill.
// VERIFY V6 (stubbed): a restart sends clock out's start with no pre-pulses.
import { heardAudioTime, type ClockBridge } from '../../audio/Clock';
import { TAP_OFFSETS, type TapOffsets } from '../../audio/tapWindow';
import { PULSE_TICKS, ticksPerBar } from '../../audio/timing';
import type { TransportEngine, TransportStateChange } from '../../audio/TransportEngine';
import {
  prepareProgression,
  slotAtAudioTime,
  swungTimeOfAbsTick,
  transportConfigFor,
  type PartMask,
  type PreparedProgression,
} from '../../audio/voicing';
import type { NoteBus } from '../../input/NoteInput';
import { PAD_NOTE, type DrillForm } from '../../types/drills';
import type { Chord, InputSource, NoteEvent, Progression, Unsubscribe } from '../../types/music';
import { initialDrill, isLive, isOver, nextDrill, type DrillEvent, type DrillState } from './lifecycle';
import { LEVELS, type LevelId } from './levels';
import { createScorer } from './levelScorers';
import type { HeardRef, LevelResult, LevelScorer } from './scoring';

/** The parts of `ToneBackingSynth` a drill uses. */
export interface BackingLike {
  load(p: Progression): void;
  setMask(parts: PartMask): void;
}

export interface DrillOptions {
  level: LevelId;
  progression: Progression;
  form?: DrillForm;
  minutes: number;
  transport: TransportEngine;
  clock: Pick<ClockBridge, 'audibleAt' | 'perfToAudio'>;
  bus: Pick<NoteBus, 'onNote'>;
  backing: BackingLike;
  /** Defaults to `TAP_OFFSETS`; tests inject their own. */
  tapOffsets?: TapOffsets;
  /** Read at scoring time, so it can be filled in after construction. */
  calibration?: Partial<Record<InputSource, number>>;
  /** How own stops are put off past the current pulse. Defaults to `queueMicrotask`. */
  defer?: (fn: () => void) => void;
  /** Wall clock for `startedAt`. Defaults to `Date.now`. */
  now?: () => number;
}

export class DrillController {
  readonly level: LevelId;
  readonly scorer: LevelScorer;
  private state: DrillState;
  private result: LevelResult | null = null;
  private startedAtMs: number | null = null;

  private readonly transport: TransportEngine;
  private readonly clock: Pick<ClockBridge, 'audibleAt' | 'perfToAudio'>;
  private readonly backing: BackingLike;
  private readonly defer: (fn: () => void) => void;
  private readonly now: () => number;
  private readonly unsubs: Unsubscribe[];
  private readonly listeners = new Set<() => void>();

  /** −1 until the first start. */
  private run = -1;
  /** The transport is playing one of this drill's runs. */
  private active = false;
  /** An own stop or restart is queued: ignore pulses and notes until it runs. */
  private pending = false;
  /** Inside one of this drill's own `transport.stop()` calls. */
  private stoppingOwn = false;
  /** Inside one of this drill's own `transport.start()` calls. */
  private startingOwn = false;
  private runStart = 0;
  private usedBefore = 0;
  private prepared: PreparedProgression | null = null;
  /** The chord heard before the next run's first downbeat, for an own restart (A0). */
  private chordBefore: Chord | null = null;

  constructor(private readonly opts: DrillOptions) {
    this.level = opts.level;
    this.transport = opts.transport;
    this.clock = opts.clock;
    this.backing = opts.backing;
    this.defer = opts.defer ?? ((fn) => queueMicrotask(fn));
    this.now = opts.now ?? (() => Date.now());
    this.scorer = createScorer(opts.level, opts.progression, opts.form ?? 'phrase', {
      clock: opts.clock,
      tapOffsets: opts.tapOffsets ?? TAP_OFFSETS,
      calibration: opts.calibration ?? {},
    });
    this.state = initialDrill(opts.minutes * 60, LEVELS[opts.level].finishUnit);
    this.unsubs = [
      this.transport.onStateChange(this.onTransportState),
      this.transport.onLoop(this.onLoop),
      this.transport.onMidiPulse(this.onPulse),
      opts.bus.onNote(this.onNote),
    ];
  }

  // -------------------------------------------------------------- reading

  drill(): DrillState {
    return this.state;
  }

  /** The finished drill's result; null until `done`. */
  finished(): LevelResult | null {
    return this.result;
  }

  /** Wall-clock ms of the first start; null before it. */
  startedAt(): number | null {
    return this.startedAtMs;
  }

  /** The progression playing (or about to). */
  playing(): Progression {
    return this.prepared?.progression ?? this.scorer.current();
  }

  /** Where a note played at `perfTs` lands, or null when no run is playing. */
  heardAt(perfTs: number): HeardRef | null {
    const prepared = this.prepared;
    if (!this.active || this.pending || !prepared || this.transport.state() !== 'started') return null;
    const heard = heardAudioTime(perfTs, this.clock);
    const absTick = this.transport.absTickOfAudioTime(heard);
    return {
      run: this.run,
      iteration: Math.floor(absTick / prepared.loopTicks),
      slot: slotAtAudioTime(this.transport, prepared, heard).index,
      absTick,
      heard,
    };
  }

  subscribe(cb: () => void): Unsubscribe {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  // -------------------------------------------------------------- actions

  /** `start` from ready, or resume from paused at bar 1. Needs audio running (the transport throws otherwise). */
  start(): void {
    if (this.state.phase !== 'ready' && this.state.phase !== 'paused') return;
    this.dispatch({ type: 'start' });
    this.startedAtMs ??= this.now();
    this.chordBefore = null;
    this.beginRun(this.scorer.current());
  }

  /** The `stop` / `finish` button. */
  stop(): void {
    if (this.state.phase === 'ready' || isOver(this.state.phase)) return;
    this.ownStop();
    this.dispatch({ type: 'stop' });
    if (this.state.phase === 'done') this.finalize();
  }

  /** A0's pad. */
  pad(perfTs: number): void {
    const at = this.heardAt(perfTs);
    if (at) this.scorer.note({ ...at, note: PAD_NOTE, source: 'touch', perfTs });
  }

  /** A3's quality buttons and A4's `submit`. */
  choose(value: string, perfTs: number): void {
    const at = this.heardAt(perfTs);
    if (!at || !this.scorer.choose) return;
    if (this.scorer.choose(value, at)) this.dispatch({ type: 'answered' });
    else this.emit();
  }

  /** Leaving the page: stops a run and writes nothing. Safe to call twice. */
  dispose(): void {
    if (!isOver(this.state.phase)) this.dispatch({ type: 'leave' });
    this.ownStop();
    for (const u of this.unsubs) u();
    this.unsubs.length = 0;
    this.listeners.clear();
  }

  // ------------------------------------------------------------ internals

  private beginRun(p: Progression): void {
    this.run += 1;
    this.transport.configure(transportConfigFor(p));
    this.backing.load(p);
    this.backing.setMask(LEVELS[this.level].mask);
    this.prepared = prepareProgression(p, this.transport.config());
    this.pending = false;
    this.startingOwn = true;
    try {
      this.transport.start();
    } finally {
      this.startingOwn = false;
    }
  }

  private ownStop(): void {
    if (!this.active || this.transport.state() !== 'started') return;
    this.stoppingOwn = true;
    try {
      this.transport.stop();
    } finally {
      this.stoppingOwn = false;
    }
  }

  private dispatch(e: DrillEvent): void {
    this.state = nextDrill(this.state, e);
    this.emit();
  }

  private emit(): void {
    for (const cb of [...this.listeners]) cb();
  }

  private finalize(): void {
    this.result = this.scorer.result();
    this.emit();
  }

  private readonly onTransportState = (e: TransportStateChange): void => {
    if (e.state === 'started') {
      if (this.startingOwn) {
        this.active = true;
        this.runStart = e.audioTime;
      }
      return;
    }
    if (!this.active) return;
    this.active = false;
    this.usedBefore += Math.max(0, e.audioTime - this.runStart);
    this.dispatch({ type: 'time', usedSec: this.usedBefore });
    if (!this.stoppingOwn) this.dispatch({ type: 'outsideStop' });
  };

  private readonly onLoop = (iteration: number): void => {
    const prepared = this.prepared;
    if (!this.active || this.pending || !prepared) return;
    const cfg = this.transport.config();
    const startTick = iteration * prepared.loopTicks;
    this.scorer.loopStart({
      run: this.run,
      iteration,
      prepared,
      startTick,
      ticksPerBar: ticksPerBar(cfg.timeSig),
      bpm: this.transport.bpm(),
      firstOfRun: iteration === 0,
      chordBefore: iteration === 0 ? this.chordBefore : null,
      timeOf: (abs) => swungTimeOfAbsTick(abs, cfg.swing, (t) => this.transport.audioTimeOfAbsTick(t)),
    });
  };

  private readonly onPulse = (audioTime: number, absTick: number): void => {
    const prepared = this.prepared;
    if (!this.active || this.pending || !prepared) return;
    this.dispatch({ type: 'time', usedSec: this.usedBefore + Math.max(0, audioTime - this.runStart) });
    if ((absTick + PULSE_TICKS) % prepared.loopTicks !== 0) return;

    // The loop's last pulse: the loop is complete.
    const iteration = Math.floor(absTick / prepared.loopTicks);
    const next = this.scorer.loopEnd(this.run, iteration);
    this.dispatch({ type: 'loopEnd' });
    if (this.state.phase === 'done') {
      this.pending = true;
      this.defer(() => {
        this.ownStop();
        this.finalize();
      });
    } else if (next && isLive(this.state.phase)) {
      this.pending = true;
      const slots = prepared.progression.slots;
      const before = slots[slots.length - 1]?.chord ?? null;
      this.defer(() => {
        if (!this.active) return; // paused or left meanwhile
        this.ownStop();
        this.chordBefore = before;
        this.beginRun(next);
      });
    }
  };

  private readonly onNote = (e: NoteEvent): void => {
    if (e.kind !== 'on') return;
    const at = this.heardAt(e.perfTs);
    if (at) this.scorer.note({ ...at, note: e.note, source: e.source, perfTs: e.perfTs });
  };
}
