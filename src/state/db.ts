import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { InputSource, TimingOffset } from '../types/music';

/** IndexedDB database name. */
export const DB_NAME = 'op-1-school';
/** Bump with a new `case` in `upgradeDb`; never edit an old case. */
export const DB_VERSION = 1;
/** The `app` field of an export envelope. */
export const EXPORT_APP = 'op-1-school';

// ---------------------------------------------------------------- records

// Phase 2's fields below are optional, so rows written before them still read
// and `DB_VERSION` stays 1.

export const SESSION_KINDS = ['daily', 'practice'] as const;
/** `daily`: the Runner's session. `practice`: one a module logs for a drill launched without a session. */
export type SessionKind = (typeof SESSION_KINDS)[number];

/** One lesson step's progress in a daily session, by the step's index in its lesson. */
export interface SessionStep {
  /** When the Runner launched this drill step; an attempt before it doesn't count. */
  launchedAt?: number;
  done?: boolean;
  skipped?: boolean;
}

/** One lesson in a daily session's plan. */
export interface SessionSegment {
  lessonId: string;
  startedAt: number;
  finishedAt?: number;
  skipped?: boolean;
  /** One entry per lesson step, by index. */
  steps?: SessionStep[];
}

export interface Session {
  id: string;
  /** `'daily'` for a daily session; a practice session's lesson, or `'practice'`. */
  lessonId: string;
  startedAt: number;
  finishedAt?: number;
  /** `{ <mode>: score }`: the best score per mode in a daily session, the drill's in a practice one. */
  scores: Record<string, number>;
  /** Absent reads as `daily`. */
  kind?: SessionKind;
  /** Daily sessions only. */
  segments?: SessionSegment[];
}

/**
 * One finished drill (never an abandoned one). Launched with a `session`,
 * `sessionId` is it and the module leaves the session row to the Runner;
 * without one, the module writes its own `practice` session for it.
 */
export interface Attempt {
  id: string;
  sessionId: string;
  module: string;
  /** The level id, `A0`…. */
  mode: string;
  at: number;
  /** 0..1; absent for an unscored drill. */
  score?: number;
  /** Timed levels. A tap on a pitchless pad has `note: PAD_NOTE` (`src/types/drills.ts`). */
  offsets?: TimingOffset[];
  /** The module's own detail, plus `step` copied from the launch when it has one. */
  data?: unknown;
}

/** Metadata only; the audio blob arrives with Module 2. */
export interface Sample {
  id: string;
  name: string;
  createdAt: number;
  key?: number;
  root?: number;
}

export interface Kit {
  id: string;
  name: string;
  createdAt: number;
  sliceCount: number;
}

export interface CalibrationRecord {
  source: InputSource;
  /** MIDI input name, `screen` for touch, `default` for mic (placeholder). */
  device: string;
  offsetMs: number;
  hits: number;
  measuredAt: number;
  outputLatencyMs: number;
}

/** A new id for a record (`crypto.randomUUID()`). */
export function newId(): string {
  return crypto.randomUUID();
}

// ----------------------------------------------------------------- schema

export interface Op1Schema extends DBSchema {
  sessions: { key: string; value: Session; indexes: { lessonId: string } };
  attempts: { key: string; value: Attempt; indexes: { sessionId: string } };
  samples: { key: string; value: Sample };
  kits: { key: string; value: Kit };
  calibration: { key: [string, string]; value: CalibrationRecord };
}

export type StoreName = keyof Op1Schema;
export type AppDB = IDBPDatabase<Op1Schema>;

export const STORE_NAMES: readonly StoreName[] = ['sessions', 'attempts', 'samples', 'kits', 'calibration'];

/** Stores in an export. `samples` is left out: blobs come later (SPEC §5.3). */
export const EXPORT_STORES = ['sessions', 'attempts', 'kits', 'calibration'] as const satisfies readonly StoreName[];
export type ExportStoreName = (typeof EXPORT_STORES)[number];

/** The slice of an object store the upgrade function uses (a recording fake in tests). */
export interface UpgradeStore {
  createIndex(name: string, keyPath: string, options?: { unique?: boolean }): unknown;
}
/** The slice of `IDBDatabase` the upgrade function uses. */
export interface UpgradeTarget {
  createObjectStore(name: string, options: { keyPath: string | string[] }): UpgradeStore;
}

