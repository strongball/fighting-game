// 開發用效能浮層：在網址加 ?perf=1 開啟（手機也能開）。
//
// 重點：FPS 用「真實牆鐘時間」量（performance.now），不吃引擎把 dt 鎖在 0.05s 的上限，
// 所以低於 20fps 也照實顯示。另外拆出 cpu(render 的 JS 執行時間) vs gpu/wait(其餘)，
// 用來判斷瓶頸：
//   - cpu ≈ frame  → CPU 綁死（JS 太重）→ 要優化邏輯/同步，不是降畫質。
//   - cpu ≪ frame  → GPU 綁死（多半是 overdraw/fill-rate）→ 降 DPR、砍透明特效。
export function createPerfHud(sceneMgr, stage) {
  if (typeof window === 'undefined') return null;
  let q;
  try { q = new URLSearchParams(window.location.search); } catch { return null; }
  if (!q.has('perf')) return null;

  const el = document.createElement('div');
  el.style.cssText = [
    'position:absolute', 'top:6px', 'left:6px', 'z-index:50', 'pointer-events:none',
    'font:11px/1.35 ui-monospace,Menlo,Consolas,monospace', 'color:#9effa0',
    'background:rgba(0,0,0,0.66)', 'padding:5px 8px', 'border-radius:6px',
    'white-space:pre', 'text-shadow:0 1px 0 #000', 'min-width:168px',
  ].join(';');
  (stage || document.body).appendChild(el);

  const renderer = sceneMgr.renderer;
  let last = 0, renderStart = 0;
  let acc = 0, cpuAcc = 0, frames = 0;
  let fps = 0, frameMs = 0, cpuMs = 0;
  let worstMs = 0, worstWin = 0;

  // render() 一開始呼叫，標記 CPU 計時起點
  function markStart() { renderStart = performance.now(); }

  // render() 最後呼叫
  function tick(_dt, state) {
    const now = performance.now();
    const fMs = last ? now - last : 16.7;            // 真實幀間隔（含 GPU/vsync 等待）
    const cMs = renderStart ? now - renderStart : 0; // render() 的 JS 執行時間（CPU）
    last = now;
    frames++; acc += fMs; cpuAcc += cMs;
    if (fMs > worstMs) worstMs = fMs;
    worstWin += fMs;
    if (acc >= 500) { fps = frames * 1000 / acc; frameMs = acc / frames; cpuMs = cpuAcc / frames; acc = 0; cpuAcc = 0; frames = 0; }
    if (worstWin >= 2000) { worstMs = fMs; worstWin = 0; }

    const info = renderer.info;
    const gpuMs = Math.max(0, frameMs - cpuMs);
    el.style.color = (fps && fps < 30) ? '#ff7a7a' : '#9effa0';
    el.textContent =
      `FPS ${fps.toFixed(0)}  frame ${frameMs.toFixed(0)}ms (worst ${worstMs.toFixed(0)})\n` +
      `cpu ${cpuMs.toFixed(0)}ms   gpu/wait ${gpuMs.toFixed(0)}ms\n` +
      `calls ${info.render.calls}  tri ${(info.render.triangles / 1000).toFixed(1)}k\n` +
      `tex ${info.memory.textures}  geo ${info.memory.geometries}  prog ${info.programs ? info.programs.length : '-'}\n` +
      `R${state?.round ?? '-'} ${state?.roundPhase ?? '-'} / ${state?.mode ?? '-'}`;
  }

  return { tick, markStart };
}
