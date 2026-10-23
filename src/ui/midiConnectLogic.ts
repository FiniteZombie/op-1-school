/**
 * `MidiConnect`'s logic, pure (plan decision 12). The Field's port name
 * can't identify it (VERIFY V7: `OP-1` on Windows, `USB Peripheral Port` on
 * Android), so each input is labelled by the messages it has delivered, never
 * by its name: the player picks the one that counts up when they play.
 *
 * The counts come from a `PortCounter` on its own `MIDIAccess`, listening on
 * every input (the bridge listens on the selected one only), opened once the
 * bridge has access so it never prompts, as `/dev/spine`'s probe does.
 */
import type { MidiAccessLike, MidiAccessState, MidiInputLike, MidiMessageLike, MidiNavigatorLike, PortInfo } from '../input/MidiBridge';
import type { Unsubscribe } from '../types/music';
import { COPY } from './copy';

// placeholder: every MidiConnect label is temporary until the owner decides.
export const MIDI_CONNECT_LABELS = {
  connect: 'connect midi',
  input: 'input',
  /** A port's label: its place in the list, then its message count. */
  port: (position: number, count: number) => `${position}: ${count} msgs`,
} as const;

/** Messages delivered per input port id, every kind counted (as the probe's `total`). */
export class PortCounter {
  private readonly counts = new Map<string, number>();
  private readonly listeners = new Set<() => void>();

  record(portId: string): void {
    this.counts.set(portId, (this.counts.get(portId) ?? 0) + 1);
    for (const cb of [...this.listeners]) cb();
  }

  count(portId: string): number {
    return this.counts.get(portId) ?? 0;
  }

  /** Called after every counted message. */
  subscribe(cb: () => void): Unsubscribe {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }
}

/** Counts every message on every input of `access`, including inputs that appear later. Returns a dispose. */
export function countInputs(access: MidiAccessLike, counter: PortCounter): Unsubscribe {
  const attached = new Map<string, { port: MidiInputLike; fn: (e: MidiMessageLike) => void }>();
  const attachAll = (): void => {
    access.inputs.forEach((port) => {
      if (attached.has(port.id)) return;
      const fn = (e: MidiMessageLike): void => {
        if (e.data && e.data.length > 0) counter.record(port.id);
      };
      // Not `onmidimessage`: the bridge may be listening on the same port.
      port.addEventListener('midimessage', fn);
      attached.set(port.id, { port, fn });
    });
  };
  attachAll();
  access.addEventListener('statechange', attachAll);
  return () => {
    access.removeEventListener('statechange', attachAll);
    for (const { port, fn } of attached.values()) port.removeEventListener('midimessage', fn);
    attached.clear();
  };
}

/** Opens the counter's own access (no sysex). Call only once the bridge's access is granted, so it never prompts. */
export async function openPortCounter(nav: MidiNavigatorLike): Promise<{ counter: PortCounter; dispose: Unsubscribe }> {
  if (typeof nav.requestMIDIAccess !== 'function') throw new Error('no requestMIDIAccess');
  const access = await nav.requestMIDIAccess({ sysex: false });
  const counter = new PortCounter();
  return { counter, dispose: countInputs(access, counter) };
}

export interface MidiConnectRow {
  id: string;
  label: string;
  chosen: boolean;
}

export interface MidiConnectView {
  /** Show `connect midi` (access not asked yet). */
  canConnect: boolean;
  /** A line in place of the picker (denied, unsupported, no inputs), or null. */
  message: string | null;
  /** One per connected input, in the bridge's order. Empty until access is granted. */
  rows: MidiConnectRow[];
}

export interface MidiConnectState {
  access: MidiAccessState;
  inputs: readonly PortInfo[];
  /** The bridge's selected input id, or null. */
  selectedId: string | null;
  count(portId: string): number;
}

export function midiConnectView(s: MidiConnectState): MidiConnectView {
  const granted = s.access === 'granted';
  let message: string | null = null;
  if (s.access === 'unsupported') message = COPY.midiUnsupported;
  else if (s.access === 'denied') message = COPY.midiDenied;
  else if (granted && s.inputs.length === 0) message = COPY.noMidi;
  return {
    canConnect: s.access === 'unrequested',
    message,
    rows: granted
      ? s.inputs.map((p, i) => ({ id: p.id, label: MIDI_CONNECT_LABELS.port(i + 1, s.count(p.id)), chosen: p.id === s.selectedId }))
      : [],
  };
}

/** The input to select after tapping `tapped`: tapping the chosen one again clears it. */
export function nextInput(selectedId: string | null, tapped: string): string | undefined {
  return tapped === selectedId ? undefined : tapped;
}
