# 架構優化規劃（Architecture Refactor Plan）

> 對象：本專案的人類／AI 共同維護者。
> 目的：在**不改變遊戲行為**的前提下，關閉幾個「橫切關注點」的衝突熱點，讓「新增一個角色／效果／天賦」真正做到 **加一個檔案、零中央編輯**。
> 狀態：**四項皆已實作落地**（2026-06，branch `refactor/architecture-extensibility`）。
> commits：`2162bc8` 基線 → `f03e25b` ① → `4ca42dd` ④ → `a02d17c` ③ → `294b582` ②。
> 每一步均 `yarn build` 綠 + `yarn test:run` 全過，determinism 黃金快照逐位元不變（除基線那次刻意刷新）。

---

## 0. TL;DR

這專案的**垂直擴充**已經很成熟（角色／魔王／action／effect／VFX 都是 glob 或 `registerXxx` registry，加檔即註冊）。真正的痛點是少數**橫切關注點**沒有 registry 化，於是它們變成所有人都要回去編輯的中央檔案，造成 merge 衝突與靜默 bug。

本計畫處理四項（依「價值／風險比」排序，但實作有相依，見 §4）：

| # | 重構 | 解決的痛點 | 風險 | 影響行為？ | 狀態 |
|---|---|---|---|---|---|
| ① | 網路序列化 manifest | `controller.ts` 手抄欄位 → 衝突＋desync | 低 | 否 | ✅ `f03e25b` |
| ④ | `charId` 穩定 slug + `evade` data-driven | 硬編數字 id / `DEFAULT_BLINK_IDS` | 低 | 否 | ✅ `4ca42dd` |
| ② | 天賦 hook registry（傷害管線） | 天賦邏輯內聯散在 5 個檔 | **中高（hot-path）** | 否（測試守護） | ✅ `294b582` |
| ③ | 拆解 `controller.ts` | 839 行上帝檔（churn 第一名） | 中 | 否 | ✅ `a02d17c`（→594 行） |

> **④ 範圍變更（實作時依維護者決定擴大）**：原規劃僅把 `evade` data-driven 化、保留數字 `charId`；
> 實作時改為**玩家 `charId` 全面改用穩定字串 slug**（= 資料夾名），徹底消滅「兩人加角色搶同一數字」的衝突。
> 魔王（≥100）/召喚物（<0）沿用數字 id-space。原斷言「連續 0..18」的 registry 測試已改為「slug 唯一 + evadeType 必填」。
>
> **② 範圍**：本次只搬「傷害管線」hook（`damage.ts`，churn 熱點）。aura/跨實體/其他檔 call-site 的天賦
> 邏輯（warsong、plague、playerState/combat/effects/casting 的部分）仍內聯，已於程式碼導覽註解標示為後續增量。

**驗證鐵則（每一步、每一項都適用）**：`yarn build` 綠燈 **且** `yarn test:run` 的 determinism 黃金快照不變。快照不變 = 行為未變。詳見 §5。

---

## 1. 設計目標與原則

1. **加檔即擴充**：新增一個角色／效果／天賦／同步欄位，理想上只動「自己的檔案」，不碰共用中央清單。
2. **單一事實來源（SSOT）**：同一個概念（例如「哪些欄位要過網路」「某天賦怎麼算」）只描述一次，不要在多個檔案手抄。
3. **行為等價優先**：本計畫是**重構**，不是改平衡。每一步都用 determinism 黃金快照鎖住行為。
4. **沿用既有慣例**：本專案已有兩種 registry 慣例——glob 自動發現（characters/bosses/handlers）與顯式 `registerXxx()`（boss action/VFX）。新抽象**沿用**這兩種，不發明第三種。
5. **保留逃生口**：引擎大量使用動態欄位與 `[key: string]: any`，重構不強推嚴格型別，維持漸進式遷移風格。

---

## 2. 現況盤點

### 2.1 已經做得好的（不要動）

