/**
 * Web MIDI (SPEC §5.3): access, port selection, note input, clock out
 * (SPEC §3.4), clock in and follow mode (SPEC §3.5), and the clock-out timing
 * telemetry `/dev/spine` shows (decision 8).
 *
 * Web MIDI is reached through the small structural `Midi*Like` types below,
 * so tests pass fakes (`src/input/__fakes__`). This file imports only types
 * from `TransportEngine.ts` (it imports Tone) and stays Tone-free.
 *
 * Rules from the plan (`.agents/plans/phase-1-spine.md`, pre-flight answers):
 * - No sysex. No port is picked by guessing its name (the Field's port name is
 *   VERIFY V7): with nothing remembered, nothing is selected. A remembered port
 *   is reselected when access is granted or when it reappears, by id, then by
 *   name.
 * - Notes from any channel; note-on velocity 0 is an `off`; velocity is
 *   `v / 127`; `perfTs` is the event's `timeStamp`.
 * - Clock out and follow are mutually exclusive; turning one on turns the
 *   other off. `clockMode()` and `onClockModeChange` feed the StatusBar.
 */
import type { ClockBridge } from '../audio/Clock';
import type { TransportEngine, TransportStateChange } from '../audio/TransportEngine';
import { BPM_MAX, BPM_MIN, loopTicks } from '../audio/timing';
import type { NoteEvent, Unsubscribe } from '../types/music';
import { median, PulseClockFollower, type ExternalClockFollower } from './ClockFollower';
import { Listeners, type NoteInputSource } from './NoteInput';

export type { ClockEstimate, ExternalClockFollower } from './ClockFollower';
export { PulseClockFollower } from './ClockFollower';

// ---------------------------------------------------------------------------
// Web MIDI, structurally

export interface MidiMessageLike {
  readonly data: Uint8Array | null;
  readonly timeStamp: number;
}

export interface MidiPortLike {
  readonly id: string;
  readonly name: string | null;
  readonly manufacturer?: string | null;
  /** `'connected' | 'disconnected'`. */
  readonly state: string;
  open?(): Promise<unknown>;
}

export interface MidiInputLike extends MidiPortLike {
  addEventListener(type: 'midimessage', listener: (e: MidiMessageLike) => void): void;
  removeEventListener(type: 'midimessage', listener: (e: MidiMessageLike) => void): void;
}

export interface MidiOutputLike extends MidiPortLike {
  send(data: number[], timestamp?: number): void;
}

export interface MidiConnectionEventLike {
  readonly port: MidiPortLike | null;
}

export interface MidiAccessLike {
  readonly inputs: { forEach(cb: (port: MidiInputLike) => void): void };
  readonly outputs: { forEach(cb: (port: MidiOutputLike) => void): void };
  addEventListener(type: 'statechange', listener: (e: MidiConnectionEventLike) => void): void;
  removeEventListener(type: 'statechange', listener: (e: MidiConnectionEventLike) => void): void;
}

export interface MidiNavigatorLike {
  requestMIDIAccess?(options?: { sysex?: boolean }): Promise<MidiAccessLike>;
}

// The real Web MIDI types must fit the structural ones (a compile-time check).
type Fits<T extends U, U> = T;
export type RealMidiFits = [Fits<MIDIAccess, MidiAccessLike>, Fits<MIDIInput, MidiInputLike>, Fits<MIDIOutput, MidiOutputLike>];

// ---------------------------------------------------------------------------
// Public types

export interface PortInfo {
  id: string;
  /** The port's name, or its id when it has none. */
  name: string;
  manufacturer: string;
}

/** What `PortMemory` stores per side (row 7's settings hold `{ id, name }`). */
export interface PortRef {
  id: string;
  name: string;
}

export interface StoredPorts {
  input?: PortRef | null;
  output?: PortRef | null;
}

/** Where the port selection persists; row 8 wires it to settings. */
export interface PortMemory {
  load(): StoredPorts;
  save(ports: { input: PortRef | null; output: PortRef | null }): void;
}

export type MidiAccessResult = 'granted' | 'denied' | 'unsupported';
export type MidiAccessState = 'unrequested' | 'pending' | MidiAccessResult;

