import type { InputSource, TimingOffset } from '../types/music';
import { openAppDb, type AppDB, type CalibrationRecord } from './db';

export type { CalibrationRecord } from './db';

/** SPEC §3.3: fewer hits than this don't make a calibration. */
export const MIN_CALIBRATION_HITS = 16;

/** The device key for a source with no named device: `screen` for touch, `default` for mic (placeholder). */
export function defaultDevice(source: InputSource): string {
  return source === 'touch' ? 'screen' : 'default';
}

/** Median; the mean of the middle two for an even count. */
export function median(values: readonly number[]): number {
  if (values.length === 0) throw new RangeError('median of no values');
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  const hi = s[mid] as number;
  return s.length % 2 === 1 ? hi : ((s[mid - 1] as number) + hi) / 2;
}

export interface CalibrationMeta {
  source: InputSource;
  device: string;
  outputLatencyMs: number;
  /** Defaults to `Date.now()`. */
  measuredAt?: number;
}

/** The median offset of the hits, as a record. Throws `RangeError` below 16 hits. */
export function computeCalibration(offsets: readonly TimingOffset[], meta: CalibrationMeta): CalibrationRecord {
  if (offsets.length < MIN_CALIBRATION_HITS) {
    throw new RangeError(`calibration needs at least ${MIN_CALIBRATION_HITS} hits, got ${offsets.length}`);
  }
  return {
    source: meta.source,
    device: meta.device,
    offsetMs: median(offsets.map((o) => o.offsetMs)),
    hits: offsets.length,
    measuredAt: meta.measuredAt ?? Date.now(),
    outputLatencyMs: meta.outputLatencyMs,
  };
}

/** The db is opened for the call when none is passed. */
async function withDb<T>(db: AppDB | undefined, fn: (db: AppDB) => Promise<T>): Promise<T> {
  if (db) return fn(db);
  const own = await openAppDb();
  try {
    return await fn(own);
  } finally {
    own.close();
  }
}

export function getCalibration(source: InputSource, device: string, db?: AppDB): Promise<CalibrationRecord | undefined> {
  return withDb(db, (d) => d.get('calibration', [source, device]));
}

export async function putCalibration(record: CalibrationRecord, db?: AppDB): Promise<void> {
  await withDb(db, (d) => d.put('calibration', record));
}

export function listCalibrations(db?: AppDB): Promise<CalibrationRecord[]> {
  return withDb(db, (d) => d.getAll('calibration'));
}
