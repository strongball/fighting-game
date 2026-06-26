// 發光/大氣類道具：crystal (發光晶體) / brazier (火盆) / godrays (神殿光束)。
// godrays 由 updateDecorationFade 每幀做閃爍/自轉 (透過 themeGroup.userData.shafts)。

import * as THREE from 'three';
import { ARENA } from '../../../constants.js';
import { scatterPositions, makeInstanced } from '../helpers.js';

// 發光晶體：高瘦多面體 + emissive。
export function buildCrystals(theme) {
  const cfg = theme.crystal || {};
  const positions = scatterPositions(cfg.count || 18);
  const geo = new THREE.OctahedronGeometry(28, 0);
  geo.scale(0.6, 1.5, 0.6);
  geo.translate(0, 36, 0);
  const mat = new THREE.MeshStandardMaterial({
    color: cfg.color || 0x74e0ff,
    emissive: cfg.glow || 0x49b0d0, emissiveIntensity: cfg.glowInt != null ? cfg.glowInt : 0.6,
    roughness: 0.2, metalness: 0.1, opacity: 0.85,
  });
  return makeInstanced(geo, mat, positions);
}

// 火盆：石座 + 發光火焰塊。
export function buildBraziers(theme) {
  const cfg = theme.brazier || {};
  const positions = scatterPositions(cfg.count || 8, { inner: Math.max(ARENA.width, ARENA.height) / 2 * 1.06, outer: Math.max(ARENA.width, ARENA.height) / 2 * 1.3 });
  const group = new THREE.Group();
  const baseGeo = new THREE.CylinderGeometry(12, 16, 30, 8);
  baseGeo.translate(0, 15, 0);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x3b2a20, roughness: 0.9, metalness: 0.4 });
  group.add(makeInstanced(baseGeo, baseMat, positions));
  const flameGeo = new THREE.IcosahedronGeometry(10, 1);
  flameGeo.translate(0, 38, 0);
  const flameMat = new THREE.MeshStandardMaterial({
    color: cfg.flame || 0xff7a3d, emissive: cfg.flameGlow || 0xff5a1f, emissiveIntensity: 2.4,
    opacity: 0.95,
  });
  group.add(makeInstanced(flameGeo, flameMat, positions));
  group.userData.positions = positions;
  return group;
}

// 光束貼圖：垂直亮帶 (頂端入光最亮、向下淡出) + 左右柔邊，給加法混色光柱用 (快取)。
let _shaftTex = null;
function shaftTexture() {
  if (_shaftTex) return _shaftTex;
  const W = 32, H = 128;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0.0, 'rgba(255,255,255,0)');
  g.addColorStop(0.12, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.34)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const gx = x.createLinearGradient(0, 0, W, 0);   // 左右淡出遮罩
  gx.addColorStop(0, 'rgba(0,0,0,0)'); gx.addColorStop(0.5, 'rgba(0,0,0,1)'); gx.addColorStop(1, 'rgba(0,0,0,0)');
  x.globalCompositeOperation = 'destination-in'; x.fillStyle = gx; x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = 'source-over';
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; _shaftTex = t; return t;
}

// 神殿光束 (god-ray)：加法混色錐柱，自樹冠灑下；微閃爍 + 緩慢自轉 (見 updateDecorationFade)。
export function buildLightShafts(theme) {
  const cfg = theme.godrays || {};
  const count = cfg.count || 6;
  const color = new THREE.Color(cfg.color || 0xcdeb9f);
  const baseOp = cfg.opacity != null ? cfg.opacity : 0.16;
  const tex = shaftTexture();
  const halfW = ARENA.width / 2, halfH = ARENA.height / 2;
  const group = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const h = 620 + Math.random() * 240;
    const rT = 14 + Math.random() * 16, rB = 60 + Math.random() * 70;
    const geo = new THREE.CylinderGeometry(rT, rB, h, 14, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      map: tex, color, transparent: true, opacity: baseOp,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false,
    });
    const m = new THREE.Mesh(geo, mat);
    let x, z;
    if (i < 3) { // 主光束：斜插入可見的法陣中央區
      x = (Math.random() - 0.5) * halfW * 0.85;
      z = -halfH * 0.2 + (Math.random() - 0.5) * halfH * 0.55;
    } else {     // 背景補光
      x = (Math.random() - 0.5) * ARENA.width;
      z = -halfH * (0.4 + Math.random() * 0.7);
    }
    m.position.set(x, h / 2 - 30, z);
    m.rotation.z = -0.17 - Math.random() * 0.07;   // 朝陽光方向傾斜 (god-ray 角度)
    m.rotation.x = 0.13 + Math.random() * 0.06;
    m.renderOrder = 6;
    m.userData.baseOp = baseOp * (0.7 + Math.random() * 0.6);
    m.userData.phase = Math.random() * Math.PI * 2;
    m.userData.spin = (Math.random() - 0.5) * 0.05;
    group.add(m);
  }
  return group;
}
