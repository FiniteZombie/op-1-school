/**
 * `/dev/spine`'s tap panel, pure (tested in `__tests__/tapOffsets.test.ts`):
 * how far each key-down landed from the nearest beat as heard, through the
 * same `offsetMs` / `audibleAt` the drills grade with, uncalibrated. The grid
 * is `beatZeroAudio + k · secondsPerBeat`, so a BPM change mid-loop skews
 * taps until the next loop starts.
 */
import { offsetMs, type ClockBridge } from '../../audio/Clock';

// placeholder: every tap label below is temporary until the owner decides.
export const TAP_LABELS = {
  panel: 'taps',
  hint: 'tap a key, or press one on the field, on each beat',
  reset: 'reset',
  none: 'no taps yet',
  stopped: 'start the loop first',
} as const;

/** Taps kept for the median and spread. */
export const TAP_WINDOW = 16;

/** Offset (ms, positive = late) of a tap at `perfTs` from the nearest beat as heard. */
export function nearestBeatOffsetMs(
  perfTs: number,
  beatZeroAudio: number,
  secondsPerBeat: number,
  clock: Pick<ClockBridge, 'audibleAt' | 'perfToAudio'>,
): number {
  const k0 = Math.round((clock.perfToAudio(perfTs) - beatZeroAudio) / secondsPerBeat);
  let best = Number.POSITIVE_INFINITY;
  // Output latency is under a beat, so the heard beat is k0 or a neighbour.
  for (const k of [k0 - 1, k0, k0 + 1]) {
    const o = offsetMs(perfTs, beatZeroAudio + k * secondsPerBeat, clock).offsetMs;
    if (Math.abs(o) < Math.abs(best)) best = o;
  }
  return best;
}

export interface TapStats {
  count: number;
  lastMs: number;
  medianMs: number;
  /** Interquartile range: the middle half of taps spans this many ms. */
  spreadMs: number;
}

export function tapStats(offsets: readonly number[]): TapStats | null {
  const last = offsets[offsets.length - 1];
  if (last === undefined) return null;
  const sorted = [...offsets].sort((a, b) => a - b);
  return {
    count: offsets.length,
    lastMs: last,
    medianMs: quantile(sorted, 0.5),
    spreadMs: quantile(sorted, 0.75) - quantile(sorted, 0.25),
  };
}

/** Linear-interpolated quantile of an ascending, non-empty list. */
function quantile(sorted: readonly number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const a = sorted[lo] as number;
  const b = sorted[Math.min(lo + 1, sorted.length - 1)] as number;
  return a + (b - a) * (pos - lo);
}

const signed = (ms: number) => `${ms >= 0 ? '+' : ''}${ms.toFixed(1)} ms`;

/** The panel's rows, also the report's `taps` section. */
export function tapRows(s: TapStats | null): Array<[string, string]> {
  if (!s) return [['taps', TAP_LABELS.none]];
  return [
    ['taps', String(s.count)],
    ['last', signed(s.lastMs)],
    ['median', signed(s.medianMs)],
    ['spread (iqr)', `${s.spreadMs.toFixed(1)} ms`],
  ];
}
