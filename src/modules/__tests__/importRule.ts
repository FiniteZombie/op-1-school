/**
 * The import rule (AGENTS.md, SPEC §0), as a checker over a source tree:
 *
 * - A module (`src/modules/<id>/`) imports only from the spine
 *   (`src/{types,theory,audio,input,state,ui}`), its own directory, and
 *   `src/curriculum/` (data; Phase 2 creates it). Never from another module,
 *   `registry.ts`, or anything else under `src/`. Packages are not this
 *   rule's business (AGENTS.md "Dependencies" is).
 * - Nothing outside a module's directory imports from it: not the spine, not
 *   `App.tsx`, not another module.
 * - Only `src/ui/AppShell.tsx` (and the registry's own tests in
 *   `src/modules/__tests__/`) import `src/modules/registry.ts`.
 *
 * Specifiers are read with regexes (static, side-effect, dynamic imports and
 * re-exports), after block comments and `//` comment lines are dropped.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';

export const SPINE_DIRS = ['types', 'theory', 'audio', 'input', 'state', 'ui'] as const;
const SOURCE = /\.(ts|tsx|mts|js|jsx)$/;

/** Every source file under `dir`, keyed by its path relative to `dir` (POSIX separators). */
export function readTree(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const full = join(d, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (SOURCE.test(name)) out.set(relative(dir, full).split(sep).join('/'), readFileSync(full, 'utf8'));
    }
  };
  walk(dir);
  return out;
}

/** The import specifiers in a source file. */
export function specifiers(text: string): string[] {
  const code = text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
  const found: string[] = [];
  const patterns = [
    /\b(?:import|export)\s[^'";]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) for (const m of code.matchAll(re)) found.push(m[1] as string);
  return found;
}

type Area =
  | { kind: 'module'; id: string }
  | { kind: 'registry' }
  | { kind: 'registry-tests' }
  | { kind: 'spine' }
  | { kind: 'curriculum' }
  | { kind: 'other' };

function areaOf(srcPath: string): Area {
  const parts = srcPath.split('/');
  const [first, second] = parts;
  if (first === 'modules') {
    if (parts.length === 2 && /^registry(\.tsx?)?$/.test(second ?? '')) return { kind: 'registry' };
    if (second === '__tests__') return { kind: 'registry-tests' };
    if (second) return { kind: 'module', id: second };
    return { kind: 'other' };
  }
  // A bare directory ('../../theory') is its index.ts barrel.
  if ((SPINE_DIRS as readonly string[]).includes(first ?? '')) return { kind: 'spine' };
  if (first === 'curriculum') return { kind: 'curriculum' };
  return { kind: 'other' };
}

/** The import's target relative to `src/`, or null for a package (or a path outside `src/`). */
function resolveSpecifier(fromPath: string, spec: string): string | null {
  const clean = spec.replace(/[?#].*$/, '');
  let target: string;
  if (clean.startsWith('/src/')) target = clean.slice('/src/'.length);
  else if (clean.startsWith('.')) target = posix.normalize(posix.join(posix.dirname(fromPath), clean));
  else return null;
  return target.startsWith('..') ? null : target;
}

/** Every import that breaks the rule, as `<file> imports '<spec>': <why>`. Files are keyed relative to `src/`. */
export function checkImports(files: ReadonlyMap<string, string>): string[] {
  const problems: string[] = [];
  for (const [file, text] of files) {
    const from = areaOf(file);
    for (const spec of specifiers(text)) {
      const target = resolveSpecifier(file, spec);
      if (target === null) continue;
      const to = areaOf(target);
      const report = (why: string) => problems.push(`${file} imports '${spec}': ${why}`);

      if (to.kind === 'registry') {
        if (file !== 'ui/AppShell.tsx' && from.kind !== 'registry-tests') {
          report('only src/ui/AppShell.tsx imports the registry');
        }
        continue;
      }
      if (to.kind === 'module' && !(from.kind === 'module' && from.id === to.id)) {
        report(from.kind === 'module' ? 'a module never imports another module' : `nothing outside src/modules/${to.id}/ imports it`);
        continue;
      }
      if (from.kind === 'module' && to.kind !== 'module' && to.kind !== 'spine' && to.kind !== 'curriculum') {
        report('a module imports only from the spine, its own directory and src/curriculum/');
      }
    }
  }
  return problems.sort();
}
