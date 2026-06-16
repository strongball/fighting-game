// @ts-nocheck
export function checkWin(state) {
  if (state.phase !== 'playing') return;
  const alive = Object.values(state.players).filter((p) => p.alive && !p.ownerId);
  const sides = new Set();
  for (const p of alive) sides.add(p.team > 0 ? 't' + p.team : 'p' + p.id);
  if (state.startCount >= 2 && sides.size <= 1) {
    state.phase = 'gameover';
    state.winner = alive.length >= 1 ? alive[0].id : null;
    state.winnerTeam = alive.length >= 1 ? (alive[0].team || 0) : 0;
  }
}
