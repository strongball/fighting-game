# Boss 設計文件

## 目錄

1. [核心設計哲學](#1-核心設計哲學)
2. [系統架構總覽](#2-系統架構總覽)
3. [Boss AI 引擎](#3-boss-ai-引擎)
4. [平衡性參數](#4-平衡性參數)
5. [技能系統](#5-技能系統)
6. [階段系統 (Phases)](#6-階段系統-phases)
7. [機制系統 (Mechanics)](#7-機制系統-mechanics)
8. [新增 Boss 完整指南](#8-新增-boss-完整指南)
9. [平衡檢查清單](#9-平衡檢查清單)

---

## 1. 核心設計哲學

### 1.1 預警至上 (Telegraph-First)

Boss 的每個可傷害玩家的動作**必須**有清楚的視覺預警：

- **形狀對應**：近戰扇形、投射物線形、範圍圓形、自身 buff 自體發光
- **危險分色**：黃 (`#ffd166`) low → 橙 (`#ff9a3c`) mid → 紅 (`#ff5050`) high → 紫 (`#c050ff`) lethal
- **脈衝動畫**：充能進度 0→1 時脈衝間隔 0.22s→0.08s 加速，直覺感受「要來了！」

核心源碼：`src/game/bossAI.js:162-451` `telegraph()` 函式

### 1.2 破綻窗口 (Recover Window)

每次攻擊後 Boss 進入脆弱期，這是玩家的**主要輸出時機**：

| 技能類型                              | recoverT   | 說明       |
| ------------------------------------- | ---------- | ---------- |
| 輕技 (basic / dmg<40)                 | 0.3-0.55s  | 小確反     |
| 中技 (dmg≥40 / radius≥120)            | 0.6-0.85s  | 明顯破綻   |
| 重技 (ultimate / dmg≥70 / radius≥180) | 0.9-1.25s  | 大破綻     |
| Chain 連段                            | 0.2-0.25s  | 短破綻銜接 |
| 絕望模式                              | 0.08-0.15s | 幾乎無破綻 |

- recover 期間 Boss 速度降為 62%，玩家傷害 +30%
- 每 2 招強制 pause 1.5-2.5s（讓玩家追擊/喝水/復活隊友）

### 1.3 HP Scaling

玩家人數自動縮放 Boss 血量，確保單人到四人體驗一致：

```js
const hpScale = Math.max(0.35, n / 4); // n = 存活玩家數
// 1 人 → 0.35x, 2 人 → 0.5x, 3 人 → 0.75x, 4 人 → 1.0x
```

源碼：`src/game/bosses/lifecycle.ts:30`

### 1.4 難度曲線

| 區段   | 回合   | 設計目標          | 核心機制                   | 玩家學到           |
| ------ | ------ | ----------------- | -------------------------- | ------------------ |
| 新手期 | R1-R3  | 單一機制入門      | 繞背 / 毒池閃避 / 正面減傷 | 走位、方向判斷     |
| 進階期 | R4-R6  | 召喚物 + 部位破壞 | 分身、部位、小兵盾         | 優先擊殺順序       |
| 高手期 | R7-R10 | 多重機制 + 控場   | 鎖低血、反轉、連結、複製   | 團隊配合、極限閃避 |

---

## 2. 系統架構總覽

### 2.1 三層式架構

```
┌──────────────────────────────────────────────────┐
│                  核心 AI 引擎                      │
│            src/game/bossAI.js                     │
│  狀態機 / 目標選取 / 移動 / 預警系統               │
└──────────────────────┬───────────────────────────┘
                       │
┌──────────────────────┴───────────────────────────┐
│                Boss 專屬設定檔                     │
│          src/game/bosses/<slug>/ai.ts             │
│      範圍、技能優先序、目標策略、風箏距離            │
└──────────────────────┬───────────────────────────┘
                       │
┌──────────────────────┴───────────────────────────┐
│              自訂動作插件系統                       │
│        src/game/bosses/<slug>/action.ts           │
│    registerBossAction(type, handler) 註冊獨特機制   │
└──────────────────────────────────────────────────┘
```

### 2.2 檔案結構

```
src/game/bosses/
├── DESIGN.md                 ← 本文件
├── index.ts                  # 自動聚合所有 boss 資料
├── BaseBoss.ts               # Boss 基底類別
├── actions.ts                # 自訂動作註冊中心
├── lifecycle.ts              # 生成/清除 Boss
├── systems.ts                # 每 tick 系統（部位、連結、復活）
├── phases.ts                 # 階段系統
├── damage.ts                 # 傷害修正（裝甲、盾、弱點）
├── danger.ts                 # 危險等級判定
├── effects.js                # 效果建構器
├── hitbox.ts                 # 碰撞半徑計算
├── render3d.ts               # 3D 視覺輔助
├── golem/                    # R1 巨木傀儡
│   ├── index.ts, ai.ts, model.ts
├── poison-lizard/            # R2 毒液蜥蜴
├── lava-juggernaut/          # R3 熔岩主宰
├── frost-assassin/           # R4 霜雪刺客
│   ├── action.ts             # summon_clones 自訂動作
├── ancient-titan/            # R5 上古泰坦
├── necromancer-conductor/    # R6 死靈指揮家
│   ├── action.ts             # summon_minions
├── storm-wolf/               # R7 風暴狼王
├── void-mage/                # R8 虛空法師
│   ├── action.ts             # apply_scramble, time_rewind
├── fallen-angel/             # R9 墮落天使
│   ├── action.ts             # soul_bind, light_dark
├── doppelganger/             # R10 鏡像魔人
│   ├── action.ts             # mirror_players, steal_ultimate
├── time-devourer/            # R11 時間吞噬巨龍
│   ├── action.ts             # time_anchor_ritual
└── star-forge/               # R12 星爐鑄神
    ├── index.ts, ai.ts, model.ts, vfx.ts
```

### 2.3 回合生命週期

```
startBossRound(n)
    ↓
roundPhase = 'intro'    (3.2s 橫幅: "ROUND N")
    ↓
roundPhase = 'fighting' (AI 啟動、bossTick 執行)
    ↓
Boss 死亡 ──→ 'cleared' (3s) ──→ startBossRound(n+1) 或 'victory'
全滅      ──→ 'wiped'   (等待重打或放棄)
```

源碼：`src/game/bossMode.js`

---

## 3. Boss AI 引擎

### 3.1 狀態機

```
                    ┌──────────────────────────────────┐
                    │                                  │
                    v                                  │
    ┌───────────────┴────────┐     skill ready    ┌────┴─────────┐
    │                         │ ─────────────────> │              │
    │         IDLE            │                    │    WINDUP    │
    │  (走位維持距離 +        │  <──────────────── │ (鎖定瞄準 +  │
    │   掃描就緒技能)          │   windupT <= 0    │  預警蓄力)   │
    └─────────────────────────┘                    └──────┬───────┘
              ^                                           │
              │                                    按下技能 1 tick
              │                                           │
              │                              ┌────────────┴────────┐
              │                              │                     │
              └──────────────────────────────│      RECOVER        │
                 recoverT <= 0               │   (脆弱窗口 + 減速)  │
                 (或 chain 下一段)            └─────────────────────┘
```

源碼：`src/game/bossAI.js:519-723` `computeBossInput()`

### 3.2 各狀態詳解

#### IDLE

- 依 `profile.slots` 優先級掃描技能
- 檢查條件：CD 歸零、部位需求滿足、`once` 未用過、`usable(a, dist)` 距離允許
- 選中後設 `idleDelayT = 1.0 + random * 0.8`（Boss 不會秒放，給玩家反應時間）
- 無技能就緒 → 朝目標移動至 `profile.range` 距離
- 內建 `_loiter` 機制：40% 機率發呆 0.8-2.3s（防 Boss 永追不歇）

#### WINDUP

- 鎖定 `aimAng` 朝目標，最少 1.5s（Boss）/ 0.4s（一般）
- 近戰技能可緩慢逼近，遠程原地
- 每幀呼叫 `telegraph()` 渲染預警
- 計時歸零 → 按下技能 1 tick → 寫入 chain 佇列 → 進入 RECOVER
- 預計算數據：多重 zone 散佈位置、soul bind 配對、stolen ultimate、safe side

#### RECOVER

- 依技能重量設定 `recoverT`
- 有 `chainQueue` 時：`recoverT = chain[0].delay`（0.2-0.25s 短銜接）
- 恢復期間 Boss 可移動但減速（62%），玩家增傷 30%
- 頭頂顯示「破綻」UI
- Chain 執行完畢 → 回到 IDLE（除非 `attackCount ≥ 2` → 強制 PAUSE）

#### PAUSE

- 每 2 招強制停頓 1.5-2.5s
- 只慢走不攻擊，讓玩家喘息
- 防止 Boss 無限連招壓制

### 3.3 目標選取策略

| 策略            | 函式              | 行為             | 使用 Boss       |
| --------------- | ----------------- | ---------------- | --------------- |
| `nearestTarget` | `nearestTarget()` | 攻擊最近敵人     | 預設、多數 Boss |
| `lowestTarget`  | `lowestHp()`      | 攻擊 HP 最低者   | Storm Wolf (R7) |
| `aggroSwap`     | `aggroSwap()`     | 計時器隨機換目標 | Golem (R1)      |

源碼：`src/game/bossAI.js:479-516`

### 3.4 移動邏輯

```js
moveToward(input, ent, tx, ty, stopDist); // 逼近目標至 stopDist
moveAway(input, ent, tx, ty); // 遠離目標
aimAt(ent, tx, ty); // 回傳瞄準角度
```

- 輸出為 8 方向 boolean（與鍵盤輸入相同格式）
- 無技能時維持 `profile.range` 距離
- 若設有 `profile.kite`，距離小於此值時後退

### 3.5 預警系統 (Telegraph)

`telegraph(state, ent, action, dt)` 渲染地面 decal：

| 動作類型                         | telegraph 形狀  | 位置計算             |
| -------------------------------- | --------------- | -------------------- |
| `melee`                          | `arc` (扇形)    | Boss 位置 + range    |
| `projectile`                     | `line` (線形)   | Boss 位置 + 飛行方向 |
| `charge`                         | `line` + 終點圓 | 衝鋒路線 + 著彈點    |
| `leap`                           | `line` + 落點圓 | 跳躍軌跡 + 落地範圍  |
| `zone`                           | `circle` (圓形) | 範圍中心             |
| `buff` / `self`                  | `self` (自身)   | Boss 本體            |
| `light_dark`                     | `line` 半場     | 安全/危險半場        |
| `soul_bind`                      | `circle` 標記   | 被綁玩家位置         |
| `time_rewind` / `mirror_players` | `circle` 全體   | 所有敵人位置         |

源碼：`src/game/bossAI.js:162-451`

### 3.6 假身 AI (Fake)

```js
// 隨機方向遊走，每 0.8-1.6s 換向，邊界回彈
// 不施放技能，純視覺干擾
```

源碼：`src/game/bossAI.js:726-739`

### 3.7 共用設定檔

```js
const PROFILES = {
  minion: {
    range: 60,
    slots: ["skill1", "skill2", "basic"],
    pickTarget: "nearestTarget",
  },
  mirror: {
    range: 80,
    slots: ["ultimate", "skill1", "skill2", "basic"],
    pickTarget: "nearestTarget",
  },
};
```

---

## 4. 平衡性參數

### 4.1 Boss 移動速度

| 參數                      | 值       | 說明                          |
| ------------------------- | -------- | ----------------------------- |
| `BOSS_BASE_SPEED_MULT`    | 0.65     | Boss 基礎比玩家慢 35%         |
| `BOSS_RECOVER_SPEED_MULT` | 0.62     | 破綻期再降速                  |
| `BOSS_ACCEL`              | 6        | 加速度（玩家 14，近戰 1.12x） |
| `phase.speedMult`         | 1.1-1.25 | 後期階段加速                  |

平衡原則：

- Boss 速度略低於玩家 → 確保玩家能靠走位拉開距離
- 破綻期大幅減速 → 玩家可確實反擊
- 加速度差異 → 玩家轉向更靈敏，Boss 較笨重

### 4.2 技能冷卻

```js
// 最終 CD 公式：
actualCD = skill.cd * COOLDOWN_MULTIPLIER * phaseCdMult;
// COOLDOWN_MULTIPLIER = 0.7（全域加速）
// phaseCdMult 隨階段遞減（0.85 → 0.65）
```

Boss `maxMana` 設為 999（魔力無限），僅受 CD 限制。

### 4.3 Windup 時間

```js
// Boss 最少 windup 保證：
rawWindup = Math.max(ent.desperation ? 0.4 : 1.5, a.windup || 0.5);
// 絕望模式（鎖血大招狀態）縮短至 0.4s
// 正常最少 1.5s — 確保玩家有足夠時間反應
```

### 4.4 Damage Modifiers

源碼：`src/game/bosses/damage.ts`

```js
// 方向裝甲
if (mech.frontArmor && 正面攻擊) dmg *= 1 - mech.frontArmor; // 正面減傷
if (mech.backWeak && 背後攻擊) dmg *= 1 + mech.backWeak; // 背後增傷

// 小兵護盾
if (mech.minionShield && minionsAlive > 0)
  dmg *= 1 - Math.min(max, perMinion * alive); // 每隻小兵給 18% 減傷

// 核心護甲（部位破壞前）
if (mech.coreArmorUntilPartsDown && anyPartAlive)
  dmg *= 1 - mech.coreArmorUntilPartsDown; // 60% 減傷
```

### 4.5 速度/加速度調整指引

```js
// 若需調整請改 movement.ts：
BOSS_BASE_SPEED_MULT  → 全域 Boss 速度基數
BOSS_ACCEL            → 全域 Boss 轉向靈敏度
BOSS_RECOVER_SPEED_MULT → 破綻窗口速度
// 個別 Boss 速度在 index.ts 的 speed 欄位設定
```

---

## 5. 技能系統

### 5.1 技能類型總表

| `type`       | 說明                 | 碰撞判定             | 適用場景             |
| ------------ | -------------------- | -------------------- | -------------------- |
| `melee`      | 近戰扇形揮擊         | 扇形角度 + range     | 基本攻擊、連段起手   |
| `projectile` | 發射飛行物           | 投射物碰撞箱         | 遠程騷擾、彈幕       |
| `zone`       | 地面範圍效果         | 範圍圓形持續 tick    | 控場、持續傷害、領域 |
| `charge`     | 直線衝鋒             | 衝鋒路徑 + hitRadius | 追擊、穿越、撞牆自暈 |
| `leap`       | 跳躍至目標點         | 起跳點 + 落地圓      | 位移 + 範圍攻擊      |
| `blink`      | 瞬間移動             | 終點範圍圓           | 繞後、閃避           |
| `buff`       | 自身增益             | 無（自身狀態）       | 狂暴、護盾、加速     |
| `multiblink` | 多重瞬移斬           | 每個終點範圍圓       | 全場亂舞             |
| `summon_*`   | 召喚類（自訂）       | 自訂 handler         | 分身、小兵           |
| 其他自訂     | `registerBossAction` | 自訂 handler         | 獨特機制             |

### 5.2 技能欄位完整參考

```ts
{
  // === 必填 ===
  name: '技能名稱',          // UI 顯示
  type: 'melee',             // 技能類型
  dmg: 45,                   // 基礎傷害
  cd: 8,                     // 冷卻時間（秒）
  windup: 0.8,               // 蓄力/預警時間（秒）
  color: '#ff5050',          // 預警顏色
  telegraph: 'arc',          // 預警形狀: 'arc' | 'line' | 'circle' | 'self'

  // === 位置參數（依 type 需求填） ===
  range: 170,                // 技能有效距離
  radius: 130,               // 範圍半徑
  arc: 1.5,                  // 扇形弧度

  // === 效果參數 ===
  knockback: 240,            // 擊退力道
  effect: STUN(0.5),         // 狀態效果（BURN/STUN/SLOW/ROOT/CHILL）
  dmgPct: 0.025,             // 最大生命 % 傷害

  // === Zone 專屬 ===
  lifetime: 0.4,             // 持續時間
  tick: 0.5,                 // Dot 間隔
  delay: 1.0,                // 延遲生效
  follow: true,              // 跟隨施法者
  pull: 200,                 // 牽引力
  moving: 120,               // 移動速度
  swapHit: true,             // 命中交換位置

  // === 投射物專屬 ===
  speed: 320,                // 飛行速度
  count: 3,                  // 投射物數量
  spread: 0.3,               // 散射角度
  scatter: 120,              // 散佈半徑

  // === 連段系統 ===
  chain: [{ slot: 'skill1', windup: 0.5, delay: 0.25 }],

  // === 限制條件 ===
  once: true,                // 僅能使用一次
  requiresPart: 'arm_left',  // 需部位存活
  requiresPartsDown: true,   // 需所有部位已破壞

  // === 危險等級強制覆蓋 ===
  dangerLevel: 'lethal',     // 強制覆蓋自動判定

  // === VFX ===
  vfx: 'boss_golem_sweep',  // 特效名稱
}
```

### 5.3 Chain 連段系統

Chain 允許 Boss 將多個技能組成連招：

```js
basic: {
  dmg: 45, range: 170, cd: 2.2, windup: 0.8,
  chain: [{ slot: 'skill1', windup: 0.5, delay: 0.25 }]
  // basic 打完 → 0.25s 短 recover → 自動接 skill1
}
```

- Chain 中的技能**無視 CD 和魔力檢查**
- 每段 `delay` 設定短 recover（通常 0.2-0.25s）
- 最長建議不超過 3-4 段，避免玩家無反擊機會
- 大招 chain 範例（Golem 三連旋掃）：
  ```js
  chain: [
    { slot: "ultimate", windup: 0.2, delay: 1.2 },
    { slot: "ultimate", windup: 0.2, delay: 1.2 },
  ];
  ```

### 5.4 Usable 距離門檻

```js
switch (a.type) {
  case "melee":
    return d <= range + 60;
  case "charge":
    return d >= 90 && d <= range + 40;
  case "leap":
    return d >= 60 && d <= range + 40;
  case "blink":
    return d <= range + 80;
  case "projectile":
    return d <= (range || speed * lifetime || 760);
  case "zone":
    return range === 0 ? true : d <= range + radius + 40;
  default:
    return true; // buff/召喚/自訂 → 隨時可用
}
```

源碼：`src/game/bossAI.js:455-469`

---

## 6. 階段系統 (Phases)

### 6.1 階段定義

```ts
phases: [
  {
    hpPct: 0.66, // HP < 66% 時觸發
    name: "狂亂之根", // 階段名稱（橫幅顯示）
    sub: "怒火覺醒", // 副標題
    color: "#ff7a3d", // 橫幅顏色
    dmgMult: 1.2, // 傷害倍率 ×1.2
    speedMult: 1.15, // 速度倍率 ×1.15
    cdMult: 0.85, // CD 倍率 ×0.85（數值越小出招越快）
    tagsOverride: [
      // （選用）UI 提示標籤
      { icon: "⚡", text: "攻擊強化 +20%" },
    ],
    onEnter: (state, boss) => {
      // （選用）觸發腳本
      // boss 短暫無敵 1s、橫幅動畫自動處理
      // 可在此召喚小兵、燃燒全場、反轉控制等
    },
  },
];
```

### 6.2 階段效果

| 觸發效果             | 說明                                   |
| -------------------- | -------------------------------------- |
| 傷害倍率 `dmgMult`   | Boss 造成的傷害 × 倍率（1.2 = +20%）   |
| 速度倍率 `speedMult` | Boss 移動速度 × 倍率                   |
| CD 倍率 `cdMult`     | 技能冷卻 × 倍率（0.85 = 冷卻縮短 15%） |
| Tags 覆蓋            | 更新 UI 提示                           |
| `onEnter` 腳本       | 執行自訂邏輯                           |
| 無敵時間             | 觸發時 Boss 1 秒無敵（防止被打斷）     |
| 橫幅動畫             | 全畫面階段名 + 衝擊波 + 震動           |

源碼：`src/game/bosses/phases.ts`

### 6.3 設計指引

- **R1-R5**：建議 2 階段（66%、33%）
- **R6-R9**：建議 1-2 階段
- **R10**：建議 3 階段
- 最後階段 `cdMult` 建議 ≤ 0.7（出招極快），製造壓迫感
- `onEnter` 不應秒殺玩家，應是「節奏改變」的信號

---

## 7. 機制系統 (Mechanics)

### 7.1 可用機制一覽

```ts
mechanic: {
  // === 方向裝甲 ===
  frontArmor: 0.45,             // 正面減傷 45%
  backWeak: 0.5,                // 背後增傷 50%

  // === 可破壞部位 ===
  parts: [
    { id: 'arm_left',  baseHp: 1500, offset: { x: -60, y: 0 } },
    { id: 'arm_right', baseHp: 1500, offset: { x: 60, y: 0 } },
  ],
  coreArmorUntilPartsDown: 0.6, // 部位存活時核心減傷 60%

  // === 召喚物護盾 ===
  minionShield: { perMinion: 0.18, max: 0.72 },
  // 每隻存活小兵給 18% 減傷，最高疊 72%

  // === 仇恨系統 ===
  aggroSwap: 3.0,               // 每 3 秒隨機換目標

  // === 分身 ===
  clones: 3,                    // 分身數量
  swapTell: true,               // 交換時有視覺提示

  // === 狂暴 ===
  targetLowest: true,           // 鎖定最低血量
  enrageBelow: 0.4,             // HP < 40% 進入狂暴
  enrageHaste: 1.4,             // 狂暴攻速 1.4x
}
```

### 7.2 傷害修正流程

```
原始傷害
    ↓
applyBossDamageModifiers()
    ├── 方向判定（frontArmor / backWeak）
    ├── 小兵護盾（minionShield）
    └── 核心護甲（coreArmorUntilPartsDown）
    ↓
最終傷害（套用到 Boss HP）
```

源碼：`src/game/bosses/damage.ts`

---

## 8. 新增 Boss 完整指南

### 8.1 前置步驟

```bash
# 建立 Boss 資料夾
mkdir src/game/bosses/<slug>

# 所需檔案：
# src/game/bosses/<slug>/
# ├── index.ts       # Boss 資料（必備）
# ├── ai.ts          # AI 設定檔（必備）
# ├── action.ts      # 自訂動作（選用）
# ├── model.ts       # 3D 模型設定（選用）
# └── model.glb      # 模型檔案（選用）
```

### 8.2 步驟 1：決定 Boss 識別資料

| 欄位       | 慣例                   | 說明                         |
| ---------- | ---------------------- | ---------------------------- |
| `id`       | 111+（依序遞增）       | 唯一識別碼，>= 100 視為 Boss |
| `round`    | 12+（依序遞增）        | 關卡數，決定出場順序         |
| `name`     | 中文名稱               | UI 顯示名稱                  |
| `subtitle` | 四字稱號               | 副標題                       |
| `color`    | Hex 主色               | UI/預警顏色                  |
| `maxHp`    | 4000-8000              | 基礎血量（自動 scaling）     |
| `speed`    | 100-250                | 基礎移動速度                 |
| `shape`    | square/triangle/circle | 小地圖形狀                   |

### 8.3 步驟 2：設計 AI Profile

建立 `src/game/bosses/<slug>/ai.ts`：

```ts
export const aiProfile = {
  range: 100, // 理想交戰距離（px）
  slots: ["ultimate", "skill1", "skill2", "basic"],
  // 技能施放優先順序
  pickTarget: "nearestTarget", // 目標策略
  // 選用：
  // kite: 200,                        // 風箏觸發距離
  // slow: true,                       // Boss 動作遲緩
} as const;
```

**技能順序設計原則**：

- 大招放最前：CD 好就放，高壓迫
- 大招放中間：穿插在普通技能之間
- 大招放最後：當作終結技

### 8.4 步驟 3：設計 4 個技能槽

建立 `src/game/bosses/<slug>/index.ts`：

```ts
import { BaseBoss } from "../BaseBoss.ts";
import { STUN, SLOW } from "../effects.js";
import { aiProfile } from "./ai.ts";
import { modelConfig, buildModel, buildWeapon } from "./model.ts";
// import './action.ts';  // 若有自訂動作

const data = {
  id: 110,
  round: 11,
  name: "Boss 名稱",
  subtitle: "四字稱號",
  color: "#ff5050",
  shape: "square",
  maxHp: 5000,
  maxMana: 999,
  speed: 150,
  baseHp: 5000,

  ai: "boss_slug",

  // 機制（選用）
  mechanic: {
    // ...
  },

  // 階段（選用）
  phases: [
    // ...
  ],

  // 四個技能槽
  basic: {
    name: "普攻名稱",
    type: "melee",
    dmg: 35,
    range: 130,
    arc: 1.2,
    knockback: 150,
    cd: 1.5,
    windup: 0.4,
    telegraph: "arc",
    color: "#ff8888",
    effect: SLOW(1.5, 0.6),
    // chain: [{ slot: 'skill1', windup: 0.3, delay: 0.25 }],
  },

  skill1: {
    name: "技能一",
    type: "projectile", // 或 zone / charge / leap / blink
    dmg: 50,
    range: 400,
    radius: 60,
    speed: 320,
    cd: 6,
    windup: 0.6,
    telegraph: "line",
    color: "#ff6666",
    knockback: 200,
    count: 3,
    spread: 0.3,
  },

  skill2: {
    name: "技能二",
    type: "zone",
    dmg: 30,
    range: 0, // 0 = 自身為中心
    radius: 180,
    lifetime: 3.0,
    tick: 0.5,
    effect: STUN(0.8),
    cd: 10,
    windup: 0.8,
    telegraph: "circle",
    color: "#ff4444",
  },

  ultimate: {
    name: "大絕招名稱",
    type: "zone",
    dmg: 80,
    range: 0,
    radius: 280,
    lifetime: 1.2,
    tick: 0.3,
    knockback: 500,
    effect: STUN(1.0),
    cd: 20,
    windup: 1.5,
    telegraph: "circle",
    color: "#c050ff",
    // 大絕招 chain 由 BaseBoss 建構子自動產生
  },

  // 外觀描述（給美術/企劃參考）
  appearance: {
    size: "描述體型",
    style: "描述視覺風格與配色",
    weapon: "描述武器",
    telegraph: "描述預警特效",
  },

  // 玩家提示
  hint: "攻略提示文字",
  tags: [
    { icon: "🔥", text: "標籤一" },
    { icon: "🛡️", text: "標籤二" },
  ],

  // 場景主題
  theme: {
    sky: 0x1a1a2a,
    fog: 0x2a2a3a,
    fogNear: 800,
    fogFar: 2400,
    floor: 0x3a3a4a,
    ring: 0x4a4a5a,
    wallStone: 0x3a3a4a,
    wallTrim: 0x6a6a8a,
    hemiSky: 0xffeedd,
    hemiGround: 0x222244,
    hemiInt: 0.5,
    sunColor: 0xffeedd,
    sunInt: 1.5,
    rimColor: 0xff8844,
    rimInt: 0.3,
    decorations: ["crystal", "rock"],
    crystal: { count: 20, color: 0x8888ff, glow: 0x4444ff, glowInt: 0.6 },
    rock: { count: 10, color: 0x556677 },
    atmosphere: { kind: "embers", rate: 20 },
    floorDecal: { kind: "rune", color: "#ff4444", opacity: 0.3, glow: 0.2 },
  },
};

export default new BaseBoss(data, {
  aiProfile,
  modelConfig,
  buildModel,
  buildWeapon,
});
```

### 8.5 步驟 4：設計自訂 Action（選用）

當標準技能類型（melee/projectile/zone）無法滿足需求時，使用自訂 Action：

建立 `src/game/bosses/<slug>/action.ts`：

```ts
import { registerBossAction } from "../actions.ts";

registerBossAction("my_custom_ability", (state, boss, action, h) => {
  // h 提供的 helpers：
  //   h.ARENA            - 競技場邊界
  //   h.PLAYER_RADIUS    - 玩家碰撞半徑
  //   h.BOSS_TEAM        - Boss 隊伍編號 (2)
  //   h.clamp            - 數值夾緊函式
  //   h.dist             - 兩點距離
  //   h.makeBoss         - 建立 Boss / 召喚物實體
  //   h.addFx            - 增加視覺特效
  //   h.isEnemy          - 判斷敵對關係
  //   h.applyEffect      - 施加狀態效果
  //   h.dealDamage       - 造成傷害
  //   h.getCharacter     - 取得角色設定
  //   h.executeAction    - 執行另一個動作（遞迴）
  // 實作自訂邏輯...
});
```

然後在 `index.ts` 引入：

```ts
import "./action.ts";
```

**注意**：`action.ts` 的 import 順序很重要，必須在 `new BaseBoss(data)` 之前被執行，確保 action 已註冊。透過在 `index.ts` 頂層 `import './action.ts'` 即可。

### 8.6 步驟 5：設定階段

```ts
phases: [
  {
    hpPct: 0.66,
    name: '第一階段名稱',
    sub: '副標題',
    color: '#ff7a3d',
    dmgMult: 1.2,
    speedMult: 1.15,
    cdMult: 0.85,
    onEnter: (state, boss) => {
      // 階段轉換自訂腳本
    },
  },
  {
    hpPct: 0.33,
    name: '第二階段名稱',
    sub: '副標題',
    color: '#ff3030',
    dmgMult: 1.5,
    speedMult: 1.3,
    cdMult: 0.65,
    onEnter: (state, boss) => {
      // 最終階段腳本
    },
  },
],
```

### 8.7 步驟 6：註冊大絕招 Chain

`BaseBoss` 建構子會自動為每個 Boss 的大絕招加上 chain：

```ts
// src/game/bosses/BaseBoss.ts
if (this.ultimate) {
  u.chain = [
    { slot: "skill1", windup: 0.3, delay: 1.0 },
    { slot: "skill2", windup: 0.3, delay: 1.2 },
    { slot: "ultimate", windup: 0.3, delay: 1.0 },
  ];
}
```

若不需要此行為，可在 `index.ts` 中手動覆蓋 `ultimate.chain`。

### 8.8 步驟 7：自動註冊

Boss 一旦放在 `src/game/bosses/<slug>/` 資料夾下，

`src/game/bosses/index.ts` 會透過 Vite 的 `import.meta.glob` 自動掃描並註冊：

```ts
const modules = import.meta.glob("./*/index.ts", { eager: true });
// 自動按 round 排序
export const BOSSES = Object.values(modules)
  .map((mod) => mod.default)
  .filter(Boolean)
  .sort((a, b) => a.round - b.round);
```

無需手動修改任何聚合檔案。

### 8.9 完整範例：霜雪刺客

**ai.ts**：

```ts
export const aiProfile = {
  range: 90,
  slots: ["ultimate", "skill2", "skill1", "basic"],
  pickTarget: "nearestTarget",
};
```

**index.ts**（技能摘要）：

```ts
basic:    { type: 'melee',      dmg: 34, range: 100, cd: 1.0, windup: 0.25, telegraph: 'arc',    effect: CHILL(1) }
skill1:   { type: 'blink',      dmg: 55, range: 320, cd: 7,  windup: 0.4,  telegraph: 'self',   effect: CHILL(2) }
skill2:   { type: 'summon_clones',                cd: 15, windup: 0.6,  telegraph: 'self' }
ultimate: { type: 'zone',       dmg: 30, range: 0, radius: 220, follow: true, cd: 19, windup: 1.0, effect: CHILL(2) }
```

**action.ts**（自訂動作）：

```ts
registerBossAction("summon_clones", (state, boss, a, h) => {
  // 生成 3 個分身
  // 60% 機率與其中一個交換位置
});
```

### 8.10 技能設計指引

| 技能槽     | CD 範圍  | windup 範圍 | dmg 範圍 | 設計目標               |
| ---------- | -------- | ----------- | -------- | ---------------------- |
| `basic`    | 1.0-2.5s | 0.25-0.5s   | 30-50    | 低威脅、頻繁、可閃避   |
| `skill1`   | 5-9s     | 0.5-0.8s    | 45-70    | 主力傷害、明顯預警     |
| `skill2`   | 10-15s   | 0.6-1.0s    | 30-60    | 特殊機制、控場         |
| `ultimate` | 18-25s   | 1.0-1.5s    | 60-100   | 大範圍、高傷害、長預警 |

---

## 9. 平衡檢查清單

### 9.1 基礎檢查

- [ ] Boss 的 `windup` ≥ 1.5s（非絕望模式）
- [ ] 每次攻擊後皆有 `recover` 窗口
- [ ] `recover` 期間玩家可以確實反擊（範圍內可走到）
- [ ] 技能 `chain` 不超過 3 段
- [ ] 每 2 招至少一次 `pause` 喘息（1.5-2.5s）
- [ ] 大絕招顏色為 `high` 紅色或 `lethal` 紫色（不可為黃色）
- [ ] 階段轉換提供 1s Boss 無敵保護
- [ ] `hpScale` 依玩家人數正確縮放

### 9.2 技能檢查

- [ ] 所有 `type` 都有對應的 `telegraph` 視覺表現
- [ ] `usable()` 距離門檻合理（近戰不可太遠觸發）
- [ ] Chain 連段的 `delay` 不短於 0.2s
- [ ] Zone 技能有適當的 `lifetime` + `tick` 間隔
- [ ] 投射物 `speed` + `lifetime` = 有效射程

### 9.3 數值檢查

- [ ] Boss `speed` 對比玩家基準速度（~300）合理
- [ ] `dmg` 不應一擊秒殺滿血玩家（除非是機制殺）
- [ ] 階段 `dmgMult` 累積不超過 1.5x
- [ ] 階段 `cdMult` 不低於 0.6（避免零 CD 連發）
- [ ] `BOSS_BASE_SPEED_MULT` 維持 0.65（全域）
- [ ] `BOSS_ACCEL` 維持 6（全域）

### 9.4 程式碼檢查

- [ ] `ai.ts` 的 `slots` 陣列中的值與 `index.ts` 技能鍵名一致
- [ ] 自訂 `action.ts` 有完整錯誤處理（try-catch 或防呆）
- [ ] 自訂 `action.ts` 在 `index.ts` 中有 `import`
- [ ] 不需手動修改 `index.ts` 聚合（auto-glob）
- [ ] `mechanic` 中的 key 與 `damage.ts`/`bossAI.js` 中的判斷一致

### 9.5 可玩性檢查

- [ ] 玩家能在首次遭遇時觀察並理解機制
- [ ] 至少有一種策略可以「無傷」通過
- [ ] Boss 不會無限追逐（有 loiter 機制）
- [ ] 多人模式下有團隊分工空間（一人引仇恨、一人輸出）
- [ ] 提示文字 `hint` 精準提示攻略方向
- [ ] `tags` 圖示 + 文字一目了然

---

> 文件維護者：開發團隊
> 最後更新：2026-06-22
> 對應源碼分支：main
