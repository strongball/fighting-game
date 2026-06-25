// @ts-nocheck
export function attachSkinGear(ctx) {
  const { THREE, baseColor, spineBone } = ctx;
  // 鳥獵：腰側速取箭袋（比弓箭手箭筒更斜、更輕量）
  const quiver = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x6b4a25, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.3, 11, 8), bodyMat);
  body.castShadow = true;
  quiver.add(body);

  const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8, roughness: 0.2 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.35, 8, 12), goldMat);
  rim.rotation.x = Math.PI / 2; rim.position.y = 5.5;
  quiver.add(rim);

  const arrowMat = new THREE.MeshStandardMaterial({ color: 0xf0e0b0, roughness: 0.5 });
  const featherMat = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.5, emissive: baseColor, emissiveIntensity: 0.6 });
  for (let i = -1; i <= 1; i++) {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 8, 4), arrowMat);
    shaft.position.set(i * 0.7, 7, 0); shaft.rotation.z = i * 0.18;
    quiver.add(shaft);
    const feather = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.6, 0.2), featherMat);
    feather.position.set(i * 0.7, 10, 0);
    quiver.add(feather);
  }
  spineBone.add(quiver);
  quiver.position.set(2.5, -1, -2.6);
  quiver.rotation.set(0, Math.PI, -0.7);
  quiver.scale.setScalar(0.7);
}
