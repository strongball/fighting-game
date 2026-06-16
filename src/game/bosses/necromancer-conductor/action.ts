import { registerBossAction } from '../actions.ts';

registerBossAction('summon_minions', (state, boss, a, h) => {
  const n = a.count || 3;
  const hp = Math.round((a.minionHp || 240) * (state._hpScale || 1));
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + Math.random();
    const x = h.clamp(boss.x + Math.cos(ang) * 110, h.PLAYER_RADIUS, h.ARENA.width - h.PLAYER_RADIUS);
    const y = h.clamp(boss.y + Math.sin(ang) * 110, h.PLAYER_RADIUS, h.ARENA.height - h.PLAYER_RADIUS);
    const id = boss.id + '-min-' + Math.random().toString(36).slice(2, 7);
    const m = h.makeBoss(id, a.minionCharId != null ? a.minionCharId : 7, x, y, h.BOSS_TEAM, {
      isMinion: true,
      ownerId: boss.id,
      aiId: 'minion',
      maxHp: hp,
      scale: 1,
    });
    state.players[id] = m;
  }
  h.addFx(state, { type: 'buff', x: boss.x, y: boss.y, color: a.color, life: 0.5, radius: 100 });
});
