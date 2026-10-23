// The library: every lesson by vector; opening one shows its cards with no
// session, cable or completed level needed. Its state is in the URL
// (`?view=library&open=<lesson id>`), so back and reload work.

import { lessonById, lessons as allLessons } from '../../curriculum';
import type { Attempt } from '../../state/db';
import type { DrillStep, Lesson } from '../../types/lessons';
import { useAvailableModules } from '../../ui/availableModules';
import { Link, useLocation } from '../../ui/navigation';
import { Markdown } from './Cards';
import { lessonLocked } from './gates';
import { LABELS } from './labels';
import { drillOffer, libraryGroups } from './libraryLogic';
import { drillLaunch, drillQuery, RUNNER_ROUTE } from './session';

const LINK = 'rounded-md border border-line bg-bg px-3 py-2 text-sm text-text';

export function Library({ attempts }: { attempts: readonly Attempt[] }) {
  const { query, dev, fast } = useLocation();
  const lessons = allLessons();
  const available = useAvailableModules();
  const open = query.open === undefined ? undefined : lessonById(query.open);
  const ids = new Set<string>(available.map((m) => m.id));

  if (open) {
    return (
      <div data-view="lesson" className="flex flex-col gap-3">
        <Link to={RUNNER_ROUTE} query={{ view: 'library' }} className={`${LINK} self-start`}>
          {LABELS.back}
        </Link>
        <h2 className="text-lg font-bold">{open.title}</h2>
        {open.steps.map((step, i) => (
          <section key={i} className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3">
            {step.kind === 'card' ? (
              <>
                <h3 className="font-semibold">{step.title}</h3>
                <Markdown source={step.body} />
              </>
            ) : (
              <LibraryDrill
                step={step}
                index={i}
                lesson={open}
                offer={drillOffer(step.module, open, lessons, attempts, ids, dev)}
                route={available.find((m) => m.id === step.module)?.route}
                fast={fast}
              />
            )}
          </section>
        ))}
      </div>
    );
  }

  return (
    <div data-view="library" className="flex flex-col gap-4">
      <Link to={RUNNER_ROUTE} className={`${LINK} self-start`}>
        {LABELS.back}
      </Link>
      {lessons.length === 0 && <p className="text-muted">{LABELS.noLessons}</p>}
      {libraryGroups(lessons).map((g) => (
        <section key={g.vector} data-vector={g.vector} className="flex flex-col gap-2">
          <h2 className="text-base font-bold">{LABELS.vectorHeading(g.vector)}</h2>
          <ul className="flex flex-col gap-2">
            {g.lessons.map((l) => (
              <li key={l.id}>
                <Link to={RUNNER_ROUTE} query={{ view: 'library', open: l.id }} className={`${LINK} flex justify-between gap-2`}>
                  <span>{l.title}</span>
                  {lessonLocked(l, lessons, attempts, ids, dev) && <span className="text-muted">{LABELS.locked}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function LibraryDrill({
  step,
  index,
  lesson,
  offer,
  route,
  fast,
}: {
  step: DrillStep;
  index: number;
  lesson: Lesson;
  offer: 'launch' | 'locked' | 'stub';
  route: string | undefined;
  fast: boolean;
}) {
  const head = (
    <h3 className="font-semibold">
      {step.mode} <span className="font-normal text-muted">{LABELS.minutes(step.minutes)}</span>
    </h3>
  );
  if (offer === 'stub') {
    return (
      <>
        {head}
        <p className="text-muted">{LABELS.stub}</p>
      </>
    );
  }
  if (offer === 'locked' || route === undefined) {
    return (
      <>
        {head}
        <p data-state="locked" className="text-muted">
          {LABELS.locked}
        </p>
      </>
    );
  }
  return (
    <>
      {head}
      <Link to={route} query={drillQuery(drillLaunch(step, index, lesson.id, undefined, fast))} className={`${LINK} self-start`}>
        {LABELS.practice}
      </Link>
    </>
  );
}
