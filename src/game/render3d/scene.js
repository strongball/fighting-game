// 場景管理：WebGLRenderer + 透視鏡頭 + 燈光/陰影 + 地板/邊界 + 泛光後處理 + 震動/閃光
//
// 對外介面：
//   createSceneManager(canvas) -> {
//     scene, camera, renderer, stage,
//     resize(), update(dt), render(),
//     addShake(mag), addFlash(alpha, color),
//     setBloom(on), time
//   }

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ARENA } from '../constants.js';

const BG = '#0c0f14';

export function createSceneManager(canvas) {
  const stage = canvas.parentElement || canvas;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 1400, 2900);

  // ---- 影像式環境光 (IBL)：金屬/盔甲真實反射 ----
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new RoomEnvironment();
  scene.environment = pmrem.fromScene(envScene, 0.04).texture;
  if ('environmentIntensity' in scene) scene.environmentIntensity = 0.45;
  envScene.dispose();

  const camera = new THREE.PerspectiveCamera(52, 16 / 9, 1, 8000);
  // 固定全場框取 (不跟隨)；拉近視角；俯視傾斜更陡
  const camBase = new THREE.Vector3(0, 600, 780);
  const camTarget = new THREE.Vector3(0, 0, 0);
  camera.position.copy(camBase);
  camera.lookAt(camTarget);

  // ---- 燈光 (自然光為主：暖陽主光 + 微弱天空補光) ----
  const hemi = new THREE.HemisphereLight(0xd8e2f0, 0x2a2622, 0.35);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffe6c4, 2.3);
  dir.position.set(420, 1080, 360);
  dir.target.position.set(0, 0, 0);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  dir.shadow.camera.near = 200;
  dir.shadow.camera.far = 2600;
  dir.shadow.camera.left = -820;
  dir.shadow.camera.right = 820;
  dir.shadow.camera.top = 820;
  dir.shadow.camera.bottom = -820;
  dir.shadow.bias = -0.0004;
  dir.shadow.normalBias = 1.2;
  scene.add(dir);
  scene.add(dir.target);
  // 補一盞冷色背光增加輪廓 (低強度，避免霓虹感)
  const rim = new THREE.DirectionalLight(0x9fb4d6, 0.28);
  rim.position.set(-420, 320, -560);
  scene.add(rim);

  // ---- 地板 (格線材質) ----
  scene.add(buildFloor());
  // ---- 邊界發光牆 (幫助景深 + bloom) ----
  scene.add(buildWalls());

  // ---- 泛光後處理鏈 (收斂：僅高亮特效發光，場景不過曝) ----
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.5, 0.82);
  composer.addPass(bloom);
  const outputPass = new OutputPass();
  composer.addPass(outputPass);
  let bloomOn = true;

  // ---- 全畫面命中閃光 (DOM overlay，mix-blend screen) ----
  const flashEl = document.createElement('div');
  flashEl.style.cssText =
    'position:absolute;inset:0;pointer-events:none;z-index:5;opacity:0;mix-blend-mode:screen;background:#fff;';
  stage.appendChild(flashEl);

  // ---- 狀態 ----
  let time = 0;
  let shakeMag = 0;
  let flashA = 0;
  let flashColor = '#ffffff';
  let lastW = 0, lastH = 0;
  const _v = new THREE.Vector3();
  const _right = new THREE.Vector3();
  const _up = new THREE.Vector3();

  function resize() {
    const w = Math.max(1, stage.clientWidth | 0);
    const h = Math.max(1, stage.clientHeight | 0);
    if (w === lastW && h === lastH) return false;
    lastW = w; lastH = h;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    return true;
  }

  function addShake(mag) { shakeMag = Math.min(46, shakeMag + mag); }
  function addFlash(a, color = '#ffffff') {
    if (a > flashA) { flashA = Math.min(1, a); flashColor = color; }
  }
  function setBloom(on) { bloomOn = !!on; } // render() 內依旗標選擇 composer / 直接渲染

  // 登場動畫鏡頭：strength 0..1，1 = 完全推近到 target
  let introStrength = 0;
  let introTargetX = 0, introTargetZ = 0;
  function setIntroFocus(strength, targetX = 0, targetZ = 0) {
    introStrength = Math.max(0, Math.min(1, strength));
    introTargetX = targetX;
    introTargetZ = targetZ;
  }

  function update(dt) {
    time += dt;
    // 震動衰減
    shakeMag *= Math.exp(-9 * dt);
    if (shakeMag < 0.05) shakeMag = 0;
    // 閃光衰減
    flashA *= Math.exp(-6 * dt);
    if (flashA < 0.01) flashA = 0;
    flashEl.style.background = flashColor;
    flashEl.style.opacity = (flashA * 0.85).toFixed(3);

    // 鏡頭：基準位置 + 極輕微 idle 浮動 + 震動位移 (沿螢幕 right/up)
    _v.copy(camBase);
    _v.y += Math.sin(time * 0.5) * 6;
    _v.z += Math.sin(time * 0.37) * 5;
    // 登場動畫推近：向 (introTargetX, 200, introTargetZ+360) 內插，並把 lookAt 也朝 Boss
    let lookX = camTarget.x, lookY = camTarget.y, lookZ = camTarget.z;
    if (introStrength > 0) {
      const cx = introTargetX, cz = introTargetZ;
      _v.x += (cx - _v.x) * introStrength * 0.65;
      _v.y += (260 - _v.y) * introStrength * 0.55;
      _v.z += ((cz + 360) - _v.z) * introStrength * 0.65;
      lookX = cx * introStrength;
      lookY = 60 * introStrength;
      lookZ = cz * introStrength;
    }
    camera.position.copy(_v);
    camera.lookAt(lookX, lookY, lookZ);
    if (shakeMag > 0) {
      // 取相機座標系的 right / up
      _right.setFromMatrixColumn(camera.matrixWorld, 0);
      _up.setFromMatrixColumn(camera.matrixWorld, 1);
      const sx = (Math.random() * 2 - 1) * shakeMag;
      const sy = (Math.random() * 2 - 1) * shakeMag;
      camera.position.addScaledVector(_right, sx);
      camera.position.addScaledVector(_up, sy);
    }
  }

  function render() {
    if (bloomOn) composer.render();
    else renderer.render(scene, camera);
  }

  function dispose() { renderer.dispose(); composer.dispose?.(); flashEl.remove(); }

  return {
    scene, camera, renderer, stage,
    resize, update, render, addShake, addFlash, setBloom, setIntroFocus, dispose,
    get time() { return time; },
  };
}

