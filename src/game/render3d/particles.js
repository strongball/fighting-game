// GPU 粒子系統：單一 THREE.Points，一次 draw call (取代舊版每顆 arc()+fill 的 Canvas2D 粒子)
//
// CPU 端積分位置/速度，每幀寫入 BufferAttribute；加法混色 + 自訂 shader 畫柔邊圓點。
// 座標一律使用「場景座標」(已由 coords 轉換)。

import * as THREE from 'three';

const VERT = /* glsl */`
  attribute float aSize;
  attribute float aAlpha;
  varying vec3 vColor;
  varying float vAlpha;
  uniform float uDpr;
  void main() {
    vColor = color;
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uDpr * (300.0 / max(1.0, -mv.z));
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */`
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 d = gl_PointCoord - vec2(0.5);
    float r = length(d);
    if (r > 0.5) discard;
    float a = smoothstep(0.5, 0.0, r) * vAlpha;
    gl_FragColor = vec4(vColor, a);
  }
`;

export function createParticleSystem(scene, opt = {}) {
  const CAP = opt.capacity || 5000;

  // 粒子狀態 (平行陣列，swap-remove 壓實)
  const px = new Float32Array(CAP), py = new Float32Array(CAP), pz = new Float32Array(CAP);
  const vx = new Float32Array(CAP), vy = new Float32Array(CAP), vz = new Float32Array(CAP);
  const life = new Float32Array(CAP), maxLife = new Float32Array(CAP);
  const baseSize = new Float32Array(CAP);
  const grav = new Float32Array(CAP), drag = new Float32Array(CAP);
  const cr = new Float32Array(CAP), cg = new Float32Array(CAP), cb = new Float32Array(CAP);
  const fade = new Uint8Array(CAP); // 0: 線性 alpha, 1: 先亮後滅 (火花)
  let count = 0;

  // 幾何體屬性 (上傳 GPU)
  const aPos = new Float32Array(CAP * 3);
  const aCol = new Float32Array(CAP * 3);
  const aSize = new Float32Array(CAP);
  const aAlpha = new Float32Array(CAP);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(aPos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(aCol, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(aAlpha, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setDrawRange(0, 0);
  // 大包圍球，避免被視椎裁掉
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 5000);

  const mat = new THREE.ShaderMaterial({
    uniforms: { uDpr: { value: 1 } },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 10;
  scene.add(points);

  const _col = new THREE.Color();

  // p: { x,y,z, vx,vy,vz, life, size, color, gravity?, drag?, fade? }  (場景座標)
  function spawn(p) {
    if (count >= CAP) return;
    const i = count++;
    // 限制粒子在競技場邊界內 (HALF_W=600, HALF_H=400)，允許 +4 單位的視覺溢出緩衝
    px[i] = Math.max(-604, Math.min(604, p.x));
    py[i] = p.y;
    pz[i] = Math.max(-404, Math.min(404, p.z));
    vx[i] = p.vx || 0; vy[i] = p.vy || 0; vz[i] = p.vz || 0;
    life[i] = maxLife[i] = p.life || 0.5;
    baseSize[i] = p.size || 6;
    grav[i] = p.gravity || 0;
    drag[i] = p.drag || 0;
    fade[i] = p.fade ? 1 : 0;
    if (p.color instanceof THREE.Color) _col.copy(p.color);
    else _col.set(p.color || '#ffffff');
    cr[i] = _col.r; cg[i] = _col.g; cb[i] = _col.b;
  }

  function setDpr(dpr) { mat.uniforms.uDpr.value = dpr; }

  function update(dt) {
    let n = count;
    for (let i = 0; i < n; i++) {
      life[i] -= dt;
      if (life[i] <= 0) {
        // swap-remove
        n--;
        px[i] = px[n]; py[i] = py[n]; pz[i] = pz[n];
        vx[i] = vx[n]; vy[i] = vy[n]; vz[i] = vz[n];
        life[i] = life[n]; maxLife[i] = maxLife[n]; baseSize[i] = baseSize[n];
        grav[i] = grav[n]; drag[i] = drag[n]; fade[i] = fade[n];
        cr[i] = cr[n]; cg[i] = cg[n]; cb[i] = cb[n];
        i--; continue;
      }
      // 阻力 + 重力 (重力為 -Y)
      const f = Math.exp(-drag[i] * dt);
      vx[i] *= f; vy[i] *= f; vz[i] *= f;
      vy[i] -= grav[i] * dt;
      px[i] += vx[i] * dt; py[i] += vy[i] * dt; pz[i] += vz[i] * dt;
      // 落地反彈 (輕微)
      if (py[i] < 0) { py[i] = 0; vy[i] = -vy[i] * 0.35; vx[i] *= 0.6; vz[i] *= 0.6; }
    }
    count = n;

    // 寫入 GPU 屬性
    for (let i = 0; i < n; i++) {
      const lf = life[i] / maxLife[i]; // 1 -> 0
      aPos[i * 3] = px[i]; aPos[i * 3 + 1] = py[i]; aPos[i * 3 + 2] = pz[i];
      aCol[i * 3] = cr[i]; aCol[i * 3 + 1] = cg[i]; aCol[i * 3 + 2] = cb[i];
      // 火花：尺寸隨壽命縮小；alpha 線性
      let a = lf;
      if (fade[i]) a = lf * lf; // 尾端更快淡出
      aSize[i] = baseSize[i] * (0.35 + 0.65 * lf);
      aAlpha[i] = a;
    }
    geo.setDrawRange(0, n);
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;
    geo.attributes.aAlpha.needsUpdate = true;
  }

  function clear() { count = 0; geo.setDrawRange(0, 0); }

  function dispose() { scene.remove(points); geo.dispose(); mat.dispose(); }

  return { spawn, update, setDpr, clear, dispose, get count() { return count; }, capacity: CAP };
}
