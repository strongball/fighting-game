// 視角模式（本機視覺/操作，不進網路協定）：0=一般遠景 1=近景第三人稱 2=第一人稱，V 循環。
// 含滑鼠鎖定（pointer lock）控視角與準心 DOM。
//
// 從 controller 抽出：這整塊是純本機 UI/輸入互動、與模擬/網路無關，獨立後鏡頭相關調整不再撞主檔。
// 也透過 cameraView store 與 React 設定面板雙向溝通：發佈目前模式/戰鬥狀態、接收面板的切換請求。
// 用法：const cam = createCamera({ input, getCanvasEl, isRunning, getSelfFacing });
//   attachCanvas → cam.bindViewControls()
//   start/stop   → cam.setBattleActive(true/false)
//   stopLoop     → cam.reset()        // 離開戰鬥回到遠景

import { publishCameraView, registerCameraModeHandler, type CameraMode } from '../../utils/cameraView';

interface CameraDeps {
  input: any;
  getCanvasEl: () => HTMLCanvasElement | null;
  isRunning: () => boolean;
  getSelfFacing: () => number;
}

// 觸控裝置（手機/平板）無滑鼠鎖定：改用畫面上的虛擬「轉視角搖桿」控視角，故跳過 pointer lock 與其準心提示。
const IS_TOUCH = typeof window !== 'undefined' &&
  (('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0);

// 俯仰角鎖定：各模式固定一個舒適角度，玩家只能左右轉、不能上下擺 —— 避免上下視角晃動造成的暈眩。
const CHASE_PITCH = -0.35; // 近景第三人稱：稍微俯視
const FP_PITCH = 0;        // 第一人稱：平視

export function createCamera({ input, getCanvasEl, isRunning, getSelfFacing }: CameraDeps) {
  let viewMode = 0;
  let crosshairEl: HTMLDivElement | null = null;
  let chaseBound = false;

  function ensureCrosshair() {
    const canvasEl = getCanvasEl();
    if (crosshairEl || !canvasEl) return;
    const host = canvasEl.parentElement || document.body;
    const el = document.createElement('div');
    el.className = 'chase-crosshair';
    el.style.display = 'none';
    el.innerHTML = '<div class="chase-cross-dot"></div>';
    host.appendChild(el);
    crosshairEl = el;
  }

  // opts.lock：進入視角模式時是否立即搶滑鼠鎖定。V 鍵切換 true（鍵盤手勢可直接鎖）；
  // 設定面板切換 false（面板蓋在畫面上，立即鎖會讓游標消失而無法操作；改由關閉面板後點畫布再鎖）。
  function applyViewMode(mode: number, opts: { lock?: boolean } = {}) {
    mode = ((mode % 3) + 3) % 3;
    if (mode === viewMode) return;
    const wantLock = opts.lock !== false && !IS_TOUCH;
    const wasNormal = viewMode === 0;
    viewMode = mode;
    const canvasEl = getCanvasEl();
    if (mode !== 0) {
      ensureCrosshair();
      // 俯仰角鎖定：每次進入都套用該模式的固定俯仰（近景稍俯視 / 第一人稱平視），確保切換後角度一致。
      // 水平視角只在「由遠景進入」時以自身朝向初始化；模式間切換則保留水平、僅改俯仰。
      const lockedPitch = mode === 1 ? CHASE_PITCH : FP_PITCH;
      if (wasNormal) input.setLook(getSelfFacing(), lockedPitch);
      else input.setLook(undefined, lockedPitch);
      input.setViewMode(mode);
      if (crosshairEl) {
        crosshairEl.style.display = 'flex';
        // 觸控裝置無鎖定概念，準心常亮；桌機未鎖定時準心轉淡，提示「點畫布鎖定」
        crosshairEl.classList.toggle('unlocked', !IS_TOUCH && !document.pointerLockElement);
      }
      if (wantLock && !document.pointerLockElement) canvasEl?.requestPointerLock?.();
    } else {
      input.setViewMode(0);
      if (crosshairEl) crosshairEl.style.display = 'none';
      if (document.pointerLockElement) document.exitPointerLock();
    }
    publishCameraView({ mode: viewMode as CameraMode });
  }

  function bindViewControls() {
    if (chaseBound) return;
    chaseBound = true;
    // 設定面板的切換請求：直接套用，但不立即鎖游標（lock:false），由玩家關面板後點畫布再鎖
    registerCameraModeHandler((m) => { if (isRunning()) applyViewMode(m, { lock: false }); });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyV' && isRunning() && !e.repeat) { e.preventDefault(); applyViewMode(viewMode + 1); }
    });
    // 視角模式下若滑鼠未鎖定，點「畫布」重新鎖定（限定 canvas，避免點選單/按鈕時誤搶游標）
    window.addEventListener('mousedown', (e) => {
      const canvasEl = getCanvasEl();
      if (viewMode !== 0 && isRunning() && !document.pointerLockElement && e.target === canvasEl) canvasEl?.requestPointerLock?.();
    });
    // 鎖定被解除（Esc/切窗）時更新準心提示樣式
    document.addEventListener('pointerlockchange', () => {
      if (crosshairEl) crosshairEl.classList.toggle('unlocked', viewMode !== 0 && !document.pointerLockElement);
    });
  }

  // 離開戰鬥時回到一般遠景視角。
  function reset() { applyViewMode(0); }

  // 戰鬥開始/結束：回報給設定面板，決定是否顯示「視角」切換列。
  function setBattleActive(active: boolean) { publishCameraView({ active }); }

  return { applyViewMode, bindViewControls, reset, setBattleActive };
}
