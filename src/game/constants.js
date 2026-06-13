// 全域常數與設定

export const ARENA = { width: 1200, height: 800 };

export const TICK_RATE = 30;          // 房主權威模擬頻率 (Hz)
export const DT = 1 / TICK_RATE;      // 固定時間步
export const SNAPSHOT_INTERVAL = 1 / 20; // 房主廣播狀態頻率 (Hz)
export const INPUT_INTERVAL = 1 / 30; // 加入者送出輸入頻率 (Hz)

export const MAX_PLAYERS = 8;

export const PLAYER_RADIUS = 18;
export const MANA_REGEN = 2;          // 每秒回魔
export const KNOCKBACK_FRICTION = 7;  // 擊退衰減 (越大停得越快)

// ---- 終極能量槽 (大絕招) ----
export const ULT_MAX = 100;           // 滿槽即可施放
export const ULT_REGEN = 5;         // 每秒被動充能 (約 45 秒滿)
export const ULT_GAIN_DEAL = 0.35;    // 造成傷害的充能係數 (× 傷害)
export const ULT_GAIN_TAKE = 0.6;     // 承受傷害的充能係數 (逆境快充)
export const ULT_LOCKOUT = 1;         // 施放後的防連發冷卻 (秒)

// ---- 全局技能冷卻乘數 ----
export const COOLDOWN_MULTIPLIER = 0.8; // 技能冷卻時間乘數 (< 1 = 冷卻減少 / > 1 = 冷卻增加)
                                        // 例：0.5 = 所有技能冷卻時間減半、1.5 = 冷卻時間延長 50%

// 渲染：稍微傾斜的俯視
export const TILT = 0.62;             // 深度方向(y)的壓縮比
export const BODY_HEIGHT = 32;        // 直立身體繪製高度
export const PROJECTILE_HEIGHT = 22;  // 投射物飛行高度

// 內部畫布解析度 (以 CSS 縮放至視窗)
export const CANVAS_W = 1280;
export const CANVAS_H = 760;
export const FLOOR_TOP = 120;         // 競技場地板上緣在畫布上的 y
export const FLOOR_LEFT = (CANVAS_W - ARENA.width) / 2;

// ---- 渲染特效可調參數 (僅 renderer 使用) ----
export const PARTICLE_MAX = 900;      // 本地粒子上限 (不進 snapshot)
export const SHAKE_DECAY = 9;         // 畫面震動衰減 (越大停得越快)
export const SHAKE_MAX = 26;          // 震動最大位移 (px)
export const FLASH_DECAY = 6;         // 全畫面閃光衰減
export const BOB_AMP = 5.5;           // 走路上下彈跳幅度 (px)
export const BOB_FREQ = 11;           // 走路彈跳頻率
export const WALK_THRESHOLD = 12;     // 視為移動的速度門檻 (px/s)
