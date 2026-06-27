import type { GameState, Input, Player } from '../../types';
import type { CharacterMeta, TalentMeta } from '../../../types';

/**
 * PlayerSystemResult 定義了 PlayerSystem 執行的傳回值。
 * 如果傳回 'skip-player'，則 pipeline 停止處理該 player 的剩餘 systems。
 * 例如：如果 summon life 到期、或被擊殺、或進入 scripted action 接管，
 * 都會傳回 'skip-player' 來跳過後續的 item、auto-lock、movement 等 system。
 */
export type PlayerSystemResult = 'skip-player' | void;

export interface PlayerPipelineContext {
  state: GameState;
  inputs: Record<string, Input>;
  player: Player;
  dt: number;
  input: Input;
  character: CharacterMeta | null;
  talent: TalentMeta | null;
}

export interface PlayerSystem {
  readonly id: string;
  tick(ctx: PlayerPipelineContext): PlayerSystemResult;
}

export interface WorldSystem {
  readonly id: string;
  tick(state: GameState, dt: number): void;
}
