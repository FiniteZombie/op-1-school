import { lazy } from 'react';
import { expect, test } from 'vitest';
import { DRILL_MODULE_IDS } from '../lessons';
import { MODULE_IDS, type ModuleDefinition } from '../modules';

test('a module.ts in the SPEC §5.5 shape type-checks as a ModuleDefinition', () => {
  const module = {
    id: 'dev-spine',
    route: '/dev/spine',
    title: 'dev spine',
    icon: 'd',
    component: lazy(() => Promise.resolve({ default: () => null })),
    phase: 1,
    devOnly: true,
  } satisfies ModuleDefinition;
  expect(module.id).toBe('dev-spine');
});

test('drills can target every module except dev-spine and the runner', () => {
  expect(DRILL_MODULE_IDS).toEqual(MODULE_IDS.filter((id) => id !== 'dev-spine' && id !== 'runner'));
  expect(DRILL_MODULE_IDS).toEqual(['progression-trainer', 'sample-flip', 'pocket-dojo', 'kit-compiler']);
});
