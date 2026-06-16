// @ts-nocheck
import { meleeHit } from '../../combat.ts';

export function melee(ctx) {
  meleeHit(ctx.state, ctx.caster, ctx.action, ctx.silent);
}

export const handlers = { melee };
