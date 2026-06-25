// @ts-nocheck
// 鳥獵：暖琥珀鷹羽、速射光箭、爆擊金光。
import * as THREE from 'three';
import { registerVfx } from '../../../render3d/vfx/registry.js';
import { ring, burst, cone, sphereFlash, ultimateBurst, column } from '../../../render3d/vfx/lib.js';

// 共用：速射光箭外觀（細長發光箭體 + 羽尾拖尾）
function makeArrow(ctx, pr, headColor, tailColor) {
  const THREE = ctx.THREE;
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(pr.radius * 0.3, pr.radius * 0.3, pr.radius * 6.5, 6),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: new THREE.Color(headColor), emissiveIntensity: 3.0, roughness: 0.2 }),
  );
  shaft.rotation.z = Math.PI / 2;
  g.add(shaft);
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(pr.radius * 0.55, pr.radius * 2.2, 6),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(headColor), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending }),
  );
  tip.rotation.z = -Math.PI / 2;
  tip.position.x = pr.radius * 3.6;
  g.add(tip);
  return {
    object3D: g,
    update(dt) {
      ctx.particles.spawn({
        x: g.position.x, y: g.position.y, z: g.position.z,
        vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 0.5) * 12, vz: (Math.random() - 0.5) * 12,
        drag: 3, life: 0.2, size: pr.radius * 1.0,
        color: Math.random() < 0.5 ? tailColor : headColor, fade: true,
      });
    },
  };
}

// 鷹隼飛行拖尾：沿飛行軌跡的金色火花（讓「飛出去」更明顯）。
registerVfx('falconer_trail', {
  onHit(ctx, f, c) {
    for (let i = 0; i < 3; i++) {
      ctx.particles.spawn({
        x: c.x, y: c.y + 2, z: c.z,
        vx: (Math.random() - 0.5) * 14, vy: (Math.random() - 0.2) * 10, vz: (Math.random() - 0.5) * 14,
        drag: 3, life: 0.26, size: 3.4 + Math.random() * 2,
        color: Math.random() < 0.5 ? '#ffd76a' : '#ffe9a8', fade: true,
      });
    }
  },
});

// 鷹隼鷹擊（自動連擊）：俯衝羽影 + 逐段命中衝擊波（連續衝擊感）
registerVfx('falconer_swoop', {
  // 從鳥獵掠向目標的快速羽影（type:'dash' → onCast）
  onCast(ctx, f, c) {
    cone(ctx, c, f.facing, { color: ['#ffd76a', '#ffe9a8'], count: 10, speed: 420, spread: 0.22, up: 12, life: 0.22, offset: 8 });
  },
  // 目標處鷹擊命中（type:'hit' → onHit）；f.width 帶入第幾段（0=俯衝主擊）。
  // 老鷹本體已由模型飛出俯衝（models.js），這裡只負責逐段「利爪命中」的衝擊波與火花。
  onHit(ctx, f, c) {
    const big = !f.width; // 第一段（俯衝主擊）最大；後續段數多、特效放輕避免雜亂。
    ctx.sceneMgr.addShake(big ? 4 : 1);
    sphereFlash(ctx, c, { color: '#ffd76a', from: big ? 4 : 2, to: big ? 32 : 16, life: big ? 0.2 : 0.14, alpha: 0.9 });
    if (big) ring(ctx, c, { color: '#ffe9a8', from: 8, to: 52, life: 0.3, y: 5, alpha: 0.9, ease: true });
    burst(ctx, c, { color: ['#e0a82e', '#ffe9a8', '#ffffff'], count: big ? 16 : 5, speed: big ? 240 : 150, up: big ? 36 : 24, life: big ? 0.42 : 0.3 });
  },
});

// 普攻：連珠快矢
registerVfx('falconer_arrow', {
  projectile(ctx, pr) { return makeArrow(ctx, pr, '#f5c542', '#ffe9a8'); },
  onHit(ctx, f, c) {
    sphereFlash(ctx, c, { color: '#ffd76a', from: 2, to: 16, life: 0.16, alpha: 0.8 });
  },
});

// 技能1：鷹隼俯衝 — 落地金色衝擊環 + 羽爆
registerVfx('falconer_dive', {
  onCast(ctx, f, c) {
    ctx.sceneMgr.addShake(5);
    ctx.sceneMgr.addFlash(0.12, '#ffd76a');
    ring(ctx, c, { color: '#ffd76a', from: 8, to: 130, life: 0.5, y: 3, ease: true });
    ring(ctx, c, { color: '#ffffff', from: 4, to: 70, life: 0.3, y: 8, alpha: 0.85 });
    cone(ctx, c, f.facing, { color: ['#ffd76a', '#ffffff'], count: 22, speed: 320, spread: 0.7, up: 36, life: 0.4 });
    burst(ctx, c, { color: ['#e0a82e', '#ffe9a8'], count: 16, speed: 220, up: 80, life: 0.5 });
  },
});

