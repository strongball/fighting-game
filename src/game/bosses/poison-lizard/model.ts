// @ts-nocheck
// R2 劇毒飛蜥：四足毒蜥。低伏修長身軀、四條外撇蜥足、前伸長吻頭顱、
// 連續漸縮下垂長尾、背脊鱗棘滴綠毒。配色：毒綠 #7fbf3f + 暗紫 #6a3d9a + 螢光毒滴 #aaff55。
//
// 以人形骨架改造四足：armL/armR = 前足、legL/legR = 後足（重新定位 pivot 到低處四角，
// 動畫只改 rotation 不改 position，故可沿用走路擺動）。head/faceGroup 同原點 (0,headY,0)，
// 用相同 local 偏移把頭顱與眼睛拉到身體前下方。
import * as THREE from 'three';

export const modelConfig = { bulk: 3.5, weapon: 'none', scale: 1.8, head: 'triangle', emissiveCore: '#aaff55' };

const _UP = new THREE.Vector3(0, 1, 0);

// 沿 CatmullRom 曲線生成「連續漸縮的錐管」尾巴：相鄰圓台半徑相接 → 無接縫、平滑下垂。
function buildTail(mat, ridgeMat, baseX, baseY, baseR) {
  const g = new THREE.Group();
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(baseX, baseY, 0),
    new THREE.Vector3(baseX - baseR * 2.8, baseY - 1.5, baseR * 0.6),
    new THREE.Vector3(baseX - baseR * 5.6, baseY - 6, baseR * 0.2),
    new THREE.Vector3(baseX - baseR * 8.2, baseY - 11, -baseR * 0.7),
    new THREE.Vector3(baseX - baseR * 10.4, baseY - 13, -baseR * 0.4),
    new THREE.Vector3(baseX - baseR * 11.8, baseY - 11, 0), // 尾尖微翹
  ]);
  const N = 22;
  const sp = curve.getSpacedPoints(N);
  for (let i = 0; i < N; i++) {
    const a = sp[i], b = sp[i + 1];
    const r0 = baseR * Math.pow(1 - i / N, 1.25) + 0.5;
    const r1 = baseR * Math.pow(1 - (i + 1) / N, 1.25) + 0.5;
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length() || 0.01;
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len * 1.1, 8), mat);
    seg.castShadow = true;
    seg.position.copy(a).addScaledVector(dir, 0.5);
    seg.quaternion.setFromUnitVectors(_UP, dir.clone().normalize());
    g.add(seg);
    // 背脊鱗棘延續到尾上
    if (i % 2 === 0 && i < N * 0.78) {
      const scute = new THREE.Mesh(new THREE.ConeGeometry(r0 * 0.5, r0 * 1.5, 4), ridgeMat);
      scute.position.copy(a); scute.position.y += r0 * 0.7; scute.rotation.x = -0.2;
      g.add(scute);
    }
  }
  return g;
}

