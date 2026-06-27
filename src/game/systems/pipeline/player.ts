import { getCharacter } from '../../characters.js';
import { EMPTY_INPUT } from '../../input.js';
import { computeBossInput } from '../../bossAI.js';
import { computeNpcInput } from '../../npcAI.ts';
import { castInputActions } from '../../actions/casting.ts';
import { processBarrage, processChannel, processScripted, processTrail } from '../../actions/runtime.ts';
import { applyPlayerAutoLock } from '../autoLock.ts';
import { tickStatusEffects } from '../effects.ts';
import { tickDropItems, useHpPotion, useMpPotion } from '../items.ts';
import { applyMovement } from '../movement.ts';
import { tickCharacterTimers, tickCooldowns, tickPassiveRecovery, tickSummonLife } from '../playerState.ts';
import type { GameState, Input, Player } from '../../types';
import type { PlayerPipelineContext, PlayerSystem } from './types.ts';
import { profileSystem } from './profiling.ts';

function resolvePlayerInput(ctx: PlayerPipelineContext) {
  let input = ctx.inputs[ctx.player.id] || EMPTY_INPUT;

  // 魔王/召喚物/鏡像：以 AI 計算輸入取代鍵盤 (host-only 運算)。
  if (ctx.player.aiId) {
    ctx.input = ctx.state.mode === 'boss' && ctx.state.roundPhase !== 'fighting'
      ? EMPTY_INPUT
      : computeBossInput(ctx.state, ctx.player, ctx.dt);
    return;
  }

  // 闖關 intro/cleared/wiped：人類玩家與 NPC 輸入皆凍結。
  if (ctx.state.mode === 'boss' && ctx.state.roundPhase !== 'fighting') {
    ctx.input = EMPTY_INPUT;
    return;
  }

  // 大廳加入的電腦玩家：以決策樹 AI 計算輸入取代鍵盤。
  if (ctx.player.isNpc) input = computeNpcInput(ctx.state, ctx.player, ctx.dt);

  ctx.input = input;
}

function usePressedItems(state: GameState, player: Player, input: Input) {
  if (player.aiId) return;
  if (player.itemHp == null) player.itemHp = 0;
  if (player.itemMp == null) player.itemMp = 0;
  if (!player._lastInput) player._lastInput = {};

  const item1Pressed = !!input.item1 && !player._lastInput.item1;
  const item2Pressed = !!input.item2 && !player._lastInput.item2;

  if (item1Pressed && player.itemHp > 0) useHpPotion(state, player);
  if (item2Pressed && player.itemMp > 0) useMpPotion(state, player);

  player._lastInput.item1 = !!input.item1;
  player._lastInput.item2 = !!input.item2;
}

export const PLAYER_SYSTEMS = [
  {
    id: 'summon-life',
    // 召喚物生命週期檢測：若已到期，傳回 'skip-player' 以跳過該實體後續的所有系統處理
    tick: ({ state, player, dt }: PlayerPipelineContext) => tickSummonLife(state, player, dt) ? 'skip-player' : undefined,
  },
  {
    id: 'resolve-input',
    tick: (ctx: PlayerPipelineContext) => resolvePlayerInput(ctx),
  },
  {
    id: 'character-timers',
    tick: (ctx: PlayerPipelineContext) => {
      const char = getCharacter(ctx.player.charId);
      ctx.character = char;
      ctx.talent = char.talent ?? null;
      tickCharacterTimers(ctx.state, ctx.player, char, ctx.talent, ctx.dt);
    },
  },
  {
    id: 'cooldowns',
    tick: ({ state, player, talent, dt }: PlayerPipelineContext) => tickCooldowns(state, player, talent, dt),
  },
  {
    id: 'status-effects',
    // 狀態效果結算：若在此 tick 中死亡，傳回 'skip-player' 以避免執行後續的移動、施法等系統
    tick: ({ state, player, dt }: PlayerPipelineContext) => {
      tickStatusEffects(state, player, dt);
      return player.alive ? undefined : 'skip-player';
    },
  },
  {
    id: 'passive-recovery',
    tick: ({ state, player, talent, dt }: PlayerPipelineContext) => tickPassiveRecovery(state, player, talent, dt),
  },
  {
    id: 'channels',
    tick: ({ state, player, dt }: PlayerPipelineContext) => processChannel(state, player, dt),
  },
  {
    id: 'barrage',
    tick: ({ state, player, dt }: PlayerPipelineContext) => processBarrage(state, player, dt),
  },
  {
    id: 'scripted-action',
    // 腳本化動作接管：若處於衝鋒、飛躍等特殊腳本狀態，傳回 'skip-player' 跳過一般移動、自動鎖定等處理
    tick: ({ state, player, dt }: PlayerPipelineContext) => processScripted(state, player, dt) ? 'skip-player' : undefined,
  },
  {
    id: 'items',
    tick: ({ state, player, input }: PlayerPipelineContext) => usePressedItems(state, player, input),
  },
  {
    id: 'auto-lock',
    tick: ({ state, player, input }: PlayerPipelineContext) => applyPlayerAutoLock(state, player, input),
  },
  {
    id: 'movement',
    tick: ({ state, player, input, dt }: PlayerPipelineContext) => applyMovement(player, input, dt, state.flags.difficulty ?? 0.5),
  },
  {
    id: 'trail',
    tick: ({ state, player, dt }: PlayerPipelineContext) => processTrail(state, player, dt),
  },
  {
    id: 'cast-input-actions',
    tick: ({ state, player, input, dt }: PlayerPipelineContext) => castInputActions(state, player, input, dt),
  },
] as const satisfies readonly PlayerSystem[];

export const PLAYER_PIPELINE_STEP_IDS = PLAYER_SYSTEMS.map((system) => system.id);

export function runPlayerPipeline(state: GameState, inputs: Record<string, Input>, dt: number) {
  for (const player of Object.values(state.players)) {
    if (!player.alive) continue;
    const ctx: PlayerPipelineContext = {
      state,
      inputs,
      player,
      dt,
      input: EMPTY_INPUT,
      character: null,
      talent: null,
    };
    for (const system of PLAYER_SYSTEMS) {
      // 執行各個玩家系統。如果傳回 'skip-player'，代表該玩家本 tick 的後續處理被中斷（例如死亡或被腳本接管）
      if (profileSystem('player', system.id, () => system.tick(ctx)) === 'skip-player') break;
    }
  }
}
