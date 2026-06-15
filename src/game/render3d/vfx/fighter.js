// 格鬥家：拳腳連段、爆發。連環拳 / 上勾拳擊飛 / 格擋反擊。
import * as THREE from 'three';
import { registerVfx } from './registry.js';
import { ring, pillar, burst, cone, sphereFlash, addShake, addFlash, ultimateBurst } from './lib.js';

// 大絕招 — 真·昇龍霸：金色衝天氣旋
// 大絕招 — 真·昇龍霸：神意·八卦真龍破
registerVfx('fighter_ultimate', {
  onCast(ctx, f, c) {
    const THREE = ctx.THREE;
    const R = f.range || 160;
    const dirX = Math.cos(f.facing);
    const dirZ = Math.sin(f.facing);
    const hitPointX = Math.max(-600, Math.min(600, c.x + dirX * R));
    const hitPointZ = Math.max(-400, Math.min(400, c.z + dirZ * R));
    const hitPoint = { x: hitPointX, y: c.y, z: hitPointZ };

    // 1. 金色八卦陣圖 (在腳下)
    const baguaGroup = new THREE.Group();
    baguaGroup.position.set(c.x, 1.2, c.z);
    
    const arrayGeos = [];
    const arrayMats = [];

    const baseGeo = new THREE.CircleGeometry(R * 0.8, 8); // 八邊形底盤
    const baseMat = new THREE.MeshBasicMaterial({
      color: 0xffe27a,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.rotation.x = -Math.PI / 2;
    baguaGroup.add(baseMesh);
    arrayGeos.push(baseGeo);
    arrayMats.push(baseMat);

    const ringGeo = new THREE.RingGeometry(R * 0.76, R * 0.8, 8); // 八邊形外框
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffd700,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    baguaGroup.add(ringMesh);
    arrayGeos.push(ringGeo);
    arrayMats.push(ringMat);

    // 在 8 個角放卦符
    const trigramGeo = new THREE.BoxGeometry(R * 0.15, 0.4, R * 0.04);
    const trigramMat = new THREE.MeshBasicMaterial({
      color: 0xffd700,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });
    arrayGeos.push(trigramGeo);
    arrayMats.push(trigramMat);

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const trigram = new THREE.Mesh(trigramGeo, trigramMat);
      trigram.position.set(Math.cos(angle) * R * 0.65, 0.2, Math.sin(angle) * R * 0.65);
      trigram.rotation.y = -angle;
      baguaGroup.add(trigram);
    }

    baguaGroup.userData.geo = { dispose: () => arrayGeos.forEach(geo => geo.dispose()) };
    baguaGroup.userData.mat = { dispose: () => arrayMats.forEach(mat => mat.dispose()) };

    ctx.addTransient(baguaGroup, 0.75, (mesh, t) => {
      mesh.rotation.y = t * Math.PI * 1.5;
      const opacity = (1 - t) * 0.95;
      baseMat.opacity = 0.28 * opacity;
      ringMat.opacity = 0.8 * opacity;
      trigramMat.opacity = 0.9 * opacity;
    });

    // 2. 「金色神龍」盤旋衝天 Mesh (在擊中點 hitPoint 產生)
    const dragonGroup = new THREE.Group();
    dragonGroup.position.set(hitPoint.x, hitPoint.y, hitPoint.z);

    const dragonGeos = [];
    const dragonMats = [];

    const dragonRingGeo = new THREE.TorusGeometry(1, 0.25, 8, 24);
    const dragonMat = new THREE.MeshBasicMaterial({
      color: 0xffd700,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending
    });
    dragonGeos.push(dragonRingGeo);
    dragonMats.push(dragonMat);

    const dragonRings = [];
    for (let k = 0; k < 6; k++) {
      const dm = new THREE.Mesh(dragonRingGeo, dragonMat);
      dm.rotation.x = -Math.PI / 2;
      dragonGroup.add(dm);
      dragonRings.push(dm);
    }

    // 龍頭
    const headGeo = new THREE.ConeGeometry(8, 22, 5);
    const eyeGeo = new THREE.SphereGeometry(2, 8, 8);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xff8800, emissiveIntensity: 2.2 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    dragonGeos.push(headGeo, eyeGeo);
    dragonMats.push(headMat, eyeMat);

    const headMesh = new THREE.Mesh(headGeo, headMat);
    headMesh.rotation.x = Math.PI / 2;
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-3, 3, 5);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(3, 3, 5);
    
    const headGroup = new THREE.Group();
    headGroup.add(headMesh, leftEye, rightEye);
    dragonGroup.add(headGroup);

    dragonGroup.userData.geo = { dispose: () => dragonGeos.forEach(geo => geo.dispose()) };
    dragonGroup.userData.mat = { dispose: () => dragonMats.forEach(mat => mat.dispose()) };

    ctx.addTransient(dragonGroup, 0.85, (mesh, t) => {
      dragonRings.forEach((rm, idx) => {
        const segmentT = Math.max(0, t - idx * 0.08);
        const angle = segmentT * Math.PI * 4;
        const radius = Math.max(10, 24 * (1 - segmentT * 0.4));
        rm.position.set(Math.cos(angle) * radius, segmentT * 260, Math.sin(angle) * radius);
        rm.scale.setScalar(radius * 0.08);
        rm.rotation.z += 0.08;
      });

      const headT = t;
      const headAngle = headT * Math.PI * 4;
      const headRadius = Math.max(10, 24 * (1 - headT * 0.4));
      headGroup.position.set(Math.cos(headAngle) * headRadius, headT * 260 + 12, Math.sin(headAngle) * headRadius);
      headGroup.rotation.y = -headAngle + Math.PI / 2;
      headGroup.scale.setScalar(1.2 * (1 - headT * 0.3));

      dragonMat.opacity = Math.max(0, (1 - t) * 0.95);
      headMat.opacity = Math.max(0, (1 - t) * 0.95);
    });

    // 3. 擊中點的金色巨大拳印
    ctx.sceneMgr.addShake(22);
    ctx.sceneMgr.addFlash(0.38, '#ffe27a');
    
    ring(ctx, hitPoint, { color: '#ffe27a', from: 10, to: R * 1.4, life: 0.48, y: 4, ease: true });
    sphereFlash(ctx, hitPoint, { color: '#ffffff', from: 8, to: R * 0.6, life: 0.28, alpha: 0.95 });

    const fistGroup = new THREE.Group();
    fistGroup.position.set(hitPoint.x, 8, hitPoint.z);
    
    const fistGeos = [];
    const fistMats = [];

    const palmGeo = new THREE.BoxGeometry(R * 0.3, R * 0.06, R * 0.3);
    const palmMat = new THREE.MeshBasicMaterial({
      color: 0xffd700,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending
    });
    const palm = new THREE.Mesh(palmGeo, palmMat);
    fistGroup.add(palm);
    fistGeos.push(palmGeo);
    fistMats.push(palmMat);

    const fingerGeo = new THREE.BoxGeometry(R * 0.06, R * 0.06, R * 0.16);
    fistGeos.push(fingerGeo);
    
    for (let i = 0; i < 4; i++) {
      const finger = new THREE.Mesh(fingerGeo, palmMat);
      finger.position.set(-R * 0.12 + i * R * 0.08, 0, R * 0.22);
      fistGroup.add(finger);
    }

    fistGroup.userData.geo = { dispose: () => fistGeos.forEach(geo => geo.dispose()) };
    fistGroup.userData.mat = { dispose: () => fistMats.forEach(mat => mat.dispose()) };

    ctx.addTransient(fistGroup, 0.6, (mesh, t) => {
      mesh.position.y = 8 + t * 240;
      mesh.scale.setScalar(1 + t * 0.6);
      palmMat.opacity = (1 - t) * 0.88;
    });

    for (let i = 0; i < 50; i++) {
      const a = Math.random() * Math.PI * 2, spd = 240 + Math.random() * 240;
      ctx.particles.spawn({
        x: hitPoint.x, y: 5, z: hitPoint.z,
        vx: Math.cos(a) * spd, vy: 180 + Math.random() * 220, vz: Math.sin(a) * spd,
        gravity: 240, drag: 1.1, life: 0.65 + Math.random() * 0.45,
        size: 4 + Math.random() * 4.5, color: '#ffe27a', fade: true
      });
    }
  },
});

