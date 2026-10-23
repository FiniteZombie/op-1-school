/**
 * The probe's Web MIDI side: its own `MIDIAccess`, separate from the bridge,
 * listening on every input, so the report shows what the browser delivers
 * whichever port is selected. Opened only once the bridge has access, so it
 * never prompts. Checked on `/dev/spine`; the counting is `probeReport.ts`.
 */
import { appendCapped } from './devSpine';
import { emptyTally, tallyMessage, type PortTally, type ProbePort, type RecentMessage } from './probeReport';

interface PortLike {
  id: string;
  name?: string | null;
  manufacturer?: string | null;
  state: string;
  connection: string;
}
interface MessageLike {
  data: Uint8Array | null;
  timeStamp: number;
}
interface InputLike extends PortLike {
  addEventListener(type: 'midimessage', listener: (e: MessageLike) => void): void;
  removeEventListener(type: 'midimessage', listener: (e: MessageLike) => void): void;
}
interface OutputLike extends PortLike {
  send(data: number[], timestamp?: number): void;
}
interface AccessLike {
  inputs: { values(): Iterable<InputLike> };
  outputs: { values(): Iterable<OutputLike>; get(id: string): OutputLike | undefined };
  addEventListener(type: 'statechange', listener: () => void): void;
  removeEventListener(type: 'statechange', listener: () => void): void;
}

const RECENT_CAP = 20;
const TEST_NOTE = 60;
const TEST_NOTE_MS = 300;

export interface LiveProbe {
  ports(): ProbePort[];
  recent(): RecentMessage[];
  /** Sends a short middle C; returns what it did, for the report. */
  sendTestNote(outputId: string): string;
  dispose(): void;
}

export async function openLiveProbe(): Promise<LiveProbe> {
  const nav = navigator as Navigator & { requestMIDIAccess?(o: { sysex: boolean }): Promise<AccessLike> };
  if (typeof nav.requestMIDIAccess !== 'function') throw new Error('no requestMIDIAccess');
  const access = await nav.requestMIDIAccess({ sysex: false });

  const tallies = new Map<string, PortTally>();
  const listeners = new Map<string, { port: InputLike; fn: (e: MessageLike) => void }>();
  let recent: RecentMessage[] = [];

  const attachAll = (): void => {
    for (const port of access.inputs.values()) {
      if (listeners.has(port.id)) continue;
      const tally = tallies.get(port.id) ?? emptyTally();
      tallies.set(port.id, tally);
      const fn = (e: MessageLike): void => {
        if (!e.data) return;
        const kind = tallyMessage(tally, e.data, e.timeStamp);
        if (kind && kind !== 'clock' && kind !== 'activeSensing') {
          recent = appendCapped(recent, { perfTs: e.timeStamp, port: port.name || port.id, hex: tally.last?.hex ?? '' }, RECENT_CAP);
        }
      };
      // Not `onmidimessage`: the bridge may be listening on the same port.
      port.addEventListener('midimessage', fn);
      listeners.set(port.id, { port, fn });
    }
  };
  attachAll();
  access.addEventListener('statechange', attachAll);

  const info = (type: ProbePort['type'], p: PortLike): ProbePort => ({
    type,
    id: p.id,
    name: p.name || p.id,
    manufacturer: p.manufacturer ?? '',
    state: p.state,
    connection: p.connection,
    ...(type === 'input' ? { tally: tallies.get(p.id) ?? emptyTally() } : {}),
  });

  return {
    ports: () => [
      ...[...access.inputs.values()].map((p) => info('input', p)),
      ...[...access.outputs.values()].map((p) => info('output', p)),
    ],
    recent: () => recent,
    sendTestNote(outputId) {
      const out = access.outputs.get(outputId);
      if (!out) return `test note: no output '${outputId}'`;
      const at = performance.now();
      out.send([0x90, TEST_NOTE, 100]);
      out.send([0x80, TEST_NOTE, 0], at + TEST_NOTE_MS);
      return `sent note ${TEST_NOTE} to ${out.name || out.id} at ${at.toFixed(1)} ms (${out.state}/${out.connection} after send)`;
    },
    dispose() {
      access.removeEventListener('statechange', attachAll);
      for (const { port, fn } of listeners.values()) port.removeEventListener('midimessage', fn);
      listeners.clear();
    },
  };
}
