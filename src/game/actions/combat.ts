import { PLAYER_RADIUS } from '../constants.js';
import { getCharacter } from '../characters.js';
import { angleDiff, dist } from '../entities/math.ts';
import { dealDamage } from '../entities/damage.ts';
import { applyEffect } from '../entities/effects.ts';
import { addFx } from '../entities/fx.ts';
import { isEnemy } from '../entities/team.ts';
import type { GameState, Player, EntityId } from '../types';

// 被命中半徑：魔王/部位依模型放大，其餘 = PLAYER_RADIUS。
export function bodyR(o: { hitR?: number }): number {
  return o.hitR || PLAYER_RADIUS;
}

// 輸出傷害倍率：殘血加成 / 血怒 / 過載 / 居合就緒。a 為動作物件（可能是合成 action）。
export function outMult(p: Player, a: any): number {
  let m = 1;
  if (a.lowHpBonus) m *= 1 + (1 - p.hp / p.maxHp);
  if (p.effects.rage) m *= p.effects.rage.dmg;
  if (p.effects.overdrive && p.effects.overdrive.dmg) m *= p.effects.overdrive.dmg;
  if (p.iaiReady) {
    const t = getCharacter(p.charId).talent;
    m *= 1 + ((t && t.bonus) || 0.8);
  }
  return m;
}

export function applyEffectFrom(state: GameState, target: Player, effect: any, srcId: EntityId) {
  let e = effect;
  const src = state.players[srcId];
  if (src && effect.kind === 'burn') {
    const t = getCharacter(src.charId).talent;
    if (t && t.id === 'pyromancy') {
      e = { ...effect, dmg: Math.round((effect.dmg || 0) * (t.burnDmg || 1.5)), duration: (effect.duration || 2) * (t.burnDur || 1.4) };
    }
  }
  if (effect.kind === 'chill' && (effect.stacks || 1) >= (effect.max || 4)) {
    const tt = getCharacter(target.charId).talent;
    if (tt && tt.id === 'pyromancy') e = { ...e, stacks: 1 };
  }
  applyEffect(target, e.kind, e, srcId);
}

// 近戰揮击：扱弧內所有敵人（full arc 不限角）。a 可為合成動作物件（leap/blink 內部套用）。
export function meleeHit(state: GameState, p: Player, a: any, silent?: boolean) {
  const m = outMult(p, a);
  const full = a.arc >= 6;
  for (const o of Object.values(state.players)) {
    if (!isEnemy(state, p.id, o)) continue;
    const dx = o.x - p.x, dy = o.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > a.range + bodyR(o)) continue;
    if (!full) {
      const ang = Math.atan2(dy, dx);
      if (Math.abs(angleDiff(ang, p.facing)) > a.arc / 2) continue;
    }
    let dmg = a.dmg * m;
    if (a.detonate && o.effects.mark) {
      dmg *= a.detonate.mult || 2;
      delete o.effects.mark;
      addFx(state, { type: 'hit', x: o.x, y: o.y, color: a.color, life: 0.26, radius: 64, vfx: a.vfx });
    }
    if (a.execute && o.hp <= o.maxHp * (a.execute.threshold || 0.25)) dmg *= a.execute.mult || 5;
    dealDamage(state, o, dmg, p.id, { meleeHit: true });
    if (a.knockback && d > 0) { o.kvx += (dx / d) * a.knockback; o.kvy += (dy / d) * a.knockback; }
    if (a.effect) applyEffectFrom(state, o, a.effect, p.id);
  }
  if (!silent) addFx(state, { type: 'melee', x: p.x, y: p.y, facing: p.facing, range: a.range, arc: full ? 7 : a.arc, color: a.color, life: 0.18, vfx: a.vfx });
}
