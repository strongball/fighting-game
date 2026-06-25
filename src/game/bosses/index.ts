// 闖關模式魔王資料聚合入口。各魔王定義放在 ./<slug>/。
const modules = import.meta.glob('./*/index.ts', { eager: true });

const BOSS_ORDER = [
  'golem',                 // Round 1
  'poison-lizard',         // Round 2
  'sand-tyrant',           // Round 3
  'lava-juggernaut',       // Round 4
  'tidal-siren',           // Round 5
  'frost-assassin',        // Round 6
  'ancient-titan',         // Round 7
  'necromancer-conductor',  // Round 8
  'storm-wolf',            // Round 9
  'void-mage',             // Round 10
  'fallen-angel',          // Round 11
  'doppelganger',          // Round 12
  'time-devourer',         // Round 13
  'star-forge',            // Round 14
];

const bossesBySlug = new Map<string, any>();
for (const [path, mod] of Object.entries(modules)) {
  const slug = path.split('/')[1];
  if (slug && (mod as any).default) {
    bossesBySlug.set(slug, (mod as any).default);
  }
}

export const BOSSES = BOSS_ORDER.map((slug, idx) => {
  const boss = bossesBySlug.get(slug);
  if (boss) {
    boss.round = idx + 1;
    return boss;
  }
  return null;
}).filter(Boolean);

const BY_ID = new Map(BOSSES.map((b) => [b.id, b]));

export function getBoss(id: number) { return BY_ID.get(id) || null; }
export function isBossId(id: number) { return id >= 100 && BY_ID.has(id); }

export function getBossForRound(round: number) {
  return BOSSES.find((b) => b.round === round) || null;
}

export const BOSS_COUNT = BOSSES.length;