| 子系統 | 註冊機制 | 新增方式 | 位置 |
|---|---|---|---|
| 角色 | `import.meta.glob` | 加一個 `classes/<slug>/` 資料夾 | `characters/index.ts` |
| 魔王 | `import.meta.glob` | 加一個 `bosses/<slug>/` 資料夾 | `bosses/index.ts` |
| Action handler | `import.meta.glob` | 加 `handlers/<type>/index.ts` | `actions/handlers/index.ts` |
| 狀態效果 | `EFFECT_DEFS` map | 加一筆（淨化清單自動推導） | `entities/effects.ts` |
| Boss action | `registerBossAction()` | 在魔王資料夾 register | `bosses/actions.ts` |
| 角色 VFX | `registerVfx()` | 在角色 `vfx.ts` register | `render3d/vfx/registry.js` |

這些是本計畫要**對齊**的標竿模式。

### 2.2 衝突熱點（git churn 量化）

`git log --name-only` 統計的高改動檔案，全部是橫切關注點：

| 檔案 | 改動次數 | 病灶 | 本計畫對應 |
|---|---|---|---|
| `game/controller.ts` | 26 | 上帝物件：序列化＋大廳＋迴圈＋鏡頭＋預測 | ① ③ |
| `render3d/hud.js` | 21 | 共用 HUD，每人加指示器 | （§6 後續）|
| `style.css` | 20 | 共用 CSS | （§6 後續）|
| `renderer.js` / `render3d/models.js` | 18 / 18 | 共用渲染編排 | （§6 後續）|
| `entities/damage.ts` | 16 | 天賦邏輯內聯 | ② |
| `src/types.ts` | 16 | controller API 面，連動 `App.tsx` | ③（附帶）|
| `characters/index.ts` | — | 硬編 `DEFAULT_BLINK_IDS` | ④ |

---

## 3. 四項重構提案

每項格式：**問題 → 目標抽象 → Before/After → 遷移步驟 → 風險與守護 → 影響檔案**。

---

### 提案 ① 網路序列化 manifest（低風險 · 最高 CP 值）

#### 問題
[`controller.ts:43`](src/game/controller.ts) 的 `serializeNetworkPlayer` / `serializeNetworkSnapshot` **手動列舉**每個要同步的欄位：

```ts
export function serializeNetworkPlayer(p: any) {
  return {
    id: p.id, name: p.name, charId: p.charId, x: p.x, y: p.y, facing: p.facing,
    /* …約 30 個欄位… */ phaseTagsOverride: p.phaseTagsOverride,
  };
}
```

- **衝突**：任何人加一個需要同步的欄位（護盾、鏡頭旗標…）都要編輯這同一個函式本體。
- **靜默 desync**：忘了加 → 加入者畫面該欄位永遠是 undefined，是最難 debug 的 bug。
- **重複事實**：`Player` 型別（[`types/entities.ts:73`](src/game/types/entities.ts)）已明列欄位，序列化是它的手抄子集，兩邊不會自動同步。

#### 目標抽象
把「哪些欄位過網路」變成**宣告式 manifest**，從 controller 抽到獨立模組 `game/network/snapshot.ts`。新增同步欄位 = 在陣列 append 一行（衝突面遠小於改函式本體），並用測試斷言 manifest ⊆ Player 已知欄位。

#### Before / After

**Before**（controller.ts 內，手寫物件字面）：見上。

