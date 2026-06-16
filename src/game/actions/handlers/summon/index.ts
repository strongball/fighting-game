import { summonMinions } from '../../summons.ts';
import type { ActionContext } from '../../../types';

export function summon(ctx: ActionContext) {
  summonMinions(ctx.state, ctx.caster, ctx.action);
}

export const handlers = { summon };
