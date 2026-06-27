# Game Architecture Roadmap

> 目的：把目前遊戲架構從「能跑、但主迴圈容易變胖」整理成可長期擴充的 engine layer。
> 核心方向：保留 plain data state 與 host-authoritative snapshot，不把同步中的 entity 改成 class instance。

## 1. Current Direction

目前專案已經不是純散亂架構，而是偏 data-oriented：

- `GameState` 是權威狀態，包含 `players`, `projectiles`, `zones`, `fx`, `items` 等 plain data。
- 房主 host 呼叫 `step(state, inputs, dt)` 推進模擬。
- joiner 收 snapshot，用精簡資料做 render/interpolation/prediction。
- 角色與 Boss 已有專屬 tick hook：`character.tick(state, player, dt)` / `bossData.tick(state, boss, dt)`。
- 通用規則由 systems 更新，例如 projectile、zone、status effect、items、collision。

這代表下一步不應該把所有 entity 變成：

```ts
class Projectile {
  tick(dt) {}
}
```

原因是 snapshot 只傳 JSON-like plain data；method/prototype 不會被傳到 joiner。如果把同步物件變成 class instance，會牽動 network snapshot、prediction、renderer、測試與所有 action handler，風險高、收益不明顯。

推薦架構是：

```ts
GameState = plain data
Simulation = fixed-step pipeline
Systems = { id, tick(...) }
Character/Boss = optional specialized hooks
```

也就是：

```ts
step()
  runPlayerPipeline()
    PLAYER_SYSTEMS[]
  runWorldPipeline()
    WORLD_SYSTEMS[]
```

## 2. Completed Work

### 2.1 Simulation Pipeline Extraction

`simulation.ts` 已從大型主迴圈整理成固定步入口：

- phase guard
- time freeze / dt scaling
- `state.time += dt`
- `runPlayerPipeline(state, inputs, dt)`
- `runWorldPipeline(state, dt)`

這讓 `simulation.ts` 不再直接持有所有 gameplay system import。

### 2.2 Player / World System Registries

新增 pipeline layer：

```txt
src/game/systems/pipeline/
  index.ts
  types.ts
  player.ts
  world.ts
```

`types.ts` 定義：

- `PlayerPipelineContext`
- `PlayerSystem`
- `PlayerSystemResult`
- `WorldSystem`

`player.ts` 定義：

- `PLAYER_SYSTEMS`
- `PLAYER_PIPELINE_STEP_IDS`
- `runPlayerPipeline`

`world.ts` 定義：

- `WORLD_SYSTEMS`
- `WORLD_PIPELINE_STEP_IDS`
- `runWorldPipeline`

### 2.3 Preserved Control Flow

Player pipeline 保留原本語意：

- summon life 到期後，本 tick 不再處理該 player。
- status effect tick 若造成死亡，本 tick 不再處理該 player。
- scripted action 接管移動時，跳過 item / auto-lock / movement / cast。

使用 `skip-player` 表示「停止處理這個 player 的剩餘 systems」。

### 2.4 Tests Back To Green

已補上 pipeline order 測試，並將 potion/item 測試對齊目前實作規格：

- potion 背包上限：`10`
- Boss 回合起始 / 最低補給：`5`

目前驗證：

- `yarn build`
- `yarn test:run test/registry.test.ts test/determinism.test.ts test/items.test.ts`
- `yarn test:run`

皆通過。

## 3. Architecture Principles

### 3.1 Keep Networked State Serializable

同步路徑裡的資料必須保持 JSON-like：

- no class instance requirement
- no method on entity required for correctness
- no hidden prototype state
- no non-serializable gameplay state

可以在 renderer 或 local-only runtime 使用 class/object，但不要讓 host snapshot 依賴 class instance behavior。

### 3.2 Systems Own Generic Rules

通用行為放 system：

- movement
- collision
- projectiles
- zones
- effects
- items
- win/boss round resolution
- destructibles
- cleanup

新增通用規則時，優先新增 system 或擴充既有 system。

### 3.3 Character/Boss Hooks Own Specific Rules

角色或 Boss 的專屬每幀狀態放 hook：

- `character.tick(state, player, dt)`
- `bossData.tick(state, boss, dt)`
- talent hooks
- action handlers

