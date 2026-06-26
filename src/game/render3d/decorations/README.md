# 場地（競技場）系統 — 擴充指南

每隻 boss 都能有自己的場地建模。場地是**資料驅動**的：boss 提供一個 `theme`（+ 選用 `colliders`），由 render 層三個消費者組裝，**沒有** per-boss 的硬編碼場景檔。

## 消費者

| 檔案 | 讀什麼 | 做什麼 |
|---|---|---|
| `render3d/scene.js` | 顏色/霧/燈光、`floorStyle`、`wallStyle`/`wallTrimGlow` | 天空、霧、太陽/環境光、地板風格（石磚/苔蘚）、邊界牆、場外延伸地坪 |
| `render3d/decorations.js` | `decorations[]`、各道具設定、`props`、`floorDecal` | 競技場外圍道具（樹/石/廢墟/神殿/光束…）+ 中央地刻 |
| `render3d/atmosphere.js` | `atmosphere` | 飄落粒子（落葉/雪/餘燼…） |
| `systems/collisions.ts` | boss `colliders[]`（世界座標） | 靜態圓形障礙，擋住玩家移動（host 權威） |

型別定義在 [`render3d/arena.types.ts`](../arena.types.ts)（`ArenaTheme` / `ArenaCollider` / `ArenaDef`）。

---

## 1. 新增一個 boss 場地

在該 boss 資料夾建 `arena.ts`，照 [`bosses/golem/arena.ts`](../../bosses/golem/arena.ts) 抄：

```ts
import type { ArenaDef } from '../../render3d/arena.types.ts';

export const arena: ArenaDef = {
  theme: {
    sky: 0x101820, fog: 0x101820, fogNear: 900, fogFar: 3000,
    floorStyle: 'tiled',                 // 'tiled' | 'mossy' | 'organic'
    sunColor: 0xfff0c0, sunInt: 2.2,
    decorations: ['rock', 'pillar', 'crystal'],
    rock: { count: 18, color: 0x6a6560 },
    crystal: { count: 10, color: 0x74e0ff, glow: 0x49b0d0, glowInt: 0.7 },
    floorDecal: { kind: 'arcane', color: '#7ad8ff', opacity: 0.4 },
    atmosphere: { kind: 'stardust', color: '#c39bff', rate: 14 },
  },
  // colliders 選用：給「會擋人」的地標（座標見下方）
};
```

然後在 boss 的 `index.ts`：

```ts
import { arena } from './arena.ts';
const data = { /* …戰鬥資料… */ theme: arena.theme, colliders: arena.colliders };
```

> 簡單場地也可直接 inline 寫在 `index.ts` 的 `theme`（多數現有 boss 如此）；場地一變豐富就抽到 `arena.ts`。

---

## 2. 內建道具（`decorations[]` 可用的 kind）

| kind | 說明 | 主要設定 |
|---|---|---|
| `tree` | 樹（`big:true` → 古樹團塊樹冠 + 板根） | count, big, trunk, leaf, leafTop |
| `foliage` | 地被灌木（銜接地面與樹林） | count, low, high |
| `roots` | 巨大盤根 | count, color |
| `groundcover` | 青苔地被（苔斑 + 苔蕨叢） | splotches, tufts, rInner, rOuter |
| `rock` | 卵石 | count, color |
| `pillar` | 散落殘柱 | count, color |
| `ruins` | 散落石造廢墟（牌坊/斷牆/倒柱） | count, color, moss, vine, scale |
| `temple` | 廢棄神殿地標（階梯+列柱+橫樑+山牆） | x, z, scale, color, moss, glow |
| `crystal` | 發光晶體 | count, color, glow, glowInt |
| `brazier` | 火盆 | count, flame, flameGlow |
| `godrays` | 神殿光束（god-ray，會閃爍自轉） | count, color, opacity |

`floorDecal.kind`：`arcane` / `cracks` / `hex` / `rings` / `flame` / `snowflake` / `grove`（發光符文法陣）。
`atmosphere.kind`：`snow` / `embers` / `leaves` / `stardust` / `spores` / `petals` / `ash`。

---

## 3. 新增「共用」道具（多隻 boss 會用）

1. 在 `decorations/props/{nature,stone,fx}.js` 之一寫 `export function buildXxx(theme) { … return Object3D }`，
   幾何工具從 `../helpers.js` import（`noisify` / `makeInstanced` / `scatterPositions` / `drumColumn` …）。
2. 在 `decorations.js` 加一行 `registerProp('xxx', buildXxx)`。
3. theme 就能用 `decorations: ['xxx', …]` 與 `xxx: { …設定… }`。
4. 視需要在 `arena.types.ts` 的 `ArenaTheme` 補上 `xxx?:` 設定欄位。

## 4. 新增「boss 專屬」道具（只有這隻 boss 用）

免改共用檔。在該 boss 的 `arena.ts` 就近寫 builder，放進 `theme.props`：

```ts
import { noisify, makeInstanced } from '../../render3d/decorations.js'; // 共用工具一處 import

function buildGears(theme: any) { /* …回傳 THREE.Object3D… */ }

export const arena: ArenaDef = {
  theme: {
    decorations: ['gears', 'rock'],
    props: { gears: buildGears },   // applyDecorations 會優先用 theme.props[kind]
    gears: { count: 8 },
  },
};
```

---

## 5. 靜態碰撞（讓地標佔空間）

裝飾物**純視覺、不擋路**。要讓某個地標（如神殿基座）擋住玩家，加 `colliders`（**世界座標**圓）：

- `world = scene + (HALF_W, HALF_H)`，即 `(+1200, +800)`（見 `render3d/coords.js`）。
  例：神殿視覺在場景 `(760, -420)` → 碰撞中心世界 `(1960, 380)`。
- 形狀：圓形給 `{x,y,r}`；**長方形地標給有向方框 `{x,y,hw,hh,rot}`**（無死角、推薦）。
  `rot` = 視覺道具的 `rotation.y` 取負（對齊朝向）；`hw/hh` = 視覺半寬/半高（含 scale）。
- 會擋住**所有實體含 boss**（地標是固定的）；`isPart` 不獨立推（跟著 boss）。
- 碰撞是 **host 權威**（`step()` 內 `resolveStaticColliders`）；連線時遠端玩家的本機預測未含，靠近可能輕微回彈。

驗證對齊：可暫時在 `renderer.js` 套用主題處，把 `colliders` 畫成洋紅 `RingGeometry`（`depthTest:false`）比對視覺基座。
