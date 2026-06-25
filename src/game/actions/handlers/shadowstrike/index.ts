// 忍者專屬位移技：
//  shadowstrike（影襲·處決）—— 鎖定最近「被硬控（暈/縛/凍）」的敵人，瞬移到其背後灌爆，
//    命中後自身隱身+無敵一段時間；找不到被控目標時退化成普通向前 blink（弱化、不給隱身）。
//  shadowflurry（千影）—— 大招：對場上敵人連續 N 次影分身瞬斬（敵人不足則重複轟同一目標，
//    故對單體也是高總傷）；隱身/無敵窗由 action.self 套用（executor 處理）。
// 全程 host 權威、deterministic（候選以距離→id 排序）。位移採 multiblink 同款「target.facing+π」背後落點。

import { ARENA, PLAYER_RADIUS } from '../../../constants.js';
import { clamp, dist } from '../../../entities/math.ts';
import { dealDamage } from '../../../entities/damage.ts';
import { applyEffect } from '../../../entities/effects.ts';
import { addFx } from '../../../entities/fx.ts';
import { isEnemy } from '../../../entities/team.ts';
import { meleeHit, outMult } from '../../combat.ts';
import type { ActionContext } from '../../../types';

// 視為「被控、可被處決」的硬控效果
function isControlled(o: any): boolean {
  const e = o.effects || {};
  return !!(e.root || e.stun || e.frozen);
}

// 落到 target 背後（面向 target），回傳是否成功定位
function blinkBehind(caster: any, target: any) {
  const ang = target.facing + Math.PI;
  caster.x = clamp(target.x + Math.cos(ang) * (PLAYER_RADIUS * 2), PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
  caster.y = clamp(target.y + Math.sin(ang) * (PLAYER_RADIUS * 2), PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);
  caster.facing = Math.atan2(target.y - caster.y, target.x - caster.x);
}

export function shadowstrike(ctx: ActionContext) {
  const { state, caster, cos, sin, silent } = ctx;
  const action = ctx.action as any;
  const range = action.range || 360;

  // 最近的被控敵人（距離→id 排序確保 deterministic）
  const cands = Object.values(state.players)
    .filter((o: any) => isEnemy(state, caster.id, o) && o.hp > 0 && isControlled(o))
    .sort((a: any, b: any) => {
      const da = dist(caster.x, caster.y, a.x, a.y);
      const db = dist(caster.x, caster.y, b.x, b.y);
      if (da !== db) return da - db;
      return Number(a.id) - Number(b.id);
    });
  const target = cands.find((o: any) => dist(caster.x, caster.y, o.x, o.y) <= range);

  if (target) {
    // 處決：瞬移背後 → 灌爆（被控故吃滿影殺天賦）→ 自身隱身+無敵
    blinkBehind(caster, target);
    dealDamage(state, target, (action.dmg || 0) * outMult(caster, action), caster.id);
    if (action.knockback) {
      const dx = target.x - caster.x, dy = target.y - caster.y;
      const d = Math.hypot(dx, dy) || 1;
      target.kvx += dx / d * action.knockback;
      target.kvy += dy / d * action.knockback;
    }
    const sd = action.stealthDur || 1.5;
    applyEffect(caster, 'invis', { duration: sd });
    applyEffect(caster, 'evading', { duration: sd });
    if (!silent) {
      addFx(state, { type: 'blink', x: caster.x, y: caster.y, facing: caster.facing, range: range, color: action.color, life: 0.34, radius: action.hitRadius || PLAYER_RADIUS * 1.8, vfx: action.vfx, big: true });
    }
  } else {
    // 退化：向前（或移動方向）短瞬移 + 小範圍補刀，不給隱身
    let dx = cos, dy = sin;
    const mvLen = Math.hypot(caster.vx || 0, caster.vy || 0);
    if (mvLen > 1) { dx = caster.vx / mvLen; dy = caster.vy / mvLen; }
    const r = action.fallbackRange || 300;
    caster.x = clamp(caster.x + dx * r, PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
    caster.y = clamp(caster.y + dy * r, PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);
    meleeHit(state, caster, { dmg: (action.dmg || 0) * 0.4, range: action.hitRadius || 95, arc: 7, knockback: action.knockback, color: action.color, vfx: action.vfx }, silent, ctx.source);
    if (!silent) addFx(state, { type: 'blink', x: caster.x, y: caster.y, facing: caster.facing, range: r, color: action.color, life: 0.26, radius: PLAYER_RADIUS * 1.6, vfx: action.vfx });
  }
}

export function shadowflurry(ctx: ActionContext) {
  const { state, caster, silent } = ctx;
  const action = ctx.action as any;
  const n = action.count || 7;
  // 起手大爆（千影現身）：type 'ultimate' → vfx onCast 的大爆分支
  if (!silent) addFx(state, { type: 'ultimate', x: caster.x, y: caster.y, facing: caster.facing, color: action.color, life: 0.6, vfx: action.vfx });
  const cands = Object.values(state.players)
    .filter((o: any) => isEnemy(state, caster.id, o) && o.hp > 0)
    .sort((a: any, b: any) => {
      // 被控優先，再距離，再 id
      const ca = isControlled(a) ? 0 : 1, cb = isControlled(b) ? 0 : 1;
      if (ca !== cb) return ca - cb;
      const da = dist(caster.x, caster.y, a.x, a.y);
      const db = dist(caster.x, caster.y, b.x, b.y);
      if (da !== db) return da - db;
      return Number(a.id) - Number(b.id);
    });
  if (!cands.length) {
    if (!silent) addFx(state, { type: 'blink', x: caster.x, y: caster.y, color: action.color, life: 0.3, radius: PLAYER_RADIUS * 2, vfx: action.vfx });
    return;
  }
  const m = outMult(caster, action);
  for (let i = 0; i < n; i++) {
    const target = cands[i % cands.length];
    blinkBehind(caster, target);
    dealDamage(state, target, (action.dmg || 0) * m, caster.id);
    if (action.knockback) {
      const dx = target.x - caster.x, dy = target.y - caster.y;
      const d = Math.hypot(dx, dy) || 1;
      target.kvx += dx / d * action.knockback;
      target.kvy += dy / d * action.knockback;
    }
    if (!silent) addFx(state, { type: 'blink', x: caster.x, y: caster.y, facing: caster.facing, color: action.color, life: 0.22, radius: PLAYER_RADIUS * 1.7, vfx: action.vfx, clone: true });
  }
}

export const handlers = { shadowstrike, shadowflurry };