不要把某個角色的特例散落到多個 generic systems，除非那個規則真的已經變成通用能力。

### 3.4 Pipeline Order Is Gameplay Contract

system 順序會影響手感與結果，所以它是 gameplay contract。

例如：

- status effects 必須早於 passive recovery。
- scripted action 必須早於 normal movement。
- collision/world systems 必須在 player update 後處理。
- boss round resolution 必須在 world update 後處理。

任何順序調整都需要測試與明確理由。

## 4. Roadmap

### Phase 1: Stabilize Pipeline Layer

狀態：大部分完成。

目標：

- 讓 `simulation.step()` 保持薄。
- player/world pipeline 有明確 registry。
- system order 有測試守護。
- snapshot 相容。

已完成：

- 拆出 `runPlayerPipeline`
- 拆出 `runWorldPipeline`
- 建立 `PLAYER_SYSTEMS`
- 建立 `WORLD_SYSTEMS`
- 建立 `pipeline/types.ts`
- 建立 order tests
- full test green

剩餘建議：

- 補短註解說明 `skip-player` 的語意。
- 將 `PlayerPipelineContext.character` / `talent` 從 `any` 漸進補型別。

驗收：

- `yarn build`
- `yarn test:run`
- determinism test 通過
- network snapshot tests 通過

### Phase 2: Centralize Gameplay Constants

狀態：已完成。

目標：

把容易漂移的平衡/規格值集中到 constants 或 domain config。

優先項目：

- potion max count
- boss potion floor / starting count
- sky drop interval
- drop item max count
- drop item warning/lifetime defaults

已集中：

```ts
export const POTION_MAX = 10;
export const BOSS_POTION_FLOOR = 5;
export const SKY_DROP_INTERVAL = 12;
export const MAX_DROP_ITEMS = 5;
export const DROP_ITEM_LIFETIME = 12;
export const DROP_ITEM_WARNING_TIME = 1.5;
export const DROP_ITEM_RADIUS = 15;
```

原因：

- 這次 item tests 失敗就是測試和實作規格漂移。
- 常數集中後，測試可以直接引用同一份規格，減少「測試以為 3，實作其實 10」這種問題。

驗收：

- `items.test.ts` 不再硬編 potion 上限/起始值。
- item/boss mode 行為不變。
- full test green。

### Phase 3: System Profiling

狀態：已完成初版。

目標：

利用 `system.id` 加 system-level profiling，方便查卡頓。

初版行為：

- 僅在 `?perf=1` 啟用。
- 每秒輸出 player/world system 耗時摘要。
- 不影響正常路徑。
- 正常路徑不讀取時間、不輸出 console。

可能輸出：

```txt
[sim systems] player:movement=0.42ms/30x worst=0.04ms world:projectiles=0.34ms/30x worst=0.03ms
```

注意：

- profiling 不能改變 deterministic simulation。
- 不要在每 tick 直接大量 `console.log`。
- 累積統計應是 local-only debug data，不進 snapshot。

驗收：

- `?perf=1` 可看到 system timing。
- 未開 `?perf=1` 時沒有額外 console noise。
- full test green。

### Phase 4: Better Types For Character/Talent Runtime

狀態：部分完成。

目標：

減少 `any`，讓新增角色、talent、system 時更安全。

已完成：

- `PlayerPipelineContext.character` / `talent` 已改為 `CharacterMeta | null` / `TalentMeta | null`。
- `SkillMeta.type` 已對齊 engine `ActionType`。
- `SkillMeta` 已沿用 engine `ActionDef` 的寬鬆 action data shape。
- 新增 `SkillSlot` 描述角色 action slot 名稱。

優先順序：

1. 定義或匯出 character runtime shape。
2. 定義 talent runtime shape。
3. 將 `PlayerPipelineContext.character` / `talent` 從 `any` 換成具體型別。
4. 找出高頻 `any` 熱點，漸進替換。

不要一次全面嚴格化：

- 目前引擎有大量 dynamic fields。
- 強制全面 typing 會引發巨大改動。
- 應該從 pipeline context、action handler context、talent hooks 這些高價值邊界開始。

驗收：

- 不降低開發速度。
- 不要求一次列出所有 player dynamic fields。
- build/test green。

### Phase 5: System Debug Controls

狀態：已完成初版。

目標：

