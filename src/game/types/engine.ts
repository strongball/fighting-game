// 權威遊戲狀態的型別。
//
// GameState 是整個模擬的單一真相來源（single source of truth）：房主每 tick 對它
// 呼叫 step() 推進，並把（精簡後的）快照廣播給加入者。對應 entities/factories.ts
// 的 createInitialState。

import type { Player, Projectile, Zone, Fx, Destructible, EntityId, DropItem } from './entities';

export type GamePhase = 'playing' | 'gameover';
export type GameMode = 'ffa' | 'boss';
/** 闖關回合階段：登場 → 戰鬥 → 清關 / 全滅。 */
export type RoundPhase = 'intro' | 'fighting' | 'cleared' | 'wiped';

/** 沙盒/除錯旗標（建房時設定）。 */
export interface GameFlags {
  freeMana: boolean;
  noCooldown: boolean;
  noDamage: boolean;
  [key: string]: boolean;
}

/** 慢動作：擊破魔王時觸發，縮放 dt 但以實際 dt 倒數 remaining。 */
export interface TimeFreeze {
  remaining: number;
  scale?: number;
}

export interface TimeAnchor {
  id: string;
  ownerId: EntityId;
  x: number;
  y: number;
  radius: number;
  captureRadius: number;
  color: string;
  occupiedBy: EntityId | null;
  occupancyGrace: number;
  progress: number;
}

export interface TimeAnchorRitual {
  ownerId: EntityId;
  total: number;
  remaining: number;
  progress: number;
  occupied: number;
  required: number;
}

export interface GameState {
  phase: GamePhase;
  mode: GameMode;
  players: Record<string, Player>;
  projectiles: Projectile[];
  zones: Zone[];
  fx: Fx[];
  destructibles: Destructible[];
  items: DropItem[];
  time: number;
  winner: EntityId | null;
  winnerTeam: number;
  startCount: number;
  flags: GameFlags;

  // 闖關模式欄位（FFA 時為預設值）
  round: number;
  bossId: number | null;
  bossHp: number;
  bossMaxHp: number;
  roundPhase: RoundPhase;
  roundTimer: number;
  playerCount: number;
  banner: any | null;
  timeAnchors: TimeAnchor[];
  timeAnchorRitual: TimeAnchorRitual | null;

  timeFreeze?: TimeFreeze | null;
  stats?: any;

  [key: string]: any;
}
