// 狂戰士：狂暴、血腥。雙斧血斬 / 血怒爆發 / 旋風刃環。
import * as THREE from 'three';
import { registerVfx } from './registry.js';
import { slashBlade, ring, pillar, column, burst, cone, addShake, addFlash, ultimateBurst } from './lib.js';

// 大絕招 — 血祭處決：狂魔降世與血契處決斬
registerVfx('berserker_ultimate', {
  onCast(ctx, f, c) {
    const THREE = ctx.THREE;
    const dist = f.range || 200;
    const dx = Math.cos(f.facing);
    const dy = Math.sin(f.facing);
    const R = 150;

    // 1. 起步點腳下的血紅環
    ring(ctx, c, { color: '#ff3b2f', from: 8, to: 80, life: 0.38, y: 3, ease: true });

    // 2. 建立血狼影 Mesh (圓錐)
    const wolfGeo = new THREE.ConeGeometry(14, 42, 4);
    const wolfMat = new THREE.MeshStandardMaterial({
      color: 0x922b21,
      emissive: 0xff1a0f,
      emissiveIntensity: 3.8,
      transparent: true,
      opacity: 0.9
    });
    
    // 圓錐預設 +Y 朝上，需要旋轉躺平指向面向的方向
    const wolf = new THREE.Mesh(wolfGeo, wolfMat);
    wolf.rotation.x = Math.PI / 2;
    wolf.rotation.z = -f.facing;
    wolf.position.set(c.x, c.y + 12, c.z);

    ctx.addTransient(wolf, 0.72, (mesh, t) => {
      if (t < 0.32) {
        // 快速衝鋒滑行
        const progress = t / 0.32;
        mesh.position.set(c.x + dx * dist * progress, c.y + 12, c.z + dy * dist * progress);
        mesh.scale.set(1 + progress * 0.2, 1 + progress * 0.4, 1);
      } else {
        // 衝到終點，碎裂消散 (使用 clamped 邊界位置以防出界)
        const hitPointX = Math.max(-600, Math.min(600, c.x + dx * dist));
        const hitPointZ = Math.max(-400, Math.min(400, c.z + dy * dist));
        mesh.position.set(hitPointX, c.y + 12, hitPointZ);
        mesh.scale.setScalar(Math.max(0.001, (1 - (t - 0.32) / 0.68) * 1.2));
        wolfMat.opacity = Math.max(0, (1 - t) * 0.9);
        
        if (!mesh.userData.exploded) {
          mesh.userData.exploded = true;
          
          // 終點落地大爆炸
          const hitPoint = { x: hitPointX, y: c.y, z: hitPointZ };
          ctx.sceneMgr.addShake(26);
          ctx.sceneMgr.addFlash(0.42, '#ff1a0f');

          // 雙重血色十字斬
          slashBlade(ctx, hitPoint, f.facing + 0.65, { color: '#ffffff', len: R * 1.35, w: 26, swing: 2.2, life: 0.38 });
          slashBlade(ctx, hitPoint, f.facing - 0.65, { color: '#ff3b2f', len: R * 1.25, w: 22, swing: 2.2, life: 0.38 });
          
          // 漫天地表血焰環
          ring(ctx, hitPoint, { color: '#922b21', from: 20, to: R * 1.3, life: 0.58, y: 3, alpha: 0.9, ease: true });

          // 噴泉般的深紅血液粒子
          for (let i = 0; i < 54; i++) {
            const a = Math.random() * Math.PI * 2, spd = 260 + Math.random() * 260;
            ctx.particles.spawn({
              x: hitPoint.x, y: 6, z: hitPoint.z,
              vx: Math.cos(a) * spd, vy: 160 + Math.random() * 240, vz: Math.sin(a) * spd,
              gravity: 420, drag: 1.15, life: 0.65 + Math.random() * 0.55,
              size: 4.5 + Math.random() * 5, color: Math.random() < 0.6 ? '#ff3b2f' : '#922b21', fade: true
            });
          }
        }
      }
    });

    wolf.userData.geo = wolfGeo;
    wolf.userData.mat = wolfMat;
  },
});

