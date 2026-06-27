// @ts-nocheck
import { registerBossAction, registerBossActionPrepare } from '../actions.ts';
import { makeZone } from '../../entities/factories.ts';
import { dealDamage } from '../../entities/damage.ts';
import { applyEffect } from '../../entities/effects.ts';
import { addFx } from '../../entities/fx.ts';
import { dist, clamp } from '../../entities/math.ts';
import { isEnemy } from '../../entities/team.ts';
import { PLAYER_RADIUS, ARENA } from '../../constants.js';

export function triggerShadowExplosion(state: any, pos: { x: number, y: number, id: string }) {
  const R = 150;
  state.fx.push({ type: 'hit', x: pos.x, y: pos.y, color: '#660099', life: 0.5, radius: R, vfx: 'boss_shadow_explosion' });
  for (const o of Object.values(state.players) as any[]) {
    if (o.alive && o.team === 1 && Math.hypot(pos.x - o.x, pos.y - o.y) <= R + (o.hitR || 20)) {
      dealDamage(state, o, 40, pos.id);
      applyEffect(o, 'blind', { duration: 1.5 });
    }
  }
}


// 隱影突襲 Prepare: 進入隱身並加速
registerBossActionPrepare('stealth_backstab', (state, boss, action, h) => {
  applyEffect(boss, 'invis', { duration: 2.0 });
  applyEffect(boss, 'haste', { duration: 2.0, factor: 1.4 });
  addFx(state, { type: 'buff', x: boss.x, y: boss.y, color: '#330066', life: 0.6, radius: 80, vfx: 'boss_shadow_stealth' });
});

// 隱影突襲 Execute: 瞬移至玩家身後進行刺殺
registerBossAction('stealth_backstab', (state, boss, action, h) => {
  const enemies = Object.values(state.players).filter((o: any) => h.isEnemy(state, boss.id, o) && o.alive);
  if (!enemies.length) return;
  
  let target = enemies[0];
  let bestD = h.dist(boss.x, boss.y, target.x, target.y);
  for (let i = 1; i < enemies.length; i++) {
    const d = h.dist(boss.x, boss.y, enemies[i].x, enemies[i].y);
    if (d < bestD) {
      bestD = d;
      target = enemies[i];
    }
  }

  // 計算背後位置
  const distBehind = 70;
  const tx = h.clamp(target.x - Math.cos(target.facing) * distBehind, h.PLAYER_RADIUS, h.ARENA.width - h.PLAYER_RADIUS);
  const ty = h.clamp(target.y - Math.sin(target.facing) * distBehind, h.PLAYER_RADIUS, h.ARENA.height - h.PLAYER_RADIUS);

  // 瞬移
  boss.x = tx;
  boss.y = ty;
  boss.facing = target.facing;

  // 檢查是否背刺
  const angBossToTarget = Math.atan2(target.y - boss.y, target.x - boss.x);
  let angleDiff = Math.abs(target.facing - angBossToTarget);
  while (angleDiff > Math.PI) angleDiff = Math.abs(angleDiff - Math.PI * 2);
  const isBackstab = angleDiff < 1.0;

  const baseDmg = action.dmg || 55;
  const finalDmg = isBackstab ? baseDmg * 2.0 : baseDmg;

  h.dealDamage(state, target, finalDmg, boss.id);

  // 特效與控制
  h.addFx(state, { type: 'hit', x: target.x, y: target.y, color: '#9933ff', life: 0.3, radius: 80, vfx: 'boss_shadow_slash' });
  if (isBackstab) {
    h.applyEffect(target, 'stun', { duration: 1.0 });
    h.addFx(state, { type: 'popup', x: target.x, y: target.y, color: '#ff3333', life: 1.0, text: '背刺！' });
  }
});

