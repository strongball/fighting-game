// 忍者：隱密、煙霧、幻影。旋轉手裏劍 / 煙霧雲 / 影分身瞬移。
import * as THREE from 'three';
import { registerVfx } from './registry.js';
import { ring, burst, column } from './lib.js';

// 大絕招 — 煙影亂舞：忍秘傳·百刃煙嵐陣
registerVfx('ninja_ultimate', {
  onCast(ctx, f, c) {
    const R = f.radius || 170;
    ctx.sceneMgr.addShake(12);
    ctx.sceneMgr.addFlash(0.18, '#cfd8dc');
    
    // 起手墨印爆發
    ring(ctx, c, { color: '#b0bec5', from: 12, to: 120, life: 0.5, y: 4, alpha: 0.85 });
    for (let i = 0; i < 48; i++) {
      const a = Math.random() * Math.PI * 2, rr = Math.random() * 60;
      ctx.particles.spawn({
        x: c.x + Math.cos(a) * rr, y: Math.random() * 32, z: c.z + Math.sin(a) * rr,
        vx: Math.cos(a) * (60 + Math.random() * 80), vy: 20 + Math.random() * 40, vz: Math.sin(a) * (60 + Math.random() * 80),
        gravity: -6, drag: 1.4, life: 0.7 + Math.random() * 0.5,
        size: 8 + Math.random() * 8, color: Math.random() < 0.5 ? '#4b5358' : '#2c3e50', fade: false
      });
    }
  },
  zone(ctx, z) {
    const THREE = ctx.THREE;
    const g = new THREE.Group();
    const R = z.radius || 170;

    const geos = [];
    const mats = [];

    // 1. 手裏劍軌跡環
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x9b59b6,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    mats.push(ringMat);

    const ringGeos = [];
    const ringMeshes = [];
    for (let k = 0; k < 3; k++) {
      const tg = new THREE.TorusGeometry(R * 0.45 + k * 18, 1.2, 4, 32);
      const tm = new THREE.Mesh(tg, ringMat);
      tm.rotation.set(
        Math.PI / 2 + (k - 1) * 0.4,
        (k - 1) * 0.2,
        0
      );
      g.add(tm);
      ringGeos.push(tg);
      ringMeshes.push(tm);
    }
    geos.push(...ringGeos);

    // 2. 飛旋的立體手裏劍
    const bladeGeo = new THREE.BoxGeometry(R * 0.38, 0.4, 4);
    const shurikenMat = new THREE.MeshStandardMaterial({
      color: 0x2c3e50,
      emissive: 0x9b59b6,
      emissiveIntensity: 2.2,
      metalness: 0.9,
      roughness: 0.2
    });
    geos.push(bladeGeo);
    mats.push(shurikenMat);

    const shurikens = [];
    for (let k = 0; k < 4; k++) {
      const sGroup = new THREE.Group();
      const b1 = new THREE.Mesh(bladeGeo, shurikenMat);
      const b2 = new THREE.Mesh(bladeGeo, shurikenMat);
      b2.rotation.y = Math.PI / 2;
      sGroup.add(b1, b2);
      
      const angle = (k / 4) * Math.PI * 2;
      sGroup.position.set(Math.cos(angle) * R * 0.65, 8 + (k % 2) * 8, Math.sin(angle) * R * 0.65);
      g.add(sGroup);
      shurikens.push({ group: sGroup, baseAngle: angle, y: 8 + (k % 2) * 8 });
    }

    g.userData.geo = { dispose: () => geos.forEach(geo => geo.dispose()) };
    g.userData.mat = { dispose: () => mats.forEach(mat => mat.dispose()) };

    let age = 0;
    return {
      object3D: g,
      update(dt, zz) {
        g.position.y = 2;
        age += dt;

        g.rotation.y -= dt * 1.5;

        shurikens.forEach((s, idx) => {
          s.group.rotation.y += dt * 25;
          const orbitalAngle = s.baseAngle + age * 2.2;
          const localX = Math.cos(orbitalAngle) * R * 0.65;
          const localZ = Math.sin(orbitalAngle) * R * 0.65;
          
          const worldX = g.position.x + localX;
          const worldZ = g.position.z + localZ;
          
          // 若出界則隱藏手裏劍，防止手裏劍在牆壁邊緣擠成一條線，轉回場內時才重新顯示
          if (worldX < -595 || worldX > 595 || worldZ < -395 || worldZ > 395) {
            s.group.visible = false;
          } else {
            s.group.visible = true;
            s.group.position.set(localX, s.y + Math.sin(age * 6 + idx) * 3, localZ);
          }
        });

        ringMeshes.forEach((rm, idx) => {
          rm.rotation.z += dt * (4 + idx * 2);
        });

        const alpha = Math.max(0, 1 - age / z.lifetime);
        ringMat.opacity = 0.6 * alpha;
        shurikenMat.opacity = 0.9 * alpha;

        if (Math.random() < 0.34) {
          const pAngle = Math.random() * Math.PI * 2;
          const pRadius = R * (0.3 + Math.random() * 0.5);
          ctx.particles.spawn({
            x: g.position.x + Math.cos(pAngle) * pRadius,
            y: 4 + Math.random() * 26,
            z: g.position.z + Math.sin(pAngle) * pRadius,
            vx: Math.cos(pAngle) * (60 + Math.random() * 60),
            vy: 10 + Math.random() * 30,
            vz: Math.sin(pAngle) * (60 + Math.random() * 60),
            gravity: -5, drag: 1.45, life: 0.65,
            size: 6 + Math.random() * 6,
            color: Math.random() < 0.5 ? '#1a252f' : '#4b5358', fade: true
          });
        }
      }
    };
  }
});

