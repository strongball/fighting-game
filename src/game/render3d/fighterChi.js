// 格鬥家氣球：每名格鬥家身旁環繞發光金氣球，數量＝該玩家的 chi（0–5，已納入網路快照）。
// 由 renderer 每幀 sync(players, dt, getEntityPos)；位置取 render 端平滑後的場景座標（跟模型同步不抖動）。
import * as THREE from 'three';

const TMP_COLOR = new THREE.Color();   // 顏色過渡暫存，避免每幀配置

export function createFighterChiLayer(scene) {
  const entries = new Map(); // pid -> { group, spheres[], mats[], geo }
  let phase = 0;

  function ensure(pid) {
    let e = entries.get(pid);
    if (e) return e;
    const group = new THREE.Group();
    const geo = new THREE.SphereGeometry(4.2, 12, 12);
    const spheres = [], mats = [];
    for (let i = 0; i < 5; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      group.add(m); spheres.push(m); mats.push(mat);
    }
    scene.add(group);
    e = { group, spheres, mats, geo };
    entries.set(pid, e);
    return e;
  }

  function remove(pid) {
    const e = entries.get(pid);
    if (!e) return;
    scene.remove(e.group);
    e.geo.dispose();
    e.mats.forEach((m) => m.dispose());
    entries.delete(pid);
  }

  function sync(players, dt, getPos) {
    phase += dt;
    const seen = new Set();
    for (const p of Object.values(players)) {
      if (!p || p.charId !== 'fighter' || !p.alive) continue;
      const chi = Math.max(0, Math.min(5, p.chi || 0));
      if (chi <= 0 && !entries.has(p.id)) continue;   // 從未集氣 → 不建立
      seen.add(p.id);
      const e = ensure(p.id);
      const pos = getPos ? getPos(p.id) : null;
      if (pos) e.group.position.set(pos.x, 0, pos.z);
      const full = chi >= 5;                                  // 滿氣 → 全部轉赤
      for (let i = 0; i < 5; i++) {
        const active = i < chi;
        const mat = e.mats[i];
        mat.opacity += ((active ? (full ? 0.98 : 0.92) : 0) - mat.opacity) * Math.min(1, dt * 10); // 淡入/淡出
        // 顏色：滿氣赤紅 0xff3320、未滿金黃 0xffd24a，平滑過渡
        mat.color.lerp(TMP_COLOR.setHex(full ? 0xff3320 : 0xffd24a), Math.min(1, dt * 8));
        const m = e.spheres[i];
        const ang = phase * (full ? 2.4 : 1.6) + (i / 5) * Math.PI * 2;   // 滿氣旋更快
        m.position.set(Math.cos(ang) * 42, 34 + Math.sin(phase * 3 + i) * 2.5, Math.sin(ang) * 42); // 離身體更遠
        const pulse = 0.85 + 0.15 * Math.sin(phase * (full ? 9 : 6) + i);
        m.scale.setScalar((active ? (full ? 1.2 : 1) : 0.55) * pulse);
        m.visible = mat.opacity > 0.02;
      }
    }
    for (const pid of [...entries.keys()]) if (!seen.has(pid)) remove(pid); // 離場/死亡/換角 → 清除
  }

  function dispose() { for (const pid of [...entries.keys()]) remove(pid); }
  return { sync, dispose };
}
