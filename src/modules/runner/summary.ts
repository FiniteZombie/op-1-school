// The export (plan L3): a finished daily session as markdown. Headings are
// placeholders (`# session <date>`, `## a`, …).

import type { Attempt, Session, SessionStep } from '../../state/db';
import type { DrillStep, LessonStep } from '../../types/lessons';
import { dayKey } from './days';
import { attemptFor, stepDone, type LessonOf } from './session';

export const SUMMARY_TEXT = {
  heading: (date: string) => `# session ${date}`, // placeholder
  streak: (n: number) => `streak ${n}`, // placeholder
  notScored: 'not scored', // placeholder
  skipped: 'skipped', // placeholder
  notDone: 'not done', // placeholder
  cardsOnly: 'cards only', // placeholder
} as const;

export function percent(score: number): string {
  return `${Math.round(score * 100)}%`;
}

/** The best score among the attempts that answer this drill step, or undefined when none is scored. */
export function bestStepScore(
  sessionId: string,
  step: DrillStep,
  index: number,
  launchedAt: number | undefined,
  attempts: readonly Attempt[],
): number | undefined {
  const scores = attempts
    .filter((a) => attemptFor(sessionId, step, index, launchedAt, [a]))
    .map((a) => a.score)
    .filter((s): s is number => s !== undefined);
  return scores.length ? Math.max(...scores) : undefined;
}

/** What a done drill step shows beside `done`, as `recent` writes it: `A0 55%`, or `not scored`. Undefined for any other step. */
export function doneStepScore(
  sessionId: string,
  step: LessonStep,
  index: number,
  st: SessionStep | undefined,
  attempts: readonly Attempt[],
): string | undefined {
  if (step.kind !== 'drill' || st?.done !== true) return undefined;
  const best = bestStepScore(sessionId, step, index, st.launchedAt, attempts);
  return best === undefined ? SUMMARY_TEXT.notScored : `${step.mode} ${percent(best)}`;
}

export function summaryFilename(session: Session): string {
  return `op-1-school-${dayKey(session.startedAt)}.md`;
}

export function sessionMarkdown(session: Session, attempts: readonly Attempt[], lessonOf: LessonOf, streakDays: number): string {
  const out = [SUMMARY_TEXT.heading(dayKey(session.startedAt)), '', SUMMARY_TEXT.streak(streakDays)];
  for (const seg of session.segments ?? []) {
    const lesson = lessonOf(seg.lessonId);
    out.push('', `## ${lesson ? lesson.vector.toLowerCase() : '?'}`, lesson ? lesson.title : seg.lessonId);
    const drills: string[] = [];
    lesson?.steps.forEach((step, idx) => {
      if (step.kind !== 'drill') return;
      const st = seg.steps?.[idx];
      let result: string;
      if (st?.skipped) result = SUMMARY_TEXT.skipped;
      else if (!stepDone(st)) result = SUMMARY_TEXT.notDone;
      else {
        const best = bestStepScore(session.id, step, idx, st?.launchedAt, attempts);
        result = best === undefined ? SUMMARY_TEXT.notScored : percent(best);
      }
      drills.push(`- ${step.mode}: ${result}`);
    });
    out.push(...(drills.length ? drills : [`- ${SUMMARY_TEXT.cardsOnly}`]));
  }
  return `${out.join('\n')}\n`;
}
