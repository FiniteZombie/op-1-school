// Loads the sessions and attempts once (opening the database), reconciles
// today's open session against the attempts, and saves every session change.

import { useCallback, useEffect, useRef, useState } from 'react';
import { lessonById } from '../../curriculum';
import type { Session } from '../../state/db';
import { openSessionToday, reconcile } from './session';
import { loadRunnerData, openRunnerStore, type RunnerData, type RunnerStore } from './store';

export interface RunnerHandle {
  data: RunnerData;
  /** Reconciles, saves and returns the session; rejects if the write fails. */
  update(session: Session): Promise<Session>;
}

export function useRunnerData(): RunnerHandle {
  const [data, setData] = useState<RunnerData>({ kind: 'loading' });
  const storeRef = useRef<RunnerStore | undefined>(undefined);
  const dataRef = useRef<RunnerData>(data);
  dataRef.current = data;

  useEffect(() => {
    let live = true;
    void (async () => {
      const loaded = await loadRunnerData(openRunnerStore);
      if (!live) {
        loaded.store?.close();
        return;
      }
      if (!loaded.store) {
        setData(loaded.data);
        return;
      }
      storeRef.current = loaded.store;
      const { sessions, attempts } = loaded.data;
      const open = openSessionToday(sessions, Date.now());
      if (open) {
        const next = reconcile(open, attempts, lessonById, Date.now());
        if (next !== open) {
          try {
            await loaded.store.putSession(next);
            sessions[sessions.indexOf(open)] = next;
          } catch (err) {
            console.error('runner: could not save the reconciled session', err);
          }
        }
      }
      if (live) setData({ kind: 'ready', sessions, attempts });
    })();
    return () => {
      live = false;
      storeRef.current?.close();
      storeRef.current = undefined;
    };
  }, []);

  const update = useCallback(async (session: Session): Promise<Session> => {
    const store = storeRef.current;
    const cur = dataRef.current;
    if (!store || cur.kind !== 'ready') throw new Error('database is not open');
    const next = reconcile(session, cur.attempts, lessonById, Date.now());
    await store.putSession(next);
    const rest = cur.sessions.filter((s) => s.id !== next.id);
    setData({ kind: 'ready', sessions: [...rest, next], attempts: cur.attempts });
    return next;
  }, []);

  return { data, update };
}