function buildFloor() {
  const g = new THREE.Group();
  const albedo = stoneTexture();
  albedo.wrapS = albedo.wrapT = THREE.RepeatWrapping;
  albedo.repeat.set(ARENA.width / 200, ARENA.height / 200);
  albedo.anisotropy = 8;
  const rough = stoneRoughTexture();
  rough.wrapS = rough.wrapT = THREE.RepeatWrapping;
  rough.repeat.set(ARENA.width / 200, ARENA.height / 200);
  const mat = new THREE.MeshStandardMaterial({
    map: albedo, roughnessMap: rough, roughness: 1.0, metalness: 0.04, color: 0x9a948c,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ARENA.width, ARENA.height), mat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);
  // 中央競技場圓紋 (低調石刻)
  const ringMat = new THREE.MeshStandardMaterial({ color: 0x6f6862, roughness: 0.85, metalness: 0.05, transparent: true, opacity: 0.6 });
  const ring = new THREE.Mesh(new THREE.RingGeometry(118, 130, 64), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.5;
  g.add(ring);
  return g;
}

// 石材地磚 albedo：暖灰底 + 磚縫 + 雜訊斑駁
function stoneTexture() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  x.fillStyle = '#8c8780';
  x.fillRect(0, 0, S, S);
  // 斑駁雜訊
  for (let i = 0; i < 2600; i++) {
    const v = 120 + (Math.random() * 70) | 0;
    x.fillStyle = `rgba(${v},${v - 6},${v - 14},0.05)`;
    const r = 1 + Math.random() * 3;
    x.fillRect(Math.random() * S, Math.random() * S, r, r);
  }
  // 2x2 石磚 + 磚縫
  x.strokeStyle = 'rgba(40,36,32,0.55)';
  x.lineWidth = 4;
  for (const p of [0, S / 2]) {
    x.strokeRect(p + 2, 2, S / 2 - 4, S / 2 - 4);
    x.strokeRect(p + 2, S / 2 + 2, S / 2 - 4, S / 2 - 4);
  }
  // 縫邊高光
  x.strokeStyle = 'rgba(210,205,195,0.10)';
  x.lineWidth = 1;
  for (const p of [0, S / 2]) {
    x.strokeRect(p + 4, 4, S / 2 - 8, S / 2 - 8);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 粗糙度貼圖：磚縫較粗糙、磚面較平滑 (亮=粗糙)
function stoneRoughTexture() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  x.fillStyle = '#b8b8b8';
  x.fillRect(0, 0, S, S);
  x.strokeStyle = '#ffffff';
  x.lineWidth = 5;
  for (const p of [0, S / 2]) {
    x.strokeRect(p + 2, 2, S / 2 - 4, S / 2 - 4);
    x.strokeRect(p + 2, S / 2 + 2, S / 2 - 4, S / 2 - 4);
  }
  for (let i = 0; i < 1500; i++) {
    const v = 150 + (Math.random() * 90) | 0;
    x.fillStyle = `rgba(${v},${v},${v},0.06)`;
    x.fillRect(Math.random() * S, Math.random() * S, 2, 2);
  }
  const t = new THREE.CanvasTexture(c);
  return t;
}

function buildWalls() {
  const g = new THREE.Group();
  const W = ARENA.width, H = ARENA.height, t = 16, h = 34;
  // 石材/金屬牆體 (受 IBL 反射，低自體發光)
  const stone = new THREE.MeshStandardMaterial({ color: 0x5b5e66, roughness: 0.7, metalness: 0.35 });
  // 牆頂細發光飾條 (唯一刻意發光處，供 bloom 點綴)
  const trim = new THREE.MeshStandardMaterial({ color: 0x244a6b, emissive: 0x2f6dff, emissiveIntensity: 1.1, roughness: 0.5, metalness: 0.4 });
  const mk = (w, d, x, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stone);
    m.position.set(x, h / 2, z);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
    const tr = new THREE.Mesh(new THREE.BoxGeometry(w, 3, d * 0.5), trim);
    tr.position.set(x, h + 1, z);
    g.add(tr);
  };
  mk(W + t * 2, t, 0, -H / 2);
  mk(W + t * 2, t, 0, H / 2);
  mk(t, H, -W / 2, 0);
  mk(t, H, W / 2, 0);
  return g;
}