registerVfx('fighter_combo', {
  onCast(ctx, f, c) {
    const THREE = ctx.THREE;
    const dx = Math.cos(f.facing);
    const dy = Math.sin(f.facing);
    const R = f.range || 95;

    // Helper to build a fist
    const createFist = (colorHex) => {
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({
        color: colorHex,
        emissive: colorHex,
        emissiveIntensity: 1.8,
        transparent: true,
        opacity: 0.95
      });
      const palmGeo = new THREE.BoxGeometry(6, 5, 6);
      const knuckleGeo = new THREE.BoxGeometry(2, 4.5, 5);
      const palm = new THREE.Mesh(palmGeo, mat);
      const knuckle = new THREE.Mesh(knuckleGeo, mat);
      knuckle.position.set(3.5, 0, 0);
      g.add(palm, knuckle);

      g.userData.geo = { dispose: () => { palmGeo.dispose(); knuckleGeo.dispose(); } };
      g.userData.mat = mat;
      return g;
    };

    // Spawn 3 rapid punches with staggered delays
    const numPunches = 3;
    const life = 0.35;
    
    for (let i = 0; i < numPunches; i++) {
      const delay = i * 0.08;
      const fist = createFist(0xffd700);
      fist.visible = false;
      
      const sideOffset = (i === 1 ? -6 : (i === 2 ? 6 : 0));
      const perpX = -dy * sideOffset;
      const perpZ = dx * sideOffset;

      ctx.addTransient(fist, life, (mesh, t) => {
        const elapsed = t * life;
        if (elapsed < delay) {
          mesh.visible = false;
        } else {
          mesh.visible = true;
          const localT = (elapsed - delay) / (life - delay);
          const currentDist = localT * R;
          mesh.position.set(
            c.x + dx * currentDist + perpX,
            c.y + 12 + Math.sin(localT * Math.PI) * 5,
            c.z + dy * currentDist + perpZ
          );
          mesh.rotation.y = -f.facing;
          mesh.scale.setScalar(0.75 + localT * 0.5);
          mesh.userData.mat.opacity = 0.95 * (1 - localT);
        }
      });
    }

    // Standard splash
    sphereFlash(ctx, c, { color: '#f7dc6f', from: 4, to: 28, life: 0.18, alpha: 0.95 });
    ring(ctx, c, { color: '#ffe27a', from: 2, to: 24, life: 0.2, y: 3 });
  }
});

