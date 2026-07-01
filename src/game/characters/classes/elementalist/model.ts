// @ts-nocheck
import * as THREE from 'three';
import { buildElementalistWeapon } from './weapon.ts';

export const modelConfig = { bulk: 1.92, weapon: 'elements', robe: true, skinKind: 'cloth', headgear: 'band' };

export function buildModel(ctx) {
  const {
    base, bulk, reg, mat, shade,
    torsoW, torsoD, torsoH,
    shoulderX, hipX, frontX,
    defaultHeadMat, bodyTex,
    face, faceGroup, helmAddons, mkLimb, addAccent
  } = ctx;

  // 1. Core Materials Definition
  const ivoryMat = reg(mat(0xfffaf0, { rough: 0.65, metal: 0.1, map: bodyTex }));
  const warmIvoryMat = reg(mat(0xfbf3e3, { rough: 0.62, metal: 0.12, map: bodyTex }));
  const goldMat = reg(mat(0xf7c85c, { rough: 0.15, metal: 0.85, emissive: 0x5e3c0b, ei: 0.35 }));
  const darkMat = reg(mat(0x1b1a1c, { rough: 0.72, metal: 0.18 }));
  
  // Element Magic Materials (Sleek Glows)
  const fireMat = reg(mat(0xff5511, { rough: 0.2, metal: 0.3, emissive: 0xff3300, ei: 1.25, transparent: true, opacity: 0.95 }));
  const iceMat = reg(mat(0xa6eaff, { rough: 0.15, metal: 0.25, emissive: 0x4cc2f0, ei: 1.05, transparent: true, opacity: 0.88 }));
  const stormMat = reg(mat(0xac66ff, { rough: 0.18, metal: 0.22, emissive: 0x7711ff, ei: 1.45, transparent: true, opacity: 0.92 }));
  const glassMat = reg(mat(0xd5efff, { rough: 0.05, metal: 0.92, transparent: true, opacity: 0.48 }));
  
  const hairMat = reg(mat(0xfffaf0, { rough: 0.78, metal: 0.02, map: bodyTex }));

  const torso = new THREE.Group();

  // 2. Multi-Segmented Torso Design
  // A. Upper Torso (Chest Armor Plate - Diamond Prism)
  const upperTorso = new THREE.Mesh(new THREE.CylinderGeometry(torsoW * 0.34, torsoW * 0.28, torsoH * 0.44, 4), warmIvoryMat);
  upperTorso.position.y = torsoH * 0.2;
  upperTorso.rotation.y = Math.PI / 4;
  upperTorso.castShadow = true;
  torso.add(upperTorso);

  // Upper Torso Gold Trim
  const upperTrim = new THREE.Mesh(new THREE.TorusGeometry(torsoW * 0.36, 0.6, 6, 4), goldMat);
  upperTrim.position.y = torsoH * 0.38;
  upperTrim.rotation.set(Math.PI / 2, 0, Math.PI / 4);
  torso.add(upperTrim);

  // B. Middle Torso (Slender Waist)
  const waistCore = new THREE.Mesh(new THREE.CylinderGeometry(torsoW * 0.18, torsoW * 0.2, torsoH * 0.22, 12), darkMat);
  waistCore.position.y = -torsoH * 0.1;
  waistCore.castShadow = true;
  torso.add(waistCore);

  // C. Lower Torso (Pelvis/Hip Base - Diamond Prism)
  const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(torsoW * 0.24, torsoW * 0.38, torsoH * 0.34, 4), ivoryMat);
  pelvis.position.y = -torsoH * 0.34;
  pelvis.rotation.y = Math.PI / 4;
  pelvis.castShadow = true;
  torso.add(pelvis);

  // D. Torso Ornaments (Collar, Waist Belt, Gem)
  const collar = new THREE.Mesh(new THREE.TorusGeometry(torsoW * 0.29, 0.75, 6, 20), goldMat);
  collar.position.set(0, torsoH * 0.46, -torsoD * 0.05);
  collar.rotation.x = Math.PI / 2 + 0.18;
  torso.add(collar);

  const waistBelt = new THREE.Mesh(new THREE.TorusGeometry(torsoW * 0.36, 0.95, 7, 24), goldMat);
  waistBelt.position.set(0, -torsoH * 0.08, 0);
  waistBelt.rotation.x = Math.PI / 2;
  torso.add(waistBelt);

  const waistGem = new THREE.Mesh(new THREE.OctahedronGeometry(2.35 * bulk, 0), stormMat);
  waistGem.position.set(torsoD * 0.38, -torsoH * 0.08, 0);
  torso.add(waistGem);

  // E. Double-Sided Shoulder Guards (Pauldrons) for torso-arm integration
  for (const sz of [-1, 1]) {
    const pauldron = new THREE.Group();
    pauldron.position.set(0, torsoH * 0.35, sz * (shoulderX * 0.82 - 0.2));

    const armorPlate = new THREE.Mesh(new THREE.CylinderGeometry(torsoW * 0.16, torsoW * 0.28, torsoH * 0.28, 4), warmIvoryMat);
    armorPlate.rotation.set(sz * 0.28, 0, sz * 0.18);
    armorPlate.scale.set(0.85, 1, 1.25);
    armorPlate.castShadow = true;
    pauldron.add(armorPlate);

    const goldRim = new THREE.Mesh(new THREE.CylinderGeometry(torsoW * 0.18, torsoW * 0.3, 0.6, 4), goldMat);
    goldRim.position.y = -torsoH * 0.12;
    goldRim.rotation.copy(armorPlate.rotation);
    goldRim.scale.copy(armorPlate.scale);
    pauldron.add(goldRim);

    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(1.5 * bulk, 0), stormMat);
    gem.position.set(torsoD * 0.18, 0, sz * 0.1);
    pauldron.add(gem);

    torso.add(pauldron);
  }

  // F. Hanging Robe Panels & Hip/Thigh Guards (Tassets representing Fire, Ice, Storm)
  // Front Panel - Storm (Electric Blue-Purple detailing)
  const frontTasset = new THREE.Mesh(new THREE.ConeGeometry(torsoW * 0.16, torsoH * 0.62, 4), stormMat);
  frontTasset.position.set(torsoD * 0.35, -torsoH * 0.45, 0);
  frontTasset.rotation.set(0.12, 0, Math.PI);
  frontTasset.scale.set(0.92, 1, 0.32);
  frontTasset.castShadow = true;
  torso.add(frontTasset);

  // Left Hip/Thigh Guard - Fire (Deep Orange-Red)
  const leftTasset = new THREE.Mesh(new THREE.ConeGeometry(torsoW * 0.18, torsoH * 0.58, 4), fireMat);
  leftTasset.position.set(0, -torsoH * 0.32, -hipX * 0.72);
  leftTasset.rotation.set(-0.25, 0.4, Math.PI + 0.18);
  leftTasset.scale.set(0.9, 1, 0.32);
  leftTasset.castShadow = true;
  torso.add(leftTasset);

  // Right Hip/Thigh Guard - Ice (Frost Cyan)
  const rightTasset = new THREE.Mesh(new THREE.ConeGeometry(torsoW * 0.18, torsoH * 0.58, 4), iceMat);
  rightTasset.position.set(0, -torsoH * 0.32, hipX * 0.72);
  rightTasset.rotation.set(0.25, -0.4, Math.PI - 0.18);
  rightTasset.scale.set(0.9, 1, 0.32);
  rightTasset.castShadow = true;
  torso.add(rightTasset);

  // Back Drape Panel (White Gold Satin)
  const backDrape = new THREE.Mesh(new THREE.BoxGeometry(2.4, torsoH * 0.74, torsoW * 0.78), ivoryMat);
  backDrape.position.set(-torsoD * 0.44, -torsoH * 0.4, 0);
  backDrape.rotation.x = 0.05;
  backDrape.castShadow = true;
  torso.add(backDrape);

  // 3. Head & Hairstyle Design
  const head = new THREE.Mesh(new THREE.SphereGeometry(7.5 * bulk, 16, 12), defaultHeadMat);

  // Forehead Hair Base (Seamless sphere slice)
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(7.9 * bulk, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), hairMat);
  hairCap.position.set(-0.8 * bulk, 1.4 * bulk, 0);
  helmAddons.add(hairCap);

  // Twin Side Locks (Symmetric front hair strands)
  for (const sz of [-1, 1]) {
    const lock = new THREE.Mesh(new THREE.ConeGeometry(1.6 * bulk, 18 * bulk, 6), hairMat);
    lock.position.set(2.8 * bulk, -4.5 * bulk, sz * 4.6 * bulk);
    lock.rotation.set(sz * 0.22, 0, Math.PI - sz * 0.06);
    lock.scale.set(1.2, 1, 0.48);
    lock.castShadow = true;
    helmAddons.add(lock);
  }

  // Back Hair Knot (Large circular sigil braid)
  const hairKnotGroup = new THREE.Group();
  hairKnotGroup.position.set(-7.2 * bulk, 1.0 * bulk, 0);
  
  const hairKnotBase = new THREE.Mesh(new THREE.SphereGeometry(2.8 * bulk, 12, 10), hairMat);
  hairKnotGroup.add(hairKnotBase);

  const hairKnotRing = new THREE.Mesh(new THREE.TorusGeometry(3.2 * bulk, 0.45 * bulk, 6, 20), goldMat);
  hairKnotRing.rotation.y = Math.PI / 2;
  hairKnotGroup.add(hairKnotRing);

  // 3 Prominent Pony Tails (Center, Left, Right) for maximum volume and visibility
  // Cone tip is inverted to point down (rotation.z = Math.PI) to resolve "inverted/broom" visual bug.
  // Base radii increased and Z-scale (horizontal width) corrected to make hair volume extremely prominent from the back.
  // A. Center Main Tail (Thick & flowing back-downwards)
  const centerTail = new THREE.Mesh(new THREE.ConeGeometry(4.2 * bulk, 21.0 * bulk, 8), hairMat);
  centerTail.position.set(-1.6 * bulk, -9.0 * bulk, 0);
  centerTail.rotation.set(0, 0, Math.PI - 0.28); // Inverted & tilted back
  centerTail.scale.set(0.46, 1.0, 1.55); // Flat on X (thickness), expanded on Z (width)
  centerTail.castShadow = true;
  hairKnotGroup.add(centerTail);

  // B. Left & Right Side Tails (Slightly shorter, fanning outwards)
  for (const sz of [-1, 1]) {
    const sideTail = new THREE.Mesh(new THREE.ConeGeometry(3.2 * bulk, 16.5 * bulk, 8), hairMat);
    sideTail.position.set(-0.9 * bulk, -7.0 * bulk, sz * 1.8 * bulk);
    sideTail.rotation.set(sz * 0.32, 0, Math.PI - 0.22); // Inverted, tilted back & out
    sideTail.scale.set(0.4, 1.0, 1.45); // Flat on X (thickness), expanded on Z (width)
    sideTail.castShadow = true;
    hairKnotGroup.add(sideTail);
  }
  
  helmAddons.add(hairKnotGroup);

  // Floating Ribbons hanging from the hair knot
  for (const sz of [-1, 1]) {
    const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.8 * bulk, 22.0 * bulk, 2.5 * bulk), stormMat);
    ribbon.position.set(-8.5 * bulk, -10.0 * bulk, sz * 4.5 * bulk);
    ribbon.rotation.set(0.12 * sz, 0.2 * sz, 0.08 * sz);
    addAccent(ribbon);
  }

  // 4. Back Accents (Trinity Halo & Mechanical Wings with Wave-Like Streamers)
  // A. Trinity Halo (三元法輪)
  const haloGroup = new THREE.Group();
  haloGroup.position.set(-4.5 * bulk, 10.8 * bulk, 0);
  haloGroup.rotation.y = Math.PI / 2;

  const haloRing = new THREE.Mesh(new THREE.TorusGeometry(11.2 * bulk, 0.72 * bulk, 8, 32), goldMat);
  haloGroup.add(haloRing);

  // 3 Elemental Core Gems on Halo (Fire top, Ice left, Storm right)
  const gemsData = [
    { mat: fireMat, angle: Math.PI / 2 },
    { mat: iceMat, angle: Math.PI / 2 + (Math.PI * 2 / 3) },
    { mat: stormMat, angle: Math.PI / 2 - (Math.PI * 2 / 3) },
  ];
  gemsData.forEach((gemInfo) => {
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(2.1 * bulk, 0), gemInfo.mat);
    gem.position.set(Math.cos(gemInfo.angle) * 11.2 * bulk, Math.sin(gemInfo.angle) * 11.2 * bulk, 0);
    haloGroup.add(gem);
  });

  // Sun Rays shooting outwards
  for (let i = 0; i < 9; i++) {
    const a = (i / 8 - 0.5) * Math.PI;
    const ray = new THREE.Mesh(new THREE.ConeGeometry(0.65 * bulk, 6.2 * bulk, 6), goldMat);
    ray.position.set(Math.cos(a) * 12.5 * bulk, Math.sin(a) * 12.5 * bulk, 0);
    ray.rotation.z = a - Math.PI / 2;
    haloGroup.add(ray);
  }
  
  helmAddons.add(haloGroup);

  // B. Back Wing Spars & Floating Crystal Blades
  const wingsGroup = new THREE.Group();
  wingsGroup.position.set(-torsoD * 0.45, torsoH * 0.15, 0);

  for (const sz of [-1, 1]) {
    const wingSide = new THREE.Group();
    
    // Main wing metal spar
    const spar = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.5, 14, 6), goldMat);
    spar.position.set(-2, 4, sz * 5);
    spar.rotation.set(0.4 * sz, 0.2 * sz, -Math.PI / 4);
    wingSide.add(spar);

    // Floating crystal blades attached along the spar
    for (let j = 0; j < 3; j++) {
      const bladeMat = j === 0 ? fireMat : (j === 1 ? stormMat : iceMat);
      const blade = new THREE.Mesh(new THREE.OctahedronGeometry(2.5 - j * 0.4, 0), bladeMat);
      blade.scale.set(0.3, 2.2, 1.0);
      blade.position.set(-4 - j * 1.5, 5 + j * 1.8, sz * (6.5 + j * 3.2));
      blade.rotation.set(0.3 * sz, 0, -Math.PI / 3);
      wingSide.add(blade);
    }
    wingsGroup.add(wingSide);
  }
  torso.add(wingsGroup);

  // C. Dynamic Sway Trails (Wave-like ornate streamers replacing flat boards)
  const cape = new THREE.Group();
  const capeTrim = new THREE.Group();

  const trailMats = [fireMat, stormMat, iceMat];

  // Golden Back Clasp binding the streamers
  const backClasp = new THREE.Mesh(new THREE.TorusGeometry(3.2 * bulk, 0.55 * bulk, 6, 16, Math.PI), goldMat);
  backClasp.position.set(-torsoD * 0.55, -torsoH * 0.1, 0);
  backClasp.rotation.set(0, Math.PI / 2, 0);
  cape.add(backClasp);

  for (let i = 0; i < 3; i++) {
    const offset = i - 1;
    const mat = trailMats[i];

    // Create a group for multi-segment wave rotations
    const streamer = new THREE.Group();
    streamer.position.set(-torsoD * 0.65, -torsoH * 0.15, offset * torsoW * 0.28);

    // Segment 1 (Upper section - curving back-upwards)
    const seg1 = new THREE.Mesh(new THREE.BoxGeometry(0.6 * bulk, 8 * bulk, 2.4 * bulk), mat);
    seg1.position.set(-2.0 * bulk, -3.0 * bulk, offset * 0.5 * bulk);
    seg1.rotation.set(offset * 0.08, 0, 0.3);
    seg1.castShadow = true;
    streamer.add(seg1);

    // Embossed gold band on Segment 1
    const band1 = new THREE.Mesh(new THREE.BoxGeometry(0.7 * bulk, 0.8 * bulk, 2.6 * bulk), goldMat);
    band1.position.copy(seg1.position);
    band1.rotation.copy(seg1.rotation);
    streamer.add(band1);

    // Segment 2 (Middle section - bending back-downwards)
    const seg2 = new THREE.Mesh(new THREE.BoxGeometry(0.5 * bulk, 10 * bulk, 1.8 * bulk), mat);
    seg2.position.set(-4.5 * bulk, -10.5 * bulk, offset * 1.2 * bulk);
    seg2.rotation.set(offset * 0.15, 0, 0.12);
    seg2.castShadow = true;
    streamer.add(seg2);

    // Segment 3 (Lower section - trailing outwards)
    const seg3 = new THREE.Mesh(new THREE.BoxGeometry(0.4 * bulk, 12 * bulk, 1.3 * bulk), mat);
    seg3.position.set(-6.2 * bulk, -20.0 * bulk, offset * 2.2 * bulk);
    seg3.rotation.set(offset * 0.22, 0, -0.05);
    seg3.castShadow = true;
    streamer.add(seg3);

    // Gold tip hanger & final floating gem at the bottom
    const tipHanger = new THREE.Mesh(new THREE.OctahedronGeometry(1.0 * bulk, 0), goldMat);
    tipHanger.position.set(-6.8 * bulk, -26.0 * bulk, offset * 2.5 * bulk);
    streamer.add(tipHanger);

    const tipCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.75 * bulk, 0), mat);
    tipCrystal.position.set(-6.8 * bulk, -27.2 * bulk, offset * 2.5 * bulk);
    streamer.add(tipCrystal);

    cape.add(streamer);

    // Dynamic magical spark guides
    const spark = new THREE.Mesh(new THREE.OctahedronGeometry(1.5 * bulk, 0), glassMat);
    spark.position.set(-torsoD * 1.5, -torsoH * 1.6, offset * torsoW * 0.42);
    capeTrim.add(spark);
  }

  // Earring ornaments
  for (const sz of [-1, 1]) {
    const earring = new THREE.Mesh(new THREE.TorusGeometry(1.8 * bulk, 0.22 * bulk, 6, 12), goldMat);
    earring.position.set(1.6 * bulk, -1.5 * bulk, sz * 6.8 * bulk);
    earring.rotation.x = Math.PI / 2;
    helmAddons.add(earring);
  }

  // 5. Eyes Custom Glow
  const eyeMat = reg(mat(0xa6eaff, { emissive: 0xa6eaff, ei: 1.8 }));
  face.eyeL = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.5, 2.0), eyeMat); face.eyeL.position.set(frontX - 0.4, 1.2, -2.1 * bulk);
  face.eyeR = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.5, 2.0), eyeMat); face.eyeR.position.set(frontX - 0.4, 1.2, 2.1 * bulk);
  faceGroup.add(face.eyeL); faceGroup.add(face.eyeR);

  // 6. Custom Articulated Limbs with Robust Proportions & Joint Integration
  // Pull arms closer to the body by scaling shoulderX by 0.82
  const armL = mkLimb(0, -shoulderX * 0.82, true, ivoryMat, goldMat, base, 3.9 * bulk, 15.5);
  const armR = mkLimb(0, shoulderX * 0.82, true, ivoryMat, goldMat, base, 3.9 * bulk, 15.5);
  const legL = mkLimb(0, -hipX, false, warmIvoryMat, goldMat, shade(base, 0.12), 4.7 * bulk, 16.5);
  const legR = mkLimb(0, hipX, false, warmIvoryMat, goldMat, shade(base, 0.12), 4.7 * bulk, 16.5);

  const rebuildLimb = (limb, isArm, primaryMat, trimMat, elementJointMat) => {
    while (limb.children.length > 0) {
      limb.remove(limb.children[0]);
    }

    // Increased width base for thicker proportions (thick arms: 4.75, legs: 4.85)
    const w = isArm ? 4.75 * bulk : 4.85 * bulk;

    // Joint Connector Sphere (Visual anchor inside Shoulder/Hip armor)
    const socketJoint = new THREE.Mesh(new THREE.SphereGeometry(w * 0.42, 8, 8), trimMat);
    socketJoint.position.y = 0;
    limb.add(socketJoint);

    // A. Upper Limb Segment
    const upperLimb = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.38, w * 0.32, 6.5, 6), primaryMat);
    upperLimb.position.y = -3.25;
    upperLimb.castShadow = true;
    limb.add(upperLimb);

    // Gold highlight ring around upper limb
    const upperRing = new THREE.Mesh(new THREE.TorusGeometry(w * 0.39, 0.38, 5, 8), trimMat);
    upperRing.position.y = -2.8;
    upperRing.rotation.x = Math.PI / 2;
    limb.add(upperRing);

    // B. Elbow/Knee Joint (Large octahedron crystal)
    const joint = new THREE.Mesh(new THREE.OctahedronGeometry(w * 0.38, 0), elementJointMat);
    joint.position.y = -6.5;
    limb.add(joint);

    // C. Lower Limb Segment (Gauntlets/Boots - thick armored blocks)
    const lowerGroup = new THREE.Group();
    lowerGroup.position.y = -6.5;

    const lowerLimb = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.32, w * 0.52, 7.2, 6), primaryMat);
    lowerLimb.position.y = -3.6;
    lowerLimb.castShadow = true;
    lowerGroup.add(lowerLimb);

    // Armored Gold Trim Band
    const lowerTrim = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.54, w * 0.54, 1.2, 6), trimMat);
    lowerTrim.position.y = -0.6;
    lowerGroup.add(lowerTrim);

    // D. Outer Translucent Shield Plates
    const shieldPlate = new THREE.Mesh(new THREE.BoxGeometry(0.75, 5.2, w * 0.48), glassMat);
    shieldPlate.position.set(isArm ? w * 0.45 : w * 0.52, -3.6, 0);
    shieldPlate.rotation.z = isArm ? 0.08 : -0.08;
    lowerGroup.add(shieldPlate);

    limb.add(lowerGroup);
  };

  rebuildLimb(armL, true, ivoryMat, goldMat, stormMat);
  rebuildLimb(armR, true, ivoryMat, goldMat, stormMat);
  rebuildLimb(legL, false, warmIvoryMat, goldMat, iceMat);
  rebuildLimb(legR, false, warmIvoryMat, goldMat, iceMat);

  return { torso, head, armL, armR, legL, legR, cape, capeTrim };
}

export const buildWeapon = buildElementalistWeapon;
