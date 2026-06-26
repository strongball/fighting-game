// 岩石/建築類道具：rock (卵石) / pillar (殘柱) / ruins (散落廢墟) / temple (廢棄神殿地標)。

import * as THREE from 'three';
import { ARENA } from '../../../constants.js';
import { noisify, scatterPositions, makeInstanced, attachFade, drumColumn, mossSlab } from '../helpers.js';

// 卵石：噪聲多面體、略壓扁，像半埋地的石頭。
export function buildRocks(theme) {
  const cfg = theme.rock || {};
  const positions = scatterPositions(cfg.count || 22);
  let geo = new THREE.DodecahedronGeometry(22, 1);
  geo = noisify(geo, 7);
  geo.scale(1, 0.78, 1); // 略壓扁，像半埋地的卵石
  const mat = new THREE.MeshStandardMaterial({ color: cfg.color || 0x6b6660, roughness: 0.98, metalness: 0.03 });
  return makeInstanced(geo, mat, positions);
}

// 殘柱：散佈的傾斜石柱 (自帶隨機沉降/傾角，故不走 makeInstanced)。
export function buildPillars(theme) {
  const cfg = theme.pillar || {};
  const positions = scatterPositions(cfg.count || 12);
  const geo = new THREE.CylinderGeometry(14, 18, 130, 8);
  geo.translate(0, 65, 0);
  const mat = new THREE.MeshStandardMaterial({ color: cfg.color || 0x8a7060, roughness: 0.9 });
  const im = new THREE.InstancedMesh(geo, mat, positions.length);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i];
    dummy.position.set(p.x, -Math.random() * 30, p.z);
    dummy.rotation.set(Math.random() * 0.15 - 0.07, p.ang, Math.random() * 0.15 - 0.07);
    dummy.scale.setScalar(p.scale);
    dummy.updateMatrix();
    im.setMatrixAt(i, dummy.matrix);
  }
  im.castShadow = true;
  im.instanceMatrix.needsUpdate = true;
  attachFade(im, mat, positions.length);
  im.userData.positions = positions;
  return im;
}