**After**（`src/game/network/snapshot.ts`）：
```ts
// 要過網路的玩家欄位（單一事實來源）。新增同步欄位＝在此 append 一行。
// 分組註解保留語意，方便 review。
export const NET_PLAYER_FIELDS = [
  // 身分
  'id', 'name', 'charId', 'team',
  // 運動學
  'x', 'y', 'facing', 'kvx', 'kvy',
  // 生命/資源
  'hp', 'maxHp', 'mana', 'maxMana', 'alive', 'shield', 'shieldTime', 'ult', 'kills',
  'effects', 'cd', 'chargeState',
  // 魔王/召喚物/部位渲染旗標
  'isBoss', 'isPart', 'isMinion', 'isFake', 'isMirror',
  'ownerId', 'partId', 'partColor', 'scale', 'reviveProg',
  // HUD/渲染線索
  'aiId', 'channel', 'recoverWindow', 'recoverHeavy', 'phaseTagsOverride',
] as const;

// 頂層狀態欄位（players 另外處理）。
export const NET_STATE_FIELDS = [
  'phase', 'winner', 'winnerTeam', 'time', 'mode', 'round', 'bossId',
  'bossHp', 'bossMaxHp', 'roundPhase', 'roundTimer', 'introDur',
  'banner', 'tethers', 'bossWipedRound',
] as const;

export function serializeNetworkPlayer(p: any) {
  const out: Record<string, any> = {};
  for (const k of NET_PLAYER_FIELDS) out[k] = p[k];
  return out;
}

export function serializeNetworkSnapshot(state: any) {
  const players: Record<string, any> = {};
  for (const id of Object.keys(state.players)) players[id] = serializeNetworkPlayer(state.players[id]);
  const out: Record<string, any> = { players };
  for (const k of NET_STATE_FIELDS) out[k] = state[k];
  // 仍需特例處理的欄位（裁剪/預設值），維持原語意：
  out.stats = state.stats ? { _retryCount: state.stats._retryCount || 0 } : null;
  out.projectiles = state.projectiles; out.zones = state.zones; out.fx = state.fx;
  out.destructibles = state.destructibles || [];
  out.items = state.items || [];
  out.timeAnchors = state.timeAnchors || [];
  out.timeAnchorRitual = state.timeAnchorRitual || null;
  return out;
}
```
controller.ts 改成 `import { serializeNetworkSnapshot } from './network/snapshot'`。

> 註：少數欄位有「裁剪 / 預設值」語意（`stats` 只送 `_retryCount`、陣列給 `|| []`），不適合純欄位複製，保留為顯式特例。manifest 只收「原樣複製」的欄位。

#### 遷移步驟
1. 新增 `src/game/network/snapshot.ts`，把兩個函式搬過去、改成 manifest 驅動。
2. controller.ts 改 import；移除原本兩個函式（保留 re-export 以防外部引用：`export { serializeNetworkSnapshot } from './network/snapshot'`）。
3. 新增 `test/networkSnapshot` 斷言（見下）。
4. `yarn build && yarn test:run` — 既有的 `test/networkSnapshot.test.ts` 應原樣通過。

#### 風險與守護
- 風險：**低**。純資料搬移，欄位集合不變。
- 守護：既有 `test/networkSnapshot.test.ts` 已比對快照欄位；再加一條不變式——
```ts
// manifest 不得包含 Player 沒有的欄位（防 typo）；序列化結果欄位集合 = manifest
it('serialize 只輸出 manifest 欄位', () => {
  const out = serializeNetworkPlayer(makePlayerFixture());
  expect(Object.keys(out).sort()).toEqual([...NET_PLAYER_FIELDS].sort());
});
```

#### 影響檔案
`controller.ts`（移除函式、改 import）、新增 `network/snapshot.ts`、`test/networkSnapshot.test.ts`（補一條）。

---

### 提案 ④ `evade` data-driven 化（低風險 · 快速見效）

#### 問題
[`characters/index.ts:24`](src/game/characters/index.ts) 用**硬編角色 id 集合**決定閃避型別：
```ts
const DEFAULT_BLINK_IDS = new Set([1, 2, 7, 8, 11, 15, 16, 17]);
CHARACTERS.forEach((c) => {
  const isBlink = c.evadeType ? c.evadeType === 'blink' : DEFAULT_BLINK_IDS.has(c.id);
  ...
});
```
- 兩個開發者同時加角色，都要回來改這個 set → 衝突。
- 角色的閃避行為「不在角色資料夾裡」，違反 co-location。
- `hud.js` 也有 `charId === 102` 之類硬編（魔王特例，§6 追蹤）。

> 註：數字 `charId` 本身是**硬合約**——它是網路協定值＋`CHARACTERS` 陣列索引，且 `test/registry.test.ts` 斷言「id 連續 0..18」。因此**不移除數字 id**，只把「依 id 推導的行為」收回各角色資料。

#### 目標抽象
每個角色在自己的 `data` 寫明 `evadeType: 'blink' | 'dash'`（資料已支援，只是舊角色沒寫），刪掉 `DEFAULT_BLINK_IDS` 後備；index.ts 只負責「依 `evadeType` 套用對應的 evade 模板」。

