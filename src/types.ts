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
}

export interface GameOverView {
  winnerName: string | null;
  players: GameOverPlayer[];
  isHost: boolean;
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
  talent?: TalentMeta;
  basic: SkillMeta;
  skill1: SkillMeta;
  skill2: SkillMeta;
  ultimate?: SkillMeta;
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
  selectGameFlags(flags: GameFlags): void;
  startGame(): void;
  devStartGame(charId?: number): void;
  returnToLobby(): void;
  leave(): void;
  attachCanvas(canvas: HTMLCanvasElement): void;
  detachCanvas(): void;
  readonly selectedChar: number;
}
