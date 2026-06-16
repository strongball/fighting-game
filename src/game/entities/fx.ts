import { uid } from './math.ts';
import type { GameState, Fx } from '../types';

// 推入一次性視覺特效事件；配 fx.id 供 renderer 去重，並限制 pool 上限 120。
export function addFx(state: GameState, fx: Fx): void {
  fx.id = uid();
  fx.life = fx.life ?? 0.25;
  fx.maxLife = fx.life;
  state.fx.push(fx);
  if (state.fx.length > 120) state.fx.shift();
}
