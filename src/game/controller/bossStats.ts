// 闖關結算統計：把 host 權威 state 的累積 stats 整理成 GameOver 面板用的 BossRunStats。
// 純函式、無 controller 閉包相依，方便單獨測試與調整 MVP 評分。

export function buildBossStats(state: any) {
  const stats = state.stats;
  if (!stats) return undefined;
  const perPlayer = Object.entries(stats.perPlayer || {}).map(([id, raw]: any) => ({
    id,
    name: raw.name,
    charId: raw.charId,
    dmgDealt: Math.round(raw.dmgDealt || 0),
    dmgTaken: Math.round(raw.dmgTaken || 0),
    healing: Math.round(raw.healing || 0),
    kills: raw.kills || 0,
    deaths: raw.deaths || 0,
    revives: raw.revives || 0,
    maxHit: Math.round(raw.maxHit || 0),
    critCount: raw.critCount || 0,
    ccApplied: raw.ccApplied || 0,
    skillUses: { basic: raw.skillUses?.basic || 0, skill1: raw.skillUses?.skill1 || 0, skill2: raw.skillUses?.skill2 || 0, ultimate: raw.skillUses?.ultimate || 0, evade: raw.skillUses?.evade || 0 },
  }));
  let mvpId: string | null = null;
  let mvpScore = -1;
  for (const p of perPlayer) {
    const score = p.dmgDealt + p.healing * 0.6 + p.revives * 80 + p.kills * 25;
    if (score > mvpScore) { mvpScore = score; mvpId = p.id; }
  }
  return {
    totalDuration: (state.time || 0) - (stats.runStart || 0),
    retryCount: stats._retryCount || 0,
    perRound: stats.perRound || [],
    perPlayer,
    mvpId,
  };
}