// 散落石造廢墟：牌坊(雙柱+斷樑) / 低矮斷牆 / 倒柱石鼓。皆貼地、少傾斜，當神殿外圍殘跡。
export function buildRuins(theme) {
  const cfg = theme.ruins || {};
  const stone = new THREE.MeshStandardMaterial({ color: cfg.color || 0x65695a, roughness: 0.96, metalness: 0.03 });
  const moss = new THREE.MeshStandardMaterial({ color: cfg.moss || 0x4e6f30, roughness: 1.0 });
  const baseScale = cfg.scale || 1.0;
  const count = cfg.count || 6;
  const halfMax = Math.max(ARENA.width, ARENA.height) / 2;
  const innerR = halfMax * 1.06, outerR = halfMax * 1.42;
  const group = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const a = Math.PI + (i / count) * Math.PI + (Math.random() - 0.5) * 0.5; // 背景半圈
    const r = innerR + Math.random() * (outerR - innerR);
    const px = Math.cos(a) * r, pz = Math.sin(a) * r;
    const unit = new THREE.Group();
    unit.position.set(px, 0, pz);
    unit.rotation.y = Math.atan2(-px, -pz);
    const s = baseScale * (0.85 + Math.random() * 0.5);
    const span = 58 + Math.random() * 26;
    const kind = Math.random();
    if (kind < 0.5) {
      // 牌坊：雙柱 (可能一根斷) + 斷裂橫樑 + 藤蔓
      const tops = [];
      for (const sx of [-1, 1]) {
        const broken = Math.random() < 0.3;
        const col = drumColumn(stone, broken ? (1 + (Math.random() * 2 | 0)) : (3 + (Math.random() * 2 | 0)));
        col.position.set(sx * span, 0, 0); col.rotation.y = Math.random() * Math.PI;
        unit.add(col);
        const cap = mossSlab(moss, 14); cap.position.set(sx * span, col.userData.top + 1, 0); unit.add(cap);
        if (!broken) tops.push(col.userData.top);
      }
      if (tops.length === 2) {
        const y = Math.min(tops[0], tops[1]);
        const beam = new THREE.Mesh(noisify(new THREE.BoxGeometry(span * 2 + 38, 26, 36, 4, 1, 2), 3), stone);
        beam.position.set(0, y + 13, 0); beam.rotation.z = (Math.random() - 0.5) * 0.04; beam.castShadow = true;
        unit.add(beam);
        const bm = mossSlab(moss, 16); bm.scale.set((span * 2) / 28, 0.4, 1.0); bm.position.set(0, y + 26, 0); unit.add(bm);
        const vineMat = new THREE.MeshStandardMaterial({ color: cfg.vine || 0x3e5e26, roughness: 1.0 });
        for (let v = 0; v < 2 + (Math.random() * 2 | 0); v++) {
          const len = 36 + Math.random() * 64;
          const vine = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.0, len, 4), vineMat);
          vine.position.set((Math.random() - 0.5) * span * 2, y + 2 - len / 2, 15);
          vine.rotation.z = (Math.random() - 0.5) * 0.2; unit.add(vine);
        }
      }
    } else if (kind < 0.78) {
      // 崩塌石牆：數塊高低不一的風化砌石並排，頂緣參差 (非單一方塊)
      const segN = 4 + (Math.random() * 3 | 0);
      let cursorX = 0;
      const widths = [];
      for (let sgi = 0; sgi < segN; sgi++) widths.push(46 + Math.random() * 26);
      const totalW = widths.reduce((s, w) => s + w, 0);
      cursorX = -totalW / 2;
      for (let sgi = 0; sgi < segN; sgi++) {
        const ww = widths[sgi];
        const wh = 26 + Math.random() * 58;        // 高低不齊 → 殘破頂緣
        const w = new THREE.Mesh(noisify(new THREE.BoxGeometry(ww, wh, 34, 2, 2, 2), 6), stone);
        w.position.set(cursorX + ww / 2, wh / 2 - 6, (Math.random() - 0.5) * 12);
        w.rotation.set((Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.14, (Math.random() - 0.5) * 0.05);
        w.castShadow = true; w.receiveShadow = true; unit.add(w);
        if (Math.random() < 0.5) { const m = mossSlab(moss, 12); m.scale.set(ww / 22, 0.4, 1.0); m.position.set(w.position.x, wh - 7, 0); unit.add(m); }
        cursorX += ww;
      }
    } else {
      // 倒柱 + 散石鼓 (rubble，全部貼地)
      const fallen = new THREE.Mesh(noisify(new THREE.CylinderGeometry(14, 15, 90 + Math.random() * 56, 10, 1), 3), stone);
      fallen.rotation.set(Math.PI / 2, Math.random() * Math.PI, (Math.random() - 0.5) * 0.3);
      fallen.position.set(0, 14, 0); fallen.castShadow = true; unit.add(fallen);
      for (let d = 0; d < 2 + (Math.random() * 2 | 0); d++) {
        const dr = new THREE.Mesh(noisify(new THREE.CylinderGeometry(13, 14, 22, 10, 1), 2.5), stone);
        dr.rotation.set(Math.PI / 2 + (Math.random() - 0.5) * 0.5, Math.random() * Math.PI, Math.random() * 0.5);
        dr.position.set((Math.random() - 0.5) * 86, 12, (Math.random() - 0.5) * 64); dr.castShadow = true; unit.add(dr);
      }
    }
    unit.scale.setScalar(s);
    group.add(unit);
  }
  return group;
}