registerVfx('fighter_uppercut', {
  onCast(ctx, f, c) {
    const THREE = ctx.THREE;

    // Golden heavy fist mesh
    const fistGroup = new THREE.Group();
    fistGroup.position.set(c.x, c.y, c.z);
    fistGroup.rotation.y = -f.facing;

    const palmGeo = new THREE.BoxGeometry(10, 8, 10);
    const knuckleGeo = new THREE.BoxGeometry(3.5, 7, 8.5);
    const palmMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xff9900,
      emissiveIntensity: 2.2,
      transparent: true,
      opacity: 0.95
    });

    const palm = new THREE.Mesh(palmGeo, palmMat);
    const knuckle = new THREE.Mesh(knuckleGeo, palmMat);
    knuckle.position.set(5.5, 0, 0);
    fistGroup.add(palm, knuckle);

    // Point the fist straight UP locally!
    fistGroup.rotation.z = Math.PI / 2;

    fistGroup.userData.geo = { dispose: () => { palmGeo.dispose(); knuckleGeo.dispose(); } };
    fistGroup.userData.mat = palmMat;

    ctx.addTransient(fistGroup, 0.45, (mesh, t) => {
      // Thrust upwards
      mesh.position.y = c.y + t * 58;
      mesh.rotation.x = t * Math.PI * 3; // Spin around upward axis
      
      const scale = 2.0 * Math.sin(t * Math.PI * 0.5);
      mesh.scale.set(scale, scale, scale);
      palmMat.opacity = 0.95 * (1 - t);
    });

    // High upward light pillar and rings
    pillar(ctx, c, { color: '#f9e79f', h: 170, r: 24, taper: 0.35, life: 0.5, alpha: 0.75, grow: 0.4 });
    sphereFlash(ctx, c, { color: '#fff4c2', from: 6, to: 55, life: 0.2, alpha: 0.9 });
    ring(ctx, c, { color: '#f1c40f', from: 6, to: 95, life: 0.36, y: 3, ease: true });

    // Rising particles
    for (let i = 0; i < 34; i++) {
      const a = Math.random() * Math.PI * 2, rr = Math.random() * 26;
      ctx.particles.spawn({
        x: c.x + Math.cos(a) * rr, y: 2, z: c.z + Math.sin(a) * rr,
        vx: Math.cos(a) * 55, vy: 300 + Math.random() * 250, vz: Math.sin(a) * 55,
        gravity: 220, drag: 1.15, life: 0.65, size: 4.5, color: '#f9e79f', fade: true
      });
    }

    addShake(ctx, 9);
  }
});

registerVfx('fighter_counter', {
  onCast(ctx, f, c) {
    const THREE = ctx.THREE;
    const g = new THREE.Group();
    g.position.set(c.x, 20, c.z);
    g.rotation.y = -f.facing; // face facing direction

    const geos = [];
    const mats = [];

    const outerGeo = new THREE.RingGeometry(18, 20, 8);
    const innerGeo = new THREE.RingGeometry(13, 15, 8);
    geos.push(outerGeo, innerGeo);

    const shieldMat = new THREE.MeshBasicMaterial({
      color: 0xffd700,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    mats.push(shieldMat);

    const outerMesh = new THREE.Mesh(outerGeo, shieldMat);
    const innerMesh = new THREE.Mesh(innerGeo, shieldMat);
    g.add(outerMesh, innerMesh);

    // Add small trigram boxes on the ring
    const boxGeo = new THREE.BoxGeometry(3, 1, 0.8);
    geos.push(boxGeo);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const trigram = new THREE.Mesh(boxGeo, shieldMat);
      trigram.position.set(Math.cos(angle) * 16.5, Math.sin(angle) * 16.5, 0);
      trigram.rotation.z = angle;
      g.add(trigram);
    }

    g.userData.geo = { dispose: () => geos.forEach(geo => geo.dispose()) };
    g.userData.mat = shieldMat;

    ctx.addTransient(g, 0.55, (mesh, t) => {
      mesh.scale.setScalar(Math.min(1.2, t * 6) * (1 - t * 0.15));
      mesh.rotation.z = t * Math.PI * 2.5; // spin it!
      shieldMat.opacity = 0.9 * (1 - t);
    });

    ring(ctx, c, { color: '#f4d03f', from: 8, to: 56, life: 0.36, y: 3 });
    burst(ctx, c, { color: ['#f4d03f', '#ffffff'], count: 14, speed: 150, up: 50, flat: true, life: 0.4 });
    addFlash(ctx, 0.14, '#f4d03f');
  }
});
