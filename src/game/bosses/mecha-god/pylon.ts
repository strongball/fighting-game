// @ts-nocheck
// 能量共振柱召喚物模板 (id: -7)
import * as THREE from 'three';

export const pylonMinion = {
  id: -7,
  name: '能量共振柱',
  color: '#ffaa00',
  shape: 'circle',
  maxHp: 200,
  maxMana: 0,
  speed: 0,
  aiProfile: { range: 0, slots: [], pickTarget: 'nearestTarget' },
  buildModel(ctx) {
    const { reg, mat } = ctx;
    const metalMat = reg(mat('#7f8c8d', { rough: 0.4, metal: 0.8 }));
    const energyMat = reg(mat('#ff5500', {
      rough: 0.1,
      metal: 0.1,
      emissive: new THREE.Color('#ff5500'),
      ei: 2.5,
      opacity: 0.8,
      transparent: true
    }));

    const group = new THREE.Group();
    group.name = 'pylon_group';

    // 底部基座
    const base = new THREE.Mesh(new THREE.CylinderGeometry(14, 18, 10, 8), metalMat);
    base.position.y = 5;
    base.castShadow = true;
    group.add(base);

    // 發光能量核心
    const core = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 30, 8), energyMat);
    core.position.y = 20;
    group.add(core);

    // 頂部頂蓋
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(12, 10, 6, 8), metalMat);
    cap.position.y = 38;
    cap.castShadow = true;
    group.add(cap);

    // 其他肢體回傳空群組以防報錯且不顯示額外內容
    const head = new THREE.Group();
    const armL = new THREE.Group();
    const armR = new THREE.Group();
    const legL = new THREE.Group();
    const legR = new THREE.Group();

    const parts = { torso: group, head, armL, armR, legL, legR };
    parts.customUpdate = (dt, modelGroup) => {
      const t = performance.now() * 0.003;
      const osc = 1.0 + Math.sin(t * 5.0) * 0.05;
      core.scale.set(osc, 1.0, osc);
      if (modelGroup) {
        modelGroup.position.y = 2 + Math.sin(t * 2.0) * 0.5;
      }
    };

    return parts;
  }
};

export default pylonMinion;
