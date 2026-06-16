// @ts-nocheck
export function updateFx(state, dt) {
  for (const fx of state.fx) fx.life -= dt;
  state.fx = state.fx.filter((fx) => fx.life > 0);
}
