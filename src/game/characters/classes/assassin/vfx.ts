// @ts-nocheck
// 刺客：迅捷銳利、暗影。交叉快刀 / 瞬步殘影煙 / 背刺紫爆。
import * as THREE from 'three';
import { registerVfx } from '../../../render3d/vfx/registry.js';
import { slashBlade, ring, sphereFlash, burst, cone, column, addShake, addFlash, ultimateBurst } from '../../../render3d/vfx/lib.js';

// 大絕招 — 死罪處決：殘血斬殺的血色處決爆斬
registerVfx('assassin_ultimate', {
  onCast(ctx, f, c) {
    const TH = ctx.THREE;
    const R = f.range || 160;
    addShake(ctx, 18);
    addFlash(ctx, 0.36, '#7a0f2a');

    // 處決暴閃 + 雙色血環
    sphereFlash(ctx, c, { color: '#ffffff', from: 10, to: R * 0.6, life: 0.3, alpha: 0.98 });
    ring(ctx, c, { color: '#ff2d6b', from: 18, to: R * 1.35, life: 0.7, y: 4, alpha: 0.95, ease: true });
    ring(ctx, c, { color: '#3a0f1f', from: 8, to: R * 1.05, life: 0.5, y: 8, alpha: 0.85 });

    // 巨型死罪斬：交叉重刃（白 + 血色）
    slashBlade(ctx, c, f.facing, { color: '#ffffff', len: R * 1.5, w: 26, swing: (f.arc || 2.8), life: 0.26 });
    slashBlade(ctx, c, f.facing + 0.4, { color: '#ff2d6b', len: R * 1.35, w: 18, swing: -(f.arc || 2.8), life: 0.24 });

    // 血色噴濺 + 前向錐爆
    burst(ctx, c, { color: ['#ff2d6b', '#9b1030', '#3a0f1f'], count: 56, speed: 420, up: 70, gravity: -260, drag: 1.3, life: 0.7, size: 5 });
    cone(ctx, c, f.facing, { color: ['#ff2d6b', '#ffffff', '#e056fd'], count: 30, speed: 460, spread: 0.7, offset: R * 0.3, up: 40, life: 0.5, size: 4.5 });
  },
});

registerVfx('assassin_slash', {
  onCast(ctx, f, c) {
    const THREE = ctx.THREE;
    slashBlade(ctx, c, f.facing + 0.35, { color: '#e9d5ff', len: f.range * 1.1, w: 6, swing: -0.7, life: 0.16 });
    slashBlade(ctx, c, f.facing - 0.35, { color: f.color, len: f.range * 1.1, w: 6, swing: 0.7, life: 0.16 });
    cone(ctx, c, f.facing, { color: '#c39bd3', count: 8, speed: 260, spread: 0.4, offset: f.range * 0.4, life: 0.22, size: 2.4 });
    
    const slashGeo = new THREE.BoxGeometry(f.range * 1.2, 0.5, 2.5);
    const slashMat = new THREE.MeshBasicMaterial({ color: 0x9b59b6, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending });
    
    const s1 = new THREE.Mesh(slashGeo, slashMat);
    s1.position.set(c.x + Math.cos(f.facing) * f.range * 0.4, 14, c.z + Math.sin(f.facing) * f.range * 0.4);
    s1.rotation.y = -f.facing;
    s1.rotation.z = 0.4;
    
    const s2 = new THREE.Mesh(slashGeo, slashMat);
    s2.position.set(c.x + Math.cos(f.facing) * f.range * 0.4, 14, c.z + Math.sin(f.facing) * f.range * 0.4);
    s2.rotation.y = -f.facing;
    s2.rotation.z = -0.4;
    
    ctx.addTransient(s1, 0.24, (mesh, t) => { mesh.material.opacity = (1 - t) * 0.85; mesh.scale.y = 1 - t; });
    ctx.addTransient(s2, 0.24, (mesh, t) => { mesh.scale.y = 1 - t; });
    s1.userData.geo = slashGeo;
    s1.userData.mat = slashMat;
  },
});

