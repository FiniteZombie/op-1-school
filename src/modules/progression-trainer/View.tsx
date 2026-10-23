/**
 * `/progression-trainer`: the audio gate with `MidiConnect` under it, the
 * pickers (level, progression, A6's form; hidden for a Runner launch), then
 * the drill the query names. Picking navigates to a practice launch, so the
 * URL always holds the drill and a reload reopens it.
 *
 * The drill panel owns one `ToneBackingSynth` and one `DrillController`,
 * both disposed on unmount (which stops the transport and writes nothing).
 * placeholder: the whole layout. Hooks for scripted checks: `data-phase`,
 * `data-pad`, `data-quality`, `data-submit`, `data-result`, `data-state`.
 */
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ToneBackingSynth } from '../../audio/VirtualPushSynth';
import { progressionById, progressions } from '../../curriculum';
import { getCalibration, defaultDevice } from '../../state/calibration';
import { newId, openAppDb } from '../../state/db';
import { QUALITY_FAMILIES, chordName } from '../../theory';
import { DRILL_FORMS, type DrillForm } from '../../types/drills';
import type { InputSource } from '../../types/music';
import { AudioGate } from '../../ui/AudioGate';
import { Keyboard24 } from '../../ui/Keyboard24';
import { MidiConnect } from '../../ui/MidiConnect';
import { Link, navigate, useLocation } from '../../ui/navigation';
import { useAudioState, useSpine, type Spine } from '../../ui/spine';
import { DrillSaver, buildRecords, drillDbOf, type SaverState } from './attempt';
import { DrillController } from './drill';
import { LABELS, scoreText, timeLeft } from './labels';
import { MODULE_ID, pickerQuery, resolveLaunch, type PageRoute } from './launch';
import { LEVELS, LEVEL_IDS, usableFor, type LevelId } from './levels';
import { canFinish, isLive, remainingSec } from './lifecycle';
import type { CountState } from './scoring';

const REFRESH_MS = 200;

const STATE_CLASS: Record<CountState, string> = {
  ok: 'border-ok text-ok',
  bad: 'border-bad text-bad',
  warn: 'border-warn text-warn',
  neutral: 'border-neutral text-neutral',
};

const button = 'rounded-md border border-line bg-surface px-4 py-2 text-sm text-text disabled:opacity-50';
const chip = (on: boolean) =>
  `rounded-md border px-3 py-1 text-sm ${on ? 'border-text bg-surface font-semibold text-text' : 'border-line bg-bg text-muted'}`;

function useTick(ms: number, on: boolean): void {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!on) return;
    const id = setInterval(bump, ms);
    return () => clearInterval(id);
  }, [ms, on]);
}

export default function ProgressionTrainerView() {
  const { query } = useLocation();
  const route = useMemo(() => resolveLaunch(query, progressionById), [query]);
  const [saver] = useState(() => new DrillSaver(async () => drillDbOf(await openAppDb())));
  const [saverState, setSaverState] = useState<SaverState>(saver.state());
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void saver.ready().then(setSaverState);
  }, [saver]);

  const launch = route.launch;
  const fromRunner = launch?.session !== undefined;

  return (
    <div className="flex max-w-3xl flex-col gap-4 p-4">
      <AudioGate />
      <MidiConnect />
      {saverState.kind === 'off' && (
        <section data-save-off className="border-l-4 border-bad pl-2 text-sm text-bad">
          <h2 className="font-semibold">{LABELS.cantSave}</h2>
          <p>{saverState.message}</p>
        </section>
      )}
      {route.kind === 'pickers' && route.error && (
        <p role="alert" data-launch-error className="border-l-4 border-bad pl-2 text-sm text-bad">
          {route.error}
        </p>
      )}
      {!fromRunner && <Pickers route={route} disabled={busy} />}
      {route.kind === 'drill' && (
        <DrillPanel key={JSON.stringify(query)} route={route} saver={saver} onBusy={setBusy} />
      )}
    </div>
  );
}

// ------------------------------------------------------------------ pickers

