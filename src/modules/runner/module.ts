import { lazy } from 'react';
import type { ModuleDefinition } from '../../types/modules';

/** The daily session runner (SPEC §5.5 Module 5); home (`/`) once registered. */
export const module: ModuleDefinition = {
  id: 'runner',
  route: '/runner',
  title: 'session', // placeholder
  icon: '5', // placeholder
  component: lazy(() => import('./View')),
  phase: 2,
};
