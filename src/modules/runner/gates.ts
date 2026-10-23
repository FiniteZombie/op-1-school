// Level gates (plan decision 4): level N+1 of a vector opens once level N has
// two finished attempts with mode `<vector><N>` scoring at least 0.7, or
// unscored (absent score: a finish counts). Practice attempts count.

import { levelId } from '../../types/drills';
import type { Attempt } from '../../state/db';
import type { Lesson, VectorId } from '../../types/lessons';

export const GATE_ATTEMPTS = 2;
export const GATE_SCORE = 0.7;

export function levelPassed(attempts: readonly Attempt[], mode: string): boolean {
  let n = 0;
  for (const a of attempts) {
    if (a.mode === mode && (a.score === undefined || a.score >= GATE_SCORE)) n++;
  }
  return n >= GATE_ATTEMPTS;
}

export function hasDrill(lesson: Lesson): boolean {
  return lesson.steps.some((s) => s.kind === 'drill');
}

/** A drill step whose module is in `available` (module ids visible on this page). */
export function hasAvailableDrill(lesson: Lesson, available: ReadonlySet<string>): boolean {
  return lesson.steps.some((s) => s.kind === 'drill' && available.has(s.module));
}

function byLevel(lessons: readonly Lesson[], vector: VectorId): Lesson[] {
  return lessons.filter((l) => l.vector === vector).sort((a, b) => a.level - b.level);
}

/**
 * The library's lock. Open: under `dev`; a lesson with no available drill
 * (cards only, or drills on modules not built); the lowest gated level of its
 * vector. Otherwise the nearest lower lesson that has an available drill must
 * have passed (so a card-only level in between can't lock the ones above it
 * forever).
 */
export function lessonLocked(
  lesson: Lesson,
  lessons: readonly Lesson[],
  attempts: readonly Attempt[],
  available: ReadonlySet<string>,
  dev: boolean,
): boolean {
  if (dev) return false;
  if (!hasAvailableDrill(lesson, available)) return false;
  const below = byLevel(lessons, lesson.vector).filter((l) => l.level < lesson.level && hasAvailableDrill(l, available));
  const pred = below[below.length - 1];
  if (!pred) return false;
  return !levelPassed(attempts, levelId(pred.vector, pred.level));
}

/**
 * Today's lesson of a vector: the highest level reached by walking up from
 * the lowest while the level below has passed. It goes by attempts alone, not
 * by which modules exist, so B stays at B0 until B attempts exist. A lesson
 * with no drill has nothing to pass, so the walk goes through it.
 */
export function currentLesson(lessons: readonly Lesson[], vector: VectorId, attempts: readonly Attempt[]): Lesson | undefined {
  const row = byLevel(lessons, vector);
  let i = 0;
  while (i + 1 < row.length) {
    const here = row[i] as Lesson;
    if (hasDrill(here) && !levelPassed(attempts, levelId(vector, here.level))) break;
    i++;
  }
  return row[i];
}
