// 視角/滑鼠設定中樞：集中管理「滑鼠靈敏度」與「反轉 Y 軸」，持久化到 localStorage。
// UI（設定面板）讀此 store 並呼叫 update；input.js（第一/第三人稱滑鼠視角）讀此 store 套用。
// 與音效設定相同的 pub/sub 形式，彼此解耦（input 屬遊戲層、UI 屬 React 層）。

export interface ViewSettings {
  /** 視角靈敏度倍率（左右轉速，套在基礎靈敏度上），0.2..3。 */
  sensitivity: number;
}

const STORAGE_KEY = 'fg-view-settings';
const DEFAULTS: ViewSettings = {
  sensitivity: 1.0,
};

function clampSens(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0.2, Math.min(3, n));
}

function loadSettings(): ViewSettings {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<ViewSettings>;
    return {
      sensitivity: clampSens(parsed.sensitivity, DEFAULTS.sensitivity),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

let state: ViewSettings = loadSettings();
const subscribers = new Set<(s: ViewSettings) => void>();

function persist(): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* localStorage 不可用（隱私模式等）→ 略過持久化 */
  }
}

/** 取得目前設定（唯讀快照）。 */
export function getViewSettings(): ViewSettings {
  return state;
}

/** 訂閱設定變更；回傳取消訂閱函式。 */
export function subscribeViewSettings(cb: (s: ViewSettings) => void): () => void {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

/** 局部更新設定 → 持久化 + 通知訂閱者（含 input）。 */
export function updateViewSettings(patch: Partial<ViewSettings>): void {
  state = {
    ...state,
    ...patch,
    sensitivity: patch.sensitivity !== undefined ? clampSens(patch.sensitivity, state.sensitivity) : state.sensitivity,
  };
  persist();
  subscribers.forEach((cb) => cb(state));
}
