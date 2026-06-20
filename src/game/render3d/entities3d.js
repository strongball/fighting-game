// 投射物與地面範圍區的 3D 物件 (依 id 與 state 同步、簡易池化)
//
// 投射物：一般 = 發光球 + 光暈 (+ 拖尾粒子)；穿透 = 沿速度拉長的亮閃電棒。
// 範圍區：地面發光圓盤 + 外環；delay>0 顯示預警環(填充指示)。
// 座標經 coords 轉場景座標；高度用 PROJECTILE_Y。

import * as THREE from 'three';
import { setVecFromWorld, PROJECTILE_Y } from './coords.js';
import { getVfx } from './vfx/index.ts';

export function createEntityLayer(scene, particles, opts = {}) {
  const group = new THREE.Group();
  scene.add(group);
  const addTransient = opts.addTransient || (() => {});
  const sceneMgr = opts.sceneMgr || { addShake() {}, addFlash() {} };

  // 給角色專屬 hook 用的完整 ctx 建構器
  function hookCtx(colorHex) {
    return { THREE, scene, particles, sceneMgr, addTransient, color: new THREE.Color(colorHex) };
  }

  // 共用幾何體
  const sphereGeo = new THREE.IcosahedronGeometry(1, 2);
  const coreGeo = new THREE.IcosahedronGeometry(1, 1);
  const boltGeo = new THREE.CylinderGeometry(1, 1, 1, 8);
  const discGeo = new THREE.CircleGeometry(1, 48);
  const ringGeo = new THREE.RingGeometry(0.84, 1, 48);

  const projMap = new Map(); // id -> { group, core, halo, kind }
  const zoneMap = new Map(); // id -> { group, disc, ring, totalDelay }
  const destMap = new Map(); // id -> { group, body, geo, mat }
  const itemMap = new Map(); // id -> { group, mesh, geo, mat, ... }
  const _v = new THREE.Vector3();

  function syncDestructibles(list, dt, focus) {
    const seen = new Set();
    for (const obj of list || []) {
      seen.add(obj.id);
      let m = destMap.get(obj.id);
      if (!m) {
        const r = obj.r || 28;
        const geo = new THREE.CylinderGeometry(r * 0.85, r, 60, 12);
        const mat = new THREE.MeshStandardMaterial({ color: obj.color, roughness: 0.85, metalness: 0.05, transparent: true, opacity: 1 });
        const body = new THREE.Mesh(geo, mat);
        body.castShadow = true; body.receiveShadow = true;
        body.position.y = 30;
        const g = new THREE.Group();
        g.add(body);
        scene.add(g);
        m = { group: g, body, geo, mat, baseR: r, opacity: 1 };
        destMap.set(obj.id, m);
      }
      setVecFromWorld(_v, obj.x, obj.y, 0);
      m.group.position.x = _v.x; m.group.position.z = _v.z;
      // HP 越低顏色越暗 / 微微傾斜
      const hpRatio = Math.max(0, obj.hp / Math.max(1, obj.maxHp));
      m.mat.color.set(obj.color).multiplyScalar(0.4 + 0.6 * hpRatio);
      m.body.rotation.z = (1 - hpRatio) * 0.2 * Math.sin(performance.now() * 0.004);
      // 阻擋玩家視線時半透明 (focus 是 self player 的 scene 座標)
      let targetOpacity = 1;
      if (focus) {
        const px = focus.x, pz = focus.z;
        // 鏡頭視角下「介於玩家與鏡頭之間」=> 物件比玩家更靠近相機 (z 較大或 x 接近相機)
        // 簡化判斷：物件在玩家「向相機方向」的小區域內 (xz 距離 + 相機側)
        const dx = _v.x - px, dz = _v.z - pz;
        const distXZ = Math.hypot(dx, dz);
        // 相機在玩家 +z 方向 (高度高、z 略大)；物件在玩家附近且 z >= player.z (更靠相機)
        if (distXZ < (obj.r || 28) + 60 && dz > -10) {
          targetOpacity = 0.25;
        }
      }
      m.opacity += (targetOpacity - m.opacity) * Math.min(1, dt * 8);
      m.mat.opacity = m.opacity;
    }
    for (const [id, m] of destMap) {
      if (!seen.has(id)) {
        scene.remove(m.group);
        m.geo.dispose(); m.mat.dispose();
        destMap.delete(id);
      }
    }
  }

  function syncItems(list, dt) {
    const seen = new Set();
    for (const item of list || []) {
      seen.add(item.id);
      let e = itemMap.get(item.id);
      if (!e) {
        const g = new THREE.Group();
        const color = new THREE.Color(item.color);
        
        let geo;
        if (item.kind === 'heal') {
          geo = new THREE.OctahedronGeometry(9, 0);
        } else {
          geo = new THREE.TetrahedronGeometry(9, 0);
        }
        
        const mat = new THREE.MeshStandardMaterial({
          color: color,
          roughness: 0.2,
          metalness: 0.8,
          emissive: color,
          emissiveIntensity: 0.8,
          transparent: true,
          opacity: 1.0,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        g.add(mesh);
        
        const glowMat = new THREE.MeshBasicMaterial({
          color: color,
          transparent: true,
          opacity: 0.35,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        });
        const glow = new THREE.Mesh(new THREE.SphereGeometry(item.kind === 'heal' ? 14 : 12, 8, 8), glowMat);
        g.add(glow);

        const warnRingMat = new THREE.MeshBasicMaterial({
          color: color,
          transparent: true,
          opacity: 0.6,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide
        });
        const warnRing = new THREE.Mesh(ringGeo, warnRingMat);
        warnRing.rotation.x = -Math.PI / 2;
        warnRing.position.y = 0.5;
        warnRing.scale.setScalar(item.radius * 2);
        g.add(warnRing);
        
        scene.add(g);
        
        e = { group: g, mesh, geo, mat, glow, glowMat, warnRing, warnRingMat, baseColor: color, time: Math.random() * 10 };
        itemMap.set(item.id, e);
      }
      
      e.time += dt;
      setVecFromWorld(_v, item.x, item.y, 0);
      
      if (item.warningTime > 0) {
        e.mesh.visible = false;
        e.glow.visible = false;
        e.warnRing.visible = true;
        
        e.group.position.set(_v.x, 0, _v.z);
        const ratio = Math.max(0, item.warningTime / (item.maxWarningTime || 1.5));
        e.warnRing.scale.setScalar(item.radius * (1 + ratio * 2));
        e.warnRingMat.opacity = 0.3 + 0.5 * Math.sin(e.time * 20);
      } else {
        e.mesh.visible = true;
        e.glow.visible = true;
        e.warnRing.visible = false;
        
        const floatY = 16 + 4 * Math.sin(e.time * 2.5);
        e.group.position.set(_v.x, floatY, _v.z);
        e.mesh.rotation.y = e.time * 1.5;
        e.mesh.rotation.x = e.time * 0.7;
        
        if (item.lifetime < 3) {
          const blink = Math.floor(e.time * 15) % 2 === 0;
          e.mat.opacity = blink ? 0.3 : 1.0;
          e.glowMat.opacity = blink ? 0.1 : 0.4;
        } else {
          e.mat.opacity = 1.0;
          e.glowMat.opacity = 0.35;
        }
      }
    }
    
    for (const [id, e] of itemMap) {
      if (!seen.has(id)) {
        scene.remove(e.group);
        e.geo.dispose();
        e.mat.dispose();
        e.glowMat.dispose();
        e.warnRingMat.dispose();
        itemMap.delete(id);
      }
    }
  }

  function syncProjectiles(list, dt) {
    const seen = new Set();
    for (const pr of list) {
      seen.add(pr.id);
      let e = projMap.get(pr.id);
      const vdef = getVfx(pr.vfx);
      const kind = vdef && vdef.projectile ? 'custom:' + pr.vfx : (pr.pierce ? 'bolt' : 'orb');
      if (!e || e.kind !== kind) {
        if (e) disposeProj(e);
        e = makeProj(pr, kind, vdef);
        projMap.set(pr.id, e);
      }
      setVecFromWorld(_v, pr.x, pr.y, PROJECTILE_Y);
      e.group.position.copy(_v);
      if (e.kind.startsWith('custom:')) {
        e.group.rotation.y = -Math.atan2(pr.vy, pr.vx);
        if (e.update) e.update(dt, pr);
      } else if (kind === 'bolt') {
        e.group.rotation.y = -Math.atan2(pr.vy, pr.vx);
        e.core.rotation.x += dt * 30; // 微閃爍
      } else {
        const pulse = 0.85 + 0.15 * Math.sin(performance.now() / 60 + (pr.id % 10));
        e.core.scale.setScalar(pr.radius * pulse);
        e.halo.scale.setScalar(pr.radius * 2.6 * pulse);
        e.core.rotation.y += dt * 4;
        // 拖尾粒子
        particles.spawn({
          x: _v.x, y: _v.y, z: _v.z,
          vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 0.5) * 12, vz: (Math.random() - 0.5) * 12,
          life: 0.28 + Math.random() * 0.18, size: pr.radius * 1.5, color: pr.color, drag: 3, fade: true,
        });
      }
    }
    for (const [id, e] of projMap) if (!seen.has(id)) { disposeProj(e); projMap.delete(id); }
  }

  function makeProj(pr, kind, vdef) {
    const color = new THREE.Color(pr.color);
    if (kind.startsWith('custom:')) {
      const obj = vdef.projectile(hookCtx(pr.color), pr);
      const node = obj.object3D || obj;
      group.add(node);
      return { group: node, kind, update: obj.update || node.userData?.update || null, custom: true };
    }
    const g = new THREE.Group();
    if (kind === 'bolt') {
      // 沿 +X 拉長的亮棒
      const len = Math.max(40, pr.radius * 9);
      const mat = new THREE.MeshStandardMaterial({ color: 0xeaffff, emissive: color, emissiveIntensity: 3.2, roughness: 0.3 });
      const core = new THREE.Mesh(boltGeo, mat);
      core.scale.set(pr.radius * 0.9, len, pr.radius * 0.9);
      core.rotation.z = Math.PI / 2; // 圓柱 +Y -> +X
      g.add(core);
      const haloMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
      const halo = new THREE.Mesh(boltGeo, haloMat);
      halo.scale.set(pr.radius * 2.4, len * 0.96, pr.radius * 2.4);
      halo.rotation.z = Math.PI / 2;
      g.add(halo);
      group.add(g);
      return { group: g, core, halo, kind };
    }
    const coreMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: color, emissiveIntensity: 2.8, roughness: 0.25 });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.scale.setScalar(pr.radius);
    g.add(core);
    const haloMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false });
    const halo = new THREE.Mesh(sphereGeo, haloMat);
    halo.scale.setScalar(pr.radius * 2.6);
    g.add(halo);
    group.add(g);
    return { group: g, core, halo, kind };
  }

  function disposeProj(e) {
    group.remove(e.group);
    e.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) { Array.isArray(o.material) ? o.material.forEach((m) => m.dispose()) : o.material.dispose(); }
    });
  }

  function syncZones(list, dt) {
    const seen = new Set();
    for (const z of list) {
      seen.add(z.id);
      let e = zoneMap.get(z.id);
      const vdef = getVfx(z.vfx);
      const wantCustom = !!(vdef && vdef.zone);
      const kind = wantCustom ? 'custom:' + z.vfx : 'std';
      if (!e || e.kind !== kind) { if (e) disposeZone(e); e = makeZone(z, kind, vdef); zoneMap.set(z.id, e); }
      setVecFromWorld(_v, z.x, z.y, 1.2);
      e.group.position.copy(_v);
      if (e.custom) {
        if (e.update) e.update(dt, z);
        continue;
      }
      const t = performance.now() / 1000;
      if (z.delay > 0) {
        // 預警：外環依倒數填充 + 警示脈動，圓盤隱藏
        const fill = 1 - z.delay / e.totalDelay;
        e.disc.visible = true;
        e.disc.scale.setScalar(z.radius * (0.4 + 0.6 * fill));
        e.disc.material.opacity = 0.12 + 0.12 * Math.sin(t * 14);
        e.ring.visible = true;
        e.ring.scale.setScalar(z.radius);
        e.ring.material.opacity = 0.5 + 0.4 * Math.sin(t * 14);
      } else {
        e.disc.visible = true;
        e.disc.scale.setScalar(z.radius);
        e.disc.material.opacity = 0.28 + 0.12 * Math.sin(t * 8 + z.id);
        e.ring.visible = true;
        e.ring.scale.setScalar(z.radius * (0.96 + 0.04 * Math.sin(t * 6)));
        e.ring.material.opacity = 0.7;
      }
    }
    for (const [id, e] of zoneMap) if (!seen.has(id)) { disposeZone(e); zoneMap.delete(id); }
  }

  function makeZone(z, kind, vdef) {
    if (kind && kind.startsWith('custom:')) {
      const obj = vdef.zone(hookCtx(z.color), z);
      const node = obj.object3D || obj;
      group.add(node);
      return { group: node, kind, custom: true, update: obj.update || node.userData?.update || null, totalDelay: Math.max(0.0001, z.delay || 0) };
    }
    const g = new THREE.Group();
    const color = new THREE.Color(z.color);
    const discMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.rotation.x = -Math.PI / 2;
    g.add(disc);
    const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.4;
    g.add(ring);
    group.add(g);
    return { group: g, kind: 'std', disc, ring, totalDelay: Math.max(0.0001, z.delay || 0) };
  }

  function disposeZone(e) {
    group.remove(e.group);
    if (e.custom) {
      e.group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) { Array.isArray(o.material) ? o.material.forEach((m) => m.dispose()) : o.material.dispose(); }
      });
      return;
    }
    e.disc.material.dispose();
    e.ring.material.dispose();
  }

  function clear() {
    for (const e of projMap.values()) disposeProj(e);
    for (const e of zoneMap.values()) disposeZone(e);
    for (const e of itemMap.values()) {
      scene.remove(e.group);
      e.geo.dispose(); e.mat.dispose(); e.glowMat.dispose(); e.warnRingMat.dispose();
    }
    projMap.clear(); zoneMap.clear(); itemMap.clear();
  }

  return { syncProjectiles, syncZones, syncDestructibles, syncItems, clear };
}