// 影步瞬斬 Prepare: 瞬移至玩家身後，原地展開蓄力
registerBossActionPrepare('shadow_blink_slash', (state, boss, action, h) => {
  const enemies = Object.values(state.players).filter((o: any) => isEnemy(state, boss.id, o) && o.alive);
  if (!enemies.length) return;

  // 尋找最近的敵人
  let target = enemies[0];
  let bestD = dist(boss.x, boss.y, target.x, target.y);
  for (let i = 1; i < enemies.length; i++) {
    const d = dist(boss.x, boss.y, enemies[i].x, enemies[i].y);
    if (d < bestD) {
      bestD = d;
      target = enemies[i];
    }
  }

  // 計算背後位置
  const distBehind = 60;
  const targetFacing = target.facing || 0;
  const tx = clamp(target.x - Math.cos(targetFacing) * distBehind, PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
  const ty = clamp(target.y - Math.sin(targetFacing) * distBehind, PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);

  // 瞬移前後特效
  addFx(state, { type: 'blink', x: boss.x, y: boss.y, color: '#aa33ff', life: 0.3, radius: 50, vfx: 'boss_shadow_swap' });
  boss.x = tx;
  boss.y = ty;
  boss.facing = targetFacing;
  addFx(state, { type: 'blink', x: boss.x, y: boss.y, color: '#aa33ff', life: 0.3, radius: 50, vfx: 'boss_shadow_swap' });
  addFx(state, { type: 'popup', x: boss.x, y: boss.y, color: '#aa33ff', life: 1.0, text: '影步！' });
});

// 影步瞬斬 Execute: 原地砍一大下 (大範圍爆發傷害)
registerBossAction('shadow_blink_slash', (state, boss, action, h) => {
  const dmg = action.dmg || 70;
  const R = action.radius || 150;
  h.addFx(state, { type: 'hit', x: boss.x, y: boss.y, color: '#aa33ff', life: 0.4, radius: R, vfx: 'boss_shadow_explosion' });

  for (const o of Object.values(state.players) as any[]) {
    if (o.alive && h.isEnemy(state, boss.id, o) && h.dist(boss.x, boss.y, o.x, o.y) <= R + (o.hitR || 20)) {
      h.dealDamage(state, o, dmg, boss.id);
    }
  }
});

// 影鏡互換: 召喚暗影分身 (與本尊共用血量，最多 1 隻，二階段最多 2 隻。若已滿則互換位置)
registerBossAction('summon_shadow_clone', (state, boss, action, h) => {
  if (boss.isFake) return;

  // 找出所有活著的現有分身
  const clones = [];
  for (const key of Object.keys(state.players)) {
    const o = state.players[key];
    if (o.alive && o.ownerId === boss.id && o.isFake && o.charId === boss.charId) {
      clones.push(o);
    }
  }

  // 二階段上限為 2 隻，一階段上限為 1 隻
  const maxClones = boss.phaseIdx >= 1 ? 2 : 1;

  // 如果分身數量已經達到最大上限，則不召喚新分身，而是與最舊的分身互換位置
  if (clones.length === maxClones) {
    const oldest = clones[0];
    if (oldest) {
      const bx = boss.x, by = boss.y;
      boss.x = oldest.x; boss.y = oldest.y;
      oldest.x = bx; oldest.y = by;

      // 互換後重置飛鏢 (skill1) 冷卻時間，以便立即施放
      if (boss.cd) {
        boss.cd.skill1 = 0;
      }

      // 交換特效
      h.addFx(state, { type: 'blink', x: boss.x, y: boss.y, color: '#aa33ff', life: 0.4, radius: 60 });
      h.addFx(state, { type: 'blink', x: oldest.x, y: oldest.y, color: '#aa33ff', life: 0.4, radius: 60 });
      return;
    }
  }

  // 隨機角度偏移生成分身 (與本尊拉開 280px 距離)
  const ang = Math.random() * Math.PI * 2;
  const cx = h.clamp(boss.x + Math.cos(ang) * 280, h.PLAYER_RADIUS, h.ARENA.width - h.PLAYER_RADIUS);
  const cy = h.clamp(boss.y + Math.sin(ang) * 280, h.PLAYER_RADIUS, h.ARENA.height - h.PLAYER_RADIUS);
  const cloneId = boss.id + '-clone-' + Math.random().toString(36).slice(2, 7);
  
  // 分身為無敵狀態（無 HP，不與本尊共用 HP），並給予 8 秒存活時間，且會追擊目標
  const clone = h.makeBoss(cloneId, boss.charId, cx, cy, h.BOSS_TEAM, {
    isFake: true,
    ownerId: boss.id,
    aiId: 'fake',
    name: '暗影分身',
    maxHp: boss.maxHp,
    scale: boss.scale || 1.5,
    facing: boss.facing,
    chaseTarget: true, // 追擊目標
  });
  clone.invulnerable = true;
  clone.chaseTarget = true;
  clone.lifetime = 8.0; // 存活 8 秒後自動死亡/消失
  clone.damageDealtMult = 0.5; // 降低分身打到人的傷害

  // 覆寫分身 AI 決策邏輯：追擊玩家的同時與本尊保持 250px 的排斥距離
  clone.computeInput = (state: any, ent: any, dt: number, input: any) => {
    let target = null;
    let bd = Infinity;
    for (const o of Object.values(state.players) as any[]) {
      if (o.alive && o.team === 1) {
        const d = Math.hypot(ent.x - o.x, ent.y - o.y);
        if (d < bd) {
          bd = d;
          target = o;
        }
      }
    }

    if (target) {
      input.aim = Math.atan2(target.y - ent.y, target.x - ent.x);

      let tx = target.x;
      let ty = target.y;

      const bossEnt = state.players[ent.ownerId];
      if (bossEnt && bossEnt.alive) {
        const dx = ent.x - bossEnt.x;
        const dy = ent.y - bossEnt.y;
        const distToBoss = Math.hypot(dx, dy);
        if (distToBoss < 250) {
          const chaseX = bd > 0 ? (target.x - ent.x) / bd : 0;
          const chaseY = bd > 0 ? (target.y - ent.y) / bd : 0;

          const repX = distToBoss > 0 ? dx / distToBoss : 0;
          const repY = distToBoss > 0 ? dy / distToBoss : 0;

          const force = (250 - distToBoss) / 250;
          const blendX = chaseX * (1 - force * 0.6) + repX * force * 1.2;
          const blendY = chaseY * (1 - force * 0.6) + repY * force * 1.2;

          tx = ent.x + blendX * 100;
          ty = ent.y + blendY * 100;

          const mdx = tx - ent.x, mdy = ty - ent.y;
          const dz = 8;
          if (mdx > dz) input.right = true; else if (mdx < -dz) input.left = true;
          if (mdy > dz) input.down = true; else if (mdy < -dz) input.up = true;
          return input;
        }
      }

      if (bd > 70) {
        const mdx = tx - ent.x, mdy = ty - ent.y;
        const dz = 8;
        if (mdx > dz) input.right = true; else if (mdx < -dz) input.left = true;
        if (mdy > dz) input.down = true; else if (mdy < -dz) input.up = true;
      }
      return input;
    }
    return null;
  };

  state.players[cloneId] = clone;
  h.addFx(state, { type: 'blink', x: cx, y: cy, color: '#aa33ff', life: 0.5, radius: 80, vfx: 'boss_shadow_swap' });
});

export function spawnUltZones(state: any, bossId: string, cx: number, cy: number, index: number) {
  const commonOpts = {
    radius: 70,
    dmg: 25,
    lifetime: 0.8,
    tick: 0.25,
    delay: 1.0,
    color: '#aa33ff',
    vfx: 'boss_shadow_ult_strike',
    srcSlot: 'ultimate'
  };

  if (index === 0) {
    // 橫向
    for (let i = -2; i <= 2; i++) {
      state.zones.push(makeZone(bossId, cx + i * 110, cy, commonOpts));
    }
  } else if (index === 1) {
    // 直向
    for (let i = -2; i <= 2; i++) {
      state.zones.push(makeZone(bossId, cx, cy + i * 110, commonOpts));
    }
  } else if (index === 2) {
    // X (excluding the center circle to create a safe zone at the intersection)
    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue;
      state.zones.push(makeZone(bossId, cx + i * 80, cy + i * 80, commonOpts));
    }
    for (let i = -2; i <= 2; i++) {
      if (i === 0) continue;
      state.zones.push(makeZone(bossId, cx + i * 80, cy - i * 80, commonOpts));
    }
  }
}

