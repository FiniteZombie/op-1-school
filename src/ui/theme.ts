/**
 * The theme (dark by default, a toggle to light; the choice lives in
 * settings). `index.html` has an inline copy of `themeFromStored` +
 * `applyTheme` that runs before first paint; this file keeps the page in step
 * when the setting changes. A test checks the two agree, and that the colours
 * below match `tokens.css` and `vite.config.ts`.
 */
import type { Theme } from '../state/settings';

/** placeholder: each theme's background (`--op-bg` in tokens.css); also `<meta name="theme-color">`. */
export const THEME_COLORS: Readonly<Record<Theme, string>> = Object.freeze({
  dark: '#111111',
  light: '#dcdcd7',
});

/** The stored settings JSON → theme: `light` only when it says so; missing or unreadable means dark. */
export function themeFromStored(text: string | null): Theme {
  try {
    const parsed: unknown = text ? JSON.parse(text) : null;
    if (typeof parsed === 'object' && parsed !== null && (parsed as { theme?: unknown }).theme === 'light') {
      return 'light';
    }
  } catch {
    // corrupt JSON: dark
  }
  return 'dark';
}

/** The slice of `Document` `applyTheme` touches (tests pass a fake). */
export interface ThemeDocument {
  documentElement: { classList: { toggle(name: string, force: boolean): unknown } };
  querySelector(selector: string): { setAttribute(name: string, value: string): void } | null;
}

/** Sets the `dark` class on `<html>`, `<meta name="color-scheme">` and `<meta name="theme-color">`. */
export function applyTheme(theme: Theme, doc: ThemeDocument = document): void {
  doc.documentElement.classList.toggle('dark', theme === 'dark');
  doc.querySelector('meta[name="color-scheme"]')?.setAttribute('content', theme);
  doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
}

/** The theme the toggle switches to. */
export function otherTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark';
}
