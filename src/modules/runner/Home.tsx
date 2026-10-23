// The Runner's home: today's plan, the open session's current step, the
// streak, recent daily sessions, the library link and `export`.

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { lessonById, lessons as allLessons } from '../../curriculum';
import { newId, type Attempt, type Session } from '../../state/db';
import type { Lesson, LessonStep } from '../../types/lessons';
import { useAvailableModules } from '../../ui/availableModules';
import { Link, navigate, useLocation } from '../../ui/navigation';
import { Markdown } from './Cards';
import { dayKey } from './days';
import { copyText, downloadText } from './exportFile';
import { countdownSeconds, formatCountdown, secondsLeft } from './fast';
import { homeAction } from './homeAction';
import { LABELS } from './labels';
import { todaysPlan } from './plan';
import {
  activeStep,
  dailySessions,
  drillLaunch,
  drillQuery,
  lastFinishedDaily,
  launchStep,
  newDailySession,
  openSessionToday,
  patchStep,
  RUNNER_ROUTE,
} from './session';
import { streak } from './streak';
import { doneStepScore, sessionMarkdown, summaryFilename, percent } from './summary';
import { errorText, type RunnerData } from './store';
import type { RunnerHandle } from './useRunnerData';

const BTN = 'rounded-md border border-line bg-surface px-3 py-2 text-sm font-medium text-text disabled:opacity-50';

function useNow(ms: number, on: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms, on]);
  return now;
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section data-panel={id} className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3">
      <h2 className="text-base font-bold">{title}</h2>
      {children}
    </section>
  );
}

