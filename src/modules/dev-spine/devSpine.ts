/**
 * `/dev/spine`'s logic, pure (tested in `__tests__/devSpine.test.ts`): the
 * page's progression, the BPM encoder's mapping, the MIDI panel's status and
 * toggle rules, the readouts' text, the capped event log and the database
 * check. No Tone.js, no DOM: `View.tsx` wires these to the spine.
 */
import type { ClockSnapshot } from '../../audio/Clock';
import type { ClockMode, ClockStats, MidiAccessState, PortInfo } from '../../input/MidiBridge';
import { COPY } from '../../ui/copy';
import type { ProgressionSpec } from '../../types/lessons';
import type { NoteEvent } from '../../types/music';

/** F minor `ii°–V7–i–VI` at 90 BPM, swing 0.5, one bar per chord: Gdim, C7, Fm, D♭. */
export const DEV_PROGRESSION: ProgressionSpec = {
  id: 'dev-spine-fminor',
  key: { tonic: 5, mode: 'aeolian' },
  bpm: 90,
  swing: 0.5,
  bars: 4,
  slots: [
    { roman: 'ii°', beats: 4 },
    { roman: 'V7', beats: 4 },
    { roman: 'i', beats: 4 },
    { roman: 'VI', beats: 4 },
  ],
  style: 'chillhop-rhodes',
  // placeholder: the progression family (the plan leaves it to this row).
  family: 'dev',
};

// ------------------------------------------------------------------ labels

/** placeholder: every label on the page (plan pre-flight "R9 labels"), all lowercase. */
export const LABELS = {
  start: 'start',
  stop: 'stop',
  bpm: 'bpm',
  swing: 'swing',
  drums: 'drums',
  bass: 'bass',
  chords: 'chords',
  requestMidi: 'request midi',
  input: 'input',
  output: 'output',
  none: 'none',
  clockOut: 'clock out',
  follow: 'follow',
  dbOk: 'db ok',
  dbFailed: (error: string) => `db failed: ${error}`,
  log: 'log',
  panels: {
    transport: 'transport',
    chord: 'chord',
    keyboard: 'keyboard',
    midi: 'midi',
    clock: 'clock',
    midiTiming: 'midi timing',
    database: 'database',
  },
  // Not in the plan's list: neutral stand-ins (row 9's report asks the owner).
  /** placeholder: the database check's button. */
  dbCheck: 'write then read',
  /** placeholder: the database check while it runs. */
  dbRunning: 'checking',
  /** placeholder: the row's own text for a missing loopback. */
  noLoopback: 'no loopback',
  /** placeholder: MIDI access states with no settled copy. */
  midiUnrequested: 'midi not requested',
  midiPending: 'waiting for midi permission',
  midiGranted: 'midi ok',
  /** placeholder: the follower's readout. */
  follower: (bpm: number, confidence: number) => `in ${bpm > 0 ? bpm.toFixed(1) : '–'} bpm, confidence ${confidence.toFixed(2)}`,
  /** placeholder: the keyboard's out-of-range count. */
  outOfRange: (n: number) => `out of range ${n}`,
  /** placeholder: the log while empty. */
  logEmpty: 'no events yet',
} as const;

// --------------------------------------------------------------- encoders

export const BPM_ENCODER_MIN = 60;
export const BPM_ENCODER_MAX = 160;

/** The BPM encoder's 0..1 → an integer BPM in 60–160. */
export function bpmFromEncoder(v: number): number {
  const c = Math.min(1, Math.max(0, Number.isNaN(v) ? 0 : v));
  return Math.round(BPM_ENCODER_MIN + c * (BPM_ENCODER_MAX - BPM_ENCODER_MIN));
}

/** A BPM → the encoder's 0..1, clamped to the encoder's range (follow mode may set a BPM outside it). */
export function encoderFromBpm(bpm: number): number {
  return Math.min(1, Math.max(0, (bpm - BPM_ENCODER_MIN) / (BPM_ENCODER_MAX - BPM_ENCODER_MIN)));
}

// ---------------------------------------------------------- state colours

/**
 * State tones (AGENTS.md: blue = ok, red = bad, yellow = warning, gray =
 * neutral). Every status shows a word as well as its colour, and a mark
 * (`ok` ✓, `bad` ×, `warn` !, `neutral` ·), so none differs by hue alone.
 */
export type StatusTone = 'ok' | 'bad' | 'warn' | 'neutral';

export const STATUS_MARK: Record<StatusTone, string> = { ok: '✓', bad: '×', warn: '!', neutral: '·' };

export interface Status {
  tone: StatusTone;
  text: string;
}

// ------------------------------------------------------------------- midi

export interface MidiPanelState {
  access: MidiAccessState;
  inputs: readonly PortInfo[];
  outputs: readonly PortInfo[];
  selectedInput: PortInfo | null;
  selectedOutput: PortInfo | null;
  mode: ClockMode;
}

export interface MidiPanelView {
  status: Status;
  /** Show the `request midi` button. */
  canRequest: boolean;
  /** Show the port pickers. */
  showPickers: boolean;
  /** Clock out needs a selected output; follow needs a selected input. */
  clockOutDisabled: boolean;
  followDisabled: boolean;
  clockOutOn: boolean;
  followOn: boolean;
}

