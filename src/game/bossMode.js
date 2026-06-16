// 闖關模式 — 回合系統 / 過場 / 復活 / 部位與連線維護
//
// 由 simulation.step() 在 mode==='boss' 時呼叫，取代原本的 checkWin。
//   bossTick(state, dt)        每個 fighting tick：部位跟隨本體、靈魂綁定扣血、靠近復活、位置歷史
//   checkBossRound(state, dt)  回合階段機 (intro→fighting→cleared→下一關 / failed / victory)
//   startBossRound(state, n)   進入第 n 關 (生成魔王 + 部位、滿血全隊、過場橫幅)

import { ARENA } from './constants.js';
import { dist, addFx, spawnPoints } from './entities.js';
import { getBossForRound } from './bosses.js';
import {
  BOSS_TEAM,
  PLAYER_TEAM,
  clearBossSide,
  findBossEntity,
  followBossParts,
  spawnBoss,
  teamPlayers,
} from './bosses/lifecycle.ts';

export { BOSS_TEAM, PLAYER_TEAM, findBossEntity, teamPlayers };
const REVIVE_RADIUS = 100;   // 友方靠近此距離開始復活
const REVIVE_TIME = 3.0;     // 累計秒數達標即復活
const REVIVE_HP = 0.4;       // 復活血量比例
const HIST_CAP = 150;        // 位置歷史上限 (~5s @30Hz，供 R8 時光倒流)

// ---- 全隊復活 + 滿血 (每關開頭與過關時) ----
function reviveAndHealAll(state) {
  const humans = teamPlayers(state);
  const pts = spawnPoints(humans.length);
  const cx = ARENA.width / 2, cy = ARENA.height * 0.72;
  humans.forEach((p, i) => {
    p.alive = true;
    p.hp = p.maxHp; p.mana = p.maxMana; p.ult = 0;
    p.shield = 0; p.shieldTime = 0; p.effects = {};
    p.kvx = 0; p.kvy = 0; p.vx = 0; p.vy = 0;
    p.charge = null; p.leap = null; p.channel = null; p.trail = null; p.chargeState = null;
    p.reviveProg = 0;
    // 重新散開到下半場 (面向魔王)
    p.x = pts[i] ? cx + (pts[i].x - cx) * 0.5 : cx;
    p.y = cy;
    p.facing = -Math.PI / 2;
  });
}

// ---- 進入第 n 關 ----
export function startBossRound(state, round) {
  state.round = round;
  state.zones = []; state.projectiles = []; state.fx = [];
  state.tethers = [];
  clearBossSide(state);
  reviveAndHealAll(state);
  const boss = spawnBoss(state, round);
  state.bossId = boss ? boss.id : null;
  state.bossHp = boss ? boss.hp : 0;
  state.bossMaxHp = boss ? boss.maxHp : 0;
  state.roundPhase = 'intro';
  state.roundTimer = 2.8;
  const data = getBossForRound(round);
  state.banner = { text: 'ROUND ' + round, sub: data ? data.subtitle + '「' + data.name + '」' : '', life: 2.8 };
  return boss;
}

// ---- 每個 fighting tick 的維護 ----
export function bossTick(state, dt) {
  if (state.roundPhase !== 'fighting') return;
  followBossParts(state);
  tetherTick(state, dt);
  reviveTick(state, dt);
  recordHistory(state);
}

