// 特效匯流排：讀 state.fx，以 fx.id 去重觸發一次性效果(粒子/震動/閃光)
// 並產生短生命期的發光網格(揮砍弧/命中環/瞬步環…)，以本地 age 推進動畫(與 snapshot 頻率脫鉤)。

import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { setVecFromWorld, PROJECTILE_Y } from './coords.js';
import { getVfx } from './vfx/index.ts';
import { ultimateBurst } from './vfx/lib.js';
import { getSfxManager } from '../../utils/sfxManager';

export function createFxBus({ scene, particles, sceneMgr }) {
  let seen = new Set();
  const sfx = getSfxManager();
  const transients = []; // { mesh, age, maxLife, update }
  const floats = []; // { obj, root, age, maxLife, update }
  const _v = new THREE.Vector3();

  // ---- 預警地面 decal：依形狀畫圓 / 線 / 扇形；脈動透明度隨 progress 加深 ----
  function renderTelegraph(c, f) {
    const progress = f.progress || 0;
    const baseOpacity = 0.32 + 0.45 * progress;       // 越接近觸發越深
    const life = f.life || 0.32;
    const shape = f.shape || 'circle';

    if (shape === 'arc') {
      const arc = f.arc || 1.4;
      const range = f.range || f.radius || 100;
      const inner = 0;
      const geo = new THREE.RingGeometry(inner, 1, 32, 1, -arc / 2, arc);
      
      const mBg = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: f.color, transparent: true, opacity: baseOpacity * 0.25, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
      }));
      mBg.rotation.x = -Math.PI / 2;
      mBg.scale.setScalar(range);

      const mFill = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: f.color, transparent: true, opacity: baseOpacity * 0.65 * progress, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
      }));
      mFill.rotation.x = -Math.PI / 2;
      mFill.position.y = -0.1;
      mFill.scale.setScalar(range * progress);

      const g = new THREE.Group();
      g.position.set(c.x, 2, c.z);
      g.rotation.y = -(f.facing || 0);
      g.add(mBg);
      g.add(mFill);

      addTransient(g, life, (group, t) => {
        mBg.material.opacity = baseOpacity * 0.25 * (1 - t);
        mFill.material.opacity = baseOpacity * 0.65 * progress * (1 - t);
      });
      g.userData.geo = geo;
      g.userData.mat = mBg.material;
      g.userData.mat2 = mFill.material;
    } else if (shape === 'line') {
      const range = f.range || 320;
      const width = (f.radius || 40) * 2;
      const geo = new THREE.PlaneGeometry(1, 1);
      
      const mBg = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: f.color, transparent: true, opacity: baseOpacity * 0.25, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
      }));
      mBg.rotation.x = -Math.PI / 2;
      mBg.scale.set(range, width, 1);
      mBg.position.x = range / 2;

      const mFill = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: f.color, transparent: true, opacity: baseOpacity * 0.65 * progress, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
      }));
      mFill.rotation.x = -Math.PI / 2;
      mFill.position.y = -0.1;
      mFill.scale.set(range * progress, width * 0.95, 1);
      mFill.position.x = (range * progress) / 2;

      const g = new THREE.Group();
      g.position.set(c.x, 2, c.z);
      g.rotation.y = -(f.facing || 0);
      g.add(mBg);
      g.add(mFill);

      addTransient(g, life, (group, t) => {
        mBg.material.opacity = baseOpacity * 0.25 * (1 - t);
        mFill.material.opacity = baseOpacity * 0.65 * progress * (1 - t);
      });
      g.userData.geo = geo;
      g.userData.mat = mBg.material;
      g.userData.mat2 = mFill.material;
    } else {
      // circle / self
      const r = f.radius || 80;
      const g = new THREE.Group();
      g.position.set(c.x, 2, c.z);

      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
        color: f.color, transparent: true, opacity: baseOpacity * 0.4, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
      }));
      m.rotation.x = -Math.PI / 2;
      m.scale.setScalar(r);
      g.add(m);

      const diskGeo = new THREE.CircleGeometry(1, 32);
      const mFill = new THREE.Mesh(diskGeo, new THREE.MeshBasicMaterial({
        color: f.color, transparent: true, opacity: baseOpacity * 0.45 * progress, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
      }));
      mFill.rotation.x = -Math.PI / 2;
      mFill.position.y = -0.2;
      mFill.scale.setScalar(r * progress);
      g.add(mFill);

      addTransient(g, life, (group, t) => {
        m.material.opacity = baseOpacity * 0.4 * (1 - t);
        mFill.material.opacity = baseOpacity * 0.45 * progress * (1 - t);
        m.scale.setScalar(r * (1 + 0.05 * Math.sin(t * 10)));
      });
      g.userData.geo = diskGeo;
      g.userData.mat = m.material;
      g.userData.mat2 = mFill.material;
    }
  }

  function addFloatingText(c, text, color, opts = {}) {
    const root = document.createElement('div');
    root.style.cssText = 'pointer-events:none;will-change:transform,opacity;';
    const inner = document.createElement('div');
    inner.textContent = text;
    inner.style.cssText = `color:${color};font-weight:900;` +
      `font-family:system-ui,"PingFang TC","Noto Sans CJK TC",sans-serif;` +
      `font-size:${opts.size || 22}px;white-space:nowrap;` +
      `text-shadow:0 0 10px ${color},0 2px 0 #000,0 -1px 0 #000,2px 0 0 #000,-2px 0 0 #000;` +
      `transform-origin:50% 50%;will-change:transform;`;
    if (opts.bg) {
      inner.style.padding = '4px 14px';
      inner.style.background = 'rgba(0,0,0,0.55)';
      inner.style.borderRadius = '4px';
      inner.style.border = `2px solid ${color}`;
      inner.style.boxShadow = `0 0 18px ${color}`;
    }
    root.appendChild(inner);
    const obj = new CSS2DObject(root);
    const jx = opts.jitter ? (Math.random() - 0.5) * 30 : 0;
    obj.position.set(c.x + jx, c.y + (opts.startY || 50), c.z);
    scene.add(obj);
    const dy = opts.riseY || 60;
    const maxLife = opts.life || 0.85;
    floats.push({
      obj, root, inner, age: 0, maxLife,
      update: (o, t) => {
        const p = 1 - t;
        o.position.y = c.y + (opts.startY || 50) + p * dy;
        const fadeIn = t < 0.2 ? t / 0.2 : 1;
        const fadeOut = p < 0.35 ? p / 0.35 : 1;
        root.style.opacity = String(Math.min(fadeIn, fadeOut));
        const scaleIn = Math.min(1, t * 5 + 0.5);
        const punch = opts.punch ? (1 + Math.sin(t * Math.PI) * 0.15) : 1;
        inner.style.transform = `scale(${scaleIn * punch})`;
      },
    });
  }

  const ringGeo = new THREE.RingGeometry(0.7, 1, 48);
  const sphereGeo = new THREE.IcosahedronGeometry(1, 2);

  function addTransient(mesh, maxLife, update) {
    scene.add(mesh);
    transients.push({ mesh, age: 0, maxLife, update });
  }

  function spawnSparks(c, color, n, opt = {}) {
    const speed = opt.speed || 160;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = speed * (0.4 + Math.random());
      particles.spawn({
        x: c.x, y: c.y, z: c.z,
        vx: Math.cos(a) * spd, vy: opt.up ? 80 + Math.random() * 150 : Math.random() * 120 - 20,
        vz: Math.sin(a) * spd,
        gravity: opt.up ? 120 : 260, drag: 2.2,
        life: 0.3 + Math.random() * 0.45, size: opt.size || (3 + Math.random() * 3),
        color, fade: true,
      });
    }
  }

  function spawnDebris(c, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 120 + Math.random() * 240;
      particles.spawn({
        x: c.x, y: c.y + 6, z: c.z,
        vx: Math.cos(a) * spd, vy: 120 + Math.random() * 200, vz: Math.sin(a) * spd,
        gravity: 420, drag: 1.2, life: 0.5 + Math.random() * 0.6,
        size: 3 + Math.random() * 4, color, fade: false,
      });
    }
  }

  function expandRing(c, color, fromR, toR, maxLife, y = PROJECTILE_Y, thick = 0.7) {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(c.x, y, c.z);
    addTransient(m, maxLife, (mesh, t) => {
      const r = fromR + (toR - fromR) * t;
      mesh.scale.setScalar(r);
      mesh.material.opacity = (1 - t) * 0.9;
    });
  }

  function burstFlash(c, color, r, maxLife) {
    const m = new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    m.position.set(c.x, c.y, c.z);
    addTransient(m, maxLife, (mesh, t) => {
      mesh.scale.setScalar(r * (0.4 + t * 0.9));
      mesh.material.opacity = (1 - t) * 0.9;
    });
  }

  function meleeArc(c, facing, range, arc, color, full, maxLife) {
    const inner = full ? range * 0.2 : range * 0.32;
    const geo = new THREE.RingGeometry(inner, range, full ? 64 : 40, 1,
      full ? 0 : -arc / 2, full ? Math.PI * 2 : arc);
    const ring = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));
    ring.rotation.x = -Math.PI / 2;            // 平鋪地面 (sector 中心 = +X)
    // 用群組繞世界 Y 對準 facing：group.rotation.y = -facing 使 +X 指向世界 facing 方向
    const g = new THREE.Group();
    g.position.set(c.x, 20, c.z);
    g.rotation.y = -facing;
    g.add(ring);
    addTransient(g, maxLife, (mesh, t) => {
      mesh.scale.setScalar(0.6 + 0.5 * t);
      ring.material.opacity = (1 - t) * 0.95;
      if (full) mesh.rotation.y = -facing + t * Math.PI * 3;
    });
    g.userData.geo = geo;
    g.userData.mat = ring.material;
  }

  function onSpawn(f) {
    // 角色專屬 vfx 覆寫 (Phase 3)；缺省走通用
    const vfx = getVfx(f.vfx);
    const ctx = { THREE, scene, particles, sceneMgr, addTransient, sceneVec: _v };
    const h = f.type === 'melee' ? 18 : (f.type === 'buff' || f.type === 'ultimate') ? 4 : PROJECTILE_Y;
    setVecFromWorld(_v, f.x, f.y, h);
    const c = { x: _v.x, y: _v.y, z: _v.z };

    // 音效：命中 / 死亡 (撞擊感)；出手/施法/大招音由 renderer syncPlayers 觸發，避免雙重發聲
    if (f.type === 'hit') sfx.play('hit', { x: f.x, y: f.y });
    else if (f.type === 'death') sfx.play('death', { x: f.x, y: f.y });

    switch (f.type) {
      case 'melee': {
        const full = f.arc >= 6;
        if (vfx && vfx.onCast) { vfx.onCast(ctx, f, c); break; }
        meleeArc(c, f.facing, f.range, full ? Math.PI * 2 : f.arc, f.color, full, 0.32);
        spawnSparks(c, f.color, full ? 22 : 8, { speed: full ? 220 : 150, size: 3 });
        if (full) sceneMgr.addShake(7);
        break;
      }
      case 'hit': {
        if (vfx && vfx.onHit) { vfx.onHit(ctx, f, c); break; }
        const R = f.radius || 14;
        expandRing(c, f.color, R * 0.4, R * 1.45, 0.32);
        expandRing(c, '#ffffff', R * 0.2, R * 0.9, 0.22);
        burstFlash(c, f.color, R * 0.75, 0.2);
        spawnSparks(c, f.color, Math.min(28, 10 + R / 6), { speed: 180 + R * 1.4, size: 3 });
        spawnSparks(c, '#ffffff', Math.min(10, 4 + R / 14), { speed: 240 + R * 1.2, size: 2 });
        if (R >= 70) {
          sceneMgr.addShake(16); sceneMgr.addFlash(0.4, f.color);
          spawnDebris(c, f.color, 24);
          spawnSparks(c, '#ffffff', 14, { up: true, speed: 220, size: 3 });
        } else if (R >= 34) {
          sceneMgr.addShake(7); sceneMgr.addFlash(0.18, f.color);
        } else {
          sceneMgr.addShake(2.5);
        }
        break;
      }
      case 'death':
        if (vfx && vfx.onDeath) { vfx.onDeath(ctx, f, c); break; }
        sceneMgr.addShake(18); sceneMgr.addFlash(0.5, '#ffffff');
        expandRing(c, f.color || '#ffffff', 10, (f.radius || 36) * 2.2, 0.5, 16);
        burstFlash(c, '#ffffff', 30, 0.25);
        spawnDebris(c, f.color || '#ffffff', 30);
        spawnSparks(c, '#ffffff', 24, { speed: 280, up: true, size: 3.5 });
        break;
      case 'dash':
        if (vfx && vfx.onCast) { vfx.onCast(ctx, f, c); break; }
        for (let i = 0; i < 16; i++) {
          const back = (f.facing || 0) + Math.PI;
          const sp = 60 + Math.random() * 160;
          particles.spawn({
            x: c.x, y: c.y, z: c.z,
            vx: Math.cos(back) * sp + (Math.random() - 0.5) * 40,
            vy: Math.random() * 60, vz: Math.sin(back) * sp + (Math.random() - 0.5) * 40,
            gravity: 120, drag: 2.5, life: 0.3 + Math.random() * 0.3, size: 3.5, color: f.color, fade: true,
          });
        }
        break;
      case 'blink':
        if (vfx && vfx.onCast) { vfx.onCast(ctx, f, c); break; }
        expandRing(c, f.color, 6, (f.radius || 30) * 1.4, 0.34, 16);
        spawnSparks(c, f.color, 18, { speed: 180, up: true });
        break;
      case 'buff':
        if (vfx && vfx.onCast) { vfx.onCast(ctx, f, c); break; }
        expandRing(c, f.color, 4, (f.radius || 30), 0.5, 2);
        for (let i = 0; i < 22; i++) {
          const a = Math.random() * Math.PI * 2, rr = Math.random() * (f.radius || 28);
          particles.spawn({
            x: c.x + Math.cos(a) * rr, y: 0, z: c.z + Math.sin(a) * rr,
            vx: 0, vy: 90 + Math.random() * 130, vz: 0,
            gravity: -30, drag: 0.6, life: 0.5 + Math.random() * 0.5, size: 3, color: f.color, fade: true,
          });
        }
        break;
      case 'burn': {
        // 燃燒 DoT 每跳：小火舌上竄 + 餘燼 + 地面微焰環 (輕量，因每 0.5s 觸發)
        for (let i = 0; i < 7; i++) {
          const a = Math.random() * Math.PI * 2, rr = Math.random() * (f.radius || 18) * 0.7;
          particles.spawn({
            x: c.x + Math.cos(a) * rr, y: 2, z: c.z + Math.sin(a) * rr,
            vx: (Math.random() - 0.5) * 30, vy: 70 + Math.random() * 120, vz: (Math.random() - 0.5) * 30,
            gravity: -40, drag: 1.4, life: 0.3 + Math.random() * 0.35,
            size: 2.5 + Math.random() * 3, color: Math.random() < 0.5 ? '#ff6b3d' : '#ffcf6b', fade: true,
          });
        }
        burstFlash(c, '#ff7a3d', (f.radius || 18) * 0.5, 0.16);
        break;
      }

      case 'telegraph': {
        renderTelegraph(c, f);
        break;
      }
      case 'popup': {
        const isCrit = f.kind === 'crit';
        const isHeal = f.kind === 'heal';
        const isShield = f.kind === 'shield';
        const color = isCrit ? '#ffd166' : isHeal ? '#5cffa6' : isShield ? '#7ad8ff' : '#ff5050';
        addFloatingText(c, String(f.text), color, {
          size: isCrit ? 30 : (isHeal || isShield ? 20 : 24),
          life: 0.85, riseY: 70, startY: 56, jitter: true, punch: isCrit,
        });
        break;
      }
      case 'skillname': {
        const isUlt = !!f.ultimate;
        addFloatingText(c, String(f.text), f.color || '#ffffff', {
          size: isUlt ? 34 : 24, life: isUlt ? 1.4 : 1.0,
          riseY: 24, startY: 116, punch: isUlt,
        });
        break;
      }

      case 'ultimate': {
        if (f.isBoss) {
          ultimateBurst(ctx, c, {
            color: f.color,
            radius: f.radius || 240,
            count: 80,
            shake: 30,
            flash: 0.55
          });
          break;
        }
        if (vfx && vfx.onCast) { vfx.onCast(ctx, f, c); break; }
        // 通用大招華麗回饗 (無專屬 vfx 時)
        const R = f.radius || 140;
        expandRing(c, f.color, 14, R, 0.55, 4);
        expandRing(c, '#ffffff', 8, R * 0.6, 0.4, 8);
        burstFlash(c, f.color, 46, 0.3);
        for (let i = 0; i < 40; i++) {
          const a = Math.random() * Math.PI * 2, rr = Math.random() * R * 0.8;
          particles.spawn({
            x: c.x + Math.cos(a) * rr, y: 0, z: c.z + Math.sin(a) * rr,
            vx: 0, vy: 140 + Math.random() * 200, vz: 0,
            gravity: -10, drag: 0.6, life: 0.6 + Math.random() * 0.6, size: 4, color: f.color, fade: true,
          });
        }
        sceneMgr.addShake(16); sceneMgr.addFlash(0.32, f.color);
        break;
      }
    }
  }

  function process(state) {
    const cur = new Set();
    for (const f of state.fx) {
      cur.add(f.id);
      if (!seen.has(f.id)) onSpawn(f);
    }
    seen = cur;
  }

  function update(dt) {
    for (let i = transients.length - 1; i >= 0; i--) {
      const tr = transients[i];
      tr.age += dt;
      const t = Math.min(1, tr.age / tr.maxLife);
      tr.update(tr.mesh, t);
      if (tr.age >= tr.maxLife) {
        scene.remove(tr.mesh);
        if (tr.mesh.userData.geo) tr.mesh.userData.geo.dispose();
        if (tr.mesh.userData.mat) tr.mesh.userData.mat.dispose();
        if (tr.mesh.userData.mat2) tr.mesh.userData.mat2.dispose();
        if (tr.mesh.material) tr.mesh.material.dispose();
        transients.splice(i, 1);
      }
    }
    for (let i = floats.length - 1; i >= 0; i--) {
      const fl = floats[i];
      fl.age += dt;
      const t = Math.min(1, fl.age / fl.maxLife);
      fl.update(fl.obj, t);
      if (fl.age >= fl.maxLife) {
        scene.remove(fl.obj);
        if (fl.root.parentNode) fl.root.parentNode.removeChild(fl.root);
        floats.splice(i, 1);
      }
    }
  }

  function clear() {
    for (const tr of transients) {
      scene.remove(tr.mesh);
      if (tr.mesh.userData.geo) tr.mesh.userData.geo.dispose();
      if (tr.mesh.userData.mat) tr.mesh.userData.mat.dispose();
      if (tr.mesh.userData.mat2) tr.mesh.userData.mat2.dispose();
      if (tr.mesh.material) tr.mesh.material.dispose();
    }
    transients.length = 0;
    for (const fl of floats) {
      scene.remove(fl.obj);
      if (fl.root.parentNode) fl.root.parentNode.removeChild(fl.root);
    }
    floats.length = 0;
    seen = new Set();
  }

  return { process, update, clear, addTransient };
}
