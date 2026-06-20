// 環境互動：可破壞物 (石柱 / 火盆) — Boss 闖關專用
//
// 行為：
//   - 投射物擊中 → 扣血、自身消失 (依 piercable 而定)
//   - 玩家近身攻擊 zone 範圍 → 受傷 (host 主動 raycast)
//   - 玩家 / Boss 衝鋒 charge 撞到 → 自身碎裂 + 撞擊方暈眩 0.6s (體驗 R3 撞牆暈)
//   - 死亡時播粒子；場上不再阻擋路徑

import { ARENA, PLAYER_RADIUS } from '../constants.js';
import { uid } from '../entities/math.ts';
import { addFx } from '../entities/fx.ts';
import { applyEffect } from '../entities/effects.ts';
import { spawnDropFromPillar } from './items.ts';
import type { GameState, Destructible, Projectile } from '../types';

const STUN_ON_CRASH = 0.6;

export function spawnDestructibles(state: GameState, configs: any[]) {
  if (!state.destructibles) state.destructibles = [];
  for (const cfg of configs || []) {
    const id = uid();
    state.destructibles.push({
      id,
      x: cfg.x, y: cfg.y,
      r: cfg.r || 28,
      hp: cfg.hp || 200, maxHp: cfg.hp || 200,
      color: cfg.color || '#a06038',
      kind: cfg.kind || 'pillar',
      crashStun: cfg.crashStun != null ? cfg.crashStun : STUN_ON_CRASH,
    });
  }
}

// 隨機在場上撒 n 個石柱 (避開玩家與中央區域)
export function scatterPillars(state: GameState, n: number, opts: any = {}) {
  const cfgs = [];
  for (let i = 0; i < n; i++) {
    const margin = 140;
    const x = margin + Math.random() * (ARENA.width - margin * 2);
    const y = margin + Math.random() * (ARENA.height - margin * 2);
    // 避開中央 (Boss 出生點)
    const cx = ARENA.width / 2, cy = ARENA.height * 0.3;
    if (Math.hypot(x - cx, y - cy) < 220) { i--; continue; }
    cfgs.push({ x, y, r: opts.r || 28, hp: opts.hp || 200, kind: opts.kind || 'pillar', color: opts.color || '#a06038' });
  }
  spawnDestructibles(state, cfgs);
}

// 傷害一個物件 (來自任意傷害源)
export function damageDestructible(state: GameState, obj: Destructible, dmg: number, opts: any = {}) {
  if (!obj || obj.hp <= 0) return;
  obj.hp -= dmg;
  addFx(state, { type: 'hit', x: obj.x, y: obj.y, color: opts.color || obj.color, life: 0.18, radius: 16 });
  if (obj.hp <= 0) {
    obj.hp = 0;
    addFx(state, { type: 'death', x: obj.x, y: obj.y, color: obj.color, life: 0.5, radius: obj.r * 1.6 });
    spawnDropFromPillar(state, obj.x, obj.y);
  }
}

// 每 tick：清除已死亡物件、處理玩家/Boss 衝鋒撞擊 → 自我擊破 + 撞者暈眩
export function tickDestructibles(state: GameState, dt: number) {
  if (!state.destructibles || !state.destructibles.length) return;

  // 偵測衝鋒實體 (有 charge / leap 的 player) 是否與物件重疊
  for (const p of Object.values(state.players)) {
    if (!p.alive) continue;
    if (!p.charge && !p.leap) continue;
    for (const obj of state.destructibles) {
      if (obj.hp <= 0) continue;
      const d = Math.hypot(p.x - obj.x, p.y - obj.y);
      if (d > obj.r + PLAYER_RADIUS) continue;
      // 撞擊：擊破物件 + 衝鋒中斷 + 暈眩撞者 (含 Boss → 玩家慶祝集火)
      damageDestructible(state, obj, obj.hp);
      if (p.charge) p.charge = null;
      if (p.leap) p.leap = null;
      applyEffect(p, 'stun', { duration: obj.crashStun || STUN_ON_CRASH });
      addFx(state, { type: 'hit', x: obj.x, y: obj.y, color: '#fff7d6', life: 0.25, radius: 70 });
      break;
    }
  }

  // 玩家近身揮砍：投射物已透過 projectiles 系統處理 (見 projectiles.ts hooks)；
  // 這裡無需額外處理，僅清除已死亡物件
  state.destructibles = state.destructibles.filter((o) => o.hp > 0);
}

// 物件作為投射物碰撞目標：projectiles 系統呼叫此函式檢查命中
export function checkProjectileHit(state: GameState, pr: Projectile): Destructible | null {
  if (!state.destructibles || !state.destructibles.length) return null;
  for (const obj of state.destructibles) {
    if (obj.hp <= 0) continue;
    const d = Math.hypot(pr.x - obj.x, pr.y - obj.y);
    if (d <= obj.r + (pr.radius || 8)) return obj;
  }
  return null;
}
