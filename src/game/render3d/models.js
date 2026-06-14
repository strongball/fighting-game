// 程序化 3D 角色模型 + 動畫
//
// 每個角色 = 人形基底(頭/軀幹/雙臂/雙腿，肢體有樞紐可擺動) + 依原型的武器 + 頭頂發光識別徽記。
// 模型一律「面向 +X」建立；renderer 以 group.rotation.y = -facing 轉向。
//
// 對外：
//   createCharacterModel(charId) -> THREE.Group (含 userData 動畫資料)
//   animateModel(group, dt, { speed, facing, p, isSelf }) 每幀更新

import * as THREE from 'three';
import { getCharacter } from '../characters.js';
import { WALK_THRESHOLD } from '../constants.js';

// 原型設定：bulk(體型) / weapon(武器) / 顏色由角色資料 color 決定
const ARCHE = {
  0: { bulk: 2.36, weapon: 'sword' },     // 戰士
  1: { bulk: 1.84, weapon: 'staff', robe: true },   // 法師
  2: { bulk: 1.64, weapon: 'daggers' },   // 刺客
  3: { bulk: 3.0, weapon: 'shield' },     // 坦克
  4: { bulk: 1.92, weapon: 'bow' },       // 弓箭手
  5: { bulk: 1.96, weapon: 'orb', robe: true },     // 治療師
  6: { bulk: 2.6, weapon: 'axes' },       // 狂戰士
  7: { bulk: 1.64, weapon: 'kunai' },     // 忍者
  8: { bulk: 2.0, weapon: 'elements', robe: true }, // 元素使
  9: { bulk: 2.1, weapon: 'gloves' },    // 格鬥家
};

function shade(hex, f) {
  const c = new THREE.Color(hex);
  if (f >= 0) c.lerp(new THREE.Color(0xffffff), f);
  else c.lerp(new THREE.Color(0x000000), -f);
  return c;
}

function mat(color, opt = {}) {
  return new THREE.MeshStandardMaterial({
    color, roughness: opt.rough ?? 0.6, metalness: opt.metal ?? 0.15,
    emissive: opt.emissive ?? 0x000000, emissiveIntensity: opt.ei ?? 1,
    envMapIntensity: opt.env ?? 0.9,
    map: opt.map ?? null,
    transparent: true, opacity: 1,
  });
}

// ---- 程序化後備皮膚：質感 (布/金屬/皮革/肌膚) 與頭部配件 ----
const SKIN_KIND = {
  0: 'metal', 1: 'cloth', 2: 'leather', 3: 'metal', 4: 'leather',
  5: 'cloth', 6: 'metal', 7: 'leather', 8: 'cloth', 9: 'skin',
};
const HEADGEAR = {
  0: 'helm', 1: 'hat', 2: 'hood', 3: 'helm', 4: 'hood',
  5: 'hood', 6: 'horns', 7: 'mask', 8: 'hood', 9: 'band',
};
const PAULDRONS = new Set([0, 3, 6]); // 重甲系加肩甲

