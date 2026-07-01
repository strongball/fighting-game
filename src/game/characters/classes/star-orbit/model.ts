// @ts-nocheck
import * as THREE from 'three';
import { buildStarOrbitWeapon } from './weapon.ts';

export const modelConfig = { bulk: 1.92, weapon: 'star-orbit', robe: true, skinKind: 'cloth', headgear: 'hood' };

export function buildModel(ctx) {
  const {
    base, bulk, reg, mat, shade,
    torsoW, torsoD, torsoH, frontX,
    defaultBodyMat, defaultHeadMat, defaultBootMat, goldMat,
    face, faceGroup, mkLimb, addAccent,
    materialTex, bodyTex, shoulderY,
  } = ctx;

  const robeTex = materialTex ? materialTex('cloth', 'robe') : bodyTex;
  const robeMat = reg(mat(shade(base, -0.22), { rough: 0.75, metal: 0.08, map: robeTex }));

  const armorTex = materialTex ? materialTex('cloth', 'armor') : bodyTex;
  const armorMat = reg(mat(0xa8a8a8, { rough: 0.55, metal: 0.4, map: armorTex }));

  const goldTex = materialTex ? materialTex('metal', 'gold') : null;
  const goldMatOverride = reg(mat(0xcacaca, { rough: 0.25, metal: 0.8, map: goldTex }));
  const activeGoldMat = goldMatOverride || goldMat;

  const glassTex = materialTex ? materialTex('glass', 'glass') : null;
  const glassMat = reg(mat(0xbfbfbf, { rough: 0.18, metal: 0.15, map: glassTex, emissive: 0x5ad7ff, ei: 0.72 }));

  const darkGlassMat = reg(mat(0x1a2633, { emissive: 0x113b4c, ei: 0.35, rough: 0.5, metal: 0.2 }));
  const faceMat = reg(mat(0xffebd8, { emissive: 0x221410, ei: 0.1, rough: 0.6, metal: 0.05 }));

  // Create Torso as a THREE.Group to assemble multiple segmented parts
  const torso = new THREE.Group();

  // --- SEGMENTED BODY CORE ---
  // 1. Upper Torso (Chest Armor Plate) - Tapered square prism rotated to look diamond-like
  const chestPlateGeom = new THREE.CylinderGeometry(torsoW * 0.42, torsoW * 0.32, torsoH * 0.45, 4, 1);
  const chestPlate = new THREE.Mesh(chestPlateGeom, armorMat);
  chestPlate.position.set(0, torsoH * 0.18, 0);
  chestPlate.rotation.y = Math.PI / 4;
  chestPlate.castShadow = true;
  torso.add(chestPlate);

  // 2. Middle Torso (Slender Waist)
  const waistGeom = new THREE.CylinderGeometry(torsoW * 0.26, torsoW * 0.28, torsoH * 0.25, 8);
  const waist = new THREE.Mesh(waistGeom, darkGlassMat);
  waist.position.set(0, -torsoH * 0.1, 0);
  waist.castShadow = true;
  torso.add(waist);

  // 3. Lower Torso (Pelvis/Hip Base) - Tapered square prism rotated
  const pelvisGeom = new THREE.CylinderGeometry(torsoW * 0.28, torsoW * 0.46, torsoH * 0.35, 4, 1);
  const pelvis = new THREE.Mesh(pelvisGeom, armorMat);
  pelvis.position.set(0, -torsoH * 0.35, 0);
  pelvis.rotation.y = Math.PI / 4;
  pelvis.castShadow = true;
  torso.add(pelvis);

  // --- ROBES, CLOTHING & ACCESSORIES LAYER ---
  // 1. Floating Orbital Collar (High-tech cosmic rings instead of fabric scarf)
  const collarRing1 = new THREE.Mesh(new THREE.TorusGeometry(torsoW * 0.45, 0.45 * bulk, 6, 24), glassMat);
  collarRing1.position.set(0, torsoH * 0.38, 0);
  collarRing1.rotation.set(Math.PI / 2 + 0.1, 0.15, 0);
  collarRing1.castShadow = true;
  torso.add(collarRing1);

  const collarRing2 = new THREE.Mesh(new THREE.TorusGeometry(torsoW * 0.52, 0.35 * bulk, 6, 24), activeGoldMat);
  collarRing2.position.set(0, torsoH * 0.28, 0);
  collarRing2.rotation.set(Math.PI / 2 - 0.08, -0.1, 0);
  collarRing2.castShadow = true;
  torso.add(collarRing2);

  // 2. Orbital Planet Belt (Tilted orbital ring with small sphere planets)
  const beltGroup = new THREE.Group();
  beltGroup.position.set(0, -torsoH * 0.1, 0);
  beltGroup.rotation.set(0.15, 0, 0.12);
  torso.add(beltGroup);

  const beltRing = new THREE.Mesh(new THREE.TorusGeometry(torsoW * 0.38, 0.45 * bulk, 6, 28), activeGoldMat);
  beltRing.rotation.x = Math.PI / 2;
  beltRing.castShadow = true;
  beltGroup.add(beltRing);

  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const planet = new THREE.Mesh(new THREE.SphereGeometry(1.6 * bulk, 8, 8), glassMat);
    planet.position.set(Math.cos(a) * torsoW * 0.38, 0, Math.sin(a) * torsoW * 0.38);
    planet.castShadow = true;
    beltGroup.add(planet);
  }

  // 3. Long Split Coat Tails (Celestial space coat instead of blocky tassets)
  const coatL = new THREE.Mesh(new THREE.BoxGeometry(0.7 * bulk, torsoH * 1.0, torsoW * 0.32), robeMat);
  coatL.position.set(-torsoD * 0.32, -torsoH * 0.65, torsoW * 0.22);
  coatL.rotation.set(0.12, 0.15, -0.18);
  coatL.castShadow = true;
  torso.add(coatL);

  const coatLTrim = new THREE.Mesh(new THREE.BoxGeometry(0.75 * bulk, torsoH * 1.0, 0.3 * bulk), activeGoldMat);
  coatLTrim.position.set(-torsoD * 0.32, -torsoH * 0.65, torsoW * 0.38);
  coatLTrim.rotation.copy(coatL.rotation);
  coatLTrim.castShadow = true;
  torso.add(coatLTrim);

  const coatR = new THREE.Mesh(new THREE.BoxGeometry(0.7 * bulk, torsoH * 1.0, torsoW * 0.32), robeMat);
  coatR.position.set(-torsoD * 0.32, -torsoH * 0.65, -torsoW * 0.22);
  coatR.rotation.set(-0.12, -0.15, -0.18);
  coatR.castShadow = true;
  torso.add(coatR);

  const coatRTrim = new THREE.Mesh(new THREE.BoxGeometry(0.75 * bulk, torsoH * 1.0, 0.3 * bulk), activeGoldMat);
  coatRTrim.position.set(-torsoD * 0.32, -torsoH * 0.65, -torsoW * 0.38);
  coatRTrim.rotation.copy(coatR.rotation);
  coatRTrim.castShadow = true;
  torso.add(coatRTrim);

  // --- FLOATING RINGS & STAR DECORATIVE PARTS ---
  const coreMat = reg(mat('#f2f7ff', { emissive: new THREE.Color('#5ad7ff'), ei: 1.8, rough: 0.3, metal: 0.2 }));
  const core = new THREE.Mesh(new THREE.SphereGeometry(torsoW * 0.18, 14, 10), coreMat);
  core.position.set(frontX * 0.42, torsoH * 0.08, 0);
  torso.add(core);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(torsoW * 0.34, 1.1, 8, 30), activeGoldMat);
  ring.position.copy(core.position);
  ring.rotation.y = Math.PI / 2;
  torso.add(ring);

  const backRingMat = reg(mat('#5ad7ff', { emissive: new THREE.Color('#5ad7ff'), ei: 1.35, rough: 0.28, metal: 0.5 }));
  const backRing = new THREE.Mesh(new THREE.TorusGeometry(torsoW * 0.74, 1.45, 8, 48), backRingMat);
  backRing.position.set(-torsoD * 0.62, torsoH * 1.2, 0);
  backRing.rotation.y = Math.PI / 2;
  addAccent(backRing);

  const backRing2 = new THREE.Mesh(new THREE.TorusGeometry(torsoW * 0.54, 0.9, 8, 36), activeGoldMat);
  backRing2.position.set(-torsoD * 0.7, torsoH * 1.2, 0);
  backRing2.rotation.y = Math.PI / 2;
  backRing2.rotation.z = 0.55;
  addAccent(backRing2);

  const shardMat = reg(mat('#5ad7ff', { emissive: new THREE.Color('#5ad7ff'), ei: 1.6, rough: 0.25, metal: 0.45 }));
  const orbitCoreMat = reg(new THREE.MeshBasicMaterial({ color: new THREE.Color('#f2f7ff'), transparent: true, opacity: 0.86 }));
  const orbitGlowMat = reg(new THREE.MeshBasicMaterial({ color: new THREE.Color('#5ad7ff'), transparent: true, opacity: 0.58, blending: THREE.AdditiveBlending, depthWrite: false }));
  const orbitGoldMat = reg(new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd166'), transparent: true, opacity: 0.64, blending: THREE.AdditiveBlending, depthWrite: false }));
  const starOrbitShards = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const shard = new THREE.Mesh(new THREE.TorusGeometry(4.0 * bulk, 1.35 * bulk, 5, 5), i === 2 ? activeGoldMat : shardMat);
    shard.position.set(-torsoD * 0.7 - 2, torsoH * 1.2 + Math.cos(a) * torsoW * 0.25, Math.sin(a) * torsoW * 0.72);
    shard.rotation.set(a, 0.4, a * 0.5);
    addAccent(shard);

    const orb = new THREE.Group();
    const orbCore = new THREE.Mesh(new THREE.SphereGeometry(i === 2 ? 7.2 : 6.2, 14, 10), orbitCoreMat);
    const orbShell = new THREE.Mesh(new THREE.IcosahedronGeometry(i === 2 ? 12.5 : 10.5, 1), i === 2 ? orbitGoldMat : orbitGlowMat);
    const orbRingA = new THREE.Mesh(new THREE.TorusGeometry(i === 2 ? 15 : 12, 0.9, 8, 28), i === 2 ? orbitGoldMat : orbitGlowMat);
    const orbRingB = new THREE.Mesh(new THREE.TorusGeometry(i === 2 ? 18 : 14, 0.75, 8, 30), i === 2 ? orbitGoldMat : orbitGlowMat);
    orbRingA.rotation.x = Math.PI / 2.8;
    orbRingB.rotation.z = Math.PI / 2.6;
    orb.add(orbShell, orbCore, orbRingA, orbRingB);
    orb.userData.starOrbitShard = i;
    orb.visible = false;
    addAccent(orb);
    starOrbitShards.push(orb);
  }

  // --- HEAD & FACE ---
  const head = new THREE.Mesh(new THREE.SphereGeometry(7.2 * bulk, 16, 12), faceMat);

  // --- Symmetric Eyes & Eyebrows ---
  const scleraMat = reg(mat(0xfcfcfc, { rough: 0.5 }));
  const pupilMat = reg(mat(0x5ad7ff, { emissive: 0x00d2ff, ei: 1.2 }));
  const browMat = reg(mat(0x1a2d45, { rough: 0.8 }));

  // Left Eye
  face.eyeL = new THREE.Group();
  const scleraL = new THREE.Mesh(new THREE.BoxGeometry(0.95 * bulk, 1.25 * bulk, 2.0 * bulk), scleraMat);
  scleraL.position.set(0, 0, 0);
  face.eyeL.add(scleraL);
  const pupilL = new THREE.Mesh(new THREE.BoxGeometry(0.3 * bulk, 0.6 * bulk, 0.6 * bulk), pupilMat);
  pupilL.position.set(0.15 * bulk, 0, 0);
  face.eyeL.add(pupilL);
  face.eyeL.position.set(frontX - 0.25 * bulk, 0.55 * bulk, 2.05 * bulk);
  faceGroup.add(face.eyeL);

  // Right Eye
  face.eyeR = new THREE.Group();
  const scleraR = new THREE.Mesh(new THREE.BoxGeometry(0.95 * bulk, 1.25 * bulk, 2.0 * bulk), scleraMat);
  scleraR.position.set(0, 0, 0);
  face.eyeR.add(scleraR);
  const pupilR = new THREE.Mesh(new THREE.BoxGeometry(0.3 * bulk, 0.6 * bulk, 0.6 * bulk), pupilMat);
  pupilR.position.set(0.15 * bulk, 0, 0);
  face.eyeR.add(pupilR);
  face.eyeR.position.set(frontX - 0.25 * bulk, 0.55 * bulk, -2.05 * bulk);
  faceGroup.add(face.eyeR);

  // Eyebrows
  const browL = new THREE.Mesh(new THREE.BoxGeometry(0.2 * bulk, 0.25 * bulk, 1.6 * bulk), browMat);
  browL.position.set(frontX + 0.1 * bulk, 1.45 * bulk, 2.05 * bulk);
  browL.rotation.y = 0.1;
  faceGroup.add(browL);

  const browR = new THREE.Mesh(new THREE.BoxGeometry(0.2 * bulk, 0.25 * bulk, 1.6 * bulk), browMat);
  browR.position.set(frontX + 0.1 * bulk, 1.45 * bulk, -2.05 * bulk);
  browR.rotation.y = -0.1;
  faceGroup.add(browR);

  // --- SPIKY POLYGONAL HAIR SYSTEM ---
  const hairGroup = new THREE.Group();
  head.add(hairGroup);

  const hairTex = materialTex ? materialTex('cloth', 'hair') : bodyTex;
  const hairMat = reg(mat(0xffffff, { rough: 0.75, metal: 0.1, map: hairTex }));
  hairMat.flatShading = true;

  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(7.22 * bulk, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.65),
    hairMat
  );
  hairCap.position.set(-0.1 * bulk, 0.30 * bulk, 0);
  hairGroup.add(hairCap);

  // Forehead Hair Root Base - A beautifully curved sphere slice that sits flush against the head sphere
  const hairRootBase = new THREE.Mesh(
    new THREE.SphereGeometry(7.24 * bulk, 16, 8, -Math.PI * 0.32, Math.PI * 0.64, Math.PI * 0.1, Math.PI * 0.32),
    hairMat
  );
  hairRootBase.position.set(-0.1 * bulk, 0.30 * bulk, 0);
  hairGroup.add(hairRootBase);

  // Dynamic anime hair spikes with proper Y-rotation (ry) to hug the forehead curve, sunk tight into the head
  const hairSpikes = [
    // --- Front Bangs (swept across the face, emerging directly from the root base) ---
    // Left front bangs (angled left)
    { r: 1.3, h: 7.5, px: 6.4, py: 3.0, pz: 2.1, rx: -0.2, ry: 0.32, rz: -2.85, sx: 0.35, sy: 1.0, sz: 1.0 },
    { r: 1.1, h: 6.8, px: 6.2, py: 2.3, pz: 3.2, rx: -0.3, ry: 0.48, rz: -2.75, sx: 0.35, sy: 1.0, sz: 0.95 },
    
    // Center front bangs (slightly angled left/right to sweep naturally)
    { r: 1.4, h: 8.5, px: 6.7, py: 3.3, pz: 0.8, rx: -0.05, ry: 0.12, rz: -2.95, sx: 0.35, sy: 1.0, sz: 1.1 },
    { r: 1.3, h: 8.8, px: 6.8, py: 3.1, pz: -0.4, rx: 0.1, ry: -0.06, rz: -2.9, sx: 0.35, sy: 1.0, sz: 1.1 },
    
    // Right front bangs (angled right)
    { r: 1.5, h: 9.8, px: 6.5, py: 2.6, pz: -1.6, rx: 0.25, ry: -0.22, rz: -2.8, sx: 0.35, sy: 1.0, sz: 1.15 },
    { r: 1.4, h: 10.0, px: 6.2, py: 1.4, pz: -2.7, rx: 0.4, ry: -0.4, rz: -2.7, sx: 0.35, sy: 1.0, sz: 1.1 },
    { r: 1.2, h: 9.0, px: 5.6, py: 0.8, pz: -3.8, rx: 0.55, ry: -0.58, rz: -2.6, sx: 0.35, sy: 1.0, sz: 1.0 },

    // --- Sideburns (framing the face, visible outside the hood sides) ---
    // Left sideburns (long elegant strands)
    { r: 1.4, h: 11.5, px: 3.2, py: 0.4, pz: 5.8, rx: -0.5, ry: 0.9, rz: -2.65, sx: 1.1, sy: 1.0, sz: 0.35 },
    { r: 1.1, h: 8.5, px: 1.0, py: 0.1, pz: 6.2, rx: -0.35, ry: 1.0, rz: -2.6, sx: 1.0, sy: 1.0, sz: 0.35 },
    
    // Right sideburns
    { r: 1.5, h: 9.5, px: 3.0, py: 1.0, pz: -5.8, rx: 0.4, ry: -0.9, rz: -2.75, sx: 1.1, sy: 1.0, sz: 0.35 },
    { r: 1.3, h: 9.0, px: 1.0, py: -0.1, pz: -6.2, rx: 0.35, ry: -1.0, rz: -2.6, sx: 1.1, sy: 1.0, sz: 0.35 },
    { r: 1.2, h: 8.5, px: 4.0, py: 1.8, pz: -4.8, rx: 0.3, ry: -0.8, rz: -2.85, sx: 1.0, sy: 1.0, sz: 0.35 }
  ];

  for (const s of hairSpikes) {
    const geom = new THREE.ConeGeometry(s.r * bulk, s.h * bulk, 6);
    const mesh = new THREE.Mesh(geom, hairMat);
    mesh.position.set(s.px * bulk, s.py * bulk, s.pz * bulk);
    mesh.rotation.set(s.rx, s.ry, s.rz);
    mesh.scale.set(s.sx, s.sy, s.sz);
    mesh.castShadow = true;
    hairGroup.add(mesh);
  }

  // --- LIMBS SETUP ---
  const armL = mkLimb(0, -ctx.shoulderX, true, robeMat, armorMat, base);
  const armR = mkLimb(0, ctx.shoulderX, true, robeMat, armorMat, base);
  const legL = mkLimb(0, -ctx.hipX, false, robeMat, armorMat, base);
  const legR = mkLimb(0, ctx.hipX, false, robeMat, armorMat, base);

  const customizeLimb = (pivot, isArm, pz, limbMat, bootMat, ringCol) => {
    while (pivot.children.length > 0) {
      pivot.remove(pivot.children[0]);
    }

    const len = 15;
    const w = isArm ? 4.5 * bulk : 5.5 * bulk;

    const upperGeom = new THREE.CylinderGeometry(w * 0.45, w * 0.45, len * 0.55, 6);
    const upperLimb = new THREE.Mesh(upperGeom, limbMat);
    upperLimb.position.y = -len * 0.275;
    upperLimb.castShadow = true;
    pivot.add(upperLimb);

    const upperRing = new THREE.Mesh(new THREE.BoxGeometry(w * 1.05, 0.8 * bulk, w * 1.05), activeGoldMat);
    upperRing.position.y = -len * 0.2;
    upperRing.castShadow = true;
    pivot.add(upperRing);

    const jointMat = reg(mat(0x5ad7ff, { emissive: 0x5ad7ff, ei: 0.9, rough: 0.2 }));
    const joint = new THREE.Mesh(new THREE.OctahedronGeometry(w * 0.45, 0), jointMat);
    joint.position.y = -len * 0.55;
    joint.castShadow = true;
    pivot.add(joint);

    const bootW = w * 1.35;
    const bootH = len * 0.45;
    const lowerArmor = new THREE.Mesh(new THREE.BoxGeometry(bootW, bootH, bootW), bootMat);
    lowerArmor.position.y = -len * 0.55 - bootH / 2;
    lowerArmor.castShadow = true;
    pivot.add(lowerArmor);

    const bootTrim = new THREE.Mesh(new THREE.BoxGeometry(bootW + 0.3, 0.6 * bulk, bootW + 0.3), activeGoldMat);
    bootTrim.position.y = -len * 0.55;
    bootTrim.castShadow = true;
    pivot.add(bootTrim);

    // Floating wrist/ankle orbital ring around gauntlets/boots instead of shield plates
    const limbOrbit = new THREE.Mesh(new THREE.TorusGeometry(bootW * 0.82, 0.3 * bulk, 6, 20), glassMat);
    limbOrbit.position.y = -len * 0.55 - bootH / 2;
    limbOrbit.rotation.x = Math.PI / 2 + 0.2;
    limbOrbit.castShadow = true;
    pivot.add(limbOrbit);

    // Star core sphere in the center of the orbital ring
    const limbStar = new THREE.Mesh(new THREE.SphereGeometry(0.85 * bulk, 8, 8), activeGoldMat);
    limbStar.position.set(0, -len * 0.55 - bootH / 2, 0);
    limbStar.castShadow = true;
    pivot.add(limbStar);

    const ringMat = reg(mat(ringCol, { emissive: ringCol, ei: 1.5 }));
    const ring = new THREE.Mesh(new THREE.BoxGeometry(bootW + 0.6, 1.0, bootW + 0.6), ringMat);
    ring.position.y = -len * 0.55 - bootH;
    pivot.add(ring);
  };

  customizeLimb(armL, true, -ctx.shoulderX, robeMat, armorMat, base);
  customizeLimb(armR, true, ctx.shoulderX, robeMat, armorMat, base);
  customizeLimb(legL, false, -ctx.hipX, robeMat, armorMat, base);
  customizeLimb(legR, false, ctx.hipX, robeMat, armorMat, base);

  // --- FLOATING STAR WINGS (High-tech energy funnels splayed left/right instead of cloth cape) ---
  const cape = new THREE.Group();
  cape.position.set(-torsoD * 0.55, shoulderY - 2, 0);

  // Left Wing Group
  const wingL = new THREE.Group();
  wingL.position.set(0, 0, torsoW * 0.35);
  wingL.rotation.set(0.1, 0.25, -0.15);
  cape.add(wingL);

  // Gold wing spar
  const sparL = new THREE.Mesh(new THREE.CylinderGeometry(0.35 * bulk, 0.15 * bulk, 14 * bulk, 6), activeGoldMat);
  sparL.position.set(-2 * bulk, 2 * bulk, 3 * bulk);
  sparL.rotation.z = -Math.PI / 4;
  sparL.castShadow = true;
  wingL.add(sparL);

  // Floating crystal blades along the spar
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.5 * bulk, (8 - i * 1.5) * bulk, (2.2 - i * 0.4) * bulk), glassMat);
    blade.position.set((-3 - i * 2.5) * bulk, (4 - i * 1.5) * bulk, (3 + i * 2) * bulk);
    blade.rotation.set(0.1, 0.15, -0.6);
    blade.castShadow = true;
    wingL.add(blade);
  }

  // Right Wing Group
  const wingR = new THREE.Group();
  wingR.position.set(0, 0, -torsoW * 0.35);
  wingR.rotation.set(-0.1, -0.25, -0.15);
  cape.add(wingR);

  // Gold wing spar
  const sparR = new THREE.Mesh(new THREE.CylinderGeometry(0.35 * bulk, 0.15 * bulk, 14 * bulk, 6), activeGoldMat);
  sparR.position.set(-2 * bulk, 2 * bulk, -3 * bulk);
  sparR.rotation.z = -Math.PI / 4;
  sparR.castShadow = true;
  wingR.add(sparR);

  // Floating crystal blades along the spar
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.5 * bulk, (8 - i * 1.5) * bulk, (2.2 - i * 0.4) * bulk), glassMat);
    blade.position.set((-3 - i * 2.5) * bulk, (4 - i * 1.5) * bulk, (-3 - i * 2) * bulk);
    blade.rotation.set(-0.1, -0.15, -0.6);
    blade.castShadow = true;
    wingR.add(blade);
  }

  const capeTrim = new THREE.Group();
  capeTrim.position.copy(cape.position);

  // Left Thruster Trail
  const trailL = new THREE.Group();
  trailL.position.set(0, 0, torsoW * 0.35);
  trailL.rotation.copy(wingL.rotation);
  capeTrim.add(trailL);

  const innerMat = reg(mat(0x5ad7ff, { transparent: true, opacity: 0.4, emissive: 0x00d2ff, ei: 2.0 }));
  const beamL = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * bulk, 0.8 * bulk, 18 * bulk, 4), innerMat);
  beamL.position.set(-8 * bulk, -2 * bulk, 6 * bulk);
  beamL.rotation.z = -Math.PI / 3;
  beamL.castShadow = true;
  trailL.add(beamL);

  // Right Thruster Trail
  const trailR = new THREE.Group();
  trailR.position.set(0, 0, -torsoW * 0.35);
  trailR.rotation.copy(wingR.rotation);
  capeTrim.add(trailR);

  const beamR = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * bulk, 0.8 * bulk, 18 * bulk, 4), innerMat);
  beamR.position.set(-8 * bulk, -2 * bulk, -6 * bulk);
  beamR.rotation.z = -Math.PI / 3;
  beamR.castShadow = true;
  trailR.add(beamR);

  return { torso, head, armL, armR, legL, legR, starOrbitShards, cape, capeTrim };
}

export const buildWeapon = buildStarOrbitWeapon;
