// The curriculum loader's pure part: validates raw JSON records and keeps the
// good ones. `index.ts` feeds it the files through `import.meta.glob`; tests
// feed it inline data.

import { loadProgression } from '../theory';
import {
  VECTOR_IDS,
  validateLesson,
  validateProgressionSpec,
  validateSequencerRecipe,
  type Lesson,
  type ProgressionSpec,
  type SequencerRecipe,
} from '../types/lessons';
import type { Progression } from '../types/music';

/** One JSON file: its path (named in errors) and its parsed content. */
export interface RawFile {
  file: string;
  data: unknown;
}

export interface RawCurriculum {
  /** Files holding a list of `ProgressionSpec`s. */
  progressions: readonly RawFile[];
  /** Files holding a list of `SequencerRecipe`s. */
  sequencerRecipes: readonly RawFile[];
  /** Files holding one `Lesson` each. */
  lessons: readonly RawFile[];
}

export interface Curriculum {
  progressionSpecs: ProgressionSpec[];
  /** The specs, loaded; same order. */
  progressions: Progression[];
  /** By vector (`VECTOR_IDS` order), then level, then id. */
  lessons: Lesson[];
  sequencerRecipes: SequencerRecipe[];
  /** One line per dropped record, naming the file and the field. */
  errors: string[];
}

function idOf(v: unknown): string | undefined {
  return typeof v === 'object' && v !== null && typeof (v as { id?: unknown }).id === 'string'
    ? (v as { id: string }).id
    : undefined;
}

// `file[2] ("id")` for a record in a list, `file ("id")` for a file of one.
function where(file: string, index: number | undefined, record: unknown): string {
  const id = idOf(record);
  return `${file}${index === undefined ? '' : `[${index}]`}${id === undefined ? '' : ` ("${id}")`}`;
}

/**
 * Validates every record, then drops (each with an error): an invalid record,
 * a second record with an id already seen in its kind, and a progression
 * `loadProgression` throws on.
 */
export function buildCurriculum(raw: RawCurriculum): Curriculum {
  const errors: string[] = [];

  function records<T>(
    files: readonly RawFile[],
    isList: boolean,
    validate: (v: unknown) => string[],
    accept: (record: T, at: string) => boolean = () => true,
  ): T[] {
    const kept: T[] = [];
    const seen = new Set<string>();
    for (const { file, data } of files) {
      let items: { record: unknown; index: number | undefined }[];
      if (isList) {
        if (!Array.isArray(data)) {
          errors.push(`${file}: expected a list`);
          continue;
        }
        items = data.map((record, index) => ({ record, index }));
      } else {
        items = [{ record: data, index: undefined }];
      }
      for (const { record, index } of items) {
        const at = where(file, index, record);
        const problems = validate(record);
        if (problems.length > 0) {
          errors.push(...problems.map((p) => `${at}: ${p}`));
          continue;
        }
        const id = idOf(record) as string;
        if (seen.has(id)) {
          errors.push(`${at}: id: "${id}" is already used`);
          continue;
        }
        if (!accept(record as T, at)) continue;
        seen.add(id);
        kept.push(record as T);
      }
    }
    return kept;
  }

  const progressions: Progression[] = [];
  const progressionSpecs = records<ProgressionSpec>(raw.progressions, true, validateProgressionSpec, (spec, at) => {
    try {
      progressions.push(loadProgression(spec));
      return true;
    } catch (e) {
      errors.push(`${at}: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
  });
  const sequencerRecipes = records<SequencerRecipe>(raw.sequencerRecipes, true, validateSequencerRecipe);
  const lessons = records<Lesson>(raw.lessons, false, validateLesson).sort(
    (a, b) =>
      VECTOR_IDS.indexOf(a.vector) - VECTOR_IDS.indexOf(b.vector) ||
      a.level - b.level ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );

  return { progressionSpecs, progressions, lessons, sequencerRecipes, errors };
}
