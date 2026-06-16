// @ts-nocheck
const modules = import.meta.glob('./*/index.ts', { eager: true });

export const ACTION_HANDLERS = new Map();

for (const mod of Object.values(modules)) {
  const handlers = mod.handlers || {};
  for (const [type, handler] of Object.entries(handlers)) {
    ACTION_HANDLERS.set(type, handler);
  }
}
