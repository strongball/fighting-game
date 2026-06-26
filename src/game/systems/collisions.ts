import { bodyR } from '../actions/combat.ts';
import { ARENA, PLAYER_RADIUS } from '../constants.js';
import { clamp } from '../entities/math.ts';
import type { GameState } from '../types';

// 圓 (p, pr) 推出有向方框 c={x,y,hw,hh,rot}。回傳是否有推 (Minkowski：把框擴張 pr 當作點對框)。
function pushOutBox(p: any, c: any, pr: number): boolean {
  const cos = Math.cos(c.rot || 0), sin = Math.sin(c.rot || 0);
  const dx = p.x - c.x, dy = p.y - c.y;
  const lx = dx * cos + dy * sin;       // world → box-local (rotate by -rot)
  const ly = -dx * sin + dy * cos;
  const hw = c.hw + pr, hh = c.hh + pr; // 擴張半徑 = 框半徑 + 實體半徑
  if (lx <= -hw || lx >= hw || ly <= -hh || ly >= hh) return false; // 在擴張框外 → 無碰撞
  const penX = hw - Math.abs(lx);       // 沿各軸推出所需距離，取較淺者
  const penY = hh - Math.abs(ly);
  let nlx = 0, nly = 0;
  if (penX < penY) nlx = lx >= 0 ? penX : -penX;
  else nly = ly >= 0 ? penY : -penY;
  p.x += nlx * cos - nly * sin;          // box-local → world (rotate by +rot)
  p.y += nlx * sin + nly * cos;
  return true;
}

// 靜態障礙 (世界座標，如神殿基座)：把實體推出，讓地標「佔空間」。圓 (r) 或有向方框 (hw/hh/rot)。
// host 權威；於 resolveCollisions 之後呼叫。含 Boss (地標是固定的，誰都不該穿過)；part 跟著 boss 不獨立推。
export function resolveStaticColliders(state: GameState) {
  if (state.mode !== 'boss') return;
  const cols = state.colliders;
  if (!cols || !cols.length) return;
  for (const p of Object.values(state.players)) {
    if (!p.alive || p.isPart) continue;
    const pr = bodyR(p);
    let pushed = false;
    for (const c of cols as any[]) {
      if (c.hw != null) {                 // 有向方框
        if (pushOutBox(p, c, pr)) pushed = true;
        continue;
      }
      const dx = p.x - c.x, dy = p.y - c.y; // 圓
      const d = Math.hypot(dx, dy);
      const minD = c.r + pr;
      if (d >= minD) continue;
      const nx = d > 0.0001 ? dx / d : 1;
      const ny = d > 0.0001 ? dy / d : 0;
      const overlap = minD - d;
      p.x += nx * overlap;
      p.y += ny * overlap;
      pushed = true;
    }
    if (pushed) {
      p.x = clamp(p.x, PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
      p.y = clamp(p.y, PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);
    }
  }
}

// 逐對實體碰撞分離。Boss/部位為「重型」(不被推開，只推開輕量方)。
export function resolveCollisions(state: GameState) {
  const arr = Object.values(state.players).filter((p) => p.alive);
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      const a = arr[i];
      const b = arr[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const minD = bodyR(a) + bodyR(b);
      if (d >= minD) continue;

      const nx = d > 0.0001 ? dx / d : 1;
      const ny = d > 0.0001 ? dy / d : 0;
      const overlap = minD - d;
      const aHeavy = a.isBoss || a.isPart;
      const bHeavy = b.isBoss || b.isPart;
      if (aHeavy && bHeavy) continue;
      if (aHeavy) {
        b.x += nx * overlap;
        b.y += ny * overlap;
      } else if (bHeavy) {
        a.x -= nx * overlap;
        a.y -= ny * overlap;
      } else {
        const push = overlap / 2;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }
}
