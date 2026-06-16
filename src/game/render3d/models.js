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

import { buildDefault } from './classes/default.ts';
import { getCharacterModelDef, getCharacterTexturePainter, getWeaponBuilder } from '../characters/render3d.ts';

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

  if (o.cfg.pauldron) {
    const pg = new THREE.SphereGeometry(o.torsoW * 0.28, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    for (const sz of [-1, 1]) {
      const m = new THREE.Mesh(pg, metalAccent());
      m.position.set(0, o.shoulderY + 1, sz * (o.shoulderX + 1));
      m.scale.y = 0.8;
      add(m);
    }
  }

  const hg = o.cfg.headgear;
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
  const modelDef = bossModel ? null : getCharacterModelDef(charId);
  const cfg = bossModel
    ? { bulk: bossModel.bulk || 2, weapon: bossModel.weapon || 'sword', robe: !!bossModel.robe }
    : (modelDef?.modelConfig || { bulk: 1, weapon: 'sword' });
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
  const skinKind = cfg.skinKind || (bossModel ? (bossModel.robe ? 'cloth' : 'metal') : 'cloth');
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

  // 依職業分流至各角色資料夾中的 model.js；魔王與未知角色走共用 fallback。
  const parts = modelDef?.buildModel ? modelDef.buildModel(ctx) : buildDefault(ctx);

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
  if (modelDef?.buildWeapon) {
    modelDef.buildWeapon(handR, ctx);
  } else {
    const weaponBuilder = getWeaponBuilder(cfg.weapon);
    if (weaponBuilder) weaponBuilder(handR, ctx);
  }

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
  const modelDef = getCharacterModelDef(charId);
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
        const hg = getCharacterModelDef(charId)?.modelConfig?.headgear;
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
  const hasPauldrons = !!getCharacterModelDef(charId)?.modelConfig?.pauldron;
  if (ud.parts.accents) {
    const headY = ud.parts.head.position.y;
    let pauldronIdx = 0;
    for (const a of ud.parts.accents) {
      const isPauldron = hasPauldrons && a.position.y < headY - 4;
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

  // 6. 角色專屬 GLB 附加裝備由各角色資料夾提供。
  modelDef?.attachSkinGear?.({
    THREE, baseColor, spineBone, leftHandBone, hipsBone, leftForeArmBone, rightForeArmBone, ud,
  });

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
