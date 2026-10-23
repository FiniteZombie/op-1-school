/**
 * The "on the beat" window per input source (SPEC §3.3, plan decision 6),
 * Tone-free. The owner's rule (2026-10-23): centred on the measured median
 * tap offset, half-width `max(IQR, TAP_TOLERANCE_FLOOR_MS)`. A calibrated
 * offset already has the bias taken out, so its window centres on 0 with the
 * same half-width. Desktop mouse clicks use the `touch` entry until
 * calibration (Phase 3); `mic` is always unscored in Phase 2.
 */
import type { InputSource } from '../types/music';

/** One measurement from `docs/HARDWARE_NOTES.md` **Tap offsets**. Positive is late. */
export interface TapMeasurement {
  medianMs: number;
  iqrMs: number;
}

export type TapSource = 'touch' | 'midi';

export type TapOffsets = Readonly<Record<TapSource, TapMeasurement | null>>;

/**
 * Copied from **Tap offsets**: the latest Android row per input (`Field keys …`
 * for `midi`, `touch …` for `touch`). `tapWindow.test.ts` fails when this and
 * the table disagree, so a re-measured row is copied here in the same commit.
 */
export const TAP_OFFSETS: TapOffsets = {
  midi: { medianMs: -5.7, iqrMs: 46.7 },
  touch: { medianMs: -43.2, iqrMs: 46.5 },
};

/** The narrowest half-width a window gets, however tight the spread (the owner's rule). */
export const TAP_TOLERANCE_FLOOR_MS = 20;

/** Absorbs float error so a tap exactly on a window edge (`−43.2 + 46.5`) reads `on`. */
const EDGE_EPSILON_MS = 1e-9;

export interface TapWindow {
  /** The offset that reads dead on: the median, or 0 when calibrated. */
  centreMs: number;
  /** Half-width: `max(iqrMs, TAP_TOLERANCE_FLOOR_MS)`. */
  toleranceMs: number;
  /** `centreMs − toleranceMs`; inclusive. */
  earliestMs: number;
  /** `centreMs + toleranceMs`; inclusive. */
  latestMs: number;
}

export type TapVerdict = 'early' | 'on' | 'late' | 'unscored';

function measurementFor(source: InputSource, offsets: TapOffsets): TapMeasurement | null {
  if (source === 'mic') return null;
  return offsets[source];
}

/** The window for `source`, or null when it has no measurement (and for `mic`). */
export function tapWindow(source: InputSource, calibrated = false, offsets: TapOffsets = TAP_OFFSETS): TapWindow | null {
  const m = measurementFor(source, offsets);
  if (!m) return null;
  const centreMs = calibrated ? 0 : m.medianMs;
  const toleranceMs = Math.max(m.iqrMs, TAP_TOLERANCE_FLOOR_MS);
  return { centreMs, toleranceMs, earliestMs: centreMs - toleranceMs, latestMs: centreMs + toleranceMs };
}

/** `offsetMs` (from `offsetMs()` in `Clock.ts`, positive late) against `source`'s window. Edges are `on`. */
export function tapVerdict(
  offsetMs: number,
  source: InputSource,
  calibrated: boolean,
  offsets: TapOffsets = TAP_OFFSETS,
): TapVerdict {
  const w = tapWindow(source, calibrated, offsets);
  if (!w) return 'unscored';
  const d = offsetMs - w.centreMs;
  if (Math.abs(d) <= w.toleranceMs + EDGE_EPSILON_MS) return 'on';
  return d < 0 ? 'early' : 'late';
}
