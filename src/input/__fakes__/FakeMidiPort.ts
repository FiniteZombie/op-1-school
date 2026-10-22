/**
 * Web MIDI fakes for tests (SPEC §5.3): ports that record what was sent and
 * can emit input, and an access object whose ports can be plugged and
 * unplugged. Structural against `MidiBridge.ts`'s `Midi*Like` types.
 */
import type {
  MidiAccessLike,
  MidiConnectionEventLike,
  MidiInputLike,
  MidiMessageLike,
  MidiNavigatorLike,
  MidiOutputLike,
} from '../MidiBridge';

/** A MIDI output that records `[data, timestamp]` for every send. */
export class FakeMidiOutput implements MidiOutputLike {
  state = 'connected';
  readonly manufacturer = 'fake';
  readonly sent: Array<[number[], number | undefined]> = [];

  constructor(
    readonly id: string,
    readonly name: string,
  ) {}

  send(data: number[], timestamp?: number): void {
    this.sent.push([[...data], timestamp]);
  }

  /** Sent messages whose first byte is `status`. */
  sentWith(status: number): Array<[number[], number | undefined]> {
    return this.sent.filter(([d]) => d[0] === status);
  }
}

/** A MIDI input; `emit` delivers a message to the listeners as Web MIDI would. */
export class FakeMidiInput implements MidiInputLike {
  state = 'connected';
  readonly manufacturer = 'fake';
  opened = 0;
  private readonly listeners = new Set<(e: MidiMessageLike) => void>();

  constructor(
    readonly id: string,
    readonly name: string,
  ) {}

  addEventListener(_type: 'midimessage', listener: (e: MidiMessageLike) => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: 'midimessage', listener: (e: MidiMessageLike) => void): void {
    this.listeners.delete(listener);
  }

  open(): Promise<unknown> {
    this.opened += 1;
    return Promise.resolve(this);
  }

  listenerCount(): number {
    return this.listeners.size;
  }

  emit(data: number[], timeStamp: number): void {
    const e: MidiMessageLike = { data: Uint8Array.from(data), timeStamp };
    for (const l of [...this.listeners]) l(e);
  }
}

/** A `MIDIAccess` whose port maps keep disconnected ports (as Chrome does), with `statechange` events. */
export class FakeMidiAccess implements MidiAccessLike {
  readonly inputMap = new Map<string, FakeMidiInput>();
  readonly outputMap = new Map<string, FakeMidiOutput>();
  private readonly listeners = new Set<(e: MidiConnectionEventLike) => void>();

  readonly inputs = { forEach: (cb: (p: MidiInputLike) => void) => this.inputMap.forEach((p) => cb(p)) };
  readonly outputs = { forEach: (cb: (p: MidiOutputLike) => void) => this.outputMap.forEach((p) => cb(p)) };

  constructor(ports: Array<FakeMidiInput | FakeMidiOutput> = []) {
    for (const p of ports) this.put(p);
  }

  addEventListener(_type: 'statechange', listener: (e: MidiConnectionEventLike) => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: 'statechange', listener: (e: MidiConnectionEventLike) => void): void {
    this.listeners.delete(listener);
  }

  /** Adds (or reconnects) a port and fires `statechange`. */
  plug(port: FakeMidiInput | FakeMidiOutput): void {
    port.state = 'connected';
    this.put(port);
    this.fire(port);
  }

  /** Marks a port disconnected (it stays in its map) and fires `statechange`. */
  unplug(port: FakeMidiInput | FakeMidiOutput): void {
    port.state = 'disconnected';
    this.fire(port);
  }

  private put(port: FakeMidiInput | FakeMidiOutput): void {
    if (port instanceof FakeMidiInput) this.inputMap.set(port.id, port);
    else this.outputMap.set(port.id, port);
  }

  private fire(port: FakeMidiInput | FakeMidiOutput): void {
    for (const l of [...this.listeners]) l({ port });
  }
}

/** A navigator whose `requestMIDIAccess` grants `access`, or rejects when given null. */
export function fakeMidiNavigator(access: FakeMidiAccess | null): MidiNavigatorLike & { requests: Array<{ sysex?: boolean } | undefined> } {
  const requests: Array<{ sysex?: boolean } | undefined> = [];
  return {
    requests,
    requestMIDIAccess(options?: { sysex?: boolean }) {
      requests.push(options);
      return access ? Promise.resolve(access) : Promise.reject(new DOMException('denied', 'SecurityError'));
    },
  };
}
