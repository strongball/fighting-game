// 權威模擬：僅由房主執行。applyMovement 也供加入者本機預測使用。

import { applyMovement, speedOf } from './systems/movement.ts';
import { runPlayerPipeline, runWorldPipeline } from './systems/pipeline/index.ts';
import type { GameState, Input } from './types';

export { applyMovement, speedOf };

// 一個固定步的權威模擬
export function step(state: GameState, inputs: Record<string, Input>, dt: number) {
  if (state.phase !== 'playing') return;
  // 慢動作：擊破 Boss 時觸發，dt 縮放但 remaining 用實際 dt 倒數。
  const tf = state.timeFreeze;
  if (tf && tf.remaining > 0) {
    tf.remaining -= dt;
    dt = dt * (tf.scale || 0.3);
    if (tf.remaining <= 0) state.timeFreeze = null;
  }
  state.time += dt;

  runPlayerPipeline(state, inputs, dt);
  runWorldPipeline(state, dt);
}
