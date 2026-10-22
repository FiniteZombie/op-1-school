/**
 * `Encoder`'s maths, pure. An encoder holds a 0..1 value; a vertical drag of
 * `rangePx` covers the full range, up increases. Callers map 0..1 to their
 * own units (and round, for integers).
 */

/** The default drag for the full 0..1 range. */
export const DEFAULT_RANGE_PX = 200;

/** The dial's sweep: 0 sits at −135°, 1 at +135° (0° is up). */
export const SWEEP_DEG = 270;

export function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

/** The value after dragging from `startY` to `y` (px, down is positive), starting at `startValue`. */
export function dragValue(startValue: number, startY: number, y: number, rangePx: number = DEFAULT_RANGE_PX): number {
  return clamp01(startValue + (startY - y) / rangePx);
}

/** A keyboard step (arrow keys), clamped. */
export function stepValue(value: number, delta: number): number {
  return clamp01(value + delta);
}

/** The indicator's angle in degrees, 0 = straight up. */
export function angleOf(value: number): number {
  return (clamp01(value) - 0.5) * SWEEP_DEG;
}
