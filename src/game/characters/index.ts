// @ts-nocheck
// 角色資料聚合入口。各職業的數值與技能定義放在 ./classes/<slug>/。
import { getBoss } from '../bosses.js';
import { getMinion } from './minions/index.ts';

const modules = import.meta.glob('./classes/*/index.ts', { eager: true });

export const CHARACTERS: any[] = Object.values(modules)
  .map((mod: any) => mod.default)
  .filter(Boolean)
  .sort((a: any, b: any) => a.id - b.id);

// 為所有角色注入 Space 閃避技能 (瞬移或翻滾)
CHARACTERS.forEach((c) => {
  // 瞬移組 IDs: Mage(1), Assassin(2), Ninja(7), Elementalist(8), Hexer(11), Summoner(15), Necromancer(16), Chronomancer(17)
  const isBlink = [1, 2, 7, 8, 11, 15, 16, 17].includes(c.id);
  if (isBlink) {
    c.evade = {
      name: '瞬移閃避',
      type: 'blink',
      range: 160,
      cd: 3.5,
      color: c.color,
      vfx: 'evade_blink',
      self: {
        effect: { kind: 'evading', duration: 0.15 } // 瞬移無敵時間 (秒)
      }
    };
  } else {
    c.evade = {
      name: '翻滾閃避',
      type: 'dash',
      impulse: 720,
      cd: 3.5,
      color: c.color,
      vfx: 'evade_roll',
      self: {
        effect: { kind: 'evading', duration: 0.25 } // 翻滾無敵時間 (秒)
      }
    };
  }
});

export function getCharacter(id: any): any {
  // id >= 100 -> 闖關模式魔王資料，沿用角色 schema 與渲染/傷害管線。
  if (id >= 100) {
    const boss = getBoss(id);
    if (boss) return boss;
  }
  // id < 0 -> 召喚物 (小兵) 模板，不在 CHARACTERS 陣列內。
  if (id < 0) {
    const minion = getMinion(id);
    if (minion) return minion;
  }
  return CHARACTERS[id] || CHARACTERS[0];
}
