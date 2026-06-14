// GLB 角色皮膚載入管線（選用，找不到檔案就安全回退到 models.js 的程序化模型）。
//
// === 如何加入皮膚 ===
// 1. 取得一個 rigged glTF 角色（含 idle / walk / attack / hit 動畫最佳）。
//    免費 CC0 來源建議：
//      - Quaternius  https://quaternius.com  （Universal Animation Library / RPG Characters，已綁骨含多段動畫）
//      - Kenney      https://kenney.nl/assets （Mini Characters / Blocky Characters）
//      - Mixamo      https://mixamo.com       （自動綁骨 + 動畫，匯出 glTF Binary）
// 2. 匯出成 .glb，放到：public/assets/characters/models/<名稱>.glb
//    對應檔名見下方 CHAR_FILES（warrior.glb / mage.glb / ... / fighter.glb）。
// 3. 皮膚會自動依 bounding box 縮放對齊碰撞大小並貼地；若朝向不對調整 OVERRIDES 的 rotationY
//    (需要時也可加 scaleMul 微調視覺大小 / yOffset 微調高度)。
//
// 沒有放任何 .glb 時，本管線的 prepareSkin() 會因 404 回傳 null，遊戲照常使用程序化模型。

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { PLAYER_RADIUS } from '../constants.js';

// 皮膚自動縮放：俯視 footprint (長/寬取大者) 對齊到碰撞直徑的倍率。
// 1.0 = 完全貼合碰撞圈；>1 = 視覺略大於碰撞 (較有體積感)。
const FOOTPRINT_FILL = 6;

const asset = (path) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
const modelUrl = (file) => asset(`gltf_source/${file}`);

// charId -> 檔名（與 public/assets/characters 既有命名一致）
const CHAR_FILES = [
  'Bull',        // 0: warrior
  'Fox',         // 1: mage
  'Wolf',        // 2: assassin
  'Horse',       // 3: tank
  'Deer',        // 4: archer
  'Alpaca',      // 5: healer
  'Stag',        // 6: berserker
  'Husky',       // 7: ninja
  'Horse_White', // 8: elementalist
  'ShibaInu',    // 9: fighter
];

// charId -> 檔案格式 (.glb 或 .gltf)；未指定則預設 .glb
const CHAR_FORMATS = {
  0: 'gltf', // warrior → Bull
  1: 'gltf', // mage → Fox
  2: 'gltf', // assassin → Wolf
  3: 'gltf', // tank → Horse
  4: 'gltf', // archer → Deer
  5: 'gltf', // healer → Alpaca
  6: 'gltf', // berserker → Stag
  7: 'gltf', // ninja → Husky
  8: 'gltf', // elementalist → Horse_White
  9: 'gltf', // fighter → ShibaInu
};

// 各動作的候選 clip 名稱（不同來源命名不一，依序比對，先精確再模糊包含）。
const DEFAULT_CLIPS = {
  idle: ['Idle', 'idle', 'Idle_Neutral', 'CharacterArmature|Idle', 'Armature|Idle', 'mixamo.com'],
  walk: ['Walk', 'walk', 'Walking', 'Run', 'run', 'CharacterArmature|Walk', 'Armature|Walk'],
  attack: ['Attack', 'attack', 'Punch', 'Slash', 'Sword', 'Cast', 'Spellcast', 'CharacterArmature|Attack', 'Armature|Attack'],
  hit: ['Hit', 'hit', 'HitRecieve', 'HitReceive', 'HitReact', 'Damage', 'Death', 'CharacterArmature|Hit'],
};

// 每角色覆寫：皮膚會依 bounding box 自動縮放對齊碰撞大小並貼地，
// 因此這裡通常只需設 rotationY (朝向)；如需再微調可加 scaleMul / yOffset。
const DEFAULT_CFG = { scaleMul: 1, yOffset: 0, rotationY: Math.PI / 2 };
const OVERRIDES = {
  // 例：3: { scaleMul: 1.1 },           // 坦克視覺再放大一點
  // 例：1: { rotationY: -Math.PI / 2 },  // 朝向相反時翻轉
  // 例：3: { yOffset: 1 },              // 略微抬高避免陥地
};

