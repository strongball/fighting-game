// 場景裝飾系統（入口）：依 boss theme 組裝競技場道具 + 中央地刻。
//
// 架構：
//   ./decorations/helpers.js   幾何/instancing 共用工具
//   ./decorations/floor.js     中央地刻圖案 (法陣/裂縫/符文…)
//   ./decorations/props/*.js   道具 builder (nature / stone / fx)，每個收 theme 回傳 Object3D
//   本檔                       開放式註冊表 (registerProp) + applyDecorations / updateDecorationFade
//
// 擴充方式（詳見 ./decorations/README.md）：
//   - 新增「共用」道具：在 props/* 寫 builder，於下方 registerProp 登記一行。
//   - 新增「boss 專屬」道具：在該 boss 的 arena.ts 寫 builder，放進 theme.props = { kind: builder }，
//     免改本檔（applyDecorations 會優先採用 theme.props[kind]）。

import { buildFloorDecal } from './decorations/floor.js';
import { buildTrees, buildRoots, buildFoliage, buildGroundcover } from './decorations/props/nature.js';
import { buildRocks, buildPillars, buildRuins, buildTemple } from './decorations/props/stone.js';
import { buildCrystals, buildBraziers, buildLightShafts } from './decorations/props/fx.js';

// 供各 boss 專屬 builder 一處 import 共用工具與地刻產生器。
export * from './decorations/helpers.js';
export { makeFloorPattern, buildFloorDecal } from './decorations/floor.js';

// ---- 開放式道具註冊表：kind -> builder(theme) => THREE.Object3D ----
const PROPS = {};
/** 登記一個共用道具 builder（供未來新道具或外部模組擴充）。 */
export function registerProp(kind, builder) { PROPS[kind] = builder; }
export function getProp(kind) { return PROPS[kind] || null; }

// 內建共用道具
registerProp('tree', buildTrees);
registerProp('rock', buildRocks);
registerProp('crystal', buildCrystals);
registerProp('pillar', buildPillars);
registerProp('brazier', buildBraziers);
registerProp('ruins', buildRuins);
registerProp('temple', buildTemple);
registerProp('roots', buildRoots);
registerProp('foliage', buildFoliage);
registerProp('godrays', buildLightShafts);
registerProp('groundcover', buildGroundcover);

// 釋放材質「及其貼圖」。Three.js 的 material.dispose() 不會連帶釋放貼圖，必須逐張 dispose，
// 否則每關程序生成的 CanvasTexture（祭壇盤、符文地刻…各 1024²）會永久佔住 GPU 記憶體，
// 換關累積且永不回收 → 手機越往後關卡越卡、連沒貼皮的關卡也回不來。
// 跨關共用的快取貼圖（userData.shared）不可釋放，否則下一關該裝飾變黑。
const TEX_SLOTS = ['map', 'emissiveMap', 'roughnessMap', 'metalnessMap', 'normalMap', 'bumpMap', 'alphaMap', 'aoMap', 'displacementMap', 'lightMap', 'specularMap'];
function disposeMaterial(m) {
  if (!m) return;
  const seen = new Set();
  for (const slot of TEX_SLOTS) {
    const t = m[slot];
    if (t && t.isTexture && !seen.has(t)) {
      seen.add(t);
      if (!t.userData || !t.userData.shared) t.dispose();
    }
  }
  m.dispose?.();
}

// 依 theme.decorations 組裝裝飾，並建立中央地刻。會先清掉舊的 (換關時)。
export function applyDecorations(themeGroup, theme) {
  for (let i = themeGroup.children.length - 1; i >= 0; i--) {
    const c = themeGroup.children[i];
    if (c.userData.isDecoration) {
      themeGroup.remove(c);
      if (c.geometry) c.geometry.dispose?.();
      if (c.material) (Array.isArray(c.material) ? c.material : [c.material]).forEach(disposeMaterial);
      if (c.isInstancedMesh) c.dispose?.();   // 釋放 instanceMatrix 緩衝（geometry.dispose 不含）
      if (c.isGroup) c.traverse((o) => {
        if (o.geometry) o.geometry.dispose?.();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(disposeMaterial);
        if (o.isInstancedMesh) o.dispose?.();
      });
    }
  }
  const decoMeshes = [];
  themeGroup.userData.shafts = null;
  const decos = (theme && theme.decorations) || [];
  const custom = (theme && theme.props) || null;   // boss 專屬 builder（覆蓋全域註冊表）
  for (const kind of decos) {
    const builder = (custom && custom[kind]) || PROPS[kind];
    if (!builder) continue;
    const obj = builder(theme);
    obj.userData.isDecoration = true;
    themeGroup.add(obj);
    decoMeshes.push(obj);
    if (kind === 'godrays') themeGroup.userData.shafts = obj;  // 供每幀閃爍/自轉
  }
  // 中央地刻
  const decal = buildFloorDecal(theme || {});
  if (decal) themeGroup.add(decal);
  themeGroup.userData.decoMeshes = decoMeshes;
  themeGroup.userData.decal = decal || null;
  themeGroup.userData._t = 0;
}

// 每幀更新：地刻呼吸發光 / 神殿光束閃爍自轉 / 裝飾被視線阻擋時平滑淡出。
export function updateDecorationFade(themeGroup, focus, dt) {
  themeGroup.userData._t = (themeGroup.userData._t || 0) + dt;
  const t = themeGroup.userData._t;
  // 符文法陣呼吸發光
  const decal = themeGroup.userData.decal;
  if (decal && decal.userData.pulse) {
    const base = decal.userData.glowBase;
    decal.userData.decalMat.emissiveIntensity =
      base * (1 + decal.userData.pulse * 0.55 * Math.sin(t * 1.7));
  }
  // 神殿光束：微閃爍 + 緩慢自轉
  const shafts = themeGroup.userData.shafts;
  if (shafts) {
    for (const m of shafts.children) {
      const u = m.userData;
      m.material.opacity = u.baseOp * (0.62 + 0.38 * Math.sin(t * 0.7 + u.phase));
      m.rotation.y += u.spin * dt;
    }
  }
  const meshes = themeGroup.userData.decoMeshes;
  if (!meshes || !focus) return;
  const lerpK = Math.min(1, dt * 8);
  for (const node of meshes) {
    const targets = node.isGroup ? node.children : [node];
    for (const im of targets) {
      const positions = im.userData?.positions || node.userData?.positions;
      const fadeAttr = im.userData?.fadeAttr;
      if (!positions || !fadeAttr) continue;
      for (let i = 0; i < positions.length; i++) {
        const p = positions[i];
        // 物件在玩家「鏡頭側」的小區域內 (xz 接近、z 略大代表更靠相機)
        const dx = p.x - focus.x, dz = p.z - focus.z;
        const dist = Math.hypot(dx, dz);
        const inFront = dz > -20;            // 物件在玩家或更靠近相機那一側
        const blocked = inFront && dist < 100;
        const target = blocked ? 0.18 : 1.0;
        const cur = fadeAttr.getX(i);
        fadeAttr.setX(i, cur + (target - cur) * lerpK);
      }
      fadeAttr.needsUpdate = true;
    }
  }
}
