// 程序化 3D 角色模型 + 動畫
//
// 每個角色 = 人形基底(頭/軀幹/雙臂/雙腿，肢體有樞紐可擺動) + 依原型的武器 + 頭頂發光識別徽記。
// 模型一律「面向 +X」建立；renderer 以 group.rotation.y = -facing 轉向。
//
// 對外（renderer.js 使用）：
//   createCharacterModel(charId) -> THREE.Group (含 userData 動畫資料)
//   animateModel(group, dt, { speed, facing, p, isSelf }) 每幀更新姿勢/表情/效果環
//   attachSkin(group, skin, charId) 把載入的 GLB 皮膚掛上、隱藏程序化身體
//
// 檔案分區（由上而下）：
//   buildAccents()           肩甲 / 頭部配件（帽/盔/兜帽/角/髮帶）
//   createCharacterModel()   組裝人形 + 武器 + 徽記（最大宗）
//   swingArmZ/castArmZ/...    出手動畫的手臂擺動曲線
//   skinFadeTo/PlayOnce/driveSkin  GLB 皮膚動畫驅動
//   attachSkin()             GLB 皮膚掛載 + 骨骼重綁
//   animateModel()           每幀：走路 bob、出手、受擊、表情狀態機、效果環
// 材質/canvas 貼圖工具已拆至 ./materials.js（shade / mat / panelTexture / createHumanoidTexture）。

import * as THREE from 'three';
import { getCharacter } from '../characters.js';
import { WALK_THRESHOLD } from '../constants.js';

