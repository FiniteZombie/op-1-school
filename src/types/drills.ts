// The drill contract (plan phase-2 decisions 1, 2 and 5): how a drill is
// launched by URL, and the mode ids each drill module answers to. The Runner,
// the library and deep links write a launch with `launchQuery`; the module
// reads it back with `parseLaunch`. The query is the whole hand-off, so a
// reload mid-drill reopens the same drill.

import type { DrillModuleId, VectorId } from './lessons';

/** Each drill module's mode ids. A lesson's drill step names one of its module's. */
export const DRILL_MODES = {
  'progression-trainer': ['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6'],
  'pocket-dojo': ['B0', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6'],
  'sample-flip': ['C1', 'C2', 'C3'],
  'kit-compiler': [],
} as const satisfies Record<DrillModuleId, readonly string[]>;

/** `params.form` values (A6): a phrase, or call-and-response. */
export const DRILL_FORMS = ['phrase', 'call-response'] as const;
export type DrillForm = (typeof DRILL_FORMS)[number];

/**
 * The `note` of a `TimingOffset` for a tap on a pad that has no pitch (A0's
 * tap pad). It sits outside `MidiNote`'s 0..127 on purpose, so nothing
 * mistakes a pad tap for a played note.
 */
export const PAD_NOTE = -1;

/** `levelId('A', 0)` → `A0`: a lesson's level as a mode id. */
export function levelId(vector: VectorId, level: number): string {
  return `${vector}${level}`;
}

/** One drill launch. `module` is the route, so it isn't in the query. */
export interface DrillLaunch {
  module: DrillModuleId;
  /** The level id (`A0`…), one of `DRILL_MODES[module]`. */
  mode: string;
  /** The Runner's session; without one the module logs its own practice session. */
  session?: string;
  lesson?: string;
  /** The step's index in its lesson; the module copies it into `Attempt.data.step`. */
  step?: number;
  progression?: string;
  minutes?: number;
  /** An app path (`/runner`) for the module's way back. */
  returnTo?: string;
  /** The lesson step's `params`. */
  params?: Record<string, unknown>;
}

/** The launch as query parameters, in field order; absent fields are left out. */
export function launchQuery(launch: DrillLaunch): Record<string, string> {
  const q: Record<string, string> = { mode: launch.mode };
  if (launch.session !== undefined) q.session = launch.session;
  if (launch.lesson !== undefined) q.lesson = launch.lesson;
  if (launch.step !== undefined) q.step = String(launch.step);
  if (launch.progression !== undefined) q.progression = launch.progression;
  if (launch.minutes !== undefined) q.minutes = String(launch.minutes);
  if (launch.returnTo !== undefined) q.returnTo = launch.returnTo;
  if (launch.params !== undefined) q.params = JSON.stringify(launch.params);
  return q;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Reads a launch from a location's query (`dev` and `fast` already taken
 * out). The error names the field: `minutes: …`. Parameters it doesn't know
 * are ignored.
 */
export function parseLaunch(
  module: DrillModuleId,
  query: Readonly<Record<string, string>>,
): { launch: DrillLaunch } | { error: string } {
  const modes: readonly string[] = DRILL_MODES[module];
  const mode = query.mode;
  if (mode === undefined) return { error: 'mode: missing' };
  if (!modes.includes(mode)) {
    return { error: `mode: ${JSON.stringify(mode)} isn't a ${module} mode (${modes.join(', ') || 'it has none'})` };
  }
  const launch: DrillLaunch = { module, mode };

  for (const field of ['session', 'lesson', 'progression'] as const) {
    const v = query[field];
    if (v === undefined) continue;
    if (v.trim() === '') return { error: `${field}: must not be empty` };
    launch[field] = v;
  }

  if (query.step !== undefined) {
    const step = Number(query.step);
    if (query.step.trim() === '' || !Number.isInteger(step) || step < 0) {
      return { error: `step: expected a whole number from 0, got ${JSON.stringify(query.step)}` };
    }
    launch.step = step;
  }

  if (query.minutes !== undefined) {
    const minutes = Number(query.minutes);
    if (query.minutes.trim() === '' || !Number.isFinite(minutes) || minutes <= 0) {
      return { error: `minutes: expected a number greater than 0, got ${JSON.stringify(query.minutes)}` };
    }
    launch.minutes = minutes;
  }

  if (query.returnTo !== undefined) {
    // An app path only: `//host` would leave the app.
    if (!query.returnTo.startsWith('/') || query.returnTo.startsWith('//')) {
      return { error: `returnTo: expected an app path starting with /, got ${JSON.stringify(query.returnTo)}` };
    }
    launch.returnTo = query.returnTo;
  }

  if (query.params !== undefined) {
    let params: unknown;
    try {
      params = JSON.parse(query.params);
    } catch {
      return { error: `params: not valid JSON: ${JSON.stringify(query.params)}` };
    }
    if (!isObj(params)) return { error: `params: expected a JSON object, got ${query.params}` };
    if (params.form !== undefined && !(DRILL_FORMS as readonly unknown[]).includes(params.form)) {
      return { error: `params.form: expected one of ${DRILL_FORMS.join(', ')}, got ${JSON.stringify(params.form)}` };
    }
    launch.params = params;
  }

  return { launch };
}
