/**
 * `/dev/spine`'s probe, pure (tested in `__tests__/probeReport.test.ts`):
 * per-port tallies of incoming MIDI by kind, the clock rate they imply, and
 * the plain-text report the `copy report` button puts on the clipboard. The
 * Web MIDI side is `liveProbe.ts`.
 */

// placeholder: every probe label below is temporary until the owner decides.
export const PROBE_LABELS = {
  panel: 'probe',
  copy: 'copy report',
  copied: 'report copied',
  copyFailed: (error: string) => `copy failed (${error}): select the report text below`,
  testNote: 'send test note',
  reportText: 'report text',
  noPorts: 'no ports',
  probeOff: 'midi not granted',
  probeFailed: (error: string) => `probe failed: ${error}`,
} as const;

export type MessageKind = 'note' | 'clock' | 'transport' | 'activeSensing' | 'other';

const KIND_NAMES: Record<MessageKind, string> = {
  note: 'note',
  clock: 'clock',
  transport: 'start/stop',
  activeSensing: 'active sensing',
  other: 'other',
};

export function messageKind(status: number): MessageKind {
  if (status === 0xf8) return 'clock';
  if (status === 0xfa || status === 0xfb || status === 0xfc) return 'transport';
  if (status === 0xfe) return 'activeSensing';
  const type = status & 0xf0;
  return type === 0x80 || type === 0x90 ? 'note' : 'other';
}

/** Clock stamps kept per port: four beats, as the follower uses. */
export const CLOCK_WINDOW = 96;
const PULSES_PER_BEAT = 24;

export interface PortTally {
  total: number;
  counts: Record<MessageKind, number>;
  /** The newest `CLOCK_WINDOW` `F8` timestamps (ms). */
  clockStamps: number[];
  last: { hex: string; perfTs: number } | null;
}

export function emptyTally(): PortTally {
  return { total: 0, counts: { note: 0, clock: 0, transport: 0, activeSensing: 0, other: 0 }, clockStamps: [], last: null };
}

/** Counts one message into `t` (mutates it). Empty messages are ignored. */
export function tallyMessage(t: PortTally, data: ArrayLike<number>, perfTs: number): MessageKind | null {
  if (data.length === 0) return null;
  const kind = messageKind(data[0] as number);
  t.total += 1;
  t.counts[kind] += 1;
  t.last = { hex: hex(data), perfTs };
  if (kind === 'clock') {
    t.clockStamps.push(perfTs);
    if (t.clockStamps.length > CLOCK_WINDOW) t.clockStamps.splice(0, t.clockStamps.length - CLOCK_WINDOW);
  }
  return kind;
}

export function hex(data: ArrayLike<number>): string {
  return Array.from(data, (b) => b.toString(16).padStart(2, '0')).join(' ');
}

/** BPM from the first and last of the stamps; null under one beat of pulses. */
export function clockRateBpm(stamps: readonly number[]): number | null {
  if (stamps.length < PULSES_PER_BEAT + 1) return null;
  const span = (stamps[stamps.length - 1] as number) - (stamps[0] as number);
  if (!(span > 0)) return null;
  return ((stamps.length - 1) * 60_000) / (PULSES_PER_BEAT * span);
}

// ----------------------------------------------------------------- report

export interface ProbePort {
  type: 'input' | 'output';
  id: string;
  name: string;
  manufacturer: string;
  state: string;
  connection: string;
  /** Inputs only. */
  tally?: PortTally;
}

export interface RecentMessage {
  perfTs: number;
  port: string;
  hex: string;
}

export interface ProbeReport {
  at: string;
  userAgent: string;
  sections: Array<[string, Array<[string, string]>]>;
  /** A string, saying why, when the probe has no MIDI access. */
  ports: ProbePort[] | string;
  recent: RecentMessage[];
  /** The diagnostics log's formatted lines, oldest first. */
  log?: string[];
}

/** One input's message counts, e.g. `messages 120: note 4, clock 110, …`. */
export function tallyLine(t: PortTally): string {
  const kinds = (Object.keys(KIND_NAMES) as MessageKind[]).map((k) => `${KIND_NAMES[k]} ${t.counts[k]}`);
  return `messages ${t.total}: ${kinds.join(', ')}`;
}

function portLines(p: ProbePort): string[] {
  const lines = [`${p.name} · ${p.manufacturer || 'no manufacturer'} · ${p.state}/${p.connection} · id ${p.id}`];
  if (p.tally) {
    lines.push(`  ${tallyLine(p.tally)}`);
    const bpm = clockRateBpm(p.tally.clockStamps);
    const last = p.tally.last ? `last ${p.tally.last.hex} at ${p.tally.last.perfTs.toFixed(1)} ms` : 'nothing received';
    lines.push(`  clock rate ${bpm === null ? '–' : `${bpm.toFixed(2)} bpm`} · ${last}`);
  }
  return lines;
}

export function formatProbeReport(r: ProbeReport): string {
  const out = [`dev spine report · ${r.at}`, r.userAgent];
  for (const [title, rows] of r.sections) {
    out.push('', `[${title}]`, ...rows.map(([k, v]) => `${k}: ${v}`));
  }
  if (typeof r.ports === 'string') {
    out.push('', '[ports]', r.ports);
  } else {
    for (const type of ['input', 'output'] as const) {
      const ports = r.ports.filter((p) => p.type === type);
      out.push('', `[${type}s]`, ...(ports.length === 0 ? [PROBE_LABELS.noPorts] : ports.flatMap(portLines)));
    }
  }
  out.push('', '[recent, without clock and active sensing]');
  out.push(...(r.recent.length === 0 ? ['none'] : r.recent.map((m) => `${m.perfTs.toFixed(1)} ${m.port} ${m.hex}`)));
  if (r.log) out.push('', '[log, oldest first]', ...(r.log.length === 0 ? ['none'] : r.log));
  return out.join('\n');
}