#### Before / After
**Before**：上方硬編 set + 後備判斷。

**After**（`characters/index.ts`）：
```ts
CHARACTERS.forEach((c) => {
  const isBlink = c.evadeType === 'blink'; // 來源唯一：角色資料
  c.evade = isBlink ? BLINK_EVADE(c.color) : DASH_EVADE(c.color);
});
```
而 id 1,2,7,8,11,15,16,17 對應的角色（Mage/Assassin/Ninja/Elementalist/Hexer/Summoner/Necromancer/Chronomancer）各自的 `data` 補上 `evadeType: 'blink'`；其餘補 `evadeType: 'dash'`（或維持預設為 dash，僅 blink 群顯式標記，二擇一，文件期推薦「全部顯式」以利 grep）。

#### 遷移步驟
1. 對 8 個 blink 角色的 `classes/<slug>/index.ts` 的 `data` 加 `evadeType: 'blink'`。
2.（建議）其餘 11 個加 `evadeType: 'dash'`，讓行為完全寫在資料裡。
3. 刪除 `DEFAULT_BLINK_IDS` 與後備分支。
4. 加測試：`evadeType` 為必填、且 id 唯一連續（強化既有斷言）。

#### 風險與守護
- 風險：**低**。對照 set 與資料逐一比對即可確保等價。
- 守護：determinism 快照（閃避行為若變會立刻破）＋ registry 測試補「每個角色都有 `evadeType`」。

#### 影響檔案
`characters/index.ts`、8〜19 個 `classes/<slug>/index.ts`（各加一欄）、`test/registry.test.ts`（補斷言）。

---

### 提案 ② 天賦 hook registry（中高風險 · 最高擴充價值）

#### 問題
[`damage.ts:15`](src/game/entities/damage.ts) 的導覽註解自承：一個天賦的邏輯散在 **5 個檔案**，全靠 `talent.id === 'xxx'` 的 if 分支：
- `entities/damage.ts`：`talentDamageMods()`（deadeye/lethal/momentum/shadowstrike/suppress/summonbond）、`warsongFor()`、`dealDamage` 尾段（arcane_flow/bloodlust/momentum/suppress/summonbond/retribution）、`spreadCurse()`（plague）
- `systems/playerState.ts`：bloodlust/lifebloom/iaido
- `systems/effects.ts`：undeath（DoT 汲取）
- `actions/combat.ts`：pyromancy/iaido
- `actions/casting.ts`：iaido/timeprism

症狀：每加一個有被動的角色，要同時編輯多個 hot-path 檔 → 衝突；且註解已記「`unbreakable`/`bulwark` 只有資料、邏輯沒接」——**這正是分散內聯最典型的漏接**。

#### 目標抽象
天賦 hook registry，與角色 **co-locate**：每個天賦在 `classes/<slug>/talent.ts` 用 `registerTalent(id, hooks)` 註冊一組 hook，沿用 VFX 的「side-effect import 註冊」慣例。Hot-path 把 `if (talent.id === 'x')` 換成「查 registry → 呼叫該 hook」。

**Hook 介面（依現有呼叫點歸納）**：
```ts
export interface TalentHooks {
  // 傷害輸出修正（回傳新傷害）。deadeye/lethal/momentum/shadowstrike/suppress/warsong
  modifyOutgoing?(c: TalentCtx): number;
  // 傷害承受修正（回傳新傷害）。summonbond/unbreakable/bulwark
  modifyIncoming?(c: TalentCtx): number;
  // 造成傷害後副作用。arcane_flow/bloodlust/momentum/suppress/summonbond/retribution
  onDealt?(c: TalentCtx): void;
  // 擊殺後。plague(死亡傳染)
  onKill?(state, killer, corpse): void;
  // 每幀。bloodlust(攻速)/lifebloom(回血)/iaido(蓄力計時)
  onTick?(state, player, dt): void;
}
```
（pyromancy/timeprism 等「動作施放期」的 hook 可再加 `onCast`／`modifyEffect`，分階段落地。）

