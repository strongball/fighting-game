// React UI 殼與命令式遊戲引擎之間的邊界型別。
// 引擎模組（game/*.js）維持 JavaScript，這裡只描述跨界傳遞用到的形狀。

import type { ActionDef, ActionType } from './game/types/actions';

export type AppPhase = 'menu' | 'lobby' | 'game' | 'gameover';
export type ControlScheme = 'wasd-jkl' | 'arrows-asdf' | 'wasd-ijkl';

// 大廳玩法模式（由房主選定、同步給所有人，決定大廳要顯示哪些設定）：
// versus=群雄亂鬥(PvP) / expedition=征伐之路(全 Boss 連戰) / challenge=魔王試煉(指定單王)
export type LobbyMode = 'versus' | 'expedition' | 'challenge';

export interface GameFlags {
  freeMana: boolean;
  noCooldown: boolean;
  noDamage: boolean;
  difficulty: number;  // -0.3=簡單 0=普通 0.5=困難
}

export interface LobbyEntry {
  id: string;
  name: string;
  charId: string; // 角色 slug（穩定唯一 id），見 game/characters/index.ts
  controlScheme: ControlScheme;
  isHost: boolean;
  isNpc?: boolean;
  team?: number; // 0 = 單人 (與所有人為敵)；正數 = 同號為友方
  ready?: boolean;  // 大廳準備狀態（房主/NPC 視為恆 true）
  inGame?: boolean; // 是否已進入當前這場戰鬥（供右上角玩家清單 / 中途加入判定）
}

export interface LobbyView {
  players: LobbyEntry[];
  selfId: string | null;
  isHost: boolean;
  roomCode: string;
  gameFlags: GameFlags;
  lobbyMode: LobbyMode; // 房主選定的玩法模式（同步給加入者，決定大廳顯示哪些設定）
  bossRound?: number;   // 魔王試煉(challenge)：房主選定的單王回合（同步顯示）
  matchLive?: boolean; // 房主是否已開打（此時加入者按鈕由「準備」改為「加入遊戲」）
}

export interface GameOverPlayer {
  name: string;
  charId: string; // 角色 slug
  kills: number;
  team?: number;
}

export interface GameOverView {
  winnerName: string | null;
  winnerTeam?: number; // 0 = 單人勝 / >0 = 獲勝隊伍
  players: GameOverPlayer[];
  isHost: boolean;
  bossResult?: 'victory' | 'defeat'; // 闖關模式結果
  bossRound?: number;                // 抵達/通關的關卡
  bossStats?: BossRunStats;          // 闖關統計 (僅 boss 模式)
  bossMode?: 'campaign' | 'challenge';
  bossName?: string;
}

export interface BossRoundEntry {
  round: number;
  bossName: string;
  duration: number;
  defeated: boolean;
  retries: number;
}

export interface BossPlayerStats {
  id: string;
  name: string;
  charId: string; // 角色 slug
  dmgDealt: number;
  dmgTaken: number;
  healing: number;
  kills: number;
  deaths: number;
  revives: number;
  maxHit: number;
  critCount: number;
  ccApplied: number;
  skillUses: { basic: number; skill1: number; skill2: number; ultimate: number; evade: number };
}

export interface BossRunStats {
  totalDuration: number;
  retryCount: number;
  perRound: BossRoundEntry[];
  perPlayer: BossPlayerStats[];
  mvpId: string | null;
}

// 練功房（傷害測試）即時統計：controller 每 ~0.15s 推送一次。
export interface TrainingSkillRow {
  slot: string;   // basic/skill1/skill2/ultimate/evade/summon/dot/reflect/other
  dmg: number;
  dps: number;
  pct: number;    // 0~1，佔總輸出比例
}
export interface TrainingStatsView {
  charId: string;
  charName: string;
  elapsed: number;     // 秒（自上次重置起算）
  total: number;       // 累計輸出傷害
  dps: number;
  dmgTaken: number;    // 累計承受傷害（木人還手時）
  maxHit: number;
  critCount: number;
  skillUses: Record<string, number>;
  perSkill: TrainingSkillRow[]; // 依傷害高→低排序
  retaliate: boolean;
}

export type SkillSlot = 'basic' | 'skill1' | 'skill2' | 'ultimate' | 'evade';

// 角色資料：characters.js 為 .js，這裡描述 UI 會用到的欄位。
export interface SkillMeta extends Partial<Omit<ActionDef, 'name' | 'type'>> {
  name: string;
  desc?: string;
  type?: ActionType;
}

export interface TalentMeta {
  name: string;
  desc: string;
  [key: string]: any;
}

export interface CharacterMeta {
  id: string; // 角色 slug（穩定唯一 id）
  order?: number; // 大廳顯示順序；也是「角色圖鑑.md」的對照 id
  name: string;
  color: string;
  shape: 'square' | 'triangle' | 'circle';
  sprite?: string;
  maxHp: number;
  maxMana: number;
  speed?: number;    // 移速 (詳情面板顯示用)
  desc: string;
  role?: string;     // 定位標籤 (前排/輸出/支援...)
  synergy?: string;  // 組隊搭配提示
  talent?: TalentMeta;
  basic: SkillMeta;
  skill1: SkillMeta;
  skill2: SkillMeta;
  ultimate?: SkillMeta;
  evade?: SkillMeta;
  [key: string]: any;
}

// Controller → React 推送的事件。
export interface ControllerEvents {
  phase: (phase: AppPhase) => void;
  lobby: (view: LobbyView) => void;
  menuStatus: (msg: string, isError: boolean) => void;
  lobbyStatus: (msg: string) => void;
  gameover: (view: GameOverView) => void;
  trainingStats: (view: TrainingStatsView | null) => void;
}

// React → Controller 下達的指令。
export interface GameController {
  on<K extends keyof ControllerEvents>(event: K, fn: ControllerEvents[K]): () => void;
  createRoom(name: string): void;
  joinRoom(name: string, code: string): void;
  setReady(ready: boolean): void;
  joinGame(): void;
  selectChar(charId: string): void;
  selectControlScheme(scheme: ControlScheme): void;
  selectTeam(team: number): void;
  selectGameFlags(flags: GameFlags): void;
  selectLobbyMode(mode: LobbyMode): void;
  selectBossRound(round: number): void;
  addNpc(): void;
  removeNpc(): void;
  startGame(): void;
  startBossGame(): void;
  startBossChallenge(round: number): void;
  devStartGame(charId?: string): void;
  devStartBoss(charId?: string, round?: number): void;
  startTraining(charId?: string, opts?: { retaliate?: boolean }): void;
  resetTrainingStats(): void;
  setTrainingRetaliate(on: boolean): void;
  quitTraining(): void;
  returnToLobby(): void;
  bossRetry(): void;
  bossQuit(): void;
  leave(): void;
  attachCanvas(canvas: HTMLCanvasElement): void;
  detachCanvas(): void;
  readonly selectedChar: string;
  readonly isHost: boolean;
}
