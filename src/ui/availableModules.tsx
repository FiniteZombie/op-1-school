/**
 * Decision 10: modules learn which other modules exist here, and their
 * routes, from this context, never from the registry (only `AppShell` imports
 * it). The list is `availableFrom` in `router.ts`: the visible modules.
 */
import { createContext, useContext, type ReactNode } from 'react';
import type { AvailableModule } from './router';

export type { AvailableModule } from './router';

const AvailableModulesContext = createContext<readonly AvailableModule[]>([]);

export function AvailableModulesProvider({ modules, children }: { modules: readonly AvailableModule[]; children?: ReactNode }) {
  return <AvailableModulesContext.Provider value={modules}>{children}</AvailableModulesContext.Provider>;
}

/** The modules visible on this page (`devOnly` ones only under `?dev`), as `{ id, route }`. */
export function useAvailableModules(): readonly AvailableModule[] {
  return useContext(AvailableModulesContext);
}
