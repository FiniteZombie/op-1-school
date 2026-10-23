import { describe, expect, it } from 'vitest';
import { homeAction } from '../homeAction';
import { drillOffer, libraryGroups } from '../libraryLogic';
import { loadRunnerData, type RunnerStore } from '../store';
import { A_MODULES, attempt, lesson, session } from './fixtures';

const lessons = [lesson('A', 0), lesson('B', 0), lesson('D', 0)];
const ready = { kind: 'ready' as const, sessions: [], attempts: [] };

describe('home action', () => {
  it('offers start when lessons and a database exist', () => {
    expect(homeAction(lessons, lessons, ready, undefined)).toEqual({ kind: 'start', enabled: true });
  });

  it('offers resume when today has an open session', () => {
    const s = session({ id: 'o' });
    expect(homeAction(lessons, lessons, ready, s)).toEqual({ kind: 'resume', session: s });
  });

  it('offers no start without lessons', () => {
    expect(homeAction([], [], ready, undefined)).toEqual({ kind: 'none' });
  });

  it('disables start session while the database is loading or has failed', () => {
    expect(homeAction(lessons, lessons, { kind: 'error', message: 'x' }, undefined)).toEqual({ kind: 'start', enabled: false });
    expect(homeAction(lessons, lessons, { kind: 'loading' }, undefined)).toEqual({ kind: 'start', enabled: false });
  });
});

describe('loading the data', () => {
  it('a rejecting openAppDb is an error value, not a throw; the library still lists lessons', async () => {
    const r = await loadRunnerData(() => Promise.reject(new Error('IndexedDB is not available')));
    expect(r.store).toBeUndefined();
    expect(r.data).toEqual({ kind: 'error', message: 'IndexedDB is not available' });
    expect(homeAction(lessons, lessons, r.data, undefined)).toEqual({ kind: 'start', enabled: false });
    expect(libraryGroups(lessons)).toHaveLength(3);
  });

  it('reads sessions and attempts from the store', async () => {
    const store: RunnerStore = {
      sessions: async () => [session({ id: 's' })],
      attempts: async () => [attempt({ mode: 'A0' })],
      putSession: async () => {},
      close: () => {},
    };
    const r = await loadRunnerData(async () => store);
    expect(r.data.kind).toBe('ready');
    if (r.data.kind === 'ready') expect([r.data.sessions.length, r.data.attempts.length]).toEqual([1, 1]);
  });

  it('a store that fails to read is an error and gets closed', async () => {
    let closed = false;
    const store: RunnerStore = {
      sessions: async () => {
        throw new Error('boom');
      },
      attempts: async () => [],
      putSession: async () => {},
      close: () => {
        closed = true;
      },
    };
    const r = await loadRunnerData(async () => store);
    expect(r.data).toEqual({ kind: 'error', message: 'boom' });
    expect(closed).toBe(true);
  });
});

describe('library', () => {
  it('groups by vector in level order and leaves out empty vectors', () => {
    const groups = libraryGroups([lesson('D', 0), lesson('A', 1), lesson('A', 0)]);
    expect(groups.map((g) => [g.vector, g.lessons.map((l) => l.id)])).toEqual([
      ['A', ['a0', 'a1']],
      ['D', ['d0']],
    ]);
  });

  it('offers a launch, a lock or a stub per drill step', () => {
    const row = [lesson('A', 0), lesson('A', 1), lesson('B', 0)];
    expect(drillOffer('progression-trainer', row[0]!, row, [], A_MODULES, false)).toBe('launch');
    expect(drillOffer('progression-trainer', row[1]!, row, [], A_MODULES, false)).toBe('locked');
    expect(drillOffer('progression-trainer', row[1]!, row, [], A_MODULES, true)).toBe('launch');
    expect(drillOffer('pocket-dojo', row[2]!, row, [], A_MODULES, true)).toBe('stub');
  });
});
