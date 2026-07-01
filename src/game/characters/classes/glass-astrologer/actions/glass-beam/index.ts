import { addFx } from '../../../../../entities/fx.ts';
import type { ActionContext } from '../../../../../types';

export function glass_beam(ctx: ActionContext) {
  const { state, caster, action } = ctx;
  caster.glassBeam = {
    remaining: action.duration || 3,
    tick: action.tick || 0.25,
    tickTimer: 0,
    action,
    srcSlot: ctx.source,
  };
  addFx(state, { type: 'buff', x: caster.x, y: caster.y, color: action.color, life: 0.32, radius: 72, vfx: action.vfx });
}

export const handlers = { glass_beam };