提供開發時快速停用/觀察 system 的能力。

目前形式：

```txt
?disableSystem=zones,projectiles
?disableSystem=world:zones,player:movement
?traceSystem=projectiles
?traceSystem=world:zones,player:movement
```

用途：

- 快速確認某種卡頓是否來自 projectile/zone。
- 快速 isolate 某個 boss mechanic 的問題。
- 幫 AI/人類維護者縮短 debug 時間。

風險：

- 不應該在正式 gameplay 路徑被誤開。
- disable system 會破壞遊戲行為，只能當 debug feature。
- 必須清楚標示非正常模式。

驗收：

- 只在 dev/perf/debug query 啟用。
- 正常遊玩不受影響。
- full test green。

可與 profiling 摘要一起使用：

```txt
?traceSystem=projectiles&perf=1
```

### Phase 6: Move More Cross-Cutting Special Cases Into Registries

狀態：進行中。

目標：

減少中央檔案裡的角色/Boss 特例。

已完成：

- HUD self-alert registry：`hud/selfAlerts/*` 可新增自我警示，不再直接擴張 `hud.js` 的 self-alert 分支。
- HUD resource-bar registry：`hud/resourceBars/*` 可新增角色專屬資源條，怒氣/劍氣不再直接寫在 `hud.js` 的更新分支。

候選：

- HUD 特例 marker
- boss visual markers
- item/potion UI mapping
- talent lifecycle hooks 的殘留分支
- status effect 特例資料化

判斷標準：

- 如果新增角色/Boss 常常需要回頭改同一個中央檔案，就值得 registry 化。
- 如果某特例只出現一次且很穩定，不一定急著抽象。

驗收：

- 新增角色/Boss/action 時，中央檔案改動減少。
- 測試覆蓋 registry 是否漏接。

## 5. Non-Goals

### 5.1 Do Not Rewrite All Entities As Classes

暫不做：

```ts
state.projectiles = [new Projectile()]
state.zones = [new Zone()]
```

原因：

- snapshot 不會傳 method/prototype。
- joiner 收到的是 plain object。
- prediction/render 目前依賴 plain snapshot data。
- 大改會觸及大量 action handler、renderer、tests。

允許：

- renderer local-only object
- system object `{ id, tick }`
- character/Boss runtime hooks
- factory helpers

### 5.2 Do Not Over-Engineer ECS

目前不需要完整 ECS framework：

- 不需要 component storage rewrite。
- 不需要 entity query language。
- 不需要 archetype/chunk storage。

現階段足夠的形態是：

```ts
plain data + explicit systems + tested order
```

### 5.3 Do Not Mix Render-Only State Into Simulation

render-only random、particles、mesh state 不應該進 simulation state。

原因：

- 會干擾 determinism。
- 會膨脹 snapshot。
- 會讓 host/joiner 行為難以對齊。

## 6. Suggested Next Tasks

推薦排序：

1. Potion/item constants
2. Short documentation comments for `skip-player`
3. System profiling behind `?perf=1`
4. Type `PlayerPipelineContext.character/talent`
5. Debug switches for system isolation
6. Cross-cutting registry cleanup

如果一次只做一件，下一步建議做：

```txt
Phase 2: Centralize Gameplay Constants
```

這一步小、風險低，且可以直接防止測試和實作規格再次漂移。

## 7. Verification Checklist

每個 architecture step 完成後至少跑：

```sh
yarn build
yarn test:run
```

若改到 simulation order、movement、damage、snapshot、prediction，額外注意：

- `test/determinism.test.ts`
- `test/networkSnapshot.test.ts`
- boss-specific tests
- item / potion tests
- manual smoke test for FFA, boss mode, training mode

## 8. Current Architecture Snapshot

目前主流程：

```txt
controller logic tick
  step(state, inputs, DT)
    time freeze / state.time
    runPlayerPipeline
      PLAYER_SYSTEMS
    runWorldPipeline
      WORLD_SYSTEMS
    host broadcasts serialized snapshot

joiner receives snapshot
  prediction buffer
  local self movement prediction
  render interpolated view
```

核心原則：

```txt
simulation state: serializable data
gameplay update: systems
specific behavior: character/boss/action/talent hooks
render-only state: renderer/vfx layer
network: snapshot manifest
```
