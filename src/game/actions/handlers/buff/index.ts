import { PLAYER_RADIUS } from '../../../constants.js';
import { applyEffect } from '../../../entities/effects.ts';
import { applyHeal } from '../../../entities/heal.ts';
import { applyShield } from '../../../entities/shield.ts';
import { addFx } from '../../../entities/fx.ts';
import { makeZone } from '../../../entities/factories.ts';
import { isEnemy, isAlly } from '../../../entities/team.ts';
import type { ActionContext } from '../../../types';

export function buff(ctx: ActionContext) {
  const { state, caster, action, silent } = ctx;
  if (action.cleanse) applyEffect(caster, 'cleanse');
  if (action.heal) applyHeal(state, caster, action.heal, { burst: true });
  let shieldAmt = action.shield || 0;
  if (action.shieldPerMinion) {
    let mc = 0;
    for (const o of Object.values(state.players)) if (o.isMinion && o.ownerId === caster.id && o.alive) mc++;
    shieldAmt += action.shieldPerMinion * mc;
  }
  if (shieldAmt) applyShield(state, caster, shieldAmt, action.duration || 5);
  if (action.knockbackAura) {
    for (const o of Object.values(state.players)) {
      if (!isEnemy(state, caster.id, o)) continue;
      const dx = o.x - caster.x;
      const dy = o.y - caster.y;
      const d = Math.hypot(dx, dy);
      if (d > 0 && d < 260) {
        o.kvx += dx / d * action.knockbackAura;
        o.kvy += dy / d * action.knockbackAura;
      }
    }
  }
  if (action.effect) applyEffect(caster, action.effect.kind, action.effect);
  // 團隊增益：對半徑內所有友軍（含自己）施加增益／治療／淨化（例：鳥獵「風之步」全隊加速）。
  if (action.ally) {
    const r = action.ally.radius || 300;
    for (const o of Object.values(state.players)) {
      if (!o.alive || !isAlly(state, caster.id, o)) continue;
      if (Math.hypot(o.x - caster.x, o.y - caster.y) > r) continue;
      if (action.ally.cleanse) applyEffect(o, 'cleanse');
      if (action.ally.heal) applyHeal(state, o, action.ally.heal, { burst: true });
      if (action.ally.shield) applyShield(state, o, action.ally.shield, action.ally.duration || action.duration || 5);
      if (action.ally.effect) applyEffect(o, action.ally.effect.kind, action.ally.effect, caster.id);
    }
  }
  if (action.trail) caster.trail = { remaining: action.trail.duration || 3, spacing: action.trail.spacing || 42, lastx: caster.x, lasty: caster.y, zone: action.trail.zone, srcSlot: ctx.source };
  if (action.castZone) state.zones.push(Object.assign(makeZone(caster.id, caster.x, caster.y, action.castZone), { srcSlot: ctx.source }));
  if (!silent) {
    addFx(state, {
      type: 'buff',
      x: caster.x,
      y: caster.y,
      color: action.color,
      life: 0.4,
      radius: PLAYER_RADIUS * 2.2,
      allyRadius: action.ally ? action.ally.radius : undefined,
      vfx: action.vfx
    });
  }
}

export const handlers = { buff };
