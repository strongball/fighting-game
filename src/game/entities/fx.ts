// @ts-nocheck
import { uid } from './math.ts';

export function addFx(state, fx) {
  fx.id = uid();
  fx.life = fx.life ?? 0.25;
  fx.maxLife = fx.life;
  state.fx.push(fx);
  if (state.fx.length > 120) state.fx.shift();
}