#### Before / After
**Before**（damage.ts `talentDamageMods` 片段）：
```ts
const dt = getCharacter(target.charId).talent;
if (dt && dt.id === 'summonbond') { /* 算召喚物數量做減傷 */ }
const at = getCharacter(attacker.charId).talent;
if (at && at.id === 'deadeye') { /* 依距離加傷 */ }
// …更多 if…
```
**After**：
```ts
const dt = getCharacter(target.charId).talent;
const dh = dt && TALENTS.get(dt.id);
if (dh?.modifyIncoming) dmg = dh.modifyIncoming({ state, attacker, target, dmg, talent: dt });

const at = getCharacter(attacker.charId).talent;
const ah = at && TALENTS.get(at.id);
if (ah?.modifyOutgoing) dmg = ah.modifyOutgoing({ state, attacker, target, dmg, talent: at });
```
天賦邏輯本體搬到 `classes/warrior/talent.ts`：
```ts
import { registerTalent } from '../../talents/registry';
registerTalent('unbreakable', {
  modifyIncoming({ target, dmg, talent }) {
    const dr = Math.min(talent.maxDr ?? 0.3, missingHp(target) / target.maxHp * (talent.maxDr ?? 0.3));
    return dmg * (1 - dr); // ← 順手把註解標記「未接」的減傷補上（行為變更，需更新快照）
  },
});
```

#### 效能與 determinism（關鍵）
- **效能等價**：現況本來就是 `getCharacter(charId).talent` O(1) 後做 `if id===`。改成 `TALENTS.get(id)?.hook?.()` 是**同階成本**，只是把分支換成 Map 查找＋呼叫。
- **aura 型天賦（warsong）**：需掃全場找 bard。維持原掃描邏輯，但收進 `warsong` 的 hook 內（可選：每幀 gather 一次快取，避免每次 dealDamage 重掃；若這麼做屬行為等價但要小心順序）。
- **順序即 determinism**：多個天賦修正同一數值時，**套用順序必須固定**（現況是固定的 inline 順序）。registry 須定義穩定順序（例如「先 incoming 再 outgoing」「同類 hook 依固定 pipeline，不依 Map 插入序」）。這是本提案最大的正確性風險點。
- **守護**：`test/determinism.test.ts` 黃金快照。**逐個天賦搬移、每搬一個就跑一次快照**；若刻意補上 unbreakable/bulwark 的減傷（行為變更），單獨成一個 commit、以 `vitest -u` 更新快照並在訊息說明。

#### 遷移步驟（增量、可分多個 PR）
1. 建 `characters/talents/registry.ts`（`registerTalent`/`TALENTS`）＋ `characters/talents/index.ts` glob `classes/*/talent.ts`，由 `characters/index.ts` 觸發載入。
2. **一次搬一個天賦**：把該天賦在各檔的 inline 分支移到它的 `talent.ts`，hot-path 換成 registry dispatch，跑快照確認不變。
3. 全部搬完後，移除 `damage.ts`/`playerState.ts`/`effects.ts`/`combat.ts`/`casting.ts` 內的天賦 if 鏈，只留 dispatch 呼叫點。
4. 更新 `damage.ts` 開頭導覽註解：改指向 registry。
5.（可選、獨立 PR）補 unbreakable/bulwark 缺漏邏輯——此步**會改行為**，需更新快照。

#### 風險與守護
- 風險：**中高**（動傷害 hot-path、順序敏感）。以「逐天賦搬移＋每步跑快照」降風險。
- 守護：determinism 黃金快照是硬防線；另加 registry 測試「每個角色 `talent.id` 都有對應註冊」。

#### 影響檔案
新增 `characters/talents/`、各 `classes/<slug>/talent.ts`；修改 `damage.ts`/`playerState.ts`/`effects.ts`/`combat.ts`/`casting.ts`（移除 inline、改 dispatch）。

---

### 提案 ③ 拆解 `controller.ts` 上帝檔案（中風險）

#### 問題
839 行、churn 第一名。檔頭註解說「刻意不拆，因狀態纏繞」，但實際是 **5 個可分離關注點**共用一組閉包變數：

