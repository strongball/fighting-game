// 治療師：神聖、柔和。聖光彈光環 / 治療十字光柱 / 淨化放射。
import * as THREE from 'three';
import { registerVfx } from './registry.js';
import { ring, sphereFlash, column, pillar, burst, slashBlade, addFlash, ultimateBurst } from './lib.js';

// 大絕招 — 聖域生命匯流：生命讚歌與聖域綻放
registerVfx('healer_ultimate', {
  onCast(ctx, f, c) {
    const R = f.radius || 260;
    // 施法起手：神聖微光與溫暖脈動
    ctx.sceneMgr.addShake(10);
    ctx.sceneMgr.addFlash(0.32, '#aaffcc');
    ring(ctx, c, { color: '#aaffcc', from: 14, to: R * 1.25, life: 0.6, y: 3, alpha: 0.9, ease: true });
    
    // 起手十字閃光
    for (let k = 0; k < 2; k++) {
      slashBlade(ctx, c, k * Math.PI / 2, { color: '#fff6cf', len: R * 1.1, w: 14, swing: 0, life: 0.5, y: 32 });
    }
  },
  zone(ctx, z) {
    const THREE = ctx.THREE;
    const g = new THREE.Group();
    const R = z.radius || 280;

    const geos = [];
    const mats = [];

    // 1. 生命之蓮：中心圓 + 8 個發光花瓣
    const centerGeo = new THREE.CircleGeometry(R * 0.25, 32);
    const flowerMat = new THREE.MeshBasicMaterial({
      color: 0xaaffcc,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const center = new THREE.Mesh(centerGeo, flowerMat);
    center.rotation.x = -Math.PI / 2;
    center.position.y = 1.1;
    g.add(center);
    geos.push(centerGeo);
    mats.push(flowerMat);

    const petalGeo = new THREE.CircleGeometry(R * 0.48, 24);
    const petalMat = new THREE.MeshBasicMaterial({
      color: 0xfff0b0,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    mats.push(petalMat);
    geos.push(petalGeo);

    const petals = [];
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const pm = new THREE.Mesh(petalGeo, petalMat);
      pm.rotation.x = -Math.PI / 2;
      pm.position.set(Math.cos(angle) * R * 0.45, 1.2, Math.sin(angle) * R * 0.45);
      g.add(pm);
      petals.push(pm);
    }

    // 2. 白色天堂光柱
    const pillarGeo = new THREE.CylinderGeometry(R * 0.15, R * 0.15, 280, 16, 1, true);
    const pillarMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const pillarMesh = new THREE.Mesh(pillarGeo, pillarMat);
    pillarMesh.position.y = 140;
    g.add(pillarMesh);
    geos.push(pillarGeo);
    mats.push(pillarMat);

    // 3. 螺旋環繞金色 Ring
    const spiralMat = new THREE.MeshBasicMaterial({
      color: 0xffd700,
      transparent: true,
      opacity: 0.68,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    mats.push(spiralMat);
    
    const spiralGeo = new THREE.TorusGeometry(R * 0.18, R * 0.02, 8, 32);
    geos.push(spiralGeo);
    const spirals = [];
    for (let k = 0; k < 3; k++) {
      const sm = new THREE.Mesh(spiralGeo, spiralMat);
      sm.rotation.x = -Math.PI / 2;
      g.add(sm);
      spirals.push(sm);
    }

    g.userData.geo = { dispose: () => geos.forEach(geo => geo.dispose()) };
    g.userData.mat = { dispose: () => mats.forEach(mat => mat.dispose()) };

    let age = 0;
    return {
      object3D: g,
      update(dt) {
        age += dt;
        
        // 蓮花自轉
        g.rotation.y += dt * 0.22;
        
        // 蓮花展開
        const scale = 0.5 + 0.5 * Math.min(1, age / 0.5);
        center.scale.setScalar(scale);
        petals.forEach((pm, i) => {
          const angle = (i / 8) * Math.PI * 2;
          const dist = R * 0.45 * (0.6 + 0.4 * Math.min(1, age / 0.5));
          pm.position.set(Math.cos(angle) * dist, 1.2, Math.sin(angle) * dist);
          pm.scale.setScalar(scale * 0.95);
        });

        // 螺旋金色 Ring 向上推進
        spirals.forEach((sm, k) => {
          const t = ((age * 0.45 + k / 3) % 1.0);
          sm.position.y = t * 180;
          sm.scale.setScalar(1 + t * 0.6);
          sm.rotation.z += dt * 2.2;
        });

        // 隨時間淡出
        const alpha = Math.max(0, 1 - age / z.lifetime);
        flowerMat.opacity = 0.45 * alpha;
        petalMat.opacity = 0.35 * alpha;
        pillarMat.opacity = 0.5 * alpha;
        spiralMat.opacity = 0.68 * alpha;

        // 持續 spawn 聖潔飄落羽毛與生命綠光粒子
        if (Math.random() < 0.26) {
          const pAngle = Math.random() * Math.PI * 2;
          const pRadius = Math.random() * R * 0.75;
          ctx.particles.spawn({
            x: g.position.x + Math.cos(pAngle) * pRadius,
            y: 120 + Math.random() * 100,
            z: g.position.z + Math.sin(pAngle) * pRadius,
            vx: (Math.random() - 0.5) * 15,
            vy: -40 - Math.random() * 30,
            vz: (Math.random() - 0.5) * 15,
            gravity: 10, drag: 0.8, life: 1.8,
            size: 5 + Math.random() * 3,
            color: Math.random() < 0.65 ? '#aaffcc' : '#fff0b0', fade: true
          });
        }
      }
    };
  }
});

registerVfx('healer_holybolt', {
  projectile(ctx, pr) {
    const THREE = ctx.THREE;
    const g = new THREE.Group();
    const color = new THREE.Color('#ffe680');
    
    const crossMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: color,
      emissiveIntensity: 2.8,
      roughness: 0.1
    });
    const barH = new THREE.Mesh(new THREE.BoxGeometry(pr.radius * 2.8, pr.radius * 0.7, pr.radius * 0.7), crossMat);
    const barV = new THREE.Mesh(new THREE.BoxGeometry(pr.radius * 0.7, pr.radius * 2.8, pr.radius * 0.7), crossMat);
    g.add(barH, barV);
    
    g.userData.geo = { dispose: () => { barH.geometry.dispose(); barV.geometry.dispose(); } };
    g.userData.mat = crossMat;

    return {
      object3D: g,
      update(dt) {
        g.rotation.z += dt * 4; g.rotation.x += dt * 2;
        ctx.particles.spawn({
          x: g.position.x, y: g.position.y, z: g.position.z,
          vx: (Math.random() - 0.5) * 12, vy: 15, vz: (Math.random() - 0.5) * 12,
          drag: 2.5, life: 0.28, size: pr.radius * 0.8, color: '#fff2b0', fade: true
        });
      }
    };
  },
  onHit(ctx, f, c) {
    sphereFlash(ctx, c, { color: '#fff2b0', from: 4, to: (f.radius || 28), life: 0.26, alpha: 0.9 });
    ring(ctx, c, { color: '#ffe680', from: 4, to: (f.radius || 24) * 1.8, life: 0.34, y: 8 });
    for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      ctx.particles.spawn({ x: c.x, y: c.y, z: c.z, vx: Math.cos(a) * 120, vy: 0, vz: Math.sin(a) * 120, drag: 3, life: 0.35, size: 4, color: '#ffffff', fade: true });
    }
  },
});

registerVfx('healer_heal', {
  onCast(ctx, f, c) {
    pillar(ctx, c, { color: '#7CFFA0', h: 110, r: 22, life: 0.6, alpha: 0.5 });
    ring(ctx, c, { color: '#2ecc71', from: 8, to: 70, life: 0.5, y: 3, ease: true });
    column(ctx, c, { color: ['#7CFFA0', '#ffffff'], count: 28, radius: 26, speed: 140, life: 0.8, size: 3.5 });
    addFlash(ctx, 0.1, '#7CFFA0');
  },
});

registerVfx('healer_cleanse', {
  onCast(ctx, f, c) {
    const THREE = ctx.THREE;
    sphereFlash(ctx, c, { color: '#ffffff', from: 6, to: 60, life: 0.24, alpha: 0.85 });
    ring(ctx, c, { color: '#55efc4', from: 10, to: 100, life: 0.5, y: 3, ease: true });
    column(ctx, c, { color: ['#55efc4', '#ffffff'], count: 24, radius: 30, speed: 170, life: 0.7 });
    
    const featherGeo = new THREE.ConeGeometry(3, 24, 3);
    const featherMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    const feather = new THREE.Mesh(featherGeo, featherMat);
    feather.position.set(c.x, 80, c.z);
    feather.rotation.z = 0.5;
    
    ctx.addTransient(feather, 0.62, (mesh, t) => {
      mesh.position.y = 80 * (1 - t) + 4;
      mesh.position.x = c.x + Math.sin(t * Math.PI * 3) * 6;
      mesh.rotation.y = t * Math.PI * 4;
      mesh.rotation.x = Math.sin(t * Math.PI) * 0.5;
      featherMat.opacity = 0.85 * (1 - t);
      
      if (Math.random() < 0.3) {
        ctx.particles.spawn({
          x: mesh.position.x, y: mesh.position.y, z: mesh.position.z,
          vx: (Math.random() - 0.5) * 10, vy: -10, vz: (Math.random() - 0.5) * 10,
          drag: 1, life: 0.4, size: 3.5, color: '#ffffff', fade: true
        });
      }
    });
    
    feather.userData.geo = featherGeo;
    feather.userData.mat = featherMat;
    
    addFlash(ctx, 0.16, '#ffffff');
  },
});

registerVfx('healer_aura', {
  zone(ctx, z) {
    const THREE = ctx.THREE;
    const g = new THREE.Group();
    const color = new THREE.Color('#55efc4');
    
    const ringGeo = new THREE.RingGeometry(z.radius * 0.9, z.radius, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 1.1;
    g.add(ringMesh);
    
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(z.radius * 1.4, 0.4, z.radius * 0.28), ringMat);
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(z.radius * 0.28, 0.4, z.radius * 1.4), ringMat);
    crossH.rotation.x = -Math.PI / 2;
    crossV.rotation.x = -Math.PI / 2;
    crossH.position.y = 1.15;
    crossV.position.y = 1.15;
    g.add(crossH, crossV);
    
    g.userData.geo = { dispose: () => { ringGeo.dispose(); crossH.geometry.dispose(); crossV.geometry.dispose(); } };
    g.userData.mat = ringMat;

    let age = 0;
    let timeAcc = 0;
    return {
      object3D: g,
      update(dt) {
        age += dt;
        crossH.rotation.z = age * 0.4;
        crossV.rotation.z = age * 0.4;
        ringMesh.rotation.z = -age * 0.2;
        
        const remaining = Math.max(0, 1 - age / z.lifetime);
        ringMat.opacity = 0.5 * remaining * (0.6 + 0.4 * Math.sin(age * 4));

        timeAcc += dt;
        const rate = 0.08;
        while (timeAcc >= rate) {
          timeAcc -= rate;
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * z.radius * 0.8;
          ctx.particles.spawn({
            x: g.position.x + Math.cos(angle) * dist,
            y: 4,
            z: g.position.z + Math.sin(angle) * dist,
            vx: (Math.random() - 0.5) * 10,
            vy: 50 + Math.random() * 60,
            vz: (Math.random() - 0.5) * 10,
            drag: 1,
            life: 0.6 + Math.random() * 0.4,
            size: 3 + Math.random() * 3,
            color: Math.random() < 0.6 ? '#55efc4' : '#ffffff',
            fade: true
          });
        }
      }
    };
  }
});

