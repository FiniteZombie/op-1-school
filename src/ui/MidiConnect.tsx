/**
 * Connects the Field from any page (plan decision 12): `connect midi` asks
 * for Web MIDI access on the tap, then one button per input, labelled by the
 * messages it has delivered (never its name, VERIFY V7). The player presses
 * keys on the Field and picks the input that counts up; tapping the chosen
 * one again clears it. The choice goes to `midi.select`, which remembers it.
 * The logic is `midiConnectLogic.ts`.
 */
import { useEffect, useReducer, useState } from 'react';
import type { MidiNavigatorLike } from '../input/MidiBridge';
import { MIDI_CONNECT_LABELS, midiConnectView, nextInput, openPortCounter, type PortCounter } from './midiConnectLogic';
import { useSpine } from './spine';

/** Count updates re-render at most this often. */
const COUNT_REFRESH_MS = 200;

export function MidiConnect({ className = '' }: { className?: string }) {
  const { midi } = useSpine();
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const [counter, setCounter] = useState<PortCounter | null>(null);

  useEffect(() => midi.onConnectionChange(bump), [midi]);

  const access = midi.accessState();
  useEffect(() => {
    if (access !== 'granted') return;
    let live = true;
    let dispose: (() => void) | null = null;
    openPortCounter(navigator as unknown as MidiNavigatorLike).then(
      (c) => {
        if (!live) return c.dispose();
        dispose = c.dispose;
        setCounter(c.counter);
      },
      (err: unknown) => console.error('MidiConnect: port counter failed', err),
    );
    return () => {
      live = false;
      dispose?.();
      setCounter(null);
    };
  }, [access]);

  useEffect(() => {
    if (!counter) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const off = counter.subscribe(() => {
      timer ??= setTimeout(() => {
        timer = null;
        bump();
      }, COUNT_REFRESH_MS);
    });
    return () => {
      off();
      if (timer) clearTimeout(timer);
    };
  }, [counter]);

  const selected = midi.selected();
  const view = midiConnectView({
    access,
    inputs: midi.ports().inputs,
    selectedId: selected.input?.id ?? null,
    count: (id) => counter?.count(id) ?? 0,
  });

  async function connect(): Promise<void> {
    const pending = midi.requestAccess();
    bump();
    await pending;
    bump();
  }

  // placeholder: the layout (a button, then a row of port buttons).
  return (
    <div data-midi-connect={access} className={`flex flex-col gap-2 ${className}`}>
      {view.canConnect && (
        <button
          type="button"
          data-connect-midi
          onClick={() => void connect()}
          className="self-start rounded-md border border-line bg-surface px-3 py-1 text-sm text-text"
        >
          {MIDI_CONNECT_LABELS.connect}
        </button>
      )}
      {view.message && <p className="text-sm text-muted">{view.message}</p>}
      {view.rows.length > 0 && (
        <div role="group" aria-label={MIDI_CONNECT_LABELS.input} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">{MIDI_CONNECT_LABELS.input}</span>
          {view.rows.map((r) => (
            <button
              key={r.id}
              type="button"
              data-port-id={r.id}
              aria-pressed={r.chosen}
              onClick={() => midi.select(nextInput(selected.input?.id ?? null, r.id), selected.output?.id)}
              className={`rounded-md border px-3 py-1 ${r.chosen ? 'border-ok bg-surface font-semibold text-text' : 'border-line bg-bg text-text'}`}
            >
              {r.chosen ? `✓ ${r.label}` : r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