export function getSkinConfig(charId) {
  const file = CHAR_FILES[charId];
  if (!file) return null;
  const format = CHAR_FORMATS[charId] || 'glb';
  return {
    url: modelUrl(`${file}.${format}`),
    clips: DEFAULT_CLIPS,
    ...DEFAULT_CFG,
    ...(OVERRIDES[charId] || {}),
  };
}

const loader = new GLTFLoader();
const cache = new Map(); // charId -> Promise<Template|null>

// 載入並快取 gltf 模板（共用 geometry，逐實例再 clone 骨架）。無檔/失敗回 null。
export function prepareSkin(charId) {
  if (cache.has(charId)) return cache.get(charId);
  // const cfg = getSkinConfig(charId);
  const cfg = undefined;
  if (!cfg) { const p = Promise.resolve(null); cache.set(charId, p); return p; }
  const p = loader.loadAsync(cfg.url)
    .then((gltf) => ({ scene: gltf.scene, animations: gltf.animations || [], cfg }))
    .catch(() => null); // 404 / 解析失敗 → 回退程序化
  cache.set(charId, p);
  return p;
}

function pickClip(animations, names) {
  if (!animations.length) return null;
  for (const n of names) {
    const c = animations.find((a) => a.name === n);
    if (c) return c;
  }
  for (const n of names) {
    const low = n.toLowerCase();
    const c = animations.find((a) => a.name.toLowerCase().includes(low));
    if (c) return c;
  }
  return null;
}

// 由模板複製出可獨立播放動畫的實例：{ root, mixer, actions, cfg }
export function instantiateSkin(template) {
  if (!template) return null;
  const cfg = template.cfg;
  const root = cloneSkinned(template.scene);
  root.rotation.y = cfg.rotationY || 0;

  // ---- 自動縮放：量測 bounding box，把俯視 footprint 對齊碰撞直徑 ----
  // 換任何皮膚都會自動對齊碰撞大小 (PLAYER_RADIUS)，不需每角色手調 scale。
  // 於 bind-pose 量測 (動畫未播放)，尺寸穩定。
  root.scale.setScalar(1);
  root.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
  const footprint = Math.max(size.x, size.z) || 1;       // 俯視佔地 (長/寬取大者)
  const target = PLAYER_RADIUS * 2 * FOOTPRINT_FILL;     // 目標直徑
  root.scale.setScalar((target / footprint) * (cfg.scaleMul || 1));

  // ---- 自動貼地：縮放後重新量測，把模型最低點對齊地面 (y = yOffset，預設 0) ----
  root.position.y = 0;
  root.updateMatrixWorld(true);
  const minY = new THREE.Box3().setFromObject(root).min.y;
  root.position.y = (cfg.yOffset || 0) - minY;

  // 逐實例 clone 材質（避免隱身淡出影響到共用同模型的其他玩家）
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.frustumCulled = false; // 骨架動畫會移動包圍盒，關閉視錐裁切避免閃失
    if (Array.isArray(o.material)) o.material = o.material.map((m) => m.clone());
    else if (o.material) o.material = o.material.clone();
  });

  const mixer = new THREE.AnimationMixer(root);
  const actions = {};
  for (const key of ['idle', 'walk', 'attack', 'hit']) {
    const clip = pickClip(template.animations, cfg.clips[key] || []);
    if (!clip) continue;
    const act = mixer.clipAction(clip);
    if (key === 'attack' || key === 'hit') {
      act.setLoop(THREE.LoopOnce, 1);
      act.clampWhenFinished = true;
    }
    actions[key] = act;
  }
  return { root, mixer, actions, cfg };
}