// 萬影千殺陣 (Ultimate)
registerBossAction('shadow_execution', (state, boss, action, h) => {
  if (boss.isFake) {
    const owner = state.players[boss.ownerId];
    if (!owner || (owner.phaseIdx || 0) < 1) return;
  }

  const enemies = Object.values(state.players).filter((o: any) => h.isEnemy(state, boss.id, o) && o.alive);
  if (!enemies.length) return;

  // Find nearest enemy
  let target = enemies[0];
  let bestD = h.dist(boss.x, boss.y, target.x, target.y);
  for (let i = 1; i < enemies.length; i++) {
    const d = h.dist(boss.x, boss.y, enemies[i].x, enemies[i].y);
    if (d < bestD) {
      bestD = d;
      target = enemies[i];
    }
  }

  // 1. 真身與分身消失 (但不套用無敵)
  boss.isUltDisappeared = true;

  const clone = Object.values(state.players).find(
    (p: any) => p.alive && p.ownerId === boss.id && p.isFake && p.charId === boss.charId
  ) as any;
  if (clone) {
    clone.isUltDisappeared = true;
  }

  // 2. 立即在目標玩家腳下生成第一道橫向暗影軌跡
  spawnUltZones(state, boss.id, target.x, target.y, 0);

  // 3. 設定計時器，進行後續直向/X預警與從空中重擊落下
  if (!boss.isFake) {
    boss._ultSlamTimer = 9.0;
  }
  boss._ultSlamTargetId = target.id;
  boss._ultCrossRemaining = 2;
  boss._ultCrossTimer = 3.0;
});
