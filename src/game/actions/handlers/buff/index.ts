// @ts-nocheck
import { PLAYER_RADIUS } from '../../../constants.js';
import { applyEffect } from '../../../entities/effects.ts';
import { addFx } from '../../../entities/fx.ts';
import { isEnemy } from '../../../entities/team.ts';

export function buff(ctx) {
  const { state, caster, action, silent } = ctx;
  if (action.cleanse) applyEffect(caster, 'cleanse');
  if (action.heal) applyEffect(caster, 'heal', { amount: action.heal });
  let shieldAmt = action.shield || 0;
  if (action.shieldPerMinion) {
    let mc = 0;
    for (const o of Object.values(state.players)) if (o.isMinion && o.ownerId === caster.id && o.alive) mc++;
    shieldAmt += action.shieldPerMinion * mc;
  }
  if (shieldAmt) applyEffect(caster, 'shield', { amount: shieldAmt, duration: action.duration });
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
  if (action.trail) caster.trail = { remaining: action.trail.duration || 3, spacing: action.trail.spacing || 42, lastx: caster.x, lasty: caster.y, zone: action.trail.zone };
  if (!silent) addFx(state, { type: 'buff', x: caster.x, y: caster.y, color: action.color, life: 0.4, radius: PLAYER_RADIUS * 2.2, vfx: action.vfx });
}

export const handlers = { buff };
