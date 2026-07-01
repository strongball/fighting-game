import { ARENA, PLAYER_RADIUS } from '../constants.js';
import { clamp, dist, angleDiff } from '../entities/math.ts';
import { makeProjectile, makeZone } from '../entities/factories.ts';
import { dealDamage } from '../entities/damage.ts';
import { addFx } from '../entities/fx.ts';
import { isEnemy, isAlly } from '../entities/team.ts';
import { applyHeal } from '../entities/heal.ts';
import { applyEffect } from '../entities/effects.ts';
import { applyEffectFrom, bodyR } from '../actions/combat.ts';
import { checkProjectileHit, damageDestructible } from './destructibles.ts';
import { runProjectileAfterMoveHooks, runProjectileHitHooks } from './projectileHooks.ts';
import type { GameState, Projectile, Player } from '../types';

import.meta.glob('../characters/classes/*/projectileHooks.ts', { eager: true });

function splitProjectile(state: GameState, projectile: Projectile, out: Projectile[]) {
  const s = projectile.split;
  const n = Math.max(2, s.count || 6);
  const base = Math.atan2(projectile.vy, projectile.vx);
  const full = (s.spread ?? Math.PI * 2) >= Math.PI * 2 - 1e-3;
  const speed = s.speed || Math.hypot(projectile.vx, projectile.vy) || 360;
  for (let i = 0; i < n; i++) {
    const ang = full
      ? base + (i / n) * Math.PI * 2
      : base + (i - (n - 1) / 2) * ((s.spread ?? 1) / Math.max(1, n - 1));
    const c = Math.cos(ang);
    const sn = Math.sin(ang);
    out.push(makeProjectile(projectile.owner, projectile.x, projectile.y, c * speed, sn * speed, {
      dmg: s.dmg ?? projectile.dmg,
      radius: s.radius ?? projectile.radius,
      lifetime: s.lifetime ?? 0.8,
      color: s.color || projectile.color,
      knockback: s.knockback ?? 0,
      pierce: !!s.pierce,
      effect: s.effect || projectile.effect,
      vfx: s.vfx || projectile.vfx,
      srcSlot: projectile.srcSlot,
    }));
  }
  addFx(state, { type: 'hit', x: projectile.x, y: projectile.y, color: s.color || projectile.color, life: 0.22, radius: (projectile.radius || 8) * 2.4, vfx: projectile.vfx });
}