registerVfx('assassin_blink', {
  onCast(ctx, f, c) {
    const THREE = ctx.THREE;
    const R = f.range || 260;
    
    ring(ctx, c, { color: '#c39bd3', from: 4, to: 50, life: 0.34, y: 6, alpha: 0.9 });
    burst(ctx, c, { color: ['#9b59b6', '#c39bd3', '#3a2150'], count: 22, speed: 130, up: 40, gravity: -20, drag: 1.4, life: 0.5, size: 5 });
    column(ctx, c, { color: '#c39bd3', count: 10, radius: 12, speed: 120, life: 0.4, size: 3 });
    
    const startX = c.x - Math.cos(f.facing) * R;
    const startZ = c.z - Math.sin(f.facing) * R;
    
    const safeStartX = Math.max(-595, Math.min(595, startX));
    const safeStartZ = Math.max(-395, Math.min(395, startZ));
    
    const cloneGeo = new THREE.ConeGeometry(9, 22, 4);
    const cloneMat = new THREE.MeshBasicMaterial({ color: 0x3a2150, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending });
    const clone = new THREE.Mesh(cloneGeo, cloneMat);
    clone.position.set(safeStartX, 11, safeStartZ);
    clone.rotation.x = Math.PI / 2;
    clone.rotation.y = -f.facing;
    
    ctx.addTransient(clone, 0.48, (mesh, t) => {
      mesh.scale.set(1 + t * 0.4, 1, 1 + t * 0.4);
      cloneMat.opacity = 0.85 * (1 - t);
    });
    clone.userData.geo = cloneGeo;
    clone.userData.mat = cloneMat;
    
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2, sp = 50 + Math.random() * 80;
      ctx.particles.spawn({
        x: safeStartX, y: 8, z: safeStartZ,
        vx: Math.cos(a) * sp, vy: 20 + Math.random() * 40, vz: Math.sin(a) * sp,
        drag: 2, life: 0.4, size: 4, color: '#3a2150', fade: true
      });
    }
  },
});

registerVfx('assassin_backstab', {
  onCast(ctx, f, c) {
    // 噬血爆刃 (引爆印記)：洋紅球爆 + 巨型碎刃 + 雙環 + 閃光 + 血濺
    sphereFlash(ctx, c, { color: '#e056fd', from: 6, to: 58, life: 0.22, alpha: 0.98 });
    slashBlade(ctx, c, f.facing, { color: '#ffffff', len: f.range * 1.4, w: 22, swing: (f.arc || 1.6), life: 0.24 });
    cone(ctx, c, f.facing, { color: ['#e056fd', '#ff2d6b', '#9b59b6'], count: 28, speed: 380, spread: 0.7, offset: f.range * 0.3, up: 40, life: 0.45, size: 4 });
    ring(ctx, c, { color: '#e056fd', from: 6, to: 90, life: 0.32, y: 8, ease: true });
    addShake(ctx, 9);
    addFlash(ctx, 0.22, '#e056fd');
  },
});

// 影刺突 (skill1 dash 突進)：拉近補刀的紫色突刺殘影
registerVfx('assassin_dash', {
  onCast(ctx, f, c) {
    const TH = ctx.THREE;
    const facing = f.facing || 0;
    const len = 130;
    // 突進殘影條（沿前進方向拉長，快速淡出）
    const trailGeo = new TH.BoxGeometry(len, 0.6, 7);
    const trailMat = new TH.MeshBasicMaterial({ color: 0xc39bd3, transparent: true, opacity: 0.8, blending: TH.AdditiveBlending, depthWrite: false });
    const trail = new TH.Mesh(trailGeo, trailMat);
    trail.position.set(c.x - Math.cos(facing) * len * 0.4, 13, c.z - Math.sin(facing) * len * 0.4);
    trail.rotation.y = -facing;
    ctx.addTransient(trail, 0.26, (mesh, t) => { trailMat.opacity = 0.8 * (1 - t); mesh.scale.x = 1 - t * 0.5; });
    trail.userData.geo = trailGeo;
    trail.userData.mat = trailMat;

    // 突刺斬 + 前向錐 + 落點環
    slashBlade(ctx, c, facing, { color: '#ffffff', len: 90, w: 11, swing: 1.6, life: 0.2 });
    cone(ctx, c, facing, { color: ['#c39bd3', '#e056fd', '#9b59b6'], count: 14, speed: 320, spread: 0.4, offset: 30, life: 0.32, size: 3.2 });
    ring(ctx, c, { color: '#c39bd3', from: 4, to: 64, life: 0.3, y: 6, alpha: 0.85 });
    addShake(ctx, 5);
  },
});
