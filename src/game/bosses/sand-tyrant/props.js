// 風沙法皇場地的專屬道具（three 幾何走 .js，免型別宣告；場地資料/型別檢查留在 arena.ts）。
// 對齊參考美術圖：旋起的塵沙龍捲（主角）＋ 嶙峋黑岩尖石。
// 座標慣例同其他 builder：場景座標（原點＝競技場中心，X 右、Y 上、Z 朝鏡頭）。

import * as THREE from 'three';
import { noisify, scatterPositions } from '../../render3d/decorations.js';
import { LOW_GPU } from '../../render3d/quality.js';

// 塵沙龍捲貼圖：斜向旋流條紋（繞柱即成螺旋）＋ 垂直透明包絡（頂端消散、底部柔化）。快取。
let _dustTex = null;
function dustColumnTexture() {
  if (_dustTex) return _dustTex;
  const W = 128, H = 256;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  // 淡塵體底：讓漏斗有半透明身體（不只條紋），對比沙地背景時才看得出柱體
  x.fillStyle = 'rgba(236,221,184,0.13)';
  x.fillRect(0, 0, W, H);
  // 斜向旋流條紋（平行斜線→繞柱成螺旋）；水平 wrap 三份保證接續
  const streaks = 46;
  for (let i = 0; i < streaks; i++) {
    const sx = Math.random() * W;
    const drift = (0.55 + Math.random() * 0.5) * W;   // 整段高度的水平位移＝螺旋斜率
    x.strokeStyle = `rgba(240,224,180,${(0.06 + Math.random() * 0.14).toFixed(3)})`;
    x.lineWidth = 1 + Math.random() * 3.2; x.lineCap = 'round';
    for (const off of [-W, 0, W]) {
      x.beginPath();
      const segs = 10;
      for (let s = 0; s <= segs; s++) {
        const t = s / segs;
        const px = sx + off + drift * t + Math.sin(t * 6 + i) * 3;
        const py = t * H;
        if (s === 0) x.moveTo(px, py); else x.lineTo(px, py);
      }
      x.stroke();
    }
  }
  // 垂直透明包絡：頂端漸隱、下半濃、底部柔化（漏斗消散感）
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0.0, 'rgba(0,0,0,0)');
  g.addColorStop(0.20, 'rgba(0,0,0,1)');
  g.addColorStop(0.78, 'rgba(0,0,0,1)');
  g.addColorStop(1.0, 'rgba(0,0,0,0.25)');
  x.globalCompositeOperation = 'destination-in';
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.globalCompositeOperation = 'source-over';
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  t.userData.shared = true;        // 跨關共用快取：換關清理時不可 dispose
  _dustTex = t; return t;
}

// 塵沙龍捲（boss 專屬·主角）：上寬下窄的塵沙漏斗（內外兩層 + 旋流貼圖）+ 底部揚塵。
// 正常混色的沙色、半透明、吃霧 → 融入塵霾，避免加法混色糊成白彈簧。散佈於中場至邊緣鬆散環、避開正中央。
export function buildSandVortices(theme) {
  const cfg = theme.vortices || {};
  // 手機降載：減少龍捲數量（透明雙面圓柱是 overdraw 大宗）
  const count = LOW_GPU ? Math.min(3, cfg.count || 5) : (cfg.count || 5);
  const baseOp = cfg.opacity != null ? cfg.opacity : 0.55;
  const sand = new THREE.Color(cfg.color || 0xf2e2bc);
  const tex = dustColumnTexture();
  tex.repeat.set(2, 1);
  const mkMat = (map, op) => new THREE.MeshBasicMaterial({
    map, color: sand, transparent: true, opacity: op,
    depthWrite: false, side: THREE.DoubleSide, fog: true, toneMapped: false,
  });
  const outerMat = mkMat(tex, baseOp);
  // 手機降載：省掉內層漏斗，少一層全螢幕透明 overdraw
  let innerMat = null;
  if (!LOW_GPU) {
    const texInner = tex.clone(); texInner.needsUpdate = true; texInner.repeat.set(3, 1);
    innerMat = mkMat(texInner, baseOp * 0.8);
  }
  const puffMat = new THREE.MeshBasicMaterial({ color: sand, transparent: true, opacity: baseOp * 0.45, depthWrite: false, fog: true, toneMapped: false });
  const group = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + 0.4;
    const rad = 540 + Math.random() * 500;                       // 中場到邊緣
    const v = new THREE.Group();
    v.position.set(Math.cos(a) * rad, 0, Math.sin(a) * rad * 0.72);
    const H = 210 + Math.random() * 170;
    const baseR = 30 + Math.random() * 24;
    // 外層漏斗（上寬下窄）
    const outer = new THREE.Mesh(new THREE.CylinderGeometry(baseR * 1.7, baseR * 0.5, H, 22, 1, true), outerMat);
    outer.position.y = H / 2; outer.rotation.y = Math.random() * Math.PI * 2; outer.renderOrder = 5; v.add(outer);
    // 內層漏斗（較緊實、加深核心）— 手機降載時略過
    if (innerMat) {
      const inner = new THREE.Mesh(new THREE.CylinderGeometry(baseR * 1.05, baseR * 0.3, H * 0.95, 18, 1, true), innerMat);
      inner.position.y = H * 0.475; inner.rotation.y = Math.random() * Math.PI * 2; inner.renderOrder = 6; v.add(inner);
    }
    // 底部揚塵
    const puff = new THREE.Mesh(new THREE.SphereGeometry(baseR * 1.35, 12, 8), puffMat);
    puff.scale.set(1.4, 0.42, 1.4); puff.position.y = baseR * 0.32; puff.renderOrder = 4; v.add(puff);
    v.rotation.z = (Math.random() - 0.5) * 0.16;                  // 微傾
    group.add(v);
  }
  return group;
}

