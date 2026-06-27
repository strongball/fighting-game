// 裝置 GPU 能力偵測（單次評估後快取）：手機 / 粗指標 / 小螢幕 → 視為低階 GPU。
// 供 scene.js（關陰影、降 DPR、關 bloom）與各裝飾 builder（降道具數量、砍透明 overdraw）共用，
// 避免每個檔案各自重寫一份偵測邏輯而漂移。
let _low = null;

export function isConstrainedGpuDevice() {
  if (_low != null) return _low;
  if (typeof window === 'undefined') { _low = false; return _low; }
  const coarse = window.matchMedia?.('(hover: none), (pointer: coarse), (max-width: 820px)')?.matches;
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  _low = !!coarse || /Android|iPhone|iPad|iPod/i.test(ua);
  return _low;
}

// 給 builder 直接 import 的布林常數（裝飾在進關時才建立，此時 window 必定存在）。
export const LOW_GPU = isConstrainedGpuDevice();