export function updateProjectiles(state: GameState, dt: number) {
  const keep: Projectile[] = [];
  const spawned: Projectile[] = [];
  for (const projectile of state.projectiles) {
    if (projectile.homing) {
      let best: Player | null = null;
      let bd = Infinity;
      for (const o of Object.values(state.players)) {
        if (!isEnemy(state, projectile.owner, o)) continue;
        const d = dist(projectile.x, projectile.y, o.x, o.y);
        if (d < bd) {
          bd = d;
          best = o;
        }
      }
      if (best) {
        const desired = Math.atan2(best.y - projectile.y, best.x - projectile.x);
        const cur = Math.atan2(projectile.vy, projectile.vx);
        let diff = angleDiff(desired, cur);
        const maxTurn = projectile.homing * dt;
        if (diff > maxTurn) diff = maxTurn;
        else if (diff < -maxTurn) diff = -maxTurn;
        const na = cur + diff;
        const sp = Math.hypot(projectile.vx, projectile.vy);
        projectile.vx = Math.cos(na) * sp;
        projectile.vy = Math.sin(na) * sp;
      }
    }

    const prevX = projectile.x;
    const prevY = projectile.y;
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.lifetime -= dt;
    runProjectileAfterMoveHooks({ state, projectile, prevX, prevY, spawned });
    const oob = projectile.x < 0 || projectile.y < 0 || projectile.x > ARENA.width || projectile.y > ARENA.height;
    if (projectile.lifetime <= 0 || oob) {
      if (projectile.split && !oob) splitProjectile(state, projectile, spawned);
      if (projectile.leaveZone && !oob) state.zones.push(Object.assign(makeZone(projectile.owner, projectile.x, projectile.y, projectile.leaveZone), { srcSlot: projectile.srcSlot }));
      continue;
    }

    let dead = false;
    for (const o of Object.values(state.players)) {
      if (!o.alive) continue;

      // Heal allies if projectile has a heal value and hits an ally (and hasn't hit them yet)
      if (projectile.heal && isAlly(state, projectile.owner, o) && !projectile.hit[o.id]) {
        if (dist(projectile.x, projectile.y, o.x, o.y) <= projectile.radius + bodyR(o)) {
          applyHeal(state, o, projectile.heal, { burst: true });
          projectile.hit[o.id] = true;
          addFx(state, {
            type: 'hit',
            x: o.x,
            y: o.y,
            color: '#5cffa6',
            life: 0.25,
            radius: o.hitR * 1.5,
            vfx: 'bard_heal_hit'
          });
        }
      }

      if (!isEnemy(state, projectile.owner, o) || projectile.hit[o.id]) continue;
      if (dist(projectile.x, projectile.y, o.x, o.y) <= projectile.radius + bodyR(o)) {
        const hitDmg = projectile.freezeBonus && o.effects && o.effects.stun
          ? projectile.dmg * projectile.freezeBonus
          : projectile.dmg;
        dealDamage(state, o, hitDmg, projectile.owner, { source: projectile.srcSlot });
        if (projectile.knockback) {
          const l = Math.hypot(projectile.vx, projectile.vy) || 1;
          o.kvx += (projectile.vx / l) * projectile.knockback;
          o.kvy += (projectile.vy / l) * projectile.knockback;
        }
        if (projectile.pull) {
          const owner = state.players[projectile.owner];
          if (owner && owner.alive) {
            const dx = owner.x - o.x;
            const dy = owner.y - o.y;
            const d = Math.hypot(dx, dy) || 1;
            const gap = PLAYER_RADIUS * 2 + (projectile.pull.gap || 24);
            o.x = clamp(owner.x - dx / d * gap, PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
            o.y = clamp(owner.y - dy / d * gap, PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);
          }
        }
        if (projectile.effect) applyEffectFrom(state, o, projectile.effect, projectile.owner, projectile.srcSlot);
        runProjectileHitHooks({ state, projectile, target: o });
        // 時厄術士 K/L：命中引爆目標時咒層數 —— 傷害／暈眩／緩速「全部隨層數放大」，可選擇是否消耗層數。
        if (projectile.detonate) {
          const det = projectile.detonate;
          const hex = o.effects && o.effects.timehex;
          const stacks = hex ? (hex.stacks || 0) : 0;
          if (stacks > 0 && det.perStack) {
            dealDamage(state, o, stacks * det.perStack, projectile.owner, { source: projectile.srcSlot });
          }
          // 暈眩：基礎 + 每層
          const stunDur = (det.stun || 0) + (det.stunPerStack || 0) * stacks;
          if (stunDur > 0) applyEffect(o, 'stun', { duration: stunDur });
          // 緩速：時間隨層數變長、強度隨層數變強（factor 越低越慢）
          if (det.slow) {
            const slowDur = (det.slow.duration || 0) + (det.slowPerStack || 0) * stacks;
            let factor = det.slow.factor != null ? det.slow.factor : 0.5;
            if (det.slowFactorPerStack) factor = Math.max(det.slowFactorMin || 0.3, factor - det.slowFactorPerStack * stacks);
            if (slowDur > 0) applyEffect(o, 'slow', { duration: slowDur, factor });
          }
          if (det.consume && hex) delete o.effects.timehex;
          if (stacks > 0) addFx(state, { type: 'hit', x: o.x, y: o.y, color: projectile.color, life: 0.35, radius: 40 + stacks * 6, vfx: projectile.vfx });
        }
        addFx(state, { type: 'hit', x: projectile.x, y: projectile.y, color: projectile.color, life: 0.2, radius: projectile.radius * 2, vfx: projectile.vfx });
        projectile.hit[o.id] = true;
        if (!projectile.pierce) {
          dead = true;
          break;
        }
      }
    }

    if (dead) {
      if (projectile.split) splitProjectile(state, projectile, spawned);
      if (projectile.leaveZone) state.zones.push(Object.assign(makeZone(projectile.owner, projectile.x, projectile.y, projectile.leaveZone), { srcSlot: projectile.srcSlot }));
      continue;
    }
    // 投射物撞可破壞物
    const obj = checkProjectileHit(state, projectile);
    if (obj) {
      damageDestructible(state, obj, projectile.dmg || 30);
      if (!projectile.pierce) { dead = true; }
    }
    if (dead) {
      if (projectile.split) splitProjectile(state, projectile, spawned);
      if (projectile.leaveZone) state.zones.push(Object.assign(makeZone(projectile.owner, projectile.x, projectile.y, projectile.leaveZone), { srcSlot: projectile.srcSlot }));
      continue;
    }
    keep.push(projectile);
  }
  state.projectiles = spawned.length ? keep.concat(spawned) : keep;
}
