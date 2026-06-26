// 地面圖案：每隻 Boss 不同的中央地刻 (法陣/裂縫/符文…)，打破方形單調感。
// 由 theme.floorDecal 設定；支援自體發光 (emissiveMap) → 吃 bloom + 在 updateDecorationFade 呼吸。

import * as THREE from 'three';
import { ARENA } from '../../constants.js';

// 程序生成地面圖案貼圖。
//   kinds: 'arcane' 法陣 / 'cracks' 裂縫 / 'hex' 六角網格 / 'rings' 同心圓 /
//          'flame' 火紋 / 'snowflake' 雪花 / 'grove' 森林神殿符文法陣
export function makeFloorPattern(kind, color, scale = 1) {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  x.clearRect(0, 0, S, S);
  x.strokeStyle = color || '#ffffff';
  x.fillStyle = color || '#ffffff';
  x.lineCap = 'round';
  const cx = S / 2, cy = S / 2;

  if (kind === 'arcane') {
    x.lineWidth = 6;
    // 三重同心法陣 + 內部六角星
    for (const r of [320, 240, 160]) { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.stroke(); }
    x.beginPath();
    for (let i = 0; i < 6; i++) {
      const a1 = i * Math.PI / 3, a2 = (i + 2) * Math.PI / 3;
      x.moveTo(cx + Math.cos(a1) * 200, cy + Math.sin(a1) * 200);
      x.lineTo(cx + Math.cos(a2) * 200, cy + Math.sin(a2) * 200);
    }
    x.stroke();
  } else if (kind === 'cracks') {
    x.lineWidth = 5;
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const r1 = 80 + Math.random() * 60;
      const r2 = 360 + Math.random() * 80;
      x.beginPath();
      let prev = { x: cx + Math.cos(a) * r1, y: cy + Math.sin(a) * r1 };
      x.moveTo(prev.x, prev.y);
      const segs = 6;
      for (let s = 1; s <= segs; s++) {
        const f = s / segs;
        const ang = a + (Math.random() - 0.5) * 0.35;
        const rr = r1 + (r2 - r1) * f;
        const nx = cx + Math.cos(ang) * rr;
        const ny = cy + Math.sin(ang) * rr;
        x.lineTo(nx, ny); prev = { x: nx, y: ny };
      }
      x.stroke();
    }
  } else if (kind === 'hex') {
    x.lineWidth = 4;
    const step = 80;
    for (let row = -8; row <= 8; row++) {
      for (let col = -8; col <= 8; col++) {
        const ox = cx + col * step + (row % 2 ? step / 2 : 0);
        const oy = cy + row * step * 0.866;
        x.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 3;
          const px = ox + Math.cos(a) * 36;
          const py = oy + Math.sin(a) * 36;
          if (i === 0) x.moveTo(px, py); else x.lineTo(px, py);
        }
        x.closePath(); x.stroke();
      }
    }
  } else if (kind === 'rings') {
    x.lineWidth = 6;
    for (let i = 0; i < 5; i++) {
      const r = 100 + i * 80;
      x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.stroke();
    }
  } else if (kind === 'flame') {
    x.lineWidth = 5;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      x.beginPath();
      x.moveTo(cx + Math.cos(a) * 120, cy + Math.sin(a) * 120);
      const ctrlX = cx + Math.cos(a + 0.3) * 280;
      const ctrlY = cy + Math.sin(a + 0.3) * 280;
      const endX = cx + Math.cos(a) * 380;
      const endY = cy + Math.sin(a) * 380;
      x.quadraticCurveTo(ctrlX, ctrlY, endX, endY);
      x.stroke();
    }
  } else if (kind === 'snowflake') {
    x.lineWidth = 4;
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      x.save();
      x.translate(cx, cy); x.rotate(a);
      x.beginPath(); x.moveTo(0, 0); x.lineTo(380, 0); x.stroke();
      for (const offset of [120, 200, 280]) {
        x.beginPath();
        x.moveTo(offset, 0);
        x.lineTo(offset - 30, -30);
        x.moveTo(offset, 0);
        x.lineTo(offset - 30, 30);
        x.stroke();
      }
      x.restore();
    }
  } else if (kind === 'grove') {
    // 森林神殿符文法陣：外圈符文帶 + 多重同心環 + 放射輻條 + 中央交織六芒 + 發光核心
    const ring = (r, w) => { x.lineWidth = w; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.stroke(); };
    // 外圈雙環 + 符文刻紋帶
    ring(482, 11); ring(452, 4);
    for (let i = 0; i < 56; i++) {
      const a = (i / 56) * Math.PI * 2;
      const c1 = Math.cos(a), s1 = Math.sin(a);
      x.lineWidth = 6;
      x.beginPath();
      x.moveTo(cx + c1 * 452, cy + s1 * 452);
      x.lineTo(cx + c1 * 482, cy + s1 * 482);
      x.stroke();
      // 偽符文：每隔一格加一道斜橫劃，營造刻字感
      if (i % 2 === 0) {
        const rm = 467;
        x.lineWidth = 4;
        x.beginPath();
        x.moveTo(cx + Math.cos(a - 0.05) * rm, cy + Math.sin(a - 0.05) * rm);
        x.lineTo(cx + Math.cos(a + 0.05) * rm, cy + Math.sin(a + 0.05) * rm);
        x.stroke();
      }
    }
    // 中環組
    ring(400, 8); ring(330, 5);
    // 放射輻條 12 道，端點帶符文節點
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const c1 = Math.cos(a), s1 = Math.sin(a);
      x.lineWidth = 5;
      x.beginPath();
      x.moveTo(cx + c1 * 165, cy + s1 * 165);
      x.lineTo(cx + c1 * 398, cy + s1 * 398);
      x.stroke();
      x.lineWidth = 4;
      x.beginPath(); x.arc(cx + c1 * 365, cy + s1 * 365, 10, 0, Math.PI * 2); x.stroke();
    }
    // 內環
    ring(248, 7); ring(158, 4);
    // 中央交織雙三角（六芒星）
    x.lineWidth = 7;
    for (const off of [0, Math.PI / 3]) {
      x.beginPath();
      for (let i = 0; i <= 3; i++) {
        const a = off + (i % 3) * (Math.PI * 2 / 3) - Math.PI / 2;
        const px = cx + Math.cos(a) * 150, py = cy + Math.sin(a) * 150;
        if (i === 0) x.moveTo(px, py); else x.lineTo(px, py);
      }
      x.closePath(); x.stroke();
    }
    // 發光核心
    ring(66, 5);
    x.beginPath(); x.arc(cx, cy, 30, 0, Math.PI * 2); x.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// 由 theme.floorDecal 建立中央地刻 Mesh。回傳 null 表示無地刻。
// userData 帶 decalMat/glowBase/pulse 供 updateDecorationFade 做呼吸發光。
export function buildFloorDecal(theme) {
  const dc = theme.floorDecal;
  if (!dc) return null;
  const tex = makeFloorPattern(dc.kind, dc.color, dc.scale);
  const size = Math.max(ARENA.width, ARENA.height) * (dc.size || 0.55);
  const opts = {
    map: tex, transparent: true, opacity: dc.opacity != null ? dc.opacity : 0.45,
    roughness: 1.0, metalness: 0.0, depthWrite: false,
  };
  // 發光符文：同一張貼圖當 emissiveMap，僅線條發亮（吃 bloom）
  if (dc.glow) {
    opts.emissiveMap = tex;
    opts.emissive = new THREE.Color(dc.glowColor || dc.color || 0xffffff);
    opts.emissiveIntensity = dc.glow;
  }
  const mat = new THREE.MeshStandardMaterial(opts);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.4;
  m.userData.isDecoration = true;
  m.userData.decalMat = mat;
  m.userData.glowBase = dc.glow || 0;     // 基準發光強度
  m.userData.pulse = dc.pulse || 0;       // 呼吸幅度 0..1
  return m;
}
