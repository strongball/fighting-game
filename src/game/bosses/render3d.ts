// @ts-nocheck
// Boss-specific 3D visuals: cores, shield shells, weak-point teaching markers,
// and breakable part placeholder models.
import * as THREE from 'three';

export function attachBossModelVisuals(ctx: any, group: any, bossModel: any) {
  const { ch, base, torsoW, torsoD, torsoH, hipY, shade } = ctx;
  if (bossModel.scale) group.scale.setScalar(bossModel.scale);

  const coreCol = new THREE.Color(bossModel.emissiveCore || base);
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(torsoW * 0.22, 1),
    new THREE.MeshStandardMaterial({ color: coreCol, emissive: coreCol, emissiveIntensity: 2.2, roughness: 0.3, metalness: 0.2, transparent: true, opacity: 0.95 })
  );
  core.position.set(torsoD * 0.5, hipY + torsoH * 0.6, 0);
  group.add(core);
  group.userData.bossCore = core;

  const mech = ch.mechanic;
  if (mech && (mech.coreArmorUntilPartsDown || mech.minionShield)) {
    attachCoreShield({ group, mech, base, coreCol, torsoW, torsoH, hipY, shade });
  }
  if (mech && (mech.backWeak || mech.frontArmor)) {
    attachWeakZone({ group, mech, torsoW, torsoD, torsoH, hipY });
  }
}

