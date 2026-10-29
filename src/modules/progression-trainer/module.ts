import { lazy } from 'react';
import type { ModuleDefinition } from '../../types/modules';
import { COPY } from '../../ui/copy';

/** Module 1, the Progression Trainer (SPEC §4.1, §5.5): levels A0–A6. */
export const module: ModuleDefinition = {
  id: 'progression-trainer',
  route: '/progression-trainer',
  title: COPY.moduleTitles['progression-trainer'],
  icon: COPY.moduleIcons['progression-trainer'],
  component: lazy(() => import('./View')),
  phase: 2,
};
