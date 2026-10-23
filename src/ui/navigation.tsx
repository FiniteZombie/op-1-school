/**
 * In-app navigation over the History API (decision 9). Paths are app paths
 * (`/dev/spine`), relative to Vite's `base`; `?dev`, and `fast` alongside it,
 * are kept on every in-app link. Modules link to each other's routes with
 * `Link` or `navigate`, never by importing each other.
 */
import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from 'react';
import { hrefFor, isDev, isFast, parseLocation, type AppLocation } from './router';

export type { AppLocation } from './router';

const BASE = import.meta.env.BASE_URL;

const listeners = new Set<() => void>();

function notify(): void {
  for (const cb of [...listeners]) cb();
}

function subscribe(cb: () => void): () => void {
  if (listeners.size === 0) window.addEventListener('popstate', notify);
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) window.removeEventListener('popstate', notify);
  };
}

function snapshot(): string {
  return `${location.pathname}${location.search}`;
}

// One `AppLocation` per URL, so `query` keeps its identity across renders and is safe in effect deps.
let cached: { key: string; loc: AppLocation } | undefined;

function locationOf(key: string): AppLocation {
  if (cached?.key !== key) {
    const q = key.indexOf('?');
    const pathname = q < 0 ? key : key.slice(0, q);
    const search = q < 0 ? '' : key.slice(q);
    cached = { key, loc: parseLocation(pathname, search, BASE) };
  }
  return cached.loc;
}

export function currentLocation(): AppLocation {
  return locationOf(snapshot());
}

/** Re-renders on every navigation. */
export function useLocation(): AppLocation {
  return locationOf(useSyncExternalStore(subscribe, snapshot));
}

/** The href for an app path and query, keeping `?dev` (and `fast`) if the current URL has them. */
export function hrefTo(path: string, query?: Readonly<Record<string, string>>): string {
  return hrefFor(path, BASE, isDev(location.search), query, isFast(location.search));
}

/** Pushes an app path with an optional query (keeping `?dev` and `fast`). */
export function navigate(path: string, query?: Readonly<Record<string, string>>): void {
  const href = hrefTo(path, query);
  if (href !== snapshot()) history.pushState(null, '', href);
  notify();
}

export interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  /** An app path, e.g. `/` or `/dev/spine`. */
  to: string;
  /** Query parameters, written before `dev` and `fast`. */
  query?: Readonly<Record<string, string>>;
  children?: ReactNode;
}

/** An anchor that navigates in-app on a plain left click. */
export function Link({ to, query, onClick, children, ...rest }: LinkProps) {
  useLocation(); // so the href follows `?dev`
  function handle(e: MouseEvent<HTMLAnchorElement>): void {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(to, query);
  }
  return (
    <a href={hrefTo(to, query)} onClick={handle} {...rest}>
      {children}
    </a>
  );
}
