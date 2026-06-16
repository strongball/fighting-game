// @ts-nocheck
import { ARENA, PLAYER_RADIUS } from '../constants.js';
import { clamp } from '../entities/math.ts';
import { makeBoss, makeZone } from '../entities/factories.ts';
import { dealDamage } from '../entities/damage.ts';
import { addFx } from '../entities/fx.ts';
import { isEnemy } from '../entities/team.ts';
import { bodyR, applyEffectFrom } from './combat.ts';

let summonSeq = 1;

function aoeAt(state, ownerId, x, y, opt) {
  for (const o of Object.values(state.players)) {
    if (!isEnemy(state, ownerId, o)) continue;
    const dx = o.x - x, dy = o.y - y, d = Math.hypot(dx, dy);
    if (d > (opt.radius || 120) + bodyR(o)) continue;
    if (opt.dmg) dealDamage(state, o, opt.dmg, ownerId);
    if (opt.knockback && d > 0) { o.kvx += dx / d * opt.knockback; o.kvy += dy / d * opt.knockback; }
    if (opt.effect) applyEffectFrom(state, o, opt.effect, ownerId);
  }
}

export function summonMinions(state, summoner, action) {
  if (action.detonate) { detonateMinions(state, summoner, action); return; }
  const cap = action.cap || 3;
  let alive = 0;
  for (const o of Object.values(state.players)) if (o.isSummon && o.ownerId === summoner.id && o.alive) alive++;
  const n = Math.min(action.count || 1, Math.max(0, cap - alive));
  for (let i = 0; i < n; i++) {
    const ang = summoner.facing + Math.PI + (i - (n - 1) / 2) * 0.6;
    const x = clamp(summoner.x + Math.cos(ang) * 52, PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
    const y = clamp(summoner.y + Math.sin(ang) * 52, PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);
    const id = 'sum-' + summoner.id + '-' + (summonSeq++);
    const m = makeBoss(id, action.minionCharId != null ? action.minionCharId : 9, x, y, summoner.team, {
      isMinion: true,
      ownerId: summoner.id,
      aiId: 'minion',
      name: action.minionName,
      maxHp: action.minionHp || 160,
      scale: action.minionScale || 0.7,
      facing: summoner.facing,
    });
    m.isSummon = true;
    m.summonLife = action.minionLife || 14;
    state.players[id] = m;
    addFx(state, { type: 'blink', x, y, color: action.color, life: 0.42, radius: 64, vfx: action.vfx });
  }
  if (action.zone) state.zones.push(makeZone(summoner.id, summoner.x, summoner.y, action.zone));
}

function detonateMinions(state, summoner, action) {
  for (const o of Object.values(state.players)) {
    if (!o.isSummon || o.ownerId !== summoner.id || !o.alive) continue;
    aoeAt(state, summoner.id, o.x, o.y, { radius: action.radius || 120, dmg: action.dmg || 60, knockback: action.knockback || 120, effect: action.effect });
    addFx(state, { type: 'hit', x: o.x, y: o.y, color: action.color, life: 0.3, radius: action.radius || 120, vfx: action.vfx });
    o.hp = 0; o.alive = false;
  }
}
