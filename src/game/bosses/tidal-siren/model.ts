// @ts-nocheck
// R5 潮汐歌姬：懸浮的半人半魚歌姬。
// 配色：深海藍 #005f73 + 青碧色 #0a9396 + 發光海泡色 #94d2bd + 螢光眼 #00ffff。
import * as THREE from 'three';

export const modelConfig = { bulk: 2.8, weapon: 'none', scale: 2.2, head: 'triangle', emissiveCore: '#94d2bd', translucent: true };

const DEEP_BLUE = '#005f73';
const TEAL = '#0a9396';
const FOAM_GLOW = '#94d2bd';
const AQUA_EYE = '#00ffff';

export function buildModel(ctx) {
  const {
    bulk, reg, mat, shade, torsoW, torsoD, torsoH, shoulderY, shoulderX, hipX, frontX, armLen,
    face, faceGroup, mkLimb, addAccent,
  } = ctx;

  const bodyMat = reg(mat(DEEP_BLUE, { rough: 0.35, metal: 0.1 }));
  const tailMat = reg(mat(TEAL, { rough: 0.15, metal: 0.2, emissive: new THREE.Color('#0353a4'), ei: 0.6 }));
  const finMat = reg(mat(FOAM_GLOW, { rough: 0.1, metal: 0.3, emissive: new THREE.Color(FOAM_GLOW), ei: 1.5, opacity: 0.8, transparent: true }));
  const eyeMat = reg(mat(AQUA_EYE, { emissive: new THREE.Color(AQUA_EYE), ei: 2.5 }));
  const waterMat = reg(mat('#e0f8ff', { rough: 0.05, metal: 0.1, emissive: new THREE.Color('#3a86c8'), ei: 1.8, opacity: 0.7, transparent: true }));

  // --- 軀幹：女性化纖細上半身 ---
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(torsoW * 0.35, torsoW * 0.25, torsoH * 1.0, 8), bodyMat);
  torso.name = 'torso';
  torso.castShadow = true;

  // 胸前貝殼/鱗片護甲
  for (const sz of [-1, 1]) {
    const cup = new THREE.Mesh(new THREE.SphereGeometry(torsoW * 0.15, 8, 8), finMat);
    cup.position.set(torsoD * 0.38, torsoH * 0.15, sz * torsoW * 0.18);
    cup.scale.set(0.6, 1, 1.2);
    torso.add(cup);
  }

  // --- 魚尾 (接在軀幹下方，向後下方彎曲) ---
  const tailGroup = new THREE.Group();
  tailGroup.position.y = -torsoH * 0.5;
  torso.add(tailGroup);

  let lastPart = tailGroup;
  const tailSegments = 4;
  for (let i = 0; i < tailSegments; i++) {
    const pct = i / tailSegments;
    const rUpper = torsoW * 0.25 * (1 - pct * 0.7);
    const rLower = torsoW * 0.25 * (1 - (i + 1) / tailSegments * 0.7);
    const h = torsoH * 0.5;

    const seg = new THREE.Mesh(new THREE.CylinderGeometry(rUpper, rLower, h, 8), tailMat);
    seg.position.y = -h / 2;
    seg.rotation.x = 0.25; // 向後微彎
    seg.castShadow = true;

    lastPart.add(seg);
    lastPart = seg;
  }

  // 尾鰭 (Fin)
  const fin = new THREE.Group();
  fin.position.y = -torsoH * 0.4;
  for (const sz of [-1, 1]) {
    const finSide = new THREE.Mesh(new THREE.ConeGeometry(torsoW * 0.3, torsoH * 0.8, 3), finMat);
    finSide.position.set(-2, -torsoH * 0.2, sz * torsoW * 0.25);
    finSide.rotation.x = sz * 0.5;
    finSide.rotation.z = -0.3;
    finSide.scale.set(0.2, 1, 1.5);
    fin.add(finSide);
  }
  lastPart.add(fin);

  // --- 頭部：歌姬頭顱與珊瑚長髮 ---
  const head = new THREE.Mesh(new THREE.OctahedronGeometry(6.0 * bulk, 0), bodyMat);
  head.scale.set(0.85, 1.2, 0.85);
  head.castShadow = true;

  // 珊瑚/波浪般的海水藍長髮 (向後飄拂)
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI - Math.PI / 2;
    const hair = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.4, 22 * bulk, 4), finMat);
    hair.position.set(-2 * bulk, -3 * bulk, Math.sin(angle) * 3.5 * bulk);
    hair.rotation.z = 0.8 + Math.random() * 0.3;
    hair.rotation.y = angle * 0.5;
    head.add(hair);
  }

  // 螢光雙眼
  const eyeGeo = new THREE.BoxGeometry(1.0, 1.2, 2.2);
  face.eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  face.eyeL.position.set(frontX * 0.82, 0.4, -2.0 * bulk);
  face.eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  face.eyeR.position.set(frontX * 0.82, 0.4, 2.0 * bulk);
  faceGroup.add(face.eyeL);
  faceGroup.add(face.eyeR);

  // --- 雙手：纖細的手臂 ---
  const armW = 2.8 * bulk;
  const armL = mkLimb(0, -shoulderX, true, bodyMat, finMat, DEEP_BLUE, armW, armLen);
  const armR = mkLimb(0, shoulderX, true, bodyMat, finMat, DEEP_BLUE, armW, armLen);

  // --- 懸浮水球與泡泡 (繞在身邊) ---
  const spheresGroup = new THREE.Group();
  torso.add(spheresGroup);
  // 我們在 renderTick 中讓它自旋，所以先加到 torso 裡面
  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * Math.PI * 2;
    const waterBall = new THREE.Mesh(new THREE.SphereGeometry(3.5, 8, 8), waterMat);
    waterBall.position.set(Math.cos(ang) * torsoW * 0.9, torsoH * 0.2, Math.sin(ang) * torsoW * 0.9);
    spheresGroup.add(waterBall);
  }
  torso.userData = { spheresGroup };

  // --- 雙腳：空群組以實現懸空效果 ---
  const legL = new THREE.Group();
  const legR = new THREE.Group();

  const parts = { torso, head, armL, armR, legL, legR };
  parts.customUpdate = (dt) => {
    if (spheresGroup) {
      spheresGroup.rotation.y += dt * 1.6;
    }
  };

  return parts;
}

// 潮汐歌姬沒有實體武器
export function buildWeapon(hand, ctx) {
  // 不添加手持武器，保留無武器姿態
}
