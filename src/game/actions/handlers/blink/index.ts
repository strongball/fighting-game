import { ARENA, PLAYER_RADIUS } from '../../../constants.js';
import { clamp } from '../../../entities/math.ts';
import { makeZone } from '../../../entities/factories.ts';
import { addFx } from '../../../entities/fx.ts';
import { meleeHit } from '../../combat.ts';
import type { ActionContext, BlinkAction } from '../../../types';

export function blink(ctx: ActionContext) {
  const { state, caster, cos, sin, silent } = ctx;
  const action = ctx.action as BlinkAction;
  // 反方向逃：若玩家正在移動，blink 朝「移動方向」 (可往後跳)；否則沿 facing
  let dx = cos, dy = sin;
  const mvLen = Math.hypot(caster.vx || 0, caster.vy || 0);
  if (mvLen > 1) { dx = caster.vx / mvLen; dy = caster.vy / mvLen; }
  caster.x = clamp(caster.x + dx * action.range, PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
  caster.y = clamp(caster.y + dy * action.range, PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);
  if (action.dmg) {
    meleeHit(state, caster, {
      dmg: action.dmg,
      range: action.hitRadius || 90,
      arc: 7,
      knockback: action.knockback || 0,
      effect: action.effect,
      detonate: action.detonate,
    }, true);
  }
  if (action.leaveZone) state.zones.push(makeZone(caster.id, caster.x, caster.y, action.leaveZone));
  if (!silent) addFx(state, { type: 'blink', x: caster.x, y: caster.y, facing: caster.facing, range: action.range, color: action.color, life: 0.3, radius: action.hitRadius || PLAYER_RADIUS * 1.6, vfx: action.vfx });
}

export const handlers = { blink };
