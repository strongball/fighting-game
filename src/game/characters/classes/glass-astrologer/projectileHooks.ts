import { makeProjectile } from '../../../entities/factories.ts';
import { addFx } from '../../../entities/fx.ts';
import { applyEffect } from '../../../entities/effects.ts';
import { registerProjectileAfterMoveHook, registerProjectileHitHook } from '../../../systems/projectileHooks.ts';
import type { ProjectileAfterMoveContext } from '../../../systems/projectileHooks.ts';
import type { Projectile } from '../../../types';
import { consumeMirror, findFirstMirrorHit, reflectDir } from './geometry.ts';

function spawnReflectedShard(projectile: Projectile, dir: { x: number; y: number }, out: Projectile[]) {
  if (!projectile.glassSplitOnMirror || projectile.glassSplitChild) return;
  const speed = Math.hypot(projectile.vx, projectile.vy) || 1;
  out.push(makeProjectile(projectile.owner, projectile.x, projectile.y, dir.x * speed, dir.y * speed, {
    dmg: projectile.dmg * (projectile.glassSplitDmgMult || 0.72),
    radius: projectile.radius * (projectile.glassReflectRadiusMult || 1.22),
    lifetime: Math.min(1.6, projectile.lifetime + 0.5),
    color: projectile.color,
    knockback: projectile.knockback,
    pierce: true,
    vfx: projectile.vfx,
    srcSlot: projectile.srcSlot,
    glassShard: true,
    glassReflects: 1,
    glassMaxReflects: projectile.glassChildMaxReflects || 3,
    glassReflectBonus: projectile.glassReflectBonus || 0.35,
    glassMarkOnReflected: true,
    glassPierceOnReflect: true,
    glassSplitChild: true,
    lastMirrorId: projectile.lastMirrorId,
  }));
}

function reflectGlassShard({ state, projectile, prevX, prevY, spawned }: ProjectileAfterMoveContext) {
  if (!projectile.glassShard || (projectile.glassReflects || 0) >= (projectile.glassMaxReflects || 0)) return;

  const mirrorHit = findFirstMirrorHit(state, projectile.owner, { x: prevX, y: prevY }, { x: projectile.x, y: projectile.y }, projectile.lastMirrorId);
  if (!mirrorHit) return;

  const speed = Math.hypot(projectile.vx, projectile.vy) || 1;
  const dir = reflectDir({ x: projectile.vx / speed, y: projectile.vy / speed }, mirrorHit.mirror);
  consumeMirror(mirrorHit.mirror);
  projectile.glassReflects = (projectile.glassReflects || 0) + 1;
  projectile.lastMirrorId = mirrorHit.mirror.id;
  if (projectile.glassPierceOnReflect) projectile.pierce = true;
  projectile.lifetime += 0.18;

  if (projectile.glassSplitChild) {
    projectile.dmg *= 1 + (projectile.glassReflectBonus || 0.35);
    projectile.radius *= projectile.glassReflects % 2 ? 1.18 : 0.88;
    projectile.vx = dir.x * speed;
    projectile.vy = dir.y * speed;
    projectile.x = mirrorHit.hit.x + dir.x * Math.max(2, projectile.radius || 2);
    projectile.y = mirrorHit.hit.y + dir.y * Math.max(2, projectile.radius || 2);
  } else {
    const reflectedDmg = projectile.dmg * (1 + (projectile.glassReflectBonus || 0.35));
    const passDmg = projectile.dmg;
    projectile.x = mirrorHit.hit.x + (projectile.vx / speed) * Math.max(2, projectile.radius || 2);
    projectile.y = mirrorHit.hit.y + (projectile.vy / speed) * Math.max(2, projectile.radius || 2);
    projectile.dmg = reflectedDmg;
    spawnReflectedShard(projectile, dir, spawned);
    projectile.dmg = passDmg;
    projectile.radius *= projectile.glassPassRadiusMult || 0.9;
  }

  projectile.hit = {};
  addFx(state, { type: 'hit', x: mirrorHit.hit.x, y: mirrorHit.hit.y, color: projectile.color, life: 0.32, radius: 52, vfx: 'glass_astrologer_refract' });
}

function applyGlassMarkOnReflectedHit({ projectile, target }: { projectile: Projectile; target: any }) {
  if (projectile.glassMarkOnReflected && (projectile.glassReflects || 0) > 0) {
    applyEffect(target, 'glassmark', { duration: 6, stacks: 1, max: 3, srcSlot: projectile.srcSlot }, projectile.owner);
  }
}

registerProjectileAfterMoveHook(reflectGlassShard);
registerProjectileHitHook(applyGlassMarkOnReflectedHit);
