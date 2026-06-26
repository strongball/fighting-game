// 植被類道具：tree (古樹/圓錐樹) / roots (盤根) / foliage (地被灌木) / groundcover (青苔地被)。
// 每個 builder 收 theme、讀 theme.<kind> 設定，回傳一個 THREE.Object3D。

import * as THREE from 'three';
import { ARENA } from '../../../constants.js';
import { noisify, bakeVerticalColor, canopyClump, scatterPositions, makeInstanced } from '../helpers.js';

// 樹：cfg.big → 古樹 (噪聲粗幹 + 板根 + 團塊樹冠)；否則 圓錐樹 (低成本)。
export function buildTrees(theme) {
  const cfg = theme.tree || {};
  const positions = scatterPositions(cfg.count || 26);
  const group = new THREE.Group();
  const big = !!cfg.big;
  const trunkMat = new THREE.MeshStandardMaterial({ color: cfg.trunk || 0x5a3a26, roughness: 0.95 });
  if (big) {
    // 古樹：噪聲粗幹 + 板根外擴 + 蓬鬆團塊樹冠 (頂點漸層色)
    const trunkH = cfg.trunkH || 168;
    let trunk = new THREE.CylinderGeometry(11, 19, trunkH, 9, 3);
    trunk.translate(0, trunkH / 2, 0);
    trunk = noisify(trunk, 5);
    group.add(makeInstanced(trunk, trunkMat, positions, 1.1));
    let flare = new THREE.CylinderGeometry(19, 36, 30, 9);
    flare.translate(0, 14, 0);
    flare = noisify(flare, 6);
    group.add(makeInstanced(flare, trunkMat, positions, 1.1));
    const canopy = canopyClump();
    bakeVerticalColor(canopy, cfg.leaf || 0x2f5524, cfg.leafTop || 0x6fae3e);
    canopy.translate(0, trunkH + 28, 0);
    const canMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
    group.add(makeInstanced(canopy, canMat, positions, 1.1));
  } else {
    const crownMat = new THREE.MeshStandardMaterial({ color: cfg.leaf || 0x3d6b32, roughness: 0.95 });
    const trunkGeo = new THREE.CylinderGeometry(6, 9, 80, 6);
    trunkGeo.translate(0, 40, 0);
    group.add(makeInstanced(trunkGeo, trunkMat, positions));
    const crownGeo = new THREE.ConeGeometry(36, 90, 8);
    crownGeo.translate(0, 110, 0);
    group.add(makeInstanced(crownGeo, crownMat, positions));
  }
  group.userData.positions = positions;
  return group;
}

// 巨大盤根：半埋入地面的拱形樹根 (torus 弧段豎立)，散在外環貼近古樹。
export function buildRoots(theme) {
  const cfg = theme.roots || {};
  const mat = new THREE.MeshStandardMaterial({ color: cfg.color || 0x36271a, roughness: 1.0 });
  const count = cfg.count || 12;
  const halfMax = Math.max(ARENA.width, ARENA.height) / 2;
  const innerR = halfMax * 1.0, outerR = halfMax * 1.32;
  const group = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = innerR + Math.random() * (outerR - innerR);
    const x0 = Math.cos(a) * r, z0 = Math.sin(a) * r;
    const rad = 42 + Math.random() * 70;
    const tube = 6 + Math.random() * 8;
    const arc = Math.PI * (0.7 + Math.random() * 0.6);
    const geo = new THREE.TorusGeometry(rad, tube, 6, 16, arc);
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true; m.receiveShadow = true;
    m.position.set(x0, -rad * 0.12, z0);            // 略沉入地，像鑽出地面
    m.rotation.x = Math.PI / 2 + (Math.random() - 0.5) * 0.5; // 豎成拱
    m.rotation.z = Math.random() * Math.PI * 2;
    m.scale.set(1, 1, 0.55 + Math.random() * 0.7);
    group.add(m);
  }
  return group;
}

