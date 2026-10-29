/**
 * Feeds the diagnostics log (`src/state/diagnostics.ts`) from the browser and
 * the spine, and builds the bug report's header. Thin wiring, checked on
 * `/dev/spine`: the formatting it calls is tested.
 *
 * - `installGlobalCapture()` runs from `main.tsx` before React, so errors
 *   during the first render are caught. It wraps `console.error` and
 *   `console.warn` (Tone's warnings read `console.warn` at call time, so
 *   they're caught too) and passes every call through.
 * - `watchSpine()` runs once from `createSpine()`.
 */
import type * as Tone from 'tone';
import { liveBackingProbes } from '../audio/VirtualPushSynth';
import type { TransportEngine } from '../audio/TransportEngine';
import type { MidiBridge } from '../input/MidiBridge';
import { consoleText, diagnostics, formatHeartbeat, type DiagnosticsLog } from '../state/diagnostics';
import { browserOf, platformOf } from './bugReportText';

/** The heartbeat's sampling: levels every 100 ms, a line every 10 samples (1 s). */
const SAMPLE_MS = 100;
const SAMPLES_PER_BEAT_LINE = 10;

let globalInstalled = false;

export function installGlobalCapture(log: DiagnosticsLog = diagnostics): void {
  if (globalInstalled) return;
  globalInstalled = true;

  for (const level of ['error', 'warn'] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      try {
        log.add(level, consoleText(args));
      } catch {
        // The log must never break a console call.
      }
      original(...args);
    };
  }

  window.addEventListener('error', (e) => {
    const where = e.filename ? ` at ${e.filename.split('/').pop() ?? ''}:${e.lineno}:${e.colno}` : '';
    log.add('error', `uncaught ${e.message}${where}`);
  });
  window.addEventListener('unhandledrejection', (e) => {
    log.add('error', `unhandled rejection ${consoleText([e.reason])}`);
  });
  document.addEventListener('visibilitychange', () => log.add('page', document.visibilityState));
  // Chrome's page lifecycle: a frozen tab runs no timers or audio callbacks.
  document.addEventListener('freeze', () => log.add('page', 'frozen'));
  document.addEventListener('resume', () => log.add('page', 'resumed'));
  log.add('page', `loaded, ${document.visibilityState}`);
}

let lastRoute: string | null = null;

/** Logs a route once per change (StrictMode runs effects twice). */
export function logRoute(route: string, log: DiagnosticsLog = diagnostics): void {
  if (route === lastRoute) return;
  lastRoute = route;
  log.add('route', route);
}

interface Watched {
  toneContext: Tone.Context;
  transport: TransportEngine;
  midi: MidiBridge;
}

export function watchSpine({ toneContext, transport, midi }: Watched, log: DiagnosticsLog = diagnostics): void {
  toneContext.on('statechange', () => {
    log.add('audio', `context ${toneContext.state} at ${toneContext.currentTime.toFixed(3)}`);
  });

  let sixteenths = 0;
  let lastAudioTime: number | null = null;
  let samples = 0;
  let peaks = new Map<object, { levels: Record<string, number>; voices: number }>();
  let timer: ReturnType<typeof setInterval> | null = null;

  function sample(): void {
    for (const probe of liveBackingProbes()) {
      const levels = probe.levels();
      const voices = probe.chordVoices();
      const peak = peaks.get(probe);
      if (!peak) {
        peaks.set(probe, { levels: { ...levels }, voices });
        continue;
      }
      for (const [part, db] of Object.entries(levels)) peak.levels[part] = Math.max(peak.levels[part] ?? -Infinity, db);
      peak.voices = Math.max(peak.voices, voices);
    }
    samples += 1;
    if (samples >= SAMPLES_PER_BEAT_LINE) writeBeat();
  }

  function writeBeat(): void {
    log.add(
      'beat',
      formatHeartbeat({
        sixteenths,
        lastAudioTime,
        ctxTime: toneContext.currentTime,
        ctxState: toneContext.state,
        synths: [...peaks.values()],
      }),
    );
    sixteenths = 0;
    samples = 0;
    peaks = new Map();
  }

  transport.onSixteenth((e) => {
    sixteenths += 1;
    lastAudioTime = e.audioTime;
  });
  transport.onStateChange((e) => {
    log.add('transport', `${e.state} at ${e.audioTime.toFixed(3)}, ${transport.bpm()} bpm`);
    if (e.state === 'started') {
      sixteenths = 0;
      lastAudioTime = null;
      samples = 0;
      peaks = new Map();
      timer ??= setInterval(sample, SAMPLE_MS);
    } else if (timer !== null) {
      clearInterval(timer);
      timer = null;
      if (samples > 0) writeBeat();
    }
  });

  midi.onConnectionChange((e) => {
    if (e.type === 'port') log.add('midi', `${e.kind} ${e.port.name} ${e.state}`);
    else log.add('midi', `selected in ${e.input?.name ?? 'none'}, out ${e.output?.name ?? 'none'}`);
  });
  midi.onClockModeChange((mode) => log.add('midi', `clock mode ${mode}`));
}

interface HeaderSources extends Watched {
  gate: string;
  page: string;
}

/** The report's header rows (decision 5 of `.agents/plans/bug-report.md`). Port names only, never ids. */
export function reportHeader({ toneContext, transport, midi, gate, page }: HeaderSources): Array<[string, string]> {
  const ua = navigator.userAgent;
  const raw = toneContext.rawContext as unknown as Partial<AudioContext>;
  const latency = (v: number | undefined) => (v === undefined ? '-' : `${v.toFixed(3)} s`);
  const sel = midi.selected();
  return [
    ['commit', __APP_COMMIT__],
    ['at', new Date().toISOString()],
    ['page', page],
    ['browser', `${browserOf(ua)}, ${platformOf(ua)}`],
    [
      'screen',
      `${screen.width}x${screen.height} @${window.devicePixelRatio.toFixed(2)}, viewport ${window.innerWidth}x${window.innerHeight}`,
    ],
    [
      'audio',
      `${toneContext.state}, ${toneContext.sampleRate} Hz, out ${latency(raw.outputLatency)}, base ${latency(raw.baseLatency)}, t ${toneContext.currentTime.toFixed(3)}`,
    ],
    ['gate', gate],
    ['transport', `${transport.state()}, ${transport.bpm()} bpm`],
    [
      'midi',
      `${midi.accessState()}, in ${sel.input?.name ?? 'none'}, out ${sel.output?.name ?? 'none'}, ${midi.clockMode()}`,
    ],
  ];
}
