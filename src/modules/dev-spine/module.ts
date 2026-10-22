import { lazy } from 'react';
import type { ModuleDefinition } from '../../types/modules';

/** The spine's smoke page (SPEC §6.1 item 8), behind `?dev`. */
export const module: ModuleDefinition = {
  id: 'dev-spine',
  route: '/dev/spine',
  title: 'dev spine',
  // placeholder: the nav icon (any one character; the owner picks).
  icon: '∿',
  component: lazy(() => import('./View')),
  phase: 1,
  devOnly: true,
};