/** The StatusBar's clock mode, as SPEC §5.4 spells it. */
export type ClockMode = 'internal' | 'clock out' | 'follow';

export type MidiConnectionChange =
  /** A port appeared or went away (also sent for every port present when access is granted). */
  | { type: 'port'; kind: 'input' | 'output'; port: PortInfo; state: 'connected' | 'disconnected' }
  /** The selected ports changed, by `select`, by reselection or by a disconnect. */
  | { type: 'selection'; input: PortInfo | null; output: PortInfo | null };

/** Decision 8's clock-out telemetry over the last `STATS_WINDOW` sends. All ms. */
export interface ClockStats {
  sends: number;
  /** Intended send time − `performance.now()` at the `send` call; negative is late. Null with no sends. */
  headroomMinMs: number | null;
  headroomP5Ms: number | null;
  headroomP50Ms: number | null;
  /** Sends with negative headroom. */
  late: number;
  /** Clock out coming back on the selected input; null until an `F8` has. */
  loopback: {
    count: number;
    /** |arrival − intended|. */
    absErrorP50Ms: number;
    absErrorP95Ms: number;
    /** |error − median error|: the jitter, with a constant loopback latency removed. */
    jitterP95Ms: number;
  } | null;
}

export interface MidiBridge extends NoteInputSource {
  readonly id: 'midi';
  /** Asks once (no sysex) and caches the answer. Call from a user gesture. */
  requestAccess(): Promise<MidiAccessResult>;
  accessState(): MidiAccessState;
  /** Connected ports. The Field shows up by name, but the user picks. */
  ports(): { inputs: PortInfo[]; outputs: PortInfo[] };
  /** Port ids; undefined (or an id that isn't connected) selects none on that side. Persists through `PortMemory`. */
  select(input?: string, output?: string): void;
  selected(): { input: PortInfo | null; output: PortInfo | null };
  /** SPEC §3.4. A no-op with no output selected. See the class for timing. */
  clockOut(enabled: boolean, transport: TransportEngine, clock: ClockBridge): void;
  /** SPEC §3.5: set the transport's BPM from incoming clock. A no-op with no input selected. */
  follow(enabled: boolean, transport: TransportEngine): void;
  clockMode(): ClockMode;
  onClockModeChange(cb: (mode: ClockMode) => void): Unsubscribe;
  follower(): ExternalClockFollower;
  clockStats(): ClockStats;
  /** Every `0xF8` on the selected input, at its `timeStamp`. */
  onClockIn(cb: (perfTs: number) => void): Unsubscribe;
  onConnectionChange(cb: (e: MidiConnectionChange) => void): Unsubscribe;
  dispose(): void;
}

// ---------------------------------------------------------------------------
// Constants and helpers

export const STATUS_CLOCK = 0xf8;
export const STATUS_START = 0xfa;
export const STATUS_CONTINUE = 0xfb;
export const STATUS_STOP = 0xfc;
export const STATUS_SPP = 0xf2;

/** Sends (and loopback matches) the telemetry keeps. */
export const STATS_WINDOW = 1000;
/** Follow mode applies an estimate only at or above this confidence. */
export const FOLLOW_MIN_CONFIDENCE = 0.8;
/** A looped-back `F8` arriving this much before its intended time is not ours. */
const LOOPBACK_EARLY_MS = 5;
/** Sent `F8`s older than this when an `F8` arrives are counted lost. */
const LOOPBACK_MAX_MS = 250;

const PULSES_PER_BEAT = 24;

/** Nearest-rank percentile (p in 0..100) of unsorted values; NaN when empty. */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * s.length);
  return s[Math.min(s.length - 1, Math.max(0, rank - 1))] as number;
}

function portInfo(p: MidiPortLike): PortInfo {
  return { id: p.id, name: p.name || p.id, manufacturer: p.manufacturer ?? '' };
}

function sameInfo(a: PortInfo | null, b: PortInfo | null): boolean {
  return a?.id === b?.id;
}

class Ring {
  private values: number[] = [];

