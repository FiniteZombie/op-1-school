/**
 * Every module, found by `import.meta.glob` (SPEC §5.5): each
 * `src/modules/<id>/module.ts` exports `module: ModuleDefinition`. No module
 * edits this file, and only `src/ui/AppShell.tsx` imports it (the import-rule
 * test enforces both).
 */
import type { ModuleDefinition } from '../types/modules';

/** By `phase`, then `id`. */
export function sortModules(modules: readonly ModuleDefinition[]): ModuleDefinition[] {
  return [...modules].sort((a, b) => a.phase - b.phase || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

const found = import.meta.glob<{ module: ModuleDefinition }>('./*/module.ts', { eager: true });

export const modules: readonly ModuleDefinition[] = Object.freeze(sortModules(Object.values(found).map((m) => m.module)));
