// 劇毒飛蜥場地的專屬道具（three 幾何走 .js，免型別宣告；場地資料/型別檢查留在 arena.ts）。
// 三件套對齊參考圖：中央嵌地毒池環、蛇紋石王座地標、環繞立桿火把。
//
// 座標慣例同其他 builder：場景座標（原點 = 競技場中心，X 右、Y 上、Z 朝鏡頭）。

import * as THREE from 'three';
import { noisify, drumColumn, mossSlab } from '../../render3d/decorations.js';
import { LOW_GPU } from '../../render3d/quality.js';

// 放射狀石板祭壇貼圖：同心環帶 × 放射切割的砌石板，板間留暗苔接縫 + 中央徽紋 + 風化苔斑。
// 「人造祭壇」結構，刻意有別於 R1 連續天然苔泥地（後者是整片地面 + 散裂紋）。
function daisTexture(cfg) {
  const S = 1024;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  const cx = S / 2, cy = S / 2, R = S / 2;
  const grout = cfg.grout || '#222a22';
  const tones = cfg.tones || ['#6b7164', '#5f655a', '#737a6c', '#585e52', '#666d5f'];
  const moss = cfg.moss || ['64,96,42', '78,112,52', '54,82,38'];
  // 底＝接縫色（板間縫隙透出此色）
  x.fillStyle = grout; x.beginPath(); x.arc(cx, cy, R, 0, 7); x.fill();
  const bands = [0.12, 0.30, 0.50, 0.70, 0.87, 1.0]; // 同心環帶邊界
  const radGap = 5;                                  // 徑向接縫
  for (let b = 0; b < bands.length - 1; b++) {
    const rIn = bands[b] * R + (b === 0 ? 0 : radGap);
    const rOut = bands[b + 1] * R - radGap;
    const n = 6 + b * 5;                             // 外環帶切更多塊
    const aOff = b * 0.7;
    for (let s = 0; s < n; s++) {
      const aGap = (Math.PI * 2 / n) * 0.06 + 0.012; // 切向接縫
      const a0 = (s / n) * Math.PI * 2 + aOff + aGap;
      const a1 = ((s + 1) / n) * Math.PI * 2 + aOff - aGap;
      x.beginPath();
      x.arc(cx, cy, rIn, a0, a1);
      x.arc(cx, cy, rOut, a1, a0, true);
      x.closePath();
      x.fillStyle = tones[(Math.random() * tones.length) | 0];
      x.fill();
      if (Math.random() < 0.3) { // 板上偶見苔斑
        const mc = moss[(Math.random() * moss.length) | 0];
        const am = a0 + Math.random() * (a1 - a0), rm = rIn + Math.random() * (rOut - rIn);
        x.fillStyle = `rgba(${mc},0.5)`;
        x.beginPath(); x.arc(cx + Math.cos(am) * rm, cy + Math.sin(am) * rm, 6 + Math.random() * 14, 0, 7); x.fill();
      }
    }
  }
  // 中央徽紋
  x.fillStyle = tones[0]; x.beginPath(); x.arc(cx, cy, bands[0] * R - 4, 0, 7); x.fill();
  x.strokeStyle = grout; x.lineWidth = 6; x.beginPath(); x.arc(cx, cy, bands[0] * R * 0.6, 0, 7); x.stroke();
  // 風化碎屑
  for (let i = 0; i < 3000; i++) {
    const a = Math.random() * 7, rr = Math.random() * R;
    const v = 70 + (Math.random() * 50 | 0);
    x.fillStyle = `rgba(${v},${v + 4},${v - 6},0.05)`;
    x.fillRect(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 2, 2);
  }
  // 少量跨板裂縫
  x.strokeStyle = 'rgba(20,24,20,0.5)'; x.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    x.lineWidth = 1 + Math.random() * 2;
    let a = Math.random() * 7, rr = Math.random() * R * 0.9;
    let px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
    x.beginPath(); x.moveTo(px, py);
    for (let s = 0; s < 4; s++) { const na = a + (Math.random() - 0.5) * 1.0, nr = 20 + Math.random() * 40; px += Math.cos(na) * nr; py += Math.sin(na) * nr; x.lineTo(px, py); }
    x.stroke();
  }
  // 邊緣濕暗暈影
  const vg = x.createRadialGradient(cx, cy, R * 0.6, cx, cy, R);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,16,12,0.55)');
  x.fillStyle = vg; x.beginPath(); x.arc(cx, cy, R, 0, 7); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

