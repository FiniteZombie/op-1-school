/**
 * The app's frame (SPEC §5.4): nav, StatusBar, the app-wide power warning,
 * and the routed page; everything but the nav sits in an `ErrorBoundary`,
 * so a render error leaves the nav working. The nav sits at the bottom under 700 px of viewport
 * width and at the side from 700 px (`nav:` in tokens.css); its title links
 * home, then one entry per visible module (registry order), then the bug
 * button and the theme toggle. Each route change goes into the diagnostics
 * log. Routes come from the registry (decision 9's router), `/` is the
 * Runner once it's registered, and the shell provides the visible modules to
 * `useAvailableModules()` (decision 10); `devOnly`
 * modules, nav entry and route, need `?dev`; anything else shows
 * `no page here`.
 */
import { Suspense, useEffect, useMemo } from 'react';
import { modules } from '../modules/registry';
import type { ModuleDefinition } from '../types/modules';
import { AvailableModulesProvider } from './availableModules';
import { BugReport } from './BugReport';
import { COPY } from './copy';
import { logRoute } from './diagnosticsCapture';
import { ErrorBoundary } from './ErrorBoundary';
import { Link, useLocation } from './navigation';
import { PowerWarning } from './PowerWarning';
import { availableFrom, resolveRoute, visibleModules } from './router';
import { StatusBar } from './StatusBar';
import { ThemeToggle } from './ThemeToggle';

function NavEntry({ module, active }: { module: ModuleDefinition; active: boolean }) {
  return (
    <Link
      to={module.route}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${active ? 'bg-bg font-semibold text-text' : 'text-muted'}`}
    >
      <span aria-hidden="true" className="text-base">
        {module.icon}
      </span>
      <span className="hidden nav:inline">{module.title}</span>
      <span className="sr-only nav:hidden">{module.title}</span>
    </Link>
  );
}

function Page({ path, dev }: { path: string; dev: boolean }) {
  const resolved = resolveRoute(path, modules, dev);
  if (resolved.kind === 'home') {
    return <p className="p-4 text-muted">{COPY.home}</p>;
  }
  if (resolved.kind === 'not-found') {
    return <p className="p-4 text-muted">{COPY.notFound}</p>;
  }
  const View = resolved.module.component;
  return (
    <Suspense fallback={null}>
      <View />
    </Suspense>
  );
}

export function AppShell() {
  const { path, dev } = useLocation();
  const entries = visibleModules(modules, dev);
  const available = useMemo(() => availableFrom(modules, dev), [dev]);
  // useLocation re-renders on every navigation, query changes included.
  const route = `${path}${window.location.search}`;
  useEffect(() => logRoute(route), [route]);

  return (
    <AvailableModulesProvider modules={available}>
      <div className="flex h-dvh flex-col bg-bg text-text nav:flex-row">
        <nav
          aria-label="main"
          className="order-last flex shrink-0 items-center gap-1 overflow-x-auto border-t border-line bg-surface px-2 py-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] nav:order-first nav:w-52 nav:flex-col nav:items-stretch nav:overflow-y-auto nav:border-t-0 nav:border-r nav:p-3"
        >
          <Link to="/" aria-current={path === '/' ? 'page' : undefined} className="px-3 py-2 text-sm font-bold text-text nav:mb-2 nav:text-base">
            {COPY.navTitle}
          </Link>
          {entries.map((m) => (
            <NavEntry key={m.id} module={m} active={path === m.route} />
          ))}
          <div className="ml-auto flex shrink-0 items-center gap-1 nav:mt-auto nav:ml-0 nav:flex-col nav:items-stretch">
            <BugReport page={route} />
            <ThemeToggle className="shrink-0" />
          </div>
        </nav>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <ErrorBoundary resetKey={path}>
            <StatusBar />
            <PowerWarning />
            <main className="min-h-0 flex-1 overflow-y-auto">
              <Page path={path} dev={dev} />
            </main>
          </ErrorBoundary>
        </div>
      </div>
    </AvailableModulesProvider>
  );
}
