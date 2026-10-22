import { describe, expect, test } from 'vitest';
import {
  DB_VERSION,
  exportData,
  importData,
  openAppDb,
  parseExport,
  upgradeDb,
  type AppDB,
  type UpgradeTarget,
} from '../db';

function recordingTarget() {
  const stores: { name: string; keyPath: string | string[]; indexes: { name: string; keyPath: string }[] }[] = [];
  const target: UpgradeTarget = {
    createObjectStore(name, options) {
      const entry = { name, keyPath: options.keyPath, indexes: [] as { name: string; keyPath: string }[] };
      stores.push(entry);
      return {
        createIndex(indexName, keyPath) {
          entry.indexes.push({ name: indexName, keyPath });
        },
      };
    },
  };
  return { stores, target };
}

describe('upgradeDb', () => {
  test('from version 0 creates all five stores with their key paths and indexes', () => {
    const { stores, target } = recordingTarget();
    upgradeDb(target, 0);
    expect(stores).toEqual([
      { name: 'sessions', keyPath: 'id', indexes: [{ name: 'lessonId', keyPath: 'lessonId' }] },
      { name: 'attempts', keyPath: 'id', indexes: [{ name: 'sessionId', keyPath: 'sessionId' }] },
      { name: 'samples', keyPath: 'id', indexes: [] },
      { name: 'kits', keyPath: 'id', indexes: [] },
      { name: 'calibration', keyPath: ['source', 'device'], indexes: [] },
    ]);
  });

  test('from the current version creates nothing', () => {
    const { stores, target } = recordingTarget();
    upgradeDb(target, DB_VERSION);
    expect(stores).toEqual([]);
  });
});

describe('openAppDb', () => {
  test('rejects with a readable error when there is no indexedDB global', async () => {
    expect((globalThis as { indexedDB?: unknown }).indexedDB).toBeUndefined();
    await expect(openAppDb()).rejects.toThrow(/IndexedDB is not available/);
  });
});

const envelope = () => ({
  app: 'op-1-school',
  dbVersion: 1,
  exportedAt: '2026-10-22T10:00:00.000Z',
  stores: {
    sessions: [{ id: 's1', lessonId: 'A0', startedAt: 1, scores: {} }],
    attempts: [{ id: 'a1', sessionId: 's1', module: 'x', mode: 'm', at: 2 }],
    kits: [],
    calibration: [{ source: 'touch', device: 'screen', offsetMs: 12, hits: 16, measuredAt: 3, outputLatencyMs: 40 }],
  },
});

describe('parseExport', () => {
  test('an envelope survives a JSON round trip through validation', () => {
    const env = envelope();
    const parsed = parseExport(JSON.parse(JSON.stringify(env)));
    expect(parsed).toEqual(env);
  });

  test('dbVersion 2 is rejected, naming dbVersion', () => {
    expect(() => parseExport({ ...envelope(), dbVersion: 2 })).toThrow(/dbVersion 2 is newer/);
  });

  test("app 'other' is rejected, naming app", () => {
    expect(() => parseExport({ ...envelope(), app: 'other' })).toThrow(/app is "other"/);
  });

  test('a missing key field names the store, row and field', () => {
    const env = envelope();
    env.stores.attempts = [{ sessionId: 's1' } as never];
    expect(() => parseExport(env)).toThrow(/stores\.attempts\[0\]\.id/);
  });

  test('unknown stores and samples are ignored', () => {
    const parsed = parseExport({ ...envelope(), stores: { ...envelope().stores, samples: [{ id: 'x' }], extra: 5 } });
    expect(Object.keys(parsed.stores).sort()).toEqual(['attempts', 'calibration', 'kits', 'sessions']);
  });
});

/** A minimal in-memory stand-in for the parts of `AppDB` that export/import use. */
function fakeDb(initial: Record<string, unknown[]>) {
  const data: Record<string, unknown[]> = structuredClone(initial);
  const log: string[] = [];
  const db = {
    transaction(names: string[]) {
      log.push(`tx ${names.join(',')}`);
      return {
        objectStore(name: string) {
          return {
            getAll: async () => [...(data[name] ?? [])],
            clear: async () => {
              data[name] = [];
            },
            put: async (row: unknown) => {
              (data[name] ??= []).push(row);
            },
          };
        },
        done: Promise.resolve(),
        abort() {
          log.push('abort');
        },
      };
    },
  };
  return { db: db as unknown as AppDB, data, log };
}

describe('exportData / importData', () => {
  test('import replaces the named stores in one transaction and leaves the rest', async () => {
    const { db, data, log } = fakeDb({
      sessions: [{ id: 'old', lessonId: 'A0', startedAt: 0, scores: {} }],
      attempts: [{ id: 'keep' }],
      samples: [{ id: 'sample' }],
    });
    await importData(db, { ...envelope(), stores: { sessions: envelope().stores.sessions, junk: [1] } });
    expect(log).toEqual(['tx sessions']);
    expect(data.sessions).toEqual(envelope().stores.sessions);
    expect(data.attempts).toEqual([{ id: 'keep' }]);
    expect(data.samples).toEqual([{ id: 'sample' }]);
  });

  test('an invalid envelope changes nothing', async () => {
    const { db, log } = fakeDb({});
    await expect(importData(db, { ...envelope(), app: 'other' })).rejects.toThrow(/app/);
    expect(log).toEqual([]);
  });

  test('export lists the four exported stores and leaves out samples', async () => {
    const { db } = fakeDb({ sessions: [{ id: 's' }], samples: [{ id: 'blob' }] });
    const env = await exportData(db, new Date('2026-10-22T10:00:00Z'));
    expect(env.app).toBe('op-1-school');
    expect(env.dbVersion).toBe(DB_VERSION);
    expect(env.exportedAt).toBe('2026-10-22T10:00:00.000Z');
    expect(Object.keys(env.stores).sort()).toEqual(['attempts', 'calibration', 'kits', 'sessions']);
  });
});