export function Home({ handle }: { handle: RunnerHandle }) {
  const { data, update } = handle;
  const { fast } = useLocation();
  const available = useAvailableModules();
  const lessons = allLessons();
  const sessions = data.kind === 'ready' ? data.sessions : [];
  const attempts = data.kind === 'ready' ? data.attempts : [];
  const open = data.kind === 'ready' ? openSessionToday(sessions, Date.now()) : undefined;
  const plan = useMemo(() => todaysPlan(lessons, sessions, attempts), [lessons, sessions, attempts]);
  const action = homeAction(lessons, plan, data, open);
  const now = useNow(1000, open !== undefined);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | undefined>();
  const [summaryBox, setSummaryBox] = useState<string | undefined>();
  const [copied, setCopied] = useState(false);

  async function run(next: () => Promise<unknown>): Promise<void> {
    setBusy(true);
    setProblem(undefined);
    try {
      await next();
    } catch (err) {
      setProblem(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const startSession = () => run(() => update(newDailySession(newId(), Date.now(), plan)));

  function exportLast(): void {
    const last = lastFinishedDaily(sessions);
    if (!last) return;
    const text = sessionMarkdown(last, attempts, lessonById, streak(sessions, Date.now()));
    // writeText must start inside the click, before any await.
    void copyText(text).then((ok) => {
      setCopied(ok);
      setSummaryBox(ok ? undefined : text);
    });
    downloadText(text, summaryFilename(last));
  }

  const last = lastFinishedDaily(sessions);
  const today = dayKey(Date.now());

  return (
    <div className="flex flex-col gap-3">
      {data.kind === 'error' && (
        <p data-state="bad" className="text-bad" title={data.message}>
          {LABELS.cantSave} ({data.message})
        </p>
      )}
      {data.kind === 'loading' && <p className="text-muted">{LABELS.loading}</p>}
      {problem && (
        <p data-state="bad" className="text-bad">
          {LABELS.cantSave} ({problem})
        </p>
      )}

      {lessons.length === 0 && <p className="text-muted">{LABELS.noLessons}</p>}

      {open ? (
        <ActiveSession session={open} attempts={attempts} now={now} fast={fast} busy={busy} run={run} update={update} routeOf={(id) => available.find((m) => m.id === id)?.route} />
      ) : (
        action.kind !== 'none' && (
          <Section id="today" title={LABELS.today}>
            <PlanList plan={plan} />
            <button type="button" data-action="start" className={`${BTN} self-start`} disabled={busy || action.kind !== 'start' || !action.enabled} onClick={() => void startSession()}>
              {LABELS.startSession}
            </button>
          </Section>
        )
      )}

      <div className="flex flex-wrap items-center gap-3">
        <span data-streak={streak(sessions, Date.now())} className="text-sm font-semibold">
          {LABELS.streak(streak(sessions, Date.now()))}
        </span>
        {last && dayKey(last.finishedAt ?? 0) === today && <span className="text-sm text-muted">{LABELS.sessionDone}</span>}
        <Link to={RUNNER_ROUTE} query={{ view: 'library' }} className={BTN}>
          {LABELS.library}
        </Link>
        {last && (
          <button type="button" data-action="export" className={BTN} onClick={exportLast}>
            {copied ? LABELS.copied : LABELS.export}
          </button>
        )}
      </div>

      {summaryBox !== undefined && (
        <label className="flex flex-col gap-1 text-sm">
          {LABELS.summaryText}
          <textarea readOnly rows={10} value={summaryBox} className="rounded-md border border-line bg-surface p-2 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
        </label>
      )}

      <Section id="recent" title={LABELS.recent}>
        <RecentList sessions={sessions} />
      </Section>
    </div>
  );
}

function PlanList({ plan }: { plan: readonly Lesson[] }) {
  return (
    <ol className="flex flex-col gap-1 text-sm">
      {plan.map((l) => (
        <li key={l.id} data-lesson={l.id} className="flex justify-between gap-2">
          <span>{l.title}</span>
          <span className="text-muted">{LABELS.minutes(l.minutes)}</span>
        </li>
      ))}
    </ol>
  );
}

function RecentList({ sessions }: { sessions: readonly Session[] }) {
  const recent = dailySessions(sessions).slice(0, 7);
  if (recent.length === 0) return <p className="text-sm text-muted">{LABELS.noRecent}</p>;
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {recent.map((s) => (
        <li key={s.id} data-session={s.id} data-finished={s.finishedAt !== undefined} className="flex justify-between gap-2">
          <span>{dayKey(s.startedAt)}</span>
          <span className="text-muted">
            {s.finishedAt === undefined
              ? LABELS.unfinished
              : Object.entries(s.scores)
                  .map(([mode, v]) => `${mode} ${percent(v)}`)
                  .join(' ') || LABELS.done}
          </span>
        </li>
      ))}
    </ul>
  );
}

function StepLine({ step, state, score }: { step: LessonStep; state: 'done' | 'skipped' | 'todo'; score?: string }) {
  return (
    <div data-step-state={state} className="flex justify-between gap-2 text-sm">
      <span className={state === 'todo' ? '' : 'text-muted'}>{step.kind === 'card' ? step.title : step.mode}</span>
      <span className="text-muted">
        {state === 'done' ? (score ? `${LABELS.done} ${score}` : LABELS.done) : state === 'skipped' ? LABELS.skipped : ''}
      </span>
    </div>
  );
}

function ActiveSession({
  session,
  now,
  fast,
  busy,
  run,
  update,
  routeOf,
  attempts,
}: {
  session: Session;
  attempts: readonly Attempt[];
  now: number;
  fast: boolean;
  busy: boolean;
  run: (next: () => Promise<unknown>) => Promise<void>;
  update: RunnerHandle['update'];
  routeOf: (module: string) => string | undefined;
}) {
  const at = activeStep(session);
  const segments = session.segments ?? [];
  return (
    <Section id="session" title={LABELS.resumeSession}>
      <ol className="flex flex-col gap-3">
        {segments.map((seg, si) => {
          const lesson = lessonById(seg.lessonId);
          const isActive = at?.segment === si;
          return (
            <li key={si} data-segment={seg.lessonId} data-active={isActive} className={`flex flex-col gap-2 rounded-md border p-2 ${isActive ? 'border-text' : 'border-line'}`}>
              <div className="flex justify-between gap-2 text-sm font-semibold">
                <span>{lesson?.title ?? seg.lessonId}</span>
                <span data-countdown="" className="font-normal text-muted">
                  {seg.finishedAt !== undefined || !lesson ? (seg.skipped ? LABELS.skipped : LABELS.done) : formatCountdown(isActive ? secondsLeft(lesson.minutes, fast, seg.startedAt, now) : countdownSeconds(lesson.minutes, fast))}
                </span>
              </div>
              {lesson && (
                <ol className="flex flex-col gap-1">
                  {lesson.steps.map((step, i) => {
                    const st = seg.steps?.[i];
                    const state = st?.done ? 'done' : st?.skipped ? 'skipped' : 'todo';
                    const current = isActive && at.step === i;
                    return (
                      <li key={i}>
                        <StepLine step={step} state={state} score={doneStepScore(session.id, step, i, st, attempts)} />
                        {current && (
                          <CurrentStep
                            session={session}
                            segment={si}
                            index={i}
                            lesson={lesson}
                            step={step}
                            fast={fast}
                            busy={busy}
                            run={run}
                            update={update}
                            route={step.kind === 'drill' ? routeOf(step.module) : undefined}
                          />
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </li>
          );
        })}
      </ol>
    </Section>
  );
}

function CurrentStep({
  session,
  segment,
  index,
  lesson,
  step,
  fast,
  busy,
  run,
  update,
  route,
}: {
  session: Session;
  segment: number;
  index: number;
  lesson: Lesson;
  step: LessonStep;
  fast: boolean;
  busy: boolean;
  run: (next: () => Promise<unknown>) => Promise<void>;
  update: RunnerHandle['update'];
  route: string | undefined;
}) {
  const skip = () => run(() => update(patchStep(session, segment, index, { skipped: true })));

  if (step.kind === 'card') {
    return (
      <div data-current="card" className="mt-1 flex flex-col gap-2 rounded-md bg-bg p-2">
        <Markdown source={step.body} />
        <button type="button" data-action="next" className={`${BTN} self-start`} disabled={busy} onClick={() => void run(() => update(patchStep(session, segment, index, { done: true })))}>
          {LABELS.next}
        </button>
      </div>
    );
  }
  if (route === undefined) {
    return (
      <div data-current="stub" className="mt-1 flex flex-col gap-2 rounded-md bg-bg p-2">
        <p className="text-sm text-muted">
          {step.module}: {LABELS.stub}
        </p>
        <button type="button" data-action="skip" className={`${BTN} self-start`} disabled={busy} onClick={() => void skip()}>
          {LABELS.skip}
        </button>
      </div>
    );
  }
  const open = () =>
    run(async () => {
      const next = await update(launchStep(session, segment, index, Date.now()));
      navigate(route, drillQuery(drillLaunch(step, index, lesson.id, next.id, fast)));
    });
  return (
    <div data-current="drill" className="mt-1 flex gap-2 rounded-md bg-bg p-2">
      <button type="button" data-action="open-drill" className={BTN} disabled={busy} onClick={() => void open()}>
        {LABELS.openDrill}
      </button>
      <button type="button" data-action="skip" className={BTN} disabled={busy} onClick={() => void skip()}>
        {LABELS.skip}
      </button>
    </div>
  );
}
