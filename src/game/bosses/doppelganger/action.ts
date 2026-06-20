import { registerBossAction } from '../actions.ts';

registerBossAction('mirror_players', (state, boss, a, h) => {
  const enemies = (Object.values(state.players) as any[]).filter((o) => o.team === 1 && o.alive);
  for (const o of enemies) {
    const x = h.clamp(boss.x + (o.x - boss.x) * 0.4, h.PLAYER_RADIUS, h.ARENA.width - h.PLAYER_RADIUS);
    const y = h.clamp(boss.y + 70, h.PLAYER_RADIUS, h.ARENA.height - h.PLAYER_RADIUS);
    const id = boss.id + '-mirror-' + o.id;
    if (state.players[id]) continue;
    const m = h.makeBoss(id, o.charId, x, y, h.BOSS_TEAM, {
      isMirror: true,
      ownerId: boss.id,
      aiId: 'mirror',
      maxHp: o.maxHp,
      scale: 1,
      name: '鏡像',
    });
    state.players[id] = m;
    h.addFx(state, { type: 'blink', x, y, color: a.color, life: 0.4, radius: 70 });
  }
});

registerBossAction('steal_ultimate', (state, boss, a, h) => {
  const enemies = (Object.values(state.players) as any[]).filter((o) => o.team === 1 && o.alive);
  if (!enemies.length) return;

  let ult = boss.aiState && boss.aiState.stolenUltimate;
  if (!ult) {
    const victim = enemies[Math.floor(Math.random() * enemies.length)];
    ult = h.getCharacter(victim.charId).ultimate;
  }
  if (!ult) return;

  const tgt = enemies.reduce((b, o) => (h.dist(boss.x, boss.y, o.x, o.y) < h.dist(boss.x, boss.y, b.x, b.y) ? o : b), enemies[0]);
  boss.facing = Math.atan2(tgt.y - boss.y, tgt.x - boss.x);
  h.executeAction(state, boss, ult, { silent: true });
  h.addFx(state, { type: 'ultimate', x: boss.x, y: boss.y, color: a.color, life: 0.6, radius: ult.radius || 140 });

  if (boss.aiState) boss.aiState.stolenUltimate = null;
});
