// @ts-nocheck
// 戰士：厚重、物理、地面感。鋼鐵月牙斬 / 衝鋒塵爆 / 金色戰吼。
import * as THREE from 'three';
import { registerVfx } from '../../../render3d/vfx/registry.js';
import { slashBlade, cone, ring, column, burst, addShake, addFlash, ultimateBurst, getSwingDir } from '../../../render3d/vfx/lib.js';

// 大絕招 — 不動如山：黃金聖域與盾牌防禦
registerVfx('warrior_ultimate', {
  onCast(ctx, f, c) {
    const THREE = ctx.THREE;
    const R = f.radius || 150;
    const g = new THREE.Group();
    g.position.set(c.x, c.y, c.z);

    // 1. 建立金色巨劍
    const swordBladeGeo = new THREE.BoxGeometry(3.5, 42, 1.2);
    const swordCrossGeo = new THREE.BoxGeometry(11, 2.5, 2.5);
    const swordGripGeo = new THREE.CylinderGeometry(0.8, 0.8, 8, 8);
    const swordMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xff9900,
      emissiveIntensity: 1.8,
      metalness: 0.9,
      roughness: 0.1,
      transparent: true,
      opacity: 0.95
    });
    
    const bladeMesh = new THREE.Mesh(swordBladeGeo, swordMat);
    bladeMesh.position.y = 25;
    const crossMesh = new THREE.Mesh(swordCrossGeo, swordMat);
    crossMesh.position.y = 7;
    const gripMesh = new THREE.Mesh(swordGripGeo, swordMat);
    gripMesh.position.y = 3;

    const swordGroup = new THREE.Group();
    swordGroup.add(bladeMesh, crossMesh, gripMesh);
    swordGroup.position.set(0, 90, 0);
    g.add(swordGroup);

    // 2. 建立 6 面繞行盾牌
    const shieldGeo = new THREE.BoxGeometry(9, 16, 2.0);
    const shieldMat = new THREE.MeshStandardMaterial({
      color: 0xffa500,
      emissive: 0xff4500,
      emissiveIntensity: 1.5,
      metalness: 0.85,
      roughness: 0.15,
      transparent: true,
      opacity: 0.95
    });
    const shieldMeshes = [];
    const shieldRadius = R * 0.52;
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const sm = new THREE.Mesh(shieldGeo, shieldMat);
      sm.position.set(Math.cos(angle) * shieldRadius, 8, Math.sin(angle) * shieldRadius);
      sm.lookAt(new THREE.Vector3(0, 8, 0));
      g.add(sm);
      shieldMeshes.push(sm);
    }

    // 資源釋放註冊
    const geos = [swordBladeGeo, swordCrossGeo, swordGripGeo, shieldGeo];
    const mats = [swordMat, shieldMat];
    g.userData.geo = { dispose: () => geos.forEach(geo => geo.dispose()) };
    g.userData.mat = { dispose: () => mats.forEach(mat => mat.dispose()) };
    g.userData.exploded = false;

    // 動畫與特效觸發
    ctx.addTransient(g, 1.2, (grp, t) => {
      // 巨劍插地動畫
      if (t < 0.22) {
        swordGroup.position.y = 90 * (1 - t / 0.22) - 2;
      } else {
        swordGroup.position.y = -2;
        if (!grp.userData.exploded) {
          grp.userData.exploded = true;
          // 插地瞬間爆發
          ultimateBurst(ctx, c, { color: '#ffcaa0', radius: R, pillarH: 185, pillarR: 35, shake: 24, flash: 0.38 });
          for (let i = 0; i < 42; i++) {
            const a = Math.random() * Math.PI * 2, spd = 280 + Math.random() * 240;
            ctx.particles.spawn({
              x: c.x, y: 5, z: c.z,
              vx: Math.cos(a) * spd, vy: 140 + Math.random() * 200, vz: Math.sin(a) * spd,
              gravity: 230, drag: 1.8, life: 0.55 + Math.random() * 0.5,
              size: 4 + Math.random() * 4.5, color: Math.random() < 0.5 ? '#ffd700' : '#ffcaa0', fade: true
            });
          }
        }
      }

      // 盾牌旋轉與升降淡出
      const rotSpeed = t * Math.PI * 2.8;
      const opacity = Math.max(0, (1 - t) * 0.95);
      swordMat.opacity = opacity;
      shieldMat.opacity = opacity;

      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + rotSpeed;
        const curY = 8 + Math.sin(t * Math.PI) * 5.5;
        const localX = Math.cos(angle) * shieldRadius;
        const localZ = Math.sin(angle) * shieldRadius;
        
        const worldX = g.position.x + localX;
        const worldZ = g.position.z + localZ;
        
        // 若出界則隱藏盾牌，防止盾牌在牆壁邊緣擠成一條線
        if (worldX < -595 || worldX > 595 || worldZ < -395 || worldZ > 395) {
          shieldMeshes[i].visible = false;
        } else {
          shieldMeshes[i].visible = true;
          shieldMeshes[i].position.set(localX, curY, localZ);
          shieldMeshes[i].lookAt(new THREE.Vector3(0, curY, 0));
        }
      }
    });

    // 保留原本戰士大招向前發射的 cone 與 ring 作為輔助氣浪
    ring(ctx, c, { color: '#ff8a5b', from: 20, to: R * 1.2, life: 0.5, y: 2, alpha: 0.8, ease: true });
    cone(ctx, c, f.facing, { color: ['#ffd166', '#ff6b5b', '#ffffff'], count: 34, speed: 420, spread: 1.2, offset: R * 0.4, up: 70, life: 0.55, size: 5.5 });
  },
});

