import { registerBossAction } from '../actions.ts';

registerBossAction('sand_blink', (state, boss, a, h) => {
  const targets = Object.values(state.players).filter((o: any) => o.team === 1 && o.alive);
  if (!targets.length) return;
  
  const target = targets[Math.floor(Math.random() * targets.length)] as any;
  const angle = Math.random() * Math.PI * 2;
  const distVal = 140;
  
  const oldX = boss.x;
  const oldY = boss.y;
  
  const destX = h.clamp(target.x + Math.cos(angle) * distVal, h.PLAYER_RADIUS, h.ARENA.width - h.PLAYER_RADIUS);
  const destY = h.clamp(target.y + Math.sin(angle) * distVal, h.PLAYER_RADIUS, h.ARENA.height - h.PLAYER_RADIUS);
  
  boss.x = destX;
  boss.y = destY;
  
  // 原地與目的地特效
  h.addFx(state, { type: 'hit', x: oldX, y: oldY, color: '#dfc48c', life: 0.45, radius: 180, vfx: 'boss_sand_explode' });
  h.addFx(state, { type: 'hit', x: destX, y: destY, color: '#dfc48c', life: 0.45, radius: 180, vfx: 'boss_sand_explode' });
  
  // 判定傷害與眩暈
  const radius = 180;
  const dmg = a.dmg || 40;
  for (const o of Object.values(state.players) as any[]) {
    if (o.team === 1 && o.alive) {
      const d1 = h.dist(o.x, o.y, oldX, oldY);
      const d2 = h.dist(o.x, o.y, destX, destY);
      if (d1 <= radius || d2 <= radius) {
        h.dealDamage(state, o, dmg, boss.id);
        h.applyEffect(o, 'stun', { duration: 1.0 }, boss.id);
      }
    }
  }
});
