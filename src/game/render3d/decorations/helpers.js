// 裝飾道具共用工具：頂點噪聲 / 垂直漸層色 / 樹冠團塊 / 外環散佈 / InstancedMesh 淡出 / 疊鼓柱。
// 這些是「無狀態」幾何工具，供 props/* 的 builder 與各 boss 專屬 builder 複用。
//
// 座標慣例：所有 builder 在「場景座標」運作 (X 右、Y 上、Z 朝鏡頭)，原點 = 競技場中心。

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { ARENA } from '../../constants.js';

// 平滑值噪 (多頻正弦疊加，~[-1,1])：給頂點位移用，比純亂數圓滑、像自然起伏。
export function lumpNoise(x, y, z) {
  return (
    Math.sin(x * 0.11 + y * 0.13) +
    Math.sin(y * 0.17 + z * 0.09 + 1.3) +
    Math.sin(z * 0.15 + x * 0.07 + 2.1) +
    0.5 * Math.sin(x * 0.31 + z * 0.27 + 4.2)
  ) / 3.5;
}

// 沿法線擾動頂點，讓「方塊/多面體」變成風化有機形。先 weld 避免接縫裂開。
export function noisify(geo, amp) {
  let g = mergeVertices(geo);
  g.computeVertexNormals();
  const pos = g.attributes.position, nor = g.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const xv = pos.getX(i), yv = pos.getY(i), zv = pos.getZ(i);
    const d = amp * lumpNoise(xv, yv, zv);
    pos.setXYZ(i, xv + nor.getX(i) * d, yv + nor.getY(i) * d, zv + nor.getZ(i) * d);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

// 烘焙垂直漸層頂點色：底部暗、頂部亮 (陽光照樹冠/灌木的層次感，免額外貼圖)。
export function bakeVerticalColor(geo, botHex, topHex) {
  const pos = geo.attributes.position;
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); if (y < minY) minY = y; if (y > maxY) maxY = y; }
  const span = Math.max(1, maxY - minY);
  const bot = new THREE.Color(botHex), top = new THREE.Color(topHex), tmp = new THREE.Color();
  const arr = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) - minY) / span;
    tmp.copy(bot).lerp(top, t * t);
    arr[i * 3] = tmp.r; arr[i * 3 + 1] = tmp.g; arr[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

// 樹冠團塊：數顆偏移 icosphere 各自噪聲後融合 → 蓬鬆不規則樹冠 (取代圓錐)。
export function canopyClump() {
  const blobs = [
    [0, 20, 0, 48], [28, 8, 10, 36], [-24, 4, -12, 34], [8, -4, 26, 30], [-10, 0, -28, 28], [16, 14, -18, 26],
  ];
  const parts = [];
  for (const [ox, oy, oz, r] of blobs) {
    let b = new THREE.IcosahedronGeometry(r, 1);
    b = noisify(b, r * 0.24);
    b.scale(1, 0.82, 1);
    b.translate(ox, oy, oz);
    parts.push(b);
  }
  return mergeGeometries(parts, false);
}

// 在競技場「外環」散佈：保證 inner > arena 邊界，避免遮擋玩家。
export function scatterPositions(count, opts = {}) {
  const halfW = ARENA.width / 2;
  const halfH = ARENA.height / 2;
  const innerR = opts.inner || Math.max(halfW, halfH) * 1.05;
  const outerR = opts.outer || Math.max(halfW, halfH) * 1.7;
  const pts = [];
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = innerR + Math.random() * (outerR - innerR);
    pts.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, ang: Math.random() * Math.PI * 2, scale: 0.85 + Math.random() * 0.5 });
  }
  return pts;
}

// 為 InstancedMesh 注入 aFade attribute + shader 修改：實現 per-instance 透明度。
export function attachFade(im, mat, count) {
  const fadeArr = new Float32Array(count);
  for (let i = 0; i < count; i++) fadeArr[i] = 1;
  const fadeAttr = new THREE.InstancedBufferAttribute(fadeArr, 1);
  im.geometry.setAttribute('aFade', fadeAttr);
  mat.transparent = true;
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = 'attribute float aFade;\nvarying float vFade;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvFade = aFade;'
    );
    shader.fragmentShader = 'varying float vFade;\n' + shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      'diffuseColor.a *= vFade;\n#include <opaque_fragment>'
    );
  };
  mat.needsUpdate = true;
  im.userData.fadeAttr = fadeAttr;
}

// 由散佈點建立 InstancedMesh (含 per-instance 淡出)。positions 來自 scatterPositions。
export function makeInstanced(geo, mat, positions, baseScale = 1) {
  const im = new THREE.InstancedMesh(geo, mat, positions.length);
  im.castShadow = true;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i];
    dummy.position.set(p.x, 0, p.z);
    dummy.rotation.y = p.ang;
    dummy.scale.setScalar(baseScale * p.scale);
    dummy.updateMatrix();
    im.setMatrixAt(i, dummy.matrix);
  }
  im.instanceMatrix.needsUpdate = true;
  attachFade(im, mat, positions.length);
  im.userData.positions = positions;
  return im;
}

// 疊鼓式古石柱：數段石鼓相疊 (圓潤、像真石柱，非錐形薄板)。用於 ruins / temple。
export function drumColumn(stone, drums, rad = 15, drumH = 34) {
  const c = new THREE.Group();
  for (let i = 0; i < drums; i++) {
    let g = new THREE.CylinderGeometry(rad * 0.9, rad, drumH, 10, 1);
    g.translate(0, drumH / 2 + i * (drumH - 2), 0);
    g = noisify(g, 2.5);
    const m = new THREE.Mesh(g, stone); m.castShadow = true; m.receiveShadow = true;
    c.add(m);
  }
  c.userData.top = drums * (drumH - 2);
  return c;
}

// 苔蘚塊：壓扁的噪聲 icosphere，疊在石柱/橫樑頂當苔蘚。
export function mossSlab(moss, rad) {
  const m = new THREE.Mesh(noisify(new THREE.IcosahedronGeometry(rad, 1), rad * 0.3), moss);
  m.scale.set(1.1, 0.45, 1.1);
  return m;
}