// 以 canvas 程序生成表面貼圖 (依識別色 + 質感樣式)，快取避免重複建立。
const _texCache = new Map();
function panelTexture(baseHex, kind) {
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

// 依原型加上肩甲與頭部配件 (回傳配件陣列，供 GLB 皮膚覆蓋時隱藏)。
function buildAccents(group, reg, o) {
  const acc = [];
  const add = (m) => { m.castShadow = true; group.add(m); acc.push(m); return m; };
  const dark = () => reg(mat(shade(o.base, -0.35), { rough: 0.5, metal: 0.45 }));
  const metalAccent = () => reg(mat(shade(o.base, 0.05), { rough: 0.42, metal: 0.6 }));

  if (PAULDRONS.has(o.charId)) {
    const pg = new THREE.SphereGeometry(o.torsoW * 0.28, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    for (const sz of [-1, 1]) {
      const m = new THREE.Mesh(pg, metalAccent());
      m.position.set(0, o.shoulderY + 1, sz * (o.shoulderX + 1));
      m.scale.y = 0.8;
      add(m);
    }
  }

  const hg = HEADGEAR[o.charId];
  const topY = o.headY + 7;
  if (hg === 'hat') {
    const hat = add(new THREE.Mesh(new THREE.ConeGeometry(8.5, 20, 16), reg(mat(shade(o.base, -0.2), { rough: 0.7, metal: 0.05 }))));
    hat.position.set(0, topY + 6, 0);
    const brim = add(new THREE.Mesh(new THREE.TorusGeometry(7, 1.4, 8, 20), dark()));
    brim.rotation.x = Math.PI / 2; brim.position.set(0, o.headY + 4, 0);
  } else if (hg === 'helm') {
    const helm = add(new THREE.Mesh(new THREE.SphereGeometry(8.2, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), metalAccent()));
    helm.position.set(0, o.headY + 1.5, 0);
    const crest = add(new THREE.Mesh(new THREE.BoxGeometry(10, 2.2, 1.6), reg(mat(shade(o.base, 0.2), { metal: 0.5, emissive: new THREE.Color(o.base), ei: 0.4 }))));
    crest.position.set(0, o.headY + 8, 0);
  } else if (hg === 'hood' || hg === 'mask') {
    const hood = add(new THREE.Mesh(new THREE.SphereGeometry(9, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.7), reg(mat(shade(o.base, -0.28), { rough: 0.85, metal: 0.03 }))));
    hood.position.set(-1.5, o.headY + 1, 0); hood.scale.set(1.1, 1.1, 1.15);
    if (hg === 'mask') {
      const band = add(new THREE.Mesh(new THREE.BoxGeometry(4, 4, 16), dark()));
      band.position.set(5.5, o.headY - 1, 0);
    }
  } else if (hg === 'horns') {
    const hornMat = reg(mat(0xe8e2d0, { rough: 0.6, metal: 0.1 }));
    for (const sz of [-1, 1]) {
      const horn = add(new THREE.Mesh(new THREE.ConeGeometry(2.2, 11, 8), hornMat));
      horn.position.set(-1, o.headY + 6, sz * 5.5); horn.rotation.x = sz * -0.5;
    }
  } else if (hg === 'band') {
    const band = add(new THREE.Mesh(new THREE.TorusGeometry(7.6, 1.3, 8, 20), reg(mat(shade(o.base, 0.25), { emissive: new THREE.Color(o.base), ei: 0.5 }))));
    band.rotation.x = Math.PI / 2; band.position.set(0, o.headY + 3, 0);
  }
  return acc;
}

export function createCharacterModel(charId) {
  const ch = getCharacter(charId);
  const bossModel = ch.model || null; // 魔王程序化建模參數 (id>=100)
  const cfg = bossModel
    ? { bulk: bossModel.bulk || 2, weapon: bossModel.weapon || 'sword', robe: !!bossModel.robe }
    : (ARCHE[charId] || { bulk: 1, weapon: 'sword' });
  const base = ch.color;
  const skinMats = []; // 供隱身淡出
  const reg = (m) => { skinMats.push(m); return m; };

  const group = new THREE.Group();
  const bulk = cfg.bulk;
  const torsoW = 22 * bulk, torsoD = 14 * bulk, torsoH = 20;
  const hipY = 18, shoulderY = hipY + torsoH;

  // 質感 (程序化後備皮膚)：依原型決定貼圖樣式與粗糙/金屬度
  const skinKind = SKIN_KIND[charId] || (bossModel ? (bossModel.robe ? 'cloth' : 'metal') : 'cloth');
  const kRough = skinKind === 'metal' ? 0.42 : skinKind === 'leather' ? 0.62 : skinKind === 'cloth' ? 0.78 : 0.6;
  const kMetal = skinKind === 'metal' ? 0.6 : skinKind === 'leather' ? 0.12 : skinKind === 'cloth' ? 0.04 : 0.1;
  const bodyTex = panelTexture(base, skinKind);

  // 軀幹
  const bodyMat = reg(mat(0xffffff, { rough: kRough, metal: kMetal, map: bodyTex }));
  let torsoGeo;
  if (cfg.robe) {
    torsoGeo = new THREE.CylinderGeometry(torsoW * 0.42, torsoW * 0.62, torsoH + 6, 12);
  } else {
    torsoGeo = new THREE.BoxGeometry(torsoW, torsoH, torsoD);
  }
  const torso = new THREE.Mesh(torsoGeo, bodyMat);
  torso.position.y = hipY + torsoH / 2;
  torso.castShadow = true;
  group.add(torso);

  // 胸口亮片 (識別色強化)
  const chest = new THREE.Mesh(
    new THREE.BoxGeometry(torsoW * 0.5, torsoH * 0.4, 2),
    reg(mat(shade(base, 0.35), { metal: 0.4, rough: 0.45, emissive: new THREE.Color(base), ei: 0.22 }))
  );
  chest.position.set(0, hipY + torsoH * 0.6, torsoD * 0.5 + 0.5);
  torso.add(chest);

  // 頭 (依 shape 變化)
  const headMat = reg(mat(shade(base, 0.18), { rough: 0.5 }));
  let headGeo;
  if (ch.shape === 'triangle') headGeo = new THREE.ConeGeometry(8, 15, 4);
  else if (ch.shape === 'square') headGeo = new THREE.BoxGeometry(13, 13, 13);
  else headGeo = new THREE.SphereGeometry(7.5, 16, 12);
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = shoulderY + 8;
  if (ch.shape === 'triangle') head.rotation.y = Math.PI / 4;
  head.castShadow = true;
  group.add(head);

  // ---- 臉部 (可表情：中性/專注/痛苦)；+X 為前，掛在獨立群組以便表情動畫 ----
  const headY = shoulderY + 8;
  const faceGroup = new THREE.Group();
  faceGroup.position.set(0, headY, 0);
  group.add(faceGroup);
  const frontX = 6.2;
  const featMat = reg(mat(0x0b0f14, { rough: 0.35, metal: 0.45, emissive: new THREE.Color(shade(base, 0.5)), ei: 0.22 }));
  const eyeGeo = new THREE.BoxGeometry(1.4, 2.6, 2.6);
  const browGeo = new THREE.BoxGeometry(1.1, 0.9, 4.2);
  const mouthGeo = new THREE.BoxGeometry(1.2, 1.6, 5.2);
  const eyeL = new THREE.Mesh(eyeGeo, featMat); eyeL.position.set(frontX, 1.6, -3); faceGroup.add(eyeL);
  const eyeR = new THREE.Mesh(eyeGeo, featMat); eyeR.position.set(frontX, 1.6, 3); faceGroup.add(eyeR);
  const browL = new THREE.Mesh(browGeo, featMat); browL.position.set(frontX, 4.4, -3); faceGroup.add(browL);
  const browR = new THREE.Mesh(browGeo, featMat); browR.position.set(frontX, 4.4, 3); faceGroup.add(browR);
  const mouth = new THREE.Mesh(mouthGeo, featMat); mouth.position.set(frontX, -3.4, 0); faceGroup.add(mouth);
  const face = { group: faceGroup, eyeL, eyeR, browL, browR, mouth, browY: 4.4, mouthY: -3.4, eyeY: 1.6, frontX };

  // 手臂 (樞紐在肩)
  const armMat = reg(mat(0xd2d2d2, { rough: kRough + 0.05, metal: kMetal, map: bodyTex }));
  const armLen = 16;
  const mkLimb = (px, pz, isArm) => {
    const pivot = new THREE.Group();
    pivot.position.set(px, isArm ? shoulderY - 1 : hipY, pz);
    const len = isArm ? armLen : 17;
    const w = isArm ? 5.2 * bulk : 6.4 * bulk;
    const limb = new THREE.Mesh(new THREE.BoxGeometry(w, len, w), isArm ? armMat : bodyMat);
    limb.position.y = -len / 2;
    limb.castShadow = true;
    pivot.add(limb);
    group.add(pivot);
    return pivot;
  };
  const shoulderX = torsoW * 0.5 + 3;
  const hipX = torsoW * 0.28;
  const armL = mkLimb(0, -shoulderX, true);   // 左 (–Z)
  const armR = mkLimb(0, shoulderX, true);    // 右 (+Z)
  const legL = mkLimb(0, -hipX, false);
  const legR = mkLimb(0, hipX, false);

  // 武器 (掛右手末端)
  const handR = new THREE.Group();
  handR.position.y = -armLen;
  armR.add(handR);
  buildWeapon(handR, cfg.weapon, base, reg);

  // 原型配件 (肩甲/頭盔/帽/兜帽/獸角/頭帶) — 強化辨識與「皮膚」感
  const accents = buildAccents(group, reg, { charId, base, headY, shoulderY, shoulderX, torsoW });

  // 頭頂發光識別徽記 (收斂發光，仍保留辨識)
  const emMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(base), emissive: new THREE.Color(base), emissiveIntensity: 1.1,
    roughness: 0.35, metalness: 0.1,
  });
  let emGeo;
  if (ch.shape === 'square') emGeo = new THREE.BoxGeometry(5.5, 5.5, 5.5);
  else if (ch.shape === 'triangle') emGeo = new THREE.TetrahedronGeometry(5);
  else emGeo = new THREE.IcosahedronGeometry(4.2, 0);
  const emblem = new THREE.Mesh(emGeo, emMat);
  emblem.position.y = shoulderY + 24;
  group.add(emblem);

  // 腳下接觸陰影圈 (柔和)
  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(torsoW * 0.7, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.34 })
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.6;
  group.add(blob);

  // 護盾環 (p.shield>0 時顯示)
  const shieldRing = new THREE.Mesh(
    new THREE.TorusGeometry(torsoW * 0.95, 1.6, 8, 36),
    new THREE.MeshStandardMaterial({ color: 0x9fe8ff, emissive: 0x49d0ff, emissiveIntensity: 2.2, transparent: true, opacity: 0.9 })
  );
  shieldRing.rotation.x = -Math.PI / 2;
  shieldRing.position.y = 2;
  shieldRing.visible = false;
  group.add(shieldRing);

  // 血怒環
  const rageRing = new THREE.Mesh(
    new THREE.TorusGeometry(torsoW * 1.05, 2.2, 8, 36),
    new THREE.MeshStandardMaterial({ color: 0xff5a3c, emissive: 0xff2a14, emissiveIntensity: 2.6, transparent: true, opacity: 0.85 })
  );
  rageRing.rotation.x = -Math.PI / 2;
  rageRing.position.y = 2;
  rageRing.visible = false;
  group.add(rageRing);

  // 燃燒環 (p.effects.burn 時顯示，橘紅悶燒)
  const burnRing = new THREE.Mesh(
    new THREE.TorusGeometry(torsoW * 1.0, 1.4, 8, 32),
    new THREE.MeshStandardMaterial({ color: 0xff7a3d, emissive: 0xff5a1f, emissiveIntensity: 2.4, transparent: true, opacity: 0.8 })
  );
  burnRing.rotation.x = -Math.PI / 2;
  burnRing.position.y = 3;
  burnRing.visible = false;
  group.add(burnRing);
  // 凍結外殼 (p.effects.frozen 時顯示，冰藍冷光)
  // 上下兩圈戏劇化冰封效果
  const frozenRingLow = new THREE.Mesh(
    new THREE.TorusGeometry(torsoW * 1.3, 2.6, 8, 40),
    new THREE.MeshStandardMaterial({ color: 0xb8efff, emissive: 0x49d0ff, emissiveIntensity: 3.2, transparent: true, opacity: 0.92 })
  );
  frozenRingLow.rotation.x = -Math.PI / 2;
  frozenRingLow.position.y = 6;
  frozenRingLow.visible = false;
  group.add(frozenRingLow);

  const frozenRingHigh = new THREE.Mesh(
    new THREE.TorusGeometry(torsoW * 0.95, 2.0, 8, 40),
    new THREE.MeshStandardMaterial({ color: 0xe0f8ff, emissive: 0x9fe8ff, emissiveIntensity: 2.8, transparent: true, opacity: 0.85 })
  );
  frozenRingHigh.rotation.x = -Math.PI / 2;
  frozenRingHigh.position.y = 52;
  frozenRingHigh.visible = false;
  group.add(frozenRingHigh);
  group.userData = {
    parts: { torso, head, armL, armR, legL, legR, emblem, shieldRing, rageRing, burnRing, frozenRingLow, frozenRingHigh, handR, face, accents },
    skinMats,
    phase: Math.random() * Math.PI * 2,
    breathe: Math.random() * Math.PI * 2,
    move: 0,
    curFacing: 0,
    baseY: 0,
    // 出手姿勢狀態機 (kind: 'swing' 普攻/近戰 | 'cast' 施法/遠程)
    atkT: 0, atkDur: 0, atkKind: 'swing',
    // 表情狀態機 (秒數倒數)
    hurtT: 0, focusT: 0,
    // 表情五官目前插值量 (平滑過渡)
    eEye: 1, eBrowTilt: 0, eBrowY: 0, eMouth: 1, eFlinch: 0,
  };

  // 魔王：放大模型 + 胸口能量核心發光 (辨識度)
  if (bossModel) {
    if (bossModel.scale) group.scale.setScalar(bossModel.scale);
    const coreCol = new THREE.Color(bossModel.emissiveCore || base);
    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(torsoW * 0.22, 1),
      new THREE.MeshStandardMaterial({ color: coreCol, emissive: coreCol, emissiveIntensity: 2.2, roughness: 0.3, metalness: 0.2, transparent: true, opacity: 0.95 })
    );
    core.position.set(torsoD * 0.5, hipY + torsoH * 0.6, 0);
    group.add(core);
    group.userData.bossCore = core;
  }
  return group;
}

