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

import { buildWarrior } from './classes/warrior.js';
import { buildMage } from './classes/mage.js';
import { buildAssassin } from './classes/assassin.js';
import { buildTank } from './classes/tank.js';
import { buildArcher } from './classes/archer.js';
import { buildHealer } from './classes/healer.js';
import { buildBerserker } from './classes/berserker.js';
import { buildNinja } from './classes/ninja.js';
import { buildElementalist } from './classes/elementalist.js';
import { buildFighter } from './classes/fighter.js';
import { buildPaladin } from './classes/paladin.js';
import { buildHexer } from './classes/hexer.js';
import { buildBard } from './classes/bard.js';
import { buildSamurai } from './classes/samurai.js';
import { buildGunslinger } from './classes/gunslinger.js';
import { buildSummoner } from './classes/summoner.js';
import { buildNecromancer } from './classes/necromancer.js';
import { buildChronomancer } from './classes/chronomancer.js';
import { buildDefault } from './classes/default.js';

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
  10: { bulk: 2.5, weapon: 'warhammer' },          // 聖騎士
  11: { bulk: 1.82, weapon: 'hexstaff', robe: true }, // 咒術師
  12: { bulk: 1.74, weapon: 'lute' },              // 吟遊詩人
  13: { bulk: 2.04, weapon: 'katana' },            // 武士
  14: { bulk: 1.8, weapon: 'dualguns' },           // 槍手
  15: { bulk: 1.92, weapon: 'summonorb', robe: true }, // 召喚師
  16: { bulk: 1.92, weapon: 'scythe', robe: true },  // 死靈法師
  17: { bulk: 1.86, weapon: 'clockstaff', robe: true }, // 時空術士
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
  10: 'metal', 11: 'cloth', 12: 'cloth', 13: 'metal', 14: 'leather',
  15: 'cloth', 16: 'cloth', 17: 'cloth',
};
const HEADGEAR = {
  0: 'helm', 1: 'hat', 2: 'hood', 3: 'helm', 4: 'hood',
  5: 'hood', 6: 'horns', 7: 'mask', 8: 'hood', 9: 'band',
  10: 'helm', 11: 'hood', 12: 'hat', 13: 'helm', 14: 'hat',
  15: 'hood', 16: 'hood', 17: 'hood',
};
const PAULDRONS = new Set([0, 3, 6, 10, 13]); // 重甲系加肩甲

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
  
  // 為了達成修長且比例協調的三頭身 (Chibi 3-Head-High Mecha) 比例：
  // 拉長軀幹與四肢長度，並將頭部微幅縮小。
  const torsoW = 18 * bulk, torsoD = 12 * bulk, torsoH = 18;
  const hipY = 14;
  const shoulderY = hipY + torsoH;
  const headY = shoulderY + 7.5 * bulk;

  // 質感 (程序化後備皮膚)：機器人質感均採用 metal 或帶有精緻感的塗裝
  const skinKind = SKIN_KIND[charId] || (bossModel ? (bossModel.robe ? 'cloth' : 'metal') : 'cloth');
  const kRough = skinKind === 'metal' ? 0.35 : skinKind === 'leather' ? 0.55 : skinKind === 'cloth' ? 0.65 : 0.5;
  const kMetal = skinKind === 'metal' ? 0.8 : skinKind === 'leather' ? 0.25 : skinKind === 'cloth' ? 0.15 : 0.3;
  const bodyTex = panelTexture(base, skinKind);

  // 基礎材質快取供子模塊使用
  const defaultBodyMat = reg(mat(0xffffff, { rough: kRough, metal: kMetal, map: bodyTex }));
  const defaultHeadMat = reg(mat(shade(base, 0.18), { rough: 0.4, metal: 0.5 }));
  const defaultArmMat = reg(mat(0xd2d2d2, { rough: kRough + 0.05, metal: kMetal, map: bodyTex }));
  const defaultBootMat = reg(mat(shade(base, -0.15), { metal: 0.8, rough: 0.25 }));
  const defaultAccentMat = reg(mat(shade(base, 0.35), { metal: 0.9, rough: 0.1, emissive: new THREE.Color(base), ei: 1.5 }));
  const darkMat = reg(mat(0x2d3436, { metal: 0.7, rough: 0.3 }));
  const goldMat = reg(mat(0xffd700, { metal: 0.85, rough: 0.15 }));
  const helmMat = reg(mat(shade(base, 0.05), { metal: 0.85, rough: 0.2 }));
  const accentHelmMat = reg(mat(shade(base, 0.35), { metal: 0.9, rough: 0.1, emissive: new THREE.Color(base), ei: 1.5 }));
  const darkHelmMat = reg(mat(0x2d3436, { metal: 0.7, rough: 0.3 }));

  const accents = [];
  const addAccent = (m) => { m.castShadow = true; group.add(m); accents.push(m); return m; };

  const shoulderX = torsoW * 0.55 + 2.5;
  const hipX = torsoW * 0.3;
  const armLen = 15;

  const mkLimb = (px, pz, isArm, limbMat = defaultArmMat, bootMat = defaultBootMat, ringCol = base, limbW = null, limbLen = null) => {
    const pivot = new THREE.Group();
    pivot.position.set(px, isArm ? shoulderY - 1 : hipY, pz);
    
    const len = limbLen || 15;
    const w = limbW || (isArm ? 4.5 * bulk : 5.5 * bulk);
    
    const upperLimb = new THREE.Mesh(new THREE.BoxGeometry(w, len * 0.65, w), limbMat);
    upperLimb.position.y = -len * 0.325;
    upperLimb.castShadow = true;
    pivot.add(upperLimb);
    
    const bootW = w * 1.35;
    const bootH = len * 0.35;
    const lowerArmor = new THREE.Mesh(new THREE.BoxGeometry(bootW, bootH, bootW), bootMat);
    lowerArmor.position.y = -len * 0.65 - bootH / 2;
    lowerArmor.castShadow = true;
    pivot.add(lowerArmor);

    const ringMat = reg(mat(ringCol, { emissive: ringCol, ei: 2.2 }));
    const ring = new THREE.Mesh(new THREE.BoxGeometry(bootW + 0.6, 1.0, bootW + 0.6), ringMat);
    ring.position.y = -len * 0.65;
    pivot.add(ring);

    group.add(pivot);
    return pivot;
  };

  // 臉部表情容器
  const faceGroup = new THREE.Group();
  faceGroup.position.set(0, headY, 0);
  group.add(faceGroup);

  const frontX = 7.5 * bulk;
  const face = {
    group: faceGroup,
    eyeL: new THREE.Group(),
    eyeR: new THREE.Group(),
    browL: new THREE.Group(),
    browR: new THREE.Group(),
    mouth: new THREE.Group(),
    browY: 0,
    mouthY: 0,
    eyeY: 0,
    frontX: frontX
  };

  const helmAddons = new THREE.Group();
  helmAddons.position.set(0, headY, 0);
  group.add(helmAddons);

  // 建立 Context
  const ctx = {
    THREE,
    charId,
    base,
    bulk,
    cfg,
    ch,
    reg,
    mat,
    shade,
    torsoW,
    torsoD,
    torsoH,
    hipY,
    shoulderY,
    headY,
    shoulderX,
    hipX,
    armLen,
    frontX,
    bodyTex,
    defaultBodyMat,
    defaultHeadMat,
    defaultArmMat,
    defaultBootMat,
    defaultAccentMat,
    darkMat,
    goldMat,
    helmMat,
    accentHelmMat,
    darkHelmMat,
    face,
    faceGroup,
    helmAddons,
    mkLimb,
    addAccent,
  };

  // 依職業分流至個別檔案模組進行建模
  let parts;
  switch (charId) {
    case 0:
      parts = buildWarrior(ctx);
      break;
    case 1:
      parts = buildMage(ctx);
      break;
    case 2:
      parts = buildAssassin(ctx);
      break;
    case 3:
      parts = buildTank(ctx);
      break;
    case 4:
      parts = buildArcher(ctx);
      break;
    case 5:
      parts = buildHealer(ctx);
      break;
    case 6:
      parts = buildBerserker(ctx);
      break;
    case 7:
      parts = buildNinja(ctx);
      break;
    case 8:
      parts = buildElementalist(ctx);
      break;
    case 9:
      parts = buildFighter(ctx);
      break;
    case 10:
      parts = buildPaladin(ctx);
      break;
    case 11:
      parts = buildHexer(ctx);
      break;
    case 12:
      parts = buildBard(ctx);
      break;
    case 13:
      parts = buildSamurai(ctx);
      break;
    case 14:
      parts = buildGunslinger(ctx);
      break;
    case 15:
      parts = buildSummoner(ctx);
      break;
    case 16:
      parts = buildNecromancer(ctx);
      break;
    case 17:
      parts = buildChronomancer(ctx);
      break;
    default:
      parts = buildDefault(ctx);
      break;
  }

  const { torso, head, armL, armR, legL, legR } = parts;

  // 設定與定位軀幹
  torso.position.y = hipY + torsoH / 2;
  torso.castShadow = true;
  group.add(torso);

  // 設定與定位頭部
  head.position.y = headY;
  head.castShadow = true;
  group.add(head);

  // 武器掛載右手末端
  const handR = new THREE.Group();
  handR.position.y = -armLen;
  armR.add(handR);
  buildWeapon(handR, cfg.weapon, base, reg);

  // 頭頂發光識別徽記 (移至大頭上方)
  const emMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(base), emissive: new THREE.Color(base), emissiveIntensity: 1.1,
    roughness: 0.35, metalness: 0.1,
  });
  let emGeo;
  if (ch.shape === 'square') emGeo = new THREE.BoxGeometry(5.5, 5.5, 5.5);
  else if (ch.shape === 'triangle') emGeo = new THREE.TetrahedronGeometry(5);
  else emGeo = new THREE.IcosahedronGeometry(4.2, 0);
  const emblem = new THREE.Mesh(emGeo, emMat);
  emblem.position.y = headY + 14;
  group.add(emblem);

  // 腳下接觸陰影圈
  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(torsoW * 0.75, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.34 })
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.6;
  group.add(blob);

  // 狀態效果環
  const shieldRing = new THREE.Mesh(
    new THREE.TorusGeometry(torsoW * 0.95, 1.6, 8, 36),
    new THREE.MeshStandardMaterial({ color: 0x9fe8ff, emissive: 0x49d0ff, emissiveIntensity: 2.2, transparent: true, opacity: 0.9 })
  );
  shieldRing.rotation.x = -Math.PI / 2;
  shieldRing.position.y = 2;
  shieldRing.visible = false;
  group.add(shieldRing);

  const rageRing = new THREE.Mesh(
    new THREE.TorusGeometry(torsoW * 1.05, 2.2, 8, 36),
    new THREE.MeshStandardMaterial({ color: 0xff5a3c, emissive: 0xff2a14, emissiveIntensity: 2.6, transparent: true, opacity: 0.85 })
  );
  rageRing.rotation.x = -Math.PI / 2;
  rageRing.position.y = 2;
  rageRing.visible = false;
  group.add(rageRing);

  const burnRing = new THREE.Mesh(
    new THREE.TorusGeometry(torsoW * 1.0, 1.4, 8, 32),
    new THREE.MeshStandardMaterial({ color: 0xff7a3d, emissive: 0xff5a1f, emissiveIntensity: 2.4, transparent: true, opacity: 0.8 })
  );
  burnRing.rotation.x = -Math.PI / 2;
  burnRing.position.y = 3;
  burnRing.visible = false;
  group.add(burnRing);

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
  frozenRingHigh.position.y = headY + 14;
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
    atkT: 0, atkDur: 0, atkKind: 'swing',
    hurtT: 0, focusT: 0,
    eEye: 1, eBrowTilt: 0, eBrowY: 0, eMouth: 1, eFlinch: 0,
  };

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

    // 魔王護盾殼：R5 巨兵＝機械線框力場(科技感)；R6 死靈＝旋轉符文環＋柔和靈光球(魔法感)。
    // 強度由 renderer 算 coreShielded(0..1) 傳入；越強越濃，清光即消失 (見 animateModel)。
    if (ch.mechanic && (ch.mechanic.coreArmorUntilPartsDown || ch.mechanic.minionShield)) {
      const cy = hipY + torsoH * 0.6;
      const shieldMats = [];
      let shield;
      if (ch.mechanic.minionShield) {
        // R6 魔法結界：3 道不同傾角的符文環 + 柔和靈光球。用魔王體色(紫)系做神秘感，不用科技綠
        shield = new THREE.Group();
        shield.position.set(0, cy, 0);
        const ringCols = [shade(base, 0.42), new THREE.Color(base), shade(base, 0.18)];
        const tilts = [[0, 0, 0], [Math.PI / 2, 0, 0.5], [Math.PI / 2.4, 0.9, 0]];
        for (let i = 0; i < 3; i++) {
          const rm = new THREE.MeshBasicMaterial({ color: ringCols[i], transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
          rm.userData.base = 0.6;
          const ring = new THREE.Mesh(new THREE.TorusGeometry(torsoW * (0.84 + i * 0.07), 1.3, 8, 44), rm);
          ring.rotation.set(tilts[i][0], tilts[i][1], tilts[i][2]);
          ring.userData.spin = 0.5 + i * 0.35;
          shield.add(ring); shieldMats.push(rm);
        }
        const am = new THREE.MeshBasicMaterial({ color: shade(base, 0.25), transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false });
        am.userData.base = 0.16;
        shield.add(new THREE.Mesh(new THREE.SphereGeometry(torsoW * 0.9, 20, 16), am));
        shieldMats.push(am);
      } else {
        // R5 機械力場：線框多面體 (翻滾)
        const m = new THREE.MeshBasicMaterial({ color: coreCol, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, wireframe: true });
        m.userData.base = 0.18;
        shield = new THREE.Mesh(new THREE.IcosahedronGeometry(torsoW * 0.95, 1), m);
        shield.position.set(0, cy, 0);
        shield.userData.tumbleX = true;
        shieldMats.push(m);
      }
      group.add(shield);
      group.userData.coreShield = shield;
      group.userData.coreShieldMats = shieldMats;
    }

    // 弱點教學視覺。模型面向 +X(前)、背在 -X。依機制畫不同提示：
    //   backWeak (R1)  → 背側「緋紅軟肋」(站進去轉金，正向引導)
    //   frontArmor(R3) → 背側緋紅軟肋(打這裡) + 正面「鋼藍重甲弧」(站正面轉橘警示)
    const mech = ch.mechanic;
    if (mech && (mech.backWeak || mech.frontArmor)) {
      const wz = {};
      // 背側軟肋 (兩種機制都適用：背後都是「該打」的地方)
      const softCol = new THREE.Color('#ff5a6a'); // 緋紅 = 打這裡
      const marker = new THREE.Mesh(
        new THREE.OctahedronGeometry(torsoW * 0.13, 0),
        new THREE.MeshStandardMaterial({ color: softCol, emissive: softCol, emissiveIntensity: 2.0, roughness: 0.25, metalness: 0.3, transparent: true, opacity: 0.92 })
      );
      marker.position.set(-(torsoD * 0.5 + torsoW * 0.06), hipY + torsoH * 0.62, 0);
      group.add(marker);
      const backArc = new THREE.Mesh(
        new THREE.RingGeometry(torsoW * 1.45, torsoW * 1.72, 48, 1, Math.PI - 0.95, 1.9),
        new THREE.MeshBasicMaterial({ color: softCol, transparent: true, opacity: 0.1, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      backArc.rotation.x = -Math.PI / 2; backArc.position.y = 1.4; group.add(backArc);
      wz.back = { marker, arc: backArc };
      // 正面重甲弧 (僅 frontArmor 王，如 R3)：鋼藍、平時低調；自己站正面時轉橘警示「擋下/減傷」
      if (mech.frontArmor) {
        const frontArc = new THREE.Mesh(
          new THREE.RingGeometry(torsoW * 1.4, torsoW * 1.68, 48, 1, -0.9, 1.8),
          new THREE.MeshBasicMaterial({ color: new THREE.Color('#8fa9c8'), transparent: true, opacity: 0.12, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
        );
        frontArc.rotation.x = -Math.PI / 2; frontArc.position.y = 1.32; group.add(frontArc);
        wz.front = { arc: frontArc };
      }
      group.userData.weakZone = wz;
    }
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
  const steel = reg(mat(0xb9c4cf, { rough: 0.2, metal: 0.9 }));
  const dark = reg(mat(0x2d3436, { rough: 0.6, metal: 0.5 }));
  const gold = reg(mat(0xffd700, { rough: 0.15, metal: 0.9 }));
  const accent = reg(mat(shade(base, 0.25), { emissive: new THREE.Color(base), ei: 2.8 }));
  const add = (m, x, y, z, rx = 0, ry = 0, rz = 0) => {
    m.castShadow = true; m.position.set(x, y, z); m.rotation.set(rx, ry, rz); hand.add(m); return m;
  };
  
  switch (type) {
    case 'sword': { // 戰士：巨型光束大劍 (Giant Beam Saber)
      // 巨大發光光束刃
      const blade = add(new THREE.Mesh(new THREE.BoxGeometry(4.5, 48, 1.6), accent), 4, 12, 0);
      // 劍身側翼裝甲 (鋼製)
      add(new THREE.Mesh(new THREE.BoxGeometry(5.2, 10, 0.8), steel), 4, 2, 0);
      // 金色裝甲護手
      add(new THREE.Mesh(new THREE.BoxGeometry(10, 4.5, 10), gold), 4, -12.5, 0);
      // 重型劍柄
      add(new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 16, 8), dark), 4, -22.5, 0);
      // 劍柄配重發光核心
      add(new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 8), accent), 4, -31, 0);
      break;
    }
    case 'axes':
    case 'axe': { // 狂戰士：雙重熱能巨斧 (Twin Heat Tomahawks)
      // 巨型斧柄
      add(new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 52, 8), dark), 3, -10, 0);
      // 巨大雙刃高熱發光斧面
      const bladeL = add(new THREE.Mesh(new THREE.BoxGeometry(11, 24, 1.6), accent), 3, 10, 5.5);
      const bladeR = add(new THREE.Mesh(new THREE.BoxGeometry(11, 24, 1.6), accent), 3, 10, -5.5);
      // 斧頭主體結構 (鋼製)
      add(new THREE.Mesh(new THREE.BoxGeometry(7, 18, 9), steel), 3, 10, 0);
      // 金色金屬箍與頂部發光尖刺
      add(new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 5, 8), gold), 3, 10, 0);
      add(new THREE.Mesh(new THREE.ConeGeometry(2.0, 9, 6), steel), 3, 20, 0);
      break;
    }
    case 'daggers': { // 刺客：等離子巨刃爪 (Giant Plasma Blades)
      // 手部大型腕部掛載座 (Katar 樣式)
      add(new THREE.Mesh(new THREE.BoxGeometry(8, 4, 8), dark), 3, 1, 0);
      // 兩片巨大向外斜的光束利刃
      const bladeL = add(new THREE.Mesh(new THREE.BoxGeometry(2.2, 28, 0.6), accent), 3, 15, -2.5);
      bladeL.rotation.z = 0.08;
      const bladeR = add(new THREE.Mesh(new THREE.BoxGeometry(2.2, 28, 0.6), accent), 3, 15, 2.5);
      bladeR.rotation.z = -0.08;
      // 金屬連接裝甲
      add(new THREE.Mesh(new THREE.BoxGeometry(9, 6, 2.2), steel), 3, 2, 0);
      break;
    }
    case 'kunai': { // 忍者：量子雷射巨型苦無 (Giant Quantum Kunai)
      // 巨型苦無刀身
      add(new THREE.Mesh(new THREE.ConeGeometry(4.5, 26, 4), accent), 3, 10, 0, 0, 0, Math.PI);
      // 苦無柄
      add(new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 12, 8), steel), 3, 20, 0);
      // 尾端金色量子鐵環
      add(new THREE.Mesh(new THREE.TorusGeometry(3.5, 0.8, 6, 10), gold), 3, 26, 0, Math.PI / 2, 0, 0);
      break;
    }
    case 'staff': { // 法師：粒子光束巨砲杖 (Megacannon Staff)
      // 巨型槍炮杖身
      add(new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 56, 8), dark), 3, -4, 0);
      // 金色巨砲發射器支架
      add(new THREE.Mesh(new THREE.TorusGeometry(7.2, 1.6, 8, 20), gold), 3, 26, 0);
      add(new THREE.Mesh(new THREE.CylinderGeometry(3.8, 4.8, 12, 8), steel), 3, 26, 0);
      // 大型懸浮粒子發光水晶核心
      const crystal = add(new THREE.Mesh(new THREE.IcosahedronGeometry(5.2, 0), accent), 3, 26, 0);
      crystal.userData = { glow: true };
      break;
    }
    case 'orb': { // 治療師：奈米修復十字巨杖 (Nanite Cross Staff)
      // 巨型權杖把手
      add(new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 52, 8), steel), 3, -6, 0);
      // 頂部巨型十字架裝飾
      const scepterHead = new THREE.Group();
      const crossV = new THREE.Mesh(new THREE.BoxGeometry(1.5, 14, 1.5), gold);
      const crossH = new THREE.Mesh(new THREE.BoxGeometry(9, 1.5, 1.5), gold);
      crossH.position.y = 3.2;
      scepterHead.add(crossV);
      scepterHead.add(crossH);
      // 旋繞十字架的大型奈米發光環
      const ring = new THREE.Mesh(new THREE.TorusGeometry(8, 0.8, 8, 24), accent);
      ring.position.y = 3.2;
      scepterHead.add(ring);
      // 頂部中心神聖水晶
      const holyGem = new THREE.Mesh(new THREE.IcosahedronGeometry(2.6, 0), accent);
      holyGem.position.set(0, 3.2, 0);
      scepterHead.add(holyGem);
      add(scepterHead, 3, 25, 0);
      break;
    }
    case 'bow': { // 弓箭手：脈衝強襲光束巨弓 (Strike Beam Bow)
      const bowGroup = new THREE.Group();
      // 巨大弧形 mecha 弓翼
      const wingL = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 0.8, 28, 6), steel);
      wingL.position.set(-8, 12, 0);
      wingL.rotation.z = -0.5;
      bowGroup.add(wingL);
      const wingR = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 0.8, 28, 6), steel);
      wingR.position.set(-8, -12, 0);
      wingR.rotation.z = 0.5;
      bowGroup.add(wingR);
      
      // 金色弓把
      const grip = new THREE.Mesh(new THREE.BoxGeometry(4, 9, 4), gold);
      grip.position.set(-16, 0, 0);
      bowGroup.add(grip);
      
      // 脈衝能量弦
      const string = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 48, 4), accent);
      string.position.set(-4, 0, 0);
      bowGroup.add(string);
      
      // 巨大發光光束箭
      const arrow = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 38, 4), accent);
      arrow.rotation.z = Math.PI / 2;
      arrow.position.set(-2, 0, 0);
      bowGroup.add(arrow);
      
      add(bowGroup, 4, -4, 0, 0, Math.PI / 2, 0);
      break;
    }
    case 'shield': { // 坦克：重裝鋼彈巨型防禦盾 (Gundam Mega Shield)
      // 巨大盾牌主體：重型厚裝甲板 (幾乎覆蓋半身)
      add(new THREE.Mesh(new THREE.BoxGeometry(4.5, 42, 28), steel), 5, -2, 0);
      // 盾面裝甲飾條
      add(new THREE.Mesh(new THREE.BoxGeometry(5.0, 44, 3.5), gold), 5, -2, 14);
      add(new THREE.Mesh(new THREE.BoxGeometry(5.0, 44, 3.5), gold), 5, -2, -14);
      add(new THREE.Mesh(new THREE.BoxGeometry(5.0, 3.5, 31), gold), 5, 19, 0);
      add(new THREE.Mesh(new THREE.BoxGeometry(5.0, 3.5, 31), gold), 5, -23, 0);
      // 盾面中央發光的巨型反應堆徽記
      add(new THREE.Mesh(new THREE.SphereGeometry(6, 12, 12), accent), 7.2, -2, 0);
      break;
    }
    case 'gloves': { // 格鬥家：火箭噴射動力鋼拳 (Heavy Rocket Gauntlets)
      // 巨大鋼拳護套 (覆蓋手部)
      const glove = add(new THREE.Mesh(new THREE.BoxGeometry(11, 11, 11), dark), 3, -1, 0);
      // 火箭噴射口 (手背)
      const nozzle = add(new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.5, 4, 8), steel), -3.5, -1, 0);
      nozzle.rotation.z = -Math.PI / 2;
      const flame = add(new THREE.Mesh(new THREE.ConeGeometry(1.2, 6, 8), reg(mat(0xff4500, { emissive: 0xff4500, ei: 2.2 }))), -7.5, -1, 0);
      flame.rotation.z = -Math.PI / 2;
      
      // 拳面巨大金色撞擊角
      for (let i = -1; i <= 1; i++) {
        add(new THREE.Mesh(new THREE.ConeGeometry(2.0, 5.5, 4), gold), 9.2, -1, i * 3.2, 0, 0, -Math.PI / 2);
      }
      // 護拳發光能量飾條
      add(new THREE.Mesh(new THREE.BoxGeometry(11.4, 2.6, 11.4), accent), 3, 3, 0);
      break;
    }
    case 'elements': { // 元素使：感應浮游砲 (Giant Funnels / Bits)
      // 三個感應浮游裝備
      for (let i = 0; i < 3; i++) {
        const funnel = new THREE.Group();
        // 浮游砲本體 (菱形裝甲)
        const body = new THREE.Mesh(new THREE.BoxGeometry(3.5, 12, 3.5), steel);
        body.castShadow = true;
        funnel.add(body);
        // 前端發光粒子射口
        const emitter = new THREE.Mesh(new THREE.ConeGeometry(2.2, 5, 4), accent);
        emitter.position.y = 7.5;
        funnel.add(emitter);
        // 尾端發光推進噴口
        const thruster = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.8, 3, 6), dark);
        thruster.position.y = -7.5;
        funnel.add(thruster);
        
        const o = add(funnel, 4, 0, 0);
        o.userData.orbit = i;
      }
      break;
    }
    case 'warhammer': { // 聖騎士：黃金聖光戰錘
      add(new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 46, 8), dark), 3, -6, 0); // 長柄
      add(new THREE.Mesh(new THREE.BoxGeometry(13, 14, 13), steel), 3, 18, 0);          // 錘頭
      add(new THREE.Mesh(new THREE.BoxGeometry(14, 4.5, 4.5), gold), 3, 18, 0);         // 金箍十字
      add(new THREE.Mesh(new THREE.BoxGeometry(4.5, 14, 4.5), gold), 3, 18, 0);
      add(new THREE.Mesh(new THREE.IcosahedronGeometry(3.2, 0), accent), 3, 18, 0);     // 發光聖光核心
      add(new THREE.Mesh(new THREE.ConeGeometry(2.2, 8, 6), gold), 3, 27.5, 0);         // 頂尖
      break;
    }
    case 'hexstaff': { // 咒術師：詛咒法杖 (骷髏 + 紫晶)
      add(new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 52, 8), dark), 3, -2, 0);
      add(new THREE.Mesh(new THREE.IcosahedronGeometry(4.4, 0), reg(mat(0xe8e2d0, { rough: 0.5 }))), 3, 26, 0); // 骷髏(近似)
      add(new THREE.Mesh(new THREE.TorusGeometry(6.2, 0.8, 6, 18), accent), 3, 26, 0, Math.PI / 2, 0, 0);       // 環繞符環
      const hexGem = add(new THREE.Mesh(new THREE.OctahedronGeometry(3.2, 0), accent), 3, 33.5, 0);
      hexGem.userData = { glow: true };
      break;
    }
    case 'lute': { // 吟遊詩人：魯特琴
      const woodMat = reg(mat(0x8a5a2b, { rough: 0.6, metal: 0.1 }));
      add(new THREE.Mesh(new THREE.SphereGeometry(7, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), woodMat), 3, 0, 0, Math.PI, 0, 0); // 琴身(半球)
      add(new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 22, 8), woodMat), 3, 13, 0);  // 琴頸
      add(new THREE.Mesh(new THREE.BoxGeometry(3, 4, 2.2), dark), 3, 25, 0);                 // 琴頭
      add(new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.4, 6, 16), gold), 4.4, 1, 0, Math.PI / 2, 0, 0); // 音孔
      for (let i = -1; i <= 1; i++) add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 22, 4), accent), 4.2, 13, i * 1.2); // 琴弦發光
      break;
    }
    case 'katana': { // 武士：緋紅太刀
      add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 50, 3.6), accent), 3, 18, 0);   // 刀身(發光刃)
      add(new THREE.Mesh(new THREE.BoxGeometry(2.2, 50, 1.2), steel), 3, 18, 0);    // 刀脊
      add(new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 1.2, 4), gold), 3, -6, 0, 0, Math.PI / 4, 0); // 鍔(方形護手)
      add(new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 12, 8), dark), 3, -12, 0); // 柄
      break;
    }
    case 'dualguns': { // 槍手：雙重型手槍
      const gunMat = reg(mat(0x4a4a4a, { metal: 0.85, rough: 0.25 }));
      for (const sz of [-1, 1]) {
        add(new THREE.Mesh(new THREE.BoxGeometry(14, 4, 2.4), gunMat), 6, 0, sz * 3.4);     // 槍管朝前(+X)
        add(new THREE.Mesh(new THREE.BoxGeometry(4, 7, 2.2), dark), 1, -3.5, sz * 3.4);     // 握把
        add(new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 2.8), accent), 12.8, 0.4, sz * 3.4); // 槍口發光
        add(new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 2.0, 8), gold), 3, 0.4, sz * 3.4, Math.PI / 2, 0, 0); // 轉輪
      }
      break;
    }
    case 'summonorb': { // 召喚師：浮空魔導書 + 環繞靈球
      const bookMat = reg(mat(0x0e6b5a, { rough: 0.5, metal: 0.2 }));
      add(new THREE.Mesh(new THREE.BoxGeometry(3, 9, 11), bookMat), 4, 2, 0);             // 書本
      add(new THREE.Mesh(new THREE.BoxGeometry(2.2, 8, 9.6), reg(mat(0xeafff8, { emissive: 0x4fe0c0, ei: 1.2 }))), 5, 2, 0); // 書頁發光
      for (let i = 0; i < 3; i++) { // 三顆環繞靈球 (animateModel 依 orbit 公轉)
        const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(2.0, 0), accent);
        orb.castShadow = true; orb.position.set(4, 2, 0); hand.add(orb);
        orb.userData.orbit = i;
      }
      break;
    }
    case 'scythe': { // 死靈法師：死神鐮刀
      add(new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 56, 8), dark), 3, -2, 0);  // 長桿
      add(new THREE.Mesh(new THREE.TorusGeometry(13, 1.5, 6, 20, Math.PI * 0.9), accent), 3, 26, 0, 0, 0, Math.PI * 0.1); // 彎曲鐮刃(發光)
      add(new THREE.Mesh(new THREE.TorusGeometry(13, 0.6, 6, 20, Math.PI * 0.9), steel), 3.4, 26, 0, 0, 0, Math.PI * 0.1);
      add(new THREE.Mesh(new THREE.IcosahedronGeometry(2.6, 0), accent), 3, 27, 0);      // 連接處幽綠寶石
      break;
    }
    case 'clockstaff': { // 時空術士：時鐘法杖
      add(new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 50, 8), reg(mat(0x2b6c78, { metal: 0.6, rough: 0.3 }))), 3, -3, 0); // 杖身
      add(new THREE.Mesh(new THREE.TorusGeometry(7, 1.0, 8, 24), gold), 3, 25, 0, Math.PI / 2, 0, 0);  // 鐘環
      add(new THREE.Mesh(new THREE.CircleGeometry(6, 20), reg(mat(0xeafdff, { emissive: 0x4dd0e1, ei: 1.4 }))), 3.4, 25, 0, 0, -Math.PI / 2, 0); // 鐘面(發光)
      const clkHand = add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 5, 0.4), accent), 3.7, 25, 0);    // 長指針
      add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 3.4, 0.4), accent), 3.7, 25, 0, 0, 0, Math.PI / 2); // 短指針
      clkHand.userData = { glow: true };
      break;
    }
    default:
      add(new THREE.Mesh(new THREE.BoxGeometry(3.5, 26, 3.5), steel), 4, -4, 0);
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
  // 如果是受擊動畫，加快播放速率，縮短硬直視覺效果，讓其快速回歸移動動畫
  const scale = name === 'hit' ? 1.8 : 1.0;
  act.reset().setEffectiveTimeScale(scale).setEffectiveWeight(1).fadeIn(0.06).play();
  if (s.cur && s.cur !== act) s.cur.fadeOut(0.1);
  s.cur = act;
  s.oneShot = name;
  s.oneShotT = (act.getClip().duration || 0.4) / scale;
}
function driveSkin(ud, dt, info) {
  const s = ud.skin;
  // 我們不需要播放 s.actions.attack (如 agree)，因為我們已在 animateModel 中手動控制手臂與武器揮砍。
  // 這樣角色在攻擊時下半身可以正常播放走路/跑步動畫，徹底解決「施放技能時滑步飄移」的問題！
  if (info.hurt && s.actions.hit) {
    skinPlayOnce(s, 'hit');
  }
  if (s.oneShot) {
    s.oneShotT -= dt;
    if (s.oneShotT <= 0) s.oneShot = null;
  } else {
    // walk/idle 用遲滯雙門檻：跨過 0.6 才走、跌破 0.35 才停，避免在門檻附近反覆 crossfade 抖動
    if (s.moving && ud.move < 0.35) s.moving = false;
    else if (!s.moving && ud.move > 0.6) s.moving = true;
    
    let want = 'idle';
    if (s.moving) {
      // 根據移動速度動態選擇 walk (走路) 還是 run (跑步)
      want = info.speed > 165 ? 'run' : 'walk';
    }
    
    // 如果想要播放的動畫不存在，安全回退
    if (want === 'run' && !s.actions.run) want = 'walk';
    if (want === 'walk' && !s.actions.walk) want = 'run';
    
    if (s.actions[want]) {
      const act = s.actions[want];
      skinFadeTo(s, want, 0.2);
      
      // 動態調整動作播放速率 (timeScale)：速度越快，腳步越快，徹底消除滑步/飄移感
      if (want !== 'idle') {
        const baseSpeed = want === 'run' ? 200 : 130;
        const timeScale = Math.max(0.4, Math.min(2.2, info.speed / baseSpeed));
        act.setEffectiveTimeScale(timeScale);
      } else {
        act.setEffectiveTimeScale(1.0);
      }
    }
  }
  if (!s.cur) {
    const init = s.actions.idle ? 'idle' : (s.actions.walk ? 'walk' : null);
    if (init) skinFadeTo(s, init, 0);
  }
  s.mixer.update(dt);
}

