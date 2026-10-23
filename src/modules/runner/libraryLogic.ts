// The library (plan L3): every lesson, grouped by vector in level order, and
// what each drill step of an opened lesson offers.

import type { Attempt } from '../../state/db';
import { VECTOR_IDS, type Lesson, type VectorId } from '../../types/lessons';
import { lessonLocked } from './gates';

export interface LibraryGroup {
  vector: VectorId;
  lessons: Lesson[];
}

/** Non-empty vectors in A–D order, each in level order. */
export function libraryGroups(lessons: readonly Lesson[]): LibraryGroup[] {
  return VECTOR_IDS.map((vector) => ({
    vector,
    lessons: lessons.filter((l) => l.vector === vector).sort((a, b) => a.level - b.level),
  })).filter((g) => g.lessons.length > 0);
}

export type DrillOffer = 'launch' | 'locked' | 'stub';

/** A drill step in the library: a stub when its module isn't available, `locked` when its lesson is, else it launches as practice. */
export function drillOffer(
  module: string,
  lesson: Lesson,
  lessons: readonly Lesson[],
  attempts: readonly Attempt[],
  available: ReadonlySet<string>,
  dev: boolean,
): DrillOffer {
  if (!available.has(module)) return 'stub';
  return lessonLocked(lesson, lessons, attempts, available, dev) ? 'locked' : 'launch';
}