// 魔王可破壞部位 (R5 雷射臂/巨鋸臂) 的簡易發光水晶模型。
export function createPartModel(colorHex, scale = 1) {
  const group = new THREE.Group();
  const col = new THREE.Color(colorHex || '#ffffff');
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(16, 1),
    new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 2.0, roughness: 0.35, metalness: 0.3, transparent: true, opacity: 0.95 })
  );
  core.position.y = 42; core.castShadow = true;
  group.add(core);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(24, 2.4, 8, 28),
    new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.6, transparent: true, opacity: 0.8 })
  );
  ring.rotation.x = Math.PI / 2; ring.position.y = 42;
  group.add(ring);
  const blob = new THREE.Mesh(new THREE.CircleGeometry(20, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.6; group.add(blob);
  group.scale.setScalar(scale);
  group.userData = { simple: true, core, breathe: Math.random() * 6.28, baseY: 42 };
  return group;
}

function buildWeapon(hand, type, base, reg) {
  if (type === 'none' || !type) return; // 無持械魔王 (巨兵/分身)
  const steel = reg(mat(0xb9c4cf, { rough: 0.35, metal: 0.7 }));
  const dark = reg(mat(0x2b3038, { rough: 0.5, metal: 0.5 }));
  const accent = reg(mat(shade(base, 0.2), { emissive: new THREE.Color(base), ei: 0.5 }));
  const add = (m, x, y, z, rx = 0, ry = 0, rz = 0) => {
    m.castShadow = true; m.position.set(x, y, z); m.rotation.set(rx, ry, rz); hand.add(m); return m;
  };
  switch (type) {
    case 'sword':
      add(new THREE.Mesh(new THREE.BoxGeometry(2.5, 30, 5), steel), 4, -6, 0);
      add(new THREE.Mesh(new THREE.BoxGeometry(3, 3, 12), dark), 4, -20, 0);
      break;
    case 'axes':
    case 'axe':
      add(new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 26, 8), dark), 3, -8, 0);
      add(new THREE.Mesh(new THREE.BoxGeometry(3, 10, 12), steel), 3, 2, 4, 0, 0, 0.2);
      break;
    case 'daggers':
      add(new THREE.Mesh(new THREE.ConeGeometry(2, 14, 4), steel), 3, -2, 0, 0, 0, Math.PI);
      break;
    case 'kunai':
      add(new THREE.Mesh(new THREE.ConeGeometry(2.4, 12, 4), dark), 3, -2, 0, 0, 0, Math.PI);
      add(new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.8, 6, 10), dark), 3, 5, 0, Math.PI / 2);
      break;
    case 'staff':
      add(new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 40, 8), dark), 3, -4, 0);
      add(new THREE.Mesh(new THREE.IcosahedronGeometry(4.5, 0),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(base), emissive: new THREE.Color(base), emissiveIntensity: 2.6 })), 3, 16, 0);
      break;
    case 'orb':
      add(new THREE.Mesh(new THREE.SphereGeometry(5, 16, 12),
        new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: new THREE.Color(base), emissiveIntensity: 2.4, transparent: true, opacity: 0.9 })), 6, -2, 0);
      break;
    case 'bow': {
      const torus = new THREE.Mesh(new THREE.TorusGeometry(13, 1.1, 8, 24, Math.PI * 1.3), reg(mat(shade(base, -0.1), { rough: 0.5 })));
      add(torus, 4, -4, 0, 0, Math.PI / 2, 0);
      break;
    }
    case 'shield':
      add(new THREE.Mesh(new THREE.BoxGeometry(3, 26, 22), reg(mat(shade(base, 0.1), { metal: 0.5, rough: 0.4 }))), 5, -4, 0);
      add(new THREE.Mesh(new THREE.SphereGeometry(3.5, 12, 8), accent), 8, -4, 0);
      break;
    case 'gloves':
      add(new THREE.Mesh(new THREE.BoxGeometry(8, 8, 8), accent), 3, -2, 0);
      break;
    case 'elements': {
      const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(base), emissive: new THREE.Color(base), emissiveIntensity: 2.2 });
      for (let i = 0; i < 3; i++) {
        const o = add(new THREE.Mesh(new THREE.IcosahedronGeometry(2.6, 0), m), 4, 0 + i * 4, 0);
        o.userData.orbit = i;
      }
      break;
    }
    default:
      add(new THREE.Mesh(new THREE.BoxGeometry(3, 18, 3), steel), 4, -6, 0);
  }
}

