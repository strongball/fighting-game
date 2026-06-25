// @ts-nocheck
import { registerBossAction } from '../actions.ts';
import { makeZone } from '../../entities/factories.ts';

registerBossAction('summon_pylons', (state, boss, a, h) => {
  // 獲取敵對玩家數量以進行 HP 動態縮放
  const enemies = (Object.values(state.players) as any[]).filter(
    (o) => h.isEnemy(state, boss.id, o) && o.alive
  );
  const enemiesCount = Math.max(1, enemies.length);

  // 能量柱 HP 計算 (單人 80 HP，多人依人數與 hpScale 放大)
  const baseHp = enemiesCount === 1 ? 80 : Math.round(150 * enemiesCount * (state._hpScale || 1));

  // 移除場上舊的能量柱與警告圈
  for (const key of Object.keys(state.players)) {
    const o = state.players[key];
    if (o.isMinion && o.charId === -7 && o.ownerId === boss.id) {
      o.alive = false;
      delete state.players[key];
    }
  }
  state.zones = (state.zones || []).filter((z) => z.vfx !== 'boss_mecha_pylon_warning');

  // 在 Boss 的左右兩側對稱生成 2 個能量共振柱
  const offsetDistance = 180;
  const offsets = [
    { x: -offsetDistance, y: -50 },
    { x: offsetDistance, y: 50 },
  ];

  offsets.forEach((offset, idx) => {
    const px = Math.max(60, Math.min(h.ARENA.width - 60, boss.x + offset.x));
    const py = Math.max(60, Math.min(h.ARENA.height - 60, boss.y + offset.y));

    const pylonId = boss.id + '-pylon-' + idx + '-' + Math.random().toString(36).slice(2, 7);

    const pylonMinion = h.makeBoss(pylonId, -7, px, py, h.BOSS_TEAM, {
      isMinion: true,
      ownerId: boss.id,
      aiId: 'fake', // 無 AI
      name: '能量共振柱',
      maxHp: baseHp,
      facing: boss.facing,
    });
    pylonMinion.hitR = 30;

    // 將能量柱鎖死在原地，禁止任何漂移或擊退
    pylonMinion.spawnX = px;
    pylonMinion.spawnY = py;

    state.players[pylonId] = pylonMinion;

    // 添加地表預警/連結區域
    const pylonZone = makeZone(boss.id, px, py, {
      radius: 35,
      lifetime: 99.0, // 隨能量柱死亡而清理
      color: '#ffaa00',
      vfx: 'boss_mecha_pylon_warning',
      follow: pylonId
    });
    state.zones.push(pylonZone);

    // 播放生成特效
    h.addFx(state, { type: 'buff', x: px, y: py, color: '#ff5500', life: 0.6, radius: 50 });
  });

  // Boss 喊話
  state.banner = {
    text: '🛡️ 能量共振！',
    sub: '機械真神獲得了 90% 減傷護盾，快擊破能量共振柱！',
    life: 2.5,
    kind: 'phase',
    color: '#ffaa00',
  };
});
