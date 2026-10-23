// What the Runner's home offers, from what loaded (plan L3, "Empty and
// failure cases"): no lessons gives no `start`; a database that won't open
// disables `start session` and leaves the library.

import type { Session } from '../../state/db';
import type { Lesson } from '../../types/lessons';
import type { RunnerData } from './store';

export type HomeAction =
  | { kind: 'start'; enabled: boolean }
  | { kind: 'resume'; session: Session }
  | { kind: 'none' };

export function homeAction(lessons: readonly Lesson[], plan: readonly Lesson[], data: RunnerData, open: Session | undefined): HomeAction {
  if (lessons.length === 0 || plan.length === 0) return { kind: 'none' };
  if (data.kind === 'ready' && open) return { kind: 'resume', session: open };
  return { kind: 'start', enabled: data.kind === 'ready' };
}