  constructor(private readonly size: number) {}

  push(v: number): void {
    this.values.push(v);
    if (this.values.length > this.size) this.values.splice(0, this.values.length - this.size);
  }

  all(): readonly number[] {
    return this.values;
  }
}

interface ClockOutSession {
  transport: TransportEngine;
  clock: ClockBridge;
  unsubs: Unsubscribe[];
  /** `F2`/`FA` go out with the next pulse on an in-loop tick 0. */
  pendingStart: boolean;
}

interface FollowSession {
  transport: TransportEngine;
  /** Pulses since the BPM was last applied; starts at a beat so the first estimate applies at once. */
  pulsesSinceApply: number;
}

export interface WebMidiBridgeOptions {
  /** Defaults to `globalThis.navigator`. */
  navigator?: MidiNavigatorLike;
  memory?: PortMemory;
  /** Defaults to `performance.now()`. */
  perfNow?: () => number;
}

// ---------------------------------------------------------------------------
// The bridge

/**
 * `MidiBridge` over Web MIDI.
 *
 * Clock out (SPEC §3.4, pre-flight answers):
 * - On transport start, `F2 00 00` (song position 0) and `FA`, both stamped
 *   `audioToPerf` of tick 0, then the tick-0 `F8`; every pulse is `F8` at
 *   `audioToPerf(audioTime)`, unswung. Pulses only while running.
 * - Turned on while running: pulses from the next pulse, `F2`/`FA` at the next
 *   bar-1 downbeat (in-loop tick 0).
 * - On transport stop, `FC` stamped `audioToPerf(stopped.audioTime)`. Tone's
 *   stop time is after every pulse already handed out, so no `F8` is stamped
 *   after the `FC` (the stamp is also never earlier than the last `F8`'s).
 * - Turned off while running: `FC` at `performance.now()` or the last `F8`'s
 *   stamp, whichever is later.
 * - The selected output disconnecting turns clock out off quietly (no `FC`);
 *   selecting a different output (or none) turns it off with an `FC` to the
 *   old one if the transport is running.
 * - VERIFY V6 (stubbed here): whether the Field needs clock before `FA` to
 *   lock tempo on bar 1. Built as SPEC §3.4 says: no pulses before `FA` on a
 *   transport start.
 *
 * Follow (SPEC §3.5): every `F8` on the selected input feeds the follower;
 * in follow mode the transport's BPM is set from it when confidence ≥ 0.8, at
 * most once a beat (24 pulses), clamped to 30–300. The selected input
 * disconnecting, or a different input being selected, turns follow off.
 */
export class WebMidiBridge implements MidiBridge {
  readonly id = 'midi' as const;

  private readonly nav: MidiNavigatorLike | undefined;
  private readonly memory: PortMemory | undefined;
  private readonly perfNow: () => number;

  private access: MidiAccessLike | null = null;
  private accessStateValue: MidiAccessState = 'unrequested';
  private accessPromise: Promise<MidiAccessResult> | null = null;

  private input: MidiInputLike | null = null;
  private output: MidiOutputLike | null = null;
  private remembered: { input: PortRef | null; output: PortRef | null } = { input: null, output: null };
  private readonly portStates = new Map<string, string>();

  private running = false;
  private readonly held = new Map<string, number>(); // `${channel}:${note}` → note

  private clockOutSession: ClockOutSession | null = null;
  private followSession: FollowSession | null = null;
  private lastPulseStamp = -Infinity;
  private readonly followerImpl = new PulseClockFollower();

  private readonly headroom = new Ring(STATS_WINDOW);
  private readonly loopbackErrors = new Ring(STATS_WINDOW);
  private sentPulseStamps: number[] = [];

  private readonly noteListeners = new Listeners<[NoteEvent]>('MidiBridge.onNote');
  private readonly connectionListeners = new Listeners<[MidiConnectionChange]>('MidiBridge.onConnectionChange');
  private readonly modeListeners = new Listeners<[ClockMode]>('MidiBridge.onClockModeChange');
  private readonly clockInListeners = new Listeners<[number]>('MidiBridge.onClockIn');