// 金字塔（boss 專屬）：場外遠景地標。四面錐（噪聲風化）、砂岩色，朝相機呈一個正面。
// 置於後方沙海、霧中半隱的剪影；靠陽光自然分出受光面/陰影面。
export function buildPyramid(theme) {
  const cfg = theme.pyramid || {};
  const h = cfg.height || 560;
  const r = cfg.radius || 600;
  let geo = new THREE.ConeGeometry(r, h, 4, 6);
  geo = noisify(geo, r * 0.02);          // 風化侵蝕，避免死板 CG 錐
  geo.translate(0, h / 2, 0);
  const mat = new THREE.MeshStandardMaterial({ color: cfg.color || 0xb89a66, roughness: 0.97, metalness: 0.02 });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.y = cfg.rot != null ? cfg.rot : Math.PI / 4;  // 正面朝相機 (+z)
  m.position.set(cfg.x != null ? cfg.x : 480, 0, cfg.z != null ? cfg.z : -1080);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

// 綠洲（boss 專屬）：可放多片（cfg.spots[]）。每片＝不規則水池（諧波擾動湖岸，非正圓）+ 砂岸 + 棕櫚 + 草叢。
// 場邊的水面覆到邊界 →「牆跟水的交界」；場內那片是純裝飾、可穿越（無碰撞）。
export function buildOasis(theme) {
  const cfg = theme.oasis || {};
  const group = new THREE.Group();
  const spots = cfg.spots || [{ x: -1300, z: -150, rx: 200, rz: 165, palms: 4 }];
  // 共用材質/幾何
  const bankMat = new THREE.MeshStandardMaterial({ color: cfg.bank || 0xb89a68, roughness: 1.0 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: cfg.trunk || 0x6b4f2e, roughness: 0.9 });
  const frondMat = new THREE.MeshStandardMaterial({ color: cfg.frond || 0x4f8a2e, roughness: 0.85, side: THREE.DoubleSide });
  const coconutMat = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.8 });
  const grassMat = new THREE.MeshStandardMaterial({ color: cfg.grass || 0x5a8f30, roughness: 1.0 });
  const waterCol = cfg.water || 0x4fb0bf, deepCol = cfg.deep || 0x2b7e93;
  const frondGeo = new THREE.ConeGeometry(8, 58, 4); frondGeo.scale(1, 1, 0.22); frondGeo.translate(0, 29, 0);
  spots.forEach((sp, idx) => {
    const cx = sp.x, cz = sp.z, rx = sp.rx || 200, rz = sp.rz || 165;
    const seed = sp.seed != null ? sp.seed : 0.7 + idx * 1.37;     // 每片不同湖岸線
    const ph = [seed, seed * 2.3 + 1.1, seed * 3.7 + 2.0];
    const blob = (s) => {                          // 不規則閉合輪廓 → 躺平的 ShapeGeometry
      const shape = new THREE.Shape();
      const N = 56;
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * Math.PI * 2;
        const rr = s * (1 + 0.13 * Math.sin(a * 3 + ph[0]) + 0.08 * Math.sin(a * 5 + ph[1]) + 0.05 * Math.sin(a * 7 + ph[2]));
        const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
        i === 0 ? shape.moveTo(px, py) : shape.lineTo(px, py);
      }
      const g = new THREE.ShapeGeometry(shape); g.rotateX(-Math.PI / 2); return g;
    };
    const place = (mesh, y) => { mesh.scale.set(rx, 1, rz); mesh.position.set(cx, y, cz); group.add(mesh); };
    const bank = new THREE.Mesh(blob(1.32), bankMat); bank.receiveShadow = true; place(bank, 1.0);
    const water = new THREE.Mesh(blob(1.0), new THREE.MeshStandardMaterial({ color: waterCol, emissive: waterCol, emissiveIntensity: 0.18, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.9 }));
    water.renderOrder = 2; place(water, 2.2);
    const deep = new THREE.Mesh(blob(0.64), new THREE.MeshStandardMaterial({ color: deepCol, emissive: deepCol, emissiveIntensity: 0.14, roughness: 0.18, metalness: 0.1, transparent: true, opacity: 0.92 }));
    deep.renderOrder = 3; place(deep, 2.35);
    // 棕櫚（背向場中心那側的弧；palms:0 → 場內可穿越片不長棕櫚，避免擋視野）
    const nPalm = sp.palms != null ? sp.palms : 3;
    const baseAng = Math.atan2(cz, cx);
    for (let i = 0; i < nPalm; i++) {
      const a = baseAng + (i / Math.max(1, nPalm - 1) - 0.5) * 1.7;
      const px = cx + Math.cos(a) * rx * 1.12, pz = cz + Math.sin(a) * rz * 1.12;
      const palm = new THREE.Group(); palm.position.set(px, 0, pz);
      const tH = 95 + Math.random() * 55;
      const lean = (Math.random() - 0.5) * 0.5;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 6, tH, 6), trunkMat);
      trunk.position.set(0, tH / 2, 0); trunk.rotation.z = lean; trunk.castShadow = true; palm.add(trunk);
      const cw = new THREE.Group(); cw.position.set(Math.sin(-lean) * tH, tH, 0);
      const nFrond = LOW_GPU ? 4 : 7;
      for (let f = 0; f < nFrond; f++) { const fr = new THREE.Mesh(frondGeo, frondMat); fr.rotation.set(1.62, (f / nFrond) * Math.PI * 2, 0); cw.add(fr); }
      for (let k = 0; k < 3; k++) { const co = new THREE.Mesh(new THREE.SphereGeometry(4.5, 8, 6), coconutMat); co.position.set(Math.cos(k * 2.1) * 6, -3, Math.sin(k * 2.1) * 6); cw.add(co); }
      palm.add(cw); group.add(palm);
    }
    // 水邊綠草叢
    for (let i = 0; i < (LOW_GPU ? 3 : 8); i++) {
      const a = Math.random() * Math.PI * 2;
      let tuft = noisify(new THREE.IcosahedronGeometry(9, 1), 3); tuft.scale(1.1, 0.7, 1.1); tuft.translate(0, 4, 0);
      const t = new THREE.Mesh(tuft, grassMat);
      t.position.set(cx + Math.cos(a) * rx * (1.0 + Math.random() * 0.25), 0, cz + Math.sin(a) * rz * (1.0 + Math.random() * 0.25));
      t.castShadow = true; group.add(t);
    }
  });
  return group;
}

// 嶙峋黑岩尖石（boss 專屬）：外環散佈的稜角岩柱（噪聲化五面錐，半埋、微傾）。
// 暗色稜角剪影，與圓潤卵石（rock）形成對比，呼應參考圖的尖石。
export function buildSpires(theme) {
  const cfg = theme.spires || {};
  const positions = scatterPositions(cfg.count || 9);
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: cfg.color || 0x4a3d30, roughness: 0.96, metalness: 0.03 });
  for (const p of positions) {
    const h = (70 + Math.random() * 130) * (p.scale || 1);
    const w = h * (0.18 + Math.random() * 0.14);
    let geo = new THREE.ConeGeometry(w, h, 5, 1);
    geo = noisify(geo, w * 0.3);                           // 稜角化
    geo.translate(0, h / 2, 0);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(p.x, -Math.random() * 12, p.z);         // 半埋入沙
    m.rotation.set((Math.random() - 0.5) * 0.28, p.ang, (Math.random() - 0.5) * 0.28); // 微傾
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
  }
  group.userData.positions = positions;
  return group;
}
