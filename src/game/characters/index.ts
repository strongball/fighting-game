// @ts-nocheck
// 角色資料聚合入口。各職業的數值與技能定義放在 ./classes/<slug>/。
//
// ── id 規則 ─────────────────────────────────────────────────────────
// 玩家角色的 id 是「穩定字串 slug」（= 資料夾名，例 'warrior'）。
//   • 為什麼不是數字索引：兩個開發者各自新增角色時，數字會搶同一個「下一號」→ 合併衝突
//     且載到錯角色；slug 由內容決定、天然唯一、永不碰撞。
//   • order 欄位只決定大廳顯示順序（碰撞無害、純視覺）；省略者排到最後。
// 闖關魔王（id >= 100）與召喚物（id < 0）沿用各自的「數字 id-space」，由 getCharacter 分派。
// ──────────────────────────────────────────────────────────────────
import { getBoss } from '../bosses.js';
import { getMinion } from './minions/index.ts';

const modules = import.meta.glob('./classes/*/index.ts', { eager: true });

export const CHARACTERS: any[] = Object.values(modules)
  .map((mod: any) => mod.default)
  .filter(Boolean)
  .sort((a: any, b: any) => (a.order ?? 1e9) - (b.order ?? 1e9));

const BY_SLUG = new Map(CHARACTERS.map((c: any) => [c.id, c]));

// 為所有角色注入 Space 閃避技能（瞬移或翻滾）。型別由各角色資料的 evadeType 決定（co-located）。
const blinkEvade = (color: string) => ({
  name: '瞬移閃避', type: 'blink', range: 155, cd: 2.0, color, vfx: 'evade_blink',
  self: { effect: { kind: 'evading', duration: 0.15 } }, // 瞬移無敵時間 (秒)
});
const dashEvade = (color: string) => ({
  name: '翻滾閃避', type: 'dash', impulse: 720, cd: 2.0, color, vfx: 'evade_roll',
  self: { effect: { kind: 'evading', duration: 0.25 } }, // 翻滾無敵時間 (秒)
});
CHARACTERS.forEach((c: any) => {
  c.evade = c.evadeType === 'blink' ? blinkEvade(c.color) : dashEvade(c.color);
});

export function getCharacter(id: any): any {
  // 玩家角色：字串 slug。
  if (typeof id === 'string') return BY_SLUG.get(id) || CHARACTERS[0];
  // 闖關魔王（>=100）與召喚物（<0）沿用數字 id-space。
  if (id >= 100) {
    const boss = getBoss(id);
    if (boss) return boss;
  }
  if (id < 0) {
    const minion = getMinion(id);
    if (minion) return minion;
  }
  return CHARACTERS[0];
}