  constructor(options: WebMidiBridgeOptions = {}) {
    this.nav = options.navigator ?? (globalThis as { navigator?: MidiNavigatorLike }).navigator;
    this.memory = options.memory;
    this.perfNow = options.perfNow ?? (() => performance.now());
    const stored = this.loadMemory();
    this.remembered = { input: stored.input ?? null, output: stored.output ?? null };
  }

  // -- NoteInputSource ------------------------------------------------------

  /** True when this browser has Web MIDI and access hasn't been refused. */
  available(): Promise<boolean> {
    const supported = typeof this.nav?.requestMIDIAccess === 'function';
    return Promise.resolve(supported && this.accessStateValue !== 'denied');
  }

  /** Starts emitting notes. Doesn't request access (that needs a gesture: `requestAccess`). */
  start(): Promise<void> {
    this.running = true;
    return Promise.resolve();
  }

  /** Stops emitting notes, with an `off` for every held note at `performance.now()`. */
  stop(): void {
    this.releaseHeld();
    this.running = false;
  }

  onNote(cb: (e: NoteEvent) => void): Unsubscribe {
    return this.noteListeners.add(cb);
  }

  // -- Access and ports -------------------------------------------------------

  requestAccess(): Promise<MidiAccessResult> {
    if (this.accessPromise) return this.accessPromise;
    const request = this.nav?.requestMIDIAccess;
    if (typeof request !== 'function') {
      this.accessStateValue = 'unsupported';
      return (this.accessPromise = Promise.resolve('unsupported'));
    }
    this.accessStateValue = 'pending';
    this.accessPromise = (async (): Promise<MidiAccessResult> => {
      try {
        const access = await request.call(this.nav, { sysex: false });
        this.attach(access);
        this.accessStateValue = 'granted';
        return 'granted';
      } catch {
        this.accessStateValue = 'denied';
        return 'denied';
      }
    })();
    return this.accessPromise;
  }

  accessState(): MidiAccessState {
    return this.accessStateValue;
  }

  ports(): { inputs: PortInfo[]; outputs: PortInfo[] } {
    return {
      inputs: this.connectedInputs().map(portInfo),
      outputs: this.connectedOutputs().map(portInfo),
    };
  }

  select(input?: string, output?: string): void {
    const nextIn = input === undefined ? null : (this.connectedInputs().find((p) => p.id === input) ?? null);
    const nextOut = output === undefined ? null : (this.connectedOutputs().find((p) => p.id === output) ?? null);
    if (input !== undefined && !nextIn) console.warn(`MidiBridge.select: no connected input '${input}'`);
    if (output !== undefined && !nextOut) console.warn(`MidiBridge.select: no connected output '${output}'`);
    this.remembered = {
      input: nextIn ? this.refOf(nextIn) : null,
      output: nextOut ? this.refOf(nextOut) : null,
    };
    this.saveMemory();
    this.setSelection(nextIn, nextOut, 'user');
  }

  selected(): { input: PortInfo | null; output: PortInfo | null } {
    return {
      input: this.input ? portInfo(this.input) : null,
      output: this.output ? portInfo(this.output) : null,
    };
  }

  onConnectionChange(cb: (e: MidiConnectionChange) => void): Unsubscribe {
    return this.connectionListeners.add(cb);
  }

  // -- Clock out -------------------------------------------------------------

  clockOut(enabled: boolean, transport: TransportEngine, clock: ClockBridge): void {
    if (!enabled) {
      this.stopClockOut(true);
      return;
    }
    if (this.clockOutSession || !this.output) return;
    this.stopFollow(false);
    const session: ClockOutSession = {
      transport,
      clock,
      unsubs: [],
      pendingStart: transport.state() === 'started',
    };
    session.unsubs.push(
      transport.onStateChange((e) => this.onTransportState(session, e)),
      transport.onMidiPulse((audioTime, absTick) => this.onTransportPulse(session, audioTime, absTick)),
    );
    this.clockOutSession = session;
    this.modeListeners.emit('clock out');
  }

  // -- Follow ----------------------------------------------------------------

