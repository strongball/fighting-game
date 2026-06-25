import { describe, it, expect } from 'vitest';
import { getBossForRound } from '../src/game/bosses.js';
import { makePlayer, makeBoss, createInitialState } from '../src/game/entities/factories.ts';
import { executeAction } from '../src/game/actions/executor.ts';
import { tickBossSystems } from '../src/game/bosses/systems.ts';

describe('Round 5 Tidal Siren', () => {
  it('is registered as Round 5', () => {
    const boss = getBossForRound(5);
    expect(boss).toBeTruthy();
    expect(boss.name).toBe('潮汐歌姬');
  });

  it('spawns safe bubbles and slows/drowns players outside bubbles during flood', () => {
    const state: any = createInitialState([], {}, { mode: 'boss' });
    state.roundPhase = 'fighting';
    state.round = 5;

    const boss = makeBoss('siren', 113, 200, 200, 2, { isBoss: true });
    const player = makePlayer('hero', 'Hero', 'warrior', 400, 400, 1);
    state.players = { [boss.id]: boss, [player.id]: player };

    // 手動設定為即將起潮
    state.bossCustom = {
      floodCycleTimer: 0.05,
      floodDurationTimer: 0.0,
      isFlooded: false,
      isPermanentlyFlooded: false,
      currentTimer: 6.0,
      currentDuration: 0.0,
      currentDir: { x: 0, y: 0 }
    };

    // 觸發起潮
    tickBossSystems(state, 0.1);

    expect(state.bossCustom.isFlooded).toBe(true);
    expect(state.bossCustom.floodDurationTimer).toBeGreaterThan(0);

    // 驗證是否生成 2 個安全氣泡
    const safeZones = state.zones.filter((z: any) => z.vfx === 'boss_siren_safe_bubble');
    expect(safeZones.length).toBe(2);

    // 玩家傳送到遠離安全氣泡的位置 (例如 0, 0)，確認會溺水與減速
    player.x = 0;
    player.y = 0;
    player._drownTimer = 0; // 重置溺水計時器以便立刻觸發
    for (const z of safeZones) {
      z.x = 500;
      z.y = 500;
    }

    const initialHp = player.hp;
    tickBossSystems(state, 0.1);

    // 應該被減速且扣血
    expect(player.effects.slow).toBeTruthy();
    expect(player.hp).toBeLessThan(initialHp);

    // 將玩家移到安全氣泡內，清除 slow
    player.x = safeZones[0].x;
    player.y = safeZones[0].y;
    delete player.effects.slow;
    const safeHp = player.hp;

    tickBossSystems(state, 0.1);

    // 安全氣泡內不應被減速或扣血
    expect(player.effects.slow).toBeFalsy();
    expect(player.hp).toBe(safeHp);
  });

  it('stuns the player inside a bubble minion and frees them when bubble is killed', () => {
    const state: any = createInitialState([], {}, { mode: 'boss' });
    state.roundPhase = 'fighting';
    state.round = 5;

    const boss = makeBoss('siren', 113, 200, 200, 2, { isBoss: true });
    const player = makePlayer('hero', 'Hero', 'warrior', 300, 300, 1);
    const teammate = makePlayer('teammate', 'Teammate', 'warrior', 350, 350, 1);
    state.players = { [boss.id]: boss, [player.id]: player, [teammate.id]: teammate };

    // 施放水泡禁錮
    executeAction(state, boss, getBossForRound(5)!.skill2);

    // 驗證水泡小兵生成
    const bubble = Object.values(state.players).find((o: any) => o.isMinion && o.charId === -3);
    expect(bubble).toBeTruthy();
    expect((bubble as any).trappedPlayerId).toBe(player.id);

    // Tick 更新狀態
    tickBossSystems(state, 0.1);

    // 玩家被暈眩
    expect(player.effects.stun).toBeTruthy();

    // 擊破水泡
    (bubble as any).alive = false;
    delete state.players[bubble.id];

    // 手動清除已套用的 stun 狀態，確認後續 Tick 不會再次被 Boss 重新套用
    delete player.effects.stun;

    // 再次 Tick
    tickBossSystems(state, 0.1);

    // 玩家恢復，不再受暈眩影響
    expect(player.effects.stun).toBeFalsy();
  });
});