/** What the MIDI panel shows for a bridge state. */
export function midiPanelView(s: MidiPanelState): MidiPanelView {
  const granted = s.access === 'granted';
  const anyPort = s.inputs.length + s.outputs.length > 0;
  let status: Status;
  switch (s.access) {
    case 'unsupported':
      status = { tone: 'warn', text: COPY.midiUnsupported };
      break;
    case 'denied':
      status = { tone: 'bad', text: COPY.midiDenied };
      break;
    case 'unrequested':
      status = { tone: 'neutral', text: LABELS.midiUnrequested };
      break;
    case 'pending':
      status = { tone: 'neutral', text: LABELS.midiPending };
      break;
    case 'granted':
      status = anyPort ? { tone: 'ok', text: LABELS.midiGranted } : { tone: 'warn', text: COPY.noMidi };
      break;
  }
  return {
    status,
    canRequest: s.access === 'unrequested',
    showPickers: granted && anyPort,
    clockOutDisabled: !granted || s.selectedOutput === null,
    followDisabled: !granted || s.selectedInput === null,
    clockOutOn: s.mode === 'clock out',
    followOn: s.mode === 'follow',
  };
}

// ---------------------------------------------------------------- readouts

function ms(v: number | null, digits = 1): string {
  return v === null || !Number.isFinite(v) ? '–' : `${v.toFixed(digits)} ms`;
}

/** Decision 7's readout as label/value rows (the labels are the snapshot's field names). */
export function clockRows(s: ClockSnapshot): Array<[string, string]> {
  return [
    ['currentTime', `${s.currentTime.toFixed(3)} s`],
    ['contextTime', s.outputContextTime === null ? '–' : `${s.outputContextTime.toFixed(3)} s`],
    ['gap', ms(s.gapMs)],
    ['outputLatency', ms(s.outputLatencyMs)],
    ['baseLatency', ms(s.baseLatencyMs)],
    ['path', s.path],
    ['getOutputTimestamp', s.hasGetOutputTimestamp ? 'yes' : 'no'],
    ['outputLatency present', s.hasOutputLatency ? 'yes' : 'no'],
    ['fit pairs', String(s.fitPairs)],
  ];
}

/** Decision 8's readout: headroom over the last sends, and loopback or `no loopback`. */
export function timingRows(s: ClockStats): Array<[string, string]> {
  const rows: Array<[string, string]> = [
    ['sends', String(s.sends)],
    ['headroom min / p5 / p50', `${ms(s.headroomMinMs, 2)} / ${ms(s.headroomP5Ms, 2)} / ${ms(s.headroomP50Ms, 2)}`],
    ['late', String(s.late)],
  ];
  if (s.loopback === null) rows.push(['loopback', LABELS.noLoopback]);
  else
    rows.push(
      ['loopback count', String(s.loopback.count)],
      ['loopback |error| p50 / p95', `${ms(s.loopback.absErrorP50Ms, 2)} / ${ms(s.loopback.absErrorP95Ms, 2)}`],
      ['loopback jitter p95', ms(s.loopback.jitterP95Ms, 2)],
    );
  return rows;
}

// --------------------------------------------------------------------- log

/** The log keeps this many lines. */
export const LOG_CAP = 200;

/** One raw `NoteEvent`: source, kind, note, velocity, `perfTs`. */
export function formatNoteEvent(e: NoteEvent): string {
  return `${e.source} ${e.kind} ${e.note} v${e.velocity.toFixed(2)} ${e.perfTs.toFixed(1)}`;
}

/** `lines` plus `line`, keeping the newest `cap`. */
export function appendCapped<T>(lines: readonly T[], line: T, cap: number = LOG_CAP): T[] {
  const next = [...lines, line];
  return next.length > cap ? next.slice(next.length - cap) : next;
}

// ---------------------------------------------------------------- database

/** The id the database check writes to `attempts`, reads back, then deletes. */
export const DB_CHECK_ID = 'dev-spine-check';

/** The record the check writes. */
export interface DbCheckRecord {
  id: string;
  sessionId: string;
  module: string;
  mode: string;
  at: number;
}

/** The slice of `AppDB` the check uses. */
export interface DbCheckTarget {
  put(store: 'attempts', value: DbCheckRecord): Promise<unknown>;
  get(store: 'attempts', key: string): Promise<unknown>;
  delete(store: 'attempts', key: string): Promise<unknown>;
}

/** Writes `dev-spine-check`, reads it back, deletes it. `db ok`, or `db failed: <error>`. */
export async function runDbCheck(db: DbCheckTarget, now: number = Date.now()): Promise<Status> {
  const record: DbCheckRecord = { id: DB_CHECK_ID, sessionId: 'dev-spine', module: 'dev-spine', mode: 'check', at: now };
  try {
    await db.put('attempts', record);
    const back = (await db.get('attempts', DB_CHECK_ID)) as Partial<DbCheckRecord> | undefined;
    await db.delete('attempts', DB_CHECK_ID);
    if (!back || back.id !== DB_CHECK_ID || back.at !== now) {
      return { tone: 'bad', text: LABELS.dbFailed('read back a different record') };
    }
    if ((await db.get('attempts', DB_CHECK_ID)) !== undefined) {
      return { tone: 'bad', text: LABELS.dbFailed('the record was not deleted') };
    }
    return { tone: 'ok', text: LABELS.dbOk };
  } catch (err) {
    return { tone: 'bad', text: LABELS.dbFailed(errorText(err)) };
  }
}

export function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
