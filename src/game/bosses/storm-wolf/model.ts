// @ts-nocheck
// R7 風暴巨狼：籠罩雷暴的四足巨狼。低伏蓄勢的長身、肩部隆起、深灰鬃毛間奔竄藍白電弧、
// 發藍光雙眼、帶電利爪、蓬鬆雷尾。配色：暴雲灰 #4a6fa5 + 雷電藍白 #aee3ff。
// 以人形骨架改四足（armL/armR=前足、legL/legR=後足，重新定位 pivot）；頭前伸於肩高。
import * as THREE from 'three';

export const modelConfig = { bulk: 4.0, weapon: 'none', scale: 2.2, head: 'triangle', emissiveCore: '#aee3ff', beast: true };

export function buildModel(ctx) {
  const { bulk, reg, mat, shade, torsoW, mkLimb, face, faceGroup } = ctx;

  const FUR = '#4a5a72', ELEC = '#aee3ff';
  const furMat = reg(mat(FUR, { rough: 0.86, metal: 0.1 }));
  const furDarkMat = reg(mat(shade(FUR, -0.28), { rough: 0.9, metal: 0.08 }));
  const maneMat = reg(mat('#2c3644', { rough: 0.92, metal: 0.06 }));
  const bellyMat = reg(mat(shade(FUR, 0.16), { rough: 0.85 }));
  const elecMat = reg(mat('#dff4ff', { emissive: new THREE.Color(ELEC), ei: 2.6, rough: 0.3 }));
  const eyeMat = reg(mat('#bff0ff', { emissive: new THREE.Color('#7ec8ff'), ei: 2.8, rough: 0.3 }));
  const clawMat = reg(mat('#eef3f7', { rough: 0.4, metal: 0.2 }));
  const noseMat = reg(mat('#161b22', { rough: 0.5 }));

  const bodyHalf = torsoW * 0.6, sideZ = torsoW * 0.34;
  const HEAD_DX = bodyHalf + 2, HEAD_DY = -32; // 頭前伸、抬於肩上（站姿）

  // 鋸齒電弧（細長發光折線）
  const bolt = (parent, x, y, z, s = 1) => {
    let px = x, py = y, pz = z;
    for (let i = 0; i < 3; i++) {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(1.2 * s, 5 * s, 1.2 * s), elecMat);
      seg.position.set(px, py + 2.5 * s, pz); seg.rotation.z = (i % 2 ? 1 : -1) * 0.5; parent.add(seg);
      px += (i % 2 ? 1.5 : -1.5) * s; py += 4 * s;
    }
  };

  // --- 軀幹：低伏長身 + 肩隆 + 腹甲 ---
  const torso = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(torsoW * 0.3, 16, 12), furMat);
  body.scale.set(1.7, 0.62, 0.85); body.position.y = -3; body.castShadow = true; torso.add(body);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(torsoW * 0.26, 12, 10), bellyMat);
  belly.scale.set(1.55, 0.5, 0.72); belly.position.y = -7; torso.add(belly);
  // 肩胛隆起（前高）
  const hump = new THREE.Mesh(new THREE.SphereGeometry(torsoW * 0.24, 14, 12), furMat);
  hump.scale.set(0.9, 1.05, 0.95); hump.position.set(bodyHalf * 0.5, 5, 0); hump.castShadow = true; torso.add(hump);
  // 後臀隆起
  const haunch = new THREE.Mesh(new THREE.SphereGeometry(torsoW * 0.22, 12, 10), furMat);
  haunch.scale.set(0.95, 1.0, 1.0); haunch.position.set(-bodyHalf * 0.55, 2, 0); haunch.castShadow = true; torso.add(haunch);

  // --- 鬃毛 + 電弧（頸→背）---
  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    const x = bodyHalf * 0.62 - t * bodyHalf * 1.2;
    const h = 9 + Math.sin(t * Math.PI) * 8;
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(3, h, 4), i % 2 ? maneMat : furDarkMat);
    tuft.position.set(x, 8 + h * 0.3, 0); tuft.rotation.z = 0.5; torso.add(tuft);
    if (i % 2 === 0) bolt(torso, x, 12, (Math.random() - 0.5) * torsoW * 0.3, 0.9);
  }
  // 側頸鬃
  for (const sz of [-1, 1]) for (let i = 0; i < 3; i++) {
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(2.4, 10, 4), maneMat);
    tuft.position.set(bodyHalf * 0.5 - i * 10, 2, sz * torsoW * 0.3); tuft.rotation.x = sz * 0.8; tuft.rotation.z = 0.4; torso.add(tuft);
  }

  // --- 蓬鬆雷尾（粗錐 + 毛叢 + 電弧）---
  const tail = new THREE.Group(); tail.position.set(-bodyHalf * 0.92, 0, 0); torso.add(tail);
  const tailCore = new THREE.Mesh(new THREE.ConeGeometry(torsoW * 0.2, torsoW * 0.95, 6), furMat);
  tailCore.position.set(-torsoW * 0.32, 6, 0); tailCore.rotation.z = Math.PI / 2 - 0.7; tail.add(tailCore);
  for (let i = 0; i < 6; i++) {
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(4 - i * 0.4, 12, 4), i % 2 ? maneMat : furDarkMat);
    tuft.position.set(-torsoW * (0.12 + i * 0.1), 6 + i * 2.5, 0); tuft.rotation.z = 1.1; tail.add(tuft);
  }
  bolt(tail, -torsoW * 0.4, 14, 0, 1.0);

  // --- 頭：狼首（吻、立耳、藍光眼、獠牙）---
  const head = new THREE.Group();
  const skull = new THREE.Mesh(new THREE.SphereGeometry(torsoW * 0.26, 14, 12), furMat);
  skull.scale.set(1.1, 0.95, 0.95); skull.position.set(HEAD_DX, HEAD_DY, 0); skull.castShadow = true; head.add(skull);
  const snout = new THREE.Mesh(new THREE.ConeGeometry(torsoW * 0.14, torsoW * 0.42, 6), furMat);
  snout.scale.set(0.8, 1, 1.1); snout.rotation.z = -Math.PI / 2;
  snout.position.set(HEAD_DX + torsoW * 0.32, HEAD_DY - torsoW * 0.04, 0); head.add(snout);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(torsoW * 0.06, 8, 6), noseMat);
  nose.position.set(HEAD_DX + torsoW * 0.52, HEAD_DY - torsoW * 0.03, 0); head.add(nose);
  // 立耳
  for (const sz of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(torsoW * 0.08, torsoW * 0.26, 4), furDarkMat);
    ear.position.set(HEAD_DX - torsoW * 0.08, HEAD_DY + torsoW * 0.22, sz * torsoW * 0.14); ear.rotation.x = sz * 0.3; head.add(ear);
    const earIn = new THREE.Mesh(new THREE.ConeGeometry(torsoW * 0.04, torsoW * 0.18, 4), maneMat);
    earIn.position.set(HEAD_DX - torsoW * 0.06, HEAD_DY + torsoW * 0.21, sz * torsoW * 0.14); earIn.rotation.x = sz * 0.3; head.add(earIn);
  }
  // 獠牙
  for (const sz of [-1, 1]) {
    const fang = new THREE.Mesh(new THREE.ConeGeometry(1.4, 7, 4), clawMat);
    fang.position.set(HEAD_DX + torsoW * 0.34, HEAD_DY - torsoW * 0.14, sz * torsoW * 0.07); fang.rotation.x = Math.PI; head.add(fang);
  }
  // 藍光怒目（faceGroup；scale.y 受眨眼）
  const eyeGeo = new THREE.SphereGeometry(2.4, 10, 8);
  face.eyeL = new THREE.Mesh(eyeGeo, eyeMat); face.eyeL.position.set(HEAD_DX + torsoW * 0.1, HEAD_DY + torsoW * 0.06, -torsoW * 0.12); face.eyeL.scale.set(1.3, 0.8, 1);
  face.eyeR = new THREE.Mesh(eyeGeo, eyeMat); face.eyeR.position.set(HEAD_DX + torsoW * 0.1, HEAD_DY + torsoW * 0.06, torsoW * 0.12); face.eyeR.scale.set(1.3, 0.8, 1);
  faceGroup.add(face.eyeL); faceGroup.add(face.eyeR);

  // --- 四足（前足=arm、後足=leg；帶電利爪）---
  const legW = 3.4 * bulk, legLen = 25; // 加長腿、提高站姿（不再像短腳蜥蜴）
  const mkPaw = (pivot) => {
    for (let i = -1; i <= 1; i++) {
      const claw = new THREE.Mesh(new THREE.ConeGeometry(1.3, 5, 4), clawMat);
      claw.position.set(legW * 0.5, -legLen - 1, i * legW * 0.4); claw.rotation.z = -Math.PI / 2 - 0.2; pivot.add(claw);
    }
  };
  const armL = mkLimb(0, 0, true, furMat, furDarkMat, ELEC, legW, legLen);
  const armR = mkLimb(0, 0, true, furMat, furDarkMat, ELEC, legW, legLen);
  const legL = mkLimb(0, 0, false, furMat, furDarkMat, ELEC, legW, legLen);
  const legR = mkLimb(0, 0, false, furMat, furDarkMat, ELEC, legW, legLen);
  armL.position.set(bodyHalf * 0.62, 9, -sideZ);
  armR.position.set(bodyHalf * 0.62, 9, sideZ);
  legL.position.set(-bodyHalf * 0.58, 10, -sideZ);
  legR.position.set(-bodyHalf * 0.58, 10, sideZ);
  legL.rotation.x = -0.1; legR.rotation.x = 0.1;
  for (const p of [armL, armR, legL, legR]) mkPaw(p);

  return { torso, head, armL, armR, legL, legR };
}

// 雷電利爪＋撕咬，無持械
export function buildWeapon() {}
