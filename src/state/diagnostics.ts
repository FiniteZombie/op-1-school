/**
 * The diagnostics log: a ring of recent events with `performance.now()`
 * times, read by the bug report and `/dev/spine`'s `copy report`. Pure and
 * Tone-free (tested in `__tests__/diagnostics.test.ts`); the browser wiring
 * that feeds it is `src/ui/diagnosticsCapture.ts`. It holds nothing personal:
 * the repo, and so every bug report, is public.
 *
 * Log text stays ASCII: an issue URL spends 6 characters on each non-ASCII
 * one (`bugReportText.ts`).
 */

export const DIAGNOSTIC_KINDS = ['error', 'warn', 'audio', 'transport', 'beat', 'midi', 'page', 'route', 'note'] as const;
export type DiagnosticKind = (typeof DIAGNOSTIC_KINDS)[number];

export interface DiagnosticEntry {
  /** `performance.now()`, ms. */
  t: number;
  kind: DiagnosticKind;
  text: string;
  /** How many times this line came in a row (1 = once). */
  repeat: number;
}

export const LOG_CAPACITY = 400;
export const ENTRY_TEXT_MAX = 240;

export class DiagnosticsLog {
  private entries: DiagnosticEntry[] = [];

  constructor(
    private readonly now: () => number,
    private readonly capacity = LOG_CAPACITY,
  ) {}

  /** A repeat of the newest entry's kind and text bumps its `repeat` (keeping its first time). */
  add(kind: DiagnosticKind, text: string): void {
    const clipped = clipText(text);
    const last = this.entries[this.entries.length - 1];
    if (last && last.kind === kind && last.text === clipped) {
      last.repeat += 1;
      return;
    }
    this.entries.push({ t: this.now(), kind, text: clipped, repeat: 1 });
    if (this.entries.length > this.capacity) this.entries.splice(0, this.entries.length - this.capacity);
  }

  /** Oldest first; a copy. */
  snapshot(): DiagnosticEntry[] {
    return this.entries.map((e) => ({ ...e }));
  }
}

/** One line (newlines become ` / `), at most `ENTRY_TEXT_MAX` characters. */
export function clipText(text: string): string {
  const oneLine = text.trim().replace(/\s*\n\s*/g, ' / ');
  return oneLine.length <= ENTRY_TEXT_MAX ? oneLine : `${oneLine.slice(0, ENTRY_TEXT_MAX - 3)}...`;
}

/** `+12.345 s warn probe (x2)`. */
export function formatEntry(e: DiagnosticEntry): string {
  const times = e.repeat > 1 ? ` (x${e.repeat})` : '';
  return `+${(e.t / 1000).toFixed(3)} s ${e.kind} ${e.text}${times}`;
}

/** A console call's arguments as one line: errors as `Name: message`, objects as JSON where they can be. */
export function consoleText(args: readonly unknown[]): string {
  return args
    .map((a) => {
      if (typeof a === 'string') return a;
      if (a instanceof Error) return `${a.name}: ${a.message}`;
      if (typeof a === 'object' && a !== null) {
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      }
      return String(a);
    })
    .join(' ');
}

/** dB rounded, `-inf` for silence (Tone's meter reads `-Infinity`, or very low after a note dies). */
export function dbText(db: number): string {
  return Number.isFinite(db) && db > -100 ? String(Math.round(db)) : '-inf';
}

export interface Heartbeat {
  /** Sixteenths the transport called back for since the last heartbeat. */
  sixteenths: number;
  /** The last one's audio time, s; null if none yet since the start. */
  lastAudioTime: number | null;
  ctxTime: number;
  ctxState: string;
  /** One per live backing synth: each part's peak dB over the heartbeat, and the most chord voices seen. */
  synths: Array<{ levels: Record<string, number>; voices: number }>;
}

/** `8 last 12.30 ctx 12.41 running | drums -11 bass -16 chords -19 | voices 4`. */
export function formatHeartbeat(h: Heartbeat): string {
  const last = h.lastAudioTime === null ? '-' : h.lastAudioTime.toFixed(2);
  const head = `${h.sixteenths} last ${last} ctx ${h.ctxTime.toFixed(2)} ${h.ctxState}`;
  if (h.synths.length === 0) return `${head} | no backing`;
  const synths = h.synths.map((s) => {
    const levels = Object.entries(s.levels)
      .map(([part, db]) => `${part} ${dbText(db)}`)
      .join(' ');
    return `${levels} | voices ${s.voices}`;
  });
  return [head, ...synths].join(' | ');
}

/** The page's one log. */
export const diagnostics = new DiagnosticsLog(() => performance.now());
