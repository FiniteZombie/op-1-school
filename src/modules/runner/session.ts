// A daily session's life (plan L3, decisions 1 and 3): built from the plan,
// moved along by the user's `next`, `skip` and launches, and reconciled
// against the attempts the drills wrote. All pure: each function returns a
// new session, or the same object when nothing changed.

import { launchQuery, type DrillLaunch } from '../../types/drills';
import type { Attempt, Session, SessionSegment, SessionStep } from '../../state/db';
import type { DrillStep, Lesson } from '../../types/lessons';
import { dayKey } from './days';
import { scaleMinutes } from './fast';

export const RUNNER_ROUTE = '/runner';

export type LessonOf = (id: string) => Lesson | undefined;

export function isDaily(s: Session): boolean {
  return (s.kind ?? 'daily') === 'daily';
}

export function newDailySession(id: string, now: number, plan: readonly Lesson[]): Session {
  return {
    id,
    lessonId: 'daily',
    startedAt: now,
    scores: {},
    kind: 'daily',
    segments: plan.map((l) => ({ lessonId: l.id, startedAt: now, steps: l.steps.map(() => ({})) })),
  };
}

/** The most recent unfinished daily session that started today (an earlier day's stays unfinished and is ignored). */
export function openSessionToday(sessions: readonly Session[], now: number): Session | undefined {
  const today = dayKey(now);
  return sessions
    .filter((s) => isDaily(s) && s.finishedAt === undefined && dayKey(s.startedAt) === today)
    .sort((a, b) => b.startedAt - a.startedAt)[0];
}

/** Daily sessions, newest first. Recent list and export never see a practice session. */
export function dailySessions(sessions: readonly Session[]): Session[] {
  return sessions.filter(isDaily).sort((a, b) => b.startedAt - a.startedAt);
}

export function lastFinishedDaily(sessions: readonly Session[]): Session | undefined {
  return dailySessions(sessions).find((s) => s.finishedAt !== undefined);
}

export function stepDone(st: SessionStep | undefined): boolean {
  return st?.done === true || st?.skipped === true;
}

/**
 * A drill step is done when an attempt in this session has its module, mode
 * and `data.step` equal to the step's index, at or after `launchedAt`.
 * `data.step` is what keeps A6's two same-mode steps apart.
 */
export function attemptFor(
  sessionId: string,
  step: DrillStep,
  index: number,
  launchedAt: number | undefined,
  attempts: readonly Attempt[],
): Attempt | undefined {
  if (launchedAt === undefined) return undefined;
  return attempts.find(
    (a) =>
      a.sessionId === sessionId &&
      a.module === step.module &&
      a.mode === step.mode &&
      a.at >= launchedAt &&
      typeof a.data === 'object' &&
      a.data !== null &&
      (a.data as { step?: unknown }).step === index,
  );
}

/** The best score per mode among a session's attempts. */
export function bestScores(sessionId: string, attempts: readonly Attempt[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of attempts) {
    if (a.sessionId !== sessionId || a.score === undefined) continue;
    if (a.score > (out[a.mode] ?? -Infinity)) out[a.mode] = a.score;
  }
  return out;
}

function sameStep(a: SessionStep | undefined, b: SessionStep): boolean {
  return a !== undefined && a.done === b.done && a.skipped === b.skipped && a.launchedAt === b.launchedAt;
}

/**
 * Marks drill steps done from the attempts, finishes segments whose steps are
 * all done or skipped (the next segment starts then), and finishes the session
 * (with `scores`) when every segment is. A segment whose lesson no longer
 * exists is skipped.
 */
export function reconcile(session: Session, attempts: readonly Attempt[], lessonOf: LessonOf, now: number): Session {
  if (session.finishedAt !== undefined || !session.segments) return session;
  let changed = false;
  const segments: SessionSegment[] = session.segments.map((seg) => ({ ...seg }));
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i] as SessionSegment;
    if (seg.finishedAt !== undefined) continue;
    const lesson = lessonOf(seg.lessonId);
    if (!lesson) {
      seg.skipped = true;
      seg.finishedAt = now;
      changed = true;
    } else {
      const before = seg.steps ?? [];
      const steps: SessionStep[] = lesson.steps.map((step, idx) => {
        const st: SessionStep = { ...(before[idx] ?? {}) };
        if (step.kind === 'drill' && !stepDone(st) && attemptFor(session.id, step, idx, st.launchedAt, attempts)) st.done = true;
        return st;
      });
      if (steps.length !== before.length || steps.some((s, idx) => !sameStep(before[idx], s))) changed = true;
      seg.steps = steps;
      if (steps.every(stepDone)) {
        seg.finishedAt = now;
        changed = true;
      }
    }
    if (seg.finishedAt !== undefined) {
      const next = segments[i + 1];
      if (next && next.finishedAt === undefined && next.startedAt !== now) {
        next.startedAt = now;
        changed = true;
      }
    }
  }
  if (!changed) return session;
  const out: Session = { ...session, segments };
  if (segments.every((s) => s.finishedAt !== undefined)) {
    out.finishedAt = now;
    out.scores = bestScores(session.id, attempts);
  }
  return out;
}

/** The first segment not yet finished and, in it, the first step not done or skipped. */
export function activeStep(session: Session): { segment: number; step: number } | undefined {
  const segments = session.segments ?? [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i] as SessionSegment;
    if (seg.finishedAt !== undefined) continue;
    const steps = seg.steps ?? [];
    const j = steps.findIndex((s) => !stepDone(s));
    return { segment: i, step: j < 0 ? steps.length : j };
  }
  return undefined;
}

/** A copy of the session with one step's entry patched (missing entries are filled in first). */
export function patchStep(session: Session, segment: number, step: number, patch: SessionStep): Session {
  const segments = (session.segments ?? []).map((seg, i) => {
    if (i !== segment) return seg;
    const steps = [...(seg.steps ?? [])];
    while (steps.length <= step) steps.push({});
    steps[step] = { ...steps[step], ...patch };
    return { ...seg, steps };
  });
  return { ...session, segments };
}

/** The first launch time wins: an attempt from any launch of this step since then counts. */
export function launchStep(session: Session, segment: number, step: number, now: number): Session {
  const had = session.segments?.[segment]?.steps?.[step]?.launchedAt;
  return had === undefined ? patchStep(session, segment, step, { launchedAt: now }) : session;
}

/**
 * The launch for a drill step. A session's step carries the `session` and
 * `step`; a library (practice) launch has no `session` but still names its
 * lesson and step.
 */
export function drillLaunch(
  step: DrillStep,
  stepIndex: number,
  lessonId: string,
  sessionId: string | undefined,
  fast: boolean,
): DrillLaunch {
  const launch: DrillLaunch = { module: step.module, mode: step.mode };
  if (sessionId !== undefined) launch.session = sessionId;
  launch.lesson = lessonId;
  launch.step = stepIndex;
  if (step.progressionId !== undefined) launch.progression = step.progressionId;
  launch.minutes = scaleMinutes(step.minutes, fast);
  if (step.params !== undefined) launch.params = step.params;
  launch.returnTo = RUNNER_ROUTE;
  return launch;
}

export function drillQuery(launch: DrillLaunch): Record<string, string> {
  return launchQuery(launch);
}