import { buildDefault } from './classes/default.ts';
import { getCharacterModelDef, getWeaponBuilder } from '../characters/render3d.ts';
import { attachBossModelVisuals, updateBossModelVisuals } from '../bosses/render3d.ts';
import { shade, mat, panelTexture, createHumanoidTexture } from './materials.js';

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
  const isBoss = typeof ch.id === 'number' && ch.id >= 100;
  const modelDef = isBoss ? ch : getCharacterModelDef(charId);
  const cfg = modelDef?.modelConfig || { bulk: 1, weapon: 'sword' };
  const bossModel = isBoss ? cfg : null; // 魔王程序化建模參數
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
  let parts = null;
  if (modelDef && typeof modelDef.buildModel === 'function') {
    parts = modelDef.buildModel(ctx);
  }
  if (!parts) {
    parts = buildDefault(ctx);
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

  let weaponBuilt = false;
  if (modelDef) {
    if (modelDef.loaders && typeof modelDef.loaders.buildWeapon === 'function') {
      modelDef.buildWeapon(handR, ctx);
      weaponBuilt = true;
    } else if (!modelDef.loaders && typeof modelDef.buildWeapon === 'function') {
      modelDef.buildWeapon(handR, ctx);
      weaponBuilt = true;
    }
  }
  if (!weaponBuilt) {
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
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdff7ff, emissiveIntensity: 2.2, transparent: true, opacity: 0.9 })
  );
  shieldRing.rotation.x = -Math.PI / 2;
  shieldRing.position.y = 2;
  shieldRing.visible = false;
  group.add(shieldRing);

  const shieldShell = new THREE.Mesh(
    new THREE.SphereGeometry(torsoW * 1.05, 32, 16),
    new THREE.MeshBasicMaterial({
      color: 0xf7fbff,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  shieldShell.position.y = shoulderY - 4;
  shieldShell.scale.y = 1.42;
  shieldShell.visible = false;
  group.add(shieldShell);

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

  // 暈眩光環 — 地面金圈 + 頭頂環 (用 CSS plate 配合，這層做世界內可讀的能量光)
  const stunRing = new THREE.Mesh(
    new THREE.TorusGeometry(torsoW * 1.45, 1.8, 8, 36),
    new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xffb340, emissiveIntensity: 3.0, transparent: true, opacity: 0.95 })
  );
  stunRing.rotation.x = -Math.PI / 2;
  stunRing.position.y = 4;
  stunRing.visible = false;
  group.add(stunRing);

  const stunHalo = new THREE.Mesh(
    new THREE.TorusGeometry(torsoW * 0.75, 1.1, 6, 28),
    new THREE.MeshStandardMaterial({ color: 0xfff2b0, emissive: 0xffd166, emissiveIntensity: 2.4, transparent: true, opacity: 0.9 })
  );
  stunHalo.position.y = headY + 18;
  stunHalo.visible = false;
  group.add(stunHalo);

  // 定身根系 — 地面綠圈
  const rootRing = new THREE.Mesh(
    new THREE.TorusGeometry(torsoW * 1.3, 1.4, 8, 36),
    new THREE.MeshStandardMaterial({ color: 0xa3e635, emissive: 0x84cc16, emissiveIntensity: 2.4, transparent: true, opacity: 0.9 })
  );
  rootRing.rotation.x = -Math.PI / 2;
  rootRing.position.y = 2;
  rootRing.visible = false;
  group.add(rootRing);

  if (parts.barrageWings) group.add(parts.barrageWings);
  if (parts.falcon) group.add(parts.falcon);

  group.userData = {
    parts: { torso, head, armL, armR, legL, legR, emblem, shieldRing, shieldShell, rageRing, burnRing, frozenRingLow, frozenRingHigh, stunRing, stunHalo, rootRing, handR, face, accents, starOrbitShards: parts.starOrbitShards, barrageWings: parts.barrageWings, falcon: parts.falcon },
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

  if (bossModel) attachBossModelVisuals(ctx, group, bossModel);

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

  const p = info.p;
  if (parts.starOrbitShards) {
    const orbit = p && p.starOrbit;
    const count = Math.max(0, Math.min(3, orbit?.shards ?? 0));
    const baseAngle = orbit?.angle ?? ud.breathe * 1.9;
    for (let i = 0; i < parts.starOrbitShards.length; i++) {
      const shard = parts.starOrbitShards[i];
      shard.visible = i < count;
      if (!shard.visible) continue;
      const a = baseAngle + i * (Math.PI * 2 / Math.max(1, count));
      const r = 56 + count * 10;
      shard.position.set(Math.cos(a) * r, 31 + Math.sin(a * 2) * 4, Math.sin(a) * r);
      shard.rotation.x += dt * 1.2;
      shard.rotation.y += dt * 2.8;
      shard.rotation.z += dt * 0.8;
      shard.scale.setScalar(1 + Math.sin(ud.breathe * 2 + i) * 0.035);
    }
  }

  // 天羽箭暴 — 磅礴雙翼：依 p.barrage 展開/收合，作為 player group 子物件自動跟隨移動。
  if (parts.barrageWings) {
    const on = p && p.barrage;
    ud.wingT = on ? Math.min(1, (ud.wingT || 0) + dt * 3.0)   // 展開 ~0.33s
                  : Math.max(0, (ud.wingT || 0) - dt * 4.5);  // 收合更快
    const wings = parts.barrageWings;
    wings.visible = ud.wingT > 0.001;
    if (wings.visible) {
      const e = ud.wingT * ud.wingT * (3 - 2 * ud.wingT);     // smoothstep 展開緩動
      const flap = Math.sin(ud.breathe * 5) * 0.14;           // 拍動
      for (const side of wings.children) {
        const sz = side.userData.side;
        const feathers = side.userData.feathers;
        for (let i = 0; i < feathers.length; i++) {
          const fan = feathers[i].userData.fan;
          // 收合(e=0)時幾近直立貼背；展開時外擺成扇 + 拍動
          feathers[i].rotation.x = sz * (0.05 + fan * 1.05 * e + flap * (0.4 + i * 0.12) * e);
        }
      }
      wings.scale.setScalar(0.7 + 0.6 * e);                   // 展開後放大到 1.3×
      if (wings.userData.mat) wings.userData.mat.opacity = 0.25 + 0.72 * e;
    }
  }

  // 鳥獵鷹隼：平時棲於肩、攻擊時「飛出俯衝」再返回。
  // 由 sim 的 p._falcon.flight = { t, dur } 驅動（falcon.ts）；模型恆面向 +X → 往 +X 飛即朝敵。
  if (parts.falcon) {
    const fal = parts.falcon;
    const rest = fal.userData.rest;
    const wings = fal.userData.wings || [];
    const fl = p && p._falcon && p._falcon.flight;
    ud.falconFlap = (ud.falconFlap || 0) + dt * (fl ? 26 : 6);
    if (fl) {
      const u = Math.min(1, fl.t / (fl.dur || 0.62));
      const arc = Math.sin(u * Math.PI);          // 0→1→0：去程＋回程
      // 把「世界位移(tdx,tdy)」轉成模型本地座標（group 已繞 Y 轉 ud.curFacing）→ 飛到敵人實際位置。
      const th = ud.curFacing || 0, c2 = Math.cos(th), s2 = Math.sin(th);
      const wx = fl.tdx || 0, wz = fl.tdy || 0;
      const lx = wx * c2 - wz * s2;
      const lz = wx * s2 + wz * c2;
      // 弧線飛行：沿「棲位→敵人」推進(arc)，外加垂直方向的側擺 → 去程/回程走不同側形成弧/環，不是直線來回。
      const dirx = lx - rest.x, dirz = lz - rest.z;
      const dl = Math.hypot(dirx, dirz) || 1;
      const perpx = -dirz / dl, perpz = dirx / dl;
      const lateral = Math.sin(u * Math.PI * 2) * Math.min(70, dl * 0.22); // 來回不同側的弧度（隨距離、上限 70）
      fal.position.x = rest.x + dirx * arc + perpx * lateral;
      fal.position.z = rest.z + dirz * arc + perpz * lateral;
      fal.position.y = rest.y + (24 - rest.y) * arc + Math.sin(u * Math.PI) * 8; // 拋物高度：先升後俯衝下探
      // 鷹頭朝「實際飛行方向」：用上一幀位移求向量（含弧線側擺）→ 去程朝敵、回程朝你都自然。
      const hx = fal.position.x - (ud.falPrevX != null ? ud.falPrevX : fal.position.x);
      const hz = fal.position.z - (ud.falPrevZ != null ? ud.falPrevZ : fal.position.z);
      if (Math.hypot(hx, hz) > 0.05) fal.rotation.y = Math.atan2(-hz, hx);
      ud.falPrevX = fal.position.x; ud.falPrevZ = fal.position.z;
      fal.rotation.z = -arc * 0.4 + lateral * 0.01;    // 俯衝前傾 + 轉彎側傾
      const flap = Math.sin(ud.falconFlap) * 0.6;      // 急速拍翼
      for (const w of wings) w.rotation.x = w.userData.side * (0.2 + flap);
      const storm = p && p._falcon && p._falcon.frenzy ? 1.3 : 1; // 大絕風暴：鷹更巨大有壓迫感
      fal.scale.setScalar((fal.userData.baseScale || 1) * (1.5 + arc * 0.5) * storm);
    } else {
      // 棲息：輕微上下浮動 + 緩慢拍翼，平滑回到棲位。
      fal.position.x += (rest.x - fal.position.x) * Math.min(1, dt * 10);
      fal.position.z += (rest.z - fal.position.z) * Math.min(1, dt * 10);
      fal.position.y = rest.y + Math.sin(ud.breathe * 2) * 0.6;
      fal.rotation.z += (0 - fal.rotation.z) * Math.min(1, dt * 10);
      fal.rotation.y += (0 - fal.rotation.y) * Math.min(1, dt * 10);
      fal.scale.setScalar(fal.userData.baseScale || 1);
      ud.falPrevX = null; ud.falPrevZ = null;
      const flap = Math.sin(ud.falconFlap) * 0.12;
      for (const w of wings) w.rotation.x = w.userData.side * (0.1 + flap);
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
  const shieldOn = p && p.shield > 0;
  parts.shieldRing.visible = shieldOn;
  parts.shieldShell.visible = shieldOn;
  if (shieldOn) {
    const pulse = 0.8 + 0.2 * Math.sin(ud.breathe * 4);
    const strength = Math.min(1, (p.shield || 0) / Math.max(1, p.maxHp || 1));
    parts.shieldRing.scale.setScalar(0.96 + 0.1 * pulse);
    parts.shieldRing.material.emissiveIntensity = 1.9 + 1.0 * pulse;
    parts.shieldRing.material.opacity = 0.72 + 0.2 * pulse;
    parts.shieldShell.scale.set(1 + 0.04 * pulse, 1.42 + 0.05 * pulse, 1 + 0.04 * pulse);
    parts.shieldShell.material.opacity = 0.12 + 0.12 * pulse + 0.08 * strength;
  }
  const rageOn = p && p.effects && (p.effects.rage || p.effects.overdrive);
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

  // 暈眩光環：地面金圈 + 頭頂星星環旋轉
  const stunOn = p && p.effects && p.effects.stun && p.effects.stun.remaining > 0;
  if (parts.stunRing) {
    parts.stunRing.visible = !!stunOn;
    parts.stunHalo.visible = !!stunOn;
    if (stunOn) {
      const pulse = 0.85 + 0.15 * Math.sin(ud.breathe * 10);
      parts.stunRing.scale.setScalar(pulse);
      parts.stunRing.rotation.z = ud.breathe * 1.5;
      parts.stunHalo.rotation.x = ud.breathe * 6;
      parts.stunHalo.rotation.y = ud.breathe * 4;
      parts.stunRing.material.emissiveIntensity = 2.6 + 1.2 * Math.sin(ud.breathe * 12);
    }
  }

  // 定身根系：地面綠圈脈動
  const rootOn = p && p.effects && p.effects.root && p.effects.root.remaining > 0;
  if (parts.rootRing) {
    parts.rootRing.visible = !!rootOn;
    if (rootOn) {
      const pulse = 0.9 + 0.1 * Math.sin(ud.breathe * 8);
      parts.rootRing.scale.setScalar(pulse);
      parts.rootRing.material.emissiveIntensity = 2.0 + 0.8 * Math.sin(ud.breathe * 10);
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
  const evading = p && p.effects && p.effects.evading;
  let targetOp = info.downed ? 0.5 : 1;
  if (invis) targetOp = info.isSelf ? 0.42 : 0.12;
  else if (evading) targetOp = 0.55;
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

  // 懸浮效果：若實體具有 floatHeight 屬性，使其在 3D 空間中懸浮並微幅上下漂浮
  const floatHeight = (p && p.floatHeight) || 0;
  if (floatHeight > 0) {
    const t = performance.now() * 0.0035;
    group.position.y = floatHeight + Math.sin(t * 3.0) * 1.5;
  }

  updateBossModelVisuals(group, ud, dt, { ...info, targetOpacity: targetOp });

}
