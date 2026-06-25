// 視角模式橋接：讓 React 設定面板能讀取/切換戰鬥中的相機視角（0 遠景 / 1 近景三人稱 / 2 第一人稱）。
// 視角模式的權威狀態在遊戲層 controller/camera.ts；此 store 只當「UI ⇄ camera」的解耦橋：
//   ・camera 透過 publishCameraView 回報目前模式與是否在戰鬥中（含 V 鍵切換、進出戰鬥）。
//   ・camera 透過 registerCameraModeHandler 註冊接收 UI 的切換請求。
//   ・React 透過 getCameraView/subscribeCameraView 讀狀態、requestCameraMode 發出切換。
// 與 audioSettings/viewSettings 相同的 pub/sub 形式；此狀態屬戰鬥執行期（非持久化偏好），故獨立成檔。

export type CameraMode = 0 | 1 | 2;

export interface CameraView {
  /** 目前視角模式：0 遠景 / 1 近景第三人稱 / 2 第一人稱。 */
  mode: CameraMode;
  /** 是否在戰鬥中（唯有戰鬥中切換視角才有意義；UI 據此顯示/隱藏切換列）。 */
  active: boolean;
}

let state: CameraView = { mode: 0, active: false };
const subscribers = new Set<(s: CameraView) => void>();
let requestHandler: ((m: CameraMode) => void) | null = null;

/** 取得目前視角狀態（唯讀快照）。 */
export function getCameraView(): CameraView {
  return state;
}

/** 訂閱視角狀態變更；回傳取消訂閱函式。 */
export function subscribeCameraView(cb: (s: CameraView) => void): () => void {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

/** 由 camera 呼叫：回報目前狀態（局部更新）→ 通知 UI 訂閱者。 */
export function publishCameraView(patch: Partial<CameraView>): void {
  const next = { ...state, ...patch };
  if (next.mode === state.mode && next.active === state.active) return;
  state = next;
  subscribers.forEach((cb) => cb(state));
}

/** 由 camera 呼叫：註冊接收 UI 切換請求的 handler；回傳取消註冊函式。 */
export function registerCameraModeHandler(fn: (m: CameraMode) => void): () => void {
  requestHandler = fn;
  return () => { if (requestHandler === fn) requestHandler = null; };
}

/** 由 React（設定面板）呼叫：請求切換視角模式 → 轉發給 camera。 */
export function requestCameraMode(m: CameraMode): void {
  requestHandler?.(m);
}
