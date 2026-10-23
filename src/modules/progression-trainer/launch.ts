// What the page shows for its query (plan decision 1; pre-flight technical
// answer 20): the drill a launch names, or the pickers, with the launch's
// error above them when it can't be opened.
import { launchQuery, parseLaunch, type DrillForm, type DrillLaunch } from '../../types/drills';
import type { Progression } from '../../types/music';
import { LABELS } from './labels';
import { LEVELS, isLevelId, usableFor, type LevelId } from './levels';

export const MODULE_ID = 'progression-trainer' as const;

export type PageRoute =
  | { kind: 'pickers'; level: LevelId | null; form: DrillForm; error: string | null; launch: DrillLaunch | null }
  | {
      kind: 'drill';
      launch: DrillLaunch;
      level: LevelId;
      form: DrillForm;
      progression: Progression;
      minutes: number;
    };

function formOf(launch: DrillLaunch): DrillForm {
  return launch.params?.form === 'call-response' ? 'call-response' : 'phrase';
}

export function resolveLaunch(
  query: Readonly<Record<string, string>>,
  find: (id: string) => Progression | undefined,
): PageRoute {
  if (query.mode === undefined && Object.keys(query).length === 0) {
    return { kind: 'pickers', level: null, form: 'phrase', error: null, launch: null };
  }
  const parsed = parseLaunch(MODULE_ID, query);
  if ('error' in parsed) {
    return {
      kind: 'pickers',
      level: isLevelId(query.mode) ? query.mode : null,
      form: 'phrase',
      error: `${LABELS.cantOpen}: ${parsed.error}`,
      launch: null,
    };
  }
  const { launch } = parsed;
  const level = launch.mode as LevelId; // parseLaunch checked it against DRILL_MODES
  const form = formOf(launch);
  if (launch.progression === undefined) return { kind: 'pickers', level, form, error: null, launch };
  const progression = find(launch.progression);
  const fail = (why: string): PageRoute => ({
    kind: 'pickers',
    level,
    form,
    error: `${LABELS.cantOpen}: ${why}`,
    launch,
  });
  if (!progression) return fail(`${LABELS.unknownProgression} ${JSON.stringify(launch.progression)}`);
  if (!usableFor(level, progression, form)) return fail(`${launch.progression} ${LABELS.doesntFit}`);
  return { kind: 'drill', launch, level, form, progression, minutes: launch.minutes ?? LEVELS[level].defaultMinutes };
}

/** The query a picker change navigates to: a practice launch (no session). */
export function pickerQuery(level: LevelId, progression: string | undefined, form: DrillForm): Record<string, string> {
  const launch: DrillLaunch = { module: MODULE_ID, mode: level };
  if (progression !== undefined) launch.progression = progression;
  if (level === 'A6') launch.params = { form };
  return launchQuery(launch);
}
