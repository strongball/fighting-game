// 魔王專屬特效 (boss_*)。教學導向：把「該怎麼打」的機制畫得一眼看懂。
// 目前：R2 劇毒飛蜥的地面毒沼 (boss_lizard_pool) —— 讓「別站進毒池」一眼可辨。
//
// 註冊模式同角色 vfx：registerVfx(id, { zone | projectile | onCast | onHit | onDeath })。
// zone(ctx, z) -> { object3D, update(dt, z) }；ctx = { THREE, scene, particles, sceneMgr, addTransient, color }。
import * as THREE from 'three';
import { registerVfx } from './registry.js';

// R2 地面毒沼：刻意做成「濃濁、把地面染暗的毒液」而非發亮霓虹。
// 深濁底 (一般混色、不發光) + 內層濃淡斑 + 病態黃綠邊界 + 大顆慢冒的毒泡。
// 讀作「危險、別踩」，而不是「漂亮的光圈」。配上 hud.js 站入時的全螢幕警示。
registerVfx('boss_lizard_pool', {
  zone(ctx, z) {
    const { particles } = ctx;
    const g = new THREE.Group();

    // 深濁毒沼底 (一般混色：像把灰地板染成一灘暗濁毒液)
    const base = new THREE.Mesh(
      new THREE.CircleGeometry(1, 40),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#20300e'), transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false })
    );
    base.rotation.x = -Math.PI / 2; base.position.y = 0.5; g.add(base);

    // 內層濃淡斑 (緩旋，營造毒液在流動)
    const inner = new THREE.Mesh(
      new THREE.CircleGeometry(0.72, 32),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#3a5a18'), transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })
    );
    inner.rotation.x = -Math.PI / 2; inner.position.y = 0.7; g.add(inner);

    // 病態黃綠邊界 (一般混色、中等亮度 → 定義邊界但不刺眼)
    const rim = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1, 48),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#82ad2c'), transparent: true, opacity: 0.68, side: THREE.DoubleSide, depthWrite: false })
    );
    rim.rotation.x = -Math.PI / 2; rim.position.y = 0.85; g.add(rim);

    let t = 0, bub = 0;
    return {
      object3D: g,
      update(dt, zz) {
        t += dt;
        const r = zz.radius;
        base.scale.setScalar(r); inner.scale.setScalar(r); rim.scale.setScalar(r);
        inner.rotation.z += dt * 0.25;
        rim.material.opacity = 0.52 + 0.18 * Math.sin(t * 3);       // 邊界緩慢起伏
        inner.material.opacity = 0.48 + 0.12 * Math.sin(t * 1.8 + 1);
        // 大顆、慢、會冒出的毒泡 (節流；大多毒綠，偶爾暗紫呼應鱗甲)
        bub -= dt;
        if (bub <= 0) {
          bub = 0.12;
          const a = Math.random() * Math.PI * 2, rr = Math.random() * r * 0.8;
          particles.spawn({
            x: g.position.x + Math.cos(a) * rr, y: 1.5, z: g.position.z + Math.sin(a) * rr,
            vx: (Math.random() - 0.5) * 6, vy: 14 + Math.random() * 22, vz: (Math.random() - 0.5) * 6,
            gravity: -8, drag: 1.8, life: 0.6 + Math.random() * 0.6,
            size: 4 + Math.random() * 4, color: Math.random() < 0.8 ? '#7fbf3f' : '#9b6bff', fade: true,
          });
        }
      },
    };
  },
});
