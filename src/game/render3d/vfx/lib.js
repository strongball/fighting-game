// 角色特效共用工具庫 (場景座標)。
// 所有函式吃 ctx = { THREE, scene, particles, sceneMgr, addTransient } 與已轉好的場景座標 c={x,y,z}。
// 透過 ctx.addTransient(mesh, maxLife, update(mesh, t)) 產生短生命期發光網格 (t:0->1)。
// 透過 ctx.particles.spawn({...}) 產生 GPU 粒子。

import * as THREE from 'three';

// 以世界 facing 角度求場景平面前進向量 (X=cos, Z=sin)
export function dirFromFacing(f) { return { x: Math.cos(f), z: Math.sin(f) }; }

// 放射狀粒子爆發 (粒子數提升，視覺更飽滿)
export function burst(ctx, c, opt = {}) {
  const n = Math.round((opt.count || 20) * 2.5);
  const speed = opt.speed || 160;
  const up = opt.up || 0;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const el = (Math.random() * 0.5 + (opt.flat ? 0 : 0.1));
    const spd = speed * (0.45 + Math.random());
    ctx.particles.spawn({
      x: c.x, y: c.y, z: c.z,
      vx: Math.cos(a) * spd, vy: up + spd * el * (opt.flat ? 0 : 1), vz: Math.sin(a) * spd,
      gravity: opt.gravity ?? 220, drag: opt.drag ?? 2.2,
      life: (opt.life || 0.55) * (0.6 + Math.random() * 0.6),
      size: opt.size || (3.5 + Math.random() * 4.5),
      color: pick(opt.color), fade: opt.fade !== false,
    });
  }
}

// 前向錐狀噴發 (近戰/拳擊/火花 - 粒子量與發散感大幅提升)
export function cone(ctx, c, facing, opt = {}) {
  const d = dirFromFacing(facing);
  const base = Math.atan2(d.z, d.x);
  const spread = opt.spread ?? 0.7;
  const n = Math.round((opt.count || 16) * 2.8);
  const speed = (opt.speed || 240) * 1.15;
  for (let i = 0; i < n; i++) {
    const a = base + (Math.random() * 2 - 1) * spread;
    const spd = speed * (0.5 + Math.random());
    ctx.particles.spawn({
      x: c.x + d.x * (opt.offset || 0), y: c.y + (opt.rise || 0), z: c.z + d.z * (opt.offset || 0),
      vx: Math.cos(a) * spd, vy: (opt.up || 0) + (Math.random() * 2 - 1) * (opt.vspread || 40),
      vz: Math.sin(a) * spd,
      gravity: opt.gravity ?? 160, drag: opt.drag ?? 2.4,
      life: (opt.life || 0.45) * (0.6 + Math.random() * 0.7),
      size: opt.size || (3.0 + Math.random() * 4.0), color: pick(opt.color), fade: opt.fade !== false,
    });
  }
}

// 上升柱狀粒子 (治療/血怒/光柱 - 密集上升星辰)
export function column(ctx, c, opt = {}) {
  const n = Math.round((opt.count || 24) * 2.8), r = opt.radius || 26;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, rr = Math.random() * r;
    ctx.particles.spawn({
      x: c.x + Math.cos(a) * rr, y: opt.y0 ?? 0, z: c.z + Math.sin(a) * rr,
      vx: 0, vy: (opt.speed || 130) * (0.75 + Math.random() * 0.95), vz: 0,
      gravity: opt.gravity ?? -20, drag: opt.drag ?? 0.6,
      life: (opt.life || 0.7) * (0.6 + Math.random() * 0.6),
      size: opt.size || 3.5, color: pick(opt.color), fade: opt.fade !== false,
    });
  }
}

// 平鋪地面的擴張環
export function ring(ctx, c, opt = {}) {
  const color = new THREE.Color(pick(opt.color) || '#ffffff');
  const inner = opt.inner ?? 0.78;
  const geo = new THREE.RingGeometry(inner, 1, opt.seg || 48);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(c.x, opt.y ?? 2, c.z);
  const from = opt.from ?? 8, to = opt.to ?? 80;
  ctx.addTransient(m, opt.life || 0.4, (mesh, t) => {
    const r = from + (to - from) * (opt.ease ? 1 - (1 - t) * (1 - t) : t);
    mesh.scale.setScalar(r);
    mesh.material.opacity = (1 - t) * (opt.alpha ?? 0.9);
  });
  m.userData.mat = m.material; m.userData.geo = geo;
}

