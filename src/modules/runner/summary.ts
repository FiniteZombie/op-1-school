// The export (plan L3): a finished daily session as markdown. Headings are
// placeholders (`# session <date>`, `## a`, …).

import type { Attempt, Session } from '../../state/db';
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
        const scores = attempts
          .filter((a) => attemptFor(session.id, step, idx, st?.launchedAt, [a]))
          .map((a) => a.score)
          .filter((s): s is number => s !== undefined);
        result = scores.length ? percent(Math.max(...scores)) : SUMMARY_TEXT.notScored;
      }
      drills.push(`- ${step.mode}: ${result}`);
    });
    out.push(...(drills.length ? drills : [`- ${SUMMARY_TEXT.cardsOnly}`]));
  }
  return `${out.join('\n')}\n`;
}
