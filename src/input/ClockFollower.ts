/**
 * MIDI clock in (SPEC §3.5): a tempo estimate from incoming `0xF8` pulses.
 * Pure; `MidiBridge` feeds it and applies it to the transport in follow mode.
 * Phase-locking the loop to the external bar 1 is deferred (SPEC §3.5).
 */

export interface ClockEstimate {
  /** BPM from a straight-line fit over the kept pulses; 0 until `MIN_INTERVALS` intervals exist. */
  bpm: number;
  /**
   * How well the window's two halves agree on the pulse period, 0..1: 1 when
   * they match, 0 when they differ by `CONFIDENCE_TOLERANCE` or more. 0 until
   * `MIN_INTERVALS` intervals exist.
   */
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

/** Inter-pulse intervals kept for the fit: four beats. */
export const FOLLOWER_WINDOW = 96;
/** Intervals needed before the follower reports anything. */
export const MIN_INTERVALS = 24;
/** The halves' periods differing by this share of the period gives confidence 0. */
export const CONFIDENCE_TOLERANCE = 0.05;
/**
 * A gap longer than this many mean periods counts as dropped pulses. Bunched
 * delivery reaches about 1.55 (42 ms at a 27.8 ms period), a drop starts at 2.
 */
export const DROPPED_PULSE_GAP = 1.75;

const PULSES_PER_BEAT = 24;

export function median(values: readonly number[]): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 === 1 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

/**
 * Pulse numbers for timestamps that may skip dropped pulses: a gap over
 * `DROPPED_PULSE_GAP` mean periods counts as the whole number it spans.
 */
function pulseIndices(times: readonly number[]): number[] {
  const n = times.length;
  const mean = ((times[n - 1] as number) - (times[0] as number)) / (n - 1);
  const ks = [0];
  for (let i = 1; i < n; i += 1) {
    const gap = (times[i] as number) - (times[i - 1] as number);
    const step = gap > DROPPED_PULSE_GAP * mean ? Math.round(gap / mean) : 1;
    ks.push((ks[i - 1] as number) + step);
  }
  return ks;
}

/** Least-squares slope of `times` against `ks`: ms per pulse. */
function fitPeriod(ks: readonly number[], times: readonly number[]): number {
  const n = ks.length;
  let kMean = 0;
  let tMean = 0;
  for (let i = 0; i < n; i += 1) {
    kMean += ks[i] as number;
    tMean += times[i] as number;
  }
  kMean /= n;
  tMean /= n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    const dk = (ks[i] as number) - kMean;
    num += dk * ((times[i] as number) - tMean);
    den += dk * dk;
  }
  return num / den;
}

/**
 * BPM from a least-squares line through the last 96 pulse timestamps, not
 * from single intervals: Windows Chrome delivers the Field's clock bunched
 * (12.9–42 ms apart at a true 27.8 ms), which pulls a median of intervals
 * off by 8 % or more while the line's slope holds. `0xFA` / `0xFB` clear
 * the history and restart the beat count. Pulses between a stop and the next
 * start still count (some masters send clock while stopped).
 */
export class PulseClockFollower implements ExternalClockFollower {
  private pulses: number[] = [];
  private pulseCount = 0;
  private phase = NaN;
  private runningFlag = false;

  onPulse(perfTs: number): void {
    const last = this.pulses[this.pulses.length - 1];
    if (last === undefined || perfTs > last) {
      this.pulses.push(perfTs);
      if (this.pulses.length > FOLLOWER_WINDOW + 1) this.pulses.shift();
    }
    if (this.pulseCount % PULSES_PER_BEAT === 0) this.phase = perfTs;
    this.pulseCount += 1;
  }

  onStart(perfTs: number): void {
    this.pulses = [];
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
    const n = this.pulses.length;
    if (n - 1 < MIN_INTERVALS) return { bpm: 0, confidence: 0, phasePerfMs: this.phase };
    const ks = pulseIndices(this.pulses);
    const period = fitPeriod(ks, this.pulses);
    // The halves share the middle pulse.
    const mid = n >> 1;
    const early = fitPeriod(ks.slice(0, mid + 1), this.pulses.slice(0, mid + 1));
    const late = fitPeriod(ks.slice(mid), this.pulses.slice(mid));
    const disagreement = Math.abs(early - late) / period;
    const confidence = Math.max(0, 1 - disagreement / CONFIDENCE_TOLERANCE);
    return { bpm: 60000 / (period * PULSES_PER_BEAT), confidence, phasePerfMs: this.phase };
  }
}
