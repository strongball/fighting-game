// 視角模式（本機視覺/操作，不進網路協定）：0=一般遠景 1=近景第三人稱 2=第一人稱，V 循環。
// 含滑鼠鎖定（pointer lock）控視角與準心 DOM。
//
// 從 controller 抽出：這整塊是純本機 UI/輸入互動、與模擬/網路無關，獨立後鏡頭相關調整不再撞主檔。
// 用法：const cam = createCamera({ input, getCanvasEl, isRunning, getSelfFacing });
//   attachCanvas → cam.bindViewControls()
//   stopLoop     → cam.reset()        // 離開戰鬥回到遠景

interface CameraDeps {
  input: any;
  getCanvasEl: () => HTMLCanvasElement | null;
  isRunning: () => boolean;
  getSelfFacing: () => number;
}

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

  function applyViewMode(mode: number) {
    mode = ((mode % 3) + 3) % 3;
    if (mode === viewMode) return;
    const wasNormal = viewMode === 0;
    viewMode = mode;
    const canvasEl = getCanvasEl();
    if (mode !== 0) {
      ensureCrosshair();
      // 由遠景進入時以自身朝向初始化視角；近景預設稍俯視、第一人稱平視（模式間切換則保留視角）
      if (wasNormal) input.setLook(getSelfFacing(), mode === 1 ? -0.35 : 0);
      input.setViewMode(mode);
      if (crosshairEl) crosshairEl.style.display = 'flex';
      if (!document.pointerLockElement) canvasEl?.requestPointerLock?.();
    } else {
      input.setViewMode(0);
      if (crosshairEl) crosshairEl.style.display = 'none';
      if (document.pointerLockElement) document.exitPointerLock();
    }
  }

  function bindViewControls() {
    if (chaseBound) return;
    chaseBound = true;
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

  return { applyViewMode, bindViewControls, reset };
}
