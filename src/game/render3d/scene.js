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
import { isConstrainedGpuDevice } from './quality.js';

const BG = '#0c0f14';

export function createSceneManager(canvas) {
  const stage = canvas.parentElement || canvas;
  const constrainedGpu = isConstrainedGpuDevice();

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !constrainedGpu, powerPreference: 'high-performance' });
  } catch (err) {
    console.warn('[render3d] WebGL init failed with preferred settings, retrying safe renderer.', err);
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'default' });
  }
  const dprCap = constrainedGpu ? 1.25 : 2;
  const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
  renderer.setPixelRatio(dpr);
  renderer.shadowMap.enabled = !constrainedGpu;
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
  dir.castShadow = !constrainedGpu;
  dir.shadow.mapSize.set(constrainedGpu ? 1024 : 2048, constrainedGpu ? 1024 : 2048);
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
  const floorGroup = buildFloor();
  scene.add(floorGroup);
  // ---- 邊界發光牆 (幫助景深 + bloom) ----
  const wallsGroup = buildWalls();
  scene.add(wallsGroup);
  // ---- 主題層 (裝飾物體 / 大氣粒子)：applyTheme 時動態組裝 ----
  const themeGroup = new THREE.Group();
  scene.add(themeGroup);
  // 預設主題 (沿用既有冷灰調)
  const DEFAULT_THEME = {
    sky: 0x0c0f14, fog: 0x0c0f14, fogNear: 1400, fogFar: 2900,
    floor: 0x9a948c, ring: 0x6f6862,
    wallStone: 0x5b5e66, wallTrim: 0x2f6dff,
    hemiSky: 0xd8e2f0, hemiGround: 0x2a2622, hemiInt: 0.35,
    sunColor: 0xffe6c4, sunInt: 2.3,
    rimColor: 0x9fb4d6, rimInt: 0.28,
    floorStyle: 'tiled', wallStyle: 'stone', wallTrimGlow: 1.1,
  };
  let activeTheme = DEFAULT_THEME;

  function applyTheme(theme) {
    const t = { ...DEFAULT_THEME, ...(theme || {}) };
    activeTheme = t;
    scene.background = new THREE.Color(t.sky);
    scene.fog = new THREE.Fog(t.fog, t.fogNear, t.fogFar);
    floorGroup.userData.floorMat.color.setHex(t.floor);
    floorGroup.userData.ringMat.color.setHex(t.ring);
    wallsGroup.userData.stoneMat.color.setHex(t.wallStone);
    wallsGroup.userData.trimMat.color.setHex(t.wallTrim);
    wallsGroup.userData.trimMat.emissive.setHex(t.wallTrim);
    hemi.color.setHex(t.hemiSky); hemi.groundColor.setHex(t.hemiGround); hemi.intensity = t.hemiInt;
    dir.color.setHex(t.sunColor); dir.intensity = t.sunInt;
    rim.color.setHex(t.rimColor); rim.intensity = t.rimInt;
    // 牆頂飾條發光強度 (0 = 關掉霓虹感)；牆體可整體隱藏
    wallsGroup.userData.trimMat.emissiveIntensity = t.wallTrimGlow != null ? t.wallTrimGlow : 1.1;
    wallsGroup.visible = t.wallStyle !== 'none';
    // 地板風格 (tiled 石磚 / mossy 有機苔蘚地)
    floorGroup.userData.applyStyle?.(t);
  }

  // ---- 泛光後處理鏈 (收斂：僅高亮特效發光，場景不過曝) ----
  let composer = null;
  let bloom = null;
  let bloomOn = !constrainedGpu;
  if (bloomOn) {
    try {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.5, 0.82);
      composer.addPass(bloom);
      const outputPass = new OutputPass();
      composer.addPass(outputPass);
    } catch (err) {
      console.warn('[render3d] Bloom post-processing disabled after init failure.', err);
      composer = null;
      bloom = null;
      bloomOn = false;
    }
  }

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
  let contextLost = false;
  const _v = new THREE.Vector3();
  const _right = new THREE.Vector3();
  const _up = new THREE.Vector3();

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    contextLost = true;
    bloomOn = false;
    console.warn('[render3d] WebGL context lost; rendering paused until the browser restores it.');
  });
  canvas.addEventListener('webglcontextrestored', () => {
    contextLost = false;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
    resize();
    console.warn('[render3d] WebGL context restored.');
  });

  function resize() {
    const w = Math.max(1, stage.clientWidth | 0);
    const h = Math.max(1, stage.clientHeight | 0);
    if (w === lastW && h === lastH) return false;
    lastW = w; lastH = h;
    renderer.setSize(w, h, false);
    composer?.setSize(w, h);
    bloom?.setSize(w, h);
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

  // 鏡頭跟隨：以 self player 為焦點，平滑 lerp；外圍邊界 clamp 避免拍到場外
  let focusX = 0, focusZ = 0;
  let curFocusX = 0, curFocusZ = 0;
  function setCameraFocus(x, z) { focusX = x; focusZ = z; }

  // 視角模式相機：1=近景第三人稱（後上方環繞、看向角色）、2=第一人稱（眼睛）。依視角 yaw(水平) / pitch(+ 仰視)
  let camMode = 0, camYaw = 0, camPitch = 0;
  function setCameraMode(mode, yaw, pitch) { camMode = mode | 0; if (camMode) { camYaw = yaw || 0; camPitch = (typeof pitch === 'number') ? pitch : 0; } }

  function update(dt) {
    time += dt;
    // 震動衰減
    shakeMag *= Math.exp(-9 * dt);
    if (shakeMag < 0.05) shakeMag = 0;
    // 閃光衰減
    flashA *= Math.exp(-6 * dt);
    if (flashA < 0.01) flashA = 0;
    flashEl.style.background = flashColor;
    flashEl.style.mixBlendMode = (flashColor === '#000000') ? 'normal' : 'screen';
    const baseOpacity = flashColor === '#000000' ? flashA : flashA * 0.85;
    flashEl.style.opacity = baseOpacity.toFixed(3);

    // 鏡頭焦點：平滑 lerp 到目標 (玩家)；clamp 在競技場縮邊內 (避免拍到場外)
    const FOLLOW_BLEND = Math.min(1, dt * 4.0); // 反應速度 (越大越貼)
    curFocusX += (focusX - curFocusX) * FOLLOW_BLEND;
    curFocusZ += (focusZ - curFocusZ) * FOLLOW_BLEND;
    const halfW = ARENA.width / 2;
    const halfH = ARENA.height / 2;
    const MARGIN_X = Math.max(0, halfW - 360);  // 鏡頭最遠可偏離中心 (留邊框可見)
    const MARGIN_Z = Math.max(0, halfH - 280);
    const cFX = Math.max(-MARGIN_X, Math.min(MARGIN_X, curFocusX));
    const cFZ = Math.max(-MARGIN_Z, Math.min(MARGIN_Z, curFocusZ));

    if (camMode === 2) {
      // 第一人稱：眼睛在頭部，朝 yaw/pitch 看出去（pitch+ = 仰視）
      const EYE_Y = 36, cp = Math.cos(camPitch);
      camera.position.set(curFocusX, EYE_Y, curFocusZ);
      camera.lookAt(
        curFocusX + Math.cos(camYaw) * cp * 200,
        EYE_Y + Math.sin(camPitch) * 200,
        curFocusZ + Math.sin(camYaw) * cp * 200,
      );
    } else if (camMode === 1) {
      // 近景第三人稱：相機在角色「後上方」、看向胸口；pitch+ = 仰視（相機下降、視線朝上），含地面下限避免穿地
      const TARGET_Y = 46, DIST = 235, cp = Math.cos(camPitch);
      const camY = Math.max(16, TARGET_Y - Math.sin(camPitch) * DIST);
      camera.position.set(
        curFocusX - Math.cos(camYaw) * cp * DIST,
        camY,
        curFocusZ - Math.sin(camYaw) * cp * DIST,
      );
      camera.lookAt(curFocusX, TARGET_Y, curFocusZ);
    } else {
      // 鏡頭：基準位置 + 焦點偏移 + 極輕微 idle 浮動 + 震動位移
      _v.copy(camBase);
      _v.x += cFX; _v.z += cFZ;
      _v.y += Math.sin(time * 0.5) * 6;
      _v.z += Math.sin(time * 0.37) * 5;
      let lookX = cFX, lookY = camTarget.y, lookZ = cFZ;
      // 登場動畫推近：覆寫焦點朝 Boss
      if (introStrength > 0) {
        const cx = introTargetX, cz = introTargetZ;
        _v.x += (cx - _v.x) * introStrength * 0.65;
        _v.y += (260 - _v.y) * introStrength * 0.55;
        _v.z += ((cz + 360) - _v.z) * introStrength * 0.65;
        lookX = cx * introStrength + lookX * (1 - introStrength);
        lookY = 60 * introStrength;
        lookZ = cz * introStrength + lookZ * (1 - introStrength);
      }
      camera.position.copy(_v);
      camera.lookAt(lookX, lookY, lookZ);
    }
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
    if (contextLost) return;
    try {
      if (bloomOn && composer) composer.render();
      else renderer.render(scene, camera);
    } catch (err) {
      if (bloomOn) {
        console.warn('[render3d] Bloom render failed; falling back to direct WebGL render.', err);
        bloomOn = false;
        renderer.render(scene, camera);
      } else {
        throw err;
      }
    }
  }

  function dispose() { renderer.dispose(); composer?.dispose?.(); flashEl.remove(); }

  return {
    scene, camera, renderer, stage,
    resize, update, render, addShake, addFlash, setBloom, setIntroFocus, setCameraFocus, setCameraMode, dispose,
    applyTheme, themeGroup,
    get time() { return time; },
    get theme() { return activeTheme; },
  };
}