// 地被灌木：低矮有機團塊，跨越場邊把地面與樹林銜接 (帶頂點漸層色)。
export function buildFoliage(theme) {
  const cfg = theme.foliage || {};
  const count = cfg.count || 26;
  const halfMax = Math.max(ARENA.width, ARENA.height) / 2;
  const innerR = halfMax * 0.94, outerR = halfMax * 1.26;
  let bush = new THREE.IcosahedronGeometry(20, 1);
  bush = noisify(bush, 8);
  bush.scale(1.35, 0.62, 1.35);
  bush.translate(0, 8, 0);
  bakeVerticalColor(bush, cfg.low || 0x2f4f1c, cfg.high || 0x5f8a30);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1.0 });
  const positions = [];
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = innerR + Math.random() * (outerR - innerR);
    positions.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, ang: Math.random() * Math.PI * 2, scale: 0.6 + Math.random() * 1.0 });
  }
  return makeInstanced(bush, mat, positions);
}

// 苔斑貼圖：多顆綠色柔邊圓疊加，邊緣破碎自然 (快取)。
let _mossTex = null;
function mossSplotchTexture() {
  if (_mossTex) return _mossTex;
  const S = 128; const c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  const greens = ['60,96,40', '78,118,52', '46,78,34', '92,130,58'];
  for (let i = 0; i < 24; i++) {
    const px = S / 2 + (Math.random() - 0.5) * 64, py = S / 2 + (Math.random() - 0.5) * 64, r = 14 + Math.random() * 34;
    const col = greens[(Math.random() * greens.length) | 0];
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, `rgba(${col},0.55)`); g.addColorStop(1, `rgba(${col},0)`);
    x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; _mossTex = t; return t;
}

// 青苔地被：法陣外環的平鋪苔斑 (貼地) + 立體苔蕨叢，營造被叢林吞沒感。
export function buildGroundcover(theme) {
  const cfg = theme.groundcover || {};
  const group = new THREE.Group();
  const rInner = cfg.rInner || 360, rOuter = cfg.rOuter || 820;
  // 平鋪苔斑 (InstancedMesh，貼地，不投影/不淡出)
  const splotches = cfg.splotches || 26;
  const sgeo = new THREE.PlaneGeometry(1, 1);
  const smat = new THREE.MeshStandardMaterial({ map: mossSplotchTexture(), transparent: true, opacity: 0.72, depthWrite: false, roughness: 1.0 });
  const sim = new THREE.InstancedMesh(sgeo, smat, splotches);
  sim.renderOrder = 2;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < splotches; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = rInner + Math.random() * (rOuter - rInner);
    const sz = 70 + Math.random() * 150;
    dummy.position.set(Math.cos(a) * r, 0.6 + Math.random() * 0.3, Math.sin(a) * r);
    dummy.rotation.set(-Math.PI / 2, 0, Math.random() * Math.PI * 2);
    dummy.scale.set(sz, sz, 1);
    dummy.updateMatrix();
    sim.setMatrixAt(i, dummy.matrix);
  }
  sim.instanceMatrix.needsUpdate = true;
  group.add(sim);
  // 立體苔蕨叢 (低矮團塊，環邊散佈，帶頂點漸層色)
  const tufts = cfg.tufts || 16;
  let tuft = new THREE.IcosahedronGeometry(12, 1);
  tuft = noisify(tuft, 5);
  tuft.scale(1.5, 0.7, 1.5);
  tuft.translate(0, 5, 0);
  bakeVerticalColor(tuft, cfg.low || 0x2c4a1a, cfg.high || 0x5f8a30);
  const tmat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1.0 });
  const positions = [];
  for (let i = 0; i < tufts; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = rOuter * (0.66 + Math.random() * 0.4);
    positions.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, ang: Math.random() * Math.PI * 2, scale: 0.6 + Math.random() * 0.9 });
  }
  group.add(makeInstanced(tuft, tmat, positions));
  return group;
}
