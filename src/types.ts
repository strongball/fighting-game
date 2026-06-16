// React UI 殼與命令式遊戲引擎之間的邊界型別。
// 引擎模組（game/*.js）維持 JavaScript，這裡只描述跨界傳遞用到的形狀。

export type AppPhase = 'menu' | 'lobby' | 'game' | 'gameover';
export type ControlScheme = 'wasd-jkl' | 'arrows-asdf';

export interface GameFlags {
  freeMana: boolean;
  noCooldown: boolean;
  noDamage: boolean;
}

export interface LobbyEntry {
  id: string;
  name: string;
  charId: number;
  controlScheme: ControlScheme;
  isHost: boolean;
  isNpc?: boolean;
  team?: number; // 0 = 單人 (與所有人為敵)；正數 = 同號為友方
}

export interface LobbyView {
  players: LobbyEntry[];
  selfId: string | null;
  isHost: boolean;
  roomCode: string;
  gameFlags: GameFlags;
}

export interface GameOverPlayer {
  name: string;
  charId: number;
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
}

// 角色資料：characters.js 為 .js，這裡描述 UI 會用到的欄位。
export interface SkillMeta {
  name: string;
}

export interface TalentMeta {
  name: string;
  desc: string;
}

export interface CharacterMeta {
  id: number;
  name: string;
  color: string;
  shape: 'square' | 'triangle' | 'circle';
  sprite?: string;
  maxHp: number;
  maxMana: number;
  desc: string;
  role?: string;     // 定位標籤 (前排/輸出/支援...)
  synergy?: string;  // 組隊搭配提示
  talent?: TalentMeta;
  basic: SkillMeta;
  skill1: SkillMeta;
  skill2: SkillMeta;
  ultimate?: SkillMeta;
  evade?: SkillMeta;
}

// Controller → React 推送的事件。
export interface ControllerEvents {
  phase: (phase: AppPhase) => void;
  lobby: (view: LobbyView) => void;
  menuStatus: (msg: string, isError: boolean) => void;
  lobbyStatus: (msg: string) => void;
  gameover: (view: GameOverView) => void;
}

// React → Controller 下達的指令。
export interface GameController {
  on<K extends keyof ControllerEvents>(event: K, fn: ControllerEvents[K]): () => void;
  createRoom(name: string): void;
  joinRoom(name: string, code: string): void;
  selectChar(charId: number): void;
  selectControlScheme(scheme: ControlScheme): void;
  selectTeam(team: number): void;
  selectGameFlags(flags: GameFlags): void;
  addNpc(): void;
  removeNpc(): void;
  startGame(): void;
  startBossGame(): void;
  devStartGame(charId?: number): void;
  devStartBoss(charId?: number): void;
  returnToLobby(): void;
  leave(): void;
  attachCanvas(canvas: HTMLCanvasElement): void;
  detachCanvas(): void;
  readonly selectedChar: number;
}
