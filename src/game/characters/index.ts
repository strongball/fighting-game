// @ts-nocheck
// 角色資料聚合入口。各職業的數值與技能定義放在 ./classes/<slug>/。
import { getBoss } from '../bosses.js';

const modules = import.meta.glob('./classes/*/index.ts', { eager: true });

export const CHARACTERS: any[] = Object.values(modules)
  .map((mod: any) => mod.default)
  .filter(Boolean)
  .sort((a: any, b: any) => a.id - b.id);

export function getCharacter(id: any): any {
  // id >= 100 -> 闖關模式魔王資料，沿用角色 schema 與渲染/傷害管線。
  if (id >= 100) {
    const boss = getBoss(id);
    if (boss) return boss;
  }
  return CHARACTERS[id] || CHARACTERS[0];
}