// 動態繪製具有職業特色的 Canvas 材質貼圖
function createHumanoidTexture(charId, baseHex) {
  const key = `humanoid:${charId}:${baseHex}`;
  if (_texCache.has(key)) return _texCache.get(key);

  const S = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const x = cv.getContext('2d');
  const col = new THREE.Color(baseHex);
  const hex = (c) => `#${c.getHexString()}`;

  // 基礎漸層背景
  const grad = x.createLinearGradient(0, 0, 0, S);
  grad.addColorStop(0, hex(col.clone().lerp(new THREE.Color(0xffffff), 0.25)));
  grad.addColorStop(0.5, hex(col));
  grad.addColorStop(1, hex(col.clone().multiplyScalar(0.4)));
  x.fillStyle = grad;
  x.fillRect(0, 0, S, S);

  // 依據角色特性繪製專屬花紋
  x.lineWidth = 4;
  if (charId === 0) { // 戰士：鎧甲板甲線條與金色裝飾
    x.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    for (let i = 0; i < S; i += 64) {
      x.beginPath(); x.moveTo(i, 0); x.lineTo(i, S); x.stroke();
      x.beginPath(); x.moveTo(0, i); x.lineTo(S, i); x.stroke();
    }
    x.fillStyle = 'rgba(255, 215, 0, 0.2)';
    for (let i = 32; i < S; i += 128) {
      x.beginPath(); x.arc(i, i, 12, 0, 7); x.fill();
    }
  } 
  else if (charId === 1) { // 法師：奧術星辰與邊緣法線
    x.fillStyle = 'rgba(255, 255, 255, 0.15)';
    for (let i = 0; i < 40; i++) {
      x.beginPath(); x.arc(Math.random() * S, Math.random() * S, 5 + Math.random() * 8, 0, 7); x.fill();
    }
    x.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    x.lineWidth = 8;
    x.strokeRect(50, 50, S - 100, S - 100);
  }
  else if (charId === 2) { // 刺客：暗影束帶與紫色格紋
    x.fillStyle = '#110b1a';
    for (let i = 0; i < S; i += 32) {
      x.fillRect(0, i, S, 8);
    }
    x.strokeStyle = 'rgba(155, 89, 182, 0.5)';
    x.lineWidth = 12;
    x.beginPath(); x.moveTo(0, 0); x.lineTo(S, S); x.moveTo(S, 0); x.lineTo(0, S); x.stroke();
  }
  else if (charId === 3) { // 坦克：重型金屬鋼板與螺栓
    x.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 0; i < S; i += 128) {
      x.fillRect(i, 0, 24, S);
      x.fillRect(0, i, S, 24);
    }
    x.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    x.lineWidth = 8;
    x.strokeRect(20, 20, S - 40, S - 40);
  }
  else if (charId === 4) { // 弓箭手：皮甲拼貼與林地迷彩
    x.fillStyle = 'rgba(46, 204, 113, 0.4)';
    for (let i = 0; i < 30; i++) {
      x.fillRect(Math.random() * S, Math.random() * S, 60, 30);
    }
  }
  else if (charId === 5) { // 治療師：聖光十字與白絲質地
    x.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    x.lineWidth = 12;
    x.beginPath();
    x.moveTo(S / 2, 40); x.lineTo(S / 2, S - 40);
    x.moveTo(40, S / 2); x.lineTo(S - 40, S / 2);
    x.stroke();
  }
  else if (charId === 6) { // 狂戰士：血腥尖刺與怒火塗鴉
    x.fillStyle = '#e74c3c';
    for (let i = 0; i < 15; i++) {
      x.beginPath();
      const px = Math.random() * S, py = Math.random() * S;
      x.moveTo(px, py); x.lineTo(px + 40, py + 80); x.lineTo(px - 40, py + 80);
      x.closePath(); x.fill();
    }
  }
  else if (charId === 7) { // 忍者：夜行緊身網格與忍具線條
    x.fillStyle = 'rgba(0,0,0,0.5)';
    x.fillRect(0, 0, S, S);
    x.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    x.lineWidth = 3;
    for (let i = 0; i < S; i += 16) {
      x.beginPath(); x.moveTo(i, 0); x.lineTo(i, S); x.stroke();
      x.beginPath(); x.moveTo(0, i); x.lineTo(S, i); x.stroke();
    }
  }
  else if (charId === 8) { // 元素使：三元元素混沌流光
    x.fillStyle = 'rgba(230, 126, 34, 0.4)'; // 火
    x.fillRect(0, 0, S, S/3);
    x.fillStyle = 'rgba(52, 152, 219, 0.4)'; // 冰
    x.fillRect(0, S/3, S, S/3);
    x.fillStyle = 'rgba(241, 196, 15, 0.4)'; // 雷
    x.fillRect(0, 2*S/3, S, S/3);
  }
  else if (charId === 9) { // 格鬥家：武僧服飾滾邊與修煉印記
    x.strokeStyle = '#000000';
    x.lineWidth = 20;
    x.strokeRect(0, 0, S, S);
    x.strokeRect(80, 80, S - 160, S - 160);
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  _texCache.set(key, tex);
  return tex;
}

