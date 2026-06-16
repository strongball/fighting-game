// @ts-nocheck
import { ARENA, PLAYER_RADIUS } from '../../../constants.js';
import { clamp } from '../../../entities/math.ts';
import { addFx } from '../../../entities/fx.ts';

export function leap(ctx) {
  const { state, caster, action, cos, sin, silent } = ctx;
  const tx = clamp(caster.x + cos * (action.range || 240), PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
  const ty = clamp(caster.y + sin * (action.range || 240), PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);
  caster.leap = {
    t: 0,
    dur: action.dur || 0.45,
    fromx: caster.x,
    fromy: caster.y,
    tx,
    ty,
    dmg: action.dmg || 0,
    radius: action.radius || 120,
    knockback: action.knockback || 0,
    effect: action.effect || null,
    leaveZone: action.leaveZone || null,
    color: action.color,
    vfx: action.vfx,
  };
  if (!silent) addFx(state, { type: 'dash', x: caster.x, y: caster.y, facing: caster.facing, color: action.color, life: 0.25, vfx: action.vfx });
}

export const handlers = { leap };