const _white = new THREE.Color(0xffffff);

function smoothstep(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
// 揮砍/出拳：windup(後拉上舉) → strike(前劭) → recover；回傳武器手 rotation.z
function swingArmZ(p) {
  if (p < 0.22) return -0.95 * smoothstep(p / 0.22);
  if (p < 0.5) return -0.95 + 2.45 * smoothstep((p - 0.22) / 0.28);
  return 1.5 * (1 - smoothstep((p - 0.5) / 0.5));
}
// 施法/舉杖：抬手蓄力 → 推出 → 放下
function castArmZ(p) {
  const u = smoothstep(Math.min(1, p / 0.35));
  const dn = p > 0.6 ? smoothstep((p - 0.6) / 0.4) : 0;
  return 1.6 * u * (1 - dn);
}

// ---- GLB 皮膚動畫驅動 (idle/walk 交叉淡入 + attack/hit 一次性) ----
function skinFadeTo(s, name, dur) {
  const next = s.actions[name];
  if (!next || s.cur === next) return;
  next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(dur).play();
  if (s.cur) s.cur.fadeOut(dur);
  s.cur = next;
}
function skinPlayOnce(s, name) {
  const act = s.actions[name];
  if (!act) return;
  act.reset().setEffectiveWeight(1).fadeIn(0.06).play();
  if (s.cur && s.cur !== act) s.cur.fadeOut(0.1);
  s.cur = act;
  s.oneShot = name;
  s.oneShotT = act.getClip().duration || 0.4;
}
function driveSkin(ud, dt, info) {
  const s = ud.skin;
  if (info.attack && s.actions.attack) skinPlayOnce(s, 'attack');
  else if (info.hurt && s.actions.hit) skinPlayOnce(s, 'hit');
  if (s.oneShot) {
    s.oneShotT -= dt;
    if (s.oneShotT <= 0) s.oneShot = null;
  } else {
    // walk/idle 用遲滯雙門檻：跨過 0.6 才走、跌破 0.35 才停，避免在門檻附近反覆 crossfade 抖動
    if (s.moving && ud.move < 0.35) s.moving = false;
    else if (!s.moving && ud.move > 0.6) s.moving = true;
    const want = s.moving ? 'walk' : 'idle';
    if (s.actions[want]) skinFadeTo(s, want, 0.2);
  }
  if (!s.cur) {
    const init = s.actions.idle ? 'idle' : (s.actions.walk ? 'walk' : null);
    if (init) skinFadeTo(s, init, 0);
  }
  s.mixer.update(dt);
}

// 將載入的 GLB 皮膚掛上現有角色群組：隐藏程序化身體 (保留徽記/狀態環)。
export function attachSkin(group, skin) {
  const ud = group.userData;
  if (!ud || !skin) return;
  for (const k of ['torso', 'head', 'armL', 'armR', 'legL', 'legR']) {
    if (ud.parts[k]) ud.parts[k].visible = false;
  }
  if (ud.parts.face) ud.parts.face.group.visible = false;
  if (ud.parts.accents) for (const a of ud.parts.accents) a.visible = false;
  const glbMats = [];
  skin.root.traverse((o) => {
    if (!o.material) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of ms) { m.transparent = true; glbMats.push(m); }
  });
  ud.skin = { mixer: skin.mixer, actions: skin.actions, cfg: skin.cfg, root: skin.root, cur: null, oneShot: null, oneShotT: 0, moving: false, glbMats };
  group.add(skin.root);
}

