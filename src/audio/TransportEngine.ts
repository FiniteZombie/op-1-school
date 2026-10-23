/**
 * The transport (SPEC §3.2) and the one place the app's Tone context is made.
 *
 * Everything here that is maths or bookkeeping lives in `timing.ts`
 * (`TransportCore`), which tests can import; this file only adds Tone:
 * `getAudioContext()` / `initAudio()`, the Tone driver, and the wake lock.
 * Tests import this file as types only (decision 11).
 *
 * Plan decisions this follows (`.agents/plans/phase-1-spine.md`):
 * - Tone's swing stays 0 and Tone's own loop stays off. The transport runs
 *   unlooped, so Tone's ticks are `absTick`, and the `bars`-bar loop is
 *   `absTick % loopTicks` (decision 2). Swing is `swingOffsetSec()` for
 *   whoever wants it (decision 1); `BeatEvent.audioTime` is the straight grid,
 *   and MIDI pulses are never swung (SPEC §3.2).
 * - BPM changes while running land on the first beat boundary after
 *   `currentTime + lookAhead`, anchored there (decision 2).
 */
import * as Tone from 'tone';
import type { Unsubscribe } from '../types/music';
import { TransportCore, type TransportDriver } from './timing';

export type ClockSource = 'internal' | 'midi-follow'; // midi-follow is a stretch target, SPEC §3.5

/** `timeSig` is `[n, 4]` only; `bars` ≥ 1; BPM 30–300; swing 0..1 on sixteenths. */
export interface TransportConfig {
  bpm: number;
  swing: number;
  bars: number;
  timeSig: [number, number];
}

/**
 * One grid position. `bar` (1..bars) and `beat` (1..n) count from 1 within the
 * loop; `sixteenth` is 0..4n−1 within the bar (odd = off-beat); `tick` is
 * in-loop and `absTick` counts up across loop iterations. `audioTime` is the
 * straight (unswung) grid time.
 */
export interface BeatEvent {
  bar: number;
  beat: number;
  sixteenth: number;
  audioTime: number;
  tick: number;
  absTick: number;
}

export type TransportState = 'started' | 'stopped';

export interface TransportStateChange {
  state: TransportState;
  /** `started`: the audio time of tick 0. `stopped`: the audio time Tone stops at. */
  audioTime: number;
}

export interface TransportEngine {
  /** Validates (`validateTransportConfig`). While running only `bpm` and `swing` may change. */
  configure(cfg: TransportConfig): void;
  config(): TransportConfig;
  /** Fresh start: position 0, bar 1 beat 1. Throws before `initAudio()`. Defaults to Tone's `now()`. */
  start(atAudioTime?: number): void;
  /** Does nothing when stopped. */
  stop(): void;
  state(): TransportState;
  /** The configured BPM (a change while running takes effect at the next beat boundary). */
  bpm(): number;
  /** At the context's `currentTime`; bar 1 beat 1 tick 0 while stopped. */
  position(): { bar: number; beat: number; sixteenth: number; ticks: number };
  /** In-loop tick → audio time, for the *current* loop iteration. Throws while stopped. */
  audioTimeOfTick(tick: number): number;
  /** Audio time → in-loop tick, rounded. Throws while stopped. */
  tickOfAudioTime(audioSec: number): number;
  /** Absolute tick (counting across loop iterations) → audio time, through the tempo anchors. Throws while stopped. */
  audioTimeOfAbsTick(absTick: number): number;
  /** Audio time → absolute tick, rounded. Throws while stopped. */
  absTickOfAudioTime(audioSec: number): number;
  onBeat(cb: (e: BeatEvent) => void): Unsubscribe;
  onSixteenth(cb: (e: BeatEvent) => void): Unsubscribe;
  /** 24 PPQN, every 8 ticks, unswung. */
  onMidiPulse(cb: (audioTime: number, absTick: number) => void): Unsubscribe;
  /** At the start of every loop iteration, iteration 0 included. */
  onLoop(cb: (iteration: number, audioTime: number) => void): Unsubscribe;
  /** `started` fires before the tick-0 `onLoop`, `onBeat`, `onSixteenth` and `onMidiPulse`. */
  onStateChange(cb: (e: TransportStateChange) => void): Unsubscribe;
}

// ---------------------------------------------------------------------------
// The audio context

let nativeContext: AudioContext | null = null;
let toneContext: Tone.Context | null = null;
let audioInitialised = false;

/**
 * The app's one Tone context, made on first call over a native
 * `AudioContext` (`latencyHint: 'interactive'`), with `lookAhead: 0.1` and a
 * worker ticker, installed with `Tone.setContext`. Every piece of spine code
 * reaches Tone's context through here.
 *
 * Importing `tone` already creates a default context (its index reads
 * `getContext()` at load); this replaces and disposes that one.
 */
