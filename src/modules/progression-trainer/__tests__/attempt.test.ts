import { describe, expect, it } from 'vitest';
import type { Attempt, Session } from '../../../state/db';
import { C_MAJOR_POP } from '../../../theory/__tests__/fixtures';
import { DrillSaver, buildRecords, type DrillDb } from '../attempt';
import type { LevelResult } from '../scoring';
import { BAR, harness } from './harness';

const SCORED: LevelResult = { score: 0.75, data: { right: 3 }, counts: [], reveal: [] };
const UNSCORED: LevelResult = { data: { notes: 4, clashes: 1 }, counts: [], reveal: [] };
const TIMED: LevelResult = {
  score: 0.5,
  offsets: [{ note: -1, targetTick: 1536, offsetMs: -30, source: 'touch', calibrated: false }],
  data: { on: 1 },
  counts: [],
  reveal: [],
};

function ids() {
  let n = 0;
  return () => `id-${++n}`;
}

describe('buildRecords', () => {
  it('a scored drill in a Runner session: the attempt joins it, step goes into data, no session row', () => {
    const r = buildRecords({
      launch: { session: 'daily-1', lesson: 'a1', step: 2, progression: 'seed-cmajor' },
      level: 'A1',
      result: SCORED,
      startedAt: 100,
      at: 500,
      newId: ids(),
    });
    expect(r.session).toBeUndefined();
    expect(r.attempt).toEqual<Attempt>({
      id: 'id-1',
      sessionId: 'daily-1',
      module: 'progression-trainer',
      mode: 'A1',
      at: 500,
      score: 0.75,
      data: { right: 3, progression: 'seed-cmajor', step: 2 },
    });
  });

  it('a practice drill writes its own session: lessonId, startedAt, finishedAt and scores', () => {
    const r = buildRecords({
      launch: { lesson: 'a1', progression: 'seed-cmajor' },
      level: 'A1',
      result: SCORED,
      startedAt: 100,
      at: 500,
      newId: ids(),
    });
    expect(r.session).toEqual<Session>({
      id: 'id-1',
      kind: 'practice',
      lessonId: 'a1',
      startedAt: 100,
      finishedAt: 500,
      scores: { A1: 0.75 },
    });
    expect(r.attempt.sessionId).toBe('id-1');
    expect(r.attempt.data).not.toHaveProperty('step');
  });

  it('an unscored drill has no score and empty session scores; lessonId defaults to practice', () => {
    const r = buildRecords({ launch: { progression: 'p' }, level: 'A2', result: UNSCORED, startedAt: 1, at: 2, newId: ids() });
    expect(r.attempt).not.toHaveProperty('score');
    expect(r.attempt).not.toHaveProperty('offsets');
    expect(r.session).toMatchObject({ lessonId: 'practice', scores: {} });
  });

  it('a timed level keeps its offsets', () => {
    const r = buildRecords({ launch: { session: 's', step: 0 }, level: 'A0', result: TIMED, startedAt: 1, at: 2, newId: ids() });
    expect(r.attempt.offsets).toEqual(TIMED.offsets);
    expect(r.attempt.data).toMatchObject({ on: 1, step: 0 });
  });
});

describe('DrillSaver', () => {
  it('saves the session, then the attempt', async () => {
    const writes: string[] = [];
    const db: DrillDb = {
      putAttempt: async (a) => writes.push(`attempt ${a.id}`),
      putSession: async (s) => writes.push(`session ${s.id}`),
    };
    const saver = new DrillSaver(async () => db);
    expect(saver.state().kind).toBe('opening');
    expect((await saver.ready()).kind).toBe('ready');
    const records = buildRecords({ launch: {}, level: 'A1', result: SCORED, startedAt: 1, at: 2, newId: ids() });
    expect(await saver.save(records)).toBe(true);
    expect(writes).toEqual(['session id-1', 'attempt id-2']);
  });

  it('a rejecting openAppDb turns saving off with its message, and the drill still runs to done', async () => {
    const saver = new DrillSaver(() =>
      Promise.reject(new Error('IndexedDB is not available in this browser, so progress cannot be saved')),
    );
    expect(await saver.ready()).toEqual({
      kind: 'off',
      message: 'IndexedDB is not available in this browser, so progress cannot be saved',
    });

    const h = await harness({ level: 'A1', progression: C_MAJOR_POP, startAt: 1 });
    h.ctl.start();
    h.stepTo(1 + 4 * BAR + 0.5);
    h.ctl.stop();
    expect(h.ctl.drill().phase).toBe('done');
    const result = h.ctl.finished();
    expect(result).not.toBeNull();
    const records = buildRecords({ launch: {}, level: 'A1', result: result!, startedAt: 1, at: 2, newId: ids() });
    expect(await saver.save(records)).toBe(false);
  });
});
