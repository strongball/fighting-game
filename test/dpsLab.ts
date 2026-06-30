// @ts-nocheck
// Headless 傷害量測框架（DPS Lab）。
//
// 目的：在純邏輯層（無 DOM/WebGL）對「單一攻擊者 vs 不死木人」跑固定時長連招，
// 量測角色 DPS 與「各技能輸出佔比」。用途：
//   1) AI / 開發者單元測試環境（test/dps.test.ts，預設不跑；RUN_DPS=1 或 `yarn dps` 才跑）。
//   2) 平衡評估：比較角色強度、檢視技能輸出結構。
//
// 歸因來源：傷害管線已埋 source slot 標籤（見 src/game/entities/damage.ts 的 dealDamage），
// recordDamage 累計到 state.stats.perPlayer[atk].perSkill[slot]，本框架直接讀取，
// 故「各技能佔比」是**實戰連招**的精確值（DoT / 投射物 / 區域 / 召喚物皆正確歸位）。
//
// 決定性：引擎在模擬路徑用到 Math.random（zone 散佈 / barrage 散射 / 分裂彈），故以
// mulberry32 取代，確保同 seed 完全可重現（沿用 test/harness.ts 的範式）。
//
// 已知限制（詳見回報與專案說明）：
//   • 攻擊者每 tick 補滿血並不死 → lowHpBonus / 殘血加成類技能在「滿血」狀態量測（偏保守）。
//   • 1v1 木人量不到團隊增益（warsong/protect/ally buff）與被動受擊類天賦的貢獻。
//   • 木人靶身分（neutral/boss）會影響絕對數值；跨角色比較請固定同一靶種類。

import { step } from '../src/game/simulation.ts';
import { createInitialState } from '../src/game/entities.js';
import { setupStats } from '../src/game/entities/stats.ts';
import { getCharacter, CHARACTERS } from '../src/game/characters.js';
import { ARENA, DT, PLAYER_RADIUS } from '../src/game/constants.js';

// ---- 決定性亂數 (mulberry32) ----
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function installSeededRandom(seed: number) {
  const original = Math.random;
  Math.random = mulberry32(seed);
  return () => { Math.random = original; };
}

// 減傷型天賦（target.modifyIncoming）——中性木人需避開，否則扭曲基準。
const DEFENSIVE_TALENTS = new Set(['bulwark', 'unbreakable', 'summonbond']);

// 預設中性木人：非近戰角色（避開受擊 ×0.85）、無減傷天賦 → 對所有攻擊者一致的乾淨基準。
export function neutralDummyCharId(): string {
  const c = CHARACTERS.find((c: any) => !c.meleeRole && !DEFENSIVE_TALENTS.has(c.talent && c.talent.id));
  return (c || CHARACTERS[0]).id;
}

const ATTACK_SLOTS = ['basic', 'skill1', 'skill2', 'ultimate'];

export interface DpsOptions {
  seconds?: number;       // 量測時長（秒）
  seed?: number;          // 亂數種子（同 seed 完全可重現）
  mode?: 'sustained' | 'burst'; // sustained=自然 mana/ult/CD；burst=freeMana 連發（潛在上限）
  dummy?: 'neutral' | 'boss';   // 木人靶身分
  dummyCharId?: string;   // 自訂木人角色（預設 neutralDummyCharId）
  charge?: 'full' | 'tap';// 蓄力技：full=蓄滿放、tap=點放
  gap?: number;           // 攻擊者與木人保持的距離
}

