# 幾何鬥技場 — 多人連線格鬥

以 **three.js (WebGL)** 渲染、**React + Vite + TypeScript** 打造的 3D（俾視傾斜鏡頭）多人連線格鬥遊戲。
全部玩家互為敵人，**場上剩最後一人即獲勝**。

> 架構：React 只負責選單／大廳／結算等 UI 畫面；遊戲迴圈與 three.js 渲染維持高效能的**命令式引擎**（`src/game/`），透過 canvas ref 與 controller 橋接。

- 🎮 純鍵盤操作：`WASD/方向鍵` 移動、`J` 普攻、`K` 技能1、`L` 技能2、`;` 大絕招
- 👥 最多 8 人同場混戰
- 🦸 **18 種角色**，各有強項與弱項、**各自獨特的 3D 技能特效與專屬大絕招**
- ⚡ 終極能量槽：隨時間與戰鬥累積，集滿即可施放大絕招（`;`）
- ❤️ 每個角色有血條與魔力條
- 🌐 **免費連線**：使用 WebRTC P2P（PeerJS 公開 broker），免架站、可跨網路

## 連線怎麼運作（免費）

採 **WebRTC P2P 星狀拓撲**：
- 房主按「建立房間」會產生一個房號（例 `fg-ABCDE`）。
- 其他人在主選單輸入房號即可加入，連線直接點對點，**不需要自己架伺服器**。
- 房主擔任「權威主機」負責運算遊戲狀態並廣播給所有人；加入者送出操作、接收狀態並做插值/預測渲染。

> 連線媒合透過 PeerJS 免費公開 broker + Google 公開 STUN。多數家用網路可直接連通；少數對稱型 NAT 可能無法穿透（休閒用途下可接受）。

## 本機執行

需要 **Node.js 18+** 與 **Yarn**。WebRTC 需要在 `http(s)://`（含 `localhost`）下執行，Vite dev server 已符合。

```bash
# 1. 安裝依賴（首次）
yarn install

# 2. 啟動開發伺服器（預設 http://localhost:5173）
yarn dev

# 3. 建置正式版（輸出至 dist/，含 TypeScript 型別檢查）
yarn build

# 4. 本機預覽建置結果
yarn preview
```

> `yarn dev` 已開啟 `host`，同網其他裝置可透過終端顯示的 `Network:` 網址連入測試多人。

### 自己一個人測試
開兩個以上瀏覽器分頁/視窗：
1. 第一個分頁輸入名稱 →「建立房間」→ 複製房號。
2. 其他分頁輸入名稱 → 貼上房號 →「加入房間」。
3. 大家各自選角色，房主按「開始遊戲」。

> 房主獨自一人也可開始（沙盒模式，不會自動結束），方便測試操作與技能。

## 免費部署（給朋友跨網路一起玩）

本專案建置後是純前端靜態檔（`dist/`），**不需要後端**：

```bash
yarn build   # 產生 dist/
```

- **Netlify / Cloudflare Pages / Vercel**：連結 repo，build 指令設 `yarn build`、發布目錄設 `dist`。
- **GitHub Pages**：將 `dist/` 內容推上。若部署在子路徑（例 `/repo-name/`），需在 `vite.config.ts` 設 `base: '/repo-name/'`。

部署後分享網址，房主開房、朋友輸房號即可連線。

## 角色一覽

### 原班 10 角色

| # | 角色 | 定位 | 特色 |
|---|------|------|------|
| 0 | ⚔️ 戰士 | 前排·開團 | 衝鋒/鉤索/護盾分享 |
| 1 | 🔵 法師 | 後排·爆發 | 冰矛/燃燒/流星 |
| 2 | 🟣 刺客 | 突進·爆發 | 印記連段、隱身 |
| 3 | ⬜ 坦克 | 前排·保護 | 超肉控場、全隊減傷 |
| 4 | 🟢 弓箭手 | 後排·持續 | 越遠越痛、流血 |
| 5 | ⚪ 治療師 | 支援·核心 | 全隊回血、逆轉 |
| 6 | 🔴 狂戰士 | 突進·處決 | 殘血越強、處決 |
| 7 | 🖤 忍者 | 機動·控制 | 接控絞殺、煙幕 |
| 8 | 🟠 元素使 | 控制·封鎖 | 火牆/冰徑/隕石 |
| 9 | 🟡 格鬥家 | 近戰·連段 | 反傷、萬用 flex |