registerVfx('warrior_slash', {
  onCast(ctx, f, c) {
    const THREE = ctx.THREE;
    const swingDir = getSwingDir(ctx, c);
    const sw = (f.arc || 1.3) * swingDir;
    slashBlade(ctx, c, f.facing, { color: '#ffffff', len: f.range * 1.15, w: 18, swing: sw, life: 0.22 });
    slashBlade(ctx, c, f.facing, { color: '#ffd700', len: f.range, w: 28, swing: sw, life: 0.26 });
    cone(ctx, c, f.facing, { color: ['#ffd166', '#ff8a5b', '#caa472'], count: 15, speed: 240, spread: (f.arc || 1.3) / 2, offset: f.range * 0.4, up: 40, life: 0.35, size: 4.5 });
    
    const rockGeo = new THREE.DodecahedronGeometry(3.5);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: 0.9 });
    for (let i = 0; i < 2; i++) {
      const rock = new THREE.Mesh(rockGeo, rockMat);
      const angle = f.facing + (Math.random() - 0.5) * (f.arc || 1.3);
      const spd = 150 + Math.random() * 100;
      rock.position.set(c.x, 4, c.z);
      ctx.addTransient(rock, 0.45, (mesh, t) => {
        mesh.position.x = c.x + Math.cos(angle) * spd * t;
        mesh.position.z = c.z + Math.sin(angle) * spd * t;
        mesh.position.y = 4 + Math.sin(t * Math.PI) * 16 - t * 4;
        mesh.rotation.x += 0.1; mesh.rotation.y += 0.08;
      });
    }
    addShake(ctx, 4);
  },
});

