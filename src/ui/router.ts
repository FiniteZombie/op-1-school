/**
 * Decision 9's router, the pure part: paths are relative to Vite's `base`
 * (`/op-1-school/`), `?dev` (and `fast`, only alongside `dev`) survive in-app
 * navigation, and `devOnly` modules are hidden (nav entry and route) without
 * `dev`. `navigation.tsx` wires this to the History API.
 */
import type { ModuleDefinition, ModuleId } from '../types/modules';

/** `/op-1-school/dev/spine/` with base `/op-1-school/` → `/dev/spine`. Outside the base → as is. */
export function appPath(pathname: string, base: string): string {
  const baseNoSlash = base.endsWith('/') ? base.slice(0, -1) : base;
  let path = pathname;
  if (baseNoSlash && (path === baseNoSlash || path.startsWith(`${baseNoSlash}/`))) {
    path = path.slice(baseNoSlash.length);
  }
  if (!path.startsWith('/')) path = `/${path}`;
  if (path.length > 1 && path.endsWith('/')) path = path.replace(/\/+$/, '') || '/';
  return path;
}

/** True when the query string has `dev` (with or without a value). */
export function isDev(search: string): boolean {
  return new URLSearchParams(search).has('dev');
}

/** True when the query string has both `dev` and `fast`: `fast` means nothing without `dev`. */
export function isFast(search: string): boolean {
  const p = new URLSearchParams(search);
  return p.has('dev') && p.has('fast');
}

export interface AppLocation {
  /** Relative to the base, e.g. `/dev/spine`; `/` is home. */
  path: string;
  /** `?dev` is in the URL. */
  dev: boolean;
  /** `fast` is in the URL alongside `dev` (the Runner's time divider). */
  fast: boolean;
  /** Every query parameter but `dev` and `fast`, first value of each, in URL order. */
  query: Readonly<Record<string, string>>;
}

/** The app location of a URL's pathname and search. */
export function parseLocation(pathname: string, search: string, base: string): AppLocation {
  const first = new Map<string, string>();
  for (const [k, v] of new URLSearchParams(search)) {
    if (k !== 'dev' && k !== 'fast' && !first.has(k)) first.set(k, v);
  }
  // `fromEntries` makes own properties, so a `__proto__` parameter stays data.
  const query = Object.fromEntries(first);
  return { path: appPath(pathname, base), dev: isDev(search), fast: isFast(search), query };
}

/**
 * The URL for an app path: base + path, then `query` in insertion order, then
 * `dev`, then `fast` (only with `dev`). `dev` and `fast` keys in `query` are
 * ignored; the flags decide them.
 */
export function hrefFor(
  path: string,
  base: string,
  dev: boolean,
  query: Readonly<Record<string, string>> = {},
  fast = false,
): string {
  const baseSlash = base.endsWith('/') ? base : `${base}/`;
  const rel = path.replace(/^\/+/, '');
  const parts = Object.entries(query)
    .filter(([k]) => k !== 'dev' && k !== 'fast')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  if (dev) parts.push('dev');
  if (dev && fast) parts.push('fast');
  return `${baseSlash}${rel}${parts.length ? `?${parts.join('&')}` : ''}`;
}

/** The modules the nav shows: `devOnly` ones only with `?dev`. */
export function visibleModules(modules: readonly ModuleDefinition[], dev: boolean): ModuleDefinition[] {
  return modules.filter((m) => dev || !m.devOnly);
}

/** What a module learns about the others (decision 10): which exist here, and where. */
export interface AvailableModule {
  id: ModuleId;
  route: string;
}

/** The visible modules as `{ id, route }`, for `useAvailableModules()`. */
export function availableFrom(modules: readonly ModuleDefinition[], dev: boolean): AvailableModule[] {
  return visibleModules(modules, dev).map(({ id, route }) => ({ id, route }));
}

export type Resolved =
  | { kind: 'home' }
  | { kind: 'module'; module: ModuleDefinition }
  | { kind: 'not-found' };

/**
 * `/` is the Runner when it's registered (decision 9), else home; a visible
 * module's `route` is that module; anything else is not found.
 */
export function resolveRoute(path: string, modules: readonly ModuleDefinition[], dev: boolean): Resolved {
  const visible = visibleModules(modules, dev);
  if (path === '/') {
    const runner = visible.find((m) => m.id === 'runner');
    return runner ? { kind: 'module', module: runner } : { kind: 'home' };
  }
  const found = visible.find((m) => appPath(m.route, '/') === path);
  return found ? { kind: 'module', module: found } : { kind: 'not-found' };
}
