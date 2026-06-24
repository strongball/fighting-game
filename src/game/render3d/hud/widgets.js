// HUD widget registry（疊加式擴充點）。
//
// 動機：render3d/hud.js 的 update() 是 churn 熱點——每個人加自己的指示器/警示都改同一個
// 大函式。本 registry 提供「加一個檔、零改動 hud.js 核心」的擴充路徑（仿 VFX）：
// 在 hud/widgets/<name>.js 內 registerHudWidget({...})，hud.js 會自動掛載並每幀更新。
//
// widget 形狀：
//   {
//     id: string,
//     mount(ctx) -> handle      // 建立自己的 DOM；ctx = { layer, scene, camera, stage, hooks, isMobile }
//     update(handle, ctx)       // 每幀更新；ctx = { state, selfId, self, players, isBossMode, dom }
//   }
// handle 由 mount 回傳、原樣傳回 update（持有自己的 DOM 參考），各 widget 狀態自成一格。

const WIDGETS = [];

export function registerHudWidget(def) {
  if (def && def.id && typeof def.update === 'function') WIDGETS.push(def);
}

export function getHudWidgets() {
  return WIDGETS;
}
