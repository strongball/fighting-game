// @ts-nocheck
import { summonMinions } from '../../summons.ts';

export function summon(ctx) {
  summonMinions(ctx.state, ctx.caster, ctx.action);
}

export const handlers = { summon };