### 新增 8 角色

| # | 角色 | 定位 | 特色 |
|---|------|------|------|
| 10 | 🥇 聖騎士 | 前排·反擊 | 被打反傷、淨化 |
| 11 | 🔮 咒術師 | 支援·削弱 | 易傷詛咒、死亡傳染 |
| 12 | 🎵 吟遊詩人 | 支援·增傷 | 全隊增傷加速 |
| 13 | ⚔️ 武士 | 近戰·蓄力 | 居合一擊、格擋反擊 |
| 14 | 🔫 槍手 | 後排·機動 | 跑打壓制、燃燒彈 |
| 15 | 🌀 召喚師 | 特殊·召喚 | 戰靈護主、引爆 |
| 16 | 💀 死靈法師 | 特殊·DoT | 持續壓血、汲取回血 |
| 17 | ⏱️ 時空術士 | 特殊·操控 | 時停加速、位置回溯 |

## 專案結構

```
index.html            Vite 入口（<div id=root> + 載入 /src/main.tsx）
package.json          依賴與 scripts（dev / build / preview）
vite.config.ts        Vite 設定（@vitejs/plugin-react、server.host）
tsconfig.json         TypeScript 設定（allowJs：引擎 .js 源用）
public/assets/        静態資源（角色 SVG）
src/
  main.tsx            React 進入點（掛載 <App/>、引入 style.css）
  App.tsx             依遊戲階段切換畫面、訂閱 controller 事件
  types.ts            React ↔ 引擎的邊界型別
  style.css           選單／大廳／HUD 樣式
  components/         React UI 畫面
    MenuScreen.tsx    主選單（名稱／建房／加房）
    LobbyScreen.tsx   大廳（房號／角色選擇／玩家列表／開始）
    GameScreen.tsx    遊戲容器（canvas，掛/卸載時交接 controller）
    GameOverScreen.tsx 結算（勝者／戰績／返回大廳）
  game/               命令式遊戲引擎（核心邏輯已型別化為 .ts；render3d 程序建模仍用 .js）
    types/            ★ 引擎共用 domain 型別（GameState/Player/ActionDef/Effect…）= 詞彙表
    constants.ts      競技場/tick/能量槽/冷卻等常數（GAMEPLAY 與 RENDER 分群）
    controller.ts     串接連線／模擬／渲染／輸入，管理大廳與遊戲迴圈（單例）
    simulation.ts     權威模擬 step()：每 tick 依序呼叫各 system（房主執行）
    characters.js     → characters/ 桶（18 角色 + 負數 minion 模板）
    characters/       每職業一資料夾 classes/<slug>/ + glob 自動註冊 + BaseCharacter
    entities.js       → entities/ 桶
    entities/         factories(工廠) / damage(傷害管線) / effects(效果 registry) / team / stats / math
    systems/          每 tick 純函式系統：movement/collisions/projectiles/zones/effects/playerState…
    actions/          技能動作系統：executor + handlers/<type>/（glob registry）+ casting/runtime/combat
    bosses.js         → bosses/ 桶
    bosses/           每魔王一資料夾 + glob 自動註冊 + BaseBoss；AI/回合/部位/傷害修正
    bossAI.js         魔王 telegraph 狀態機 AI（host-only）
    bossMode.js       闖關回合系統（過場/復活/部位/勝負）
    input.js          鍵盤 → input state（三套操作配置）
    network.js        PeerJS P2P 包裝（host 星狀拓撲）
    renderer.js       three.js 渲染入口（編排 render3d/ 模組 + 音效偵測）
    renderer.canvas2d.js  舊版 Canvas2D 渲染（保留備援參考）
    render2d/         Canvas2D 版繪製模組（備援）
    render3d/         three.js 渲染模組
      scene.js        WebGLRenderer/相機/燈光/地板/泛光後處理/震動閃光
      models.js       18 角色程序化 3D 模型 + 動畫狀態機
      materials.js    模型材質與 canvas 程序貼圖工具（自 models.js 拆出）
      entities3d.js   投射物/地面範圍區 3D 物件
      particles.js    GPU 粒子系統（單一 draw call）
      fxbus.js        特效事件去重 + 一次性特效
      hud.js          引擎內 HUD（頭頂名牌 + 角落面板）
      coords.js       世界座標 ↔ 場景座標
      classes/        8 新角色的程序化建模；vfx/  每角色專屬技能特效（registry + 共用 lib）
  test/               ★ 黃金回歸測試（vitest）：determinism 快照 + registry 不變式
```

