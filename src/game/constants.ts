// 全域常數與設定（型別化）。
//
// 分兩大類：GAMEPLAY（影響模擬/決定性，host 與 joiner 必須一致）與
// RENDER（僅 renderer 使用，可自由調整不影響連線）。
// 為相容既有 `import ... from './constants.js'`，同名 constants.js 仍作為 barrel 轉出此檔。

// ============================================================
// GAMEPLAY — 影響權威模擬，改動會改變手感/平衡
// ============================================================

/** 競技場邊界（世界座標，像素）。 */
export const ARENA = { width: 2400, height: 1600 };

export const TICK_RATE = 30;             // 房主權威模擬頻率 (Hz)
export const DT = 1 / TICK_RATE;         // 固定時間步
export const SNAPSHOT_INTERVAL = 1 / 30; // 房主廣播狀態頻率 (Hz)
export const INPUT_INTERVAL = 1 / 30;    // 加入者送出輸入頻率 (Hz)

export const MAX_PLAYERS = 8;

export const PLAYER_RADIUS = 18;         // 標準玩家碰撞/命中半徑
export const MANA_REGEN = 3;             // 每秒回魔 (大範圍/多重技能仍會枯竭)
export const KNOCKBACK_FRICTION = 7;     // 擊退衰減 (越大停得越快)

// ---- 終極能量槽 (大絕招) ----
// 設計目標：一場勢均力敵的戰鬥約能施放「一次」大招。靠三槓桿控制稀有度：
//   (1) 慢速被動充能 (2) 低戰鬥充能係數 (3) 各大招自帶長 cd (characters.js)。
// 大招本身大範圍者傷害壓低、單體者傷害高，避免一鍵清場。
export const ULT_MAX = 100;              // 滿槽即可施放
export const ULT_REGEN = 8;              // 每秒被動充能 (純發呆約 100 秒滿)
export const ULT_GAIN_DEAL = 0.02;       // 造成傷害的充能係數 (× 傷害)
export const ULT_GAIN_TAKE = 0.04;       // 承受傷害的充能係數 (逆境略快，給翻盤機會)
export const ULT_LOCKOUT = 8;            // 施放後的防連發冷卻 (秒)；各大招另以 ult.cd 覆蓋

// ---- 怒氣 (Fury) — 坦克專屬資源 ----
// 僅「鋼鐵壁壘」天賦 (bulwark) 使用：承受/造成傷害累積，脫戰衰減。怒氣越高＝受傷越少、反擊越痛、
// 戰意沸騰加速貼身。非坦克角色 fury 恆為 0（HUD 亦只在 bulwark 顯示怒氣條）。
export const FURY_MAX = 100;

// ---- Boss 基礎攻擊頻率參數 (影響 AI 出招節奏) ----
// 所有魔王共用同一組基礎頻率設定，修改此處即可調整整體戰鬥節奏。
export const BOSS_PACING = {
  /** 最小蓄力時間（非暴走），技能設定的 windup 若低於此值會強制提升到此值 (秒) */
  minWindup: 0.4,
  /** 最小蓄力時間（暴走模式） */
  minWindupDesperation: 0.15,

  /** 選定技能後到開始蓄力前的延遲基底 (秒) */
  idleDelayBase: 0.6,
  /** 選定技能後到開始蓄力前的隨機增量 (秒) */
  idleDelayRandom: 0.4,

  /** 連段間預設延遲 (chain.delay 未指定時使用) (秒) */
  chainDelayFallback: 0.25,

  /** 暴走模式的 recover 基底 (秒) */
  desperationRecoverBase: 0.08,
  /** 暴走模式的 recover 隨機增量 (秒) */
  desperationRecoverRandom: 0.07,

  /** 一般 recover — 重招 (大招 / dmg≥70 / radius≥180) */
  recoverHeavyBase: 0.5,
  recoverHeavyRandom: 0.2,
  /** 一般 recover — 中招 (dmg≥40 / radius≥120) */
  recoverMedBase: 0.3,
  recoverMedRandom: 0.15,
  /** 一般 recover — 輕招 */
  recoverLightBase: 0.15,
  recoverLightRandom: 0.15,

  /** 連續攻擊幾次後強制進入 pause (休息) */
  attacksBeforePause: 2,
  /** pause 持續時間基底 (秒) */
  pauseBase: 1.2,
  /** pause 隨機增量 (秒) */
  pauseRandom: 1.0,

  /** 無技能可用時原地發呆的機率 */
  loiterChance: 0.25,
  /** 發呆持續時間基底 (秒) */
  loiterBase: 0.5,
  /** 發呆隨機增量 (秒) */
  loiterRandom: 0.6,
};

// ---- 難易度參數 (0~1, 0=簡單 0.5=普通 1=困難) ----
// 由 state.flags.difficulty 讀取，執行時期經由此函式推導各項倍率。
export function difficultyMult(d: number) {
  return {
    /** 魔王造成傷害倍率 */
    bossDmg: 0.65 + d * 0.7,
    /** 魔王行動頻率倍率 (影響 AI 計時器流速，越高越慢=越簡單) */
    bossCd: 1.15 - d * 0.4,
    /** 玩家冷卻速率倍率 (越高冷卻越慢=越困難) */
    playerCd: 0.8 + d * 0.4,
    /** 魔王 HP 倍率 */
    bossHp: 0.6 + d * 0.8,
    /** 魔王移動速度倍率 */
    bossSpeed: 0.85 + d * 0.3,
    /** 召喚物(分身/小怪)數量倍率 */
    minionCount: 0.7 + d * 0.6,
  };
}

// ---- 全局技能冷卻乘數 ----
export const COOLDOWN_MULTIPLIER = 0.7;  // 技能冷卻時間乘數 (< 1 = 冷卻減少 / > 1 = 冷卻增加)
                                         // 1.0 = 採用 characters.js 中的誠實冷卻值 (平衡基準)
                                         // 例：0.5 = 所有技能冷卻時間減半、1.5 = 冷卻時間延長 50%

// ============================================================
// RENDER — 僅 renderer 使用，調整不影響模擬/連線
// ============================================================

// 稍微傾斜的俯視投影
export const TILT = 0.62;                // 深度方向(y)的壓縮比
export const BODY_HEIGHT = 32;           // 直立身體繪製高度
export const PROJECTILE_HEIGHT = 22;     // 投射物飛行高度

// 內部畫布解析度 (以 CSS 縮放至視窗)
export const CANVAS_W = 1280;
export const CANVAS_H = 760;
export const FLOOR_TOP = 120;            // 競技場地板上緣在畫布上的 y
export const FLOOR_LEFT = (CANVAS_W - ARENA.width) / 2;

// 渲染特效可調參數 (本地，不進 snapshot)
export const PARTICLE_MAX = 900;         // 本地粒子上限
export const SHAKE_DECAY = 9;            // 畫面震動衰減 (越大停得越快)
export const SHAKE_MAX = 26;             // 震動最大位移 (px)
export const FLASH_DECAY = 6;            // 全畫面閃光衰減
export const BOB_AMP = 5.5;              // 走路上下彈跳幅度 (px)
export const BOB_FREQ = 11;              // 走路彈跳頻率
export const WALK_THRESHOLD = 12;        // 視為移動的速度門檻 (px/s)
