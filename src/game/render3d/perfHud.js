// 開發用效能浮層：在網址加 ?perf=1 開啟（手機也能開）。即時顯示 FPS / draw call /
// 三角形 / 貼圖數 / 幾何數 / shader program 數 + 當前關卡與階段。
//
// 怎麼用來定位卡頓：
//   - 「tex (max …)」每換一關持續往上爬 → 貼圖洩漏沒修好（或測的不是含修正的版本）。
//   - FPS 只在「轉場那一下」掉、之後回穩 → 是建場 CPU 尖峰（建幾何）。
//   - 進到某關 FPS 持續偏低 → 是該關穩態負擔（draw call / overdraw）。
export function createPerfHud(sceneMgr, stage) {
  if (typeof window === 'undefined') return null;
  let q;
  try { q = new URLSearchParams(window.location.search); } catch { return null; }
  if (!q.has('perf')) return null;

  const el = document.createElement('div');
  el.style.cssText = [
    'position:absolute', 'top:6px', 'left:6px', 'z-index:50', 'pointer-events:none',
    'font:11px/1.35 ui-monospace,Menlo,Consolas,monospace', 'color:#9effa0',
    'background:rgba(0,0,0,0.62)', 'padding:5px 8px', 'border-radius:6px',
    'white-space:pre', 'text-shadow:0 1px 0 #000', 'min-width:150px',
  ].join(';');
  (stage || document.body).appendChild(el);

  const renderer = sceneMgr.renderer;
  let acc = 0, frames = 0, fps = 0;
  let worst = 999, worstWin = 0;
  let maxTex = 0, maxGeo = 0;

  function tick(dt, state) {
    frames++; acc += dt;
    const inst = dt > 0 ? 1 / dt : 0;
    if (inst < worst) worst = inst;
    worstWin += dt;
    if (acc >= 0.5) { fps = frames / acc; acc = 0; frames = 0; }
    if (worstWin >= 2) { worst = inst; worstWin = 0; }   // 每 2 秒重置「最差幀」視窗

    const info = renderer.info;
    const tex = info.memory.textures, geo = info.memory.geometries;
    if (tex > maxTex) maxTex = tex;
    if (geo > maxGeo) maxGeo = geo;

    el.style.color = (fps && fps < 30) ? '#ff7a7a' : '#9effa0';
    el.textContent =
      `FPS ${fps.toFixed(0)}  (min ${worst === 999 ? '-' : worst.toFixed(0)})\n` +
      `calls ${info.render.calls}  tri ${(info.render.triangles / 1000).toFixed(1)}k\n` +
      `tex ${tex}  (max ${maxTex})\n` +
      `geo ${geo}  (max ${maxGeo})\n` +
      `prog ${info.programs ? info.programs.length : '-'}\n` +
      `R${state?.round ?? '-'} ${state?.roundPhase ?? '-'} / ${state?.mode ?? '-'}`;
  }

  return { tick };
}
