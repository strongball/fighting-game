import { ARENA, PLAYER_RADIUS } from '../constants.js';
import { clamp, dist } from '../entities/math.ts';
import { makeZone } from '../entities/factories.ts';
import { dealDamage } from '../entities/damage.ts';
import { applyEffect } from '../entities/effects.ts';
import { applyHeal } from '../entities/heal.ts';
import { addFx } from '../entities/fx.ts';
import { isEnemy } from '../entities/team.ts';
import { applyEffectFrom, bodyR, meleeHit } from './combat.ts';
import type { GameState, Player } from '../types';

// 腳本化移動（衝鑂/躍擊）：進行中接管移動。回傳 true 表示本幀已接管。
export function processScripted(state: GameState, p: Player, dt: number): boolean {
  if (p.charge) {
    const c = p.charge;
    const advance = c.speed * dt;
    const nx = p.x + c.dx * advance;
    const ny = p.y + c.dy * advance;
    const cx = clamp(nx, PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
    const cy = clamp(ny, PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);
    const hitWall = cx !== nx || cy !== ny;
    p.x = cx;
    p.y = cy;
    c.dist -= advance;
    let hitSomeone = false;
    for (const o of Object.values(state.players)) {
      if (!isEnemy(state, p.id, o) || c.hit[o.id]) continue;
      if (dist(p.x, p.y, o.x, o.y) <= c.hitRadius + bodyR(o)) {
        if (c.dmg) dealDamage(state, o, c.dmg, p.id);
        if (c.knockback) {
          const dx = o.x - p.x;
          const dy = o.y - p.y;
          const d = Math.hypot(dx, dy) || 1;
          o.kvx += dx / d * c.knockback;
          o.kvy += dy / d * c.knockback;
        }
        if (c.effect) applyEffectFrom(state, o, c.effect, p.id);
        c.hit[o.id] = true;
        hitSomeone = true;
      }
    }
    p.vx = 0;
    p.vy = 0;
    if (hitSomeone && c.stopOnHit) {
      addFx(state, { type: 'hit', x: p.x, y: p.y, color: c.color, life: 0.26, radius: c.hitRadius * 1.4, vfx: c.vfx });
      p.charge = null;
    } else if (hitWall && c.wallStun) {
      applyEffect(p, 'stun', { duration: c.wallStun });
      addFx(state, { type: 'hit', x: p.x, y: p.y, color: c.color, life: 0.5, radius: c.hitRadius * 1.8, vfx: c.vfx });
      p.charge = null;
    } else if (c.dist <= 0) {
      p.charge = null;
    }
    return true;
  }

  if (p.leap) {
    const l = p.leap;
    l.t += dt;
    const k = Math.min(1, l.t / l.dur);
    p.x = clamp(l.fromx + (l.tx - l.fromx) * k, PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
    p.y = clamp(l.fromy + (l.ty - l.fromy) * k, PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);
    p.vx = 0;
    p.vy = 0;
    if (k >= 1) {
      meleeHit(state, p, { dmg: l.dmg, range: l.radius, arc: 7, knockback: l.knockback, effect: l.effect, vfx: l.vfx }, false);
      addFx(state, { type: 'hit', x: p.x, y: p.y, color: l.color, life: 0.3, radius: l.radius, vfx: l.vfx });
      if (l.leaveZone) state.zones.push(makeZone(p.id, p.x, p.y, l.leaveZone));
      p.leap = null;
    }
    return true;
  }

  return false;
}

export function processChannel(state: GameState, p: Player, dt: number) {
  const ch = p.channel;
  if (!ch) return;
  ch.remaining -= dt;
  ch.tickTimer -= dt;

  let target: Player | null = state.players[ch.targetId];
  if (!target || !target.alive || dist(p.x, p.y, target.x, target.y) > ch.range || !isEnemy(state, p.id, target)) {
    let best: Player | null = null;
    let bd = Infinity;
    for (const o of Object.values(state.players)) {
      if (!isEnemy(state, p.id, o) || !o.alive) continue;
      const d = dist(p.x, p.y, o.x, o.y);
      if (d <= ch.range && d < bd) {
        bd = d;
        best = o;
      }
    }
    if (best) {
      ch.targetId = best.id;
      target = best;
    } else {
      ch.targetId = null;
      target = null;
    }
  }

  if (ch.tickTimer <= 0) {
    ch.tickTimer += ch.tick;
    if (target) {
      dealDamage(state, target, ch.dmg, p.id);
      if (ch.heal) applyHeal(state, p, ch.heal);
      if (ch.effect) applyEffectFrom(state, target, ch.effect, p.id);
      addFx(state, { type: 'hit', x: target.x, y: target.y, color: ch.color, life: 0.2, radius: 20, vfx: ch.vfx });
    }
  }
  if (ch.remaining <= 0) p.channel = null;
}

export function processTrail(state: GameState, p: Player, dt: number) {
  const tr = p.trail;
  if (!tr) return;
  tr.remaining -= dt;
  if (dist(p.x, p.y, tr.lastx, tr.lasty) >= tr.spacing) {
    state.zones.push(makeZone(p.id, p.x, p.y, tr.zone));
    tr.lastx = p.x;
    tr.lasty = p.y;
  }
  if (tr.remaining <= 0) p.trail = null;
}
