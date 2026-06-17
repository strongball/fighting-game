// @ts-nocheck
// 階段 onEnter 共用腳本：給 boss/<slug>/index.ts 直接引用。
import { applyEffect } from '../entities/effects.ts';
import { addFx } from '../entities/fx.ts';
import { teamPlayers } from './lifecycle.ts';

// 對全體玩家施加狀態 (e.g. burn/slow/scramble/weaken)
export function applyEffectToAllPlayers(kind: string, data: any) {
  return (state: any, boss: any) => {
    for (const p of teamPlayers(state)) {
      if (!p.alive) continue;
      applyEffect(p, kind, data, boss.id);
      addFx(state, { type: 'buff', x: p.x, y: p.y, color: data.color || '#ff7a3d', life: 0.4, radius: 40 });
    }
  };
}

// R9 階段 3：把所有玩家兩兩配對綁定 (光暗連線)
export function tetherAllPairs(opts: any = {}) {
  return (state: any, boss: any) => {
    if (!state.tethers) state.tethers = [];
    const humans = teamPlayers(state).filter((p: any) => p.alive);
    for (let i = 0; i + 1 < humans.length; i += 2) {
      state.tethers.push({
        a: humans[i].id, b: humans[i + 1].id,
        minGap: opts.minGap || 220, dmg: opts.dmg || 18, tick: 0.5, tickTimer: 0.5,
        remaining: opts.duration || 12,
      });
    }
    addFx(state, { type: 'ultimate', x: boss.x, y: boss.y, facing: boss.facing, color: '#f5d76e', life: 0.7, radius: 220 });
  };
}

// R8 階段 2：規則崩壞 — 全員 scramble 一段時間
export function scrambleAll(duration = 4) {
  return applyEffectToAllPlayers('scramble', { duration, color: '#b14fd8' });
}

// R3 階段 2：熔岩沸騰 — 範圍內玩家被燒
export function burnNearby(radius = 360, dmg = 8, duration = 4) {
  return (state: any, boss: any) => {
    for (const p of teamPlayers(state)) {
      if (!p.alive) continue;
      const dx = p.x - boss.x, dy = p.y - boss.y;
      if (dx * dx + dy * dy > radius * radius) continue;
      applyEffect(p, 'burn', { duration, dmg, tick: 0.5, color: '#ff5a1f' }, boss.id);
    }
    addFx(state, { type: 'ultimate', x: boss.x, y: boss.y, facing: boss.facing, color: '#ff5a1f', life: 0.6, radius: radius });
  };
}
