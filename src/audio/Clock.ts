/**
 * Audio time ↔ `performance.now()` (SPEC §3.1) and the input offset formula
 * (SPEC §3.3). Tone-free: it takes the raw `AudioContext`
 * (`getAudioContext().rawContext`), typed as the small `AudioClockContext` so
 * tests pass a fake.
 *
 * Decision 7 is open: the Web Audio spec defines
 * `getOutputTimestamp().contextTime` as the frame now leaving the output
 * device, which would make `audioToPerf` audible time already, and `audibleAt`
 * then double-counts the output latency; the fallback fit pairs
 * `currentTime` (render time) with `performance.now()`. This follows SPEC §3.1
 * as written, and `snapshot()` is the readout that settles it on real devices.
 */

/** From `ctx.getOutputTimestamp()`, or the fallback fit. Seconds and ms. */
export interface ClockCorrelation {
  contextTime: number;
  performanceTime: number;
}

/** The parts of an `AudioContext` the bridge reads. */
export interface AudioClockContext {
  readonly currentTime: number;
  readonly state: string;
  readonly baseLatency?: number;
  readonly outputLatency?: number;
  getOutputTimestamp?(): { contextTime?: number; performanceTime?: number };
}

export type ClockPath = 'output-timestamp' | 'fit';

/** Decision 7's readout, for `/dev/spine`. Latencies and the gap are ms; times are seconds. */
export interface ClockSnapshot {
  currentTime: number;
  /** `getOutputTimestamp().contextTime` at the last refresh; null if never available. */
  outputContextTime: number | null;
  /** `(currentTime − contextTime) × 1000` from the same refresh; null without an output timestamp. */
  gapMs: number | null;
  outputLatencyMs: number | null;
  baseLatencyMs: number | null;
  path: ClockPath;
  hasGetOutputTimestamp: boolean;
  hasOutputLatency: boolean;
  /** Pairs in the fallback fit (at most `FIT_PAIRS`). */
  fitPairs: number;
}

export interface ClockBridge {
  /** Re-sample the correlation; call every ~250 ms. Keeps the last good one while the context isn't running. */
  refresh(): void;
  /** Audio seconds → performance ms. */
  audioToPerf(audioSec: number): number;
  /** Performance ms → audio seconds. */
  perfToAudio(perfMs: number): number;
  /** `ctx.outputLatency ?? ctx.baseLatency ?? 0`. */
  outputLatencySec(): number;
  /** `audioToPerf(audioSec + outputLatencySec())`. */
  audibleAt(audioSec: number): number;
  snapshot(): ClockSnapshot;
}

/** The fallback fit keeps this many `(currentTime, performance.now())` pairs. */
export const FIT_PAIRS = 20;

const MS_PER_SEC = 1000;

/**
 * `ClockBridge` over a Web Audio context. Uses `getOutputTimestamp()` when it
 * exists and returns non-zero values (it returns zeros before the context
 * runs); otherwise a least-squares line over the last `FIT_PAIRS`
 * `(currentTime, performance.now())` pairs, seeded with one pair at
 * construction. Fit pairs taken while the context was not running are dropped
 * when it starts running again (its clock stood still meanwhile).
 */
export class WebAudioClockBridge implements ClockBridge {
  private pairs: ClockCorrelation[] = [];
  private outputCorrelation: ClockCorrelation | null = null;
  private lastOutputContextTime: number | null = null;
  private lastGapMs: number | null = null;
  private wasRunning: boolean;
  private fit = { slope: MS_PER_SEC, intercept: 0 };

  constructor(
    private readonly ctx: AudioClockContext,
    private readonly perfNow: () => number = () => performance.now(),
  ) {
    this.wasRunning = ctx.state === 'running';
    this.addPair({ contextTime: ctx.currentTime, performanceTime: perfNow() });
  }

