import type { ActionHandler } from '../../types';

const modules = import.meta.glob('./*/index.ts', { eager: true });
const characterModules = import.meta.glob('../../characters/classes/*/actions/*/index.ts', { eager: true });

export const ACTION_HANDLERS = new Map<string, ActionHandler>();

for (const mod of Object.values({ ...modules, ...characterModules }) as any[]) {
  const handlers = mod.handlers || {};
  for (const [type, handler] of Object.entries(handlers)) {
    ACTION_HANDLERS.set(type, handler as ActionHandler);
  }
}