| 區塊 | 行為 | 目前位置 |
|---|---|---|
| 網路序列化 | snapshot 編解碼 | → 提案 ① 已抽走 |
| 連線＋大廳 | host/joiner 回呼、lobby 名單、選角 | controller.ts |
| 遊戲迴圈 | logicTick/render/快照節流 | controller.ts |
| 預測插值 | snapBuf/buildView/reconciliation | controller.ts |
| 鏡頭視角 | viewMode/pointerlock/準心 | controller.ts |

每個新功能（鏡頭、道具、boss 模式、網路調優）都撞同一檔。

#### 目標抽象
保留「單例 controller」對外形狀不變（`getController()` 與 `GameController` API 一字不改，React 側零改動），內部拆成多模組，透過一個共享的 `ctx`（持有可變狀態的物件）協作：

```
game/controller/
  index.ts        # createController：組裝 ctx + 各模組，回傳對外 API（形狀同今日）
  state.ts        # ControllerCtx：role/gameState/inputs/view… 可變狀態 + emit 事件匯流排
  session.ts      # setupHost/setupJoiner/大廳/選角/start
  loop.ts         # maybeStartLoop/logicTick/renderLoop/draw/快照節流
  prediction.ts   # receiveSnapshot/snapBuf/findBracket/buildView/tickSelfPrediction
  camera.ts       # applyViewMode/bindViewControls/crosshair
network/
  snapshot.ts     # 提案 ①
```

模組是「吃 `ctx`、回傳函式」的工廠，不各自開單例，避免狀態分裂。

#### Before / After（示意）
**Before**：所有函式閉包在 `createController()` 內共享變數。
**After**：
```ts
// state.ts
export function createCtx(): ControllerCtx { return { role: null, gameState: null, inputs: {}, /* … */ emit, on }; }

// loop.ts
export function createLoop(ctx: ControllerCtx, deps: { renderer, input, net }) {
  function logicTick() { /* 用 ctx.* 取代原閉包變數 */ }
  return { maybeStartLoop, stopLoop, draw };
}

// index.ts
function createController(): GameController {
  const ctx = createCtx();
  const session = createSession(ctx, { net, input });
  const loop = createLoop(ctx, { ... });
  const camera = createCamera(ctx, { ... });
  const prediction = createPrediction(ctx);
  return { on: ctx.on, createRoom: session.createRoom, /* …形狀同今日… */ };
}
```

#### 遷移步驟（增量）
1. **先做提案 ①**（網路序列化抽走，controller 先瘦一圈）。
2. 抽 `camera.ts`（最獨立、依賴最少）→ 跑 build。
3. 抽 `prediction.ts`（joiner 專用，邊界清楚）→ 跑 build。
4. 抽 `loop.ts`、`session.ts`。
5. `index.ts` 變純組裝。全程**對外 API 不變**，`src/types.ts` 的 `GameController` 不動，React 零改。

#### 風險與守護
- 風險：**中**。閉包變數改成 `ctx.` 引用，易漏改；但 TypeScript 編譯會抓出大部分。
- 守護：`yarn build`（型別）＋ 手動跑一次連線冒煙（host+joiner 兩分頁）＋ determinism 快照（step 不受影響但仍跑）。

#### 影響檔案
`controller.ts` → `controller/` 多檔；`src/types.ts` 不變、`App.tsx`/`components/*` 不變。

---

## 4. 實作順序與相依

```
①  network/snapshot.ts ──┐  (低風險、先讓 controller 瘦身)
                          ├─▶ ③ 拆 controller（① 已先搬走序列化）
④  evade data-driven ─────┘  (獨立、隨時可做)

②  天賦 hook registry ── 獨立進行，逐天賦搬移、可跨多個 PR（風險最高，放最後或平行小步走）
```

建議節奏：
1. **PR A**：① 網路序列化 manifest（小、低風險，立刻消滅最痛的衝突點）。
2. **PR B**：④ evade data-driven（小、低風險）。
3. **PR C**：③ 拆 controller（中、依賴 ①）。
4. **PR D…**：② 天賦 registry，**逐天賦**搬移，每個天賦一個小 commit、每步跑快照。

