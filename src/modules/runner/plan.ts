// Today's plan (plan L3): segment A is the current A level's lesson, B the
// current B level's, C/D the C or D lesson least recently in a finished
// segment. A vector with no lessons drops its segment.

import type { Attempt, Session } from '../../state/db';
import type { Lesson } from '../../types/lessons';
import { currentLesson } from './gates';
import { isDaily } from './session';

/** When each lesson last finished a segment in a daily session (ms); lessons never shown are absent. */
export function lastShown(sessions: readonly Session[]): Map<string, number> {
  const last = new Map<string, number>();
  for (const s of sessions) {
    if (!isDaily(s)) continue;
    for (const seg of s.segments ?? []) {
      if (seg.finishedAt === undefined) continue;
      if (seg.finishedAt > (last.get(seg.lessonId) ?? -Infinity)) last.set(seg.lessonId, seg.finishedAt);
    }
  }
  return last;
}

/** The C or D lesson shown least recently: never-shown first, ties by vector then level. */
export function rotationLesson(lessons: readonly Lesson[], sessions: readonly Session[]): Lesson | undefined {
  const last = lastShown(sessions);
  const pool = lessons
    .filter((l) => l.vector === 'C' || l.vector === 'D')
    .sort((a, b) => (a.vector < b.vector ? -1 : a.vector > b.vector ? 1 : a.level - b.level));
  let best: Lesson | undefined;
  for (const l of pool) {
    if (!best || (last.get(l.id) ?? -Infinity) < (last.get(best.id) ?? -Infinity)) best = l;
  }
  return best;
}

export function todaysPlan(lessons: readonly Lesson[], sessions: readonly Session[], attempts: readonly Attempt[]): Lesson[] {
  const plan = [currentLesson(lessons, 'A', attempts), currentLesson(lessons, 'B', attempts), rotationLesson(lessons, sessions)];
  return plan.filter((l): l is Lesson => l !== undefined);
}
