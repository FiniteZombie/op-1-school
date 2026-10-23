// A finished drill's records (plan decision 2) and saving them. With a
// `session` in the launch the attempt joins it and the session row is left to
// the Runner; without one the drill writes its own practice session.
import type { AppDB, Attempt, Session } from '../../state/db';
import type { DrillLaunch } from '../../types/drills';
import { LEVELS, type LevelId } from './levels';
import type { LevelResult } from './scoring';

export interface DrillRecords {
  attempt: Attempt;
  /** Only for a drill launched without a session. */
  session?: Session;
}

export function buildRecords(input: {
  launch: Pick<DrillLaunch, 'session' | 'lesson' | 'step' | 'progression'>;
  level: LevelId;
  result: LevelResult;
  /** When the drill first started (wall ms). */
  startedAt: number;
  /** When it finished (wall ms). */
  at: number;
  newId: () => string;
}): DrillRecords {
  const { launch, level, result, startedAt, at, newId } = input;
  const sessionId = launch.session ?? newId();
  const data: Record<string, unknown> = { ...result.data, progression: launch.progression };
  if (launch.step !== undefined) data.step = launch.step;
  const attempt: Attempt = { id: newId(), sessionId, module: 'progression-trainer', mode: level, at, data };
  if (result.score !== undefined) attempt.score = result.score;
  if (LEVELS[level].timed) attempt.offsets = result.offsets ?? [];
  if (launch.session !== undefined) return { attempt };
  const session: Session = {
    id: sessionId,
    kind: 'practice',
    lessonId: launch.lesson ?? 'practice',
    startedAt,
    finishedAt: at,
    scores: result.score !== undefined ? { [level]: result.score } : {},
  };
  return { attempt, session };
}

/** Where records go: `AppDB` in the app (`drillDbOf`), a fake in tests. */
export interface DrillDb {
  putAttempt(a: Attempt): Promise<unknown>;
  putSession(s: Session): Promise<unknown>;
}

export function drillDbOf(db: AppDB): DrillDb {
  return {
    putAttempt: (a) => db.put('attempts', a),
    putSession: (s) => db.put('sessions', s),
  };
}

export type SaverState = { kind: 'opening' } | { kind: 'ready' } | { kind: 'off'; message: string };

/**
 * Opens the database once. When opening rejects (no IndexedDB), saving is off
 * with the error's message and the drill runs anyway.
 */
export class DrillSaver {
  private st: SaverState = { kind: 'opening' };
  private readonly db: Promise<DrillDb | null>;

  constructor(open: () => Promise<DrillDb>) {
    this.db = open().then(
      (db) => {
        this.st = { kind: 'ready' };
        return db;
      },
      (err: unknown) => {
        this.st = { kind: 'off', message: err instanceof Error ? err.message : String(err) };
        return null;
      },
    );
  }

  state(): SaverState {
    return this.st;
  }

  /** Resolves once opening settles. */
  ready(): Promise<SaverState> {
    return this.db.then(() => this.st);
  }

  /** Writes the session (if any), then the attempt. `false` when saving is off. */
  async save(records: DrillRecords): Promise<boolean> {
    const db = await this.db;
    if (!db) return false;
    if (records.session) await db.putSession(records.session);
    await db.putAttempt(records.attempt);
    return true;
  }
}
