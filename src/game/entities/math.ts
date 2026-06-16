// 純數學工具，無外部依賴。
import type { Player } from '../types';

// uid() 為全域遞增計數器：決定性（每個 process 從 1 起算），供投射物/zone/fx 的 id。
let nextId = 1;

/** 單調遞增的唯一識別碼。 */
export function uid(): number {
  return nextId++;
}

export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
export const dist = (ax: number, ay: number, bx: number, by: number): number => Math.hypot(ax - bx, ay - by);

/** 兩角度差，正規化到 [-π, π]。 */
export function angleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** 缺血比例 0..1（滿血=0）。 */
export const missingHp = (p: Player): number => 1 - p.hp / p.maxHp;
