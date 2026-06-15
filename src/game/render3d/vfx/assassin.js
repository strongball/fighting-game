// 刺客：迅捷銳利、暗影。交叉快刀 / 瞬步殘影煙 / 背刺紫爆。
import * as THREE from 'three';
import { registerVfx } from './registry.js';
import { slashBlade, ring, sphereFlash, burst, cone, column, addShake, addFlash, ultimateBurst } from './lib.js';

// 大絕招 — 虛空換影：影殺·虛空瞬獄斬
registerVfx('assassin_ultimate', {
  onCast(ctx, f, c) {
    const THREE = ctx.THREE;
    const R = f.range || 160;

    if (f.type === 'ultimate') {
      // 1. 大招施放瞬間 (全螢幕暗影爆閃與大影圈)
      ctx.sceneMgr.addShake(20);
      ctx.sceneMgr.addFlash(0.42, '#e056fd');
      
      ring(ctx, c, { color: '#e056fd', from: 20, to: R * 1.35, life: 0.72, y: 4, alpha: 0.95, ease: true });
      ring(ctx, c, { color: '#3a1f50', from: 10, to: R * 1.1, life: 0.52, y: 7, alpha: 0.8 });
      sphereFlash(ctx, c, { color: '#ffffff', from: 8, to: R * 0.55, life: 0.32, alpha: 0.95 });
      
      burst(ctx, c, { color: ['#9b59b6', '#e056fd', '#210e30'], count: 54, speed: 380, up: 60, life: 0.65, size: 5 });
    } else {
      // 2. 每次瞬移斬擊 (f.type === 'blink')
      // 瞬移點 c 的「虛空裂痕/刀痕」Mesh
      const crackGeo = new THREE.CylinderGeometry(1.2, 0.2, 54, 6);
      const crackMat = new THREE.MeshStandardMaterial({
        color: 0x210e30,
        emissive: 0xe056fd,
        emissiveIntensity: 3.5,
        transparent: true,
        opacity: 0.95
      });
      const crack = new THREE.Mesh(crackGeo, crackMat);
      crack.position.set(c.x, 16, c.z);
      // 隨機傾斜方向，像虛空裂紋
      crack.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      
      ctx.addTransient(crack, 0.45, (mesh, t) => {
        mesh.scale.set(1 - t, 1, 1 - t);
        mesh.material.opacity = (1 - t) * 0.95;
      });
      crack.userData.geo = crackGeo;
      crack.userData.mat = crackMat;

      // 瞬移點的「三角錐暗影殘像」Mesh
      const shadowGeo = new THREE.ConeGeometry(9, 22, 3);
      const shadowMat = new THREE.MeshBasicMaterial({
        color: 0xe056fd,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const shadow = new THREE.Mesh(shadowGeo, shadowMat);
      shadow.position.set(c.x, 11, c.z);
      shadow.rotation.x = Math.PI / 2;
      shadow.rotation.y = -f.facing;
      
      ctx.addTransient(shadow, 0.55, (mesh, t) => {
        mesh.scale.setScalar(1 + t * 0.3);
        shadowMat.opacity = (1 - t) * 0.75;
      });
      shadow.userData.geo = shadowGeo;
      shadow.userData.mat = shadowMat;

      // 瞬移命中時的交叉快刀
      slashBlade(ctx, c, f.facing, { color: '#ffffff', len: 75, w: 10, swing: 1.8, life: 0.22 });
      slashBlade(ctx, c, f.facing + Math.PI, { color: '#e056fd', len: 65, w: 8, swing: -1.8, life: 0.22 });
      
      // 暗影噴散粒子
      burst(ctx, c, { color: ['#e056fd', '#9b59b6', '#000000'], count: 16, speed: 200, life: 0.45, size: 3.5 });
    }
  },
});

registerVfx('assassin_slash', {
  onCast(ctx, f, c) {
    // 兩道交叉細刃，快而薄
    slashBlade(ctx, c, f.facing + 0.35, { color: '#e9d5ff', len: f.range * 1.1, w: 6, swing: -0.7, life: 0.16 });
    slashBlade(ctx, c, f.facing - 0.35, { color: f.color, len: f.range * 1.1, w: 6, swing: 0.7, life: 0.16 });
    cone(ctx, c, f.facing, { color: '#c39bd3', count: 8, speed: 260, spread: 0.4, offset: f.range * 0.4, life: 0.22, size: 2.4 });
  },
});

registerVfx('assassin_blink', {
  onCast(ctx, f, c) {
    // 目的地紫煙湧現 + 環 + 上升殘影
    ring(ctx, c, { color: '#c39bd3', from: 4, to: 50, life: 0.34, y: 6, alpha: 0.9 });
    burst(ctx, c, { color: ['#9b59b6', '#c39bd3', '#3a2150'], count: 22, speed: 130, up: 40, gravity: -20, drag: 1.4, life: 0.5, size: 5 });
    column(ctx, c, { color: '#c39bd3', count: 10, radius: 12, speed: 120, life: 0.4, size: 3 });
  },
});

registerVfx('assassin_backstab', {
  onCast(ctx, f, c) {
    // 致命一擊 (重爆)：洋紅球爆 + 巨型碎刃 + 雙環 + 閃光
    sphereFlash(ctx, c, { color: '#e056fd', from: 6, to: 58, life: 0.22, alpha: 0.98 });
    slashBlade(ctx, c, f.facing, { color: '#ffffff', len: f.range * 1.4, w: 22, swing: (f.arc || 1.6), life: 0.24 });
    cone(ctx, c, f.facing, { color: ['#e056fd', '#ffffff', '#9b59b6'], count: 28, speed: 380, spread: 0.7, offset: f.range * 0.3, up: 40, life: 0.45, size: 4 });
    ring(ctx, c, { color: '#e056fd', from: 6, to: 90, life: 0.32, y: 8, ease: true });
    addShake(ctx, 9);
    addFlash(ctx, 0.22, '#e056fd');
  },
});
