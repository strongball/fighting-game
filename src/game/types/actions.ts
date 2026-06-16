// 動作系統的型別。
//
// 動作系統採 registry 模式（actions/handlers/**/index.ts 以 import.meta.glob 自動註冊）：
// 每個 action 的 `type` 對應一個 ActionHandler。新增 action 只要在 handlers/ 下加一個
// 資料夾匯出 `{ handlers: { <type>: fn } }` 即可，無需改 executor。

import type { GameState } from './engine';
import type { Player, EffectSpec, EntityId } from './entities';

/** 一幀的玩家輸入（鍵盤或 AI 合成）。 */
export interface Input {
  up: boolean; down: boolean; left: boolean; right: boolean;
  basic: boolean; skill1: boolean; skill2: boolean; ultimate: boolean; evade: boolean;
  /** 魔王 AI 合成的瞄準角度；人類玩家為 null（以移動方向轉向）。 */
  aim: number | null;  /** 允許以 slot 字串動態索引（casting.ts 的 input[slot]）。 */
  [key: string]: boolean | number | null;}

/**
 * 已知 action type。以 `(string & {})` 收尾保留擴充彈性。
 * 對應 actions/handlers/<type>/ 以及 bosses/actions.ts 的魔王專屬動作。
 */
export type ActionType =
  | 'projectile' | 'melee' | 'dash' | 'blink' | 'charge' | 'leap'
  | 'grapple' | 'multiblink' | 'channel' | 'zone' | 'buff' | 'summon'
  // 闖關魔王專屬
  | 'summon_clones' | 'summon_minions' | 'apply_scramble' | 'time_rewind'
  | 'soul_bind' | 'light_dark' | 'mirror_players' | 'steal_ultimate'
  | (string & {});

/** 對自己施放的增益（任何 action 皆可附帶）。 */
export interface SelfBuffSpec {
  cleanse?: boolean;
  heal?: number;
  shield?: number;
  duration?: number;
  effect?: EffectSpec;
  effects?: EffectSpec[];
}

/** 對友方施放的增益（含半徑與可選命中特效）。 */
export interface AllyBuffSpec extends SelfBuffSpec {
  radius?: number;
  vfx?: string;
  color?: string;
  vfxLife?: number;
}

/**
 * 角色技能/動作的資料定義（characters.js / bosses 內撰寫）。
 * 不同 type 用到不同欄位子集，這裡聚合為一個寬鬆結構 + 索引簽章，
 * 各 handler 自行讀取所需欄位（並對缺漏給預設值）。
 */
export interface ActionDef {
  type: ActionType;
  name?: string;

  // 通用
  dmg?: number;
  range?: number;
  radius?: number;
  arc?: number;
  knockback?: number;
  cd?: number;
  manaCost?: number;
  hpCost?: number;
  color?: string;
  vfx?: string;
  effect?: EffectSpec;
  self?: SelfBuffSpec;
  ally?: AllyBuffSpec;

  // projectile / grapple
  speed?: number;
  lifetime?: number;
  pierce?: boolean;
  split?: any;
  homing?: number;
  count?: number;
  spread?: number;
  chargeMax?: number;
  gap?: number;

  // zone
  tick?: number;
  delay?: number;
  scatter?: number;
  stagger?: number;
  moving?: number;        // moving zone 推進速度 (px/s)
  follow?: boolean;
  pull?: number;
  drainHeal?: number;
  allyHeal?: number;

  // charge / leap / dash / blink / multiblink
  hitRadius?: number;
  stopOnHit?: boolean;
  impulse?: number;
  marks?: number;

  [key: string]: any;
}

/** executeAction 的選項（含蓄力倍率、靜默旗標）。 */
export interface ActionOpts {
  /** 大招以單一 'ultimate' fx 代替動作自身 fx，避免重複觸發 onCast。 */
  silent?: boolean;
  chargeFactor?: number;
  chargeRatio?: number;
  [key: string]: any;
}

export type ExecuteAction = (
  state: GameState,
  caster: Player,
  action: ActionDef,
  opts?: ActionOpts,
) => void;

/**
 * 傳給每個 handler 的執行情境。由 actions/context.ts createActionContext 建立。
 * handler 只解構自己需要的欄位。
 */
export interface ActionContext {
  state: GameState;
  caster: Player;
  action: ActionDef;
  opts: ActionOpts;
  executeAction: ExecuteAction;
  silent: boolean;
  damageMultiplier: number; // opts.chargeFactor || 1
  chargeRatio: number;      // 0..1 蓄力進度
  cos: number;              // Math.cos(caster.facing)，避免各 handler 重算
  sin: number;
}

export type ActionHandler = (ctx: ActionContext) => void;

/** action type → handler 的 registry（actions/handlers/index.ts）。 */
export type ActionHandlerMap = Map<string, ActionHandler>;

// ---- 各類動作的精確形狀 ----
// 某些欄位在 ActionDef 為可選（因為跨 type 不一定存在），但對特定 type 是必有的。
// handler 內以 `ctx.action as XxxAction` 收斂，既可取得 number 型別又記錄該 type 的合約。
/** projectile / 多重彈。 */
export interface ProjectileAction extends ActionDef { dmg: number; radius: number; speed: number; lifetime: number; }
/** dash 位移衝刺。 */
export interface DashAction extends ActionDef { impulse: number; }
/** blink 瞬移。 */
export interface BlinkAction extends ActionDef { range: number; }
