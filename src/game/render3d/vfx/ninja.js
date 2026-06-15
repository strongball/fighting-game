// 忍者：隱密、煙霧、幻影。旋轉手裏劍 / 煙霧雲 / 影分身瞬移。
import * as THREE from 'three';
import { registerVfx } from './registry.js';
import { ring, burst, column } from './lib.js';

// Calligraphy canvas texture helper for Japanese/Chinese ink style text
function createCalligraphyTexture(text, colorStr = '#1a1a1a', size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  // Soft ink splash background
  const grad = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size * 0.45);
  grad.addColorStop(0, 'rgba(44, 62, 80, 0.25)');
  grad.addColorStop(0.5, 'rgba(26, 37, 48, 0.1)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.45, 0, Math.PI * 2);
  ctx.fill();

  // Ink splatter particles
  ctx.fillStyle = colorStr;
  for (let i = 0; i < 7; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = size * (0.22 + Math.random() * 0.2);
    const r = size * (0.02 + Math.random() * 0.04);
    ctx.beginPath();
    ctx.arc(size / 2 + Math.cos(angle) * dist, size / 2 + Math.sin(angle) * dist, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw the calligraphy character
  ctx.font = `bold ${size * 0.65}px "Kaiti", "STKaiti", "SimSun", "Microsoft YaHei", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 4;
  ctx.fillText(text, size / 2, size / 2);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

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
    const THREE = ctx.THREE;
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0x151b24,
      emissive: 0x2c3e50,
      emissiveIntensity: 1.5,
      metalness: 0.9,
      roughness: 0.15,
      side: THREE.DoubleSide
    });
    const r = pr.radius * 2.2;
    const aGeo = new THREE.BoxGeometry(r * 2, 0.8, r * 0.45);
    const bGeo = new THREE.BoxGeometry(r * 0.45, 0.8, r * 2);
    const hubGeo = new THREE.CylinderGeometry(r * 0.28, r * 0.28, 1.2, 8);
    
    const a = new THREE.Mesh(aGeo, mat);
    const b = new THREE.Mesh(bGeo, mat);
    const hub = new THREE.Mesh(hubGeo, mat);
    g.add(a, b, hub);
    
    g.userData.geo = {
      dispose() {
        aGeo.dispose();
        bGeo.dispose();
        hubGeo.dispose();
      }
    };
    g.userData.mat = mat;

    return {
      object3D: g,
      update(dt) {
        g.rotation.y += dt * 32; // Spin flat
        // Ink splatter trail
        if (Math.random() < 0.65) {
          ctx.particles.spawn({
            x: g.position.x + (Math.random() - 0.5) * 1.5,
            y: g.position.y,
            z: g.position.z + (Math.random() - 0.5) * 1.5,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            vz: (Math.random() - 0.5) * 8,
            drag: 3,
            life: 0.28 + Math.random() * 0.22,
            size: pr.radius * (1.3 + Math.random() * 0.7),
            color: Math.random() < 0.65 ? '#1a1a1a' : '#2c3e50',
            fade: true
          });
        }
      },
    };
  },
  onHit(ctx, f, c) {
    // Ink ring and splash
    ring(ctx, c, { color: '#2c3e50', from: 4, to: (f.radius || 14) * 2.8, life: 0.32, y: 8, alpha: 0.85 });
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 70 + Math.random() * 120;
      ctx.particles.spawn({
        x: c.x, y: 8, z: c.z,
        vx: Math.cos(a) * spd, vy: 50 + Math.random() * 90, vz: Math.sin(a) * spd,
        drag: 1.8, life: 0.42 + Math.random() * 0.28,
        size: 3.5 + Math.random() * 4,
        color: Math.random() < 0.6 ? '#1a1a1a' : '#2c3e50',
        fade: true
      });
    }
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
    const THREE = ctx.THREE;
    const R = f.range || 320;
    
    const startX = c.x - Math.cos(f.facing) * R;
    const startZ = c.z - Math.sin(f.facing) * R;
    const safeStartX = Math.max(-595, Math.min(595, startX));
    const safeStartZ = Math.max(-395, Math.min(395, startZ));
    
    // Spawn at start and end positions
    const points = [
      { x: safeStartX, z: safeStartZ },
      { x: c.x, z: c.z }
    ];
    
    points.forEach((pt) => {
      // Calligraphy Sprite
      const tex = createCalligraphyTexture('忍', '#111111');
      const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        opacity: 0.95,
        blending: THREE.NormalBlending
      });
      const sprite = new THREE.Sprite(mat);
      sprite.position.set(pt.x, 14, pt.z);
      sprite.scale.set(28, 28, 1);
      
      ctx.addTransient(sprite, 0.75, (mesh, t) => {
        mesh.position.y = 14 + t * 24;
        mat.opacity = 0.95 * (1 - t);
        mesh.scale.setScalar(28 * (1 + t * 0.45));
      });
      
      sprite.userData.geo = {
        dispose() {
          tex.dispose();
        }
      };
      sprite.userData.mat = mat;
      
      // Ink burst particles
      for (let i = 0; i < 22; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 70 + Math.random() * 90;
        ctx.particles.spawn({
          x: pt.x, y: 8, z: pt.z,
          vx: Math.cos(a) * sp, vy: 30 + Math.random() * 65, vz: Math.sin(a) * sp,
          drag: 1.7, life: 0.45 + Math.random() * 0.35,
          size: 5 + Math.random() * 5.5,
          color: Math.random() < 0.6 ? '#151b24' : '#4b5358',
          fade: true
        });
      }
    });

    ring(ctx, c, { color: '#636e72', from: 4, to: 56, life: 0.32, y: 6, alpha: 0.8 });
  },
});

registerVfx('ninja_bind', {
  projectile(ctx, pr) {
    const THREE = ctx.THREE;
    const g = new THREE.Group();
    
    const talGeo = new THREE.BoxGeometry(pr.radius * 2.5, 0.4, pr.radius * 1.2);
    const talMat = new THREE.MeshStandardMaterial({
      color: 0x210e30,
      emissive: 0x9b59b6,
      emissiveIntensity: 2.2,
      roughness: 0.5
    });
    const tal = new THREE.Mesh(talGeo, talMat);
    g.add(tal);
    
    g.userData.geo = talGeo;
    g.userData.mat = talMat;

    return {
      object3D: g,
      update(dt) {
        tal.rotation.y += dt * 10;
        tal.rotation.x += dt * 5;
        
        ctx.particles.spawn({
          x: g.position.x, y: g.position.y, z: g.position.z,
          vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 0.5) * 12, vz: (Math.random() - 0.5) * 12,
          drag: 3, life: 0.24, size: pr.radius * 0.9,
          color: Math.random() < 0.6 ? '#636e72' : '#9b59b6', fade: false
        });
      }
    };
  },
  onHit(ctx, f, c) {
    const THREE = ctx.THREE;
    ring(ctx, c, { color: '#9b59b6', from: 4, to: (f.radius || 11) * 2.8, life: 0.5, y: 8 });
    
    const ropeGeo = new THREE.CylinderGeometry(f.radius || 11, f.radius || 11, 28, 8, 1, true);
    const ropeMat = new THREE.MeshBasicMaterial({
      color: 0x2c3e50,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.NormalBlending
    });
    
    const rope = new THREE.Mesh(ropeGeo, ropeMat);
    rope.position.set(c.x, 14, c.z);
    
    ctx.addTransient(rope, 0.75, (mesh, t) => {
      mesh.scale.set(1 - t * 0.3, 1, 1 - t * 0.3);
      mesh.rotation.y += 0.05;
      mesh.material.opacity = 0.85 * (1 - t);
    });
    
    rope.userData.geo = ropeGeo;
    rope.userData.mat = ropeMat;
    
    burst(ctx, c, { color: ['#2c3e50', '#9b59b6', '#000000'], count: 12, speed: 120, up: 30, life: 0.5 });
  }
});