  follow(enabled: boolean, transport: TransportEngine): void {
    if (!enabled) {
      this.stopFollow();
      return;
    }
    if (this.followSession || !this.input) return;
    this.stopClockOut(true, false);
    this.followSession = { transport, pulsesSinceApply: PULSES_PER_BEAT };
    this.modeListeners.emit('follow');
  }

  clockMode(): ClockMode {
    if (this.clockOutSession) return 'clock out';
    if (this.followSession) return 'follow';
    return 'internal';
  }

  onClockModeChange(cb: (mode: ClockMode) => void): Unsubscribe {
    return this.modeListeners.add(cb);
  }

  follower(): ExternalClockFollower {
    return this.followerImpl;
  }

  onClockIn(cb: (perfTs: number) => void): Unsubscribe {
    return this.clockInListeners.add(cb);
  }

  clockStats(): ClockStats {
    const h = this.headroom.all();
    const errs = this.loopbackErrors.all();
    let loopback: ClockStats['loopback'] = null;
    if (errs.length > 0) {
      const abs = errs.map(Math.abs);
      const m = median(errs);
      loopback = {
        count: errs.length,
        absErrorP50Ms: percentile(abs, 50),
        absErrorP95Ms: percentile(abs, 95),
        jitterP95Ms: percentile(
          errs.map((e) => Math.abs(e - m)),
          95,
        ),
      };
    }
    return {
      sends: h.length,
      headroomMinMs: h.length ? Math.min(...h) : null,
      headroomP5Ms: h.length ? percentile(h, 5) : null,
      headroomP50Ms: h.length ? percentile(h, 50) : null,
      late: h.filter((x) => x < 0).length,
      loopback,
    };
  }

  dispose(): void {
    this.stopClockOut(true);
    this.stopFollow();
    this.stop();
    this.setInput(null);
    this.output = null;
    if (this.access) this.access.removeEventListener('statechange', this.onStateChangeEvent);
    this.access = null;
  }

  // -- Internals: access and selection ----------------------------------------

  private attach(access: MidiAccessLike): void {
    this.access = access;
    access.addEventListener('statechange', this.onStateChangeEvent);
    for (const p of this.connectedInputs()) {
      this.portStates.set(p.id, p.state);
      this.connectionListeners.emit({ type: 'port', kind: 'input', port: portInfo(p), state: 'connected' });
    }
    for (const p of this.connectedOutputs()) {
      this.portStates.set(p.id, p.state);
      this.connectionListeners.emit({ type: 'port', kind: 'output', port: portInfo(p), state: 'connected' });
    }
    this.reselectRemembered();
  }

  private readonly onStateChangeEvent = (e: MidiConnectionEventLike): void => {
    const port = e.port;
    if (!port || !this.access) return;
    const state = port.state === 'connected' ? 'connected' : 'disconnected';
    if (this.portStates.get(port.id) === state) return; // `connection` (open/closed) changes only
    this.portStates.set(port.id, state);
    const kind = this.kindOf(port);
    if (!kind) return;
    this.connectionListeners.emit({ type: 'port', kind, port: portInfo(port), state });

    if (state === 'disconnected') {
      const lostInput = kind === 'input' && this.input?.id === port.id;
      const lostOutput = kind === 'output' && this.output?.id === port.id;
      if (lostInput || lostOutput) {
        this.setSelection(lostInput ? null : this.input, lostOutput ? null : this.output, 'disconnect');
      }
    } else {
      this.reselectRemembered();
    }
  };

  /** Which map a port is in. */
  private kindOf(port: MidiPortLike): 'input' | 'output' | null {
    let kind: 'input' | 'output' | null = null;
    this.access?.inputs.forEach((p) => {
      if (p.id === port.id) kind = 'input';
    });
    this.access?.outputs.forEach((p) => {
      if (p.id === port.id) kind = 'output';
    });
    return kind;
  }

  private connectedInputs(): MidiInputLike[] {
    const list: MidiInputLike[] = [];
    this.access?.inputs.forEach((p) => {
      if (p.state === 'connected') list.push(p);
    });
    return list;
  }