> three.js 與 PeerJS 由 **npm 套件**（`three@0.180.0`、`peerjs@1.5.4`）提供，Vite 原生解析 `three` 與 `three/addons/*`。
>
> 引擎核心（entities / systems / actions / simulation）已從「`.js` + 關閉型別檢查」**漸進遷移為型別化 `.ts`**，共用型別集中於 `src/game/types/`。`render3d/` 的程序化建模仍維持 `.js`（three.js 物件建構，型別效益低）。標 `★` 為本次重構新增。

## 引擎架構（開發者導覽）

> 給接手的人類或 AI：先讀這段，能在數分鐘內掌握全貌。

### 分層

- **React UI 殼**（`src/components/`）：只負責選單／大廳／結算等畫面。
- **Controller**（`src/game/controller.ts`）：橋接 React ↔ 引擎，管理連線、大廳、遊戲迴圈、預測插值。對 React 以事件（`emit`）溝通。
- **命令式引擎**（`src/game/` 其餘）：高效能、可決定性的遊戲模擬與 three.js 渲染。不依賴 React。

### 權威主機資料流（host-authoritative）

```
加入者鍵盤 ──input──▶ 房主(權威)  ──step()──▶ 狀態  ──snapshot──▶ 加入者(插值/預測渲染)
                         ▲                                              │
                         └───────────────── 房主自身也渲染 ◀────────────┘
```

- 只有**房主**跑 `step()`（權威模擬）並把狀態快照廣播給所有人。
- **加入者**送出 input、收 snapshot 做插值；自身移動用 `applyMovement` 本機預測以減少延遲感。
- 邏輯/網路用 `setInterval(30Hz)` 驅動（**不可**只靠 `requestAnimationFrame`——分頁背景時 rAF 會被暫停，導致權威模擬凍結）。渲染用 rAF + 後備 `draw()`。

### 每幀模擬管線（`simulation.ts` 的 `step()`）

對每位存活玩家依序：召喚壽命 → 角色計時器 → 冷卻 → 狀態效果(DoT) → 被動回復 → 汲取鏈 → 腳本化移動(衝鋒/躍擊) 或 一般移動+留痕+施放輸入。
接著對全場：碰撞分離 → 投射物 → 範圍區 → 可破壞物 → 特效壽命 → 清除死亡召喚物 → 勝負/回合判定。
所有 system 都是**對共用 `state` 操作的純函式**（無事件匯流排），確定性高、易單測。

### Registry 模式（本專案的核心擴充手法）

許多子系統用 **`import.meta.glob` 自動發現 + Map 註冊**，新增內容只要「加一個檔案」，不需改 switch：

