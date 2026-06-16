// 闖關模式 — 回合系統 / 過場 / 復活 / 部位與連線維護
//
// 由 simulation.step() 在 mode==='boss' 時呼叫，取代原本的 checkWin。
//   bossTick(state, dt)        每個 fighting tick：部位跟隨本體、靈魂綁定扣血、靠近復活、位置歷史
//   checkBossRound(state, dt)  回合階段機 (intro→fighting→cleared→下一關 / failed / victory)
//   startBossRound(state, n)   進入第 n 關 (生成魔王 + 部位、滿血全隊、過場橫幅)

import { getBossForRound } from './bosses.js';
import {
  BOSS_TEAM,
  PLAYER_TEAM,
  clearBossSide,
  findBossEntity,
  spawnBoss,
  teamPlayers,
} from './bosses/lifecycle.ts';
import { reviveAndHealAll, tickBossSystems } from './bosses/systems.ts';

export { BOSS_TEAM, PLAYER_TEAM, findBossEntity, teamPlayers };

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
  tickBossSystems(state, dt);
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
