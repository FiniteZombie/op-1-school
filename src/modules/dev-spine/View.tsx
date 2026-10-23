/**
 * `/dev/spine` (SPEC §6.1 item 8; plan row 9): the spine's smoke page, behind
 * `?dev`. Top to bottom: the audio gate; transport (start/stop, BPM and swing
 * encoders, part masks) playing `DEV_PROGRESSION`; the current chord; the
 * keyboard, classified against it; MIDI access, ports, clock out and follow;
 * decision 7's clock readout; decision 8's MIDI timing; the database check;
 * and a log of raw `NoteEvent`s.
 *
 * The page owns one `ToneBackingSynth`, disposed on unmount, and stops the
 * transport when it unmounts. Clock out isn't saved to settings: it starts
 * off on every load. Readouts refresh every 250 ms. Panels carry
 * `data-panel` and readouts `data-*` hooks for scripted checks.
 */
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { getAudioContext } from '../../audio/TransportEngine';
import { ToneBackingSynth, transportConfigFor, type PartMask } from '../../audio/VirtualPushSynth';
import { openAppDb, type AppDB } from '../../state/db';
import { chordName, loadProgression } from '../../theory';
import { AudioGate } from '../../ui/AudioGate';
import { Encoder } from '../../ui/Encoder';
import { Keyboard24 } from '../../ui/Keyboard24';
import { useAudioState, useSpine } from '../../ui/spine';
import {
  DEV_PROGRESSION,
  LABELS,
  STATUS_MARK,
  appendCapped,
  bpmFromEncoder,
  clockRows,
  encoderFromBpm,
  errorText,
  formatNoteEvent,
  midiPanelView,
  runDbCheck,
  timingRows,
  type Status,
  type StatusTone,
} from './devSpine';

const REFRESH_MS = 250;

const TONE_CLASS: Record<StatusTone, string> = {
  ok: 'border-ok text-ok',
  bad: 'border-bad text-bad',
  warn: 'border-warn text-warn',
  neutral: 'border-neutral text-neutral',
};

/** Re-renders every `ms`. */
function useTick(ms: number): void {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const id = setInterval(bump, ms);
    return () => clearInterval(id);
  }, [ms]);
}

function useBump(): () => void {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  return bump;
}

function Panel({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section data-panel={id} className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-3">
      <h2 className="text-sm font-semibold text-muted">{title}</h2>
      {children}
    </section>
  );
}

/** A status: mark, word and colour together, never hue alone. */
function StatusText({ status, hook }: { status: Status; hook: string }) {
  return (
    <p
      {...{ [`data-${hook}`]: status.tone }}
      className={`flex items-center gap-2 border-l-4 pl-2 text-sm ${TONE_CLASS[status.tone]}`}
    >
      <span aria-hidden="true" className="w-3 text-center font-bold">
        {STATUS_MARK[status.tone]}
      </span>
      <span>{status.text}</span>
    </p>
  );
}