每個 PR 都應**獨立可合併、行為等價**，降低多人協作下的 rebase 痛苦。

---

## 5. 共通驗證守則（每一步都做）

```bash
yarn build        # tsc 型別檢查 + vite 打包，必須綠燈
yarn test:run     # determinism 黃金快照 + registry 不變式，必須全綠
```

- **快照不變 = 行為未變**。重構過程快照**一律不可變**。
- 唯一例外：提案 ②「補 unbreakable/bulwark 缺漏邏輯」是**刻意改行為**，須單獨 commit、`vitest -u` 更新快照、提交訊息說明原因。
- 連線相關（①③）另做**手動冒煙**：開兩個分頁（host + joiner），確認大廳、開始、移動預測、結算正常。

---

## 6. 後續項目（部分已落地）

四項主重構後接續處理的衝突熱點：

**已完成**

- ✅ **天賦 registry 補生命週期 hook**（`13f449c`）：除傷害管線外再加 `cooldownRate/onTimers/onRecovery/onCastResolved`，搬移 bloodlust(攻速)/lifebloom/iaido(計時)/timeprism。
- ✅ **effect 顯示中繼資料 co-located**（`2f8eee6`）：`EFFECT_META`（icon/name/buff）併進 `EFFECT_DEFS`，`getEffectHud()` 取代 `hud.js` 的第二份表 → 新增效果只改一處。
- ✅ **`hud.js` 硬編魔王特例**（`cb2f71a`）：`charId === 102` 改讀 lava-juggernaut 資料的 `lavaBurn` flag；引擎已無硬編魔王 id。
- ✅ **HUD widget registry（種子）**（`3b659dc`）：建立 `render3d/hud/`（`dom.js` 共用工具 + `widgets.js` registry + `widgets/hazardAlert.js` 首個 widget）。新增 HUD 指示器＝加一個 widget 檔、`registerHudWidget`，不必動 `hud.js` 核心。已實機驗證渲染正常。
- ✅ **移除死碼 render2d**（`f71f75c`）：經確認 `renderer.canvas2d.js` + `render2d/`（舊 Canvas2D 備援）已無引用，整包刪除（-7 檔）。

**仍待處理 / 評估（低優先或屬大改動）**

- **HUD widget registry（既有面板搬移）**：自身狀態/名牌/魔王/機制卡/全滅面板仍在 `hud.js` 的 `update()`；種子已就位，可增量把這些搬成 widget（DOM 重、無單測，建議搭配實機/截圖驗證）。
- **天賦剩餘 inline 特例**：warsong/plague（aura）、summonbond 召喚物回主（跨實體）、pyromancy（強化 burn 效果）、undeath（DoT 汲取）、iaido 居合就緒（與施放序列緊密耦合）。這些屬「aura／跨實體／與序列緊密耦合」，需更專屬的 hook（如 aura 聚合、onAnyDeath、modifyAppliedEffect）；硬塞現有 hook 反增風險，建議「有需要時再配對應 hook 搬移」。
- **`.js` 相容性 barrel 清理**：`characters.js`/`entities.js`/`bosses.js`/`constants.js` 等 re-export 殼，待引用點收斂後可移除（純清潔，無行為；牽動大量 import 路徑，價值低）。
- **React API 面（`src/types.ts` 的 `GameController`）**：每加一個 controller 指令要同步改型別＋`App.tsx`；可評估事件/命令匯流排化，但屬較大改動，獨立評估。

---

## 附錄：本計畫不改變的「硬合約」

- ~~**數字 `charId`**：網路協定值＋陣列索引~~ → 已於 ④ 改為**穩定字串 slug**（玩家角色）。魔王（≥100）/召喚物（<0）仍為數字 id-space。新增角色用 slug、永不搶號。
- **30Hz `setInterval` 驅動邏輯**：分頁背景時 rAF 會暫停，邏輯必須用 setInterval。重構迴圈時不可改回純 rAF。
- **host-authoritative 資料流**：只有房主跑 `step()`，加入者插值/預測。序列化重構不改變這個拓撲。
- **determinism 黃金快照**：是行為等價的唯一裁判，凌駕一切重構。
