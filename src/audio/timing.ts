/**
 * Transport maths and bookkeeping, Tone-free so Vitest can cover it
 * (decision 11). `TransportEngine.ts` wraps `TransportCore` with Tone.
 *
 * - PPQ is Tone's 192; a MIDI pulse is every 8 ticks, a sixteenth 48, a beat
 *   (quarter note) 192 (SPEC §3.2).
 * - Tempo anchors (decision 2): every tick ↔ audio-time conversion goes
 *   through `{ audioTime, absTick, bpm }` anchors. Ticks count up across loop
 *   iterations (`absTick`); in-loop ticks are `absTick % loopTicks`. Ticks
 *   round to the nearest integer.
 * - Swing (decision 1): off-beat sixteenths are delayed by `swing / 3` of a
 *   sixteenth, from `swingOffsetSec()`. Nothing here applies it to the grid,
 *   and MIDI pulses are never swung.
 */
import type { Unsubscribe } from '../types/music';
import type {
  BeatEvent,
  TransportConfig,
  TransportEngine,
  TransportState,
  TransportStateChange,
} from './TransportEngine';

export const PPQ = 192;
export const PULSE_TICKS = PPQ / 24;
export const SIXTEENTH_TICKS = PPQ / 4;
export const BEAT_TICKS = PPQ;
export const BPM_MIN = 30;
export const BPM_MAX = 300;

/**
 * Anchors before the one in effect this long before `currentTime` are pruned.
 * The margin keeps maps right for input events and target ticks just behind a
 * tempo change (an anchor at a beat boundary would otherwise be extrapolated
 * backwards at the new tempo).
 */
export const ANCHOR_PRUNE_MARGIN_SEC = 2;

export function secondsPerTick(bpm: number): number {
  return 60 / (bpm * PPQ);
}

export function sixteenthSeconds(bpm: number): number {
  return SIXTEENTH_TICKS * secondsPerTick(bpm);
}

/**
 * The delay of a sixteenth under swing (decision 1): `swing / 3` of a
 * sixteenth on odd (off-beat) sixteenths, 0 on even ones. Swing 0 is straight,
 * 1 is triplet feel.
 */
export function swingOffsetSec(sixteenthIndex: number, swing: number, bpm: number): number {
  return Math.abs(sixteenthIndex) % 2 === 1 ? (swing / 3) * sixteenthSeconds(bpm) : 0;
}

// ---------------------------------------------------------------------------
// Validation

/** Every problem with a transport config, as readable strings; empty means valid. */
export function validateTransportConfig(cfg: TransportConfig): string[] {
  const errors: string[] = [];
  const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
  if (!finite(cfg.bpm) || cfg.bpm < BPM_MIN || cfg.bpm > BPM_MAX) {
    errors.push(`bpm must be ${BPM_MIN}–${BPM_MAX}, got ${String(cfg.bpm)}`);
  }
  if (!finite(cfg.swing) || cfg.swing < 0 || cfg.swing > 1) {
    errors.push(`swing must be 0–1, got ${String(cfg.swing)}`);
  }
  if (!finite(cfg.bars) || !Number.isInteger(cfg.bars) || cfg.bars < 1) {
    errors.push(`bars must be an integer ≥ 1, got ${String(cfg.bars)}`);
  }
  const ts: unknown = cfg.timeSig;
  if (
    !Array.isArray(ts) ||
    ts.length !== 2 ||
    !Number.isInteger(ts[0]) ||
    (ts[0] as number) < 1 ||
    ts[1] !== 4
  ) {
    errors.push(`timeSig must be [n, 4] with n an integer ≥ 1, got ${JSON.stringify(ts)}`);
  }
  return errors;
}

/** Throws a `RangeError` listing every problem `validateTransportConfig` finds. */
export function assertTransportConfig(cfg: TransportConfig): void {
  const errors = validateTransportConfig(cfg);
  if (errors.length > 0) throw new RangeError(`Invalid transport config: ${errors.join('; ')}`);
}

// ---------------------------------------------------------------------------
// Grid positions

export function ticksPerBar(timeSig: readonly [number, number]): number {
  return timeSig[0] * BEAT_TICKS;
}

