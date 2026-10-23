import { lazy } from 'react';
import { describe, expect, it } from 'vitest';
import type { ModuleDefinition } from '../../types/modules';
import { availableFrom } from '../router';

const view = lazy(async () => ({ default: () => null }));
const devSpine: ModuleDefinition = { id: 'dev-spine', route: '/dev/spine', title: 't', icon: 'd', component: view, phase: 1, devOnly: true };
const trainer: ModuleDefinition = { id: 'progression-trainer', route: '/progression-trainer', title: 't', icon: '1', component: view, phase: 2 };

describe('availableFrom', () => {
  it('returns { id, route } pairs and hides devOnly modules without dev', () => {
    expect(availableFrom([devSpine, trainer], false)).toEqual([{ id: 'progression-trainer', route: '/progression-trainer' }]);
    expect(availableFrom([devSpine, trainer], true)).toEqual([
      { id: 'dev-spine', route: '/dev/spine' },
      { id: 'progression-trainer', route: '/progression-trainer' },
    ]);
    expect(availableFrom([], true)).toEqual([]);
  });
});
