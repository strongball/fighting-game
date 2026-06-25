// @ts-nocheck
// 水泡禁錮小兵模板 (id: -3)
import * as THREE from 'three';

export const bubbleMinion = {
  id: -3,
  name: '深海水泡',
  color: '#0a9396',
  shape: 'circle',
  maxHp: 300,
  maxMana: 0,
  speed: 0,
  aiProfile: { range: 0, slots: [], pickTarget: 'nearestTarget' },
  buildModel(ctx) {
    const { reg, mat } = ctx;
    const waterMat = reg(mat('#94d2bd', {
      rough: 0.05,
      metal: 0.1,
      emissive: new THREE.Color('#0a9396'),
      ei: 2.2,
      opacity: 0.33,
      transparent: true
    }));

    const glowMat = reg(mat('#00ffff', {
      rough: 0.1,
      metal: 0.2,
      emissive: new THREE.Color('#00ffff'),
      ei: 1.5,
      opacity: 0.38,
      transparent: true,
      blending: THREE.AdditiveBlending
    }));

    const group = new THREE.Group();
    group.name = 'bubble_group';

    // 外層折射水罩 (高度設為 22 以對齊角色中心，半徑加大為 34)
    const outer = new THREE.Mesh(new THREE.SphereGeometry(34, 20, 20), waterMat);
    outer.name = 'bubble_shell_outer';
    outer.position.y = 22;
    outer.castShadow = true;
    group.add(outer);

    // 內層螢光核心 (高度設為 22 以對齊角色中心，半徑加大為 28)
    const inner = new THREE.Mesh(new THREE.SphereGeometry(28, 20, 20), glowMat);
    inner.name = 'bubble_shell_inner';
    inner.position.y = 22;
    group.add(inner);

    // 其他肢體回傳空群組以防報錯且不顯示額外內容
    const head = new THREE.Group();
    const armL = new THREE.Group();
    const armR = new THREE.Group();
    const legL = new THREE.Group();
    const legR = new THREE.Group();

    const parts = { torso: group, head, armL, armR, legL, legR };
    parts.customUpdate = (dt, modelGroup) => {
      const t = performance.now() * 0.0035;
      const osc = 1.0 + Math.sin(t * 4.0) * 0.06;
      group.scale.setScalar(osc);
      if (outer) outer.rotation.y += dt * 0.65;
      if (inner) inner.rotation.y -= dt * 1.1;
      if (modelGroup) {
        modelGroup.position.y = 16 + Math.sin(t * 3.0) * 1.5;
      }
    };

    return parts;
  }
};

export default bubbleMinion;
