// Boss 20% 鎖血奧義：一次性爆發 + 持續金紅氣焰。
// 僅保存本地視覺狀態，不修改 simulation snapshot。

import * as THREE from 'three';
import { sceneX, sceneZ } from './coords.js';

const GOLD = 0xffb52e;
const HOT = 0xff4d28;
const PALE = 0xfff1b0;
const CYAN = 0x83f4ff;

function additive(color, opacity, side = THREE.DoubleSide) {
  return new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, side,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
}

function disposeObject(root) {
  root.traverse((o) => {
    o.geometry?.dispose();
    if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
    else o.material?.dispose();
  });
}

export function createBossUltimateAura({ scene, particles, sceneMgr }) {
  const entries = new Map();
  const transients = [];
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:absolute;inset:0;z-index:4;pointer-events:none;opacity:0;' +
    'background:radial-gradient(circle at 50% 48%,rgba(255,112,32,.06) 0%,rgba(33,5,0,.13) 57%,rgba(0,0,0,.46) 100%);' +
    'box-shadow:inset 0 0 110px rgba(255,54,18,.22);mix-blend-mode:multiply;will-change:opacity;';
  sceneMgr.stage.appendChild(overlay);

  function buildEntry(p) {
    const scale = Math.max(0.8, p.scale || 1);
    const radius = 34 * scale;
    const height = 150 * scale;
    const group = new THREE.Group();
    group.renderOrder = 8;

    // 三層倒錐形成清楚的白熱核心與外焰輪廓，遠鏡頭下仍可辨識。
    const outerMat = additive(HOT, 0.18);
    const outer = new THREE.Mesh(new THREE.ConeGeometry(radius * 1.75, height, 20, 1, true), outerMat);
    outer.position.y = height * 0.5;
    group.add(outer);

    const flameMat = additive(GOLD, 0.30);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(radius * 1.18, height * 0.88, 18, 1, true), flameMat);
    flame.position.y = height * 0.44;
    flame.rotation.y = Math.PI / 18;
    group.add(flame);

    const coreMat = additive(PALE, 0.38);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.27, radius * 0.72, height * 0.72, 16, 1, true), coreMat);
    core.position.y = height * 0.36;
    group.add(core);

    const groundMat = additive(HOT, 0.26);
    const ground = new THREE.Mesh(new THREE.RingGeometry(radius * 0.7, radius * 3.7, 64), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 1.5;
    group.add(ground);

    const rings = [];
    for (let i = 0; i < 3; i++) {
      const mat = additive(i === 1 ? PALE : GOLD, 0.68);
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, 1.7 * scale, 6, 48), mat);
      mesh.rotation.x = Math.PI / 2;
      group.add(mesh);
      rings.push(mesh);
    }

    // 地面放射線讓力量看起來影響整個場地，而不是只黏在角色身上。
    const rays = new THREE.Group();
    const rayMat = additive(GOLD, 0.28);
    for (let i = 0; i < 12; i++) {
      const len = radius * (3.0 + (i % 3) * 0.8);
      const ray = new THREE.Mesh(new THREE.PlaneGeometry(len, 2.2 * scale), rayMat);
      ray.rotation.x = -Math.PI / 2;
      ray.rotation.z = i * Math.PI / 6;
      ray.position.set(Math.cos(i * Math.PI / 6) * len * 0.5, 1.1, Math.sin(i * Math.PI / 6) * len * 0.5);
      rays.add(ray);
    }
    group.add(rays);

    const lightning = new THREE.Group();
    group.add(lightning);
    const light = new THREE.PointLight(GOLD, 4.2, radius * 6, 2);
    light.position.y = height * 0.42;
    group.add(light);
    scene.add(group);

    return {
      group, outer, flame, core, ground, rings, rays, lightning, light,
      radius, height, scale, age: 0, emitAcc: 0, boltAcc: 0, shakeAcc: 0,
    };
  }

  function rebuildLightning(e) {
    disposeObject(e.lightning);
    e.lightning.clear();
    const boltCount = 2 + Math.floor(Math.random() * 2);
    for (let b = 0; b < boltCount; b++) {
      const points = [];
      const angle = Math.random() * Math.PI * 2;
      const reach = e.radius * (1.5 + Math.random() * 1.7);
      const segments = 6;
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const jitter = (Math.random() - 0.5) * e.radius * 0.75;
        points.push(new THREE.Vector3(
          Math.cos(angle) * reach * t + Math.cos(angle + Math.PI / 2) * jitter,
          e.height * (0.16 + t * 0.68),
          Math.sin(angle) * reach * t + Math.sin(angle + Math.PI / 2) * jitter,
        ));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const mat = new THREE.LineBasicMaterial({
        color: Math.random() < 0.7 ? CYAN : PALE,
        transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false,
      });
      e.lightning.add(new THREE.Line(geo, mat));
    }
  }

  function addShockwave(x, z, radius, color, delay = 0) {
    const mat = additive(color, 0.95);
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 72), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 3, z);
    scene.add(mesh);
    transients.push({ mesh, mat, age: -delay, life: 0.62, radius });
  }

  function burst(e) {
    addShockwave(e.group.position.x, e.group.position.z, e.radius * 8.5, PALE);
    addShockwave(e.group.position.x, e.group.position.z, e.radius * 12, HOT, 0.09);
    sceneMgr.addFlash(0.72, '#fff3c4');
    sceneMgr.addShake(34);
    // 爆發粒子有固定上限，不隨螢幕更新率增加。
    for (let i = 0; i < 100; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 150 + Math.random() * 360;
      particles.spawn({
        x: e.group.position.x, y: 6 + Math.random() * e.height * 0.65, z: e.group.position.z,
        vx: Math.cos(a) * speed, vy: 90 + Math.random() * 260, vz: Math.sin(a) * speed,
        gravity: 190, drag: 1.5, life: 0.45 + Math.random() * 0.45,
        size: 7 + Math.random() * 12,
        color: i % 4 === 0 ? '#ffffff' : i % 3 === 0 ? '#ff512d' : '#ffc247', fade: true,
      });
    }
  }

  function spawnFlowParticle(e) {
    const a = Math.random() * Math.PI * 2;
    const rr = e.radius * (0.25 + Math.random() * 1.35);
    particles.spawn({
      x: e.group.position.x + Math.cos(a) * rr,
      y: Math.random() * e.height * 0.38,
      z: e.group.position.z + Math.sin(a) * rr,
      vx: Math.cos(a) * (18 + Math.random() * 40),
      vy: 115 + Math.random() * 190,
      vz: Math.sin(a) * (18 + Math.random() * 40),
      gravity: -26, drag: 1.0, life: 0.42 + Math.random() * 0.42,
      size: 6 + Math.random() * 12,
      color: Math.random() < 0.18 ? '#ffffff' : Math.random() < 0.36 ? '#ff5533' : '#ffc247', fade: true,
    });
  }

  function updateEntry(e, p, dt) {
    e.age += dt;
    e.group.position.set(sceneX(p.x), 0, sceneZ(p.y));
    const pulse = 0.5 + 0.5 * Math.sin(e.age * 10);
    e.outer.scale.set(0.92 + pulse * 0.16, 0.96 + pulse * 0.08, 0.92 + pulse * 0.16);
    e.flame.scale.set(1.06 - pulse * 0.12, 0.94 + pulse * 0.14, 1.06 - pulse * 0.12);
    e.outer.rotation.y -= dt * 0.7;
    e.flame.rotation.y += dt * 1.2;
    e.core.material.opacity = 0.27 + pulse * 0.18;
    e.ground.material.opacity = 0.16 + pulse * 0.12;
    e.rays.rotation.y += dt * 0.24;
    e.rays.children[0].material.opacity = 0.18 + pulse * 0.13;
    e.light.intensity = 3.4 + pulse * 2.2;

    for (let i = 0; i < e.rings.length; i++) {
      const phase = (e.age * 0.72 + i / e.rings.length) % 1;
      const ring = e.rings[i];
      ring.position.y = 5 + phase * e.height * 0.8;
      ring.scale.setScalar(0.45 + phase * 1.9);
      ring.material.opacity = Math.sin(phase * Math.PI) * 0.65;
      ring.rotation.z = e.age * (i % 2 ? -0.4 : 0.4);
    }

    e.emitAcc += dt * 145;
    const available = Math.max(0, Math.floor(particles.capacity * 0.82 - particles.count));
    const emit = Math.min(Math.floor(e.emitAcc), available, 14);
    e.emitAcc -= emit;
    for (let i = 0; i < emit; i++) spawnFlowParticle(e);

    e.boltAcc -= dt;
    if (e.boltAcc <= 0) {
      rebuildLightning(e);
      e.boltAcc = 0.08 + Math.random() * 0.12;
    }

    // 低頻重拍取代逐幀累加震動，保留壓迫感也不影響走位判讀。
    e.shakeAcc -= dt;
    if (e.shakeAcc <= 0) {
      sceneMgr.addShake(5.5);
      e.shakeAcc = 0.28;
    }
  }

  function removeEntry(id) {
    const e = entries.get(id);
    if (!e) return;
    scene.remove(e.group);
    disposeObject(e.group);
    entries.delete(id);
  }

  function sync(players, dt) {
    const active = new Set();
    for (const p of Object.values(players || {})) {
      if (!p.isBoss || !p.alive || !p.ultLockInvincible) continue;
      active.add(p.id);
      let e = entries.get(p.id);
      if (!e) {
        e = buildEntry(p);
        e.group.position.set(sceneX(p.x), 0, sceneZ(p.y));
        entries.set(p.id, e);
        burst(e);
      }
      updateEntry(e, p, dt);
    }
    for (const id of [...entries.keys()]) if (!active.has(id)) removeEntry(id);

    for (let i = transients.length - 1; i >= 0; i--) {
      const tr = transients[i];
      tr.age += dt;
      if (tr.age < 0) { tr.mesh.visible = false; continue; }
      tr.mesh.visible = true;
      const t = Math.min(1, tr.age / tr.life);
      tr.mesh.scale.setScalar(tr.radius * (0.08 + 0.92 * (1 - Math.pow(1 - t, 3))));
      tr.mat.opacity = (1 - t) * 0.92;
      if (t >= 1) {
        scene.remove(tr.mesh);
        tr.mesh.geometry.dispose(); tr.mat.dispose();
        transients.splice(i, 1);
      }
    }

    overlay.style.opacity = entries.size ? '0.68' : '0';
  }

  function dispose() {
    for (const id of [...entries.keys()]) removeEntry(id);
    for (const tr of transients) {
      scene.remove(tr.mesh); tr.mesh.geometry.dispose(); tr.mat.dispose();
    }
    transients.length = 0;
    overlay.remove();
  }

  return { sync, dispose };
}