// 圓形石砌祭壇：放射狀拼接石板的橢圓盤，鋪在地面當競技場主體（玩家/毒池/王座皆站其上）。
export function buildDais(theme) {
  const cfg = theme.dais || {};
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(1, 72),
    new THREE.MeshStandardMaterial({ map: daisTexture(cfg), roughness: 1.0, metalness: 0.0 }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.scale.set(cfg.rx || 1080, cfg.rz || 760, 1);
  mesh.position.y = 0.45;
  mesh.receiveShadow = true;
  mesh.renderOrder = 1;
  return mesh;
}

// 中央毒池環：一圈嵌入石砌祭壇的發光毒水池 —— 沉陷石緣 + 噪聲液面 + 氣泡 + 升起的綠色毒氣柱。
// 這是本場主角（參考圖的圈狀毒沼）。以石緣呈現為「永久建築井口」，與技能動態毒池區隔。
export function buildPoisonPools(theme) {
  const cfg = theme.pools || {};
  const count = LOW_GPU ? Math.min(4, cfg.count || 6) : (cfg.count || 6);
  const ringR = cfg.radius || 410;
  const poolCol = new THREE.Color(cfg.color || 0x86ff3a);
  const glow = cfg.glow != null ? cfg.glow : 1.9;
  const group = new THREE.Group();
  const liquidMat = new THREE.MeshStandardMaterial({
    color: poolCol, emissive: poolCol, emissiveIntensity: glow,
    roughness: 0.24, metalness: 0.0, transparent: true, opacity: 0.92,
  });
  const rimMat = new THREE.MeshStandardMaterial({ color: cfg.rim || 0x5a6052, roughness: 0.95, metalness: 0.04 });
  const gasMat = new THREE.MeshBasicMaterial({
    color: poolCol, transparent: true, opacity: 0.08, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, toneMapped: false,
  });
  // 氣泡改用單一 InstancedMesh（所有毒池共用一顆球，半徑用 per-instance scale）→ 一次 draw call。
  const bubbleGeo = new THREE.SphereGeometry(1, 8, 6);
  const bubbleMats = [];
  const _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + 0.3;
    const x = Math.cos(a) * ringR, z = Math.sin(a) * ringR * 0.78;  // 略壓成橢圓環，貼合俯視構圖
    const r = 50 + Math.random() * 26;
    // 沉陷石緣
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r * 1.05, r * 0.22, 6, 20), rimMat);
    rim.rotation.x = Math.PI / 2; rim.scale.set(1, 1, 0.42); rim.position.set(x, 2.6, z);
    rim.castShadow = true; rim.receiveShadow = true; group.add(rim);
    // 毒液液面（壓扁噪聲圓盤）
    const surf = noisify(new THREE.IcosahedronGeometry(r, 1), r * 0.08);
    surf.scale(1, 0.04, 1);
    const liq = new THREE.Mesh(surf, liquidMat);
    liq.position.set(x, 2.0, z); liq.renderOrder = 3; group.add(liq);
    // 翻騰氣泡（收集矩陣，迴圈外一次 instancing）
    const nb = LOW_GPU ? 2 : (3 + (Math.random() * 4 | 0));
    for (let b = 0; b < nb; b++) {
      const br = 4 + Math.random() * 8;
      _p.set(x + (Math.random() - 0.5) * r * 1.1, 2.4 + br * 0.4, z + (Math.random() - 0.5) * r * 1.1);
      _s.set(br, br * 0.7, br);
      bubbleMats.push(new THREE.Matrix4().compose(_p, _q, _s));
    }
    // 升起的綠色毒氣（加法混色、雙面、透明 → overdraw 大宗）— 手機降載時略過
    if (!LOW_GPU) {
      const plumeH = 80 + Math.random() * 55;
      const plume = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r * 0.5, plumeH, 12, 1, true), gasMat);
      plume.position.set(x, plumeH / 2 + 2, z); plume.renderOrder = 5; group.add(plume);
    }
  }
  if (bubbleMats.length) {
    const bubIM = new THREE.InstancedMesh(bubbleGeo, liquidMat, bubbleMats.length);
    for (let i = 0; i < bubbleMats.length; i++) bubIM.setMatrixAt(i, bubbleMats[i]);
    bubIM.instanceMatrix.needsUpdate = true;
    group.add(bubIM);
  }
  return group;
}