export function loopTicks(cfg: Pick<TransportConfig, 'bars' | 'timeSig'>): number {
  return cfg.bars * ticksPerBar(cfg.timeSig);
}

export interface TickPosition {
  /** 1..bars within the loop. */
  bar: number;
  /** 1..n within the bar. */
  beat: number;
  /** 0..4n−1 within the bar; odd = off-beat. */
  sixteenth: number;
  /** In-loop tick. */
  tick: number;
  absTick: number;
  /** Loop iteration, from 0. */
  iteration: number;
}

/** Where an absolute tick falls in the loop. */
export function positionOfTick(
  absTick: number,
  cfg: Pick<TransportConfig, 'bars' | 'timeSig'>,
): TickPosition {
  const loop = loopTicks(cfg);
  const bar = ticksPerBar(cfg.timeSig);
  const iteration = Math.floor(absTick / loop);
  const tick = absTick - iteration * loop;
  const inBar = tick % bar;
  return {
    bar: Math.floor(tick / bar) + 1,
    beat: Math.floor(inBar / BEAT_TICKS) + 1,
    sixteenth: Math.floor(inBar / SIXTEENTH_TICKS),
    tick,
    absTick,
    iteration,
  };
}

export function isPulseTick(absTick: number): boolean {
  return absTick % PULSE_TICKS === 0;
}

// ---------------------------------------------------------------------------
// Tempo anchors

export interface TempoAnchor {
  audioTime: number;
  absTick: number;
  bpm: number;
}

function requireAnchors(anchors: readonly TempoAnchor[]): asserts anchors is readonly [TempoAnchor, ...TempoAnchor[]] {
  if (anchors.length === 0) throw new Error('No tempo anchors: the transport is not running');
}

/** The anchor in effect at `absTick` (the first one for ticks before it). Anchors are sorted. */
function anchorForTick(anchors: readonly TempoAnchor[], absTick: number): TempoAnchor {
  requireAnchors(anchors);
  let found = anchors[0];
  for (const a of anchors) {
    if (a.absTick <= absTick) found = a;
    else break;
  }
  return found;
}

function anchorForTime(anchors: readonly TempoAnchor[], audioTime: number): TempoAnchor {
  requireAnchors(anchors);
  let found = anchors[0];
  for (const a of anchors) {
    if (a.audioTime <= audioTime) found = a;
    else break;
  }
  return found;
}

export function audioTimeOfAbsTick(anchors: readonly TempoAnchor[], absTick: number): number {
  const a = anchorForTick(anchors, absTick);
  return a.audioTime + (absTick - a.absTick) * secondsPerTick(a.bpm);
}

/** Unrounded; `absTickOfAudioTime` is the rounded one. */
export function exactAbsTickOfAudioTime(anchors: readonly TempoAnchor[], audioTime: number): number {
  const a = anchorForTime(anchors, audioTime);
  return a.absTick + (audioTime - a.audioTime) / secondsPerTick(a.bpm);
}

export function absTickOfAudioTime(anchors: readonly TempoAnchor[], audioTime: number): number {
  return Math.round(exactAbsTickOfAudioTime(anchors, audioTime));
}

/**
 * Schedules a tempo change at the first beat boundary strictly after
 * `earliestTime`. Anchors at or after that tick are replaced (a newer change
 * wins over a pending one).
 */
export function scheduleTempoChange(
  anchors: readonly TempoAnchor[],
  bpm: number,
  earliestTime: number,
): { anchors: TempoAnchor[]; anchor: TempoAnchor } {
  let tick = Math.ceil(exactAbsTickOfAudioTime(anchors, earliestTime) / BEAT_TICKS) * BEAT_TICKS;
  if (audioTimeOfAbsTick(anchors, tick) <= earliestTime) tick += BEAT_TICKS;
  const anchor: TempoAnchor = { audioTime: audioTimeOfAbsTick(anchors, tick), absTick: tick, bpm };
  return { anchors: [...anchors.filter((a) => a.absTick < tick), anchor], anchor };
}

/** Drops anchors before the one in effect at `audioTime`. */
export function pruneAnchors(anchors: readonly TempoAnchor[], audioTime: number): TempoAnchor[] {
  if (anchors.length === 0) return [];
  const current = anchorForTime(anchors, audioTime);
  return anchors.filter((a) => a.absTick >= current.absTick);
}

