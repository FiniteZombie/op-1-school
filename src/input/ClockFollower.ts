/**
 * MIDI clock in (SPEC §3.5): a tempo estimate from incoming `0xF8` pulses.
 * Pure; `MidiBridge` feeds it and applies it to the transport in follow mode.
 * Phase-locking the loop to the external bar 1 is deferred (SPEC §3.5).
 */

export interface ClockEstimate {
  /** Smoothed BPM; 0 until `MIN_INTERVALS` intervals exist. */
  bpm: number;
  /** Share of the kept intervals within ±5 % of their median, 0..1; 0 until `MIN_INTERVALS` intervals exist. */
  confidence: number;
  /**
   * The last pulse whose count since `0xFA` is a multiple of 24 (a beat; the
   * first pulse after `0xFA` is count 0). Before any `0xFA`, counted from the
   * first pulse. NaN before any pulse or start.
   */
  phasePerfMs: number;
}

export interface ExternalClockFollower {
  /** `0xF8`, at the message's `timeStamp`. */
  onPulse(perfTs: number): void;
  /** `0xFA` / `0xFB`. */
  onStart(perfTs: number): void;
  /** `0xFC`. */
  onStop(): void;
  estimate(): ClockEstimate;
}

/** Inter-pulse intervals kept for the median. */
export const FOLLOWER_WINDOW = 48;
/** Intervals needed before the follower reports anything. */
export const MIN_INTERVALS = 24;
/** EMA weight of each new median. */
export const FOLLOWER_ALPHA = 0.2;
/** An interval counts towards confidence within this share of the median. */
export const CONFIDENCE_TOLERANCE = 0.05;

const PULSES_PER_BEAT = 24;

export function median(values: readonly number[]): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 === 1 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

/**
 * BPM from the median of the last 48 inter-pulse intervals, smoothed with
 * α = 0.2 (the first median seeds it). `0xFA` / `0xFB` clear the history and
 * restart the beat count. Pulses between a stop and the next start still
 * count (some masters send clock while stopped).
 */
export class PulseClockFollower implements ExternalClockFollower {
  private intervals: number[] = [];
  private lastPulse: number | null = null;
  private pulseCount = 0;
  private phase = NaN;
  private smoothed = 0;
  private runningFlag = false;

  onPulse(perfTs: number): void {
    if (this.lastPulse !== null) {
      const interval = perfTs - this.lastPulse;
      if (interval > 0) {
        this.intervals.push(interval);
        if (this.intervals.length > FOLLOWER_WINDOW) this.intervals.shift();
        if (this.intervals.length >= MIN_INTERVALS) {
          const bpm = 60000 / (median(this.intervals) * PULSES_PER_BEAT);
          this.smoothed = this.smoothed === 0 ? bpm : this.smoothed + FOLLOWER_ALPHA * (bpm - this.smoothed);
        }
      }
    }
    this.lastPulse = perfTs;
    if (this.pulseCount % PULSES_PER_BEAT === 0) this.phase = perfTs;
    this.pulseCount += 1;
  }

  onStart(perfTs: number): void {
    this.intervals = [];
    this.lastPulse = null;
    this.smoothed = 0;
    this.pulseCount = 0;
    this.phase = perfTs;
    this.runningFlag = true;
  }

  onStop(): void {
    this.runningFlag = false;
  }

  /** Whether the last transport message was a start (`0xFA`/`0xFB`) rather than a stop. */
  running(): boolean {
    return this.runningFlag;
  }

  estimate(): ClockEstimate {
    if (this.intervals.length < MIN_INTERVALS) return { bpm: 0, confidence: 0, phasePerfMs: this.phase };
    const m = median(this.intervals);
    const within = this.intervals.filter((i) => Math.abs(i - m) <= CONFIDENCE_TOLERANCE * m).length;
    return { bpm: this.smoothed, confidence: within / this.intervals.length, phasePerfMs: this.phase };
  }
}
