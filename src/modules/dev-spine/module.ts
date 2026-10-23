import { lazy } from 'react';
import type { ModuleDefinition } from '../../types/modules';

/** The spine's smoke page (SPEC §6.1 item 8), behind `?dev`. */
export const module: ModuleDefinition = {
  id: 'dev-spine',
  route: '/dev/spine',
  title: 'dev spine',
  icon: '∿',
  component: lazy(() => import('./View')),
  phase: 1,
  devOnly: true,
};
