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
      ei: 2.0,
      opacity: 0.65,
      transparent: true
    }));

    // 渲染成包圍玩家的半透明水球
    const torso = new THREE.Mesh(new THREE.SphereGeometry(25, 16, 16), waterMat);
    torso.castShadow = true;

    // 其他肢體回傳空群組以防報錯且不顯示額外內容
    const head = new THREE.Group();
    const armL = new THREE.Group();
    const armR = new THREE.Group();
    const legL = new THREE.Group();
    const legR = new THREE.Group();

    return { torso, head, armL, armR, legL, legR };
  }
};

export default bubbleMinion;
