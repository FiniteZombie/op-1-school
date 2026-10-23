import { describe, expect, it } from 'vitest';
import { parseLaunch } from '../../../types/drills';
import type { Lesson } from '../../../types/lessons';
import {
  activeStep,
  attemptFor,
  drillLaunch,
  drillQuery,
  launchStep,
  newDailySession,
  openSessionToday,
  patchStep,
  reconcile,
} from '../session';
import { at, attempt, card, lesson, session } from './fixtures';

// A6's shape: two drill steps on the same module and mode.
const a6: Lesson = lesson('A', 6, [
  { kind: 'drill', module: 'progression-trainer', mode: 'A6', minutes: 2, progressionId: 'p', params: { form: 'phrase' } },
  { kind: 'drill', module: 'progression-trainer', mode: 'A6', minutes: 2, progressionId: 'q', params: { form: 'call-response' } },
]);
const a0 = lesson('A', 0);
const d0 = lesson('D', 0, [card('x'), card('y')]);
const byId = (id: string) => [a0, a6, d0].find((l) => l.id === id);
const drill0 = a6.steps[0]!;
if (drill0.kind !== 'drill') throw new Error('fixture');

describe('the step-done rule', () => {
  const launchedAt = 5000;
  const good = attempt({ mode: 'A6', sessionId: 's', at: 6000, data: { step: 0 } });

  it('counts an attempt in this session with the module, mode and step, at or after the launch', () => {
    expect(attemptFor('s', drill0, 0, launchedAt, [good])).toBe(good);
    expect(attemptFor('s', drill0, 0, launchedAt, [{ ...good, at: launchedAt }])).toBeDefined();
  });

  it.each([
    ['before the launch', { at: 4999 }],
    ['in another session', { sessionId: 'other' }],
    ['for another mode', { mode: 'A5' }],
    ['for another module', { module: 'pocket-dojo' }],
    ['for the other step of A6 (data.step)', { data: { step: 1 } }],
    ['without data.step', { data: {} }],
    ['with no data', { data: undefined }],
  ])('does not count an attempt %s', (_name, over) => {
    expect(attemptFor('s', drill0, 0, launchedAt, [{ ...good, ...over }])).toBeUndefined();
  });

  it('does not count anything before the step was launched', () => {
    expect(attemptFor('s', drill0, 0, undefined, [good])).toBeUndefined();
  });
});

describe('a daily session', () => {
  it('starts with one steps entry per lesson step', () => {
    const s = newDailySession('s', 1000, [a0, d0]);
    expect(s).toMatchObject({ kind: 'daily', lessonId: 'daily', startedAt: 1000, scores: {} });
    expect(s.segments?.map((g) => [g.lessonId, g.steps?.length])).toEqual([
      ['a0', 2],
      ['d0', 2],
    ]);
  });

  it('walks card, drill, card: next, launch, an attempt, then the session finishes with best scores', () => {
    let s = newDailySession('s', 1000, [a0, d0]);
    expect(activeStep(s)).toEqual({ segment: 0, step: 0 });
    s = patchStep(s, 0, 0, { done: true });
    expect(activeStep(s)).toEqual({ segment: 0, step: 1 });

    // Launched but no attempt yet: still the drill step, offered again.
    s = launchStep(s, 0, 1, 2000);
    expect(reconcile(s, [], byId, 2500)).toBe(s);
    expect(activeStep(s)).toEqual({ segment: 0, step: 1 });

    const attempts = [attempt({ mode: 'A0', sessionId: 's', at: 3000, score: 0.8, data: { step: 1 } }), attempt({ mode: 'A0', sessionId: 's', at: 3100, score: 0.9, data: { step: 1 } })];
    s = reconcile(s, attempts, byId, 4000);
    expect(s.segments?.[0]).toMatchObject({ finishedAt: 4000, steps: [{ done: true }, { done: true, launchedAt: 2000 }] });
    expect(s.segments?.[1]?.startedAt).toBe(4000);
    expect(s.finishedAt).toBeUndefined();

    s = patchStep(s, 1, 0, { done: true });
    s = patchStep(s, 1, 1, { skipped: true });
    s = reconcile(s, attempts, byId, 5000);
    expect(s.finishedAt).toBe(5000);
    expect(s.scores).toEqual({ A0: 0.9 });
    expect(activeStep(s)).toBeUndefined();
  });

  it("A6's two same-mode steps finish one at a time", () => {
    let s = newDailySession('s', 1000, [a6]);
    s = launchStep(launchStep(s, 0, 0, 2000), 0, 1, 2000);
    s = reconcile(s, [attempt({ mode: 'A6', sessionId: 's', at: 3000, data: { step: 1 } })], byId, 4000);
    expect(s.segments?.[0]?.steps?.map((x) => x.done ?? false)).toEqual([false, true]);
    expect(activeStep(s)).toEqual({ segment: 0, step: 0 });
  });

  it('keeps the first launch time', () => {
    const s = launchStep(newDailySession('s', 1, [a0]), 0, 1, 2000);
    expect(launchStep(s, 0, 1, 9000)).toBe(s);
  });

  it('skips a segment whose lesson no longer exists', () => {
    const s = reconcile(newDailySession('s', 1, [a0]), [], () => undefined, 99);
    expect(s.segments?.[0]).toMatchObject({ skipped: true, finishedAt: 99 });
    expect(s.finishedAt).toBe(99);
  });

  it('never reopens a finished session', () => {
    const done = session({ id: 'f', finishedAt: 5, segments: [] });
    expect(reconcile(done, [], byId, 9)).toBe(done);
  });
});

describe('resuming', () => {
  const now = at(2026, 10, 23, 15);
  const today = (id: string, over = {}) => session({ id, kind: 'daily', startedAt: at(2026, 10, 23, 9), segments: [], ...over });

  it("finds today's open daily session", () => {
    expect(openSessionToday([today('a')], now)?.id).toBe('a');
  });

  it('leaves an earlier day open session unfinished and ignored', () => {
    const old = today('old', { startedAt: at(2026, 10, 22, 20) });
    expect(openSessionToday([old], now)).toBeUndefined();
  });

  it('ignores finished and practice sessions', () => {
    expect(openSessionToday([today('f', { finishedAt: 1 }), today('p', { kind: 'practice' })], now)).toBeUndefined();
  });

  it('treats a session with no kind as daily', () => {
    expect(openSessionToday([session({ id: 'k', startedAt: at(2026, 10, 23, 9) })], now)?.id).toBe('k');
  });
});

describe('the launch', () => {
  it('round-trips through parseLaunch with session, lesson, step, progression, minutes, params and returnTo', () => {
    const launch = drillLaunch(a6.steps[1] as never, 1, 'a6', 's1', false);
    const q = drillQuery(launch);
    expect(q).toMatchObject({ mode: 'A6', session: 's1', lesson: 'a6', step: '1', progression: 'q', minutes: '2', returnTo: '/runner' });
    expect(parseLaunch('progression-trainer', q)).toEqual({ launch });
  });

  it('a library launch has no session and returns to its lesson; fast divides minutes by 12', () => {
    const q = drillQuery(drillLaunch(a6.steps[0] as never, 0, 'a6', undefined, true));
    expect(q.session).toBeUndefined();
    expect(q.returnTo).toBe('/runner?view=library&open=a6');
    expect(Number(q.minutes)).toBeCloseTo(2 / 12, 3);
  });
});