function buildFloor() {
  const g = new THREE.Group();
  // 預設：石磚 (tiled)
  const tiledAlbedo = stoneTexture();
  tiledAlbedo.wrapS = tiledAlbedo.wrapT = THREE.RepeatWrapping;
  tiledAlbedo.repeat.set(ARENA.width / 200, ARENA.height / 200);
  tiledAlbedo.anisotropy = 8;
  const tiledRough = stoneRoughTexture();
  tiledRough.wrapS = tiledRough.wrapT = THREE.RepeatWrapping;
  tiledRough.repeat.set(ARENA.width / 200, ARENA.height / 200);
  const mat = new THREE.MeshStandardMaterial({
    map: tiledAlbedo, roughnessMap: tiledRough, roughness: 1.0, metalness: 0.04, color: 0x9a948c,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ARENA.width, ARENA.height), mat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);
  // 中央競技場圓紋 (低調石刻；mossy 風格時隱藏)
  const ringMat = new THREE.MeshStandardMaterial({ color: 0x6f6862, roughness: 0.85, metalness: 0.05, transparent: true, opacity: 0.6 });
  const ring = new THREE.Mesh(new THREE.RingGeometry(118, 130, 64), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.5;
  g.add(ring);

  // 場外延伸地坪：填滿邊界外的虛空 (避免外圈裝飾物懸空 / 硬邊)，遠處沒入霧中。
  // 單一大平面，極省資源；略低於場內地板、由邊界牆遮住接縫。
  const apronMat = new THREE.MeshStandardMaterial({ color: 0x3a3a34, roughness: 1.0, metalness: 0.0 });
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(7200, 7200), apronMat);
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = -1.5;
  apron.receiveShadow = true;
  g.add(apron);

  // 自然地面：mossy/organic = 苔泥；flagstone = 沼澤濕岩板；sand = 風吹沙丘。皆延遲建立並快取。
  let organicAlbedo = null, apronTex = null, flagstoneAlbedo = null, flagApronTex = null, sandAlbedo = null, sandApronTex = null;
  function applyStyle(theme) {
    const style = (theme && theme.floorStyle) || 'tiled';
    if (style === 'mossy' || style === 'organic' || style === 'flagstone' || style === 'sand') {
      let albedo, apron;
      if (style === 'flagstone') {
        if (!flagstoneAlbedo) {
          flagstoneAlbedo = swampStoneTexture();
          flagstoneAlbedo.wrapS = flagstoneAlbedo.wrapT = THREE.RepeatWrapping;
          flagstoneAlbedo.repeat.set(4, 3);
          flagstoneAlbedo.anisotropy = 8;
        }
        if (!flagApronTex) {
          flagApronTex = flagstoneAlbedo.clone();
          flagApronTex.wrapS = flagApronTex.wrapT = THREE.RepeatWrapping;
          flagApronTex.repeat.set(16, 16);
          flagApronTex.needsUpdate = true;
        }
        albedo = flagstoneAlbedo; apron = flagApronTex;
      } else if (style === 'sand') {
        if (!sandAlbedo) {
          sandAlbedo = sandDuneTexture();
          sandAlbedo.wrapS = sandAlbedo.wrapT = THREE.RepeatWrapping;
          sandAlbedo.repeat.set(3, 2);
          sandAlbedo.anisotropy = 8;
        }
        if (!sandApronTex) {
          sandApronTex = sandAlbedo.clone();
          sandApronTex.wrapS = sandApronTex.wrapT = THREE.RepeatWrapping;
          sandApronTex.repeat.set(16, 16);
          sandApronTex.needsUpdate = true;
        }
        albedo = sandAlbedo; apron = sandApronTex;
      } else {
        if (!organicAlbedo) {
          organicAlbedo = organicGroundTexture();
          organicAlbedo.wrapS = organicAlbedo.wrapT = THREE.RepeatWrapping;
          organicAlbedo.repeat.set(3, 2);
          organicAlbedo.anisotropy = 8;
        }
        if (!apronTex) {
          apronTex = organicAlbedo.clone();
          apronTex.wrapS = apronTex.wrapT = THREE.RepeatWrapping;
          apronTex.repeat.set(16, 16);
          apronTex.needsUpdate = true;
        }
        albedo = organicAlbedo; apron = apronTex;
      }
      mat.map = albedo;
      mat.roughnessMap = null;
      mat.roughness = 1.0;
      mat.metalness = 0.0;
      mat.color.setHex(theme.floorTint != null ? theme.floorTint : 0xffffff);
      ring.visible = false;
      // 外延地坪沿用同一張貼圖 (大平鋪，略暗讓視線往外沉)
      apronMat.map = apron;
      apronMat.color.setHex(theme.outerGround != null ? theme.outerGround : 0x7e8268);
    } else {
      mat.map = tiledAlbedo;
      mat.roughnessMap = tiledRough;
      mat.roughness = 1.0;
      mat.metalness = 0.04;
      mat.color.setHex(theme && theme.floor != null ? theme.floor : 0x9a948c);
      ring.visible = true;
      // 外延地坪：場內地板色壓暗 (融入霧，避免硬邊與懸空)
      apronMat.map = null;
      const fc = new THREE.Color(theme && theme.floor != null ? theme.floor : 0x9a948c);
      fc.multiplyScalar(0.6);
      apronMat.color.copy(fc);
    }
    mat.needsUpdate = true;
    apronMat.needsUpdate = true;
  }

  g.userData.floorMat = mat;
  g.userData.ringMat = ringMat;
  g.userData.applyStyle = applyStyle;
  return g;
}

