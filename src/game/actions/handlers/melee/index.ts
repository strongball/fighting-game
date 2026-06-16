import { meleeHit } from '../../combat.ts';
import type { ActionContext } from '../../../types';

export function melee(ctx: ActionContext) {
  meleeHit(ctx.state, ctx.caster, ctx.action, ctx.silent);
}

export const handlers = { melee };
