import { registerBossAction } from '../actions.ts';
import { makeZone } from '../../entities/factories.ts';

registerBossAction('summon_bubble', (state, boss, a, h) => {
  // 尋找活著且未被困住的敵對玩家
  const enemies = (Object.values(state.players) as any[]).filter(
    (o) => h.isEnemy(state, boss.id, o) && o.alive
  );
  if (!enemies.length) return;

  // 檢查已被困的玩家，避免重複點名
  const trappedIds = new Set();
  for (const o of Object.values(state.players) as any[]) {
    if (o.isMinion && o.charId === -3 && o.alive && o.trappedPlayerId) {
      trappedIds.add(o.trappedPlayerId);
    }
  }

  const validTargets = enemies.filter((e) => !trappedIds.has(e.id));
  if (!validTargets.length) return;

  // 選擇最近 of 有效目標
  let target = validTargets[0];
  let minD = Infinity;
  for (const e of validTargets) {
    const d = h.dist(boss.x, boss.y, e.x, e.y);
    if (d < minD) {
      minD = d;
      target = e;
    }
  }

  // 建立水泡 minion 實體
  const bubbleId = boss.id + '-bubble-' + Math.random().toString(36).slice(2, 7);
  
  // 根據玩家人數動態計算 HP 與是否暈眩：單人 50 HP 且不暈眩（以便自行擊破）；多人則每位隊友 180 HP 且暈眩被困者。
  const enemiesCount = enemies.length;
  let bubbleHp = 300;
  let shouldStun = true;
  if (enemiesCount <= 1) {
    bubbleHp = 25;
    shouldStun = false;
  } else {
    bubbleHp = Math.round(90 * (enemiesCount - 1) * (state._hpScale || 1));
    shouldStun = true;
  }

  const bubbleMinion = h.makeBoss(bubbleId, -3, target.x, target.y, h.BOSS_TEAM, {
    isMinion: true,
    ownerId: boss.id,
    aiId: 'fake', // 無 AI 動作
    name: '深海水泡',
    maxHp: bubbleHp,
    scale: 2.5, // 視覺球體半徑 34，scale 2.5 → hitR ≈ 45，各職業普攻都能命中
    facing: target.facing,
  });
  // 直接覆寫 hitR，確保命中判定與視覺球一致，讓玩家大概 2~3 下打破
  bubbleMinion.hitR = 42;

  // 建立地面警告紅色光圈區，並讓它追隨水泡 (實質鎖死在原地)
  const warningZoneId = 'warning-bubble-' + Math.random().toString(36).slice(2, 7);
  const warningZone = makeZone(boss.id, target.x, target.y, {
    radius: 40,
    lifetime: 99.0, // 存活時間由 Tick 動態維護 (隨水泡死亡而移除)
    color: '#ff3366',
    vfx: 'boss_siren_warning_bubble',
    follow: bubbleId
  });
  warningZone.id = warningZoneId;
  state.zones = state.zones || [];
  state.zones.push(warningZone);

  bubbleMinion.trappedPlayerId = target.id;
  bubbleMinion.shouldStun = shouldStun;
  bubbleMinion.spawnX = target.x;
  bubbleMinion.spawnY = target.y;
  bubbleMinion.warningZoneId = warningZoneId;
  bubbleMinion.dmgTimer = 1.2;

  // 註冊至玩家列表
  state.players[bubbleId] = bubbleMinion;

  // 若為多人，給目標施加一個短暫初始暈眩，後續在 tick 內做持續鎖定
  if (shouldStun) {
    h.applyEffect(target, 'stun', { duration: 1.5 }, boss.id);
  }

  // 播放施法 VFX
  h.addFx(state, { type: 'buff', x: target.x, y: target.y, color: '#ff3366', life: 0.65, radius: 55 });
});
