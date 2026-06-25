// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { getBossForRound } from '../src/game/bosses.js';
import { makePlayer, makeBoss, createInitialState } from '../src/game/entities/factories.ts';
import { executeAction } from '../src/game/actions/executor.ts';
import { tickBossSystems } from '../src/game/bosses/systems.ts';
import { applyBossDamageModifiers } from '../src/game/bosses/damage.ts';

describe('Round 7 Mecha God', () => {
  it('is registered as Round 7', () => {
    const boss = getBossForRound(7);
    expect(boss).toBeTruthy();
    expect(boss.name).toBe('機械真神');
  });

  it('spawns pylons at 75% HP and reduces damage by 90%', () => {
    const state: any = createInitialState([], {}, { mode: 'boss' });
    state.roundPhase = 'fighting';
    state.round = 7;

    const boss = makeBoss('mecha', 114, 200, 200, 2, { isBoss: true });
    const player = makePlayer('hero', 'Hero', 'warrior', 400, 400, 1);
    state.players = { [boss.id]: boss, [player.id]: player };

    // 初始狀態下沒有能量共振柱，傷害不變
    let modifiedDmg = applyBossDamageModifiers(state, boss, player, 100);
    expect(modifiedDmg).toBe(100);

    // 強制扣血至 70% 觸發起哨與能量共振柱生成
    boss.hp = boss.maxHp * 0.7;
    tickBossSystems(state, 0.1);

    // 驗證是否生成了 能量共振柱
    const pylons = Object.values(state.players).filter((o: any) => o.isMinion && o.charId === -7);
    expect(pylons.length).toBe(2);

    // 當能量柱存活時，傷害減免 90% (即只受 10% 傷害)
    modifiedDmg = applyBossDamageModifiers(state, boss, player, 100);
    expect(modifiedDmg).toBe(10);

    // 擊破所有能量柱
    for (const p of pylons) {
      p.alive = false;
      delete state.players[p.id];
    }

    // 能量柱死亡後，傷害減免移除
    modifiedDmg = applyBossDamageModifiers(state, boss, player, 100);
    expect(modifiedDmg).toBe(100);
  });

  it('increases heat on casting and enters overheat at 100% heat', () => {
    const state: any = createInitialState([], {}, { mode: 'boss' });
    state.roundPhase = 'fighting';
    state.round = 7;

    const boss = makeBoss('mecha', 114, 200, 200, 2, { isBoss: true });
    const player = makePlayer('hero', 'Hero', 'warrior', 300, 300, 1);
    state.players = { [boss.id]: boss, [player.id]: player };

    // 初始化 custom state
    tickBossSystems(state, 0.1);
    expect(state.bossCustom.heat).toBe(0);

    // 手動模擬 Boss 進入 windup 狀態 (Ultimate)
    boss.aiState = { mode: 'windup', slot: 'ultimate' };
    tickBossSystems(state, 0.1);

    // 應該增加了 35 點熱量 (扣除 0.1s * 6.5 = 0.65 的冷卻，餘 34.35)
    expect(state.bossCustom.heat).toBeCloseTo(34.35);

    // 持續釋放以累積熱量到 100%
    boss.aiState = { mode: 'windup', slot: 'ultimate' };
    boss._lastWindupSlot = null; // 重設以便再次偵測
    tickBossSystems(state, 0.1);
    expect(state.bossCustom.heat).toBeCloseTo(68.7);

    boss.aiState = { mode: 'windup', slot: 'ultimate' };
    boss._lastWindupSlot = null;
    tickBossSystems(state, 0.1);
    expect(state.bossCustom.heat).toBeCloseTo(99.35);
    expect(state.bossCustom.isOverheated).toBe(true);

    // 再 Tick 一次以觸發過熱分支中的 slow 效果套用
    tickBossSystems(state, 0.1);

    // 驗證過熱下的狀態：套用減速 60%
    expect(boss.effects.slow).toBeTruthy();
    expect(boss.effects.slow.factor).toBe(0.4);

    // 驗證過熱下的狀態：受傷害增加 50%
    const modifiedDmg = applyBossDamageModifiers(state, boss, player, 100);
    expect(modifiedDmg).toBe(150);

    // Tick 過熱時間 (6 秒)
    tickBossSystems(state, 6.1);
    expect(state.bossCustom.isOverheated).toBe(false);
    expect(state.bossCustom.heat).toBe(0);
  });
});
