// HUD 共用 DOM 小工具（純函式，供 hud.js 與各 hud widget 共用）。
//
// setText/setStyle/setClass/setHtml 皆「只在值真的改變時才寫 DOM」，避免每幀重複寫入
// textContent/style/innerHTML 造成不必要的 reflow/repaint（在 DevTools 會看到元素瘋狂閃爍）。

export function el(tag, cls, parent) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (parent) parent.appendChild(e);
  return e;
}
export function setText(e, v) { if (e._txt !== v) { e._txt = v; e.textContent = v; } }
export function setStyle(e, k, v) { const p = '_st_' + k; if (e[p] !== v) { e[p] = v; e.style[k] = v; } }
export function setClass(e, v) { if (e._cls !== v) { e._cls = v; e.className = v; } }
export function setHtml(e, v) { if (e._html !== v) { e._html = v; e.innerHTML = v; } }
export function pct(r) { return `${Math.max(0, Math.min(1, r)) * 100}%`; }
export function hexA(hex, a) { const h = hex.replace('#', ''); const s = h.length === 3 ? h.split('').map((c) => c + c).join('') : h; const n = parseInt(s, 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
export function lighten(hex, t) { const h = hex.replace('#', ''); const s = h.length === 3 ? h.split('').map((c) => c + c).join('') : h; const n = parseInt(s, 16); const m = (c) => Math.round(c + (255 - c) * t); return `rgb(${m((n >> 16) & 255)},${m((n >> 8) & 255)},${m(n & 255)})`; }
export function esc(s) { return String(s).replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m])); }