// ---------------------------------------------------------------------------
// The transport, minus Tone

/** What `TransportCore` needs from the audio side. `ToneTransport` gives it Tone. */
export interface TransportDriver {
  /** Audio initialised (`start()` throws otherwise). */
  ready(): boolean;
  /** The scheduling horizon: `currentTime + lookAhead` (Tone's `now()`). */
  now(): number;
  currentTime(): number;
  lookAhead(): number;
  /** Start at `atAudioTime` from tick 0 at `bpm`, calling `onPulse` with the audio time of every 8th tick. */
  start(atAudioTime: number, bpm: number, onPulse: (audioTime: number) => void): void;
  stop(atAudioTime: number): void;
  setBpmAt(bpm: number, audioTime: number): void;
}

const DEFAULT_CONFIG: TransportConfig = { bpm: 120, swing: 0, bars: 4, timeSig: [4, 4] };

function copyConfig(cfg: TransportConfig): TransportConfig {
  return { bpm: cfg.bpm, swing: cfg.swing, bars: cfg.bars, timeSig: [cfg.timeSig[0], cfg.timeSig[1]] };
}

class Subscribers<A extends unknown[]> {
  private readonly cbs = new Set<(...args: A) => void>();

  add(cb: (...args: A) => void): Unsubscribe {
    // Wrap so the same function can subscribe twice and unsubscribe once each.
    const entry = (...args: A) => cb(...args);
    this.cbs.add(entry);
    return () => {
      this.cbs.delete(entry);
    };
  }

  emit(...args: A): void {
    for (const cb of [...this.cbs]) {
      try {
        cb(...args);
      } catch (err) {
        console.error('Transport subscriber threw', err);
      }
    }
  }
}

/**
 * `TransportEngine` over an injected driver. Every pulse the driver reports is
 * mapped to its absolute tick through the anchors, then dispatched in this
 * order: `onLoop` (in-loop tick 0), `onBeat`, `onSixteenth`, `onMidiPulse`.
 * `started` is emitted before the driver starts, so before any of them.
 * A throwing subscriber is logged and doesn't stop the others.
 */
export class TransportCore implements TransportEngine {
  private cfg: TransportConfig = copyConfig(DEFAULT_CONFIG);
  private running = false;
  private anchors: TempoAnchor[] = [];
  private lastAbsTick = -1;

  private readonly beatSubs = new Subscribers<[BeatEvent]>();
  private readonly sixteenthSubs = new Subscribers<[BeatEvent]>();
  private readonly pulseSubs = new Subscribers<[number, number]>();
  private readonly loopSubs = new Subscribers<[number, number]>();
  private readonly stateSubs = new Subscribers<[TransportStateChange]>();

  constructor(private readonly driver: TransportDriver) {}

  configure(cfg: TransportConfig): void {
    assertTransportConfig(cfg);
    const next = copyConfig(cfg);
    if (!this.running) {
      this.cfg = next;
      return;
    }
    if (next.bars !== this.cfg.bars || next.timeSig[0] !== this.cfg.timeSig[0] || next.timeSig[1] !== this.cfg.timeSig[1]) {
      throw new Error('TransportEngine.configure: bars and timeSig can only change while stopped');
    }
    if (next.bpm !== this.cfg.bpm) {
      const earliest = this.driver.currentTime() + this.driver.lookAhead();
      const { anchors, anchor } = scheduleTempoChange(this.anchors, next.bpm, earliest);
      this.anchors = anchors;
      this.driver.setBpmAt(anchor.bpm, anchor.audioTime);
    }
    this.cfg = next;
  }

  config(): TransportConfig {
    return copyConfig(this.cfg);
  }

  start(atAudioTime?: number): void {
    if (!this.driver.ready()) {
      throw new Error('TransportEngine.start: audio is not initialised; call initAudio() from a user gesture first');
    }
    if (this.running) this.stop();
    const t0 = atAudioTime ?? this.driver.now();
    if (!Number.isFinite(t0)) throw new RangeError(`TransportEngine.start: bad start time ${String(t0)}`);
    this.anchors = [{ audioTime: t0, absTick: 0, bpm: this.cfg.bpm }];
    this.lastAbsTick = -1;
    this.running = true;
    this.stateSubs.emit({ state: 'started', audioTime: t0 });
    this.driver.start(t0, this.cfg.bpm, this.handlePulse);
  }