function Pickers({ route, disabled }: { route: PageRoute; disabled: boolean }) {
  const level = route.level;
  const form: DrillForm = route.form;
  const current = route.kind === 'drill' ? route.progression.id : route.launch?.progression;
  const usable = level ? progressions().filter((p) => usableFor(level, p, form)) : [];

  const go = (l: LevelId, p: string | undefined, f: DrillForm) => navigate(`/${MODULE_ID}`, pickerQuery(l, p, f));

  return (
    <section data-pickers className="flex flex-col gap-3">
      <div role="group" aria-label={LABELS.level} className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">{LABELS.level}</span>
        {LEVEL_IDS.map((l) => (
          <button
            key={l}
            type="button"
            data-level={l}
            aria-pressed={l === level}
            disabled={disabled}
            onClick={() => go(l, undefined, form)}
            className={chip(l === level)}
          >
            {/* placeholder: level ids in lowercase */}
            {l.toLowerCase()}
          </button>
        ))}
      </div>
      {level === 'A6' && (
        <div role="group" className="flex flex-wrap gap-2">
          {DRILL_FORMS.map((f) => (
            <button
              key={f}
              type="button"
              data-form={f}
              aria-pressed={f === form}
              disabled={disabled}
              onClick={() => go(level, undefined, f)}
              className={chip(f === form)}
            >
              {LABELS.forms[f]}
            </button>
          ))}
        </div>
      )}
      {level && (
        <div role="group" aria-label={LABELS.progression} className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted">{LABELS.progression}</span>
          {usable.length === 0 && <span data-no-progression className="text-sm text-muted">{LABELS.noProgression}</span>}
          {usable.map((p) => (
            <button
              key={p.id}
              type="button"
              data-progression={p.id}
              aria-pressed={p.id === current}
              disabled={disabled}
              onClick={() => go(level, p.id, form)}
              className={chip(p.id === current)}
            >
              {/* placeholder: a progression's label is its id and numerals */}
              {p.id} ({p.slots.map((s) => s.roman).join('–')})
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

// -------------------------------------------------------------------- drill

type DrillRoute = Extract<PageRoute, { kind: 'drill' }>;

async function loadCalibration(spine: Spine, into: Partial<Record<InputSource, number>>): Promise<void> {
  try {
    const touch = await getCalibration('touch', defaultDevice('touch'));
    if (touch) into.touch = touch.offsetMs;
    const name = spine.midi.selected().input?.name;
    const midi = name ? await getCalibration('midi', name) : undefined;
    if (midi) into.midi = midi.offsetMs;
  } catch {
    // no database: nothing is calibrated
  }
}

function DrillPanel({ route, saver, onBusy }: { route: DrillRoute; saver: DrillSaver; onBusy(b: boolean): void }) {
  const spine = useSpine();
  const audioState = useAudioState();
  const [generation, restart] = useReducer((n: number) => n + 1, 0);
  const [ctl, setCtl] = useState<DrillController | null>(null);
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const [saved, setSaved] = useState<'no' | 'yes' | 'off' | 'failed'>('no');

  useEffect(() => {
    const synth = new ToneBackingSynth(spine.transport);
    const calibration: Partial<Record<InputSource, number>> = {};
    const c = new DrillController({
      level: route.level,
      progression: route.progression,
      form: route.form,
      minutes: route.minutes,
      transport: spine.transport,
      clock: spine.clock,
      bus: spine.bus,
      backing: synth,
      calibration,
    });
    void loadCalibration(spine, calibration);
    let last = '';
    const off = c.subscribe(() => {
      const s = c.drill();
      const sig = `${s.phase}:${s.progress}`;
      if (sig !== last) {
        last = sig;
        bump();
      }
    });
    setCtl(c);
    setSaved('no');
    return () => {
      off();
      c.dispose();
      synth.dispose();
    };
  }, [route, spine, generation]);

  const s = ctl?.drill();
  const phase = s?.phase ?? 'ready';
  const live = phase === 'running' || phase === 'finishing';
  useTick(REFRESH_MS, live);

  useEffect(() => {
    onBusy(phase === 'running' || phase === 'finishing' || phase === 'paused');
    return () => onBusy(false);
  }, [phase, onBusy]);

  useEffect(() => {
    if (phase === 'abandoned') restart();
  }, [phase]);

  // Save once when done.
  const savedFor = useRef<DrillController | null>(null);
  useEffect(() => {
    const result = ctl?.finished();
    if (!ctl || phase !== 'done' || !result || savedFor.current === ctl) return;
    savedFor.current = ctl;
    const at = Date.now();
    const records = buildRecords({
      launch: route.launch,
      level: route.level,
      result,
      startedAt: ctl.startedAt() ?? at,
      at,
      newId,
    });
    saver.save(records).then(
      (ok) => setSaved(ok ? 'yes' : 'off'),
      (err: unknown) => {
        console.error('progression-trainer: saving failed', err);
        setSaved('failed');
      },
    );
  }, [ctl, phase, route, saver]);

  if (!ctl || !s) return null;

  const spec = LEVELS[route.level];
  const p = ctl.playing();
  const at = live ? ctl.heardAt(performance.now()) : null;
  const view = ctl.scorer.live(at);
  const slot = at ? p.slots[at.slot] : undefined;
  const result = ctl.finished();

  return (
    <section data-drill={route.level} data-phase={phase} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span data-time className="tabular-nums text-text">
          {timeLeft(remainingSec(s))}
        </span>
        {phase === 'paused' && (
          <span data-paused className="text-warn">
            {LABELS.paused}
          </span>
        )}
        {view.stage && (
          <span data-stage className="text-muted">
            {view.stage}
          </span>
        )}
      </div>

      {phase !== 'done' && (
        <div className="flex flex-wrap gap-2">
          {(phase === 'ready' || phase === 'paused') && (
            <button type="button" data-start disabled={audioState !== 'running'} onClick={() => ctl.start()} className={button}>
              {LABELS.start}
            </button>
          )}
          {phase !== 'ready' && (
            <button type="button" data-stop onClick={() => ctl.stop()} className={button}>
              {canFinish(s) ? LABELS.finish : LABELS.stop}
            </button>
          )}
        </div>
      )}

      {phase !== 'done' && (
        <>
          {spec.showChord && slot && (
            <p data-chord className="text-2xl font-semibold text-text">
              {chordName(slot.chord, p.key)}
            </p>
          )}
          {view.reveal && (
            <p data-live-reveal data-state={view.reveal.state} className={`border-l-4 pl-2 text-sm ${STATE_CLASS[view.reveal.state]}`}>
              {view.reveal.text}
            </p>
          )}
          {route.level === 'A0' && (
            <button
              type="button"
              data-pad
              disabled={!isLive(phase)}
              onPointerDown={(e) => ctl.pad(e.timeStamp)}
              className="h-32 w-full touch-none select-none rounded-lg border border-line bg-surface text-lg text-text disabled:opacity-50"
            >
              {LABELS.tap}
            </button>
          )}
          {route.level === 'A3' && (
            <div className="flex flex-wrap gap-2">
              {QUALITY_FAMILIES.map((f) => (
                <button
                  key={f}
                  type="button"
                  data-quality={f}
                  disabled={!isLive(phase)}
                  onPointerDown={(e) => ctl.choose(f, e.timeStamp)}
                  className={`${button} touch-none`}
                >
                  {f}
                </button>
              ))}
            </div>
          )}
          {view.prompt && (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span data-prompt className="font-semibold text-text">
                {view.prompt.label}
              </span>
              <span className="text-muted">
                {LABELS.played}: {view.prompt.played}
              </span>
              <button
                type="button"
                data-submit
                disabled={!isLive(phase) || !view.prompt.open}
                onClick={(e) => ctl.choose('submit', e.timeStamp)}
                className={button}
              >
                {LABELS.submit}
              </button>
            </div>
          )}
          <Keyboard24
            chord={spec.classify ? slot?.chord : undefined}
            musicKey={spec.classify ? p.key : undefined}
            guide={view.guide}
          />
        </>
      )}

      {phase === 'done' && result && (
        <section data-result className="flex flex-col gap-2">
          <p data-score className="text-xl font-semibold text-text">
            {scoreText(result.score)}
          </p>
          <ul className="flex flex-col gap-1 text-sm">
            {result.counts.map((c) => (
              <li key={c.label} data-state={c.state} className={`border-l-4 pl-2 ${STATE_CLASS[c.state]}`}>
                {c.label} {c.n}
              </li>
            ))}
          </ul>
          {result.reveal.length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-muted">{LABELS.reveal}</h2>
              <ul data-reveal className="text-sm text-text">
                {result.reveal.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </>
          )}
          {result.map && (
            <>
              <h2 className="text-sm font-semibold text-muted">{LABELS.voiceLeadingMap}</h2>
              <ul data-map className="text-sm text-text">
                {result.map.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </>
          )}
          {saved === 'failed' && <p className="text-sm text-bad">{LABELS.cantSave}</p>}
          {route.launch.returnTo && (
            <Link to={route.launch.returnTo} data-back className={`${button} self-start`}>
              {LABELS.backToSession}
            </Link>
          )}
        </section>
      )}
    </section>
  );
}
