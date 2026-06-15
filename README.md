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
  game/               命令式遊戲引擎（維持 JavaScript）
    controller.ts     串接連線／模擬／渲染／輸入，管理遊戲迴圈（原 main.js）
    constants.js      競技場尺寸、tick rate、物理常數
    characters.js     18 角色資料與技能規格（含每招 vfx 特效 id）
    input.js          鍵盤輸入
    entities.js       實體工廠、數學、傷害/效果輔助
    simulation.js     權威模擬 step() 與移動（房主執行）
    network.js        PeerJS P2P 包裝（import 自 peerjs 套件）
    renderer.js       three.js 渲染入口（編排以下模組）
    renderer.canvas2d.js  舊版 Canvas2D 渲染（保留備援參考）
    render3d/         3D 渲染模組
      scene.js        WebGLRenderer/相機/燈光/地板/泛光後處理/震動閃光
      models.js       18 角色程序化 3D 模型 + 動畫（含 8 新角色 class 模組）
      entities3d.js   投射物/地面範圍區 3D 物件
      particles.js    GPU 粒子系統（單一 draw call）
      fxbus.js        特效事件去重 + 一次性特效
      hud.js          引擎內 HUD（頭頂名牌 + 角落面板）
      coords.js       世界座標 ↔ 場景座標
      vfx/            每個角色專屬的華麗技能特效（18 角色 × 4 技能）
```

> three.js 與 PeerJS 現由 **npm 套件**（`three@0.180.0`、`peerjs@1.5.4`）提供，Vite 原生解析 `three` 與 `three/addons/*`。原 `js/vendor/three/` 與 importmap／CDN 已移除。

## 已知限制（此版本）

- 房主離線該局即結束（P2P 特性，無獨立伺服器保存狀態）。
- 信任房主、無防作弊機制。
- 對稱型 NAT 可能無法穿透（未內建付費 TURN）。
- 無音效、無手機觸控、無 AI bot。
