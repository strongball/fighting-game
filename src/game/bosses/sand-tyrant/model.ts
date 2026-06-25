// @ts-nocheck
// R3 風沙法皇：黃沙木乃伊法師。身披殘破的法袍，雙手凝聚旋轉的沙球。
// 配色：法袍褐 #5c4033 + 沙金 #d4af37 + 雙眼紫光 #c050ff。
import * as THREE from 'three';

export const modelConfig = { bulk: 3.5, weapon: 'none', scale: 2.0, head: 'square', emissiveCore: '#ffd700' };

export function buildModel(ctx) {
  const {
    bulk, reg, mat, shade,
    torsoW, torsoH, frontX,
    shoulderX, hipX, face, faceGroup, mkLimb,
  } = ctx;

  const ROBE_BROWN = '#5c4033';
  const GOLD = '#d4af37';
  const LIGHT_GOLD = '#ffd700';
  const PURPLE = '#c050ff';

  const robeMat = reg(mat(ROBE_BROWN, { rough: 0.85, metal: 0.1 }));
  const robeDarkMat = reg(mat(shade(ROBE_BROWN, -0.25), { rough: 0.9, metal: 0.05 }));
  const goldMat = reg(mat(GOLD, { rough: 0.35, metal: 0.8 }));
  const eyeMat = reg(mat(PURPLE, { emissive: new THREE.Color(PURPLE), ei: 2.5, rough: 0.2 }));
  const sandBallMat = reg(mat(GOLD, { emissive: new THREE.Color(LIGHT_GOLD), ei: 1.8, rough: 0.4 }));

  // --- 軀幹：下擺漸縮的法袍軀幹 (Cylinder) ---
  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(torsoW * 0.45, torsoW * 0.25, torsoH * 1.3, 10, 1),
    robeMat,
  );
  torso.castShadow = true;

  // 法袍金色飾帶
  const sash = new THREE.Mesh(new THREE.TorusGeometry(torsoW * 0.38, 2.4, 6, 16), goldMat);
  sash.position.set(0, torsoH * 0.2, 0);
  sash.rotation.x = Math.PI / 2;
  torso.add(sash);

  // 殘破衣角/繃帶帶子 (飄逸感)
  for (let i = 0; i < 4; i++) {
    const ribbon = new THREE.Mesh(new THREE.BoxGeometry(2, 22, 0.4), robeDarkMat);
    ribbon.position.set((Math.random() - 0.5) * torsoW * 0.6, -torsoH * 0.6, (Math.random() - 0.5) * torsoW * 0.6);
    ribbon.rotation.z = 0.2 + Math.random() * 0.3;
    ribbon.rotation.y = Math.random() * Math.PI;
    torso.add(ribbon);
  }

  // --- 頭部：法老金面具與繃帶裹頭 ---
  const head = new THREE.Mesh(new THREE.BoxGeometry(11 * bulk, 11 * bulk, 11 * bulk), robeMat);
  head.castShadow = true;

  // 法老 Nemes 頭巾飾邊 (兩側金飾板)
  const nemesL = new THREE.Mesh(new THREE.BoxGeometry(2.4, 12 * bulk, 6 * bulk), goldMat);
  nemesL.position.set(-1 * bulk, -1 * bulk, -6 * bulk);
  nemesL.rotation.y = 0.15;
  head.add(nemesL);

  const nemesR = new THREE.Mesh(new THREE.BoxGeometry(2.4, 12 * bulk, 6 * bulk), goldMat);
  nemesR.position.set(-1 * bulk, -1 * bulk, 6 * bulk);
  nemesR.rotation.y = -0.15;
  head.add(nemesR);

  // 頭頂金色聖冠
  const crown = new THREE.Mesh(new THREE.ConeGeometry(3.6, 9 * bulk, 4), goldMat);
  crown.position.set(0, 7 * bulk, 0);
  crown.rotation.x = 0.15;
  head.add(crown);

  // 發光紫眼
  const eyeGeo = new THREE.BoxGeometry(1.6, 2.4, 3.2);
  face.eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  face.eyeL.position.set(frontX * 0.76, 0.6, -2.6 * bulk);
  face.eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  face.eyeR.position.set(frontX * 0.76, 0.6, 2.6 * bulk);
  faceGroup.add(face.eyeL);
  faceGroup.add(face.eyeR);

  // --- 雙臂：纖細木乃伊手臂，前端懸浮金色沙球 ---
  const armW = 4.2 * bulk, armLen = 22;
  const armL = mkLimb(0, -shoulderX, true, robeMat, goldMat, ROBE_BROWN, armW, armLen);
  const armR = mkLimb(0, shoulderX, true, robeMat, goldMat, ROBE_BROWN, armW, armLen);

  for (const arm of [armL, armR]) {
    // 雙手前端的金色沙球
    const sandBall = new THREE.Mesh(new THREE.SphereGeometry(6.5, 12, 12), sandBallMat);
    sandBall.position.y = -armLen - 3;
    sandBall.castShadow = true;
    arm.add(sandBall);

    // 沙球周圍環繞的小光環
    const ringGeo = new THREE.TorusGeometry(8.2, 0.9, 4, 16);
    const ringMesh = new THREE.Mesh(ringGeo, goldMat);
    ringMesh.position.y = -armLen - 3;
    ringMesh.rotation.x = Math.PI / 2;
    arm.add(ringMesh);
  }

  // --- 根狀雙腿：法皇為漂浮，腿部隱藏於法袍中，使 legL/legR 為空群組以實現懸空法袍效果 ---
  const legL = new THREE.Group();
  const legR = new THREE.Group();

  return { torso, head, armL, armR, legL, legR };
}

export function buildWeapon() {}