// 蛇紋石王座：階梯基座 + 座椅 + 高背石板（發光綠核）+ 後方門柱橫樑 + 盤蛇石雕 + 垂藤。
// 背景中央地標（呼應蛇/蜥主題與參考圖的石王座）；實體碰撞由 arena.colliders 對齊基座。
export function buildSerpentThrone(theme) {
  const cfg = theme.throne || {};
  const stone = new THREE.MeshStandardMaterial({ color: cfg.color || 0x5c6253, roughness: 0.95, metalness: 0.03 });
  const moss = new THREE.MeshStandardMaterial({ color: cfg.moss || 0x44682a, roughness: 1.0 });
  const group = new THREE.Group();
  group.position.set(cfg.x != null ? cfg.x : 0, 0, cfg.z != null ? cfg.z : -580);
  group.rotation.y = cfg.facing != null ? cfg.facing : 0; // 正面 (+z) 朝場中心
  // 階梯基座（正面朝 +z）
  let by = 0;
  for (const [w, h, d] of [[300, 26, 180], [250, 24, 140]]) {
    const m = new THREE.Mesh(noisify(new THREE.BoxGeometry(w, h, d, 3, 1, 2), 2), stone);
    m.position.set(0, by + h / 2, 0); m.castShadow = true; m.receiveShadow = true; group.add(m); by += h;
  }
  // 座椅
  const seat = new THREE.Mesh(noisify(new THREE.BoxGeometry(150, 34, 110, 3, 1, 2), 2), stone);
  seat.position.set(0, by + 17, 10); seat.castShadow = true; group.add(seat);
  // 高背石板 + 苔頂
  const back = new THREE.Mesh(noisify(new THREE.BoxGeometry(170, 220, 34, 3, 4, 2), 3), stone);
  back.position.set(0, by + 144, -34); back.castShadow = true; group.add(back);
  const bm = mossSlab(moss, 24); bm.scale.set(170 / 48, 0.4, 34 / 24); bm.position.set(0, by + 254, -34); group.add(bm);
  // 王座發光綠核（boss 權位）
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(20, 1),
    new THREE.MeshStandardMaterial({ color: 0xaaff66, emissive: cfg.glow || 0x7fff4a, emissiveIntensity: 1.7, roughness: 0.4 }));
  core.position.set(0, by + 130, -14); group.add(core);
  // 後方門柱 ×2 + 橫樑（門廊）
  const colTop = [];
  for (const sx of [-1, 1]) {
    const col = drumColumn(stone, 6, 18, 40);
    col.position.set(sx * 150, by, -60); group.add(col);
    const cap = mossSlab(moss, 18); cap.position.set(sx * 150, by + col.userData.top + 1, -60); group.add(cap);
    colTop.push(by + col.userData.top);
  }
  const lintY = Math.min(...colTop);
  const lintel = new THREE.Mesh(noisify(new THREE.BoxGeometry(370, 30, 50, 5, 1, 2), 2.5), stone);
  lintel.position.set(0, lintY + 15, -60); lintel.castShadow = true; group.add(lintel);
  const lm = mossSlab(moss, 22); lm.scale.set(370 / 44, 0.4, 1.1); lm.position.set(0, lintY + 30, -60); group.add(lm);
  // 盤蛇石雕（沿左柱螺旋而上的扁環疊塑）
  const snakeMat = new THREE.MeshStandardMaterial({ color: cfg.snake || 0x4e7e2c, roughness: 0.7, metalness: 0.1 });
  for (let i = 0; i < 6; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(26 - i * 1.6, 5, 6, 14), snakeMat);
    ring.rotation.x = Math.PI / 2 + 0.15; ring.rotation.z = i * 0.5; ring.position.set(-150, by + 20 + i * 30, -60); group.add(ring);
  }
  // 垂藤
  const vineMat = new THREE.MeshStandardMaterial({ color: cfg.vine || 0x365520, roughness: 1.0 });
  for (let v = 0; v < 7; v++) {
    const len = 50 + Math.random() * 90;
    const vine = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 0.9, len, 4), vineMat);
    vine.position.set(-175 + Math.random() * 350, lintY - len / 2, -44); vine.rotation.z = (Math.random() - 0.5) * 0.2; group.add(vine);
  }
  group.scale.setScalar(cfg.scale || 1.5);
  return group;
}