function Rows({ rows, hook }: { rows: Array<[string, string]>; hook: string }) {
  return (
    <dl data-readout={hook} className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd data-field={k} className="tabular-nums text-text">
            {v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Check({
  label,
  checked,
  disabled,
  onChange,
  hook,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange(checked: boolean): void;
  hook: string;
}) {
  return (
    <label className={`flex items-center gap-2 text-sm ${disabled ? 'text-muted opacity-60' : 'text-text'}`}>
      <input
        type="checkbox"
        data-toggle={hook}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.currentTarget.checked)}
        className="h-5 w-5"
      />
      {label}
    </label>
  );
}

const buttonClass = 'rounded-md border border-line bg-bg px-4 py-2 text-sm text-text disabled:opacity-50';

export default function DevSpineView() {
  const { transport, clock, midi, bus } = useSpine();
  const audioState = useAudioState();
  const bump = useBump();
  useTick(REFRESH_MS);

  const progression = useMemo(() => loadProgression(DEV_PROGRESSION), []);

  // ---------------------------------------------------------- transport
  const synthRef = useRef<ToneBackingSynth | null>(null);
  const [mask, setMaskState] = useState<PartMask>({ drums: true, bass: true, chords: true });
  const maskRef = useRef(mask);
  maskRef.current = mask;

  useEffect(() => {
    const synth = new ToneBackingSynth(transport);
    if (transport.state() === 'stopped') transport.configure(transportConfigFor(progression));
    synth.load(progression);
    synth.setMask(maskRef.current);
    synthRef.current = synth;
    return () => {
      if (transport.state() === 'started') transport.stop();
      synth.dispose();
      if (synthRef.current === synth) synthRef.current = null;
    };
  }, [transport, progression]);

  const transportState = useSyncExternalStore(
    (cb) => transport.onStateChange(cb),
    () => transport.state(),
  );
  const running = transportState === 'started';
  const cfg = transport.config();

  function setMask(part: keyof PartMask, on: boolean): void {
    const next = { ...maskRef.current, [part]: on };
    setMaskState(next);
    synthRef.current?.setMask(next);
  }

  // -------------------------------------------------------------- chord
  let slotIndex = 0;
  const synth = synthRef.current;
  if (synth) {
    try {
      slotIndex = synth.currentSlot(getAudioContext().currentTime).index;
    } catch {
      slotIndex = 0;
    }
  }
  const slot = progression.slots[slotIndex] ?? progression.slots[0];
  if (!slot) throw new Error('DEV_PROGRESSION has no slots');
  const currentChordName = chordName(slot.chord, progression.key);

  // ----------------------------------------------------------- keyboard
  const [outOfRange, setOutOfRange] = useState(0);

  // ---------------------------------------------------------------- log
  const [log, setLog] = useState<Array<{ id: number; text: string }>>([]);
  const logId = useRef(0);
  const logRef = useRef<HTMLOListElement>(null);
  useEffect(
    () =>
      bus.onNote((e) => {
        const line = { id: logId.current++, text: formatNoteEvent(e) };
        setLog((lines) => appendCapped(lines, line));
      }),
    [bus],
  );
  useLayoutEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log]);

  // --------------------------------------------------------------- midi
  useEffect(() => {
    const offs = [midi.onConnectionChange(bump), midi.onClockModeChange(bump)];
    return () => offs.forEach((off) => off());
  }, [midi, bump]);

  const ports = midi.ports();
  const sel = midi.selected();
  const midiView = midiPanelView({
    access: midi.accessState(),
    inputs: ports.inputs,
    outputs: ports.outputs,
    selectedInput: sel.input,
    selectedOutput: sel.output,
    mode: midi.clockMode(),
  });
  const estimate = midi.follower().estimate();

  async function requestMidi(): Promise<void> {
    const pending = midi.requestAccess();
    bump();
    await pending;
    bump();
  }

  // ----------------------------------------------------------- database
  const [db, setDb] = useState<{ kind: 'opening' } | { kind: 'open'; db: AppDB } | { kind: 'error'; message: string }>({
    kind: 'opening',
  });
  const [dbResult, setDbResult] = useState<Status | null>(null);
  const [dbBusy, setDbBusy] = useState(false);
  useEffect(() => {
    let live = true;
    let opened: AppDB | null = null;
    openAppDb().then(
      (d) => {
        opened = d;
        if (live) setDb({ kind: 'open', db: d });
        else d.close();
      },
      (err: unknown) => {
        if (live) setDb({ kind: 'error', message: errorText(err) });
      },
    );
    return () => {
      live = false;
      opened?.close();
    };
  }, []);

  async function checkDb(): Promise<void> {
    if (db.kind !== 'open') return;
    setDbBusy(true);
    setDbResult(await runDbCheck(db.db));
    setDbBusy(false);
  }

  return (
    <div data-dev-spine className="mx-auto flex max-w-3xl flex-col gap-3 p-3">
      <AudioGate />

      <Panel id="transport" title={LABELS.panels.transport}>
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            data-transport={transportState}
            disabled={audioState !== 'running'}
            onClick={() => (running ? transport.stop() : transport.start())}
            className={buttonClass}
          >
            {running ? LABELS.stop : LABELS.start}
          </button>
          <Encoder
            color="blue"
            label={LABELS.bpm}
            value={encoderFromBpm(cfg.bpm)}
            valueText={String(Math.round(cfg.bpm))}
            disabled={midiView.followOn}
            onChange={(v) => {
              transport.configure({ ...transport.config(), bpm: bpmFromEncoder(v) });
              bump();
            }}
          />
          <Encoder
            color="ochre"
            label={LABELS.swing}
            value={cfg.swing}
            valueText={cfg.swing.toFixed(2)}
            onChange={(v) => {
              transport.configure({ ...transport.config(), swing: Math.round(v * 100) / 100 });
              bump();
            }}
          />
          <div className="flex flex-col gap-1">
            {(['drums', 'bass', 'chords'] as const).map((part) => (
              <Check key={part} hook={part} label={LABELS[part]} checked={mask[part]} onChange={(on) => setMask(part, on)} />
            ))}
          </div>
        </div>
      </Panel>

      <Panel id="chord" title={LABELS.panels.chord}>
        <p className="flex items-baseline gap-3">
          <span data-current-chord={currentChordName} className="text-2xl font-semibold text-text">
            {currentChordName}
          </span>
          <span data-current-roman={slot.roman} className="text-lg text-muted">
            {slot.roman}
          </span>
        </p>
      </Panel>

      <Panel id="keyboard" title={LABELS.panels.keyboard}>
        <Keyboard24 chord={slot.chord} musicKey={progression.key} onOutOfRange={() => setOutOfRange((n) => n + 1)} />
        <p data-out-of-range={outOfRange} className="text-xs text-muted">
          {LABELS.outOfRange(outOfRange)}
        </p>
      </Panel>

      <Panel id="midi" title={LABELS.panels.midi}>
        <StatusText status={midiView.status} hook="midi-status" />
        {midiView.canRequest && (
          <button type="button" data-request-midi onClick={() => void requestMidi()} className={`self-start ${buttonClass}`}>
            {LABELS.requestMidi}
          </button>
        )}
        {midiView.showPickers && (
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              {LABELS.input}
              <select
                data-port-picker="input"
                value={sel.input?.id ?? ''}
                onChange={(e) => midi.select(e.currentTarget.value || undefined, sel.output?.id)}
                className="rounded-md border border-line bg-bg px-2 py-1 text-text"
              >
                <option value="">{LABELS.none}</option>
                {ports.inputs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              {LABELS.output}
              <select
                data-port-picker="output"
                value={sel.output?.id ?? ''}
                onChange={(e) => midi.select(sel.input?.id, e.currentTarget.value || undefined)}
                className="rounded-md border border-line bg-bg px-2 py-1 text-text"
              >
                <option value="">{LABELS.none}</option>
                {ports.outputs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-4">
          <Check
            hook="clock-out"
            label={LABELS.clockOut}
            checked={midiView.clockOutOn}
            disabled={midiView.clockOutDisabled}
            onChange={(on) => midi.clockOut(on, transport, clock)}
          />
          <Check
            hook="follow"
            label={LABELS.follow}
            checked={midiView.followOn}
            disabled={midiView.followDisabled}
            onChange={(on) => midi.follow(on, transport)}
          />
          <span data-follower className="text-xs tabular-nums text-muted">
            {LABELS.follower(estimate.bpm, estimate.confidence)}
          </span>
        </div>
      </Panel>

      <Panel id="clock" title={LABELS.panels.clock}>
        <Rows hook="clock" rows={clockRows(clock.snapshot())} />
      </Panel>

      <Panel id="midi-timing" title={LABELS.panels.midiTiming}>
        <Rows hook="midi-timing" rows={timingRows(midi.clockStats())} />
      </Panel>

      <Panel id="database" title={LABELS.panels.database}>
        {db.kind === 'error' && <StatusText status={{ tone: 'bad', text: LABELS.dbFailed(db.message) }} hook="db-open" />}
        {db.kind === 'open' && (
          <Rows
            hook="database"
            rows={[
              ['version', String(db.db.version)],
              ['stores', [...db.db.objectStoreNames].join(', ')],
            ]}
          />
        )}
        <button
          type="button"
          data-db-check
          disabled={db.kind !== 'open' || dbBusy}
          onClick={() => void checkDb()}
          className={`self-start ${buttonClass}`}
        >
          {dbBusy ? LABELS.dbRunning : LABELS.dbCheck}
        </button>
        {dbResult && <StatusText status={dbResult} hook="db-result" />}
      </Panel>

      <Panel id="log" title={LABELS.log}>
        <ol ref={logRef} data-log className="h-48 overflow-y-auto font-mono text-xs text-text">
          {log.length === 0 ? (
            <li className="text-muted">{LABELS.logEmpty}</li>
          ) : (
            log.map((l) => (
              <li key={l.id} data-log-line>
                {l.text}
              </li>
            ))
          )}
        </ol>
      </Panel>
    </div>
  );
}