export function animateModel(group, dt, info) {
  const ud = group.userData;
  if (!ud) return;
  if (ud.simple) { // 簡易模型 (魔王部位/水晶)：僅自轉漂浮
    ud.breathe = (ud.breathe || 0) + dt * 1.6;
    if (ud.core) { ud.core.rotation.y += dt * 1.2; ud.core.rotation.x += dt * 0.7; }
    group.position.y = (ud.baseY || 0) + Math.sin(ud.breathe) * 1.5;
    return;
  }
  const { parts } = ud;

  // ---- 出手 / 受擊 觸發 (由 renderer 依 cd 上跳 / hp 下降 偵測) ----
  if (info.attack) {
    ud.atkKind = info.attack;
    ud.atkDur = info.attack === 'cast' ? 0.55 : 0.42;
    ud.atkT = ud.atkDur;
    ud.focusT = Math.max(ud.focusT, ud.atkDur + 0.25);
  }
  if (info.hurt) ud.hurtT = 0.42;
  if (ud.atkT > 0) ud.atkT = Math.max(0, ud.atkT - dt);
  if (ud.focusT > 0) ud.focusT = Math.max(0, ud.focusT - dt);
  if (ud.hurtT > 0) ud.hurtT = Math.max(0, ud.hurtT - dt);

  const moving = info.speed > WALK_THRESHOLD;
  // move 平滑
  ud.move += ((moving ? 1 : 0) - ud.move) * Math.min(1, dt * 12);
  const stride = Math.min(1.7, 0.6 + info.speed / 220);
  if (ud.move > 0.02) ud.phase += dt * 9 * stride;
  ud.breathe += dt * 1.6;

  // 朝向平滑 (group.rotation.y = -facing)
  const target = -info.facing;
  let d = target - ud.curFacing;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  ud.curFacing += d * Math.min(1, dt * 14);
  group.rotation.y = ud.curFacing;

  const sw = Math.sin(ud.phase);
  const amp = 0.7 * ud.move;

  if (ud.skin) {
    // ---- GLB 皮膚：驅動骨架動畫，身體交由 mixer；身體踩地 ----
    driveSkin(ud, dt, info);
    group.position.y = ud.baseY;
  } else {
    // ---- 程序化肢體 + 出手姿勢 ----
    // 腿擺動 (rotation.z 沿 +X 前後)
    parts.legL.rotation.z = sw * amp;
    parts.legR.rotation.z = -sw * amp;
    // 手臂反向擺 + 微張
    parts.armL.rotation.z = -sw * amp * 0.8;
    parts.armR.rotation.z = sw * amp * 0.8;
    parts.armL.rotation.x = -0.12;
    parts.armR.rotation.x = 0.12;

    // 出手姿勢 (疊加在走路擺動上)；武器掛右手→主要動右臂
    if (ud.atkT > 0 && ud.atkDur > 0) {
      const ap = 1 - ud.atkT / ud.atkDur; // 0→1 進度
      if (ud.atkKind === 'cast') {
        const z = castArmZ(ap);
        parts.armR.rotation.z = sw * amp * 0.3 + z;
        parts.armR.rotation.x = 0.12 - z * 0.18;
        parts.armL.rotation.z = -sw * amp * 0.3 + z * 0.55;
        parts.torso.rotation.x = -0.12 * Math.sin(ap * Math.PI);
      } else {
        const z = swingArmZ(ap);
        parts.armR.rotation.z = z;
        parts.armR.rotation.x = 0.12 + Math.sin(ap * Math.PI) * 0.25;
        parts.armL.rotation.z = -sw * amp * 0.4 - z * 0.25;
        parts.torso.rotation.y = -Math.sin(ap * Math.PI) * 0.22;
      }
    } else {
      parts.torso.rotation.x = 0;
      parts.torso.rotation.y = 0;
    }

    // 軀幹上下彈跳 + 呼吸
    const bob = ud.move > 0.02 ? Math.abs(Math.sin(ud.phase)) * 3.2 * ud.move : Math.sin(ud.breathe) * 0.8;
    group.position.y = ud.baseY + bob;
    parts.torso.rotation.z = sw * 0.05 * ud.move;
  }

  // 徽記旋轉 + 漂浮
  parts.emblem.rotation.y += dt * 1.5;
  parts.emblem.rotation.x += dt * 0.8;
  parts.emblem.position.y = (parts.head.position.y + 16) + Math.sin(ud.breathe * 1.3) * 1.6;

  // 元素使浮球公轉
  if (parts.handR && !ud.skin) {
    for (const o of parts.handR.children) {
      if (o.userData && o.userData.orbit !== undefined) {
        const a = ud.breathe * 2 + o.userData.orbit * (Math.PI * 2 / 3);
        o.position.set(4 + Math.cos(a) * 5, 2, Math.sin(a) * 5);
      }
    }
  }

  // ---- 狀態環 / 隱身淡出 ----
  const p = info.p;
  const shieldOn = p && p.shield > 0;
  parts.shieldRing.visible = shieldOn;
  if (shieldOn) {
    const pulse = 0.8 + 0.2 * Math.sin(ud.breathe * 4);
    parts.shieldRing.scale.setScalar(pulse);
    parts.shieldRing.material.emissiveIntensity = 1.6 + 0.8 * pulse;
  }
  const rageOn = p && p.effects && p.effects.rage;
  parts.rageRing.visible = !!rageOn;
  if (rageOn) {
    const pulse = 0.85 + 0.15 * Math.sin(ud.breathe * 6);
    parts.rageRing.scale.setScalar(pulse);
  }

  const burnOn = p && p.effects && p.effects.burn;
  parts.burnRing.visible = !!burnOn;
  if (burnOn) {
    const pulse = 0.8 + 0.2 * Math.sin(ud.breathe * 9);
    parts.burnRing.scale.setScalar(pulse);
    parts.burnRing.material.emissiveIntensity = 1.8 + 1.0 * pulse;
  }

  // 凍結外殼：快速閃燈 + 旋轉
  const frozenOn = p && p.effects && p.effects.frozen;
  parts.frozenRingLow.visible = !!frozenOn;
  parts.frozenRingHigh.visible = !!frozenOn;
  if (frozenOn) {
    const pulse = 0.88 + 0.12 * Math.sin(ud.breathe * 12);
    const spin = ud.breathe * 0.8; // 慢速旋轉
    parts.frozenRingLow.scale.setScalar(pulse);
    parts.frozenRingHigh.scale.setScalar(pulse);
    parts.frozenRingLow.rotation.z = spin;
    parts.frozenRingHigh.rotation.z = -spin * 1.4;
    const glow = 2.6 + 1.4 * Math.sin(ud.breathe * 14);
    parts.frozenRingLow.material.emissiveIntensity = glow;
    parts.frozenRingHigh.material.emissiveIntensity = glow * 0.85;
  }

  // ---- 臉部表情：中性 / 專注(出手) / 痛苦(受擊)；hurt 優先 ----
  if (parts.face && !ud.skin) {
    const f = parts.face;
    let tEye = 1, tBrowTilt = 0, tBrowY = 0, tMouth = 1, tFlinch = 0;
    if (ud.hurtT > 0) {
      const k = ud.hurtT / 0.42;
      tEye = 0.25; tBrowTilt = -0.5; tBrowY = 0.9; tMouth = 2.4; tFlinch = 0.6 * k;
    } else if (ud.focusT > 0) {
      tEye = 0.6; tBrowTilt = 0.5; tBrowY = -0.6; tMouth = 0.55;
    }
    const ease = Math.min(1, dt * 16);
    ud.eEye += (tEye - ud.eEye) * ease;
    ud.eBrowTilt += (tBrowTilt - ud.eBrowTilt) * ease;
    ud.eBrowY += (tBrowY - ud.eBrowY) * ease;
    ud.eMouth += (tMouth - ud.eMouth) * ease;
    ud.eFlinch += (tFlinch - ud.eFlinch) * ease;
    f.eyeL.scale.y = f.eyeR.scale.y = ud.eEye;
    f.browL.rotation.x = ud.eBrowTilt;
    f.browR.rotation.x = -ud.eBrowTilt;
    f.browL.position.y = f.browR.position.y = f.browY + ud.eBrowY;
    f.mouth.scale.y = ud.eMouth;
    f.group.position.x = -ud.eFlinch * 1.6;
    f.group.rotation.z = ud.eFlinch * 0.18;
  }

  // 隱身：淡化所有皮膚材質 (敵人更透明、自己半透明)
  // 倒地 (闖關復活機制)：灰化半透明 + 前傾倒地姿態，讓隊友看得到、找得到去復活。
  if (info.downed) {
    group.position.y = (ud.baseY || 0) + 2;
    group.rotation.x = Math.PI * 0.42;
  } else if (group.rotation.x) {
    group.rotation.x += (0 - group.rotation.x) * Math.min(1, dt * 12); // 復活後回正
    if (Math.abs(group.rotation.x) < 0.01) group.rotation.x = 0;
  }
  const invis = p && p.effects && p.effects.invis;
  let targetOp = info.downed ? 0.5 : 1;
  if (invis) targetOp = info.isSelf ? 0.42 : 0.12;
  for (const m of ud.skinMats) {
    m.opacity += (targetOp - m.opacity) * Math.min(1, dt * 10);
  }
  if (ud.skin) {
    for (const m of ud.skin.glbMats) {
      m.opacity += (targetOp - m.opacity) * Math.min(1, dt * 10);
    }
  }
}
