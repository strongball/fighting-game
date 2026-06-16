// @ts-nocheck
import { ARENA, PLAYER_RADIUS } from '../constants.js';
import { clamp, dist, angleDiff } from '../entities/math.ts';
import { makeProjectile, makeZone } from '../entities/factories.ts';
import { dealDamage } from '../entities/damage.ts';
import { addFx } from '../entities/fx.ts';
import { isEnemy } from '../entities/team.ts';
import { applyEffectFrom, bodyR } from '../actions/combat.ts';

function splitProjectile(state, projectile, out) {
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
    }));
  }
  addFx(state, { type: 'hit', x: projectile.x, y: projectile.y, color: s.color || projectile.color, life: 0.22, radius: (projectile.radius || 8) * 2.4, vfx: projectile.vfx });
}

export function updateProjectiles(state, dt) {
  const keep = [];
  const spawned = [];
  for (const projectile of state.projectiles) {
    if (projectile.homing) {
      let best = null;
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

    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.lifetime -= dt;
    const oob = projectile.x < 0 || projectile.y < 0 || projectile.x > ARENA.width || projectile.y > ARENA.height;
    if (projectile.lifetime <= 0 || oob) {
      if (projectile.split && !oob) splitProjectile(state, projectile, spawned);
      if (projectile.leaveZone && !oob) state.zones.push(makeZone(projectile.owner, projectile.x, projectile.y, projectile.leaveZone));
      continue;
    }

    let dead = false;
    for (const o of Object.values(state.players)) {
      if (!isEnemy(state, projectile.owner, o) || projectile.hit[o.id]) continue;
      if (dist(projectile.x, projectile.y, o.x, o.y) <= projectile.radius + bodyR(o)) {
        const hitDmg = projectile.freezeBonus && o.effects && o.effects.stun
          ? projectile.dmg * projectile.freezeBonus
          : projectile.dmg;
        dealDamage(state, o, hitDmg, projectile.owner);
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
        if (projectile.effect) applyEffectFrom(state, o, projectile.effect, projectile.owner);
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
      if (projectile.leaveZone) state.zones.push(makeZone(projectile.owner, projectile.x, projectile.y, projectile.leaveZone));
      continue;
    }
    keep.push(projectile);
  }
  state.projectiles = spawned.length ? keep.concat(spawned) : keep;
}
