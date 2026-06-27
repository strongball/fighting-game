import { registerBossAction } from '../actions.ts';
import { difficultyMult } from '../../constants.js';

registerBossAction('summon_clones', (state, boss, a, h) => {
  // 止血:分身不得再召喚分身。本尊招式會被 executor 複製給每個分身執行,
  // 若無此守衛,分身會遞迴召喚 → 指數爆炸(場上分身暴增)。
  if (boss.isFake) return;

  // 收集現存存活分身
  const existing = [];
  for (const o of Object.values(state.players) as any[]) {
    if (o.isFake && o.ownerId === boss.id && o.alive) existing.push(o);
  }

  // 同時上限 = 基準 cap × 難度倍率(簡單 2 / 普通 3 / 困難 4),只補到差額
  const diff = state.flags.difficulty ?? 0.5;
  const cap = Math.max(1, Math.round((a.cap || 3) * difficultyMult(diff).minionCount));
  const n = Math.min(a.count || 3, Math.max(0, cap - existing.length));

  const clones = [];
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2;
    const x = h.clamp(boss.x + Math.cos(ang) * 90, h.PLAYER_RADIUS, h.ARENA.width - h.PLAYER_RADIUS);
    const y = h.clamp(boss.y + Math.sin(ang) * 90, h.PLAYER_RADIUS, h.ARENA.height - h.PLAYER_RADIUS);
    const id = boss.id + '-clone-' + Math.random().toString(36).slice(2, 7);
    const c = h.makeBoss(id, boss.charId, x, y, h.BOSS_TEAM, {
      isFake: true,
      ownerId: boss.id,
      aiId: 'fake',
      name: '幻影分身',
      maxHp: 1,
      scale: boss.scale,
      facing: boss.facing,
    });
    state.players[id] = c;
    clones.push(c);
  }

  // 換位欺敵:可與新生或既有的任一分身交換位置(滿上限時仍會換位)
  const swapPool = clones.concat(existing);
  if (swapPool.length && Math.random() < 0.6) {
    const c = swapPool[Math.floor(Math.random() * swapPool.length)];
    const tx = c.x, ty = c.y;
    c.x = boss.x; c.y = boss.y; boss.x = tx; boss.y = ty;
  }
  h.addFx(state, { type: 'blink', x: boss.x, y: boss.y, color: a.color, life: 0.4, radius: 90 });
});
