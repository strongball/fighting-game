// 闖關模式魔王資料聚合入口。各魔王定義放在 ./<slug>/。
const modules = import.meta.glob('./*/index.ts', { eager: true });

export const BOSSES = Object.values(modules)
  .map((mod) => (mod as any).default)
  .filter(Boolean)
  .sort((a: any, b: any) => a.round - b.round);

const BY_ID = new Map(BOSSES.map((b) => [b.id, b]));

export function getBoss(id: number) { return BY_ID.get(id) || null; }
export function isBossId(id: number) { return id >= 100 && BY_ID.has(id); }

export function getBossForRound(round: number) {
  return BOSSES.find((b) => b.round === round) || null;
}

export const BOSS_COUNT = BOSSES.length;
