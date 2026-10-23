import { lazy } from 'react';
import type { ModuleDefinition } from '../../types/modules';
import { LABELS } from './labels';

/** Module 1, the Progression Trainer (SPEC §4.1, §5.5): levels A0–A6. */
export const module: ModuleDefinition = {
  id: 'progression-trainer',
  route: '/progression-trainer',
  title: LABELS.title,
  icon: LABELS.icon,
  component: lazy(() => import('./View')),
  phase: 2,
};
