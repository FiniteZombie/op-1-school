import { lazy } from 'react';
import type { ModuleDefinition } from '../../types/modules';
import { COPY } from '../../ui/copy';

/** The spine's smoke page (SPEC §6.1 item 8), behind `?dev`. */
export const module: ModuleDefinition = {
  id: 'dev-spine',
  route: '/dev/spine',
  title: COPY.moduleTitles['dev-spine'],
  icon: COPY.moduleIcons['dev-spine'],
  component: lazy(() => import('./View')),
  phase: 1,
  devOnly: true,
};
