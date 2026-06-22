// Persistent Round 11 time-anchor visuals. Objects are keyed by anchor id and
// updated in place, avoiding the geometry churn caused by telegraph FX spam.
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { sceneX, sceneZ } from './coords.js';

const OPEN = new THREE.Color('#70e6ff');
const LOCKED = new THREE.Color('#7CFCB2');

function makeLabel() {
  const el = document.createElement('div');
  el.style.cssText =
    'padding:5px 12px;border-radius:16px;border:2px solid #70e6ff;' +
    'background:rgba(3,18,27,.82);color:#dfffff;font:900 17px system-ui,sans-serif;' +
    'white-space:nowrap;text-shadow:0 0 8px #70e6ff;box-shadow:0 0 16px rgba(112,230,255,.65);';
  el.textContent = '▼ 站這裡';
  const label = new CSS2DObject(el);
  label.position.y = 76;
  return { label, el };
}

function createAnchor(scene, anchor) {
  const g = new THREE.Group();
  const discMat = new THREE.MeshBasicMaterial({ color: OPEN, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 48), discMat);
  disc.rotation.x = -Math.PI / 2; disc.position.y = 1; g.add(disc);
  const ringMat = new THREE.MeshBasicMaterial({ color: OPEN, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 64), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 2; g.add(ring);
  const beamMat = new THREE.MeshBasicMaterial({ color: OPEN, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 1, 150, 32, 1, true), beamMat);
  beam.position.y = 75; g.add(beam);
  const { label, el } = makeLabel(); g.add(label);
  scene.add(g);
  return { group: g, disc, ring, beam, discMat, ringMat, beamMat, label, labelEl: el, phase: Math.random() * Math.PI * 2 };
}

function disposeAnchor(scene, entry) {
  scene.remove(entry.group);
  entry.labelEl.remove();
  entry.group.traverse((o) => {
    o.geometry?.dispose();
    if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
    else o.material?.dispose();
  });
}

export function createTimeAnchorLayer(scene) {
  const entries = new Map();
  let time = 0;

  function sync(anchors = [], ritual = null, dt = 0) {
    time += dt;
    const seen = new Set();
    for (const anchor of anchors) {
      seen.add(anchor.id);
      let e = entries.get(anchor.id);
      if (!e) { e = createAnchor(scene, anchor); entries.set(anchor.id, e); }
      const occupied = anchor.occupiedBy != null;
      const color = occupied ? LOCKED : OPEN;
      const radius = anchor.captureRadius || anchor.radius || 120;
      const remaining = ritual?.remaining ?? Infinity;
      const urgency = remaining <= 1 ? 1 : 0;
      const pulse = 0.88 + 0.12 * Math.sin(time * (urgency ? 18 : 7) + e.phase);
      e.group.position.set(sceneX(anchor.x), 0, sceneZ(anchor.y));
      e.disc.scale.setScalar(radius);
      e.ring.scale.setScalar(radius * pulse);
      e.beam.scale.set(radius, 1, radius);
      e.discMat.color.copy(color); e.ringMat.color.copy(color); e.beamMat.color.copy(color);
      e.discMat.opacity = occupied ? 0.34 : 0.18 + urgency * 0.08;
      e.ringMat.opacity = occupied ? 1 : 0.82 + urgency * 0.16;
      e.beamMat.opacity = occupied ? 0.2 : 0.1 + urgency * 0.08;
      e.labelEl.textContent = occupied ? '✓ 已鎖定' : '▼ 站這裡';
      e.labelEl.style.color = occupied ? '#dffff0' : '#dfffff';
      e.labelEl.style.borderColor = occupied ? '#7CFCB2' : '#70e6ff';
      e.labelEl.style.textShadow = `0 0 8px ${occupied ? '#7CFCB2' : '#70e6ff'}`;
    }
    for (const [id, e] of entries) {
      if (!seen.has(id)) { disposeAnchor(scene, e); entries.delete(id); }
    }
  }

  function dispose() {
    for (const e of entries.values()) disposeAnchor(scene, e);
    entries.clear();
  }

  return { sync, dispose, size: () => entries.size };
}