// 有機地面 albedo：潮濕泥岩 + 苔斑 + 落葉暗斑 + 砂礫 + 不規則裂縫 (無格線/無磚縫)
function organicGroundTexture() {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  x.fillStyle = '#4f4d3b';
  x.fillRect(0, 0, S, S);
  // 大面積柔邊色斑 (徑向漸層、可跨越邊界 wrap 無縫感)
  const blob = (cols, n, rmin, rmax, amax) => {
    for (let i = 0; i < n; i++) {
      const px = Math.random() * S, py = Math.random() * S;
      const r = rmin + Math.random() * (rmax - rmin);
      const col = cols[(Math.random() * cols.length) | 0];
      for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) { // wrap 平鋪 3x3 讓邊界連續
        const grd = x.createRadialGradient(px + dx, py + dy, 0, px + dx, py + dy, r);
        grd.addColorStop(0, `rgba(${col},${(0.1 + Math.random() * amax).toFixed(2)})`);
        grd.addColorStop(1, `rgba(${col},0)`);
        x.fillStyle = grd;
        x.beginPath(); x.arc(px + dx, py + dy, r, 0, 7); x.fill();
      }
    }
  };
  blob(['74,110,52', '90,125,58', '58,90,40'], 26, 50, 150, 0.34);  // 苔綠
  blob(['62,50,34', '46,38,26', '72,58,38'], 20, 40, 120, 0.3);     // 泥土/落葉
  blob(['140,134,116', '120,116,100'], 14, 30, 95, 0.2);            // 磨損淺石
  // 細苔點 + 砂礫
  for (let i = 0; i < 1500; i++) { const v = 70 + (Math.random() * 70 | 0); x.fillStyle = `rgba(${v - 14},${v + 22},${v - 34},0.16)`; x.fillRect(Math.random() * S, Math.random() * S, 2, 2); }
  for (let i = 0; i < 1000; i++) { const v = 28 + (Math.random() * 40 | 0); x.fillStyle = `rgba(${v},${v - 4},${v - 10},0.22)`; x.fillRect(Math.random() * S, Math.random() * S, 2, 2); }
  // 不規則裂縫 (稀疏、非格線)
  x.strokeStyle = 'rgba(26,22,16,0.5)'; x.lineCap = 'round';
  for (let i = 0; i < 11; i++) {
    x.lineWidth = 1 + Math.random() * 2;
    x.beginPath();
    let cx = Math.random() * S, cy = Math.random() * S, a = Math.random() * 7;
    x.moveTo(cx, cy);
    const segs = 4 + (Math.random() * 5 | 0);
    for (let s = 0; s < segs; s++) { a += (Math.random() - 0.5) * 1.2; cx += Math.cos(a) * (15 + Math.random() * 28); cy += Math.sin(a) * (15 + Math.random() * 28); x.lineTo(cx, cy); }
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 風吹沙丘 albedo：暖金沙底 + 沙丘明暗起伏 + 風紋波痕（正弦整數頻→無縫平鋪）+ 細沙顆粒 + 稀疏裸露硬地。無格線、非磚。
function sandDuneTexture() {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  x.fillStyle = '#c4a36a';
  x.fillRect(0, 0, S, S);
  // 大面積柔邊色斑 (wrap 平鋪 3x3 讓邊界連續)：沙丘受光面 / 背光陰影
  const blob = (cols, n, rmin, rmax, amax) => {
    for (let i = 0; i < n; i++) {
      const px = Math.random() * S, py = Math.random() * S;
      const r = rmin + Math.random() * (rmax - rmin);
      const col = cols[(Math.random() * cols.length) | 0];
      for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) {
        const grd = x.createRadialGradient(px + dx, py + dy, 0, px + dx, py + dy, r);
        grd.addColorStop(0, `rgba(${col},${(0.1 + Math.random() * amax).toFixed(2)})`);
        grd.addColorStop(1, `rgba(${col},0)`);
        x.fillStyle = grd;
        x.beginPath(); x.arc(px + dx, py + dy, r, 0, 7); x.fill();
      }
    }
  };
  blob(['216,189,134', '198,170,116', '230,205,150'], 20, 70, 185, 0.3); // 受光沙丘亮面
  blob(['150,120,76', '130,102,64'], 16, 60, 165, 0.28);                 // 背光沙丘陰影
  // 風紋波痕：橫向波浪線（正弦整數頻→水平無縫），亮稜 + 緊鄰暗槽，堆疊成沙的條紋肌理
  const rows = 22;
  for (let r = 0; r < rows; r++) {
    const baseY = (r + 0.5) / rows * S;
    const freq = 2 + (r % 3);                    // 整數頻率 → 左右接續無縫
    const amp = 6 + Math.random() * 10;
    const phase = Math.random() * Math.PI * 2;
    for (const [dy, col, al, lw] of [[0, '236,214,160', 0.16, 2.4], [3.4, '150,120,74', 0.13, 2.0]]) {
      x.strokeStyle = `rgba(${col},${al})`; x.lineWidth = lw; x.lineCap = 'round';
      x.beginPath();
      for (let px = 0; px <= S; px += 6) {
        const py = baseY + dy + Math.sin(px / S * Math.PI * 2 * freq + phase) * amp;
        if (px === 0) x.moveTo(px, py); else x.lineTo(px, py);
      }
      x.stroke();
    }
  }
  // 細沙顆粒
  for (let i = 0; i < 2600; i++) { const v = 175 + (Math.random() * 55 | 0); x.fillStyle = `rgba(${v},${v - 22},${v - 58},0.05)`; x.fillRect(Math.random() * S, Math.random() * S, 2, 2); }
  // 稀疏裸露硬地暗斑（少量點綴，增加變化、非裂網）
  blob(['120,96,60', '100,80,50'], 4, 40, 85, 0.22);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 沼澤濕岩板 albedo：風化灰綠石 + 苔斑 + 濕暗水漬 + 礦物碎屑 + 不規則裂縫 (無格線/無磚縫，非大理石)
function swampStoneTexture() {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  x.fillStyle = '#5a6058';
  x.fillRect(0, 0, S, S);
  // 大面積柔邊色斑 (wrap 平鋪 3x3 讓邊界連續)
  const blob = (cols, n, rmin, rmax, amax) => {
    for (let i = 0; i < n; i++) {
      const px = Math.random() * S, py = Math.random() * S;
      const r = rmin + Math.random() * (rmax - rmin);
      const col = cols[(Math.random() * cols.length) | 0];
      for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) {
        const grd = x.createRadialGradient(px + dx, py + dy, 0, px + dx, py + dy, r);
        grd.addColorStop(0, `rgba(${col},${(0.12 + Math.random() * amax).toFixed(2)})`);
        grd.addColorStop(1, `rgba(${col},0)`);
        x.fillStyle = grd;
        x.beginPath(); x.arc(px + dx, py + dy, r, 0, 7); x.fill();
      }
    }
  };
  blob(['108,114,104', '86,92,84', '120,126,112'], 22, 60, 150, 0.3);  // 風化亮/暗石面
  blob(['60,82,44', '74,96,52', '50,68,38'], 18, 40, 120, 0.34);       // 苔綠斑
  blob(['38,42,38', '28,32,28'], 14, 30, 95, 0.3);                     // 濕暗水漬
  // 礦物碎屑 + 砂礫
  for (let i = 0; i < 2200; i++) { const v = 70 + (Math.random() * 60 | 0); x.fillStyle = `rgba(${v},${v + 6},${v - 4},0.06)`; x.fillRect(Math.random() * S, Math.random() * S, 2, 2); }
  // 不規則裂縫 (石板裂界，非格線)
  x.strokeStyle = 'rgba(20,24,20,0.55)'; x.lineCap = 'round';
  for (let i = 0; i < 16; i++) {
    x.lineWidth = 1 + Math.random() * 2.5;
    x.beginPath();
    let cx = Math.random() * S, cy = Math.random() * S, a = Math.random() * 7;
    x.moveTo(cx, cy);
    const segs = 4 + (Math.random() * 6 | 0);
    for (let s = 0; s < segs; s++) { a += (Math.random() - 0.5) * 1.0; cx += Math.cos(a) * (22 + Math.random() * 40); cy += Math.sin(a) * (22 + Math.random() * 40); x.lineTo(cx, cy); }
    x.stroke();
  }
  // 裂縫旁滲出的苔綠 (柔線)
  x.strokeStyle = 'rgba(70,104,40,0.4)';
  for (let i = 0; i < 8; i++) {
    x.lineWidth = 2 + Math.random() * 3;
    x.beginPath();
    let cx = Math.random() * S, cy = Math.random() * S, a = Math.random() * 7;
    x.moveTo(cx, cy);
    for (let s = 0; s < 4; s++) { a += (Math.random() - 0.5) * 1.1; cx += Math.cos(a) * (20 + Math.random() * 36); cy += Math.sin(a) * (20 + Math.random() * 36); x.lineTo(cx, cy); }
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
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
  g.userData.stoneMat = stone;
  g.userData.trimMat = trim;
  return g;
}
