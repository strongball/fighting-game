// @ts-nocheck
// 闖關模式統計：累計於 state.stats，跟著 snapshot 同步。
// 只在 mode === 'boss' 啟用；其他模式呼叫皆為 no-op。

export function isBossRun(state) {
  return state && state.mode === 'boss';
}

export function initRunStats(state) {
  if (!isBossRun(state)) return;
  state.stats = {
    runStart: state.time || 0,
    roundStart: state.time || 0,
    currentRound: state.round || 1,
    perRound: [],
    perPlayer: {},
  };
  ensureAllPlayerStats(state);
}

export function ensureAllPlayerStats(state) {
  if (!state.stats) return;
  for (const p of Object.values(state.players)) {
    if (p.team !== 1 || p.ownerId) continue; // 只統計真人玩家
    ensurePlayerStats(state, p);
  }
}

function ensurePlayerStats(state, p) {
  if (!state.stats || !p || p.team !== 1 || p.ownerId) return null;
  let s = state.stats.perPlayer[p.id];
  if (!s) {
    s = state.stats.perPlayer[p.id] = {
      name: p.name, charId: p.charId,
      dmgDealt: 0, dmgTaken: 0, healing: 0,
      kills: 0, deaths: 0, revives: 0,
      skillUses: { basic: 0, skill1: 0, skill2: 0, ultimate: 0, evade: 0 },
      maxHit: 0, critCount: 0, ccApplied: 0,
    };
  }
  // 角色可能在房間內換 — 用最新資料覆寫
  s.name = p.name; s.charId = p.charId;
  return s;
}

export function recordRoundStart(state) {
  if (!state.stats) return;
  state.stats.roundStart = state.time || 0;
  state.stats.currentRound = state.round || 1;
}

export function recordRoundEnd(state, opts = {}) {
  if (!state.stats) return;
  const duration = (state.time || 0) - (state.stats.roundStart || 0);
  state.stats.perRound.push({
    round: state.stats.currentRound,
    bossName: opts.bossName || '',
    duration,
    defeated: !!opts.defeated,
    retries: opts.retries || 0,
  });
}

export function recordRetry(state) {
  if (!state.stats) return;
  state.stats._retryCount = (state.stats._retryCount || 0) + 1;
}

export function recordDamage(state, attackerId, target, amount, opts = {}) {
  if (!state.stats || amount <= 0) return;
  const attacker = state.players[attackerId];
  if (attacker) {
    // 召喚物擊殺歸功召喚者
    const ownerId = (attacker.isMinion || attacker.isSummon) && attacker.ownerId ? attacker.ownerId : attacker.id;
    const ownerP = state.players[ownerId];
    if (ownerP && ownerP.team === 1 && !ownerP.ownerId) {
      const s = ensurePlayerStats(state, ownerP);
      if (s) {
        s.dmgDealt += amount;
        if (amount > s.maxHit) s.maxHit = amount;
        if (opts.isCrit) s.critCount += 1;
      }
    }
  }
  if (target && target.team === 1 && !target.ownerId) {
    const s = ensurePlayerStats(state, target);
    if (s) s.dmgTaken += amount;
  }
}

export function recordHeal(state, p, amount) {
  if (!state.stats || amount <= 0 || !p) return;
  const s = ensurePlayerStats(state, p);
  if (s) s.healing += amount;
}

export function recordKill(state, killerId, target) {
  if (!state.stats) return;
  // 只計擊殺 Boss 側 (含部位、小怪)
  if (!target || target.team !== 2) return;
  const killer = state.players[killerId];
  if (!killer) return;
  const ownerId = (killer.isMinion || killer.isSummon) && killer.ownerId ? killer.ownerId : killer.id;
  const ownerP = state.players[ownerId];
  if (!ownerP || ownerP.team !== 1 || ownerP.ownerId) return;
  const s = ensurePlayerStats(state, ownerP);
  if (s) s.kills += 1;
}

export function recordDeath(state, p) {
  if (!state.stats || !p || p.team !== 1 || p.ownerId) return;
  const s = ensurePlayerStats(state, p);
  if (s) s.deaths += 1;
}

export function recordRevive(state, helperId) {
  if (!state.stats) return;
  const helper = state.players[helperId];
  if (!helper || helper.team !== 1 || helper.ownerId) return;
  const s = ensurePlayerStats(state, helper);
  if (s) s.revives += 1;
}

export function recordSkillUse(state, p, slot) {
  if (!state.stats || !p || p.team !== 1 || p.ownerId) return;
  const s = ensurePlayerStats(state, p);
  if (!s) return;
  if (!s.skillUses[slot] && s.skillUses[slot] !== 0) s.skillUses[slot] = 0;
  s.skillUses[slot] += 1;
}

export function recordCcApplied(state, casterId) {
  if (!state.stats) return;
  const caster = state.players[casterId];
  if (!caster) return;
  const ownerId = (caster.isMinion || caster.isSummon) && caster.ownerId ? caster.ownerId : caster.id;
  const ownerP = state.players[ownerId];
  if (!ownerP || ownerP.team !== 1 || ownerP.ownerId) return;
  const s = ensurePlayerStats(state, ownerP);
  if (s) s.ccApplied += 1;
}
