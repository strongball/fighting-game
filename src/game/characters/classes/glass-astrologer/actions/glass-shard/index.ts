import { PLAYER_RADIUS } from '../../../../../constants.js';
import { makeProjectile } from '../../../../../entities/factories.ts';
import { outMult } from '../../../../../actions/combat.ts';
import type { ActionContext, ProjectileAction } from '../../../../../types';

export function glass_shard(ctx: ActionContext) {
  const { state, caster, action, cos, sin, damageMultiplier } = ctx;
  const a = action as ProjectileAction;
  const m = outMult(caster, action);
  const count = Math.max(1, a.count || 1);
  const spread = count > 1 ? (a.spread || 0.22) : 0;
  const base = Math.atan2(sin, cos);
  for (let i = 0; i < count; i++) {
    const offset = count === 1 ? 0 : (i - (count - 1) / 2) * spread;
    const ang = base + offset;
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    state.projectiles.push(makeProjectile(caster.id, caster.x + dx * PLAYER_RADIUS, caster.y + dy * PLAYER_RADIUS, dx * a.speed, dy * a.speed, {
      dmg: a.dmg * m * damageMultiplier,
      radius: a.radius,
      lifetime: a.lifetime,
      color: a.color,
      knockback: a.knockback,
      pierce: false,
      vfx: a.vfx,
      srcSlot: ctx.source,
      glassShard: true,
      glassReflects: 0,
      glassMaxReflects: a.maxReflects || 1,
      glassReflectBonus: a.reflectBonus || 0.35,
      glassMarkOnReflected: true,
      glassPierceOnReflect: !!a.pierceOnReflect,
      glassSplitOnMirror: !!a.splitOnMirror,
      glassSplitAngle: a.splitAngle || 0.34,
      glassSplitDmgMult: a.splitDmgMult || 0.72,
      glassSplitRadiusMult: a.splitRadiusMult || 0.85,
      glassPassRadiusMult: a.passRadiusMult || 0.9,
      glassReflectRadiusMult: a.reflectRadiusMult || 1.22,
      glassChildMaxReflects: a.childMaxReflects || 3,
    }));
  }
}

export const handlers = { glass_shard };