  private connectedOutputs(): MidiOutputLike[] {
    const list: MidiOutputLike[] = [];
    this.access?.outputs.forEach((p) => {
      if (p.state === 'connected') list.push(p);
    });
    return list;
  }

  /** Remembered ports that are connected and not yet selected: by id, then by name. Never guesses. */
  private reselectRemembered(): void {
    const find = <P extends MidiPortLike>(list: P[], ref: PortRef | null): P | null => {
      if (!ref) return null;
      return list.find((p) => p.id === ref.id) ?? list.find((p) => (p.name ?? '') === ref.name && ref.name !== '') ?? null;
    };
    const nextIn = this.input ?? find(this.connectedInputs(), this.remembered.input);
    const nextOut = this.output ?? find(this.connectedOutputs(), this.remembered.output);
    if (nextIn === this.input && nextOut === this.output) return;
    // A port found by name gets its new id remembered.
    const before = JSON.stringify(this.remembered);
    if (nextIn) this.remembered.input = this.refOf(nextIn);
    if (nextOut) this.remembered.output = this.refOf(nextOut);
    if (JSON.stringify(this.remembered) !== before) this.saveMemory();
    this.setSelection(nextIn, nextOut, 'reselect');
  }

  private setSelection(
    nextIn: MidiInputLike | null,
    nextOut: MidiOutputLike | null,
    why: 'user' | 'reselect' | 'disconnect',
  ): void {
    const before = this.selected();
    if (nextOut?.id !== this.output?.id) {
      // Clock out belongs to the output it started on.
      this.stopClockOut(why === 'user' && this.output !== null && this.output.state === 'connected');
      this.output = nextOut;
    }
    if (nextIn?.id !== this.input?.id) {
      this.stopFollow();
      this.setInput(nextIn);
    }
    const after = this.selected();
    if (!sameInfo(before.input, after.input) || !sameInfo(before.output, after.output)) {
      this.connectionListeners.emit({ type: 'selection', input: after.input, output: after.output });
    }
  }

  private setInput(next: MidiInputLike | null): void {
    if (this.input) {
      this.input.removeEventListener('midimessage', this.onMessage);
      this.releaseHeld();
    }
    this.input = next;
    if (next) {
      next.addEventListener('midimessage', this.onMessage);
      next.open?.().catch(() => {});
    }
  }

  private refOf(p: MidiPortLike): PortRef {
    return { id: p.id, name: p.name ?? '' };
  }

  private loadMemory(): StoredPorts {
    try {
      return this.memory?.load() ?? {};
    } catch (err) {
      console.warn('MidiBridge: could not load the remembered ports', err);
      return {};
    }
  }

  private saveMemory(): void {
    try {
      this.memory?.save({ input: this.remembered.input, output: this.remembered.output });
    } catch (err) {
      console.warn('MidiBridge: could not save the selected ports', err);
    }
  }

  // -- Internals: input --------------------------------------------------------

  private readonly onMessage = (e: MidiMessageLike): void => {
    const data = e.data;
    if (!data || data.length === 0) return;
    const status = data[0] as number;
    const ts = e.timeStamp;
    switch (status) {
      case STATUS_CLOCK:
        this.onClockPulseIn(ts);
        return;
      case STATUS_START:
      case STATUS_CONTINUE:
        this.followerImpl.onStart(ts);
        return;
      case STATUS_STOP:
        this.followerImpl.onStop();
        return;
    }
    const type = status & 0xf0;
    if ((type !== 0x90 && type !== 0x80) || data.length < 3) return;
    const channel = status & 0x0f;
    const note = (data[1] as number) & 0x7f;
    const velocity = (data[2] as number) & 0x7f;
    const key = `${channel}:${note}`;
    if (type === 0x90 && velocity > 0) {
      if (!this.running) return;
      this.held.set(key, note);
      this.noteListeners.emit({ kind: 'on', note, velocity: velocity / 127, perfTs: ts, source: 'midi' });
    } else {
      if (!this.held.delete(key)) return;
      this.noteListeners.emit({ kind: 'off', note, velocity: 0, perfTs: ts, source: 'midi' });
    }
  };

