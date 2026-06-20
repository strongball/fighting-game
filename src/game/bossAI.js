// 闖關模式 — 魔王 AI (每隻王各自一套腳本，共用 helper)
//
// host-authoritative：只有房主執行 step()，因此只有房主跑 AI；加入者僅渲染 snapshot。
// 故 AI 可自由使用 Math.random，無需決定性 (host/joiner 不需一致)。
//
// 對外：computeBossInput(state, ent, dt) → 與鍵盤相同形狀的 input 物件
//   { up,down,left,right, basic,skill1,skill2,ultimate, aim }
// step() 對任何帶 ent.aiId 的實體呼叫此函式取代鍵盤輸入。
//
// 行為核心是一個 telegraph 狀態機 (aiState)：
//   idle    → 選定一個冷卻就緒的技能 → 進入 windup
//   windup  → 鎖定瞄準、播放預警特效、原地蓄力 → 時間到按下該技能槽一個 tick
//   recover → 施放後短暫停頓 → 回 idle
// 每個技能 a.windup 控制起手秒數 (越簡單的王越長、破綻越大)。

import { ARENA, PLAYER_RADIUS } from './constants.js';
import { dist, clamp } from './entities/math.ts';
import { addFx } from './entities/fx.ts';
import { isEnemy } from './entities/team.ts';
import { dangerColor } from './bosses/danger.ts';
import { getCharacter } from './characters.js';
import { getBoss } from './bosses.js';

function mkInput() {
  return { up: false, down: false, left: false, right: false, basic: false, skill1: false, skill2: false, ultimate: false, aim: null };
}

// ---- 目標選擇 ----
function enemiesOf(state, ent) {
  const out = [];
  for (const o of Object.values(state.players)) {
    if (o.alive && isEnemy(state, ent.id, o)) out.push(o);
  }
  return out;
}
function nearest(list, x, y) {
  let best = null, bd = Infinity;
  for (const o of list) { const d = dist(x, y, o.x, o.y); if (d < bd) { bd = d; best = o; } }
  return best;
}
function lowestHp(list) {
  let best = null, bh = Infinity;
  for (const o of list) { if (o.hp < bh) { bh = o.hp; best = o; } }
  return best;
}

// ---- 移動輔助：把朝向 (tx,ty) 的位移轉成 8 方向 input 布林 ----
function moveToward(input, ent, tx, ty, stopDist = 0) {
  const dx = tx - ent.x, dy = ty - ent.y, d = Math.hypot(dx, dy);
  if (d <= stopDist) return;
  const dz = 8;
  if (dx > dz) input.right = true; else if (dx < -dz) input.left = true;
  if (dy > dz) input.down = true; else if (dy < -dz) input.up = true;
}
function moveAway(input, ent, tx, ty) {
  const dx = ent.x - tx, dy = ent.y - ty, dz = 8;
  if (dx > dz) input.right = true; else if (dx < -dz) input.left = true;
  if (dy > dz) input.down = true; else if (dy < -dz) input.up = true;
}
const aimAt = (ent, tx, ty) => Math.atan2(ty - ent.y, tx - ent.x);