export function buildModel(ctx) {
  const { bulk, reg, mat, shade, torsoW, mkLimb, face, faceGroup } = ctx;

  const GREEN = '#7fbf3f', PURPLE = '#6a3d9a';
  const scaleMat = reg(mat(GREEN, { rough: 0.5, metal: 0.12 }));
  const bellyMat = reg(mat(shade(GREEN, 0.24), { rough: 0.6, metal: 0.06 }));
  const purpleMat = reg(mat(PURPLE, { rough: 0.45, metal: 0.22 }));
  const spikeMat = reg(mat(shade(PURPLE, -0.06), { rough: 0.45, metal: 0.22 }));
  const footMat = reg(mat(shade(GREEN, -0.18), { rough: 0.5, metal: 0.14 }));
  const poisonMat = reg(mat('#aaff55', { emissive: new THREE.Color('#7fff00'), ei: 2.2, rough: 0.3 }));
  const eyeMat = reg(mat('#e6ff7a', { emissive: new THREE.Color('#aaff55'), ei: 2.6, rough: 0.35 }));
  const toothMat = reg(mat('#efeede', { rough: 0.4 }));

  const bodyHalf = torsoW * 0.92;   // 身體前後半長
  const sideZ = torsoW * 0.44;      // 足部左右偏移
  const HEAD_DX = bodyHalf + 4, HEAD_DY = -40; // 頭壓低到與身體中線同高（壁虎感）；相對 head/faceGroup 原點

  // --- 軀幹：低伏修長身軀（橢球）+ 較亮腹甲 ---
  const torso = new THREE.Group();
  const belly = new THREE.Mesh(new THREE.SphereGeometry(torsoW * 0.5, 18, 12), scaleMat);
  belly.scale.set(1.95, 0.56, 0.88); belly.position.y = -5; belly.castShadow = true;
  torso.add(belly);
  const ventral = new THREE.Mesh(new THREE.SphereGeometry(torsoW * 0.46, 14, 10), bellyMat);
  ventral.scale.set(1.86, 0.4, 0.74); ventral.position.y = -11; torso.add(ventral);
  // 背部橫向紫斑紋帶（點綴用，不要一大坨紫）
  for (let i = 0; i < 5; i++) {
    const x = bodyHalf * 0.55 - i * bodyHalf * 0.28;
    const stripe = new THREE.Mesh(new THREE.SphereGeometry(torsoW * 0.16, 10, 8), spikeMat);
    stripe.scale.set(0.26, 0.4, 1.4); stripe.position.set(x, 3.8, 0); torso.add(stripe);
  }

  // --- 背脊鱗棘（後掃）+ 兩側鱗甲列 + 暗紫毒斑 + 毒腺滴毒 ---
  const ridgeN = 11;
  for (let i = 0; i < ridgeN; i++) {
    const t = i / (ridgeN - 1);
    const x = bodyHalf * 0.78 - t * bodyHalf * 1.6;
    const h = 3.5 + Math.sin(t * Math.PI) * 7;
    const scute = new THREE.Mesh(new THREE.ConeGeometry(2.3, h, 4), spikeMat);
    scute.position.set(x, 4.2 + h * 0.35, 0); scute.rotation.z = 0.5; torso.add(scute);
  }
  // 兩側交錯鱗甲
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const x = bodyHalf * 0.68 - t * bodyHalf * 1.45;
    const w = Math.sin(t * Math.PI);
    for (const sz of [-1, 1]) {
      const sc = new THREE.Mesh(new THREE.ConeGeometry(2.0, 3.0, 4), purpleMat);
      sc.position.set(x, 1.5 + w * 2.5, sz * (torsoW * 0.3 + w * 5)); sc.rotation.x = sz * 0.7; sc.rotation.z = 0.3; torso.add(sc);
    }
  }
  // 暗紫毒斑
  for (const [x, z] of [[bodyHalf * 0.42, 11], [bodyHalf * 0.08, -13], [-bodyHalf * 0.2, 10], [-bodyHalf * 0.46, -8]]) {
    const blotch = new THREE.Mesh(new THREE.SphereGeometry(5, 10, 8), purpleMat);
    blotch.scale.set(1.5, 0.3, 1.1); blotch.position.set(x, 4.5, z); torso.add(blotch);
  }
  // 毒腺滴毒
  for (const t of [0.34, 0.52, 0.7]) {
    const x = bodyHalf * 0.78 - t * bodyHalf * 1.6;
    const drip = new THREE.Mesh(new THREE.SphereGeometry(2.0, 8, 6), poisonMat);
    drip.scale.set(1, 1.7, 1); drip.position.set(x, 6.5, 0); torso.add(drip);
  }

  // --- 連續漸縮長尾 ---
  torso.add(buildTail(scaleMat, spikeMat, -bodyHalf * 0.9, -3, torsoW * 0.26));

  // --- 頸 + 扁長爬蟲頭顱（前下方）---
  const head = new THREE.Group();
  const darkGreenMat = reg(mat(shade(GREEN, -0.16), { rough: 0.5, metal: 0.12 }));
  const pupilMat = reg(mat('#16240e', { rough: 0.5 }));
  const tongueMat = reg(mat('#b0324e', { rough: 0.5 }));

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(torsoW * 0.26, torsoW * 0.22, torsoW * 0.55, 8), scaleMat);
  neck.position.set(HEAD_DX - torsoW * 0.34, HEAD_DY + torsoW * 0.03, 0); neck.rotation.z = Math.PI / 2 - 0.06; // 水平脖子，與身體同高
  head.add(neck);
  // 扁長頭顱（壓低、加長）
  const skull = new THREE.Mesh(new THREE.BoxGeometry(torsoW * 0.5, torsoW * 0.18, torsoW * 0.36), scaleMat);
  skull.position.set(HEAD_DX, HEAD_DY, 0); skull.castShadow = true; head.add(skull);
  // 頭頂與吻背紫紋
  const headStripe = new THREE.Mesh(new THREE.BoxGeometry(torsoW * 0.66, torsoW * 0.04, torsoW * 0.14), purpleMat);
  headStripe.position.set(HEAD_DX + torsoW * 0.12, HEAD_DY + torsoW * 0.095, 0); head.add(headStripe);
  // 長吻（壓扁加寬，向 +X 尖出 → 巨蜥/鱷吻）
  const snout = new THREE.Mesh(new THREE.ConeGeometry(torsoW * 0.17, torsoW * 0.62, 6), scaleMat);
  snout.scale.set(0.62, 1, 1.35); snout.rotation.z = -Math.PI / 2;
  snout.position.set(HEAD_DX + torsoW * 0.46, HEAD_DY - torsoW * 0.02, 0); head.add(snout);
  // 下顎
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(torsoW * 0.56, torsoW * 0.07, torsoW * 0.3), darkGreenMat);
  jaw.position.set(HEAD_DX + torsoW * 0.2, HEAD_DY - torsoW * 0.12, 0); head.add(jaw);
  // 鼻孔（吻背）
  for (const sz of [-1, 1]) {
    const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.9, 6, 5), pupilMat);
    nostril.position.set(HEAD_DX + torsoW * 0.68, HEAD_DY + torsoW * 0.03, sz * torsoW * 0.05); head.add(nostril);
  }
  // 一排利齒（上頜兩側，前大後小）
  for (let i = 0; i < 5; i++) {
    const tx = HEAD_DX + torsoW * (0.14 + i * 0.1);
    for (const sz of [-1, 1]) {
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.8, 4.5 - i * 0.5, 4), toothMat);
      tooth.position.set(tx, HEAD_DY - torsoW * 0.1, sz * torsoW * 0.09); tooth.rotation.x = Math.PI; head.add(tooth);
    }
  }
  // 分岔毒舌（微吐）
  for (const sz of [-1, 1]) {
    const tongue = new THREE.Mesh(new THREE.ConeGeometry(0.6, torsoW * 0.2, 4), tongueMat);
    tongue.position.set(HEAD_DX + torsoW * 0.78, HEAD_DY - torsoW * 0.09, sz * 1.6); tongue.rotation.z = -Math.PI / 2 - 0.12; tongue.rotation.y = sz * 0.25; head.add(tongue);
  }
  // 眉脊（凶相）
  for (const sz of [-1, 1]) {
    const brow = new THREE.Mesh(new THREE.BoxGeometry(torsoW * 0.18, 2.4, 4.2), darkGreenMat);
    brow.position.set(HEAD_DX + torsoW * 0.02, HEAD_DY + torsoW * 0.11, sz * torsoW * 0.15); brow.rotation.x = sz * 0.2; brow.rotation.z = -0.18; head.add(brow);
  }
  // 後掃低冠棘（取代三角龍角；延續背脊）
  for (let i = 0; i < 4; i++) {
    const crest = new THREE.Mesh(new THREE.ConeGeometry(1.5 - i * 0.25, torsoW * (0.13 - i * 0.02), 4), spikeMat);
    crest.position.set(HEAD_DX - torsoW * (0.04 + i * 0.1), HEAD_DY + torsoW * (0.12 - i * 0.005), 0); crest.rotation.z = 0.9; head.add(crest);
  }
  // 直瞳裂眼（eye 為 Group：眼球+直瞳；只有 scale.y 會被眨眼動畫改）
  const mkEye = (sz) => {
    const g = new THREE.Group();
    g.position.set(HEAD_DX + torsoW * 0.03, HEAD_DY + torsoW * 0.08, sz * torsoW * 0.17);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(2.8, 12, 10), eyeMat);
    ball.scale.set(0.95, 1.3, 1.0); g.add(ball);
    const slit = new THREE.Mesh(new THREE.BoxGeometry(1.4, 3.4, 0.9), pupilMat);
    slit.position.set(1.7, 0, sz * 0.6); slit.rotation.y = sz * 0.4; g.add(slit);
    return g;
  };
  face.eyeL = mkEye(-1); face.eyeR = mkEye(1);
  faceGroup.add(face.eyeL); faceGroup.add(face.eyeR);

  // --- 四足（前足=arm、後足=leg；重新定位到低處身體四角，外撇蹲伏）---
  const legW = 3.4 * bulk, legLen = 14;
  const mkFoot = (pivot) => {
    for (let i = -1; i <= 1; i++) {
      const claw = new THREE.Mesh(new THREE.ConeGeometry(1.3, 5.5, 4), toothMat);
      claw.position.set(legW * 0.5, -legLen - 1, i * legW * 0.42); claw.rotation.z = -Math.PI / 2 - 0.2; pivot.add(claw);
    }
  };
  const armL = mkLimb(0, 0, true, scaleMat, footMat, '#9acd32', legW, legLen);
  const armR = mkLimb(0, 0, true, scaleMat, footMat, '#9acd32', legW, legLen);
  const legL = mkLimb(0, 0, false, scaleMat, footMat, '#9acd32', legW, legLen);
  const legR = mkLimb(0, 0, false, scaleMat, footMat, '#9acd32', legW, legLen);
  armL.position.set(bodyHalf * 0.6, 8, -sideZ);
  armR.position.set(bodyHalf * 0.6, 8, sideZ);
  legL.position.set(-bodyHalf * 0.48, 9, -sideZ * 1.1);
  legR.position.set(-bodyHalf * 0.48, 9, sideZ * 1.1);
  legL.rotation.x = -0.4; legR.rotation.x = 0.4; // 後足外撇（rotation.x 不被走路動畫覆寫）
  for (const p of [armL, armR, legL, legR]) mkFoot(p);

  return { torso, head, armL, armR, legL, legR };
}

// 四足毒蜥以毒牙利爪攻擊，無持械
export function buildWeapon() {}
