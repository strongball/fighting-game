// @ts-nocheck
import { PLAYER_RADIUS } from '../../../constants.js';
import { makeProjectile } from '../../../entities/factories.ts';
import { addFx } from '../../../entities/fx.ts';

export function grapple(ctx) {
  const { state, caster, action, cos, sin, silent } = ctx;
  state.projectiles.push(makeProjectile(caster.id, caster.x + cos * PLAYER_RADIUS, caster.y + sin * PLAYER_RADIUS, cos * (action.speed || 760), sin * (action.speed || 760), {
    dmg: action.dmg || 0,
    radius: action.radius || 12,
    lifetime: action.lifetime || 0.5,
    color: action.color,
    knockback: 0,
    pierce: false,
    effect: action.effect,
    pull: { gap: action.gap || 26 },
    vfx: action.vfx,
  }));
  if (!silent) addFx(state, { type: 'dash', x: caster.x, y: caster.y, facing: caster.facing, color: action.color, life: 0.2, vfx: action.vfx });
}

export const handlers = { grapple };