| 子系統 | 註冊點 | 新增方式 |
| --- | --- | --- |
| 角色 | `characters/index.ts` glob `classes/*/index.ts` | 新增一個職業資料夾，`export default new XxxCharacter()` |
| 魔王 | `bosses/index.ts` glob `*/index.ts` | 新增一個魔王資料夾，`export default new XxxBoss()` |
| 動作 handler | `actions/handlers/index.ts` glob `*/index.ts` | 新增 `handlers/<type>/index.ts`，`export const handlers = { <type>: fn }` |
| 狀態效果 | `entities/effects.ts` 的 `EFFECT_DEFS` | 加一筆 `{ apply, cleanseable }`（淨化清單自動推導） |
| 角色 VFX | `render3d/vfx/registry.js` | 在角色 `vfx.ts` 內 `registerVfx('<id>', { onCast, … })` |

### 型別與測試

- `src/game/types/`：`GameState / Player / Projectile / Zone / Effect / ActionDef / ActionContext / Input …`。引擎多數 `.ts` 已吃這些型別（IntelliSense + 編譯期檢查）。
- `yarn test`：`test/determinism.test.ts` 以固定種子重播 `step()` 並比對黃金快照——**重構引擎時，此快照不變 = 行為未變**；`test/registry.test.ts` 守角色/魔王/handler 完整性。



## 如何擴充（食譜）

> 多數擴充靠 registry「加一個檔/一筆」即可；以下列出要碰哪些檔案。

- **新增一個角色**：在 `src/game/characters/classes/<slug>/` 建 `index.ts`（`export default new XxxCharacter(data, loaders)`）、`model.ts`、`texture.ts`、`vfx.ts`。glob 會自動納入。技能在 `data` 內以 `basic/skill1/skill2/ultimate` 描述（`type` 對應某個 action handler）。閃避型別可加 `evadeType: 'blink' | 'dash'`。
- **新增一種技能動作（action type）**：在 `src/game/actions/handlers/<type>/index.ts` 匯出 `export const handlers = { <type>(ctx) { … } }`。`ctx` 為 `ActionContext`（含 `state/caster/action/…`）。角色資料的技能把 `type` 設成它即可。
- **新增一種狀態效果（effect）**：在 `src/game/entities/effects.ts` 的 `EFFECT_DEFS` 加一筆 `{ apply, cleanseable }`。可被淨化者設 `cleanseable: true`——**淨化清單會自動推導**，不必再改 `cleanse`。
- **新增一個天賦（被動）**：天賦資料寫在角色 `data.talent`；邏輯依性質內聯於 hot-path，進入點與對照表見 `entities/damage.ts` 開頭的「天賦系統導覽」註解。
- **新增一個闖關魔王**：在 `src/game/bosses/<slug>/` 建 `index.ts`（`export default new XxxBoss()`）、`ai.ts`、`model.ts`、`action.ts`。glob 自動納入，依 `round` 排序。
- **新增/美化技能特效（VFX）**：在角色 `vfx.ts` 內 `registerVfx('<vfxId>', { onCast, onHit, projectile, zone })`，並讓技能資料的 `vfx` 指到該 id。缺 hook 時走通用 fallback（安全不報錯）。

## 開發與測試

```bash
yarn dev          # 開發伺服器
yarn build        # tsc 型別檢查 + vite 打包（產物 dist/）
yarn test         # vitest：模擬決定性黃金快照 + registry 不變式
yarn test:run     # 跑一次（CI 用）
```

> 重構引擎時的鐵則：`yarn build` 綠燈 **且** `yarn test:run` 的決定性快照不變（= 行為未變）。若刻意更動了平衡/行為才以 `vitest -u` 更新快照，並於提交說明原因。

## 已知限制（此版本）

- 房主離線該局即結束（P2P 特性，無獨立伺服器保存狀態）。
- 信任房主、無防作弊機制。
- 對稱型 NAT 可能無法穿透（未內建付費 TURN）。
- 無手機觸控；NPC/魔王為腳本化 AI（非高階戰術）。