// 靈魂綁定 (R9)：成對連線，距離過近 → 雙方持續扣血
function tetherTick(state, dt) {
  if (!state.tethers || !state.tethers.length) return;
  const keep = [];
  for (const t of state.tethers) {
    t.remaining -= dt;
    const a = state.players[t.a], b = state.players[t.b];
    if (!a || !b || !a.alive || !b.alive || t.remaining <= 0) continue;
    const d = dist(a.x, a.y, b.x, b.y);
    if (d < t.minGap) {
      t.tickTimer -= dt;
      if (t.tickTimer <= 0) {
        t.tickTimer += t.tick || 0.5;
        // 直接扣血 (繞過護盾以強調「保持距離」機制)
        a.hp = Math.max(0, a.hp - t.dmg); b.hp = Math.max(0, b.hp - t.dmg);
        if (a.hp <= 0) a.alive = false; if (b.hp <= 0) b.alive = false;
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        addFx(state, { type: 'hit', x: mx, y: my, color: '#ff4d6d', life: 0.25, radius: 50 });
      }
    }
    // 連線視覺提示 (節流)
    t._vis = (t._vis || 0) - dt;
    if (t._vis <= 0) { t._vis = 0.2; addFx(state, { type: 'buff', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, color: d < t.minGap ? '#ff4d6d' : '#d8b3ff', life: 0.25, radius: 30 }); }
    keep.push(t);
  }
  state.tethers = keep;
}

// 靠近復活 (選項 A)：倒地玩家旁有存活友方則累積復活進度
function reviveTick(state, dt) {
  const humans = teamPlayers(state);
  for (const p of humans) {
    if (p.alive) continue;
    let helper = false;
    for (const o of humans) {
      if (o.alive && o.id !== p.id && dist(o.x, o.y, p.x, p.y) <= REVIVE_RADIUS) { helper = true; break; }
    }
    if (helper) {
      p.reviveProg = (p.reviveProg || 0) + dt;
      if (p.reviveProg >= REVIVE_TIME) {
        // 復活：狀態全滿 (HP + mana 100% + 清空 debuff + cd)
        p.alive = true; p.hp = p.maxHp; p.mana = p.maxMana; p.effects = {}; p.shield = 0;
        p.cd = { basic: 0, skill1: 0, skill2: 0, ultimate: 0 };
        p.reviveProg = 0; p.kvx = 0; p.kvy = 0;
        addFx(state, { type: 'buff', x: p.x, y: p.y, color: '#7CFC00', life: 0.6, radius: 70 });
      }
    } else {
      p.reviveProg = Math.max(0, (p.reviveProg || 0) - dt * 0.5);
    }
  }
}

// 位置歷史 (供 R8 時光倒流)
function recordHistory(state) {
  for (const p of teamPlayers(state)) {
    if (!p._hist) p._hist = [];
    p._hist.push({ x: p.x, y: p.y });
    if (p._hist.length > HIST_CAP) p._hist.shift();
  }
}

// ---- 回合階段機 ----
export function checkBossRound(state, dt) {
  if (state.phase !== 'playing') return;
  const boss = findBossEntity(state);
  if (boss) { state.bossHp = boss.hp; state.bossMaxHp = boss.maxHp; }
  const anyAlive = teamPlayers(state).some((p) => p.alive);

  if (state.roundPhase === 'intro') {
    state.roundTimer -= dt;
    if (state.banner) state.banner.life -= dt;
    if (state.roundTimer <= 0) { state.roundPhase = 'fighting'; state.banner = null; }
    return;
  }

  if (state.roundPhase === 'fighting') {
    if (!boss || !boss.alive) {
      state.roundPhase = 'cleared';
      state.roundTimer = 3.0;
      clearBossSide(state);
      reviveAndHealAll(state);
      state.banner = { text: 'ROUND ' + state.round + ' 擊破！', sub: state.round >= 10 ? '全部魔王已討伐' : '準備迎戰下一位魔王…', life: 3.0 };
      return;
    }
    if (!anyAlive) {
      state.roundPhase = 'failed';
      state.bossResult = 'defeat';
      state.phase = 'gameover';
      state.winner = null; state.winnerTeam = 0;
    }
    return;
  }

  if (state.roundPhase === 'cleared') {
    if (state.banner) state.banner.life -= dt;
    state.roundTimer -= dt;
    if (state.roundTimer <= 0) {
      if (state.round >= 10) {
        state.roundPhase = 'victory';
        state.bossResult = 'victory';
        state.phase = 'gameover';
        state.winner = null; state.winnerTeam = PLAYER_TEAM;
      } else {
        startBossRound(state, state.round + 1);
      }
    }
  }
}
