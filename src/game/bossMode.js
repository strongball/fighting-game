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
import { scatterPillars } from './systems/destructibles.ts';
import { initRunStats, ensureAllPlayerStats, recordRoundStart, recordRoundEnd, recordRetry } from './entities/stats.ts';

export { BOSS_TEAM, PLAYER_TEAM, findBossEntity, teamPlayers };

// ---- 房主：選擇「重打本關」 ----
export function retryBossRound(state) {
  if (state.roundPhase !== 'wiped' || state.mode !== 'boss') return;
  recordRetry(state);
  startBossRound(state, state.round);
}

// ---- 房主：選擇「放棄本輪」(轉到原先的 failed/gameover 流程) ----
export function quitBossRun(state) {
  if (state.roundPhase !== 'wiped' || state.mode !== 'boss') return;
  state.roundPhase = 'failed';
  state.bossResult = 'defeat';
  state.phase = 'gameover';
  state.winner = null; state.winnerTeam = 0;
}

// ---- 進入第 n 關 ----
export function startBossRound(state, round) {
  const isNewRound = round > state.round;
  state.round = round;
  state.zones = []; state.projectiles = []; state.fx = [];
  state.tethers = [];
  state.destructibles = [];
  clearBossSide(state);
  reviveAndHealAll(state);

  if (state.mode === 'boss') {
    const humans = teamPlayers(state);
    humans.forEach((p) => {
      if (p.itemHp == null) p.itemHp = 0;
      if (p.itemMp == null) p.itemMp = 0;

      if (round === 1 && !isNewRound) {
        // Initial game start: exactly 1 of each
        p.itemHp = 1;
        p.itemMp = 1;
      } else if (isNewRound) {
        // Advancing to next round: carry over and add 1
        p.itemHp = Math.min(3, p.itemHp + 1);
        p.itemMp = Math.min(3, p.itemMp + 1);
      } else {
        // Retry same round: make sure they have at least 1
        p.itemHp = Math.max(1, p.itemHp);
        p.itemMp = Math.max(1, p.itemMp);
      }
    });
  }

  if (!state.stats || round === 1) initRunStats(state);
  else ensureAllPlayerStats(state);
  recordRoundStart(state);
  const boss = spawnBoss(state, round);
  // 環境互動：每關依 boss data.environment 撒石柱 (R3 / R5 / R7 較多)
  const bossData = getBossForRound(round);
  const envCfg = bossData && bossData.environment;
  if (envCfg && envCfg.pillars) scatterPillars(state, envCfg.pillars.count || 4, envCfg.pillars);
  state.bossId = boss ? boss.id : null;
  state.bossHp = boss ? boss.hp : 0;
  state.bossMaxHp = boss ? boss.maxHp : 0;
  state.roundPhase = 'intro';
  state.roundTimer = 3.2;
  state.introDur = 3.2;
  const data = getBossForRound(round);
  state.banner = { text: 'ROUND ' + round, sub: data ? data.subtitle + '「' + data.name + '」' : '', life: 3.2 };
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
    // 階段橫幅 / 其他 fighting 期間的短暫橫幅倒數
    if (state.banner && state.banner.life != null) {
      state.banner.life -= dt;
      if (state.banner.life <= 0) state.banner = null;
    }
    if (!boss || !boss.alive) {
      // Boss 死亡時若慢動作仍在進行，等慢動作結束再進入 cleared (保留場上 Boss 模型供爆閃秀)
      if (state.timeFreeze && state.timeFreeze.remaining > 0) return;
      const bossData = getBossForRound(state.round);
      recordRoundEnd(state, { bossName: bossData ? bossData.name : '', defeated: true });
      state.roundPhase = 'cleared';
      state.roundTimer = 3.0;
      clearBossSide(state);
      reviveAndHealAll(state);
      state.banner = { text: 'ROUND ' + state.round + ' 擊破！', sub: state.round >= 10 ? '全部魔王已討伐' : '準備迎戰下一位魔王…', life: 3.0 };
      return;
    }
    if (!anyAlive) {
      // 全滅 → 進入 'wiped'，等房主決定 (重打 / 放棄)；遊戲仍在 playing
      state.roundPhase = 'wiped';
      state.banner = null;
      state.bossWipedRound = state.round;
    }
    return;
  }

  if (state.roundPhase === 'wiped') {
    // 等待房主呼叫 retryBossRound / quitBossRun (controller)
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
