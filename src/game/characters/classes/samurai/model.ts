// @ts-nocheck
import * as THREE from 'three';
import { buildSamuraiWeapon } from './weapon.ts';

export const modelConfig = { bulk: 2.04, weapon: 'katana', skinKind: 'cloth', headgear: 'none', pauldron: false, swingStyle: 'horizontal', stretchBlade: true };

// 武士：重置後的「墮天劍聖」版本。
// 具備多段式立體重裝甲、肩甲、裙擺、精緻的斗笠、散髮與飄逸蒙眼帶，背負斷裂赤色劍輪。
export function buildModel(ctx) {
  const {
    bulk, reg, mat, shade,
    torsoW, torsoD, torsoH, shoulderY, frontX,
    faceGroup, mkLimb, addAccent, materialTex,
  } = ctx;

  const BLACK = '#151515', CLOTH = '#262020', WHITE = '#f2f0dc', RED = '#d94343';

  // 取得程序化繪製材質貼圖
  const hairTex = materialTex ? materialTex('cloth', 'hair') : null;
  const hatTex = materialTex ? materialTex('cloth', 'hat') : null;
  const robeTex = materialTex ? materialTex('cloth', 'robe') : null;
  const armorTex = materialTex ? materialTex('steel', 'armor') : null;
  const goldTex = materialTex ? materialTex('metal', 'gold') : null;

  // 材質設定 (減少金色使用，著重於黑、白、赤與冷鋼色調)
  const clothMat = reg(mat(CLOTH, { map: robeTex, rough: 0.8, metal: 0.1 }));
  const armorMat = reg(mat(BLACK, { map: armorTex, rough: 0.35, metal: 0.75 }));
  const steelMat = reg(mat(WHITE, { map: armorTex, rough: 0.22, metal: 0.9 })); // 鋼鐵亮白冷鋼色
  const redMat = reg(mat(RED, { emissive: new THREE.Color(RED), ei: 1.25, rough: 0.35, metal: 0.3 }));
  const hairMat = reg(mat(WHITE, { map: hairTex, emissive: new THREE.Color('#8f886f'), ei: 0.6, rough: 0.45, metal: 0.2 }));
  const hatMat = reg(mat('#dcd3b8', { map: hatTex, rough: 0.7, metal: 0.1 }));
  const skinMat = reg(mat(BLACK, { rough: 0.75, metal: 0.18 })); // 黑色面罩/膚色底色

  // 1. 多段式軀幹 (Torso Group)
  const torso = new THREE.Group();

  // 胸甲 (Upper Torso Chest Plate)：斜置的菱形柱
  const upperTorso = new THREE.Mesh(new THREE.CylinderGeometry(torsoW * 0.44, torsoW * 0.54, torsoH * 0.65, 4), armorMat);
  upperTorso.rotation.y = Math.PI / 4;
  upperTorso.position.y = torsoH * 0.2;
  upperTorso.castShadow = true;
  torso.add(upperTorso);

  // 精緻腰帶 (Waist Belt) 與細腰 (Waist Connector)
  const midWaist = new THREE.Mesh(new THREE.CylinderGeometry(torsoW * 0.3, torsoW * 0.32, torsoH * 0.22, 8), skinMat);
  midWaist.position.y = -torsoH * 0.15;
  midWaist.castShadow = true;
  torso.add(midWaist);

  // 臀部/下腹甲 (Pelvis Base)
  const lowerPelvis = new THREE.Mesh(new THREE.CylinderGeometry(torsoW * 0.38, torsoW * 0.48, torsoH * 0.25, 4), clothMat);
  lowerPelvis.rotation.y = Math.PI / 4;
  lowerPelvis.position.y = -torsoH * 0.38;
  lowerPelvis.castShadow = true;
  torso.add(lowerPelvis);

  // 緋紅腰帶繩 (Sash Belt)
  const sash = new THREE.Mesh(new THREE.TorusGeometry(torsoW * 0.44, 1.4, 6, 24), redMat);
  sash.rotation.x = Math.PI / 2;
  sash.position.y = -torsoH * 0.26;
  torso.add(sash);

  // 垂掛裙甲 (Tassets)：四片保護護甲片，紅白交錯
  const tassetW = torsoW * 0.42;
  const tassetH = torsoH * 0.52;
  // 前裙甲 (Front Tasset)
  const tassetF = new THREE.Mesh(new THREE.BoxGeometry(tassetW, tassetH, 1.2), redMat);
  tassetF.position.set(torsoD * 0.45, -torsoH * 0.65, 0);
  tassetF.rotation.z = 0.1;
  tassetF.castShadow = true;
  torso.add(tassetF);
  // 後裙甲 (Back Tasset)
  const tassetB = new THREE.Mesh(new THREE.BoxGeometry(tassetW, tassetH, 1.2), clothMat);
  tassetB.position.set(-torsoD * 0.45, -torsoH * 0.65, 0);
  tassetB.rotation.z = -0.1;
  tassetB.castShadow = true;
  torso.add(tassetB);
  // 左側裙甲 (Left Tasset)
  const tassetL = new THREE.Mesh(new THREE.BoxGeometry(1.2, tassetH, tassetW), clothMat);
  tassetL.position.set(0, -torsoH * 0.65, -torsoW * 0.45);
  tassetL.rotation.x = -0.12;
  tassetL.castShadow = true;
  torso.add(tassetL);
  // 右側裙甲 (Right Tasset)
  const tassetR = new THREE.Mesh(new THREE.BoxGeometry(1.2, tassetH, tassetW), redMat);
  tassetR.position.set(0, -torsoH * 0.65, torsoW * 0.45);
  tassetR.rotation.x = 0.12;
  tassetR.castShadow = true;
  torso.add(tassetR);

  // 肩甲 (Pauldrons)：大片圓弧甲 overlays arm joint (改用鋼鐵銀色滾邊，取消金色)
  const pauldronL = new THREE.Mesh(new THREE.SphereGeometry(3.8 * bulk, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2), armorMat);
  pauldronL.position.set(0, torsoH * 0.42, -ctx.shoulderX);
  pauldronL.rotation.z = -Math.PI / 3.8;
  pauldronL.castShadow = true;
  torso.add(pauldronL);

  const pauldronLTrim = new THREE.Mesh(new THREE.TorusGeometry(3.9 * bulk, 0.6, 4, 16, Math.PI), steelMat);
  pauldronLTrim.position.set(0, torsoH * 0.42, -ctx.shoulderX);
  pauldronLTrim.rotation.set(0, Math.PI / 2, -Math.PI / 3.8);
  pauldronLTrim.castShadow = true;
  torso.add(pauldronLTrim);

  const pauldronR = pauldronL.clone();
  pauldronR.position.z = ctx.shoulderX;
  pauldronR.rotation.z = Math.PI / 3.8;
  torso.add(pauldronR);

  const pauldronRTrim = pauldronLTrim.clone();
  pauldronRTrim.position.z = ctx.shoulderX;
  pauldronRTrim.rotation.set(0, Math.PI / 2, Math.PI / 3.8);
  torso.add(pauldronRTrim);

  // 2. 頭部 (Head) 與斗笠、散髮、飄帶
  const head = new THREE.Mesh(new THREE.SphereGeometry(6.2 * bulk, 14, 10), skinMat);
  head.scale.set(0.9, 1.05, 0.9);
  head.castShadow = true;

  // 額頭頭髮基底 (No-Gap Hairline Base)
  const hairBase = new THREE.Mesh(new THREE.SphereGeometry(6.32 * bulk, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), hairMat);
  hairBase.position.set(0, 0.4 * bulk, 0);
  hairBase.scale.set(0.92, 1.0, 0.92);
  hairBase.castShadow = true;
  head.add(hairBase);

  // 散亂的銀白短髮 (Spiky locks)
  const hairData = [
    // [px, py, pz, rx, ry, rz, sx, sy, sz]
    [frontX * 0.72, 1.0 * bulk, -3.2 * bulk, 0.22, 0.4, -0.6, 1.5, 9.0 * bulk, 0.5],
    [frontX * 0.72, 1.0 * bulk, 3.2 * bulk, -0.22, -0.4, -0.6, 1.5, 9.0 * bulk, 0.5],
    [frontX * 0.82, 1.4 * bulk, -1.0 * bulk, 0.06, 0.1, -0.72, 1.6, 10.0 * bulk, 0.5],
    [frontX * 0.82, 1.4 * bulk, 1.0 * bulk, -0.06, -0.1, -0.72, 1.6, 10.0 * bulk, 0.5],
    [1.5 * bulk, -1.2 * bulk, -5.4 * bulk, 0.32, 0.8, -0.2, 1.45, 11.5 * bulk, 0.5],
    [1.5 * bulk, -1.2 * bulk, 5.4 * bulk, -0.32, -0.8, -0.2, 1.45, 11.5 * bulk, 0.5],
    [-2.8 * bulk, -0.6 * bulk, -4.8 * bulk, 0.52, 1.2, 0.42, 1.5, 10.5 * bulk, 0.5],
    [-2.8 * bulk, -0.6 * bulk, 4.8 * bulk, -0.52, -1.2, 0.42, 1.5, 10.5 * bulk, 0.5],
    [-4.6 * bulk, -1.4 * bulk, -2.0 * bulk, 0.26, 1.8, 0.68, 1.65, 10.0 * bulk, 0.5],
    [-4.6 * bulk, -1.4 * bulk, 2.0 * bulk, -0.26, -1.8, 0.68, 1.65, 10.0 * bulk, 0.5],
  ];

  hairData.forEach(([px, py, pz, rx, ry, rz, sx, sy, sz]) => {
    const lock = new THREE.Mesh(new THREE.ConeGeometry(1.15, 1.0, 4), hairMat);
    lock.position.set(px, py, pz);
    lock.rotation.set(rx, ry, rz);
    lock.scale.set(sx, sy, sz);
    lock.castShadow = true;
    head.add(lock);
  });

  // 扁平編織斗笠 (Kasa) - 微微向後傾斜
  const hat = new THREE.Mesh(new THREE.ConeGeometry(12.5 * bulk, 3.2 * bulk, 16), hatMat);
  hat.position.set(-0.8 * bulk, 5.8 * bulk, 0);
  hat.rotation.x = 0.16; // Tilted slightly back
  hat.castShadow = true;
  head.add(hat);

  // 斗笠頂部裝飾 (改為黑鐵暗色，取消金色)
  const hatTop = new THREE.Mesh(new THREE.CylinderGeometry(0.8 * bulk, 1.2 * bulk, 0.8 * bulk, 8), skinMat);
  hatTop.position.set(0, 1.8 * bulk, 0);
  hatTop.castShadow = true;
  hat.add(hatTop);

  // 白色蒙眼帶 (Blindfold)
  const band = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.5 * bulk, 12.2 * bulk), hairMat);
  band.position.set(frontX * 0.86, 0.5, 0);
  faceGroup.add(band);

  // 腦後長長飄起的蒙眼帶結與飄帶 (Fluttering blindfold ribbons)
  const ribbonL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.4 * bulk, 18.0 * bulk), hairMat);
  ribbonL.position.set(-5.8 * bulk, -1.8 * bulk, -3.8 * bulk);
  ribbonL.rotation.set(0.2, 0.35, 0.3);
  ribbonL.castShadow = true;
  head.add(ribbonL);

  const ribbonR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.2 * bulk, 15.0 * bulk), hairMat);
  ribbonR.position.set(-5.8 * bulk, -2.6 * bulk, 3.8 * bulk);
  ribbonR.rotation.set(-0.2, -0.35, 0.3);
  ribbonR.castShadow = true;
  head.add(ribbonR);

  // 3. 客製化肢體 (Custom Detailed Limbs) - 關節改為黑鐵，防具鑲邊改為冷鋼
  const armL = mkLimb(0, -ctx.shoulderX, true, clothMat, armorMat, RED, 5.2 * bulk, 14);
  const armR = mkLimb(0, ctx.shoulderX, true, clothMat, armorMat, RED, 5.4 * bulk, 14);
  const legL = mkLimb(0, -ctx.hipX, false, clothMat, armorMat, WHITE, 5.8 * bulk, 14);
  const legR = mkLimb(0, ctx.hipX, false, clothMat, armorMat, WHITE, 5.8 * bulk, 14);

  const rebuildArm = (pivot, isLeft) => {
    if (typeof pivot.clear === 'function') pivot.clear();
    else while (pivot.children.length > 0) pivot.remove(pivot.children[0]);

    const w = isLeft ? 5.2 * bulk : 5.4 * bulk;
    const len = 14;

    // 肩關節球 (黑鐵)
    const shoulderJoint = new THREE.Mesh(new THREE.SphereGeometry(w * 0.5, 8, 8), skinMat);
    shoulderJoint.castShadow = true;
    pivot.add(shoulderJoint);

    // 上臂
    const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.38, w * 0.35, len * 0.5, 6), clothMat);
    upperArm.position.y = -len * 0.25;
    upperArm.rotation.y = Math.PI / 6;
    upperArm.castShadow = true;
    pivot.add(upperArm);

    // 手肘結晶
    const elbowJoint = new THREE.Mesh(new THREE.OctahedronGeometry(w * 0.44), redMat);
    elbowJoint.position.y = -len * 0.5;
    elbowJoint.castShadow = true;
    pivot.add(elbowJoint);

    // 下臂裝甲 (Gauntlets)
    const gauntletW = w * 0.98;
    const gauntletH = len * 0.45;
    const gauntlet = new THREE.Mesh(new THREE.BoxGeometry(gauntletW, gauntletH, gauntletW), armorMat);
    gauntlet.position.y = -len * 0.5 - gauntletH / 2;
    gauntlet.castShadow = true;
    pivot.add(gauntlet);

    // 護腕銀色鋼線 (冷鋼取代金色)
    const steelTrim = new THREE.Mesh(new THREE.BoxGeometry(gauntletW + 0.4, 1.2, gauntletW + 0.4), steelMat);
    steelTrim.position.y = -len * 0.5 - gauntletH + 0.6;
    steelTrim.castShadow = true;
    pivot.add(steelTrim);

    // 外側防護片
    const shieldPlate = new THREE.Mesh(new THREE.BoxGeometry(0.6, gauntletH * 0.8, gauntletW * 0.7), redMat);
    shieldPlate.position.set(isLeft ? -gauntletW * 0.45 : gauntletW * 0.45, -len * 0.5 - gauntletH / 2, 0);
    shieldPlate.castShadow = true;
    pivot.add(shieldPlate);
  };

  const rebuildLeg = (pivot, isLeft) => {
    if (typeof pivot.clear === 'function') pivot.clear();
    else while (pivot.children.length > 0) pivot.remove(pivot.children[0]);

    const w = 5.8 * bulk;
    const len = 14;

    // 髖部關節球 (黑鐵)
    const hipJoint = new THREE.Mesh(new THREE.SphereGeometry(w * 0.5, 8, 8), skinMat);
    hipJoint.castShadow = true;
    pivot.add(hipJoint);

    // 大腿
    const upperLeg = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.44, w * 0.4, len * 0.5, 6), clothMat);
    upperLeg.position.y = -len * 0.25;
    upperLeg.rotation.y = Math.PI / 6;
    upperLeg.castShadow = true;
    pivot.add(upperLeg);

    // 膝蓋結晶
    const kneeJoint = new THREE.Mesh(new THREE.OctahedronGeometry(w * 0.46), redMat);
    kneeJoint.position.y = -len * 0.5;
    kneeJoint.castShadow = true;
    pivot.add(kneeJoint);

    // 脛骨靴子裝甲
    const bootW = w * 1.12;
    const bootH = len * 0.45;
    const boot = new THREE.Mesh(new THREE.BoxGeometry(bootW, bootH, bootW), armorMat);
    boot.position.y = -len * 0.5 - bootH / 2;
    boot.castShadow = true;
    pivot.add(boot);

    // 靴頂冷鋼邊 (冷鋼取代金色)
    const bootTrim = new THREE.Mesh(new THREE.BoxGeometry(bootW + 0.4, 1.4, bootW + 0.4), steelMat);
    bootTrim.position.y = -len * 0.5 - 0.7;
    bootTrim.castShadow = true;
    pivot.add(bootTrim);

    // 膝蓋外側甲
    const kneeGuard = new THREE.Mesh(new THREE.BoxGeometry(0.8, bootH * 0.6, bootW * 0.65), redMat);
    kneeGuard.position.set(isLeft ? -bootW * 0.45 : bootW * 0.45, -len * 0.5 - bootH * 0.4, 0);
    kneeGuard.castShadow = true;
    pivot.add(kneeGuard);
  };

  rebuildArm(armL, true);
  rebuildArm(armR, false);
  rebuildLeg(legL, true);
  rebuildLeg(legR, false);

  // 4. 背部巨大浮游斷裂劍輪 (Broken Sword Wheel)
  const wheel = new THREE.Group();
  wheel.position.set(-11, shoulderY + 8, 0); // 高度設在 1.25x torsoH 以上避免穿地
  
  // 斷裂劍輪的主光環
  const ring = new THREE.Mesh(new THREE.TorusGeometry(18.5, 0.9, 8, 48), hairMat);
  ring.rotation.y = Math.PI / 2;
  ring.castShadow = true;
  wheel.add(ring);

  // 9片紅白相間浮游刃 (缺口營造斷裂感)
  for (let i = 0; i < 9; i++) {
    if (i === 2 || i === 6) continue; // 斷裂缺口
    const blade = new THREE.Mesh(new THREE.ConeGeometry(1.3, 21, 4), i % 3 === 0 ? redMat : hairMat);
    blade.scale.set(1.4, 1.0, 0.5);
    const a = (i / 9) * Math.PI * 2;
    blade.position.set(0, Math.sin(a) * 18.5, Math.cos(a) * 18.5);
    
    blade.rotation.x = a;
    blade.rotation.y = Math.PI / 4; // stylized facets
    blade.castShadow = true;
    wheel.add(blade);
  }
  addAccent(wheel);

  return { torso, head, armL, armR, legL, legR };
}

export const buildWeapon = buildSamuraiWeapon;
