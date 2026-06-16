import { ARENA, PLAYER_RADIUS } from '../../../constants.js';
import { clamp, dist } from '../../../entities/math.ts';
import { dealDamage } from '../../../entities/damage.ts';
import { addFx } from '../../../entities/fx.ts';
import { isEnemy } from '../../../entities/team.ts';
import { applyEffectFrom, outMult } from '../../combat.ts';
import type { ActionContext } from '../../../types';

export function multiblink(ctx: ActionContext) {
  const { state, caster, action } = ctx;
  const n = action.count || 3;
  const cands = Object.values(state.players).filter((o) => isEnemy(state, caster.id, o));
  cands.sort((x, y) => {
    const mx = (x.effects && x.effects.mark) ? 0 : 1;
    const my = (y.effects && y.effects.mark) ? 0 : 1;
    if (mx !== my) return mx - my;
    const dxv = dist(caster.x, caster.y, x.x, x.y);
    const dyv = dist(caster.x, caster.y, y.x, y.y);
    if (dxv !== dyv) return dxv - dyv;
    return Number(x.id) - Number(y.id);
  });
  for (const target of cands.slice(0, n)) {
    const ang = target.facing + Math.PI;
    caster.x = clamp(target.x + Math.cos(ang) * (PLAYER_RADIUS * 2), PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
    caster.y = clamp(target.y + Math.sin(ang) * (PLAYER_RADIUS * 2), PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);
    caster.facing = Math.atan2(target.y - caster.y, target.x - caster.x);
    dealDamage(state, target, (action.dmg || 0) * outMult(caster, action), caster.id);
    if (action.knockback) {
      const dx = target.x - caster.x;
      const dy = target.y - caster.y;
      const d = Math.hypot(dx, dy) || 1;
      target.kvx += dx / d * action.knockback;
      target.kvy += dy / d * action.knockback;
    }
    if (action.effect) applyEffectFrom(state, target, action.effect, caster.id);
    addFx(state, { type: 'blink', x: caster.x, y: caster.y, color: action.color, life: 0.24, radius: PLAYER_RADIUS * 1.8, vfx: action.vfx });
  }
}

export const handlers = { multiblink };