// 立桿火把環：祭壇邊緣一圈木桿火把（石礎 + 木桿 + 鐵籃 + 暖橙火焰）。
// 暖冷對比是本場與 R1（神殿光束）的關鍵區隔；火焰吃 bloom。
export function buildTorches(theme) {
  const cfg = theme.torches || {};
  // 手機降載：少幾根火把。整圈火把改用 InstancedMesh：原本 count×4 個獨立 draw call → 固定 4 個。
  const count = LOW_GPU ? Math.min(5, cfg.count || 7) : (cfg.count || 7);
  const rx = cfg.rx || 770, rz = cfg.rz || 620;
  const group = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: cfg.pole || 0x2c2117, roughness: 0.95, metalness: 0.05 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: cfg.base || 0x555b4e, roughness: 0.95 });
  const flameMat = new THREE.MeshStandardMaterial({ color: cfg.flame || 0xffa64d, emissive: cfg.flameGlow || 0xff6a1f, emissiveIntensity: 2.6, roughness: 0.4 });
  // 共用幾何（一次建立，instancing 重複擺放）。桿身用單位高度 + per-instance scale.y 控制高低。
  const footGeo = noisify(new THREE.CylinderGeometry(14, 18, 16, 8), 2);
  const poleGeo = new THREE.CylinderGeometry(4, 5, 1, 6);
  const basketGeo = new THREE.TorusGeometry(9, 2.4, 5, 10); basketGeo.rotateX(Math.PI / 2);
  const flameGeo = new THREE.IcosahedronGeometry(10, 1);
  const footIM = new THREE.InstancedMesh(footGeo, stoneMat, count); footIM.castShadow = true;
  const poleIM = new THREE.InstancedMesh(poleGeo, poleMat, count); poleIM.castShadow = true;
  const basketIM = new THREE.InstancedMesh(basketGeo, poleMat, count);
  const flameIM = new THREE.InstancedMesh(flameGeo, flameMat, count);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + 0.45;
    const bx = Math.cos(a) * rx, bz = Math.sin(a) * rz;
    const poleH = 92 + Math.random() * 16;
    q.setFromAxisAngle(up, Math.random() * Math.PI);
    footIM.setMatrixAt(i, m4.compose(pos.set(bx, 8, bz), q, scl.set(1, 1, 1)));
    poleIM.setMatrixAt(i, m4.compose(pos.set(bx, 16 + poleH / 2, bz), q, scl.set(1, poleH, 1)));
    basketIM.setMatrixAt(i, m4.compose(pos.set(bx, 16 + poleH, bz), q, scl.set(1, 1, 1)));
    flameIM.setMatrixAt(i, m4.compose(pos.set(bx, 16 + poleH + 8, bz), q, scl.set(0.9, 1.4, 0.9)));
  }
  for (const im of [footIM, poleIM, basketIM, flameIM]) im.instanceMatrix.needsUpdate = true;
  group.add(footIM, poleIM, basketIM, flameIM);
  return group;
}