// 廢棄神殿：階梯基座 + 前後排列柱(部分斷) + 斷裂橫樑 + 三角山牆 + 發光神龕。明確地標。
// 位置：cfg.x/cfg.z 指定 (場景座標)；否則背景後方半圈。實體碰撞另由 boss.colliders 設定 (見 ARENA 文件)。
export function buildTemple(theme) {
  const cfg = theme.temple || {};
  const stone = new THREE.MeshStandardMaterial({ color: cfg.color || 0x6a6e5d, roughness: 0.95, metalness: 0.03 });
  const moss = new THREE.MeshStandardMaterial({ color: cfg.moss || 0x4e6f30, roughness: 1.0 });
  const group = new THREE.Group();
  const halfMax = Math.max(ARENA.width, ARENA.height) / 2;
  let px, pz;
  if (cfg.x != null && cfg.z != null) {
    px = cfg.x; pz = cfg.z;
  } else {
    const a = 1.5 * Math.PI + (cfg.angle != null ? cfg.angle : (Math.random() - 0.5) * 0.35);
    const r = halfMax * (cfg.dist || 1.4);
    px = Math.cos(a) * r; pz = Math.sin(a) * r;
  }
  group.position.set(px, 0, pz);
  group.rotation.y = cfg.facing != null ? cfg.facing : Math.atan2(-px, -pz);
  // 階梯基座 (3 階)
  const steps = [[380, 38, 240], [336, 32, 200], [296, 28, 168]];
  let by = 0;
  for (const [w, h, d] of steps) {
    const m = new THREE.Mesh(noisify(new THREE.BoxGeometry(w, h, d, 4, 1, 3), 2.5), stone);
    m.position.set(0, by + h / 2, 0); m.castShadow = true; m.receiveShadow = true; group.add(m); by += h;
  }
  // 前緣列柱 5 根 (第 2、5 根斷)
  const intact = [];
  [-120, -60, 0, 60, 120].forEach((cx, i) => {
    const broken = (i === 1 || i === 4);
    const col = drumColumn(stone, broken ? (1 + (Math.random() * 2 | 0)) : 4, 17, 38);
    col.position.set(cx, by, -58); group.add(col);
    const cap = mossSlab(moss, 16); cap.position.set(cx, by + col.userData.top + 1, -58); group.add(cap);
    if (!broken) intact.push({ x: cx, y: by + col.userData.top });
  });
  // 後排 3 根矮柱 (深度感)
  for (const cx of [-90, 0, 90]) { const col = drumColumn(stone, 3, 17, 38); col.position.set(cx, by, 58); group.add(col); }
  // 斷裂橫樑：架在左側完整柱上、右側崩塌
  if (intact.length >= 2) {
    const xs = intact.map(p => p.x);
    const xL = Math.min(...xs) - 18, xR = (intact.length > 2 ? intact[2].x : Math.max(...xs)) + 18;
    const y = Math.min(...intact.map(p => p.y));
    const beamW = Math.max(70, xR - xL);
    const beam = new THREE.Mesh(noisify(new THREE.BoxGeometry(beamW, 26, 46, 6, 1, 2), 2.5), stone);
    beam.position.set((xL + xR) / 2, y + 14, -58); beam.castShadow = true; group.add(beam);
    const bm = mossSlab(moss, 20); bm.scale.set(beamW / 34, 0.4, 1.1); bm.position.set((xL + xR) / 2, y + 27, -58); group.add(bm);
    // 三角山牆 (pediment) + 斜屋頂殘段，立於橫樑上 → 明確「神殿正面」
    const cxBeam = (xL + xR) / 2, topY = y + 27;
    const pedW = beamW * 0.96, pedH = 66;
    const shape = new THREE.Shape();
    shape.moveTo(-pedW / 2, 0); shape.lineTo(pedW / 2, 0); shape.lineTo(10, pedH); shape.closePath(); // 頂點略偏 → 不死板
    let pedGeo = new THREE.ExtrudeGeometry(shape, { depth: 48, bevelEnabled: false });
    pedGeo.translate(0, 0, -24);
    pedGeo = noisify(pedGeo, 3);
    const ped = new THREE.Mesh(pedGeo, stone);
    ped.position.set(cxBeam, topY, -58); ped.castShadow = true; group.add(ped);
    const pm = mossSlab(moss, 20); pm.scale.set(pedW / 42, 0.4, 1.1); pm.position.set(cxBeam - pedW * 0.18, topY + pedH * 0.46, -58); group.add(pm);
    // 左坡屋簷殘板 (右坡崩塌)
    const eave = new THREE.Mesh(noisify(new THREE.BoxGeometry(pedW * 0.62, 9, 54, 4, 1, 2), 2), stone);
    eave.position.set(cxBeam - pedW * 0.22, topY + pedH * 0.5, -58);
    eave.rotation.z = 0.62; eave.castShadow = true; group.add(eave);
  }
  // 神龕發光核心 (呼應 boss 翠綠生命核心)
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(18, 1),
    new THREE.MeshStandardMaterial({ color: 0x9be86a, emissive: cfg.glow || 0x6fd23a, emissiveIntensity: 1.5, roughness: 0.4, metalness: 0.1 }));
  core.position.set(0, by + 46, 4); group.add(core);
  // 基座上散落柱鼓
  for (let d = 0; d < 4; d++) {
    const dr = new THREE.Mesh(noisify(new THREE.CylinderGeometry(15, 16, 24, 10, 1), 2.5), stone);
    dr.rotation.set(Math.PI / 2 + (Math.random() - 0.5) * 0.5, Math.random() * Math.PI, Math.random() * 0.6);
    dr.position.set((Math.random() - 0.5) * 230, by + 14, (Math.random() - 0.5) * 110); dr.castShadow = true; group.add(dr);
  }
  group.scale.setScalar(cfg.scale || 1.7);
  return group;
}