registerVfx('ninja_shuriken', {
  projectile(ctx, pr) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xced6dc, emissive: new THREE.Color('#95a5a6'), emissiveIntensity: 0.8, metalness: 0.85, roughness: 0.25, side: THREE.DoubleSide });
    // 四角星：兩個交叉薄盒
    const r = pr.radius * 2.2;
    const a = new THREE.Mesh(new THREE.BoxGeometry(r * 2, 0.8, r * 0.5), mat);
    const b = new THREE.Mesh(new THREE.BoxGeometry(r * 0.5, 0.8, r * 2), mat);
    g.add(a); g.add(b);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.3, r * 0.3, 1.2, 8), mat);
    g.add(hub);
    return {
      object3D: g,
      update(dt) {
        g.rotation.y += dt * 30; // 高速旋轉 (繞垂直軸，平躺旋轉感)
        if (Math.random() < 0.5) ctx.particles.spawn({ x: g.position.x, y: g.position.y, z: g.position.z, vx: 0, vy: 0, vz: 0, drag: 6, life: 0.16, size: pr.radius, color: '#c8d0d6', fade: true });
      },
    };
  },
  onHit(ctx, f, c) {
    ring(ctx, c, { color: '#bdc3c7', from: 3, to: (f.radius || 14) * 2, life: 0.22, y: 8 });
    burst(ctx, c, { color: '#dfe6e9', count: 8, speed: 180, life: 0.28, size: 2.2 });
  },
});

registerVfx('ninja_smoke', {
  onCast(ctx, f, c) {
    // 大片煙霧雲：緩慢膨脹的灰色濃煙 + 低矮環
    for (let i = 0; i < 34; i++) {
      const a = Math.random() * Math.PI * 2, rr = Math.random() * 40;
      ctx.particles.spawn({
        x: c.x + Math.cos(a) * rr, y: Math.random() * 30, z: c.z + Math.sin(a) * rr,
        vx: Math.cos(a) * (30 + Math.random() * 50), vy: 20 + Math.random() * 40, vz: Math.sin(a) * (30 + Math.random() * 50),
        gravity: -8, drag: 1.5, life: 0.8 + Math.random() * 0.7, size: 8 + Math.random() * 8,
        color: Math.random() < 0.5 ? '#4b5358' : '#2c3e50', fade: false,
      });
    }
    ring(ctx, c, { color: '#636e72', from: 10, to: 80, life: 0.5, y: 2, alpha: 0.6 });
  },
});

registerVfx('ninja_shadowblink', {
  onCast(ctx, f, c) {
    // 影分身瞬移：墨黑煙 + 上升暗影殘像 + 環
    ring(ctx, c, { color: '#636e72', from: 4, to: 56, life: 0.32, y: 6, alpha: 0.8 });
    burst(ctx, c, { color: ['#2c3e50', '#1a242f', '#636e72'], count: 24, speed: 150, up: 30, gravity: -15, drag: 1.4, life: 0.6, size: 6, fade: false });
    column(ctx, c, { color: '#2c3e50', count: 12, radius: 14, speed: 130, life: 0.45, size: 5, fade: false });
  },
});
