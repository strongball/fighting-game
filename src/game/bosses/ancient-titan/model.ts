// @ts-nocheck
// R5 廢墟古代巨兵：歷經歲月的遠古守護巨像（天空之城機器兵／曠野守護者氛圍）。
// 風化石金屬軀體、覆滿苔蘚藤蔓、裝甲崩裂處露出內部齒輪與發藍光的能量管線、
// 胸口殘存幽光核心、左臂古代能量砲、右臂鏽蝕旋鋸。沉默悲壯的守護者感。
// 配色：風化石 #8a857a + 古銅 #9a7b4f + 符文藍 #49d0ff + 內部暗金屬 + 鋸刃橙 #ff7043。
import * as THREE from 'three';

export const modelConfig = {
  bulk: 7.0,
  weapon: 'none',
  scale: 3.0,
  head: 'square',
  emissiveCore: '#49d0ff',
  parts: [
    { id: 'arm_left', label: '雷射臂', side: 'left', color: '#49d0ff', hp: 2000 },
    { id: 'arm_right', label: '巨鋸臂', side: 'right', color: '#ff7043', hp: 2000 },
  ],
};

const STONE = '#8a857a', BRONZE = '#9a7b4f', RUNE = '#49d0ff', SAW = '#ff7043', INNER = '#26262e';

