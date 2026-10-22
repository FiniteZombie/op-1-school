/**
 * In-app navigation over the History API (decision 9). Paths are app paths
 * (`/dev/spine`), relative to Vite's `base`; `?dev` is kept on every in-app
 * link. Modules link to each other's routes with `Link` or `navigate`, never
 * by importing each other.
 */
import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from 'react';
import { appPath, hrefFor, isDev } from './router';

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

export interface AppLocation {
  /** Relative to the base, e.g. `/dev/spine`; `/` is home. */
  path: string;
  /** `?dev` is in the URL. */
  dev: boolean;
}

export function currentLocation(): AppLocation {
  return { path: appPath(location.pathname, BASE), dev: isDev(location.search) };
}

/** Re-renders on every navigation. */
export function useLocation(): AppLocation {
  const key = useSyncExternalStore(subscribe, snapshot);
  const q = key.indexOf('?');
  const pathname = q < 0 ? key : key.slice(0, q);
  const search = q < 0 ? '' : key.slice(q);
  return { path: appPath(pathname, BASE), dev: isDev(search) };
}

/** The href for an app path, keeping `?dev` if the current URL has it. */
export function hrefTo(path: string): string {
  return hrefFor(path, BASE, isDev(location.search));
}

/** Pushes an app path (keeping `?dev`). */
export function navigate(path: string): void {
  const href = hrefTo(path);
  if (href !== snapshot()) history.pushState(null, '', href);
  notify();
}

export interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  /** An app path, e.g. `/` or `/dev/spine`. */
  to: string;
  children?: ReactNode;
}

/** An anchor that navigates in-app on a plain left click. */
export function Link({ to, onClick, children, ...rest }: LinkProps) {
  useLocation(); // so the href follows `?dev`
  function handle(e: MouseEvent<HTMLAnchorElement>): void {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(to);
  }
  return (
    <a href={hrefTo(to)} onClick={handle} {...rest}>
      {children}
    </a>
  );
}