// 朝天/垂直的擴張環 (球面衝擊感)，繞 X 軸或面向相機
export function sphereFlash(ctx, c, opt = {}) {
  const color = new THREE.Color(pick(opt.color) || '#ffffff');
  const geo = new THREE.IcosahedronGeometry(1, opt.detail ?? 2);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: opt.alpha ?? 0.9, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  m.position.set(c.x, c.y, c.z);
  const from = opt.from ?? 4, to = opt.to ?? 40;
  ctx.addTransient(m, opt.life || 0.22, (mesh, t) => {
    mesh.scale.setScalar(from + (to - from) * t);
    mesh.material.opacity = (1 - t) * (opt.alpha ?? 0.9);
  });
  m.userData.mat = m.material; m.userData.geo = geo;
}

// 垂直光柱
export function pillar(ctx, c, opt = {}) {
  const color = new THREE.Color(pick(opt.color) || '#ffffff');
  const geo = new THREE.CylinderGeometry(opt.r ?? 14, (opt.r ?? 14) * (opt.taper ?? 0.6), opt.h ?? 120, 16, 1, true);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: opt.alpha ?? 0.7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }));
  m.position.set(c.x, (opt.h ?? 120) / 2, c.z);
  ctx.addTransient(m, opt.life || 0.45, (mesh, t) => {
    mesh.material.opacity = (1 - t) * (opt.alpha ?? 0.7);
    mesh.scale.x = mesh.scale.z = 1 + t * (opt.grow ?? 0.4);
  });
  m.userData.mat = m.material; m.userData.geo = geo;
}

// 弧形月牙斬擊 (扇形面，沿 facing 劃過，並在斬擊軌跡上釋放大量發光火星)
export function slashBlade(ctx, c, facing, opt = {}) {
  const color = new THREE.Color(pick(opt.color) || '#ffffff');
  const len = opt.len || 80;
  const swingArc = Math.abs(opt.swing) || 1.35;
  const swingDir = opt.swing < 0 ? -1 : 1;
  const life = opt.life || 0.28;

  // 使用 RingGeometry 繪製完美的月牙弧形斬擊面
  const geo = new THREE.RingGeometry(len * 0.4, len * 1.05, 32, 1, -swingArc / 2, swingArc);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.98, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
  }));
  m.rotation.x = -Math.PI / 2; // 水平躺在地面上

  const g = new THREE.Group();
  g.position.set(c.x, opt.y ?? (c.y ?? 18), c.z);
  g.rotation.y = -facing;
  g.add(m);

  // 漸變淡出與扇形展開動畫
  ctx.addTransient(g, life, (grp, t) => {
    // 隨時間稍微外擴並淡出
    const scale = 0.82 + 0.38 * t;
    m.scale.set(scale, scale, 1);
    m.material.opacity = (1 - t) * (opt.alpha ?? 0.95);
    // 隨揮動方向旋轉
    grp.rotation.y = -facing + (swingDir * swingArc * 0.3 * (t - 0.5));
  });

  // 伴隨斬擊，在軌跡上產生一整排亮眼的噴射火星，讓刀光極其明顯
  const sparkCount = Math.round((opt.sparkCount || 15) * 1.5);
  for (let i = 0; i < sparkCount; i++) {
    const ratio = i / (sparkCount - 1);
    // 沿著扇形弧度均勻分佈火星
    const angle = -facing + (ratio - 0.5) * swingArc * swingDir;
    const dist = len * (0.45 + Math.random() * 0.55);
    const px = c.x + Math.cos(angle) * dist;
    const pz = c.z + Math.sin(angle) * dist;
    
    ctx.particles.spawn({
      x: px, y: opt.y ?? (c.y ?? 18), z: pz,
      vx: Math.cos(angle) * 180 + (Math.random() - 0.5) * 60,
      vy: 12 + Math.random() * 90,
      vz: Math.sin(angle) * 180 + (Math.random() - 0.5) * 60,
      gravity: 120, drag: 2.0,
      life: 0.35 + Math.random() * 0.3,
      size: 3.2 + Math.random() * 3.5,
      color: [color, '#ffffff'],
      fade: true
    });
  }

  g.userData.mat = m.material; g.userData.geo = geo;
}