/** Switch on `oldVersion`, each case falling through to the next. */
export function upgradeDb(db: UpgradeTarget, oldVersion: number): void {
  switch (oldVersion) {
    case 0: {
      db.createObjectStore('sessions', { keyPath: 'id' }).createIndex('lessonId', 'lessonId');
      db.createObjectStore('attempts', { keyPath: 'id' }).createIndex('sessionId', 'sessionId');
      db.createObjectStore('samples', { keyPath: 'id' });
      db.createObjectStore('kits', { keyPath: 'id' });
      db.createObjectStore('calibration', { keyPath: ['source', 'device'] });
    }
    // Version 2 adds `case 1:` after case 0's block, so an older database runs every later case.
  }
}

/** Opens (and, the first time, creates) the database. Rejects with a readable error without IndexedDB. */
export async function openAppDb(): Promise<AppDB> {
  if (typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB is not available in this browser, so progress cannot be saved');
  }
  return openDB<Op1Schema>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      upgradeDb(db as unknown as UpgradeTarget, oldVersion);
    },
  });
}

// ------------------------------------------------------- export / import

export interface ExportEnvelope {
  app: typeof EXPORT_APP;
  dbVersion: number;
  exportedAt: string;
  stores: Partial<Record<ExportStoreName, unknown[]>>;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Checks an envelope read from a file and returns it typed. Throws an `Error`
 * naming the field. Unknown stores (and `samples`) are ignored, not an error.
 */
export function parseExport(input: unknown): ExportEnvelope {
  if (!isObject(input)) throw new Error('import: the file is not a JSON object');
  if (input.app !== EXPORT_APP) {
    throw new Error(`import: app is ${JSON.stringify(input.app)}, expected "${EXPORT_APP}"`);
  }
  const v = input.dbVersion;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) {
    throw new Error(`import: dbVersion is ${JSON.stringify(v)}, expected a whole number from 1`);
  }
  if (v > DB_VERSION) {
    throw new Error(`import: dbVersion ${v} is newer than this app's ${DB_VERSION}`);
  }
  if (typeof input.exportedAt !== 'string') throw new Error('import: exportedAt is missing');
  if (!isObject(input.stores)) throw new Error('import: stores is missing');

  const stores: ExportEnvelope['stores'] = {};
  for (const name of EXPORT_STORES) {
    const rows = input.stores[name];
    if (rows === undefined) continue;
    if (!Array.isArray(rows)) throw new Error(`import: stores.${name} is not a list`);
    rows.forEach((row, i) => {
      if (!isObject(row)) throw new Error(`import: stores.${name}[${i}] is not an object`);
      const keys = name === 'calibration' ? ['source', 'device'] : ['id'];
      for (const k of keys) {
        if (typeof row[k] !== 'string' || row[k] === '') {
          throw new Error(`import: stores.${name}[${i}].${k} is missing`);
        }
      }
    });
    stores[name] = rows;
  }
  return { app: EXPORT_APP, dbVersion: v, exportedAt: input.exportedAt, stores };
}

/** Everything in `EXPORT_STORES`, as one envelope. */
export async function exportData(db: AppDB, now: Date = new Date()): Promise<ExportEnvelope> {
  const tx = db.transaction([...EXPORT_STORES], 'readonly');
  const stores: ExportEnvelope['stores'] = {};
  for (const name of EXPORT_STORES) stores[name] = await tx.objectStore(name).getAll();
  await tx.done;
  return { app: EXPORT_APP, dbVersion: DB_VERSION, exportedAt: now.toISOString(), stores };
}

/**
 * Replaces each store the envelope names with its rows, in one transaction
 * (all or nothing). Stores it doesn't name are untouched. Validates first.
 */
export async function importData(db: AppDB, input: unknown): Promise<void> {
  const env = parseExport(input);
  const names = EXPORT_STORES.filter((n) => env.stores[n] !== undefined);
  if (names.length === 0) return;
  const tx = db.transaction(names, 'readwrite');
  try {
    for (const name of names) {
      const store = tx.objectStore(name);
      await store.clear();
      for (const row of env.stores[name] ?? []) await store.put(row as never);
    }
    await tx.done;
  } catch (e) {
    try {
      tx.abort();
    } catch {
      // already finished or aborted
    }
    throw e;
  }
}
