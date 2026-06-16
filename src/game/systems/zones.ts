import { ARENA, PLAYER_RADIUS } from '../constants.js';
import { clamp, dist } from '../entities/math.ts';
import { dealDamage } from '../entities/damage.ts';
import { applyEffect } from '../entities/effects.ts';
import { applyHeal } from '../entities/heal.ts';
import { addFx } from '../entities/fx.ts';
import { isEnemy, isAlly } from '../entities/team.ts';
import { applyEffectFrom, bodyR } from '../actions/combat.ts';
import type { GameState, Zone } from '../types';

export function updateZones(state: GameState, dt: number) {
  const keep: Zone[] = [];
  for (const zone of state.zones) {
    if (zone.follow != null) {
      const owner = state.players[zone.follow];
      if (!owner || !owner.alive) continue;
      zone.x = owner.x;
      zone.y = owner.y;
    }

    if (zone.vx || zone.vy) {
      zone.x = clamp(zone.x + zone.vx * dt, PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
      zone.y = clamp(zone.y + zone.vy * dt, PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);
    }

    if (zone.delay > 0) {
      zone.delay -= dt;
      if (zone.delay > 0) {
        keep.push(zone);
        continue;
      }
      addFx(state, { type: 'hit', x: zone.x, y: zone.y, color: zone.color, life: 0.3, radius: zone.radius, vfx: zone.vfx });
    }

    if (zone.pull) {
      for (const o of Object.values(state.players)) {
        if (!isEnemy(state, zone.owner, o)) continue;
        const dx = zone.x - o.x;
        const dy = zone.y - o.y;
        const d = Math.hypot(dx, dy);
        if (d > 4 && d <= zone.radius + bodyR(o)) {
          const f = Math.min(d, zone.pull * dt);
          o.x = clamp(o.x + dx / d * f, PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
          o.y = clamp(o.y + dy / d * f, PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);
        }
      }
    }

    zone.lifetime -= dt;
    zone.tickTimer -= dt;
    if (zone.tickTimer <= 0) {
      zone.tickTimer += zone.tick;
      let hits = 0;
      for (const o of Object.values(state.players)) {
        if (!o.alive) continue;
        if (dist(zone.x, zone.y, o.x, o.y) > zone.radius + bodyR(o)) continue;
        if (isEnemy(state, zone.owner, o)) {
          if (zone.dmg) dealDamage(state, o, zone.dmg, zone.owner);
          if (zone.effect) applyEffectFrom(state, o, zone.effect, zone.owner);
          if (zone.effects) for (const e of zone.effects) applyEffectFrom(state, o, e, zone.owner);
          if (zone.knockback) {
            const dx = o.x - zone.x;
            const dy = o.y - zone.y;
            const d = Math.hypot(dx, dy) || 1;
            o.kvx += dx / d * zone.knockback;
            o.kvy += dy / d * zone.knockback;
          }
          hits++;
        } else if (isAlly(state, zone.owner, o)) {
          if (zone.allyHeal) {
            applyHeal(state, o, zone.allyHeal);
            if (zone.vfx === 'healer_aura') {
              addFx(state, {
                type: 'hit',
                x: o.x,
                y: o.y,
                color: zone.color || '#55efc4',
                life: 0.2,
                radius: o.hitR || PLAYER_RADIUS * 1.2,
                vfx: 'healer_aura_heal_tick'
              });
            }
          }
          if (zone.allyEffect) applyEffect(o, zone.allyEffect.kind, zone.allyEffect, zone.owner);
        }
      }
      if (zone.drainHeal && hits > 0) {
        const owner = state.players[zone.owner];
        if (owner && owner.alive) applyHeal(state, owner, zone.drainHeal * hits);
      }
    }

    if (zone.lifetime > 0) keep.push(zone);
  }
  state.zones = keep;
}
