import type { GameState, Projectile } from '../types';

export interface ProjectileAfterMoveContext {
  state: GameState;
  projectile: Projectile;
  prevX: number;
  prevY: number;
  spawned: Projectile[];
}

export type ProjectileAfterMoveHook = (ctx: ProjectileAfterMoveContext) => void;

export interface ProjectileHitContext {
  state: GameState;
  projectile: Projectile;
  target: any;
}

export type ProjectileHitHook = (ctx: ProjectileHitContext) => void;

const afterMoveHooks: ProjectileAfterMoveHook[] = [];
const hitHooks: ProjectileHitHook[] = [];

export function registerProjectileAfterMoveHook(hook: ProjectileAfterMoveHook) {
  if (typeof hook === 'function' && !afterMoveHooks.includes(hook)) afterMoveHooks.push(hook);
}

export function registerProjectileHitHook(hook: ProjectileHitHook) {
  if (typeof hook === 'function' && !hitHooks.includes(hook)) hitHooks.push(hook);
}

export function runProjectileAfterMoveHooks(ctx: ProjectileAfterMoveContext) {
  for (const hook of afterMoveHooks) hook(ctx);
}

export function runProjectileHitHooks(ctx: ProjectileHitContext) {
  for (const hook of hitHooks) hook(ctx);
}
