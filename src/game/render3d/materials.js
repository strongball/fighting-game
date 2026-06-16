// 程序化模型的材質與貼圖工具（自 models.js 拆出）。
//
// 純函式：僅依賴 three 與角色貼圖繪製器。canvas 程序貼圖以 _texCache 快取避免重複建立。
// 注意：panelTexture / createHumanoidTexture 會用到 document(canvas)，僅在瀏覽器/渲染端呼叫。
import * as THREE from 'three';
import { getCharacterTexturePainter } from '../characters/render3d.ts';

// 顏色提亮(f>0)/壓暗(f<0)。
export function shade(hex, f) {
  const c = new THREE.Color(hex);
  if (f >= 0) c.lerp(new THREE.Color(0xffffff), f);
  else c.lerp(new THREE.Color(0x000000), -f);
  return c;
}

// 標準 PBR 材質工廠（roughness/metalness/emissive/envMapIntensity 可調，預設值見參數）。
export function mat(color, opt = {}) {
  return new THREE.MeshStandardMaterial({
    color, roughness: opt.rough ?? 0.6, metalness: opt.metal ?? 0.15,
    emissive: opt.emissive ?? 0x000000, emissiveIntensity: opt.ei ?? 1,
    envMapIntensity: opt.env ?? 0.9,
    map: opt.map ?? null,
    transparent: true, opacity: 1,
  });
}

// ---- 程序化後備皮膚：質感 (布/金屬/皮革/肌膚) 貼圖 ----
// 以 canvas 程序生成表面貼圖（依識別色 + 質感樣式），快取避免重複建立。
const _texCache = new Map();

export function panelTexture(baseHex, kind) {
  const key = `${kind}:${baseHex}`;
  if (_texCache.has(key)) return _texCache.get(key);
  const S = 128;
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const x = cv.getContext('2d');
  const col = new THREE.Color(baseHex);
  const hex = (c) => `#${c.getHexString()}`;
  x.fillStyle = hex(col); x.fillRect(0, 0, S, S);
  const darker = col.clone().multiplyScalar(0.7);
  if (kind === 'metal') {
    for (let i = 0; i < 90; i++) {
      x.strokeStyle = `rgba(255,255,255,${0.02 + Math.random() * 0.05})`;
      const px = Math.random() * S;
      x.beginPath(); x.moveTo(px, 0); x.lineTo(px + (Math.random() - 0.5) * 6, S); x.stroke();
    }
    x.fillStyle = hex(darker);
    for (const [rx, ry] of [[18, 18], [110, 18], [18, 110], [110, 110], [64, 64]]) { x.beginPath(); x.arc(rx, ry, 4, 0, 7); x.fill(); }
  } else if (kind === 'cloth') {
    x.strokeStyle = 'rgba(0,0,0,0.10)';
    for (let i = 0; i < S; i += 6) { x.beginPath(); x.moveTo(0, i); x.lineTo(S, i); x.stroke(); x.beginPath(); x.moveTo(i, 0); x.lineTo(i, S); x.stroke(); }
    x.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 60; i++) x.fillRect(Math.random() * S, Math.random() * S, 2, 2);
  } else if (kind === 'leather') {
    x.fillStyle = hex(darker);
    for (let i = 0; i < 200; i++) { x.globalAlpha = 0.05 + Math.random() * 0.08; x.beginPath(); x.arc(Math.random() * S, Math.random() * S, 1 + Math.random() * 2, 0, 7); x.fill(); }
    x.globalAlpha = 1;
    x.strokeStyle = 'rgba(255,255,255,0.10)'; x.setLineDash([4, 4]);
    x.strokeRect(10, 10, S - 20, S - 20); x.setLineDash([]);
  } else { // skin
    for (let i = 0; i < 120; i++) { x.fillStyle = `rgba(255,255,255,${0.02 + Math.random() * 0.04})`; x.fillRect(Math.random() * S, Math.random() * S, 2, 2); }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  _texCache.set(key, tex);
  return tex;
}

// 動態繪製具有職業特色的 Canvas 材質貼圖（512px，套用角色專屬 painter）。
export function createHumanoidTexture(charId, baseHex) {
  const key = `humanoid:${charId}:${baseHex}`;
  if (_texCache.has(key)) return _texCache.get(key);

  const S = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const x = cv.getContext('2d');
  const col = new THREE.Color(baseHex);
  const hex = (c) => `#${c.getHexString()}`;

  const grad = x.createLinearGradient(0, 0, 0, S);
  grad.addColorStop(0, hex(col.clone().lerp(new THREE.Color(0xffffff), 0.25)));
  grad.addColorStop(0.5, hex(col));
  grad.addColorStop(1, hex(col.clone().multiplyScalar(0.4)));
  x.fillStyle = grad;
  x.fillRect(0, 0, S, S);

  x.lineWidth = 4;
  const paint = getCharacterTexturePainter(charId);
  if (paint) paint(x, S);

  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  _texCache.set(key, tex);
  return tex;
}
