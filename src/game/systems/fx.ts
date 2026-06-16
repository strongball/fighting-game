import type { GameState } from '../types';

// 視覺特效生命週期：逐幀遞減 life，移除已結束者。
export function updateFx(state: GameState, dt: number) {
  for (const fx of state.fx) fx.life -= dt;
  state.fx = state.fx.filter((fx) => fx.life > 0);
}
