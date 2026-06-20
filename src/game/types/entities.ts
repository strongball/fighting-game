// 引擎核心實體型別。
//
// 設計原則（漸進式型別）：明確列出「已知欄位」提供 IntelliSense 與文件價值，
// 同時保留 `[key: string]: any` 逃生口——引擎大量使用動態欄位，若強制列舉全部，
// 移除舊檔的 @ts-nocheck 時會引爆數百個錯誤。已知欄位給型別，長尾欄位給彈性。

export type EntityId = string | number;

/** 技能冷卻槽（秒）。0 = 就緒。 */
export interface CooldownBag {
  basic: number;
  skill1: number;
  skill2: number;
  ultimate: number;
  evade: number;
  [slot: string]: number;
}

/** 作者端在角色/技能資料上撰寫的效果規格（施加什麼 debuff/buff）。 */
export interface EffectSpec {
  kind: EffectKind;
  duration?: number;
  factor?: number;
  stacks?: number;
  max?: number;
  tick?: number;
  dmg?: number;
  moveMult?: number;
  freezeDur?: number;
  amount?: number;
  [key: string]: any;
}

/**
 * 執行期掛在 player.effects[kind] 上的效果實例（由 entities/effects.ts applyEffect 建立）。
 * 欄位依 kind 而異——常見：remaining/duration/factor/stacks/max/tick/tickTimer/dmg/
 * moveMult/bonus/freezeDur/froze/speed/atkSpeed/srcId。
 * 故以 any-bag 表示（避免逐 kind 過度建模引發跨檔讀取摩擦）；權威定義見 effects.ts。
 */
export interface EffectInstance {
  [key: string]: any;
}

/**
 * 已知效果種類。用 `(string & {})` 收尾：對已知值提供自動完成，又不阻擋新效果字串。
 * 對應 entities/effects.ts 的 applyEffect 分支。
 */
export type EffectKind =
  | 'slow' | 'stun' | 'burn' | 'bleed' | 'mark' | 'reflect' | 'protect'
  | 'chill' | 'frozen' | 'root' | 'weaken' | 'dmg_reduce'
  | 'rage' | 'haste' | 'lifesteal' | 'evading' | 'invis' | 'overdrive'
  | 'heal' | 'shield' | 'cleanse'
  | (string & {});

/** player.effects：效果種類 → 執行期實例。 */
export type EffectBag = Partial<Record<string, EffectInstance>>;

/**
 * 玩家 / 魔王 / 召喚物的統一實體。makeBoss 在 makePlayer 之上補魔王/部位/召喚欄位，
 * 因此這些欄位皆為可選。底線前綴欄位（_chronoHist…）= 不入網路 snapshot 的本地暫存。
 */
export interface Player {
  id: EntityId;
  name: string;
  charId: number;
  team: number;

  // 運動學
  x: number; y: number;
  vx: number; vy: number;
  kvx: number; kvy: number; // 擊退速度（與一般速度分離）
  facing: number;

  // 生命 / 資源
  hp: number; maxHp: number;
  mana: number; maxMana: number;
  alive: boolean;
  hitR: number;            // 被命中半徑（魔王/部位依模型放大）
  shield: number; shieldTime: number;
  ult: number;             // 終極能量槽 0..ULT_MAX
  kills: number;

  cd: CooldownBag;
  effects: EffectBag;

  // 進行中的腳本化動作狀態（由 actions/runtime.ts 接管移動）。makePlayer 一律初始化為
  // null，故為必填但可為 null/any（runtime 會塞入結構化狀態物件）。
  chargeState: any;
  charge: any;
  leap: any;
  channel: any;
  trail: any;
  still: number;
  combo: number; comboTimer: number;
  iaiTimer: number; iaiReady?: boolean;
  suppressTarget: EntityId | null; suppressStacks: number;

  // 召喚物 / 魔王 / 部位 / 鏡像
  ownerId: EntityId | null;
  summonLife: number;
  isSummon?: boolean;
  isBoss?: boolean; isMinion?: boolean; isFake?: boolean; isPart?: boolean; isMirror?: boolean;
  aiId?: string | null;
  partId?: string | null;
  bossRound?: number;
  scale?: number;
  aiState?: Record<string, any>;

  // 藥水背包系統
  itemHp: number; // 0..3
  itemMp: number; // 0..3

  // 本地暫存（不入 snapshot）
  _chronoHist?: Array<{ x: number; y: number; hp: number }>;
  _healAccum?: number;

  [key: string]: any;
}

/** 投射物（由 entities/factories.ts makeProjectile 建立）。 */
export interface Projectile {
  id: number;
  owner: EntityId;
  x: number; y: number; vx: number; vy: number;
  dmg: number; radius: number; lifetime: number;
  color?: string;
  knockback: number;
  pierce: boolean;
  effect?: EffectSpec | null;
  split?: any | null;        // 命中/到期分裂成 N 顆子彈
  homing: number;            // 追蹤轉向速率 (rad/s)，0 = 直線
  pull?: { gap?: number } | null; // 鉤索：命中把目標拉到 owner 面前
  leaveZone?: any | null;    // 落點留下 zone（煙幕等）
  freezeBonus: number;
  vfx?: string | null;
  hit: Record<string, boolean>; // 已命中目標（防 pierce 重複打）
  [key: string]: any;
}

/** 範圍區（由 entities/factories.ts makeZone 建立）。 */
export interface Zone {
  id: number;
  owner: EntityId;
  x: number; y: number;
  radius: number; dmg: number;
  lifetime: number; tick: number; tickTimer: number;
  delay: number;             // 落地前的預警延遲（隕石等）
  effect?: EffectSpec | null;
  color?: string;
  effects?: EffectSpec[] | null; // 多重 debuff
  allyEffect?: EffectSpec | null; // 每 tick 對友方施增益
  knockback: number;
  vx: number; vy: number;    // moving zone（火牆/地裂線）
  follow?: EntityId | null;  // 綁定 owner 每幀跟隨（光環）
  pull: number;              // 向心吸引（黑洞）
  drainHeal: number;         // 命中數 × 回血
  allyHeal: number;          // 每 tick 對圈內友方回血
  vfx?: string | null;
  [key: string]: any;
}

/** 一次性視覺特效事件（不影響模擬，僅供 renderer 去重觸發）。 */
export interface Fx {
  id?: number;
  type: string;
  x: number; y: number;
  life: number;
  color?: string;
  radius?: number;
  facing?: number;
  vfx?: string | null;
  [key: string]: any;
}

/** 可破壞的場景物件（闖關模式柱子/火堆）。半徑欄位為 `r`。 */
export interface Destructible {
  id: number;
  x: number; y: number;
  r: number;
  hp: number;
  maxHp?: number;
  color?: string;
  kind?: string;
  crashStun?: number;
  [key: string]: any;
}

/** 掉落的藥水實體。 */
export interface DropItem {
  id: number;
  x: number; y: number;
  kind: 'heal' | 'mana';
  lifetime: number;
  maxLifetime: number;
  radius: number;
  color: string;
  warningTime?: number;
  maxWarningTime?: number;
  [key: string]: any;
}

