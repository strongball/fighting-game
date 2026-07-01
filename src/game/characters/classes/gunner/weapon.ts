// @ts-nocheck
import { createWeaponKit } from '../../../render3d/weaponKit.js';

export function buildGunnerWeapon(hand, ctx) {
  const { THREE, hand: weaponHand, base, reg, mat, shade, steel, dark, gold, accent, add } = createWeaponKit(hand, ctx);
  
  // 載入專屬 3D 材質
  const gunmetalTex = ctx.materialTex ? ctx.materialTex('metal', 'gunmetal') : null;
  const gunMat = reg(mat(0x3a3a3a, { metal: 0.95, rough: 0.22, map: gunmetalTex }));

  const goldTex = ctx.materialTex ? ctx.materialTex('metal', 'gold') : null;
  const goldEngraved = reg(mat(0xcacaca, { metal: 0.85, rough: 0.18, map: goldTex }));

  const leatherTex = ctx.materialTex ? ctx.materialTex('leather', 'leather') : null;
  const gripMat = reg(mat(0xffffff, { metal: 0.15, rough: 0.65, map: leatherTex }));

  // 單把巨型左輪手槍 (槍管朝下 -Y，配合揮臂射擊時抬起指向前方)
  const zPos = 0;

  // 1. 槍身主體 (Upper Frame)
  add(new THREE.Mesh(new THREE.BoxGeometry(4.2, 5.0, 3.2), gunMat), 0, -2.5, zPos);

  // 2. 轉輪彈巢 (Cylinder Wheel) - 軸心沿 Y 軸 (與槍管平行)
  const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 5.2, 6), goldEngraved);
  add(cylinder, 0, -5.0, zPos);

  // 彈巢軸心
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 5.5, 6), dark), 0, -5.0, zPos);

  // 3. 巨型六角槍管 (Hexagonal Cylinder Barrel) - 朝向下方 (-Y)
  // CylinderGeometry 預設即沿 Y 軸，因此無須旋轉即朝向下方
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 11.0, 6), gunMat);
  add(barrel, 0, -11.0, zPos);

  // 槍管前側加強筋與瞄準滑軌
  add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 9.0, 1.2), goldEngraved), 1.2, -12.0, zPos);

  // 4. 皮革防滑握把 (Leather Grip) - 朝向後上方傾斜 (X 負向，Y 正向)
  const grip = new THREE.Mesh(new THREE.BoxGeometry(2.8, 7.5, 2.0), gripMat);
  add(grip, -1.6, 1.0, zPos, 0, 0, 0.28);

  // 握把黃金底蓋
  const butt = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.9, 2.4), goldEngraved);
  add(butt, -2.3, 4.3, zPos, 0, 0, 0.28);

  // 5. 金屬扳機護圈與擊錘
  // 擊錘 (Hammer)
  add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.8, 0.8), steel), -1.4, -0.2, zPos, 0, 0, -0.4);
  // 護圈 (Trigger Guard)
  const guard = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.4, 6, 12), goldEngraved);
  add(guard, -0.5, -2.0, zPos);

  // 6. 槍口消焰發光體 (Muzzle glow at the bottom tip of the barrel)
  const muzzleGlow = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 0.8, 3.0, 6), accent);
  add(muzzleGlow, 0, -17.5, zPos);

  // 準星 (Front Sight)
  add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.6), goldEngraved), 1.4, -15.8, zPos);
}
