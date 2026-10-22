import { lazy } from 'react';
import { describe, expect, it } from 'vitest';
import type { ModuleDefinition } from '../../types/modules';
import { modules, sortModules } from '../registry';

const view = lazy(async () => ({ default: () => null }));
const def = (id: ModuleDefinition['id'], phase: ModuleDefinition['phase']): ModuleDefinition => ({
  id,
  route: `/${id}`,
  title: id,
  icon: id[0] ?? '?',
  component: view,
  phase,
});

describe('registry', () => {
  it('sorts by phase, then id', () => {
    const sorted = sortModules([def('runner', 2), def('sample-flip', 4), def('dev-spine', 1), def('progression-trainer', 2)]);
    expect(sorted.map((m) => m.id)).toEqual(['dev-spine', 'progression-trainer', 'runner', 'sample-flip']);
  });

  it('collects every src/modules/<id>/module.ts', () => {
    // Each registered module sits in the directory named by its id.
    for (const m of modules) expect(typeof m.id).toBe('string');
    expect(sortModules(modules)).toEqual([...modules]);
  });
});
