import { lazy } from 'react';
import type { ModuleDefinition } from '../../types/modules';
import { COPY } from '../../ui/copy';

/** The daily session runner (SPEC §5.5 Module 5); home (`/`) once registered. */
export const module: ModuleDefinition = {
  id: 'runner',
  route: '/runner',
  title: COPY.moduleTitles.runner,
  icon: COPY.moduleIcons.runner,
  component: lazy(() => import('./View')),
  phase: 2,
};
