import { describe, expect, it } from 'vitest';
import type { Lesson } from '../../../types/lessons';
import { newDailySession, patchStep, reconcile } from '../session';
import { doneStepScore, sessionMarkdown, summaryFilename } from '../summary';
import { at, attempt, card, lesson } from './fixtures';

const a: Lesson = lesson('A', 3, [
  card(),
  { kind: 'drill', module: 'progression-trainer', mode: 'A3', minutes: 2 },
  { kind: 'drill', module: 'progression-trainer', mode: 'A3', minutes: 2 },
]);
const b = lesson('B', 0);
const d = lesson('D', 0, [card()]);
const byId = (id: string) => [a, b, d].find((l) => l.id === id);

describe('sessionMarkdown', () => {
  it('lists a scored, an unscored and a skipped drill, and the streak', () => {
    const t = at(2026, 10, 23, 9);
    let s = { ...newDailySession('s', t, [a, b, d]), startedAt: t };
    s = patchStep(s, 0, 0, { done: true });
    s = patchStep(s, 0, 1, { launchedAt: t });
    s = patchStep(s, 0, 2, { launchedAt: t });
    s = patchStep(s, 1, 0, { done: true });
    s = patchStep(s, 1, 1, { skipped: true });
    s = patchStep(s, 2, 0, { done: true });
    const attempts = [
      attempt({ mode: 'A3', sessionId: 's', at: t + 1, score: 0.55, data: { step: 1 } }),
      attempt({ mode: 'A3', sessionId: 's', at: t + 2, score: 0.8, data: { step: 1 } }),
      attempt({ mode: 'A3', sessionId: 's', at: t + 3, data: { step: 2 } }), // unscored
    ];
    s = reconcile(s, attempts, byId, t + 10);
    expect(s.finishedAt).toBeDefined();
    expect(sessionMarkdown(s, attempts, byId, 4)).toBe(
      [
        '# session 2026-10-23',
        '',
        'streak 4',
        '',
        '## a',
        'lesson a3',
        '- A3: 80%',
        '- A3: not scored',
        '',
        '## b',
        'lesson b0',
        '- B0: skipped',
        '',
        '## d',
        'lesson d0',
        '- cards only',
        '',
      ].join('\n'),
    );
    expect(summaryFilename(s)).toBe('op-1-school-2026-10-23.md');
  });

  it('says not done for a drill that was neither finished nor skipped', () => {
    const s = newDailySession('s', at(2026, 1, 2), [b]);
    expect(sessionMarkdown(s, [], byId, 0)).toContain('- B0: not done');
  });
});

describe('doneStepScore', () => {
  const t = at(2026, 10, 23, 9);
  const step1 = a.steps[1]!;
  const step2 = a.steps[2]!;
  const attempts = [
    attempt({ mode: 'A3', sessionId: 's', at: t + 1, score: 0.55, data: { step: 1 } }),
    attempt({ mode: 'A3', sessionId: 's', at: t + 2, score: 0.8, data: { step: 1 } }),
    attempt({ mode: 'A3', sessionId: 's', at: t + 3, data: { step: 2 } }), // unscored
    attempt({ mode: 'A3', sessionId: 'other', at: t + 4, score: 1, data: { step: 1 } }),
  ];

  it('shows the best score of a done drill step as recent does', () => {
    expect(doneStepScore('s', step1, 1, { launchedAt: t, done: true }, attempts)).toBe('A3 80%');
  });

  it('says not scored when the done step has no scored attempt', () => {
    expect(doneStepScore('s', step2, 2, { launchedAt: t, done: true }, attempts)).toBe('not scored');
  });

  it('shows a score of 0 as 0%', () => {
    const zero = [attempt({ mode: 'A3', sessionId: 's', at: t + 1, score: 0, data: { step: 1 } })];
    expect(doneStepScore('s', step1, 1, { launchedAt: t, done: true }, zero)).toBe('A3 0%');
  });

  it('shows nothing for a card, a skipped step or a step not done', () => {
    expect(doneStepScore('s', a.steps[0]!, 0, { done: true }, attempts)).toBeUndefined();
    expect(doneStepScore('s', step1, 1, { launchedAt: t, skipped: true }, attempts)).toBeUndefined();
    expect(doneStepScore('s', step1, 1, { launchedAt: t }, attempts)).toBeUndefined();
  });
});
