// Lessons and attempts the Runner's tests build (never the curriculum's content).

import type { Attempt, Session } from '../../../state/db';
import type { Lesson, LessonStep, VectorId } from '../../../types/lessons';

export const card = (title = 'c'): LessonStep => ({ kind: 'card', title, body: 'text' });

export function lesson(vector: VectorId, level: number, steps?: LessonStep[]): Lesson {
  const id = `${vector.toLowerCase()}${level}`;
  return {
    id,
    vector,
    level,
    title: `lesson ${id}`,
    minutes: 4,
    scored: true,
    steps:
      steps ??
      [
        card(),
        vector === 'A'
          ? { kind: 'drill', module: 'progression-trainer', mode: id.toUpperCase(), minutes: 3, progressionId: 'p1' }
          : vector === 'B'
            ? { kind: 'drill', module: 'pocket-dojo', mode: id.toUpperCase(), minutes: 3 }
            : card('d'),
      ],
  };
}

let n = 0;
export function attempt(over: Partial<Attempt> & { mode: string }): Attempt {
  return { id: `at${n++}`, sessionId: 's', module: 'progression-trainer', at: 1000, ...over };
}

export function session(over: Partial<Session> & { id: string }): Session {
  return { lessonId: 'daily', startedAt: 1000, scores: {}, ...over };
}

/** Local time, so day boundaries mean the same in every timezone. */
export const at = (y: number, m: number, d: number, h = 12): number => new Date(y, m - 1, d, h).getTime();

export const A_MODULES = new Set(['progression-trainer', 'runner']);
