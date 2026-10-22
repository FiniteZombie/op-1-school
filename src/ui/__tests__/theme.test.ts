import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SETTINGS_KEY } from '../../state/settings';
import { THEME_COLORS, applyTheme, otherTheme, themeFromStored } from '../theme';

const root = resolve(import.meta.dirname, '../../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

function fakeDoc(initialDark = true) {
  const classes = new Set(initialDark ? ['dark'] : []);
  const metas: Record<string, string> = { 'color-scheme': 'dark', 'theme-color': '#000000' };
  return {
    classes,
    metas,
    documentElement: {
      classList: {
        toggle(name: string, force: boolean) {
          if (force) classes.add(name);
          else classes.delete(name);
          return force;
        },
      },
    },
    querySelector(selector: string) {
      const name = /name="([^"]+)"/.exec(selector)?.[1];
      if (!name || !(name in metas)) return null;
      return {
        setAttribute(_attr: string, value: string) {
          metas[name] = value;
        },
      };
    },
  };
}

/** Runs index.html's inline theme script against a fake document and localStorage. */
function runInlineScript(stored: string | null) {
  const html = read('index.html');
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
  if (!script) throw new Error('index.html has no inline script');
  const doc = fakeDoc(true);
  const storage = { getItem: (k: string) => (k === SETTINGS_KEY ? stored : null) };
  new Function('document', 'localStorage', script)(doc, storage);
  return doc;
}

describe('theme', () => {
  it('themeFromStored: light only when the settings say so', () => {
    expect(themeFromStored(null)).toBe('dark');
    expect(themeFromStored('{not json')).toBe('dark');
    expect(themeFromStored('{"theme":"light"}')).toBe('light');
    expect(themeFromStored('{"theme":"dark"}')).toBe('dark');
    expect(themeFromStored('{"theme":"sepia"}')).toBe('dark');
    expect(themeFromStored('null')).toBe('dark');
  });

  it('applyTheme sets the class and both metas', () => {
    const doc = fakeDoc(true);
    applyTheme('light', doc);
    expect(doc.classes.has('dark')).toBe(false);
    expect(doc.metas).toEqual({ 'color-scheme': 'light', 'theme-color': THEME_COLORS.light });
    applyTheme('dark', doc);
    expect(doc.classes.has('dark')).toBe(true);
    expect(doc.metas).toEqual({ 'color-scheme': 'dark', 'theme-color': THEME_COLORS.dark });
    expect(otherTheme('dark')).toBe('light');
  });

  it("index.html's inline script agrees with themeFromStored + applyTheme", () => {
    for (const stored of [null, '{not json', '{"theme":"light"}', '{"version":1,"theme":"dark"}', '"light"']) {
      const fromScript = runInlineScript(stored);
      const expected = fakeDoc(true);
      applyTheme(themeFromStored(stored), expected);
      expect({ dark: fromScript.classes.has('dark'), metas: fromScript.metas }).toEqual({
        dark: expected.classes.has('dark'),
        metas: expected.metas,
      });
    }
  });

  it('index.html: dark by default, the theme script before the module script', () => {
    const html = read('index.html');
    expect(html).toMatch(/<html[^>]*class="dark"/);
    expect(html).toContain('<meta name="color-scheme" content="dark" />');
    expect(html).toContain(`<meta name="theme-color" content="${THEME_COLORS.dark}" />`);
    expect(html).toContain(`'${SETTINGS_KEY}'`);
    const inline = html.indexOf('<script>');
    const moduleScript = html.indexOf('<script type="module"');
    expect(inline).toBeGreaterThan(-1);
    expect(inline).toBeLessThan(moduleScript);
  });

  it('the colours match tokens.css and the manifest', () => {
    const css = read('src/ui/tokens.css');
    const bgs = [...css.matchAll(/--op-bg:\s*(#[0-9a-fA-F]{6});/g)].map((m) => m[1]);
    expect(bgs).toEqual([THEME_COLORS.light, THEME_COLORS.dark]); // :root (light), then :root.dark
    expect(read('vite.config.ts')).toContain(`const themeColor = '${THEME_COLORS.dark}';`);
  });
});