  stop(): void {
    if (!this.running) return;
    const t = this.driver.now();
    this.running = false;
    this.driver.stop(t);
    this.anchors = [];
    this.stateSubs.emit({ state: 'stopped', audioTime: t });
  }

  state(): TransportState {
    return this.running ? 'started' : 'stopped';
  }

  bpm(): number {
    return this.cfg.bpm;
  }

  position(): { bar: number; beat: number; sixteenth: number; ticks: number } {
    if (!this.running) return { bar: 1, beat: 1, sixteenth: 0, ticks: 0 };
    const p = positionOfTick(this.nowAbsTick(), this.cfg);
    return { bar: p.bar, beat: p.beat, sixteenth: p.sixteenth, ticks: p.tick };
  }

  audioTimeOfTick(tick: number): number {
    this.requireRunning('audioTimeOfTick');
    const iteration = positionOfTick(this.nowAbsTick(), this.cfg).iteration;
    return audioTimeOfAbsTick(this.anchors, iteration * loopTicks(this.cfg) + tick);
  }

  tickOfAudioTime(audioSec: number): number {
    this.requireRunning('tickOfAudioTime');
    const loop = loopTicks(this.cfg);
    const abs = absTickOfAudioTime(this.anchors, audioSec);
    return ((abs % loop) + loop) % loop;
  }

  audioTimeOfAbsTick(absTick: number): number {
    this.requireRunning('audioTimeOfAbsTick');
    return audioTimeOfAbsTick(this.anchors, absTick);
  }

  absTickOfAudioTime(audioSec: number): number {
    this.requireRunning('absTickOfAudioTime');
    return absTickOfAudioTime(this.anchors, audioSec);
  }

  /** The anchors in force (copies), for readouts and tests. Empty while stopped. */
  tempoAnchors(): TempoAnchor[] {
    return this.anchors.map((a) => ({ ...a }));
  }

  onBeat(cb: (e: BeatEvent) => void): Unsubscribe {
    return this.beatSubs.add(cb);
  }

  onSixteenth(cb: (e: BeatEvent) => void): Unsubscribe {
    return this.sixteenthSubs.add(cb);
  }

  onMidiPulse(cb: (audioTime: number, absTick: number) => void): Unsubscribe {
    return this.pulseSubs.add(cb);
  }

  onLoop(cb: (iteration: number, audioTime: number) => void): Unsubscribe {
    return this.loopSubs.add(cb);
  }

  onStateChange(cb: (e: TransportStateChange) => void): Unsubscribe {
    return this.stateSubs.add(cb);
  }

  private requireRunning(what: string): void {
    if (!this.running) throw new Error(`TransportEngine.${what}: the transport is stopped`);
  }

  /** Absolute tick at the context's `currentTime`, never below 0 (start may be in the future). */
  private nowAbsTick(): number {
    return Math.max(0, absTickOfAudioTime(this.anchors, this.driver.currentTime()));
  }

  private readonly handlePulse = (audioTime: number): void => {
    if (!this.running) return;
    const absTick = Math.round(exactAbsTickOfAudioTime(this.anchors, audioTime) / PULSE_TICKS) * PULSE_TICKS;
    if (absTick <= this.lastAbsTick) return;
    this.lastAbsTick = absTick;
    this.anchors = pruneAnchors(this.anchors, this.driver.currentTime() - ANCHOR_PRUNE_MARGIN_SEC);

    const p = positionOfTick(absTick, this.cfg);
    if (p.tick === 0) this.loopSubs.emit(p.iteration, audioTime);
    if (absTick % SIXTEENTH_TICKS === 0) {
      const e: BeatEvent = {
        bar: p.bar,
        beat: p.beat,
        sixteenth: p.sixteenth,
        audioTime,
        tick: p.tick,
        absTick,
      };
      if (absTick % BEAT_TICKS === 0) this.beatSubs.emit({ ...e });
      this.sixteenthSubs.emit(e);
    }
    this.pulseSubs.emit(audioTime, absTick);
  };
}