export function measureCharacter(charId: string, opts: DpsOptions = {}) {
  const {
    seconds = 20,
    seed = 0xc0ffee,
    mode = 'sustained',
    dummy = 'neutral',
    dummyCharId = neutralDummyCharId(),
    charge = 'full',
    gap = PLAYER_RADIUS * 2 + 6,
  } = opts;

  const restore = installSeededRandom(seed);
  try {
    const character = getCharacter(charId);
    const state: any = createInitialState(
      [
        { id: 'atk', name: character.name || 'ATK', charId, team: 1 },
        { id: 'dum', name: 'DUMMY', charId: dummyCharId, team: 2 },
      ],
      { freeMana: mode === 'burst' },
      { mode: 'ffa' },
    );

    const atk = state.players.atk;
    const dum = state.players.dum;
    const cx = ARENA.width / 2, cy = ARENA.height / 2;
    const dumX = cx + gap, dumY = cy;
    atk.x = cx; atk.y = cy; atk.facing = 0;
    dum.x = dumX; dum.y = dumY; dum.facing = Math.PI;

    // 木人：巨血不死。boss 型木人額外掛 isBoss（繞過近戰 ×0.85、走 boss 傷害修正路徑），
    // 並關閉 20% 鎖血奧義（ultLockTriggered=true）避免污染量測。
    dum.maxHp = 1e9; dum.hp = 1e9;
    if (dummy === 'boss') {
      dum.isBoss = true;
      dum.ultLockTriggered = true;
      dum.hitR = 90; // 代表中型 Boss 碰撞半徑（實際分布在 37~215，中位數~87）
    }

    setupStats(state);

    // 各 slot 蓄力參數：full=蓄滿（hold≈chargeMax 再放）、tap=點放（最小蓄力）；非蓄力技 hold=0。
    const holdTicks: Record<string, number> = {};
    for (const slot of ATTACK_SLOTS) {
      const a = character[slot];
      const cm = a && a.chargeMax ? a.chargeMax : 0;
      holdTicks[slot] = cm > 0 ? (charge === 'tap' ? 1 : Math.round(cm / DT) + 2) : 0;
    }
    const RELEASE = 2;

    const ticks = Math.round(seconds / DT);
    for (let i = 0; i < ticks; i++) {
      step(state, { atk: buildInput(atk, dum, gap, character, holdTicks, RELEASE, i) }, DT);
      // 不變量：攻擊者滿血不死（lowHp 技能在滿血量測，為已知限制）；木人巨血不死且 pin 在原地
      // （免被擊退跑走，維持命中率穩定，等同遊戲中的固定木樁）。
      atk.hp = atk.maxHp; atk.alive = true;
      dum.hp = 1e9; dum.alive = true;
      dum.x = dumX; dum.y = dumY; dum.vx = 0; dum.vy = 0; dum.kvx = 0; dum.kvy = 0;
    }

    const s = state.stats.perPlayer.atk || {};
    const elapsed = state.time || seconds;
    const total = s.dmgDealt || 0;
    const perSkill = Object.keys(s.perSkill || {})
      .map((slot) => ({
        slot,
        dmg: s.perSkill[slot],
        dps: s.perSkill[slot] / elapsed,
        pct: total ? s.perSkill[slot] / total : 0,
      }))
      .sort((a, b) => b.dmg - a.dmg);

    return {
      charId,
      name: character.name || String(charId),
      mode, dummy,
      seconds: round(elapsed, 2),
      total: round(total),
      dps: round(total / elapsed),
      maxHit: round(s.maxHit || 0),
      critCount: s.critCount || 0,
      skillUses: { ...(s.skillUses || {}) },
      perSkill,
    };
  } finally {
    restore();
  }
}

function buildInput(atk: any, dum: any, gap: number, character: any, holdTicks: Record<string, number>, RELEASE: number, tick: number) {
  const input: any = {
    up: false, down: false, left: false, right: false,
    basic: false, skill1: false, skill2: false, ultimate: false, evade: false,
    item1: false, item2: false,
    aim: Math.atan2(dum.y - atk.y, dum.x - atk.x), // 永遠面向木人（movement.ts 以 aim 鎖定 facing）
  };
  // 走位：離靶太遠（被位移技帶開）就走回，保持貼身、確保近戰命中與投射物高命中率。
  const dx = dum.x - atk.x, dy = dum.y - atk.y;
  if (Math.hypot(dx, dy) > gap + 6) {
    input.up = dy < -4; input.down = dy > 4; input.left = dx < -4; input.right = dx > 4;
  }
  // 技能輸入：非蓄力技壓著按（CD 一到就放、最大 uptime）；蓄力技以 hold→release 週期蓄滿後放。
  for (const slot of ATTACK_SLOTS) {
    if (!character[slot]) continue;
    const h = holdTicks[slot];
    input[slot] = h > 0 ? (tick % (h + RELEASE)) < h : true;
  }
  return input;
}

// ---- 報表格式化 ----
const SLOT_LABEL: Record<string, string> = {
  basic: '普攻', skill1: '技能1', skill2: '技能2', ultimate: '大招', evade: '閃避',
  summon: '召喚物', dot: 'DoT', reflect: '反傷', other: '其他',
};
const round = (n: number, d = 1) => Number((n || 0).toFixed(d));
const pad = (s: any, n: number) => String(s).padEnd(n);
const padL = (s: any, n: number) => String(s).padStart(n);

export function formatReport(row: any): string {
  const lines: string[] = [];
  lines.push(`【${row.name}】(${row.charId})  ${row.mode}/${row.dummy}靶  ${row.seconds}s`);
  lines.push(`  DPS ${padL(row.dps, 8)}   總傷 ${padL(row.total, 9)}   maxHit ${padL(row.maxHit, 6)}   crit×${row.critCount}`);
  for (const ps of row.perSkill) {
    const bar = '█'.repeat(Math.round(ps.pct * 24));
    const label = SLOT_LABEL[ps.slot] || ps.slot;
    lines.push(`    ${pad(label, 7)} ${padL(Math.round(ps.dmg), 9)}  ${padL((ps.pct * 100).toFixed(1) + '%', 6)}  ${bar}`);
  }
  return lines.join('\n');
}

// 量測整個玩家角色名冊，回傳 row 陣列（依 DPS 由高到低）。
export function measureAll(opts: DpsOptions = {}) {
  return CHARACTERS.map((c: any) => measureCharacter(c.id, opts)).sort((a, b) => b.dps - a.dps);
}

export function formatLeaderboard(rows: any[]): string {
  const head = `${pad('角色', 10)} ${padL('DPS', 8)} ${padL('總傷', 10)}  技能佔比（高→低）`;
  const body = rows.map((r) => {
    const mix = r.perSkill.slice(0, 4).map((p: any) => `${SLOT_LABEL[p.slot] || p.slot} ${(p.pct * 100).toFixed(0)}%`).join('  ');
    return `${pad(r.name, 10)} ${padL(r.dps, 8)} ${padL(r.total, 10)}  ${mix}`;
  });
  return [head, '─'.repeat(64), ...body].join('\n');
}
