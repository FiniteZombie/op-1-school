import type { ComponentType, LazyExoticComponent } from 'react';

export const MODULE_IDS = [
  'progression-trainer',
  'sample-flip',
  'pocket-dojo',
  'kit-compiler',
  'runner',
  'dev-spine',
] as const;
export type ModuleId = (typeof MODULE_IDS)[number];

/** What each `src/modules/<id>/module.ts` exports as `module` (SPEC §5.5). */
export interface ModuleDefinition {
  id: ModuleId;
  /** Path relative to Vite's `base`, starting with `/`. */
  route: string;
  title: string;
  /** A one-character string. */
  icon: string;
  component: LazyExoticComponent<ComponentType>;
  phase: 1 | 2 | 3 | 4;
  /** Hidden from the nav, and its route unreachable, unless the URL has `?dev`. */
  devOnly?: boolean;
}