export function getAudioContext(): Tone.Context {
  if (!toneContext) {
    // Tone's own context is a standardized-audio-context wrapper with no
    // `outputLatency` or `getOutputTimestamp()`; handing it a native one keeps
    // both reachable for the clock (decision 7, SPEC §3.3).
    nativeContext = new AudioContext({ latencyHint: 'interactive' });
    toneContext = new Tone.Context({ context: nativeContext, lookAhead: 0.1, clockSource: 'worker' });
    Tone.setContext(toneContext, true);
  }
  return toneContext;
}

/** The native `AudioContext` under `getAudioContext()`, for `WebAudioClockBridge`. */
export function getNativeAudioContext(): AudioContext {
  getAudioContext();
  return nativeContext as AudioContext;
}

/** Call from a user gesture: resumes the context (`Tone.start()`). Also resumes a suspended one. */
export async function initAudio(): Promise<void> {
  getAudioContext();
  await Tone.start();
  audioInitialised = true;
}

/** True once `initAudio()` has resolved. */
export function isAudioInitialised(): boolean {
  return audioInitialised;
}

// ---------------------------------------------------------------------------
// The Tone driver

class ToneDriver implements TransportDriver {
  private repeatId: number | null = null;

  private ctx(): Tone.Context {
    return getAudioContext();
  }

  ready(): boolean {
    return audioInitialised;
  }

  now(): number {
    return this.ctx().now();
  }

  currentTime(): number {
    return this.ctx().currentTime;
  }

  lookAhead(): number {
    return this.ctx().lookAhead;
  }

  start(atAudioTime: number, bpm: number, onPulse: (audioTime: number) => void): void {
    const transport = this.ctx().transport;
    this.clearRepeat();
    transport.stop();
    transport.loop = false;
    transport.swing = 0;
    // The tempo holds from the start time (or now, if that's earlier) on.
    const from = Math.min(atAudioTime, this.ctx().immediate());
    transport.bpm.cancelScheduledValues(from);
    transport.bpm.setValueAtTime(bpm, from);
    this.repeatId = transport.scheduleRepeat(onPulse, '8i', 0);
    transport.start(atAudioTime, 0);
  }

  stop(atAudioTime: number): void {
    const transport = this.ctx().transport;
    this.clearRepeat();
    transport.stop(atAudioTime);
    transport.bpm.cancelScheduledValues(atAudioTime);
  }

  setBpmAt(bpm: number, audioTime: number): void {
    const bpmParam = this.ctx().transport.bpm;
    bpmParam.cancelScheduledValues(audioTime);
    bpmParam.setValueAtTime(bpm, audioTime);
  }

  private clearRepeat(): void {
    if (this.repeatId !== null) {
      this.ctx().transport.clear(this.repeatId);
      this.repeatId = null;
    }
  }
}

// ---------------------------------------------------------------------------
// The engine

/**
 * `TransportEngine` over `Tone.getTransport()` of `getAudioContext()`.
 * Constructing it touches no audio; `start()` needs `initAudio()` first.
 * Holds a screen wake lock while running, re-acquired when the page becomes
 * visible again; wake-lock failures are ignored.
 */
export class ToneTransport extends TransportCore {
  private wakeLock: WakeLockSentinel | null = null;
  private visibilityListening = false;

  constructor() {
    super(new ToneDriver());
    this.onStateChange(({ state }) => {
      if (state === 'started') this.acquireWakeLock();
      else this.releaseWakeLock();
    });
  }

  private readonly onVisibility = (): void => {
    if (document.visibilityState === 'visible' && this.state() === 'started') {
      this.acquireWakeLock();
    }
  };

  private acquireWakeLock(): void {
    if (typeof document !== 'undefined' && !this.visibilityListening) {
      document.addEventListener('visibilitychange', this.onVisibility);
      this.visibilityListening = true;
    }
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    if (this.wakeLock && !this.wakeLock.released) return;
    navigator.wakeLock
      .request('screen')
      .then((sentinel) => {
        if (this.state() === 'started') this.wakeLock = sentinel;
        else void sentinel.release().catch(() => {});
      })
      .catch(() => {});
  }

  private releaseWakeLock(): void {
    if (this.visibilityListening) {
      document.removeEventListener('visibilitychange', this.onVisibility);
      this.visibilityListening = false;
    }
    const sentinel = this.wakeLock;
    this.wakeLock = null;
    if (sentinel && !sentinel.released) void sentinel.release().catch(() => {});
  }
}
