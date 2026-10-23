// The Runner's slice of the database, behind an interface so a rejecting
// `openAppDb()` is testable without IndexedDB.

import { openAppDb } from '../../state/db';
import type { Attempt, Session } from '../../state/db';

export interface RunnerStore {
  sessions(): Promise<Session[]>;
  attempts(): Promise<Attempt[]>;
  putSession(session: Session): Promise<void>;
  close(): void;
}

export async function openRunnerStore(): Promise<RunnerStore> {
  const db = await openAppDb();
  return {
    sessions: () => db.getAll('sessions'),
    attempts: () => db.getAll('attempts'),
    putSession: async (s) => {
      await db.put('sessions', s);
    },
    close: () => db.close(),
  };
}

export type RunnerData =
  | { kind: 'loading' }
  | { kind: 'ready'; sessions: Session[]; attempts: Attempt[] }
  | { kind: 'error'; message: string };

export function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Opens the store and reads everything; a failure is data (`error`), never thrown. */
export async function loadRunnerData(
  open: () => Promise<RunnerStore>,
): Promise<{ store: RunnerStore; data: RunnerData & { kind: 'ready' } } | { store: undefined; data: RunnerData & { kind: 'error' } }> {
  let store: RunnerStore;
  try {
    store = await open();
  } catch (err) {
    return { store: undefined, data: { kind: 'error', message: errorText(err) } };
  }
  try {
    const [sessions, attempts] = await Promise.all([store.sessions(), store.attempts()]);
    return { store, data: { kind: 'ready', sessions, attempts } };
  } catch (err) {
    store.close();
    return { store: undefined, data: { kind: 'error', message: errorText(err) } };
  }
}
