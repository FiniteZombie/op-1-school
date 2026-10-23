import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { checkImports, readTree, specifiers } from './importRule';

const SRC = resolve(import.meta.dirname, '../..');

describe('the import rule', () => {
  it('holds for every file under src/', () => {
    const files = readTree(SRC);
    expect(files.has('ui/AppShell.tsx')).toBe(true);
    // This file's scratch-tree fixtures are strings that look like broken imports.
    files.delete('modules/__tests__/importRule.test.ts');
    expect(checkImports(files)).toEqual([]);
  });

  describe('on a scratch tree', () => {
    const dir = mkdtempSync(join(tmpdir(), 'op1-import-rule-'));
    afterAll(() => rmSync(dir, { recursive: true, force: true }));

    const write = (path: string, text: string) => {
      const full = join(dir, path);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, text);
    };

    write('ui/AppShell.tsx', "import { modules } from '../modules/registry';\n");
    write('ui/Keyboard24.tsx', 'export const k = 1;\n');
    write('modules/registry.ts', "const found = import.meta.glob('./*/module.ts');\n");
    write('modules/__tests__/registry.test.ts', "import { modules } from '../registry';\n");
    write(
      'modules/alpha/View.tsx',
      [
        "import { k } from '../../ui/Keyboard24';",
        "import { realize } from '../../theory';",
        "import { beta } from '../beta';",
        "import data from '../../curriculum/lessons/a.json';",
        "import { helper } from './helper';",
        "import React from 'react';",
        '// import { x } from "../beta/View";',
        "import {\n  thing,\n} from '../beta/thing';",
        "export { other } from '../beta/other';",
        "const lazyBeta = import('../beta/View');",
        "import '../registry';",
        "import App from '../../App';",
      ].join('\n'),
    );
    write('modules/alpha/helper.ts', 'export const helper = 1;\n');
    write('modules/beta/thing.ts', 'export const thing = 1;\n');
    write('audio/x.ts', "import { helper } from '../modules/alpha/helper';\n");
    write('App.tsx', "import { modules } from './modules/registry';\n");

    it('reports each broken import and nothing else', () => {
      expect(checkImports(readTree(dir))).toEqual([
        "App.tsx imports './modules/registry': only src/ui/AppShell.tsx imports the registry",
        "audio/x.ts imports '../modules/alpha/helper': nothing outside src/modules/alpha/ imports it",
        "modules/alpha/View.tsx imports '../../App': a module imports only from the spine, its own directory and src/curriculum/",
        "modules/alpha/View.tsx imports '../beta': a module never imports another module",
        "modules/alpha/View.tsx imports '../beta/View': a module never imports another module",
        "modules/alpha/View.tsx imports '../beta/other': a module never imports another module",
        "modules/alpha/View.tsx imports '../beta/thing': a module never imports another module",
        "modules/alpha/View.tsx imports '../registry': only src/ui/AppShell.tsx imports the registry",
      ]);
    });
  });

  it('reads static, multi-line, side-effect, dynamic and re-export specifiers', () => {
    expect(
      specifiers(
        "import a from './a';\nimport type { B } from \"./b\";\nimport {\n c,\n} from './c';\nimport './d.css';\nconst e = import('./e');\nexport * from './f';\n/* import g from './g'; */",
      ),
    ).toEqual(['./a', './b', './c', './f', './d.css', './e']);
  });
});
