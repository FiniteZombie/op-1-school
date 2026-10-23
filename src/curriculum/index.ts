// The curriculum (SPEC §4) as data: `progressions.json`, `sequencerRecipes.json`
// and one `lessons/<vector><level>.json` per lesson, validated once at load
// by `buildCurriculum`. A bad record is dropped, and its error goes to
// `console.error` and `curriculumErrors()`, so one typo doesn't take down the
// app.

import type { Lesson, ProgressionSpec, SequencerRecipe } from '../types/lessons';
import type { Progression } from '../types/music';
import { buildCurriculum, type RawFile } from './build';

function files(found: Record<string, unknown>): RawFile[] {
  return Object.entries(found)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([path, data]) => ({ file: `src/curriculum/${path.replace(/^\.\//, '')}`, data }));
}

const curriculum = buildCurriculum({
  progressions: files(import.meta.glob('./progressions.json', { eager: true, import: 'default' })),
  sequencerRecipes: files(import.meta.glob('./sequencerRecipes.json', { eager: true, import: 'default' })),
  lessons: files(import.meta.glob('./lessons/*.json', { eager: true, import: 'default' })),
});

for (const e of curriculum.errors) console.error(`curriculum: ${e}`);

const progressionsById = new Map(curriculum.progressions.map((p) => [p.id, p]));
const lessonsById = new Map(curriculum.lessons.map((l) => [l.id, l]));

/** Every valid progression as stored (numerals). */
export function progressionSpecs(): readonly ProgressionSpec[] {
  return curriculum.progressionSpecs;
}

/** Every valid progression, loaded with `loadProgression`. */
export function progressions(): readonly Progression[] {
  return curriculum.progressions;
}

export function progressionById(id: string): Progression | undefined {
  return progressionsById.get(id);
}

/** Every valid lesson, by vector then level. */
export function lessons(): readonly Lesson[] {
  return curriculum.lessons;
}

export function lessonById(id: string): Lesson | undefined {
  return lessonsById.get(id);
}

export function sequencerRecipes(): readonly SequencerRecipe[] {
  return curriculum.sequencerRecipes;
}

/** One line per record dropped at load, naming its file and field; empty when all is well. */
export function curriculumErrors(): readonly string[] {
  return curriculum.errors;
}