// 旋轉飛行的薄片 (手裏劍/碟)
export function makeSpinPlate(THREE3, color, r) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xdfe6ec, emissive: new THREE.Color(color), emissiveIntensity: 1.4, metalness: 0.8, roughness: 0.3, side: THREE.DoubleSide });
  const star = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.3, 4, 8), mat);
  g.add(star);
  return g;
}

export function addShake(ctx, m) { ctx.sceneMgr.addShake(m); }
export function addFlash(ctx, a, color) { ctx.sceneMgr.addFlash(a, color); }

// 大招通用爆發底：多層擴張環 + 雙重中心球 + 衝天巨型雙光柱 + 極為密集的上升流星 + 大範圍地裂火花
export function ultimateBurst(ctx, c, opt = {}) {
  const color = opt.color || '#ffffff';
  const R = opt.radius || 150;
  // 四層地表衝擊環，極限張力
  ring(ctx, c, { color, from: 16, to: R, life: 0.65, y: 4, alpha: 0.95, ease: true });
  ring(ctx, c, { color: '#ffffff', from: 8, to: R * 0.6, life: 0.48, y: 7, alpha: 0.85 });
  ring(ctx, c, { color: '#ffffff', from: 4, to: R * 0.85, life: 0.4, y: 8, alpha: 0.9 });
  ring(ctx, c, { color, from: R * 0.4, to: R * 1.5, life: 0.78, y: 3, alpha: 0.55, inner: 0.94, ease: true });
  
  // 雙重發光爆閃球
  sphereFlash(ctx, c, { color: '#ffffff', from: 8, to: R * 0.38, life: 0.28, alpha: 0.95, detail: 2 });
  sphereFlash(ctx, c, { color, from: 6, to: R * 0.6, life: 0.38, alpha: 0.65 });
  
  // 衝天雙光柱
  if (opt.pillar !== false) {
    pillar(ctx, c, { color, h: opt.pillarH || 170, r: opt.pillarR || 30, taper: 0.35, life: 0.65, alpha: 0.65, grow: 0.6 });
    pillar(ctx, c, { color: '#ffffff', h: (opt.pillarH || 170) * 1.05, r: (opt.pillarR || 30) * 0.45, taper: 0.2, life: 0.52, alpha: 0.55, grow: 0.3 });
  }
  // 漫天密集上升星屑 (count * 2.8 倍) + 地表猛烈擴散能量火星
  column(ctx, c, { color: [color, '#ffffff'], count: Math.round((opt.count || 40) * 2.8), radius: R * 0.48, speed: 250, life: 1.05, size: 5 });
  burst(ctx, c, { color: [color, '#ffffff'], count: 45, speed: 240, up: 50, flat: true, life: 0.55, size: 4.5 });
  
  ctx.sceneMgr.addShake(opt.shake ?? 22);
  ctx.sceneMgr.addFlash(opt.flash ?? 0.38, color);
}

// 根據發招點 c，搜尋場景中距離小於 15 的玩家模型，取得正/反手揮砍方向 (正手=1.0, 反手=-1.0)
export function getSwingDir(ctx, c) {
  let isBackhand = false;
  ctx.scene.traverse((obj) => {
    if (obj.userData && obj.userData.parts && Math.hypot(obj.position.x - c.x, obj.position.z - c.z) < 15) {
      if (obj.userData.swingCount && obj.userData.swingCount % 2 === 0) {
        isBackhand = true;
      }
    }
  });
  return isBackhand ? -1.0 : 1.0;
}

function pick(c) {
  if (Array.isArray(c)) return c[(Math.random() * c.length) | 0];
  return c || '#ffffff';
}
