import { PLAYER_RADIUS } from '../../../constants.js';
import { makeProjectile } from '../../../entities/factories.ts';
import { outMult } from '../../combat.ts';
import type { ActionContext, ProjectileAction } from '../../../types';

export function projectile(ctx: ActionContext) {
  const { state, caster, chargeRatio, damageMultiplier } = ctx;
  const action = ctx.action as ProjectileAction;
  const m = outMult(caster, action);
  const n = action.count || 1;
  const speedMul = action.chargeMax ? 1 + chargeRatio * 0.6 : 1;
  const radiusMul = action.chargeMax ? 1 + chargeRatio * 1.2 : 1;
  const projVfx = action.chargeMax && chargeRatio > 0 ? (action.vfx || '') + '_charged' : action.vfx;
  for (let i = 0; i < n; i++) {
    const ang = caster.facing + (i - (n - 1) / 2) * (action.spread || 0);
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    state.projectiles.push(makeProjectile(caster.id, caster.x + c * PLAYER_RADIUS, caster.y + s * PLAYER_RADIUS, c * action.speed * speedMul, s * action.speed * speedMul, {
      dmg: action.dmg * m * damageMultiplier,
      radius: action.radius * radiusMul,
      lifetime: action.lifetime,
      color: action.color,
      knockback: action.knockback,
      pierce: action.pierce,
      effect: action.effect,
      split: action.split,
      homing: action.homing,
      leaveZone: action.leaveZone,
      freezeBonus: action.freezeBonus || 0,
      vfx: projVfx,
    }));
  }
}

export const handlers = { projectile };
