// 網路快照序列化（host → joiner）。
//
// ── 為什麼是宣告式 manifest ─────────────────────────────────────────
// 房主每 30Hz 把權威狀態廣播給加入者；加入者只需要「渲染 / HUD」所需欄位。
// 過去這裡是一長串手寫的物件字面（`{ id: p.id, x: p.x, … }`），每加一個要同步的
// 欄位都得編輯同一個函式本體 → 多人協作必衝突，且「忘了加」會造成加入者畫面
// 靜默 desync（最難 debug 的一類 bug）。
//
// 改為「欄位 manifest」後：新增同步欄位＝在下方陣列 append 一行（衝突面小很多），
// 且 test/networkSnapshot.test.ts 會守住欄位集合不漂移。
//
// 注意：只有「原樣複製」的欄位放進 manifest。少數欄位有裁剪 / 預設值語意
// （stats 只送 _retryCount、陣列給 || []），保留為下方的顯式特例。
// ──────────────────────────────────────────────────────────────────

/** 要過網路、且「原樣複製」的玩家欄位（單一事實來源）。新增同步欄位＝append 一行。 */
export const NET_PLAYER_FIELDS = [
  // 身分
  'id', 'name', 'charId', 'team',
  // 運動學
  'x', 'y', 'facing', 'kvx', 'kvy',
  // 生命 / 資源 / 狀態
  'hp', 'maxHp', 'mana', 'maxMana', 'alive', 'shield', 'shieldTime', 'kills',
  'ult', 'effects', 'cd', 'chargeState',
  // 魔王 / 召喚物 / 部位 / 鏡像 渲染旗標
  'isBoss', 'isPart', 'isMinion', 'isFake', 'isMirror',
  'ownerId', 'partId', 'partColor', 'scale', 'reviveProg',
  // HUD / 渲染額外線索：倒地判定(aiId)、引導光束(channel)、破綻窗口、相位覆寫
  'aiId', 'channel', 'recoverWindow', 'recoverHeavy', 'phaseTagsOverride',
] as const;

/** 要過網路、且「原樣複製」的頂層狀態欄位（players 與含預設值者另外處理）。 */
export const NET_STATE_FIELDS = [
  'phase', 'winner', 'winnerTeam', 'time',
  'mode', 'round', 'bossId', 'bossHp', 'bossMaxHp',
  'roundPhase', 'roundTimer', 'introDur', 'banner', 'tethers', 'bossWipedRound',
  // 投射物 / 區域 / 特效：生命短、數量少，原樣帶上供渲染
  'projectiles', 'zones', 'fx',
] as const;

export function serializeNetworkPlayer(p: any) {
  const out: Record<string, any> = {};
  for (const k of NET_PLAYER_FIELDS) out[k] = p[k];
  return out;
}

export function serializeNetworkSnapshot(state: any) {
  const players: Record<string, any> = {};
  for (const id of Object.keys(state.players)) players[id] = serializeNetworkPlayer(state.players[id]);

  const out: Record<string, any> = { players };
  for (const k of NET_STATE_FIELDS) out[k] = state[k];

  // ── 含裁剪 / 預設值的特例（不適合純欄位複製）──
  // 全滅面板只需要重打次數；不送整包 stats（會持續累積、且只在結算才完整用到）。
  out.stats = state.stats ? { _retryCount: state.stats._retryCount || 0 } : null;
  // 可破壞物 / 掉落道具 / 時間錨點：原樣帶上，未初始化時給安全預設。
  out.destructibles = state.destructibles || [];
  out.items = state.items || [];
  out.timeAnchors = state.timeAnchors || [];
  out.timeAnchorRitual = state.timeAnchorRitual || null;
  return out;
}
