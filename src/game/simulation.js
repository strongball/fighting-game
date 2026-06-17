// 權威模擬：僅由房主執行。applyMovement 也供加入者本機預測使用。

import { getCharacter } from './characters.js';
import { EMPTY_INPUT } from './input.js';
import { computeBossInput } from './bossAI.js';
import { bossTick, checkBossRound } from './bossMode.js';
import { castInputActions } from './actions/casting.ts';
import { processChannel, processScripted, processTrail } from './actions/runtime.ts';
import { resolveCollisions } from './systems/collisions.ts';
import { tickStatusEffects } from './systems/effects.ts';
import { updateFx } from './systems/fx.ts';
import { applyMovement, speedOf } from './systems/movement.ts';
import { tickCharacterTimers, tickCooldowns, tickPassiveRecovery, tickSummonLife } from './systems/playerState.ts';
import { updateProjectiles } from './systems/projectiles.ts';
import { checkWin } from './systems/win.ts';
import { updateZones } from './systems/zones.ts';

export { applyMovement, speedOf };

// 一個固定步的權威模擬
export function step(state, inputs, dt) {
  if (state.phase !== 'playing') return;
  // 慢動作：擊破 Boss 時觸發，dt 縮放但 remaining 用實際 dt 倒數。
  const tf = state.timeFreeze;
  if (tf && tf.remaining > 0) {
    tf.remaining -= dt;
    dt = dt * (tf.scale || 0.3);
    if (tf.remaining <= 0) state.timeFreeze = null;
  }
  state.time += dt;

  for (const p of Object.values(state.players)) {
    if (!p.alive) continue;
    if (tickSummonLife(state, p, dt)) continue;
    let input = inputs[p.id] || EMPTY_INPUT;
    // 魔王/召喚物/镳像：以 AI 計算輸入取代鍵盤 (host-only 運算)
    if (p.aiId) {
      if (state.mode === 'boss') input = state.roundPhase === 'fighting' ? computeBossInput(state, p, dt) : EMPTY_INPUT;
      else input = computeBossInput(state, p, dt); // FFA 召喚物 AI
    } else if (state.mode === 'boss' && state.roundPhase !== 'fighting') {
      // 闖關 intro/cleared/wiped：人類玩家輸入凍結 (登場動畫期間不能動)
      input = EMPTY_INPUT;
    }
    const character = getCharacter(p.charId);
    const talent = character.talent;
    tickCharacterTimers(p, character, talent, dt);
    tickCooldowns(state, p, talent, dt);

    tickStatusEffects(state, p, dt);
    if (!p.alive) continue; // 燃燒/流血等 DoT 可能在本迴圈擊殺

    tickPassiveRecovery(state, p, talent, dt);

    processChannel(state, p, dt); // 汲取鏈 (不限制移動)

    const scripted = processScripted(state, p, dt); // 衝鋒/躍擊進行中接管移動
    if (!scripted) {
      applyMovement(p, input, dt);

      processTrail(state, p, dt); // 移動留痕 (冰霜足跡)

      castInputActions(state, p, input, dt);
    }
  }

  resolveCollisions(state);
  updateProjectiles(state, dt);
  updateZones(state, dt);
  updateFx(state, dt);
  // 清除已死亡的玩家召喚物 (避免累積；一般玩家死亡保留供結算)
  for (const id of Object.keys(state.players)) {
    const o = state.players[id];
    if (o.isSummon && !o.alive) delete state.players[id];
  }
  if (state.mode === 'boss') { bossTick(state, dt); checkBossRound(state, dt); }
  else checkWin(state);
}
