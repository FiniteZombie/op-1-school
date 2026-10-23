// `?dev&fast` (plan L3): every minute the Runner passes to a drill, and every countdown, is divided by 12.

export const FAST_DIVISOR = 12;

/** Minutes as passed to a drill: 4 → 4, or 4 → 0.3333 (20 s) when fast. */
export function scaleMinutes(minutes: number, fast: boolean): number {
  return fast ? Math.round((minutes / FAST_DIVISOR) * 1e4) / 1e4 : minutes;
}

/** An advisory countdown's length in whole seconds. */
export function countdownSeconds(minutes: number, fast: boolean): number {
  return Math.round(scaleMinutes(minutes, fast) * 60);
}

/** Seconds left of a countdown that began at `startedAt`; never below 0. */
export function secondsLeft(minutes: number, fast: boolean, startedAt: number, now: number): number {
  return Math.max(0, countdownSeconds(minutes, fast) - Math.floor((now - startedAt) / 1000));
}

/** `4:05`; minutes aren't capped at 59. */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