export function buildModel(ctx) {
  const {
    bulk, reg, mat, shade, torsoW, torsoD, torsoH, shoulderY, shoulderX, hipX, frontX, armLen,
    face, faceGroup, mkLimb, addAccent,
  } = ctx;

  const stoneMat = reg(mat(STONE, { rough: 0.92, metal: 0.15 }));
  const stoneDarkMat = reg(mat(shade(STONE, -0.34), { rough: 0.92, metal: 0.12 }));
  const stoneLightMat = reg(mat(shade(STONE, 0.14), { rough: 0.88, metal: 0.18 }));
  const bronzeMat = reg(mat(BRONZE, { rough: 0.5, metal: 0.8 }));
  const bronzeDarkMat = reg(mat(shade(BRONZE, -0.3), { rough: 0.6, metal: 0.7 }));
  const innerMat = reg(mat(INNER, { rough: 0.7, metal: 0.85 }));
  const runeMat = reg(mat(RUNE, { emissive: new THREE.Color(RUNE), ei: 2.2, rough: 0.4, metal: 0.2 }));
  const mossMat = reg(mat('#5a7a3a', { rough: 0.95 }));
  const vineMat = reg(mat('#456a2a', { rough: 0.9 }));
  const sawMat = reg(mat('#b7a98c', { rough: 0.55, metal: 0.7 }));
  const sawGlowMat = reg(mat(SAW, { emissive: new THREE.Color(SAW), ei: 1.7, rough: 0.4, metal: 0.3 }));

  const moss = (parent, x, y, z, s = 1) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(5 * s, 8, 6), Math.random() < 0.5 ? mossMat : vineMat);
    m.scale.set(1.5, 0.45, 1.5); m.position.set(x, y, z); m.rotation.y = Math.random() * 3; parent.add(m);
  };
  const vine = (parent, x, y, z, len) => {
    const v = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, len, 5), vineMat);
    v.position.set(x, y - len * 0.5, z); v.rotation.z = (Math.random() - 0.5) * 0.4; parent.add(v);
  };

  // --- 軀幹：層疊風化裝甲 + 崩裂內構 + 能量管線 ---
  const torso = new THREE.Mesh(new THREE.BoxGeometry(torsoD, torsoH * 1.4, torsoW * 0.88), stoneMat);
  torso.castShadow = true;
  // 上胸甲（前傾大塊）
  const chest = new THREE.Mesh(new THREE.BoxGeometry(torsoD * 0.92, torsoH * 0.7, torsoW * 0.7), stoneLightMat);
  chest.position.set(torsoD * 0.12, torsoH * 0.45, 0); torso.add(chest);
  // 腹部分節（古銅）
  for (let i = 0; i < 3; i++) {
    const seg = new THREE.Mesh(new THREE.BoxGeometry(torsoD * (1.02 - i * 0.05), torsoH * 0.22, torsoW * (0.6 - i * 0.08)), bronzeDarkMat);
    seg.position.y = -torsoH * (0.35 + i * 0.28); torso.add(seg);
  }
  // 胸口幽光核心框 + 放射能量管線（藍光）
  const ringFrame = new THREE.Mesh(new THREE.TorusGeometry(torsoW * 0.22, 4, 8, 24), bronzeMat);
  ringFrame.position.set(torsoD * 0.5, torsoH * 0.18, 0); ringFrame.rotation.y = Math.PI / 2; torso.add(ringFrame);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const cond = new THREE.Mesh(new THREE.BoxGeometry(1.6, torsoW * 0.34, 1.6), runeMat);
    cond.position.set(torsoD * 0.5, torsoH * 0.18, 0);
    cond.rotation.x = a; cond.translateY(torsoW * 0.28); torso.add(cond);
  }
  // 崩裂處：露出暗金屬內構 + 齒輪 + 滲藍光
  const breach = new THREE.Mesh(new THREE.BoxGeometry(torsoD * 0.5, torsoH * 0.5, torsoW * 0.3), innerMat);
  breach.position.set(torsoD * 0.3, -torsoH * 0.1, torsoW * 0.34); torso.add(breach);
  for (const gz of [torsoW * 0.34, -torsoW * 0.3]) {
    const gear = new THREE.Mesh(new THREE.CylinderGeometry(torsoW * 0.12, torsoW * 0.12, 4, 8), bronzeDarkMat);
    gear.rotation.x = Math.PI / 2; gear.position.set(torsoD * 0.34, -torsoH * 0.1, gz); torso.add(gear);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 4.5), bronzeDarkMat);
      tooth.position.set(torsoD * 0.34 + Math.cos(a) * torsoW * 0.13, -torsoH * 0.1 + Math.sin(a) * torsoW * 0.13, gz); torso.add(tooth);
    }
    const spark = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 6), runeMat);
    spark.position.set(torsoD * 0.36, -torsoH * 0.1, gz); torso.add(spark);
  }
  // 苔蘚與垂藤
  moss(torso, torsoD * 0.4, torsoH * 0.55, -torsoW * 0.3, 1.3);
  moss(torso, -torsoD * 0.2, torsoH * 0.2, torsoW * 0.3);
  moss(torso, torsoD * 0.3, -torsoH * 0.5, torsoW * 0.2);
  vine(torso, torsoD * 0.45, torsoH * 0.35, -torsoW * 0.15, torsoH * 0.9);
  vine(torso, torsoD * 0.4, torsoH * 0.1, torsoW * 0.36, torsoH * 1.2);

  // --- 頭：守護者面甲頭顱（角盔＋重眉脊＋幽光大眼）---
  const head = new THREE.Mesh(new THREE.BoxGeometry(9 * bulk, 9 * bulk, 9.5 * bulk), stoneMat);
  head.castShadow = true;
  // 角盔頂（梯形）
  const helm = new THREE.Mesh(new THREE.CylinderGeometry(4.2 * bulk, 6 * bulk, 4 * bulk, 4), stoneDarkMat);
  helm.rotation.y = Math.PI / 4; helm.position.y = 5.5 * bulk; head.add(helm);
  // 古銅面甲框
  const facePlate = new THREE.Mesh(new THREE.BoxGeometry(2.5 * bulk, 6 * bulk, 8.5 * bulk), bronzeDarkMat);
  facePlate.position.set(frontX * 0.7, -0.5 * bulk, 0); head.add(facePlate);
  // 重眉脊（壓在眼上，凶悍）
  const brow = new THREE.Mesh(new THREE.BoxGeometry(3 * bulk, 2 * bulk, 9 * bulk), bronzeMat);
  brow.position.set(frontX * 0.82, 2.2 * bulk, 0); brow.rotation.z = -0.12; faceGroup.add(brow);
  // 側耳鰭（古銅）
  for (const sz of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(2.2, 7 * bulk, 4), bronzeMat);
    ear.position.set(-2 * bulk, 1 * bulk, sz * 5.2 * bulk); ear.rotation.x = sz * 0.7; ear.rotation.z = 0.4; head.add(ear);
  }
  // 幽光大眼（梯形、略下垂的悲壯感）
  const eyeGeo = new THREE.BoxGeometry(1.8, 2.6 * bulk, 3.4 * bulk);
  face.eyeL = new THREE.Mesh(eyeGeo, runeMat); face.eyeL.position.set(frontX * 0.9, 0.4 * bulk, -2.6 * bulk); face.eyeL.rotation.x = 0.3;
  face.eyeR = new THREE.Mesh(eyeGeo, runeMat); face.eyeR.position.set(frontX * 0.9, 0.4 * bulk, 2.6 * bulk); face.eyeR.rotation.x = -0.3;
  faceGroup.add(face.eyeL); faceGroup.add(face.eyeR);
  moss(head, 0, 4.2 * bulk, -2 * bulk, 1.1);

  // --- 肩甲（半球甲蓋，風化覆苔）---
  for (const sz of [-1, 1]) {
    const paul = new THREE.Mesh(new THREE.SphereGeometry(torsoW * 0.13, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), stoneLightMat);
    paul.scale.set(1.15, 0.85, 1.2); paul.position.set(0, shoulderY + 1, sz * torsoW * 0.52); paul.castShadow = true; addAccent(paul);
    const trim = new THREE.Mesh(new THREE.TorusGeometry(torsoW * 0.13, 2.2, 8, 18), bronzeMat);
    trim.position.set(0, shoulderY, sz * torsoW * 0.52); trim.rotation.x = Math.PI / 2; addAccent(trim);
    const m = new THREE.Mesh(new THREE.SphereGeometry(5, 8, 6), mossMat); m.scale.set(1.4, 0.4, 1.4);
    m.position.set(0, shoulderY + 4, sz * torsoW * 0.52); addAccent(m);
  }

  // --- 粗壯石腿 + 古銅膝甲 ---
  const armW = 7.5 * bulk, legW = 9.5 * bulk;
  const armL = mkLimb(0, -shoulderX, true, stoneMat, stoneDarkMat, RUNE, armW, 18);
  const armR = mkLimb(0, shoulderX, true, stoneMat, stoneDarkMat, SAW, armW, 18);
  const legL = mkLimb(0, -hipX, false, stoneMat, bronzeDarkMat, BRONZE, legW, 16);
  const legR = mkLimb(0, hipX, false, stoneMat, bronzeDarkMat, BRONZE, legW, 16);

  // --- 左臂：古代能量砲（風化砲管 + 內部藍光 + 符文環）---
  {
    const g = new THREE.Group(); g.position.y = -armLen - 4; armL.add(g);
    const housing = new THREE.Mesh(new THREE.BoxGeometry(armW * 1.7, armW * 1.6, armW * 1.7), stoneDarkMat);
    housing.castShadow = true; g.add(housing);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(armW * 0.72, armW * 0.86, armW * 2.6, 12), bronzeMat);
    barrel.position.y = -armW * 1.4; barrel.castShadow = true; g.add(barrel);
    const bore = new THREE.Mesh(new THREE.CylinderGeometry(armW * 0.5, armW * 0.5, armW * 2.7, 12), innerMat);
    bore.position.y = -armW * 1.4; g.add(bore);
    const charge = new THREE.Mesh(new THREE.SphereGeometry(armW * 0.46, 12, 10), runeMat);
    charge.position.y = -armW * 2.6; g.add(charge);
    for (const yy of [-0.6, -1.6, -2.4]) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(armW * 0.78, 2.4, 8, 18), runeMat);
      r.position.y = armW * yy; r.rotation.x = Math.PI / 2; g.add(r);
    }
  }

  // --- 右臂：鏽蝕古代旋鋸（豎立鋸輪 + 橙能量刃緣 + 鋸齒）---
  {
    const g = new THREE.Group(); g.position.y = -armLen - 6; armR.add(g);
    const mount = new THREE.Mesh(new THREE.BoxGeometry(armW * 1.4, armW * 1.5, armW * 1.2), stoneDarkMat);
    mount.castShadow = true; g.add(mount);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(armW * 0.55, armW * 0.55, armW * 0.7, 8), bronzeMat);
    hub.rotation.x = Math.PI / 2; hub.position.x = armW * 0.6; g.add(hub);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(armW * 1.75, armW * 1.75, armW * 0.3, 24), sawMat);
    disc.rotation.x = Math.PI / 2; disc.position.x = armW * 0.6; disc.castShadow = true; g.add(disc);
    const edge = new THREE.Mesh(new THREE.TorusGeometry(armW * 1.55, 3, 8, 28), sawGlowMat);
    edge.rotation.x = Math.PI / 2; edge.position.x = armW * 0.6; g.add(edge);
    const coreGlow = new THREE.Mesh(new THREE.SphereGeometry(armW * 0.4, 10, 8), sawGlowMat);
    coreGlow.position.x = armW * 0.6; g.add(coreGlow);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(armW * 0.16, armW * 0.5, 4), sawMat);
      tooth.position.set(armW * 0.6, Math.cos(a) * armW * 1.85, Math.sin(a) * armW * 1.85);
      tooth.rotation.x = a + Math.PI / 2; g.add(tooth);
    }
  }

  return { torso, head, armL, armR, legL, legR };
}