// 技能2：鷹眼凝視 — 升起的金色瞄準雙環（必爆窗口）
registerVfx('falconer_eagleeye', {
  onCast(ctx, f, c) {
    ctx.sceneMgr.addFlash(0.1, '#ffe9a8');
    ring(ctx, c, { color: '#ffe9a8', from: 6, to: 56, life: 0.5, y: 16, alpha: 0.9 });
    ring(ctx, c, { color: '#ffd34d', from: 4, to: 40, life: 0.6, y: 26, alpha: 0.8 });
    burst(ctx, c, { color: ['#ffd34d', '#ffffff'], count: 14, speed: 140, up: 60, life: 0.6 });
  },
});

// 技能1：風之步 — 全隊加速，清風綠光擴散環 + 上揚風羽
registerVfx('falconer_windstep', {
  onCast(ctx, f, c) {
    ctx.sceneMgr.addFlash(0.1, '#aef5d0');
    ring(ctx, c, { color: '#aef5d0', from: 8, to: 340, life: 0.6, y: 3, ease: true, alpha: 0.7 });
    ring(ctx, c, { color: '#ffffff', from: 6, to: 90, life: 0.4, y: 8, alpha: 0.85 });
    cone(ctx, c, f.facing, { color: ['#aef5d0', '#ffffff'], count: 18, speed: 280, spread: 1.2, up: 50, life: 0.55 });
    burst(ctx, c, { color: ['#aef5d0', '#d6fff0'], count: 14, speed: 160, up: 70, life: 0.6 });
  },
});

// 大招：鷹擊風暴 — 施放瞬間的大招級金色爆發（四環＋爆閃＋雙衝天光柱＋漫天金羽）。
// 之後 3.4 秒由鷹「連續來回俯衝」(falcon.ts) ＋ falconer_storm 持續氛圍營造風暴感。
registerVfx('falconer_ultimate', {
  onCast(ctx, f, c) {
    ultimateBurst(ctx, c, { color: '#ffd76a', radius: 175, pillarH: 200, count: 44, shake: 20, flash: 0.34 });
    // 朝前噴發的金羽風暴
    cone(ctx, c, f.facing, { color: ['#ffd76a', '#ffe9a8', '#ffffff'], count: 40, speed: 420, spread: 1.1, up: 60, life: 0.6 });
    column(ctx, c, { color: ['#ffd76a', '#fff3c9'], count: 40, radius: 70, speed: 230, life: 1.1, size: 5 });
  },
});

// 一隻俯衝的幻影鷹（半透明金色剪影，自高空斜衝向中心後淡出）。純 VFX。
function spawnGhostEagle(ctx, c) {
  const THREE = ctx.THREE;
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffe39a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false });
  const body = new THREE.Mesh(new THREE.ConeGeometry(2.6, 15, 5), mat); // 朝 +X
  body.rotation.z = -Math.PI / 2; g.add(body);
  for (const sz of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), mat);
    wing.position.set(-2, 0, sz * 6); wing.rotation.x = Math.PI / 2; wing.rotation.z = sz * 0.4; g.add(wing);
  }
  const a = Math.random() * Math.PI * 2;
  const R = 140 + Math.random() * 40, H = 60 + Math.random() * 30;
  const sx = c.x + Math.cos(a) * R, sz0 = c.z + Math.sin(a) * R;
  const ex = c.x + (Math.random() - 0.5) * 40, ez = c.z + (Math.random() - 0.5) * 40;
  ctx.addTransient(g, 0.5 + Math.random() * 0.15, (m, t) => {
    m.position.set(sx + (ex - sx) * t, H + (8 - H) * t, sz0 + (ez - sz0) * t); // 自高空斜衝向中心
    m.rotation.y = Math.atan2(-(ez - sz0), ex - sx);
    m.rotation.z = -0.5 - t * 0.3;
    mat.opacity = (t < 0.35 ? t / 0.35 : (1 - t) / 0.65) * 0.55; // 淡入淡出
    const s = 1 + t * 0.5; m.scale.set(s, s, s);
  });
}

// 鷹擊風暴持續氛圍：風暴期間每隔約 0.16s 由 falcon.ts 在玩家腳下放一次脈衝，
// 形成擴張金環 + 旋繞上升的金羽漩渦 + 不斷俯衝的幻影鷹群，讀作「鷹群風暴」的持續壓迫感。
registerVfx('falconer_storm', {
  onHit(ctx, f, c) {
    ring(ctx, c, { color: '#ffd76a', from: 28, to: 130, life: 0.5, y: 3, alpha: 0.45, ease: true, inner: 0.9 });
    ring(ctx, c, { color: '#fff3c9', from: 16, to: 80, life: 0.36, y: 6, alpha: 0.4 });
    // 旋繞上升的金羽漩渦
    const n = 12, r = 58;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
      const tx = Math.cos(a), tz = Math.sin(a);
      ctx.particles.spawn({
        x: c.x + tx * r, y: 4, z: c.z + tz * r,
        vx: -tz * 130, vy: 55 + Math.random() * 55, vz: tx * 130, // 切線速度 → 旋繞 + 上升
        drag: 1.4, gravity: -25, life: 0.6 + Math.random() * 0.3, size: 4 + Math.random() * 3,
        color: Math.random() < 0.5 ? '#ffd76a' : '#ffe9a8', fade: true,
      });
    }
    // 俯衝的幻影鷹群（每次脈衝 1～2 隻，疊起來像滿天鷹影）
    spawnGhostEagle(ctx, c);
    if (Math.random() < 0.6) spawnGhostEagle(ctx, c);
  },
});