// 將載入的 GLB 皮膚掛上現有角色群組：隱藏程序化身體，替換材質，並將武器/防具重新綁定至人形骨骼
export function attachSkin(group, skin, charId = 0) {
  const ud = group.userData;
  if (!ud || !skin) return;

  // 1. 隱藏原本程序化生成的積木人四肢與臉部 (手持武器 handR 與頭飾 accents 不隱藏，等下要重新綁定至骨骼)
  for (const k of ['torso', 'head', 'armL', 'armR', 'legL', 'legR']) {
    if (ud.parts[k]) ud.parts[k].visible = false;
  }
  if (ud.parts.face) ud.parts.face.group.visible = false;

  // 肩甲 (pauldrons) 保持 visible，之後會綁定至肩膀/大臂骨骼，使其隨手臂擺動

  // 2. 遍歷 humanoid 的 Mesh，將 Beta_Surface 貼上我們的 Canvas 專屬材質；Beta_Joints 設定為暗金屬色
  const ch = getCharacter(charId);
  const baseColor = ch.color;
  const charTexture = createHumanoidTexture(charId, baseColor);
  const jointColor = new THREE.Color(baseColor).multiplyScalar(0.4);

  const glbMats = [];
  skin.root.traverse((o) => {
    if (o.isMesh) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of ms) {
        m.transparent = true;
        glbMats.push(m);
        
        if (o.name.includes('Joints')) {
          m.color = jointColor;
          m.metalness = 0.85;
          m.roughness = 0.2;
        } else {
          m.map = charTexture;
        }
        m.needsUpdate = true;
      }
    }
  });

  // 3. 遍歷尋找 humanoid 的關鍵骨骼節點 (頭骨、手掌、手臂、脊椎與臀部)
  let headBone = null;
  let rightHandBone = null;
  let rightArmBone = null;
  let rightForeArmBone = null;
  let leftArmBone = null;
  let leftForeArmBone = null;
  let leftHandBone = null;
  let spineBone = null;
  let hipsBone = null;
  skin.root.traverse((o) => {
    if (o.isBone) {
      const nameLower = o.name.toLowerCase();
      if (nameLower.includes('head')) {
        headBone = o;
      } else if (nameLower.includes('righthand') || nameLower.includes('hand_r') || nameLower.includes('handr')) {
        rightHandBone = o;
      } else if (nameLower.includes('rightforearm')) {
        rightForeArmBone = o;
      } else if (nameLower.includes('rightarm')) {
        rightArmBone = o;
      } else if (nameLower.includes('leftforearm')) {
        leftForeArmBone = o;
      } else if (nameLower.includes('leftarm')) {
        leftArmBone = o;
      } else if (nameLower.includes('lefthand') || nameLower.includes('hand_l') || nameLower.includes('handl')) {
        leftHandBone = o;
      } else if (nameLower.includes('spine2') || nameLower.includes('spine1')) {
        spineBone = o;
      } else if (nameLower.includes('hips') || nameLower.includes('pelvis')) {
        hipsBone = o;
      }
    }
  });

  // 4. 動態關節綁定與高度/旋轉微調
  if (headBone && ud.parts.accents) {
    const shoulderY = ud.parts.torso.position.y + 10;
    for (const a of ud.parts.accents) {
      // 只要是高度在肩部以上的配件，都視為頭飾，重新掛載到頭骨下
      if (a.visible && a.position.y > shoulderY + 2) {
        headBone.add(a);
        a.position.set(0, 0, 0);
        a.rotation.set(0, 0, 0);
        
        // 修正帽頭朝向 (繞 X 翻轉)
        a.rotation.x = Math.PI / 2;
        
        // 微調不同職業頭飾的 local 位置、旋轉與縮放
        const hg = HEADGEAR[charId];
        if (hg === 'hat') {
          a.position.y = 10;
          a.position.x = 2;
          a.scale.setScalar(1.2);
        } else if (hg === 'helm') {
          a.position.y = 6;
          a.scale.setScalar(1.1);
        } else if (hg === 'hood') {
          a.position.y = 5;
          a.position.x = -1.2;
          a.scale.setScalar(1.15);
        } else if (hg === 'band') {
          a.position.y = 8;
        } else if (hg === 'mask') {
          a.position.y = 5;
          a.position.x = 1.5;
          a.scale.setScalar(1.1);
        } else if (hg === 'horns') {
          const isLeft = a.position.z < 0;
          a.position.y = 8;
          a.position.x = 2;
          a.position.z = isLeft ? -5.5 : 5.5;
          a.rotation.x = Math.PI / 2 + (isLeft ? -0.4 : 0.4);
          a.scale.setScalar(1.15);
        }
      }
    }
  }

  // 將右手武器掛在右手手腕骨骼下
  if (rightHandBone && ud.parts.handR) {
    rightHandBone.add(ud.parts.handR);
    ud.parts.handR.position.set(0, 0, 0);
    // 修正武器旋轉，使其拿在手上朝前上 (適應 Mixamo 骨骼坐標系)
    ud.parts.handR.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
    ud.parts.handR.scale.setScalar(0.7);
  }

  ud.skin = { mixer: skin.mixer, actions: skin.actions, cfg: skin.cfg, root: skin.root, cur: null, oneShot: null, oneShotT: 0, moving: false, glbMats, rightArmBone, rightForeArmBone, leftArmBone };

  // 5. 重新綁定肩甲 (pauldrons) 到肩膀/大臂骨骼
  const pauldrons = new Set([0, 3, 6]);
  if (ud.parts.accents) {
    const headY = ud.parts.head.position.y;
    let pauldronIdx = 0;
    for (const a of ud.parts.accents) {
      const isPauldron = pauldrons.has(charId) && a.position.y < headY - 4;
      if (isPauldron) {
        if (pauldronIdx === 0 && leftArmBone) {
          leftArmBone.add(a);
          a.position.set(-1.8, 5, 0); // 放在左大臂上方 (肩膀)
          a.rotation.set(0, 0, Math.PI / 4);
          a.scale.setScalar(0.7);
        } else if (pauldronIdx === 1 && rightArmBone) {
          rightArmBone.add(a);
          a.position.set(1.8, 5, 0); // 放在右大臂上方 (肩膀)
          a.rotation.set(0, 0, -Math.PI / 4);
          a.scale.setScalar(0.7);
        }
        pauldronIdx++;
      }
    }
  }

  // 6. 為各職業建立專屬特色 3D 裝備並綁定至對應骨骼
  if (charId === 4 && spineBone) { // 弓箭手：背後箭筒
    const quiverGroup = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.8 });
    const bodyMesh = new THREE.Mesh(new THREE.CylinderGeometry(2, 1.5, 12, 8), bodyMat);
    bodyMesh.castShadow = true;
    quiverGroup.add(bodyMesh);

    const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8, roughness: 0.2 });
    const rimMesh = new THREE.Mesh(new THREE.TorusGeometry(2, 0.4, 8, 12), goldMat);
    rimMesh.rotation.x = Math.PI / 2;
    rimMesh.position.y = 6;
    quiverGroup.add(rimMesh);

    const arrowMat = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, roughness: 0.5 });
    const featherMat = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.5 });
    for (let i = -1; i <= 1; i++) {
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 8, 4), arrowMat);
      shaft.position.set(i * 0.8, 8, 0);
      shaft.rotation.z = i * 0.15;
      quiverGroup.add(shaft);

      const feather = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.8, 0.2), featherMat);
      feather.position.set(i * 0.8, 11, 0);
      quiverGroup.add(feather);
    }
    spineBone.add(quiverGroup);
    quiverGroup.position.set(0, 0, -3.2);
    quiverGroup.rotation.set(0, Math.PI, -0.4);
    quiverGroup.scale.setScalar(0.75);
  }
  else if (charId === 7 && spineBone) { // 忍者：腰後忍卷
    const scrollGroup = new THREE.Group();
    const paperMat = new THREE.MeshStandardMaterial({ color: 0xfdf6e3, roughness: 0.9 });
    const paperMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 11, 8), paperMat);
    paperMesh.rotation.z = Math.PI / 2;
    paperMesh.castShadow = true;
    scrollGroup.add(paperMesh);

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b0000, metalness: 0.1, roughness: 0.6 });
    const capGeom = new THREE.CylinderGeometry(1.9, 1.9, 1.5, 8);
    for (const side of [-1, 1]) {
      const cap = new THREE.Mesh(capGeom, woodMat);
      cap.rotation.z = Math.PI / 2;
      cap.position.x = side * 6;
      scrollGroup.add(cap);
    }

    const ribbonMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
    const ribbon = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.2, 6, 12), ribbonMat);
    scrollGroup.add(ribbon);

    spineBone.add(scrollGroup);
    scrollGroup.position.set(0, -4, -2.4);
    scrollGroup.scale.setScalar(0.85);
  }
  else if (charId === 1 && leftHandBone) { // 法師：左手浮空法術書
    const bookGroup = new THREE.Group();
    const coverMat = new THREE.MeshStandardMaterial({ color: 0x4a148c, roughness: 0.6 });
    const cover = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.4, 5.8), coverMat);
    cover.castShadow = true;
    bookGroup.add(cover);

    const pagesMat = new THREE.MeshStandardMaterial({ color: 0xfffdd0, roughness: 0.9 });
    const pages = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.35, 5.4), pagesMat);
    pages.position.y = 0.05;
    pages.position.x = 0.15;
    bookGroup.add(pages);

    const magicMat = new THREE.MeshStandardMaterial({ color: baseColor, emissive: baseColor, emissiveIntensity: 2.2 });
    const magicOrb = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 0), magicMat);
    magicOrb.position.set(0, 1.2, 0);
    bookGroup.add(magicOrb);

    leftHandBone.add(bookGroup);
    bookGroup.position.set(-3.2, 2.5, 1);
    bookGroup.rotation.set(0.4, -0.2, 0.4);
    bookGroup.scale.setScalar(0.8);
    ud.skin.floatingItem = bookGroup;
  }
  else if (charId === 5 && hipsBone) { // 治療師：腰間金色十字架
    const holyGroup = new THREE.Group();
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.85, roughness: 0.15 });
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.7, 4.8, 0.7), goldMat);
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.7, 0.7), goldMat);
    crossH.position.y = 0.8;
    holyGroup.add(crossV);
    holyGroup.add(crossH);

    const rubyMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 1.5 });
    const ruby = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), rubyMat);
    ruby.position.set(0, 0.8, 0.4);
    holyGroup.add(ruby);

    hipsBone.add(holyGroup);
    holyGroup.position.set(3, -2, 0.5);
    holyGroup.rotation.set(0, -Math.PI / 4, 0.25);
    holyGroup.scale.setScalar(0.9);
  }
  else if (charId === 9 && leftForeArmBone && rightForeArmBone) { // 格鬥家：雙腕金屬護腕
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8, roughness: 0.2 });
    const leftBrace = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.4, 4, 8), goldMat);
    leftBrace.rotation.x = Math.PI / 2;
    leftBrace.position.set(0, 5, 0);
    leftForeArmBone.add(leftBrace);

    const rightBrace = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.4, 4, 8), goldMat);
    rightBrace.rotation.x = Math.PI / 2;
    rightBrace.position.set(0, 5, 0);
    rightForeArmBone.add(rightBrace);
  }

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
    
    // 手動重寫攻擊姿勢的骨骼旋轉，使動作更自然
    if (ud.atkT > 0 && ud.atkDur > 0) {
      const ap = 1 - ud.atkT / ud.atkDur;
      const s = ud.skin;
      if (ud.atkKind === 'cast') {
        const z = castArmZ(ap);
        if (s.rightArmBone) {
          s.rightArmBone.rotation.z = -Math.PI / 3 - z * 0.4;
          s.rightArmBone.rotation.y = -z * 0.5;
        }
        if (s.leftArmBone) {
          s.leftArmBone.rotation.z = Math.PI / 3 + z * 0.4;
          s.leftArmBone.rotation.y = z * 0.5;
        }
      } else {
        const swing = swingArmZ(ap);
        if (s.rightArmBone) {
          s.rightArmBone.rotation.z = -Math.PI / 3;
          s.rightArmBone.rotation.y = swing * 1.2;
        }
        if (s.rightForeArmBone) {
          s.rightForeArmBone.rotation.y = Math.sin(ap * Math.PI) * 0.6;
        }
      }
    }
    
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

  // 元素使浮球公轉 (適用程序化模型與 GLB 皮膚模型)
  if (parts.handR) {
    for (const o of parts.handR.children) {
      if (o.userData && o.userData.orbit !== undefined) {
        const a = ud.breathe * 2 + o.userData.orbit * (Math.PI * 2 / 3);
        o.position.set(4 + Math.cos(a) * 5, 2, Math.sin(a) * 5);
      }
    }
  }

  // 法師浮空法術書懸浮與旋轉動畫
  if (ud.skin && ud.skin.floatingItem) {
    const book = ud.skin.floatingItem;
    book.position.y = 2.5 + Math.sin(ud.breathe * 2) * 0.4;
    book.rotation.y = Math.sin(ud.breathe * 0.5) * 0.25;
    if (book.children[2]) {
      book.children[2].rotation.x += dt * 1.5;
      book.children[2].rotation.y += dt * 0.8;
      book.children[2].position.y = 1.2 + Math.sin(ud.breathe * 4) * 0.15;
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

  // ---- 弱點教學：背側軟肋(緋紅→自己在背後轉金)；正面重甲弧(自己在正面轉橘警示) ----
  if (ud.weakZone) {
    const wz = ud.weakZone;
    const wpulse = 0.5 + 0.5 * Math.sin(ud.breathe * 2.4);
    const behind = !!info.bossWeakSelf;
    const inFront = !!info.bossFrontSelf;
    if (wz.back) {
      wz.back.marker.rotation.y += dt * 1.4;
      wz.back.marker.material.emissiveIntensity = (behind ? 2.8 : 1.3) + 1.0 * wpulse;
      wz.back.marker.material.color.set(behind ? '#ffd54a' : '#ff5a6a');
      wz.back.marker.material.emissive.set(behind ? '#ffc24a' : '#ff5a6a');
      wz.back.arc.material.color.set(behind ? '#ffd54a' : '#ff5a6a');
      wz.back.arc.material.opacity = (behind ? 0.32 : 0.085) + (behind ? 0.1 : 0.035) * wpulse;
      wz.back.arc.scale.setScalar(behind ? 1.0 + 0.03 * wpulse : 1.0);
    }
    if (wz.front) {
      wz.front.arc.material.color.set(inFront ? '#ff7a52' : '#8fa9c8');
      wz.front.arc.material.opacity = (inFront ? 0.3 : 0.1) + (inFront ? 0.1 : 0.03) * wpulse;
    }
  }

  // 魔王護盾殼：強度 s(0..1) 控制濃淡/顯隱；魔法環各自旋轉、科技殼整體翻滾；清光即消失
  if (ud.coreShield) {
    const s = info.coreShielded || 0; // R5 雙臂在=1；R6 隨存活小怪數 → 越多越濃
    ud.coreShield.visible = s > 0.02;
    if (s > 0.02) {
      ud.coreShield.rotation.y += dt * 0.45;
      if (ud.coreShield.userData.tumbleX) ud.coreShield.rotation.x += dt * 0.3;
      for (const c of ud.coreShield.children) {
        if (c.userData && c.userData.spin) c.rotation.z += dt * c.userData.spin;
      }
      const pulse = 0.7 + 0.3 * Math.sin(ud.breathe * 3);
      for (const m of (ud.coreShieldMats || [])) m.opacity = (m.userData.base || 0.3) * s * pulse;
    }
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
  // 假分身 (R4 霜雪刺客)：半透明 + 閃爍，與「實心」真身做對比，教玩家認真身
  if (info.fake) {
    const flick = 0.5 + 0.5 * Math.sin(ud.breathe * 5 + ud.phase);
    targetOp = Math.min(targetOp, 0.32 + 0.22 * flick);
  }
  for (const m of ud.skinMats) {
    m.opacity += (targetOp - m.opacity) * Math.min(1, dt * 10);
  }
  if (ud.skin) {
    for (const m of ud.skin.glbMats) {
      m.opacity += (targetOp - m.opacity) * Math.min(1, dt * 10);
    }
  }
  // 魔王能量核心：真身明亮自轉、假分身黯淡半透明 (進一步區分真假)
  if (ud.bossCore) {
    ud.bossCore.rotation.y += dt * 1.0;
    const cm = ud.bossCore.material;
    cm.emissiveIntensity += ((info.fake ? 0.35 : 2.2) - cm.emissiveIntensity) * Math.min(1, dt * 6);
    cm.opacity += ((info.fake ? targetOp : 0.95) - cm.opacity) * Math.min(1, dt * 10);
  }
}
