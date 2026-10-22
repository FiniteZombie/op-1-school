import { readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(import.meta.dirname, '..');

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

describe('file names under src/', () => {
  // Windows and macOS resolve imports case-insensitively, so `./AudioGate` can
  // pick up `audioGate.ts` there while Linux (CI, cloud runs) picks the `.tsx`.
  it('never differ only in case once the extension is dropped', () => {
    const seen = new Map<string, string[]>();
    for (const file of walk(SRC)) {
      const path = relative(SRC, file).replaceAll('\\', '/');
      if (!/\.tsx?$/.test(path)) continue;
      const key = path.replace(/\.tsx?$/, '').toLowerCase();
      seen.set(key, [...(seen.get(key) ?? []), path]);
    }
    const clashes = [...seen.values()].filter((paths) => paths.length > 1);
    expect(clashes).toEqual([]);
  });
});
