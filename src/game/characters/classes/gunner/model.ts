// @ts-nocheck
import * as THREE from 'three';
import { buildGunnerWeapon } from './weapon.ts';

// 設為 headgear: 'none'，這樣我們就可以在 buildModel 中親自組裝比例完美、細節豐富的牛仔帽
export const modelConfig = { bulk: 1.8, weapon: 'dualguns', skinKind: 'leather', headgear: 'none' };

export function buildModel(ctx) {
  const {
    base, bulk, reg, mat, shade,
    torsoW, torsoD, torsoH, hipY, shoulderY, headY, frontX,
    defaultBodyMat, defaultHeadMat, defaultArmMat, defaultBootMat,
    darkMat, goldMat, faceGroup, mkLimb, addAccent, materialTex,
  } = ctx;

  // 1. 載入專屬的 3D 材質
  const leatherTex = materialTex ? materialTex('leather', 'robe') : null;
  const leatherMat = reg(mat(0xffffff, { rough: 0.62, metal: 0.15, map: leatherTex }));

  const hairTex = materialTex ? materialTex('cloth', 'hair') : null;
  const hairMat = reg(mat(0xffffff, { rough: 0.75, metal: 0.08, map: hairTex }));
  hairMat.flatShading = true;

  const steelTex = materialTex ? materialTex('metal', 'steel') : null;
  const steelMat = reg(mat(0xa8a8a8, { rough: 0.32, metal: 0.82, map: steelTex }));

  const bulletTex = materialTex ? materialTex('metal', 'bullet') : null;
  const bulletMat = reg(mat(0xffffff, { rough: 0.28, metal: 0.88, map: bulletTex }));

  const jointMat = reg(mat(0xffa200, { emissive: 0xffa200, ei: 1.0, rough: 0.15, metal: 0.1 }));
  const kerchiefMat = reg(mat(0x922b21, { rough: 0.7, metal: 0.05 })); // 暗紅色領巾
  const eyeMat = reg(mat(0xffd76a, { emissive: 0xffd76a, ei: 1.0 }));

  // --- MULTI-SEGMENTED BODY CORE ---
  const torso = new THREE.Group();

  // A. Upper Torso (Chest Vest / 皮革排扣背心)
  const chestPlateGeom = new THREE.CylinderGeometry(torsoW * 0.44, torsoW * 0.38, torsoH * 0.48, 4, 1);
  const chestPlate = new THREE.Mesh(chestPlateGeom, leatherMat);
  chestPlate.position.set(0, torsoH * 0.22, 0);
  chestPlate.rotation.y = Math.PI / 4;
  chestPlate.castShadow = true;
  torso.add(chestPlate);

  // 在胸甲正面 (+X 面) 加鋼製圓鈕扣
  for (const yOffset of [torsoH * 0.34, torsoH * 0.22, torsoH * 0.1]) {
    const button = new THREE.Mesh(new THREE.CylinderGeometry(0.55 * bulk, 0.55 * bulk, 0.4 * bulk, 6), steelMat);
    button.position.set(torsoD * 0.45 + 0.8, yOffset, 0);
    button.rotation.z = Math.PI / 2;
    button.castShadow = true;
    torso.add(button);
  }

  // B. Middle Torso (Slender Waist / 黑色皮帶收腰)
  const waistGeom = new THREE.CylinderGeometry(torsoW * 0.28, torsoW * 0.32, torsoH * 0.22, 8);
  const waist = new THREE.Mesh(waistGeom, darkMat);
  waist.position.set(0, torsoH * -0.06, 0);
  waist.castShadow = true;
  torso.add(waist);

  // C. Lower Torso (Pelvis / 臀部底座)
  const pelvisGeom = new THREE.CylinderGeometry(torsoW * 0.32, torsoW * 0.45, torsoH * 0.32, 4, 1);
  const pelvis = new THREE.Mesh(pelvisGeom, leatherMat);
  pelvis.position.set(0, torsoH * -0.3, 0);
  pelvis.rotation.y = Math.PI / 4;
  pelvis.castShadow = true;
  torso.add(pelvis);

  // D. 雙十字交叉子彈帶 (Crisscross Bandoliers)
  const belt1 = new THREE.Mesh(new THREE.TorusGeometry(torsoW * 0.34, 0.8 * bulk, 6, 24), bulletMat);
  belt1.position.set(0, torsoH * -0.06, 0);
  belt1.rotation.set(Math.PI / 2 + 0.25, 0.15, 0);
  belt1.castShadow = true;
  torso.add(belt1);

  const belt2 = new THREE.Mesh(new THREE.TorusGeometry(torsoW * 0.36, 0.8 * bulk, 6, 24), bulletMat);
  belt2.position.set(0, torsoH * -0.15, 0);
  belt2.rotation.set(Math.PI / 2 - 0.25, -0.15, 0);
  belt2.castShadow = true;
  torso.add(belt2);

  // E. 兩側戰術槍套與流蘇下擺 (Pouches & Tassels)
  for (const sz of [-1, 1]) {
    const holsterGroup = new THREE.Group();
    holsterGroup.position.set(0, torsoH * -0.32, sz * (torsoW * 0.46 + 1.2));
    
    // 槍套箱體
    const holster = new THREE.Mesh(new THREE.BoxGeometry(3.6 * bulk, 6.8 * bulk, 1.8 * bulk), darkMat);
    holster.castShadow = true;
    holsterGroup.add(holster);

    // 金屬帶扣 (鋼製)
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.4 * bulk, 1.2 * bulk, 1.2 * bulk), steelMat);
    buckle.position.set(1.9 * bulk, 0, 0);
    buckle.castShadow = true;
    holsterGroup.add(buckle);

    // 垂墜流蘇 (Tassels)
    const tassel = new THREE.Mesh(new THREE.BoxGeometry(3.2 * bulk, 2.8 * bulk, 0.3 * bulk), leatherMat);
    tassel.position.y = -4.8 * bulk;
    tassel.rotation.z = sz * 0.18;
    tassel.castShadow = true;
    holsterGroup.add(tassel);

    torso.add(holsterGroup);
  }

  // F. 護肩甲 (Pauldrons) - 包裹手臂關節
  for (const sz of [-1, 1]) {
    const pauldron = new THREE.Mesh(new THREE.SphereGeometry(torsoW * 0.24, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), leatherMat);
    pauldron.position.set(0, torsoH * 0.44, sz * (torsoW * 0.5 + 0.8));
    pauldron.rotation.set(0, 0, sz * -0.18);
    pauldron.scale.set(1.1, 0.72, 1.1);
    pauldron.castShadow = true;
    torso.add(pauldron);

    const trim = new THREE.Mesh(new THREE.TorusGeometry(torsoW * 0.24, 0.4 * bulk, 6, 18), steelMat);
    trim.position.copy(pauldron.position);
    trim.rotation.set(Math.PI / 2, 0, sz * -0.18);
    trim.castShadow = true;
    torso.add(trim);
  }

  // --- HEAD, HAT & HAIR ---
  // 基礎頭部
  const head = new THREE.Mesh(new THREE.SphereGeometry(7.2 * bulk, 16, 12), reg(mat(0xe9b98a, { rough: 0.6, metal: 0.05 })));

  // 1. 暗紅色領巾 (Kerchief)
  const kerchief = new THREE.Mesh(new THREE.BoxGeometry(3.2 * bulk, 3.2 * bulk, 6.0 * bulk), kerchiefMat);
  kerchief.position.set(frontX * 0.65, -4.5 * bulk, 0);
  kerchief.rotation.y = 0.15;
  head.add(kerchief);

  const kerchiefTail = new THREE.Mesh(new THREE.ConeGeometry(1.4 * bulk, 4.5 * bulk, 4), kerchiefMat);
  kerchiefTail.position.set(frontX * 0.85, -6.5 * bulk, 0);
  kerchiefTail.rotation.set(0.2, 0, -0.4);
  head.add(kerchiefTail);

  // 發光眼部
  for (const sz of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.4, 2.2), eyeMat);
    eye.position.set(frontX - 0.4, 1.4, sz * 2.4 * bulk);
    faceGroup.add(eye);
  }

  // 2. 自製等比例牛仔帽 (Custom Cowboy Hat) - 作為 head 的子物件自動跟隨旋轉
  const hatGroup = new THREE.Group();
  head.add(hatGroup);

  // 帽簷 (Brim) - 扁平橢圓圓盤
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(9.6 * bulk, 9.6 * bulk, 0.4 * bulk, 16), leatherMat);
  brim.position.y = 4.2 * bulk;
  brim.scale.set(1.15, 1, 1.35); // 前後較長的橢圓
  brim.castShadow = true;
  hatGroup.add(brim);

  // 帽簷微翹的深色邊緣
  const brimGold = new THREE.Mesh(new THREE.TorusGeometry(9.6 * bulk, 0.28 * bulk, 6, 24), darkMat);
  brimGold.position.y = 4.3 * bulk;
  brimGold.scale.set(1.15, 1.35, 1);
  brimGold.rotation.x = Math.PI / 2;
  brimGold.castShadow = true;
  hatGroup.add(brimGold);

  // 帽冠 (Crown) - 錐形頂部
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(4.8 * bulk, 5.8 * bulk, 6.8 * bulk, 8), leatherMat);
  crown.position.y = 7.6 * bulk;
  crown.castShadow = true;
  hatGroup.add(crown);

  // 深色皮革帽帶 (Hat Band)
  const hatBand = new THREE.Mesh(new THREE.TorusGeometry(5.9 * bulk, 0.5 * bulk, 8, 20), darkMat);
  hatBand.position.y = 4.5 * bulk;
  hatBand.rotation.x = Math.PI / 2;
  hatBand.castShadow = true;
  hatGroup.add(hatBand);

  // 3. 不對稱低多邊形動漫髮型 (Anime Spiky Hair under the hat)
  const hairGroup = new THREE.Group();
  head.add(hairGroup);

  // 頭皮基座蓋 (No-Gap Hairline Base)
  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(7.24 * bulk, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.62),
    hairMat
  );
  hairCap.position.set(-0.2 * bulk, 0.6 * bulk, 0);
  hairGroup.add(hairCap);

  // 14 根定位精準的 Cone 髮束 (從帽簷下探出，具有放射狀弧度且不夾帽簷)
  const spikes = [
    // 前額瀏海 (Bangs) - 向前下方伸展
    { r: 1.3, h: 5.5, px: 5.2, py: 1.8, pz: 2.2, rx: -0.25, ry: 0.1, rz: -2.85, sx: 0.35, sy: 1.0, sz: 1.0 },
    { r: 1.2, h: 5.8, px: 5.5, py: 2.2, pz: 0.8, rx: -0.1, ry: 0.05, rz: -2.95, sx: 0.35, sy: 1.0, sz: 1.1 },
    { r: 1.2, h: 5.8, px: 5.5, py: 2.2, pz: -0.8, rx: 0.1, ry: -0.05, rz: -2.95, sx: 0.35, sy: 1.0, sz: 1.1 },
    { r: 1.3, h: 5.5, px: 5.2, py: 1.8, pz: -2.2, rx: 0.25, ry: -0.1, rz: -2.85, sx: 0.35, sy: 1.0, sz: 1.0 },

    // 兩側鬢角 (Sideburns)
    { r: 1.2, h: 7.5, px: 1.8, py: -0.2, pz: 5.5, rx: -0.45, ry: 0.2, rz: -2.6, sx: 1.0, sy: 1.0, sz: 0.35 },
    { r: 1.0, h: 5.5, px: -0.6, py: -0.4, pz: 5.8, rx: -0.3, ry: 0.1, rz: -2.5, sx: 0.9, sy: 1.0, sz: 0.35 },
    { r: 1.2, h: 7.5, px: 1.8, py: -0.2, pz: -5.5, rx: 0.45, ry: -0.2, rz: -2.6, sx: 1.0, sy: 1.0, sz: 0.35 },
    { r: 1.0, h: 5.5, px: -0.6, py: -0.4, pz: -5.8, rx: 0.3, ry: -0.1, rz: -2.5, sx: 0.9, sy: 1.0, sz: 0.35 },

    // 後腦勺垂髮 (Back Locks)
    { r: 1.5, h: 7.0, px: -4.5, py: 2.6, pz: 0, rx: 0, ry: 0, rz: -1.4, sx: 0.4, sy: 1.0, sz: 1.1 },
    { r: 1.3, h: 6.5, px: -4.8, py: 1.0, pz: 1.5, rx: -0.3, ry: 0.2, rz: -1.6, sx: 0.4, sy: 1.0, sz: 1.0 },
    { r: 1.3, h: 6.5, px: -4.8, py: 1.0, pz: -1.5, rx: 0.3, ry: -0.2, rz: -1.6, sx: 0.4, sy: 1.0, sz: 1.0 },
  ];

  for (const s of spikes) {
    const geom = new THREE.ConeGeometry(s.r * bulk, s.h * bulk, 6);
    const mesh = new THREE.Mesh(geom, hairMat);
    mesh.position.set(s.px * bulk, s.py * bulk, s.pz * bulk);
    mesh.rotation.set(s.rx, s.ry, s.rz);
    mesh.scale.set(s.sx, s.sy, s.sz);
    mesh.castShadow = true;
    hairGroup.add(mesh);
  }

  // --- DETAILED CUSTOM LIMBS ---
  const armL = mkLimb(0, -ctx.shoulderX, true, leatherMat, darkMat, base);
  const armR = mkLimb(0, ctx.shoulderX, true, leatherMat, darkMat, base);
  const legL = mkLimb(0, -ctx.hipX, false, leatherMat, darkMat, base);
  const legR = mkLimb(0, ctx.hipX, false, leatherMat, darkMat, base);

  const customizeLimb = (pivot, isArm, pz, limbMat, bootMat, ringCol) => {
    // 清除預設肢體，重新繪製立體結構
    while (pivot.children.length > 0) {
      pivot.remove(pivot.children[0]);
    }

    const len = 15;
    const w = isArm ? 4.5 * bulk : 5.5 * bulk;

    // 1. 上肢/大腿 (Tapered hexagonal cylinder) - 皮革包裹
    const upperLimb = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.45, w * 0.45, len * 0.55, 6), limbMat);
    upperLimb.position.y = -len * 0.275;
    upperLimb.castShadow = true;
    pivot.add(upperLimb);

    // 上肢皮帶裝飾
    const strap = new THREE.Mesh(new THREE.BoxGeometry(w * 1.06, 0.8 * bulk, w * 1.06), darkMat);
    strap.position.y = -len * 0.2;
    strap.castShadow = true;
    pivot.add(strap);

    // 2. 手肘/膝蓋發光晶體關節 (Glowing Amber Crystal Joint)
    const joint = new THREE.Mesh(new THREE.OctahedronGeometry(w * 0.44, 0), jointMat);
    joint.position.y = -len * 0.55;
    joint.castShadow = true;
    pivot.add(joint);

    // 3. 下半截 (Gauntlet / Boot) - 重型牛仔護腕與牛仔靴
    const bootW = w * 1.35;
    const bootH = len * 0.4;
    const lowerArmor = new THREE.Mesh(new THREE.BoxGeometry(bootW, bootH, bootW), bootMat);
    lowerArmor.position.y = -len * 0.55 - bootH / 2;
    lowerArmor.castShadow = true;
    pivot.add(lowerArmor);

    // 鋼製壓邊
    const bootTrim = new THREE.Mesh(new THREE.BoxGeometry(bootW + 0.3, 0.6 * bulk, bootW + 0.3), steelMat);
    bootTrim.position.y = -len * 0.55;
    bootTrim.castShadow = true;
    pivot.add(bootTrim);

    // 外側金屬皮帶扣 (Buckle Detail) - 鋼製
    const isLeft = pz < 0;
    const outerSign = isLeft ? -1 : 1;
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.45 * bulk, 1.2 * bulk, 1.2 * bulk), steelMat);
    buckle.position.set(0, -len * 0.55 - bootH / 2, outerSign * (bootW * 0.5 + 0.16 * bulk));
    buckle.castShadow = true;
    pivot.add(buckle);

    // 底部接觸發光環
    const ringMat = reg(mat(ringCol, { emissive: ringCol, ei: 2.2 }));
    const ring = new THREE.Mesh(new THREE.BoxGeometry(bootW + 0.6, 1.0, bootW + 0.6), ringMat);
    ring.position.y = -len * 0.55 - bootH;
    pivot.add(ring);

    // 4. 重型馬刺 (Legs only, Spurs on heels)
    if (!isArm) {
      // 馬刺柄 (Spur shank) - 指向後方 (-X)
      const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * bulk, 0.3 * bulk, 2.2 * bulk, 4), steelMat);
      shank.position.set(-bootW * 0.5 - 1.0 * bulk, -len * 0.55 - bootH + 1.2 * bulk, 0);
      shank.rotation.z = Math.PI / 2;
      shank.castShadow = true;
      pivot.add(shank);

      // 馬刺星型齒輪 (Spur rowel) - 鋼製
      const rowel = new THREE.Mesh(new THREE.CylinderGeometry(1.2 * bulk, 1.2 * bulk, 0.3 * bulk, 6), steelMat);
      rowel.position.set(-bootW * 0.5 - 2.1 * bulk, -len * 0.55 - bootH + 1.2 * bulk, 0);
      rowel.rotation.x = Math.PI / 2; // 立起
      rowel.castShadow = true;
      pivot.add(rowel);
    }
  };

  customizeLimb(armL, true, -ctx.shoulderX, leatherMat, darkMat, base);
  customizeLimb(armR, true, ctx.shoulderX, leatherMat, darkMat, base);
  customizeLimb(legL, false, -ctx.hipX, leatherMat, darkMat, base);
  customizeLimb(legR, false, ctx.hipX, leatherMat, darkMat, base);

  return { torso, head, armL, armR, legL, legR };
}

export const buildWeapon = buildGunnerWeapon;
