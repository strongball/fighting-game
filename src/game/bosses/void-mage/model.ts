// @ts-nocheck
// R8 虛空大魔導：漂浮的宇宙魔導。紫黑星空長袍（內透星雲幽光、灑落星點）、尖兜帽下虛空臉孔＋
// 紫光眼與金色符文第三眼、雙手凝聚虛空紫光、周身環繞傾斜金色符文環、胸前虛空奇點珠。
// 配色：虛空紫 #8e44ad + 星雲靛 #3d2b8e + 符文金光。float→袍襬懸空＋飄帶，無可見雙腿。
import * as THREE from 'three';

export const modelConfig = { bulk: 3.0, weapon: 'none', robe: true, scale: 1.8, head: 'circle', float: true, emissiveCore: '#c39bff' };

const VOID = '#8e44ad', NEBULA = '#3d2b8e', GLOW = '#c39bff', GOLD = '#ffd86a';

// 傾斜金色符文環（環 + 鏤刻符文塊）
function runeRing(radius, tube, ringMat, runeMat, n) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 40), ringMat));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = new THREE.Mesh(new THREE.BoxGeometry(tube * 1.6, tube * 3.2, 1), runeMat);
    r.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0); r.rotation.z = a; g.add(r);
  }
  return g;
}

export function buildModel(ctx) {
  const {
    bulk, reg, mat, shade, torsoW, torsoD, hipY, shoulderX, frontX, armLen,
    face, faceGroup, mkLimb, addAccent,
  } = ctx;

  const robeMat = reg(mat('#231640', { rough: 0.7, metal: 0.15, emissive: new THREE.Color(NEBULA), ei: 0.25 }));
  const robeDarkMat = reg(mat('#160d2a', { rough: 0.8, metal: 0.12 }));
  const robeTrimMat = reg(mat(VOID, { rough: 0.5, metal: 0.3, emissive: new THREE.Color(VOID), ei: 0.7 }));
  const voidMat = reg(mat('#0a0818', { rough: 0.9, metal: 0.1 }));
  const glowMat = reg(mat(GLOW, { emissive: new THREE.Color(GLOW), ei: 2.4, rough: 0.3 }));
  const goldMat = reg(mat(GOLD, { emissive: new THREE.Color(GOLD), ei: 1.5, metal: 0.4, rough: 0.4 }));
  const starMat = reg(mat('#ffffff', { emissive: new THREE.Color('#d6c8ff'), ei: 1.8, rough: 0.3 }));

  // --- 軀幹：星空長袍（下襬懸空）---
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(torsoW * 0.34, torsoW * 0.58, 32, 10), robeMat);
  torso.castShadow = true;
  // 前襟符文飾條
  const placket = new THREE.Mesh(new THREE.BoxGeometry(torsoD * 0.5, 26, 2), robeTrimMat);
  placket.position.set(torsoW * 0.48, -1, 0); placket.rotation.y = Math.PI / 2; torso.add(placket);
  // 星點（灑在袍上）
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2;
    const star = new THREE.Mesh(new THREE.SphereGeometry(0.8 + Math.random() * 0.8, 6, 5), starMat);
    star.position.set(Math.cos(a) * torsoW * 0.5, (Math.random() - 0.5) * 26, Math.sin(a) * torsoW * 0.5); torso.add(star);
  }
  // 懸空撕裂下襬
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const len = 7 + Math.random() * 8;
    const tatter = new THREE.Mesh(new THREE.ConeGeometry(2, len, 4), i % 2 ? robeMat : robeDarkMat);
    tatter.position.set(Math.cos(a) * torsoW * 0.54, -16 - len * 0.3, Math.sin(a) * torsoW * 0.54);
    tatter.rotation.x = Math.PI + Math.sin(a) * 0.3; tatter.rotation.z = Math.cos(a) * 0.3; torso.add(tatter);
  }
  // 胸前虛空奇點珠（深核＋紫光暈＋金環）
  const orb = new THREE.Mesh(new THREE.SphereGeometry(torsoW * 0.16, 14, 12), voidMat);
  orb.position.set(torsoW * 0.5, 4, 0); torso.add(orb);
  const orbGlow = new THREE.Mesh(new THREE.SphereGeometry(torsoW * 0.2, 12, 10), glowMat);
  orbGlow.position.set(torsoW * 0.5, 4, 0); orbGlow.material.transparent = true; orbGlow.material.opacity = 0.4; torso.add(orbGlow);

  // --- 周身傾斜符文環（靜態，象徵旋轉符文環）---
  const r1 = runeRing(torsoW * 0.7, 1.8, goldMat, robeTrimMat, 10); r1.position.y = 2; r1.rotation.set(Math.PI / 2 - 0.3, 0, 0); torso.add(r1);
  const r2 = runeRing(torsoW * 0.6, 1.5, goldMat, robeTrimMat, 8); r2.position.y = 6; r2.rotation.set(Math.PI / 2.4, 0.6, 0.3); torso.add(r2);

  // --- 頭：兜帽下虛空臉孔 + 紫光眼 + 金符文第三眼 ---
  const head = new THREE.Mesh(new THREE.SphereGeometry(3.4 * bulk, 12, 10), voidMat);
  head.castShadow = true;
  // 兜帽外殼（加大包覆，黑頭內縮不凸出兩側）
  const hood = new THREE.Mesh(new THREE.ConeGeometry(7.6 * bulk, 16 * bulk, 8), robeMat);
  hood.position.set(-1.2 * bulk, 3.5 * bulk, 0); hood.rotation.z = -0.1; head.add(hood);
  // 兜帽下緣垂布（包住頭兩側與後方）
  const cowl = new THREE.Mesh(new THREE.ConeGeometry(6.4 * bulk, 8.5 * bulk, 8), robeMat);
  cowl.position.set(-1 * bulk, -1 * bulk, 0); head.add(cowl);
  const brim = new THREE.Mesh(new THREE.TorusGeometry(4.4 * bulk, 1.5, 8, 16), robeTrimMat);
  brim.position.set(frontX * 0.46, -0.5 * bulk, 0); brim.rotation.y = Math.PI / 2; brim.scale.set(1, 1.25, 1); head.add(brim);
  // 金色符文第三眼
  const third = new THREE.Mesh(new THREE.OctahedronGeometry(1.8, 0), goldMat);
  third.position.set(frontX * 0.86, 2.2 * bulk, 0); faceGroup.add(third);
  // 紫光雙眼（faceGroup；scale.y 受眨眼）
  const eyeGeo = new THREE.SphereGeometry(1.7, 8, 8);
  face.eyeL = new THREE.Mesh(eyeGeo, glowMat); face.eyeL.position.set(frontX * 0.84, 0.3, -1.7 * bulk); face.eyeL.scale.set(1, 1.4, 0.8);
  face.eyeR = new THREE.Mesh(eyeGeo, glowMat); face.eyeR.position.set(frontX * 0.84, 0.3, 1.7 * bulk); face.eyeR.scale.set(1, 1.4, 0.8);
  faceGroup.add(face.eyeL); faceGroup.add(face.eyeR);

  // --- 雙臂：垂袖 + 凝聚虛空紫光的手 ---
  const armW = 3.0 * bulk;
  const armL = mkLimb(0, -shoulderX, true, robeMat, robeDarkMat, VOID, armW, 16);
  const armR = mkLimb(0, shoulderX, true, robeMat, robeDarkMat, VOID, armW, 16);
  for (const arm of [armL, armR]) {
    const sleeve = new THREE.Mesh(new THREE.ConeGeometry(armW * 1.3, 11, 6), robeDarkMat);
    sleeve.position.y = -armLen + 2; sleeve.rotation.x = Math.PI; arm.add(sleeve);
    const handGlow = new THREE.Mesh(new THREE.IcosahedronGeometry(armW * 0.7, 0), glowMat);
    handGlow.position.y = -armLen - 2; arm.add(handGlow);
  }

  // --- 靈質飄帶取代雙腿 ---
  const mkWisp = (sz) => {
    const w = new THREE.Group(); w.position.set(0, hipY - 2, sz * torsoW * 0.18);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(2.8, 16, 5), robeDarkMat); tail.position.y = -8; tail.rotation.x = Math.PI; w.add(tail);
    const glow = new THREE.Mesh(new THREE.ConeGeometry(1.2, 7, 4), glowMat); glow.position.y = -14; glow.rotation.x = Math.PI; w.add(glow);
    return w;
  };
  return { torso, head, armL, armR, legL: mkWisp(-1), legR: mkWisp(1) };
}

// 雙手施法、無持械
export function buildWeapon() {}
