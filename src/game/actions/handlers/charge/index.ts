import { PLAYER_RADIUS } from '../../../constants.js';
import { addFx } from '../../../entities/fx.ts';
import type { ActionContext } from '../../../types';

export function charge(ctx: ActionContext) {
  const { state, caster, action, cos, sin, silent } = ctx;
  caster.charge = {
    dx: cos,
    dy: sin,
    speed: action.speed || 950,
    dist: action.range || 300,
    dmg: action.dmg || 0,
    hitRadius: action.hitRadius || PLAYER_RADIUS * 1.5,
    knockback: action.knockback || 0,
    effect: action.effect || null,
    stopOnHit: action.stopOnHit !== false,
    wallStun: action.wallStun || 0,
    color: action.color,
    vfx: action.vfx,
    leaveZone: action.leaveZone || null,
    srcSlot: ctx.source,
    hit: {},
  };
  if (!silent) addFx(state, { type: 'dash', x: caster.x, y: caster.y, facing: caster.facing, color: action.color, life: 0.25, vfx: action.vfx });
}

export const handlers = { charge };
