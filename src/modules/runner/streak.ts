// The streak (plan L3): consecutive local calendar days, ending today or
// yesterday, with at least one finished daily session. Practice sessions
// don't count.

import type { Session } from '../../state/db';
import { dayKey, previousDayKey } from './days';
import { isDaily } from './session';

export function streak(sessions: readonly Session[], now: number): number {
  const days = new Set<string>();
  for (const s of sessions) {
    if (isDaily(s) && s.finishedAt !== undefined) days.add(dayKey(s.finishedAt));
  }
  const today = dayKey(now);
  let day = days.has(today) ? today : previousDayKey(today);
  let n = 0;
  while (days.has(day)) {
    n++;
    day = previousDayKey(day);
  }
  return n;
}
