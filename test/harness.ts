// 模擬回歸測試的共用骨架。
//
// 目的：建立一個「黃金回歸網」——以固定亂數種子 + 固定逐 tick 輸入腳本驅動權威
// 模擬 step()，把每秒的關鍵狀態 (hp/座標/冷卻/效果/實體數量) 蒐集成可比對的指紋。
// 任何重構若改變了模擬「行為」，快照比對就會失敗，逼我們確認是否為預期。
//
// 注意：引擎只有兩處在模擬路徑用到 Math.random (柱子散佈、散射 zone)，因此這裡
// 以 mulberry32 取代 Math.random，確保整段重播完全決定性、快照穩定。

// @ts-nocheck
import { step } from '../src/game/simulation.ts';
import { createInitialState } from '../src/game/entities.js';
import { ARENA, DT } from '../src/game/constants.js';

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

// ---- 場景 ----
// 6 人 FFA 混戰，角色組合刻意涵蓋多種 action type：
// 戰士(melee/charge/grapple)、法師(projectile/zone)、刺客(blink/dash)、
// 坦克(buff/pull)、治療(channel/heal/follow-zone)、狂戰士(leap)。
const SCENARIO_PLAYERS = [
  { id: 'p0', name: 'Warrior', charId: 0, team: 0 },
  { id: 'p1', name: 'Mage', charId: 1, team: 0 },
  { id: 'p2', name: 'Assassin', charId: 2, team: 0 },
  { id: 'p3', name: 'Tank', charId: 3, team: 0 },
  { id: 'p4', name: 'Healer', charId: 5, team: 0 },
  { id: 'p5', name: 'Berserker', charId: 6, team: 0 },
];

function buildScenario() {
  return createInitialState(SCENARIO_PLAYERS, {}, { mode: 'ffa' });
}

const playerIndex = (id: string) => Number(id.slice(1));

// 逐 tick 的決定性輸入腳本：先朝中央集結製造接戰，靠近後原地小幅繞動，
// 並依玩家序號錯開技能節奏 (避免完美對稱) 以涵蓋各 action 分支。
function scriptInputs(state: any) {
  const cx = ARENA.width / 2, cy = ARENA.height / 2;
  const t = Math.round(state.time / DT); // 目前 tick 數
  const inputs: Record<string, any> = {};
  for (const p of Object.values<any>(state.players)) {
    if (!p.alive) continue;
    const dx = cx - p.x, dy = cy - p.y;
    const s = playerIndex(p.id);
    const inp = {
      up: false, down: false, left: false, right: false,
      basic: false, skill1: false, skill2: false, ultimate: false, evade: false,
      aim: null,
    };
    if (Math.hypot(dx, dy) > 130) {
      inp.up = dy < -8; inp.down = dy > 8; inp.left = dx < -8; inp.right = dx > 8;
    } else {
      const k = (t >> 3) % 4; // 每 8 tick 換一個繞動方向
      inp.up = k === 0; inp.right = k === 1; inp.down = k === 2; inp.left = k === 3;
    }
    inp.basic = t % 18 === (s * 2) % 18;
    inp.skill1 = t % 90 === (s * 7) % 90;
    inp.skill2 = t % 140 === (s * 11) % 140;
    inp.ultimate = t % 60 === (s * 5) % 60;
    inp.evade = t % 200 === (s * 13) % 200;
    inputs[p.id] = inp;
  }
  return inputs;
}

const r = (n: number, d = 3) => Number((n ?? 0).toFixed(d));

// 擷取「行為相關」欄位 (刻意排除 fx 視覺細節以外的隨機性已被種子固定)。
function digestState(state: any) {
  const players = Object.keys(state.players).sort().map((id) => {
    const p = state.players[id];
    return {
      id,
      alive: p.alive,
      hp: r(p.hp),
      x: r(p.x),
      y: r(p.y),
      facing: r(p.facing),
      mana: r(p.mana),
      ult: r(p.ult),
      shield: r(p.shield),
      kills: p.kills,
      cd: Object.fromEntries(Object.keys(p.cd).sort().map((k) => [k, r(p.cd[k])])),
      effects: Object.keys(p.effects).sort(),
    };
  });
  return {
    time: r(state.time),
    phase: state.phase,
    winner: state.winner ?? null,
    counts: {
      projectiles: state.projectiles.length,
      zones: state.zones.length,
      fx: state.fx.length,
    },
    players,
  };
}

export function runScenario({ ticks = 900, seed = 0xc0ffee } = {}) {
  const restore = installSeededRandom(seed);
  try {
    const state = buildScenario();
    const trail: any[] = [];
    for (let i = 0; i < ticks; i++) {
      step(state, scriptInputs(state), DT);
      if (i % 30 === 29) trail.push(digestState(state)); // 每秒取樣一次
    }
    return { trail, final: digestState(state) };
  } finally {
    restore();
  }
}