  refresh(): void {
    const running = this.ctx.state === 'running';
    if (!running) {
      this.wasRunning = false;
      return;
    }
    if (!this.wasRunning) {
      this.pairs = [];
      this.wasRunning = true;
    }
    const currentTime = this.ctx.currentTime;
    this.addPair({ contextTime: currentTime, performanceTime: this.perfNow() });

    const ts = this.ctx.getOutputTimestamp?.();
    if (ts && ts.contextTime && ts.performanceTime) {
      this.outputCorrelation = { contextTime: ts.contextTime, performanceTime: ts.performanceTime };
      this.lastOutputContextTime = ts.contextTime;
      this.lastGapMs = (currentTime - ts.contextTime) * MS_PER_SEC;
    }
  }

  audioToPerf(audioSec: number): number {
    const c = this.outputCorrelation;
    if (c) return c.performanceTime + (audioSec - c.contextTime) * MS_PER_SEC;
    return this.fit.intercept + this.fit.slope * audioSec;
  }

  perfToAudio(perfMs: number): number {
    const c = this.outputCorrelation;
    if (c) return c.contextTime + (perfMs - c.performanceTime) / MS_PER_SEC;
    return (perfMs - this.fit.intercept) / this.fit.slope;
  }

  outputLatencySec(): number {
    return this.ctx.outputLatency ?? this.ctx.baseLatency ?? 0;
  }

  audibleAt(audioSec: number): number {
    return this.audioToPerf(audioSec + this.outputLatencySec());
  }

  /** The current fallback line: perf ms = intercept + slope × audio s. */
  fitLine(): { slope: number; intercept: number } {
    return { ...this.fit };
  }

  snapshot(): ClockSnapshot {
    const toMs = (s: number | undefined) => (typeof s === 'number' ? s * MS_PER_SEC : null);
    return {
      currentTime: this.ctx.currentTime,
      outputContextTime: this.lastOutputContextTime,
      gapMs: this.lastGapMs,
      outputLatencyMs: toMs(this.ctx.outputLatency),
      baseLatencyMs: toMs(this.ctx.baseLatency),
      path: this.outputCorrelation ? 'output-timestamp' : 'fit',
      hasGetOutputTimestamp: typeof this.ctx.getOutputTimestamp === 'function',
      hasOutputLatency: typeof this.ctx.outputLatency === 'number',
      fitPairs: this.pairs.length,
    };
  }

  private addPair(pair: ClockCorrelation): void {
    this.pairs.push(pair);
    if (this.pairs.length > FIT_PAIRS) this.pairs.splice(0, this.pairs.length - FIT_PAIRS);
    this.fit = fitLine(this.pairs);
  }
}

/**
 * Least-squares perf ms = intercept + slope × audio s. With one pair, or no
 * spread in audio time, the slope is 1000 ms/s through the latest pair.
 */
export function fitLine(pairs: readonly ClockCorrelation[]): { slope: number; intercept: number } {
  const n = pairs.length;
  const last = pairs[n - 1];
  if (!last) return { slope: MS_PER_SEC, intercept: 0 };
  let mx = 0;
  let my = 0;
  for (const p of pairs) {
    mx += p.contextTime;
    my += p.performanceTime;
  }
  mx /= n;
  my /= n;
  let sxx = 0;
  let sxy = 0;
  for (const p of pairs) {
    const dx = p.contextTime - mx;
    sxx += dx * dx;
    sxy += dx * (p.performanceTime - my);
  }
  if (n < 2 || sxx < 1e-12) {
    return { slope: MS_PER_SEC, intercept: last.performanceTime - MS_PER_SEC * last.contextTime };
  }
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx };
}

/**
 * SPEC §3.3: `perfTs − clock.audibleAt(tAudio) − calibrationMs`. Positive is
 * late. `calibrated` is whether a calibration was given (for
 * `TimingOffset.calibrated`).
 */
export function offsetMs(
  perfTs: number,
  tAudio: number,
  clock: Pick<ClockBridge, 'audibleAt'>,
  calibrationMs?: number,
): { offsetMs: number; calibrated: boolean } {
  const calibrated = typeof calibrationMs === 'number' && Number.isFinite(calibrationMs);
  return {
    offsetMs: perfTs - clock.audibleAt(tAudio) - (calibrated ? calibrationMs : 0),
    calibrated,
  };
}