function attachCoreShield({ group, mech, base, coreCol, torsoW, torsoH, hipY, shade }: any) {
  const cy = hipY + torsoH * 0.6;
  const shieldMats = [];
  let shield;
  if (mech.minionShield) {
    shield = new THREE.Group();
    shield.position.set(0, cy, 0);
    const ringCols = [shade(base, 0.42), new THREE.Color(base), shade(base, 0.18)];
    const tilts = [[0, 0, 0], [Math.PI / 2, 0, 0.5], [Math.PI / 2.4, 0.9, 0]];
    for (let i = 0; i < 3; i++) {
      const rm = new THREE.MeshBasicMaterial({ color: ringCols[i], transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
      rm.userData.base = 0.6;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(torsoW * (0.84 + i * 0.07), 1.3, 8, 44), rm);
      ring.rotation.set(tilts[i][0], tilts[i][1], tilts[i][2]);
      ring.userData.spin = 0.5 + i * 0.35;
      shield.add(ring); shieldMats.push(rm);
    }
    const am = new THREE.MeshBasicMaterial({ color: shade(base, 0.25), transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false });
    am.userData.base = 0.16;
    shield.add(new THREE.Mesh(new THREE.SphereGeometry(torsoW * 0.9, 20, 16), am));
    shieldMats.push(am);
  } else {
    const m = new THREE.MeshBasicMaterial({ color: coreCol, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, wireframe: true });
    m.userData.base = 0.18;
    shield = new THREE.Mesh(new THREE.IcosahedronGeometry(torsoW * 0.95, 1), m);
    shield.position.set(0, cy, 0);
    shield.userData.tumbleX = true;
    shieldMats.push(m);
  }
  group.add(shield);
  group.userData.coreShield = shield;
  group.userData.coreShieldMats = shieldMats;
}

function attachWeakZone({ group, mech, torsoW, torsoD, torsoH, hipY }: any) {
  const wz: any = {};
  const softCol = new THREE.Color('#ff5a6a');
  const marker = new THREE.Mesh(
    new THREE.OctahedronGeometry(torsoW * 0.13, 0),
    new THREE.MeshStandardMaterial({ color: softCol, emissive: softCol, emissiveIntensity: 2.0, roughness: 0.25, metalness: 0.3, transparent: true, opacity: 0.92 })
  );
  marker.position.set(-(torsoD * 0.5 + torsoW * 0.06), hipY + torsoH * 0.62, 0);
  group.add(marker);
  const backArc = new THREE.Mesh(
    new THREE.RingGeometry(torsoW * 1.45, torsoW * 1.72, 48, 1, Math.PI - 0.95, 1.9),
    new THREE.MeshBasicMaterial({ color: softCol, transparent: true, opacity: 0.1, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  backArc.rotation.x = -Math.PI / 2; backArc.position.y = 1.4; group.add(backArc);
  wz.back = { marker, arc: backArc };
  if (mech.frontArmor) {
    const frontArc = new THREE.Mesh(
      new THREE.RingGeometry(torsoW * 1.4, torsoW * 1.68, 48, 1, -0.9, 1.8),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#8fa9c8'), transparent: true, opacity: 0.12, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    frontArc.rotation.x = -Math.PI / 2; frontArc.position.y = 1.32; group.add(frontArc);
    wz.front = { arc: frontArc };
  }
  group.userData.weakZone = wz;
}

export function createBossPartModel(colorHex: string, scale = 1) {
  const group = new THREE.Group();
  const col = new THREE.Color(colorHex || '#ffffff');
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(16, 1),
    new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 2.0, roughness: 0.35, metalness: 0.3, transparent: true, opacity: 0.95 })
  );
  core.position.y = 42; core.castShadow = true;
  group.add(core);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(24, 2.4, 8, 28),
    new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.6, transparent: true, opacity: 0.8 })
  );
  ring.rotation.x = Math.PI / 2; ring.position.y = 42;
  group.add(ring);
  const blob = new THREE.Mesh(new THREE.CircleGeometry(20, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.6; group.add(blob);
  group.scale.setScalar(scale);
  group.userData = { simple: true, core, breathe: Math.random() * 6.28, baseY: 42 };
  return group;
}

export function updateBossModelVisuals(group: any, ud: any, dt: number, info: any) {
  if (ud.weakZone) updateWeakZone(ud, dt, info);
  if (ud.coreShield) updateCoreShield(ud, dt, info);
  if (ud.bossCore) updateBossCore(ud, dt, info);
}

export function computeBossVisualState(state: any, selfId: string, boss: any, bossData: any) {
  let bossWeakSelf = false, bossFrontSelf = false, coreShielded = 0;
  if (!boss.isBoss) return { bossWeakSelf, bossFrontSelf, coreShielded };

  const mech = bossData && bossData.mechanic;
  if (mech && (mech.backWeak || mech.frontArmor)) {
    const me = state.players[selfId];
    if (me && me.alive && me.id !== boss.id) {
      let rel = Math.atan2(me.y - boss.y, me.x - boss.x) - boss.facing;
      while (rel > Math.PI) rel -= Math.PI * 2;
      while (rel < -Math.PI) rel += Math.PI * 2;
      rel = Math.abs(rel);
      bossWeakSelf = rel > Math.PI - 0.9;
      if (mech.frontArmor) bossFrontSelf = rel < 0.9;
    }
  }
  if (mech && mech.coreArmorUntilPartsDown) {
    for (const o of Object.values(state.players) as any[]) {
      if (o.isPart && o.ownerId === boss.id && o.alive) { coreShielded = 1; break; }
    }
  } else if (mech && mech.minionShield) {
    let nMin = 0;
    for (const o of Object.values(state.players) as any[]) {
      if (o.isMinion && o.ownerId === boss.id && o.alive) nMin++;
    }
    const ms = mech.minionShield;
    if (nMin > 0) coreShielded = Math.min(1, (nMin * (ms.perMinion || 0.18)) / (ms.max || 0.72));
  }
  return { bossWeakSelf, bossFrontSelf, coreShielded };
}

function updateWeakZone(ud: any, dt: number, info: any) {
  const wz = ud.weakZone;
  const wpulse = 0.5 + 0.5 * Math.sin(ud.breathe * 2.4);
  const behind = !!info.bossWeakSelf;
  const inFront = !!info.bossFrontSelf;
  if (wz.back) {
    wz.back.marker.rotation.y += dt * 1.4;
    wz.back.marker.material.emissiveIntensity = (behind ? 2.8 : 1.3) + 1.0 * wpulse;
    wz.back.marker.material.color.set(behind ? '#ffd54a' : '#ff5a6a');
    wz.back.marker.material.emissive.set(behind ? '#ffc24a' : '#ff5a6a');
    wz.back.arc.material.color.set(behind ? '#ffd54a' : '#ff5a6a');
    wz.back.arc.material.opacity = (behind ? 0.32 : 0.085) + (behind ? 0.1 : 0.035) * wpulse;
    wz.back.arc.scale.setScalar(behind ? 1.0 + 0.03 * wpulse : 1.0);
  }
  if (wz.front) {
    wz.front.arc.material.color.set(inFront ? '#ff7a52' : '#8fa9c8');
    wz.front.arc.material.opacity = (inFront ? 0.3 : 0.1) + (inFront ? 0.1 : 0.03) * wpulse;
  }
}

function updateCoreShield(ud: any, dt: number, info: any) {
  const s = info.coreShielded || 0;
  ud.coreShield.visible = s > 0.02;
  if (s <= 0.02) return;
  ud.coreShield.rotation.y += dt * 0.45;
  if (ud.coreShield.userData.tumbleX) ud.coreShield.rotation.x += dt * 0.3;
  for (const c of ud.coreShield.children) {
    if (c.userData && c.userData.spin) c.rotation.z += dt * c.userData.spin;
  }
  const pulse = 0.7 + 0.3 * Math.sin(ud.breathe * 3);
  for (const m of (ud.coreShieldMats || [])) m.opacity = (m.userData.base || 0.3) * s * pulse;
}

function updateBossCore(ud: any, dt: number, info: any) {
  ud.bossCore.rotation.y += dt * 1.0;
  const cm = ud.bossCore.material;
  cm.emissiveIntensity += ((info.fake ? 0.35 : 2.2) - cm.emissiveIntensity) * Math.min(1, dt * 6);
  cm.opacity += ((info.fake ? info.targetOpacity : 0.95) - cm.opacity) * Math.min(1, dt * 10);
}
