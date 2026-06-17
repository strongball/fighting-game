// @ts-nocheck
import { addFx } from '../../../entities/fx.ts';
import { meleeHit } from '../../combat.ts';

export function dash(ctx) {
  const { state, caster, action, cos, sin, silent } = ctx;
  // 反方向逃：若玩家正在移動，dash 跟著「移動方向」(可往後跳)；否則沿 facing
  let dx = cos, dy = sin;
  const mvLen = Math.hypot(caster.vx || 0, caster.vy || 0);
  if (mvLen > 1) { dx = caster.vx / mvLen; dy = caster.vy / mvLen; }
  caster.kvx += dx * action.impulse;
  caster.kvy += dy * action.impulse;
  if (action.dmg) meleeHit(state, caster, action, true);
  if (!silent) addFx(state, { type: 'dash', x: caster.x, y: caster.y, facing: Math.atan2(dy, dx), color: action.color, life: 0.25, vfx: action.vfx });
}

export const handlers = { dash };