  private releaseHeld(): void {
    if (this.held.size === 0) return;
    const now = this.perfNow();
    const notes = [...this.held.values()];
    this.held.clear();
    for (const note of notes) this.noteListeners.emit({ kind: 'off', note, velocity: 0, perfTs: now, source: 'midi' });
  }

  private onClockPulseIn(perfTs: number): void {
    this.followerImpl.onPulse(perfTs);
    this.matchLoopback(perfTs);
    this.clockInListeners.emit(perfTs);

    const f = this.followSession;
    if (!f) return;
    f.pulsesSinceApply += 1;
    if (f.pulsesSinceApply < PULSES_PER_BEAT) return;
    const { bpm, confidence } = this.followerImpl.estimate();
    if (confidence < FOLLOW_MIN_CONFIDENCE || !(bpm > 0)) return;
    f.pulsesSinceApply = 0;
    const target = Math.min(BPM_MAX, Math.max(BPM_MIN, bpm));
    const cfg = f.transport.config();
    if (Math.abs(cfg.bpm - target) < 1e-6) return;
    try {
      f.transport.configure({ ...cfg, bpm: target });
    } catch (err) {
      console.error('MidiBridge follow: could not set the transport BPM', err);
    }
  }

  /** Pairs an incoming `F8` with the oldest sent one still waiting (decision 8's loopback). */
  private matchLoopback(arrival: number): void {
    if (!this.clockOutSession) return;
    const q = this.sentPulseStamps;
    let i = 0;
    while (i < q.length && arrival - (q[i] as number) > LOOPBACK_MAX_MS) i += 1;
    const head = q[i];
    if (head !== undefined && head <= arrival + LOOPBACK_EARLY_MS) {
      this.loopbackErrors.push(arrival - head);
      i += 1;
    }
    if (i > 0) this.sentPulseStamps = q.slice(i);
  }

  // -- Internals: clock out ----------------------------------------------------

  private onTransportState(session: ClockOutSession, e: TransportStateChange): void {
    if (this.clockOutSession !== session) return;
    if (e.state === 'started') {
      session.pendingStart = true;
      return;
    }
    session.pendingStart = false;
    this.send([STATUS_STOP], Math.max(session.clock.audioToPerf(e.audioTime), this.lastPulseStamp));
  }

  private onTransportPulse(session: ClockOutSession, audioTime: number, absTick: number): void {
    if (this.clockOutSession !== session) return;
    const stamp = session.clock.audioToPerf(audioTime);
    if (session.pendingStart && absTick % loopTicks(session.transport.config()) === 0) {
      session.pendingStart = false;
      this.send([STATUS_SPP, 0x00, 0x00], stamp);
      this.send([STATUS_START], stamp);
    }
    if (this.send([STATUS_CLOCK], stamp)) {
      this.lastPulseStamp = stamp;
      this.sentPulseStamps.push(stamp);
      if (this.sentPulseStamps.length > STATS_WINDOW) this.sentPulseStamps.shift();
    }
  }

  /** Sends to the selected output, recording headroom. False when nothing was sent. */
  private send(data: number[], stamp: number): boolean {
    const out = this.output;
    if (!out) return false;
    this.headroom.push(stamp - this.perfNow());
    try {
      out.send(data, stamp);
      return true;
    } catch (err) {
      console.error('MidiBridge: send failed', err);
      return false;
    }
  }

  /** Turns clock out off; with `sendStop`, an `FC` goes out if the transport is running. */
  private stopClockOut(sendStop: boolean, emit = true): void {
    const session = this.clockOutSession;
    if (!session) return;
    if (sendStop && session.transport.state() === 'started') {
      this.send([STATUS_STOP], Math.max(this.perfNow(), this.lastPulseStamp));
    }
    for (const u of session.unsubs) u();
    this.clockOutSession = null;
    this.sentPulseStamps = [];
    this.lastPulseStamp = -Infinity;
    if (emit) this.modeListeners.emit('internal');
  }

  private stopFollow(emit = true): void {
    if (!this.followSession) return;
    this.followSession = null;
    if (emit) this.modeListeners.emit('internal');
  }
}