// ---- 進入技能蓄力 (Windup) 狀態，並計算準確的預警標示參數 ----
function startWindup(state, ent, slot, a, target, customWindup = null) {
  const s = ent.aiState;
  s.mode = 'windup';
  s.slot = slot;

  let rawWindup = customWindup != null ? customWindup : (a.windup != null ? a.windup : 0.5);
  if (ent.isBoss) {
    rawWindup = Math.max(1.0, rawWindup);
  }
  s.windupT = rawWindup;
  s.totalWindupT = rawWindup;

  if (a.once) s['_used_' + slot] = true;

  // 鎖定瞄準與預警落點
  s.aimAng = aimAt(ent, target.x, target.y);
  
  // 記錄初始目標位置（用於鎖定目標型預警，防玩家移動造成預警亂移）
  s.lastTargetX = target.x;
  s.lastTargetY = target.y;

  // 清除先前的預計算數據，防止干擾
  s.precalculatedZones = null;
  s.preselectedSoulBindPairs = null;
  s.stolenUltimate = null;
  s.safeLeft = null;

  if (a.type === 'zone' && (a.count || 1) > 1) {
    const ang = s.aimAng;
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    const baseX = clamp(ent.x + cos * (a.range || 0), PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
    const baseY = clamp(ent.y + sin * (a.range || 0), PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);
    const n = a.count;
    const scatter = a.scatter || 120;
    const zones = [];
    for (let i = 0; i < n; i++) {
      let zx = baseX;
      let zy = baseY;
      if (i > 0) {
        const randAng = Math.random() * Math.PI * 2;
        const rr = Math.sqrt(Math.random()) * scatter;
        zx = clamp(baseX + Math.cos(randAng) * rr, PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
        zy = clamp(baseY + Math.sin(randAng) * rr, PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);
      }
      zones.push({ x: zx, y: zy });
    }
    s.precalculatedZones = zones;
  }

  if (a.type === 'soul_bind') {
    const enemies = enemiesOf(state, ent);
    if (enemies.length >= 2) {
      const list = enemies.slice();
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = list[i]; list[i] = list[j]; list[j] = t;
      }
      const pairs = Math.floor(Math.min(a.count || 2, list.length) / 2);
      const chosen = [];
      for (let k = 0; k < pairs; k++) {
        chosen.push({ a: list[k * 2].id, b: list[k * 2 + 1].id });
      }
      s.preselectedSoulBindPairs = chosen;
    }
  }

  if (a.type === 'steal_ultimate') {
    const enemies = enemiesOf(state, ent);
    if (enemies.length > 0) {
      const victim = enemies[Math.floor(Math.random() * enemies.length)];
      const ult = getCharacter(victim.charId).ultimate;
      if (ult) {
        s.stolenUltimate = ult;
      }
    }
  }

  if (a.type === 'light_dark') {
    s.safeLeft = Math.random() < 0.5;
  }
}

function getMultiblinkTargets(state, caster, action) {
  const n = action.count || 3;
  const cands = Object.values(state.players).filter((o) => o.alive && isEnemy(state, caster.id, o));
  cands.sort((x, y) => {
    const mx = (x.effects && x.effects.mark) ? 0 : 1;
    const my = (y.effects && y.effects.mark) ? 0 : 1;
    if (mx !== my) return mx - my;
    const dxv = dist(caster.x, caster.y, x.x, x.y);
    const dyv = dist(caster.x, caster.y, y.x, y.y);
    if (dxv !== dyv) return dxv - dyv;
    return Number(x.id) - Number(y.id);
  });
  return cands.slice(0, n);
}

// ---- 預警特效：依危險等級上色、依進度脈動加速、依招式形狀畫地面 decal ----
function telegraph(state, ent, action, dt) {
  const s = ent.aiState;
  const totalT = s.totalWindupT || Math.max(1.0, action.windup != null ? action.windup : 0.5);
  const progress = Math.max(0, Math.min(1, 1 - s.windupT / Math.max(0.001, totalT)));
  // 進度越高脈動越快 (0.22s → 0.08s)
  const interval = 0.22 - 0.14 * progress;
  s._tele = (s._tele || 0) - dt;
  if (s._tele > 0) return;
  s._tele = interval;
  
  const color = action.telegraphColor || dangerColor(action);
  const ang = s.aimAng != null ? s.aimAng : (ent.facing || 0);

  // 1. 如果是偷取大絕招，且預選好了，則遞迴用所偷的大招 config 繪製預警
  if (action.type === 'steal_ultimate') {
    if (s.stolenUltimate) {
      telegraph(state, ent, s.stolenUltimate, dt);
      return;
    }
  }

  // 2. 如果是分裂畫面大招 (light_dark)
  if (action.type === 'light_dark') {
    const safeLeft = s.safeLeft !== null && s.safeLeft !== undefined ? s.safeLeft : true;
    const tx = safeLeft ? ARENA.width / 2 : 0;
    const ty = ARENA.height / 2;
    const tr = ARENA.height / 2; // radius is half-width (800)
    const trange = ARENA.width / 2; // range is half-length (1200)
    addFx(state, {
      type: 'telegraph',
      x: tx, y: ty,
      facing: 0,
      color,
      radius: tr,
      range: trange,
      arc: action.arc || 1.4,
      shape: 'line',
      progress,
      life: 0.32,
      danger: action.dangerLevel || undefined,
    });
    return;
  }

  // 3. 如果是靈魂綁定且有預選對象
  if (action.type === 'soul_bind' && s.preselectedSoulBindPairs) {
    for (const pair of s.preselectedSoulBindPairs) {
      const pA = state.players[pair.a];
      const pB = state.players[pair.b];
      if (pA && pA.alive) {
        addFx(state, {
          type: 'telegraph',
          x: pA.x, y: pA.y,
          facing: ang,
          color,
          radius: PLAYER_RADIUS * 2.2,
          range: 0,
          arc: action.arc || 1.4,
          shape: 'circle',
          progress,
          life: 0.32,
          danger: action.dangerLevel || undefined,
        });
      }
      if (pB && pB.alive) {
        addFx(state, {
          type: 'telegraph',
          x: pB.x, y: pB.y,
          facing: ang,
          color,
          radius: PLAYER_RADIUS * 2.2,
          range: 0,
          arc: action.arc || 1.4,
          shape: 'circle',
          progress,
          life: 0.32,
          danger: action.dangerLevel || undefined,
        });
      }
    }
    return;
  }

  // 4. 如果是多重瞬步 (multiblink)
  if (action.type === 'multiblink') {
    const targets = getMultiblinkTargets(state, ent, action);
    for (const tgt of targets) {
      addFx(state, {
        type: 'telegraph',
        x: tgt.x, y: tgt.y,
        facing: ang,
        color,
        radius: PLAYER_RADIUS * 2.2,
        range: 0,
        arc: action.arc || 1.4,
        shape: 'circle',
        progress,
        life: 0.32,
        danger: action.dangerLevel || undefined,
      });
    }
    return;
  }

  // 5. 如果是時光倒流 (time_rewind) 或 複製鏡像 (mirror_players) -> 全體玩家警告
  if (action.type === 'time_rewind' || action.type === 'mirror_players') {
    const enemies = enemiesOf(state, ent);
    for (const tgt of enemies) {
      addFx(state, {
        type: 'telegraph',
        x: tgt.x, y: tgt.y,
        facing: ang,
        color,
        radius: PLAYER_RADIUS * 2.2,
        range: 0,
        arc: action.arc || 1.4,
        shape: 'circle',
        progress,
        life: 0.32,
        danger: action.dangerLevel || undefined,
      });
    }
    return;
  }

  // 6. 如果是多重區域且已預計算好位置
  if (action.type === 'zone' && s.precalculatedZones) {
    const tr = (action.radius || 120) + PLAYER_RADIUS;
    for (const pos of s.precalculatedZones) {
      addFx(state, {
        type: 'telegraph',
        x: pos.x, y: pos.y,
        facing: ang,
        color,
        radius: tr,
        range: 0,
        arc: action.arc || 1.4,
        shape: 'circle',
        progress,
        life: 0.32,
        danger: action.dangerLevel || undefined,
      });
    }
    return;
  }

  // 決定預警形狀
  let shape = action.telegraph || 'circle';
  if (action.type === 'melee' && !action.telegraph) shape = 'arc';
  if (action.type === 'projectile' && !action.telegraph) shape = 'line';
  if (action.type === 'charge' && !action.telegraph) shape = 'line';

  // 實時計算預警中心點、半徑與長度 (加上 PLAYER_RADIUS 以完美匹配實際碰撞判定)
  let tx = ent.x;
  let ty = ent.y;
  let tr = action.radius || 60;
  let trange = action.range || 0;

  if (action.type === 'melee') {
    tx = ent.x;
    ty = ent.y;
    tr = (action.range || 80) + PLAYER_RADIUS;
    trange = (action.range || 80) + PLAYER_RADIUS;
  } else if (action.type === 'projectile') {
    tx = ent.x;
    ty = ent.y;
    tr = (action.radius || 40) + PLAYER_RADIUS;
    trange = (action.range || (action.speed && action.lifetime ? action.speed * action.lifetime : 320)) + PLAYER_RADIUS;

    // 如果有彈幕分裂
    if (action.count && action.count > 1 && action.spread) {
      const n = action.count;
      for (let i = 0; i < n; i++) {
        const projAng = ang + (i - (n - 1) / 2) * action.spread;
        addFx(state, {
          type: 'telegraph',
          x: tx, y: ty,
          facing: projAng,
          color,
          radius: tr,
          range: trange,
          arc: action.arc || 1.4,
          shape,
          progress,
          life: 0.32,
          danger: action.dangerLevel || undefined,
        });
      }
      return;
    }
  } else if (action.type === 'charge') {
    tx = ent.x;
    ty = ent.y;
    const hitR = action.hitRadius || action.radius || 40;
    tr = hitR + PLAYER_RADIUS;
    trange = (action.range || 300) + hitR + PLAYER_RADIUS;
  } else if (action.type === 'leap' || action.type === 'blink') {
    if (action.telegraph === 'line') {
      // 劃出一條軌跡線
      tx = ent.x;
      ty = ent.y;
      const rad = action.radius || action.hitRadius || 40;
      tr = rad + PLAYER_RADIUS;
      trange = (action.range || 240) + rad + PLAYER_RADIUS;
      addFx(state, {
        type: 'telegraph',
        x: tx, y: ty,
        facing: ang,
        color,
        radius: tr,
        range: trange,
        arc: action.arc || 1.4,
        shape: 'line',
        progress,
        life: 0.32,
        danger: action.dangerLevel || undefined,
      });

      // 並且在落點畫一個圓圈
      const r = action.range || 240;
      const landingX = clamp(ent.x + Math.cos(ang) * r, PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
      const landingY = clamp(ent.y + Math.sin(ang) * r, PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);
      const landingR = (action.radius || action.hitRadius || 120) + PLAYER_RADIUS;
      addFx(state, {
        type: 'telegraph',
        x: landingX, y: landingY,
        facing: ang,
        color,
        radius: landingR,
        range: 0,
        arc: action.arc || 1.4,
        shape: 'circle',
        progress,
        life: 0.32,
        danger: action.dangerLevel || undefined,
      });
      return;
    } else {
      const r = action.range || 240;
      tx = clamp(ent.x + Math.cos(ang) * r, PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
      ty = clamp(ent.y + Math.sin(ang) * r, PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);
      tr = (action.radius || action.hitRadius || 120) + PLAYER_RADIUS;
    }
  } else if (action.type === 'zone') {
    if ((action.range || 0) === 0) {
      tx = ent.x;
      ty = ent.y;
      tr = (action.radius || 120) + PLAYER_RADIUS;
    } else {
      if (action.telegraph === 'line') {
        tx = ent.x;
        ty = ent.y;
        tr = (action.radius || 40) + PLAYER_RADIUS;
        trange = (action.range || 0) + (action.moving ? action.moving * action.lifetime : 0) + (action.radius || 40) + PLAYER_RADIUS;
      } else if (action.telegraph === 'arc') {
        tx = ent.x;
        ty = ent.y;
        const zoneReach = action.range + (action.radius || 150);
        tr = zoneReach + PLAYER_RADIUS;
        trange = zoneReach + (action.moving ? action.moving * action.lifetime : 0) + PLAYER_RADIUS;
      } else {
        tx = clamp(ent.x + Math.cos(ang) * action.range, PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
        ty = clamp(ent.y + Math.sin(ang) * action.range, PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);
        tr = (action.radius || 120) + PLAYER_RADIUS;
      }
    }
  } else if (selfCentered(action)) {
    tx = ent.x;
    ty = ent.y;
    tr = (action.radius || action.range || 120) + PLAYER_RADIUS;
  } else {
    tx = s.lastTargetX !== undefined ? s.lastTargetX : ent.x;
    ty = s.lastTargetY !== undefined ? s.lastTargetY : ent.y;
    tr = (action.radius || action.hitRadius || 80) + PLAYER_RADIUS;
  }

  addFx(state, {
    type: 'telegraph',
    x: tx, y: ty,
    facing: ang,
    color,
    radius: tr,
    range: trange,
    arc: action.arc || 1.4,
    shape,        // 'circle' / 'line' / 'arc' / 'self'
    progress,     // 0-1
    life: 0.32,
    danger: action.dangerLevel || undefined,
  });
}


// ---- 技能是否在當前距離可用 (依 action type 概略門檻) ----
function usable(a, d) {
  if (!a) return false;
  switch (a.type) {
    case 'melee': return d <= (a.range || 80) + 60;
    case 'charge': return d >= 90 && d <= (a.range || 320) + 40;
    case 'leap': return d >= 60 && d <= (a.range || 280) + 40;
    case 'blink': return d <= (a.range || 280) + 80;
    case 'projectile': {
      const projRange = a.range || (a.speed && a.lifetime ? a.speed * a.lifetime : 760);
      return d <= projRange;
    }
    case 'zone': return (a.range || 0) === 0 ? true : d <= (a.range || 0) + (a.radius || 120) + 40;
    default: return true; // dash/multiblink/buff/召喚/自訂 → 隨時可用
  }
}

// 自身為中心 / 跟隨型 zone、buff、召喚、自訂技：瞄準目標即可
function selfCentered(a) {
  return a && (a.type === 'buff' || (a.type === 'zone' && (a.range || 0) === 0) ||
    a.type === 'summon_clones' || a.type === 'summon_minions' || a.type === 'apply_scramble' ||
    a.type === 'time_rewind' || a.type === 'soul_bind' || a.type === 'light_dark' ||
    a.type === 'mirror_players' || a.type === 'steal_ultimate' || a.type === 'multiblink');
}

const PICK_TARGETS = {
  aggroSwap,
  nearestTarget,
  lowestTarget,
};

// ---- 共用 AI 設定檔 (召喚物 / 鏡像) ----
// Boss 專屬 profile 放在 src/game/bosses/<slug>/ai.ts。
const PROFILES = {
  minion: { range: 60, slots: ['skill1', 'skill2', 'basic'], pickTarget: 'nearestTarget' },
  mirror: { range: 80, slots: ['ultimate', 'skill1', 'skill2', 'basic'], pickTarget: 'nearestTarget' },
};

function aggroSwap(state, ent, dt) {
  const s = ent.aiState;
  const list = enemiesOf(state, ent);
  if (!list.length) return null;
  s._aggroT = (s._aggroT || 0) - dt;
  let cur = s._target ? state.players[s._target] : null;
  if (!cur || !cur.alive || s._aggroT <= 0) {
    const ch = getCharacter(ent.charId);
    const swap = (ch.mechanic && ch.mechanic.aggroSwap) || 3.0;
    s._aggroT = swap;
    cur = list[Math.floor(Math.random() * list.length)];
    s._target = cur.id;
  }
  return cur;
}
function nearestTarget(state, ent) {
  const cur = nearest(enemiesOf(state, ent), ent.x, ent.y);
  if (cur) ent.aiState._target = cur.id;
  return cur;
}
function lowestTarget(state, ent) {
  const cur = lowestHp(enemiesOf(state, ent));
  if (cur) ent.aiState._target = cur.id;
  return cur;
}

// ---- 主入口 ----
export function computeBossInput(state, ent, dt) {
  const input = mkInput();
  const s = ent.aiState || (ent.aiState = {});

  // 假身 (R4 分身)：隨機遊走、偶爾假揮 (不造成傷害，僅迷惑)；無真實技能
  if (ent.isFake) return fakeInput(state, ent, dt, input);

  // 被暈：無法行動，取消起手
  if (ent.effects && ent.effects.stun) { s.mode = 'idle'; s.slot = null; return input; }

  const boss = ent.isBoss ? getBoss(ent.charId) : null;
  if (boss && typeof boss.computeInput === 'function') {
    return boss.computeInput(state, ent, dt, { computeProfileInput });
  }

  const ch = getCharacter(ent.charId);
  const profile = (ch && ch.aiProfile) || PROFILES[ent.aiId] || PROFILES.minion;
  return computeProfileInput(profile, state, ent, dt);
}

function computeProfileInput(profile, state, ent, dt) {
  const input = mkInput();
  const s = ent.aiState || (ent.aiState = {});
  const prof = profile || PROFILES.minion;
  const pickTarget = typeof prof.pickTarget === 'function'
    ? prof.pickTarget
    : PICK_TARGETS[prof.pickTarget] || nearestTarget;
  const target = pickTarget(state, ent, dt);
  if (!target) { return input; } // 無敵人 (過場)
  const d = dist(ent.x, ent.y, target.x, target.y);
  const ch = getCharacter(ent.charId);

  s.mode = s.mode || 'idle';

  // ---- windup：鎖定瞄準、原地蓄力、播預警 → 時間到施放 ----
  if (s.mode === 'windup') {
    const a = ch[s.slot];
    input.aim = s.aimAng != null ? s.aimAng : aimAt(ent, target.x, target.y);
    // 近戰系起手可緩慢逼近，遠程系原地
    if (a && (a.type === 'melee' || a.type === 'charge' || a.type === 'leap') && d > (prof.range || 80)) {
      moveToward(input, ent, target.x, target.y, prof.range || 80);
    }
    if (a) telegraph(state, ent, a, dt);
    s.windupT -= dt;
    if (s.windupT <= 0) {
      input[s.slot] = true;          // 按下該槽一個 tick → step 觸發 tryAction/tryUltimate
      input.aim = s.aimAng;
      const a = ch[s.slot] || {};
      // 設定連段：剩餘 chain 清單 + 接續延遲（短破綻接下一招）
      if (a.chain && a.chain.length && !s.chainQueue) {
        s.chainQueue = a.chain.slice();
      }
      // 破綻窗口長度：有 chain 接續 → 用 chain.delay 較短；否則依招式重量
      const hasChainNext = s.chainQueue && s.chainQueue.length > 0;
      const heavy = !hasChainNext && (s.slot === 'ultimate' || (a.dmg || 0) >= 70 || (a.radius || 0) >= 180);
      const med = !hasChainNext && ((a.dmg || 0) >= 40 || (a.radius || 0) >= 120);
      if (hasChainNext) {
        const nextChain = s.chainQueue[0];
        s.recoverT = nextChain.delay != null ? nextChain.delay : 0.25;
      } else {
        // 破綻窗口：縮短時長 (避免長時間卡住感)；recover 期間 Boss 可走路但減速
        s.recoverT = heavy ? 0.75 + Math.random() * 0.3
                   : med   ? 0.5  + Math.random() * 0.2
                   :         0.25 + Math.random() * 0.2;
      }
      s.recoverTotal = s.recoverT;
      s.mode = 'recover';
      ent.recoverWindow = s.recoverT;
      ent.recoverMaxWindow = s.recoverT;
      ent.recoverHeavy = heavy;
      s.slot = null;
    }
    return input;
  }

  // ---- recover：破綻期，玩家受傷增 30%，頭頂顯示「破綻」；Boss 可走位但減速 ----
  if (s.mode === 'recover') {
    s.recoverT -= dt;
    ent.recoverWindow = Math.max(0, s.recoverT);
    input.aim = aimAt(ent, target.x, target.y);
    // 允許追擊／風箏，但移動速度由 speedOf 套 0.55× (避免破綻期看起來像卡住)
    if (prof.kite && d < prof.kite) moveAway(input, ent, target.x, target.y);
    else if (d > (prof.range || 80)) moveToward(input, ent, target.x, target.y, prof.range || 80);
    if (s.recoverT <= 0) {
      ent.recoverWindow = 0;
      ent.recoverMaxWindow = 0;
      ent.recoverHeavy = false;
      const hasChainNext = s.chainQueue && s.chainQueue.length > 0;
      if (!hasChainNext && ent.isCastingLockHpUlt) {
        ent.isCastingLockHpUlt = false;
        ent.ultLockInvincible = false;
      }
      // 連段下一招：強制進入下一個 windup (不檢查 CD，連段強制執行)
      if (s.chainQueue && s.chainQueue.length) {
        const next = s.chainQueue.shift();
        const a2 = ch[next.slot];
        if (a2) {
          startWindup(state, ent, next.slot, a2, target, next.windup);
          // 連段強制：CD 不擋 (清掉本招 CD 讓 tryAction 通過)
          ent.cd = ent.cd || {};
          ent.cd[next.slot] = 0;
          // mana 不檢查 (boss maxMana 通常很大)
          return input;
        }
      }
      s.chainQueue = null;
      s.mode = 'idle';
    }
    return input;
  }

  // ---- idle：挑一個就緒技能進入 windup，否則走位 ----
  let chosen = null;
  for (const slot of prof.slots) {
    const a = ch[slot];
    if (!a) continue;
    if ((ent.cd[slot] || 0) > 0) continue;
    // 部位限制 (R5)：對應臂部已破壞則該技停用
    if (a.requiresPart && !partAlive(state, ent, a.requiresPart)) continue;
    if (a.requiresPartsDown && !allPartsDown(state, ent)) continue;
    if (a.once && s['_used_' + slot]) continue;
    if (!usable(a, d)) continue;
    chosen = slot; break;
  }

  if (chosen) {
    const a = ch[chosen];
    startWindup(state, ent, chosen, a, target);
    return input;
  }

  // 無技能就緒 → 依理想距離走位 (近戰逼近 / 遠程風箏)
  input.aim = aimAt(ent, target.x, target.y);
  const want = prof.range || 80;
  if (prof.kite && d < prof.kite) moveAway(input, ent, target.x, target.y);
  else if (d > want) moveToward(input, ent, target.x, target.y, want);
  else if (prof.kite) { /* 在理想射程內，原地 */ }
  return input;
}

// 假身 AI：隨機方向遊走 (每 ~1s 換向)，營造真假難辨
function fakeInput(state, ent, dt, input) {
  const s = ent.aiState;
  s._wt = (s._wt || 0) - dt;
  if (s._wt <= 0 || s._ang == null) { s._wt = 0.8 + Math.random() * 0.8; s._ang = Math.random() * Math.PI * 2; }
  // 邊界回彈
  if (ent.x < 80) s._ang = 0; else if (ent.x > ARENA.width - 80) s._ang = Math.PI;
  if (ent.y < 80) s._ang = Math.PI / 2; else if (ent.y > ARENA.height - 80) s._ang = -Math.PI / 2;
  input.aim = s._ang;
  const dz = 0.3;
  const dx = Math.cos(s._ang), dy = Math.sin(s._ang);
  if (dx > dz) input.right = true; else if (dx < -dz) input.left = true;
  if (dy > dz) input.down = true; else if (dy < -dz) input.up = true;
  return input;
}

// ---- 部位查詢 (R5) ----
export function partAlive(state, boss, partId) {
  for (const o of Object.values(state.players)) {
    if (o.isPart && o.ownerId === boss.id && o.partId === partId) return o.alive;
  }
  return false; // 找不到視為已破壞 (技能停用)
}
export function allPartsDown(state, boss) {
  let found = false;
  for (const o of Object.values(state.players)) {
    if (o.isPart && o.ownerId === boss.id) { found = true; if (o.alive) return false; }
  }
  return found; // 有部位且全滅才算 true
}