registerVfx('berserker_axes', {
  onCast(ctx, f, c) {
    const THREE = ctx.THREE;
    slashBlade(ctx, c, f.facing + 0.25, { color: '#ff4d4d', len: f.range * 1.1, w: 14, swing: -0.8, life: 0.2 });
    slashBlade(ctx, c, f.facing - 0.25, { color: '#cd6155', len: f.range * 1.1, w: 14, swing: 0.8, life: 0.2 });
    cone(ctx, c, f.facing, { color: ['#ff4d4d', '#922b21', '#ffffff'], count: 12, speed: 240, spread: 0.6, offset: f.range * 0.4, up: 30, life: 0.35 });
    
    const axeGeo = new THREE.RingGeometry(f.range * 0.5, f.range * 1.1, 16, 1, 0, Math.PI * 0.5);
    const axeMat = new THREE.MeshBasicMaterial({ color: 0xff3b2f, transparent: true, opacity: 0.8, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    
    const a1 = new THREE.Mesh(axeGeo, axeMat);
    a1.position.set(c.x, 14, c.z);
    a1.rotation.set(-Math.PI / 2, 0, -f.facing);
    
    const a2 = new THREE.Mesh(axeGeo, axeMat);
    a2.position.set(c.x, 14, c.z);
    a2.rotation.set(-Math.PI / 2, 0, -f.facing - Math.PI * 0.5);
    
    ctx.addTransient(a1, 0.22, (mesh, t) => {
      mesh.rotation.z = -f.facing + t * 0.8;
      axeMat.opacity = 0.8 * (1 - t);
    });
    ctx.addTransient(a2, 0.22, (mesh, t) => {
      mesh.rotation.z = -f.facing - Math.PI * 0.5 - t * 0.8;
    });
    
    a1.userData.geo = axeGeo;
    a1.userData.mat = axeMat;
    
    addShake(ctx, 4);
  },
});

registerVfx('berserker_rage', {
  onCast(ctx, f, c) {
    const THREE = ctx.THREE;
    pillar(ctx, c, { color: '#e74c3c', h: 130, r: 26, taper: 0.5, life: 0.6, alpha: 0.5, grow: 0.5 });
    ring(ctx, c, { color: '#922b21', from: 14, to: 110, life: 0.5, y: 3, ease: true, alpha: 0.9 });
    column(ctx, c, { color: ['#e74c3c', '#ff7043', '#3a0d0d'], count: 32, radius: 28, speed: 180, life: 0.8, size: 4 });
    burst(ctx, c, { color: '#e74c3c', count: 18, speed: 160, up: 80, flat: true, life: 0.6 });
    
    const headGeo = new THREE.ConeGeometry(14, 28, 4);
    const earGeo = new THREE.ConeGeometry(4, 10, 3);
    const wolfMat = new THREE.MeshBasicMaterial({ color: 0xff3b2f, transparent: true, opacity: 0.9, wireframe: true });
    
    const headGroup = new THREE.Group();
    const head = new THREE.Mesh(headGeo, wolfMat);
    head.rotation.x = Math.PI / 2;
    headGroup.add(head);
    
    const earL = new THREE.Mesh(earGeo, wolfMat);
    earL.position.set(-6, 8, -6);
    earL.rotation.set(0.3, 0, 0.4);
    
    const earR = new THREE.Mesh(earGeo, wolfMat);
    earR.position.set(6, 8, -6);
    earR.rotation.set(0.3, 0, -0.4);
    
    headGroup.add(earL, earR);
    headGroup.position.set(c.x, 38, c.z);
    headGroup.rotation.y = -f.facing;
    
    ctx.addTransient(headGroup, 0.65, (grp, t) => {
      grp.position.y = 38 + t * 28;
      const scale = 1.0 + t * 0.9;
      grp.scale.set(scale, scale, scale);
      wolfMat.opacity = 0.9 * (1 - t);
    });
    
    headGroup.userData.geo = { dispose: () => { headGeo.dispose(); earGeo.dispose(); } };
    headGroup.userData.mat = wolfMat;
    
    addShake(ctx, 8);
    addFlash(ctx, 0.2, '#e74c3c');
  },
});

registerVfx('berserker_whirlwind', {
  onCast(ctx, f, c) {
    // 旋風斬 (全方位)：多重旋轉刃環 + 血色拖尾環 + 火花
    const color = new THREE.Color('#ec7063');
    for (let k = 0; k < 3; k++) {
      const geo = new THREE.RingGeometry(0.55, 1, 48);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.rotation.x = -Math.PI / 2; m.position.set(c.x, 14 + k * 6, c.z);
      const baseR = f.range * (0.7 + k * 0.18);
      ctx.addTransient(m, 0.4, (mesh, t) => { mesh.scale.setScalar(baseR * (0.6 + 0.5 * t)); mesh.rotation.z = t * Math.PI * 4 + k; mesh.material.opacity = (1 - t) * 0.8; });
      m.userData.mat = m.material; m.userData.geo = geo;
    }
    // 數道掃刃
    for (let i = 0; i < 6; i++) {
      slashBlade(ctx, c, (i / 6) * Math.PI * 2, { color: i % 2 ? '#ff4d4d' : '#ec7063', len: f.range, w: 10, swing: 1.2, life: 0.34 });
    }
    burst(ctx, c, { color: ['#ff4d4d', '#922b21'], count: 24, speed: 260, up: 20, flat: true, life: 0.5 });
    addShake(ctx, 9);
  },
});

registerVfx('berserker_leap', {
  onCast(ctx, f, c) {
    ring(ctx, c, { color: '#ff3b2f', from: 10, to: f.range || 130, life: 0.44, y: 3, ease: true });
    addShake(ctx, 12);
    addFlash(ctx, 0.18, '#ff3b2f');
  },
  onHit(ctx, f, c) {
    const THREE = ctx.THREE;
    const R = f.radius || 130;
    
    const craterGeo = new THREE.CircleGeometry(R * 0.9, 32);
    const craterMat = new THREE.MeshBasicMaterial({
      color: 0x1a0505,
      transparent: true,
      opacity: 0.8,
      blending: THREE.NormalBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const crater = new THREE.Mesh(craterGeo, craterMat);
    crater.rotation.x = -Math.PI / 2;
    crater.position.set(c.x, 1.25, c.z);
    
    if (c.x > -595 && c.x < 595 && c.z > -395 && c.z < 395) {
      ctx.addTransient(crater, 1.2, (mesh, t) => {
        mesh.material.opacity = 0.8 * (1 - t);
        mesh.scale.setScalar(1 - t * 0.15);
      });
      crater.userData.geo = craterGeo;
      crater.userData.mat = craterMat;
    } else {
      craterGeo.dispose();
      craterMat.dispose();
    }
    
    for (let i = 0; i < 34; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 120 + Math.random() * 160;
      ctx.particles.spawn({
        x: c.x, y: 5, z: c.z,
        vx: Math.cos(a) * spd, vy: 140 + Math.random() * 160, vz: Math.sin(a) * spd,
        gravity: 380, drag: 1.1, life: 0.5 + Math.random() * 0.4,
        size: 4 + Math.random() * 4, color: Math.random() < 0.65 ? '#ff3b2f' : '#922b21', fade: true
      });
    }
    
    ring(ctx, c, { color: '#922b21', from: 4, to: R * 1.1, life: 0.38, y: 6 });
  }
});

