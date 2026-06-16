import type { GameState } from '../types';

// 勝負判定：依「陣營」分組（team>0 視為一隊，否則各玩家自成一方）。
// 存活陣營 ≤ 1 即結束（startCount>=2 才生效，沙盒單人不會自動結束）。
export function checkWin(state: GameState) {
  if (state.phase !== 'playing') return;
  const alive = Object.values(state.players).filter((p) => p.alive && !p.ownerId);
  const sides = new Set<string>();
  for (const p of alive) sides.add(p.team > 0 ? 't' + p.team : 'p' + p.id);
  if (state.startCount >= 2 && sides.size <= 1) {
    state.phase = 'gameover';
    state.winner = alive.length >= 1 ? alive[0].id : null;
    state.winnerTeam = alive.length >= 1 ? (alive[0].team || 0) : 0;
  }
}