registerVfx('warrior_charge', {
  onCast(ctx, f, c) {
    const THREE = ctx.THREE;
    ring(ctx, c, { color: '#ffd166', from: 10, to: 90, life: 0.4, y: 2, alpha: 0.85 });
    
    const drillGeo = new THREE.ConeGeometry(8, 32, 5);
    const drillMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xff8c00,
      emissiveIntensity: 2.2,
      transparent: true,
      opacity: 0.8,
      wireframe: true
    });
    const drill = new THREE.Mesh(drillGeo, drillMat);
    drill.rotation.x = Math.PI / 2;
    drill.rotation.z = -f.facing;
    drill.position.set(c.x, 14, c.z);
    
    const dx = Math.cos(f.facing);
    const dz = Math.sin(f.facing);
    const dist = f.range || 320;
    
    ctx.addTransient(drill, 0.38, (mesh, t) => {
      mesh.rotation.y += 0.3;
      const progress = t;
      mesh.position.set(c.x + dx * dist * progress, 14, c.z + dz * dist * progress);
      mesh.scale.set(1 + t * 0.2, 1, 1 + t * 0.2);
      drillMat.opacity = 0.8 * (1 - t);
    });
    drill.userData.geo = drillGeo;
    drill.userData.mat = drillMat;
    
    cone(ctx, c, f.facing + Math.PI, { color: ['#caa472', '#8a6a44'], count: 18, speed: 200, spread: 0.8, up: 50, gravity: 150, life: 0.5, size: 4 });
    cone(ctx, c, f.facing, { color: '#ffecb3', count: 14, speed: 380, spread: 0.2, life: 0.3, size: 3 });
    addShake(ctx, 6);
  },
});

registerVfx('warrior_warcry', {
  onCast(ctx, f, c) {
    // 戰吼：雙金環擴散 + 上升火星柱 + 地面閃光
    ring(ctx, c, { color: '#ffd166', from: 14, to: 120, life: 0.5, y: 3, alpha: 0.9, ease: true });
    ring(ctx, c, { color: '#ffffff', from: 8, to: 80, life: 0.4, y: 5, alpha: 0.7 });
    column(ctx, c, { color: ['#ffd166', '#ffe9a8'], count: 26, radius: 30, speed: 150, life: 0.7 });
    burst(ctx, c, { color: '#ffd166', count: 16, speed: 120, up: 60, flat: true, life: 0.5 });
    addShake(ctx, 5);
    addFlash(ctx, 0.16, '#ffd166');
  },
});

registerVfx('warrior_grapple', {
  projectile(ctx, pr) {
    const THREE = ctx.THREE;
    const g = new THREE.Group();
    
    // 1. 金屬鉤子
    const hookGeo = new THREE.ConeGeometry(pr.radius * 0.9, pr.radius * 2.8, 5);
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      emissive: 0xd4af37,
      emissiveIntensity: 0.8,
      metalness: 0.9,
      roughness: 0.1
    });
    const hook = new THREE.Mesh(hookGeo, metalMat);
    hook.rotation.z = -Math.PI / 2;
    hook.position.x = pr.radius * 1.5;
    g.add(hook);
    
    // 2. 連環鎖鏈拖尾
    const linkGeo = new THREE.TorusGeometry(pr.radius * 0.55, pr.radius * 0.16, 4, 8);
    const links = [];
    const numLinks = 8;
    const spacing = pr.radius * 1.25;
    for (let i = 0; i < numLinks; i++) {
      const link = new THREE.Mesh(linkGeo, metalMat);
      link.position.x = -i * spacing;
      link.rotation.x = (i % 2) * (Math.PI / 2);
      g.add(link);
      links.push(link);
    }
    
    g.userData.geo = { dispose: () => { hookGeo.dispose(); linkGeo.dispose(); } };
    g.userData.mat = metalMat;

    return {
      object3D: g,
      update(dt) {
        links.forEach((l, idx) => {
          l.position.y = Math.sin(performance.now() * 0.02 + idx) * 0.8;
        });
        ctx.particles.spawn({
          x: g.position.x, y: g.position.y, z: g.position.z,
          vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 20, vz: (Math.random() - 0.5) * 20,
          drag: 3, life: 0.18, size: pr.radius * 0.8, color: '#f0a35b', fade: true
        });
      }
    };
  },
  onHit(ctx, f, c) {
    ring(ctx, c, { color: '#f0a35b', from: 4, to: (f.radius || 13) * 2.8, life: 0.28, y: 8 });
    burst(ctx, c, { color: ['#f0a35b', '#ffffff', '#7f8c8d'], count: 15, speed: 200, up: 40, life: 0.45 });
    addShake(ctx, 5);
  }
});

