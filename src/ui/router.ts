/**
 * Decision 9's router, the pure part: paths are relative to Vite's `base`
 * (`/op-1-school/`), `?dev` survives in-app navigation, and `devOnly` modules
 * are hidden (nav entry and route) without it. `navigation.tsx` wires this to
 * the History API.
 */
import type { ModuleDefinition } from '../types/modules';

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

/** The URL for an app path: base + path, plus `?dev` when in dev mode. */
export function hrefFor(path: string, base: string, dev: boolean): string {
  const baseSlash = base.endsWith('/') ? base : `${base}/`;
  const rel = path.replace(/^\/+/, '');
  return `${baseSlash}${rel}${dev ? '?dev' : ''}`;
}

/** The modules the nav shows: `devOnly` ones only with `?dev`. */
export function visibleModules(modules: readonly ModuleDefinition[], dev: boolean): ModuleDefinition[] {
  return modules.filter((m) => dev || !m.devOnly);
}

export type Resolved =
  | { kind: 'home' }
  | { kind: 'module'; module: ModuleDefinition }
  | { kind: 'not-found' };

/** `/` is home; a visible module's `route` is that module; anything else is not found. */
export function resolveRoute(path: string, modules: readonly ModuleDefinition[], dev: boolean): Resolved {
  if (path === '/') return { kind: 'home' };
  const found = visibleModules(modules, dev).find((m) => appPath(m.route, '/') === path);
  return found ? { kind: 'module', module: found } : { kind: 'not-found' };
}
