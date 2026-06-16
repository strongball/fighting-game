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

import { ARENA } from './constants.js';
import { isEnemy, dist, addFx } from './entities.js';
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

// ---- 預警特效 (節流；type 'buff' 為靜音視覺) ----
function telegraph(state, ent, color, x, y, radius, dt) {
  const s = ent.aiState;
  s._tele = (s._tele || 0) - dt;
  if (s._tele <= 0) {
    s._tele = 0.18;
    addFx(state, { type: 'buff', x, y, color: color || '#ffffff', life: 0.3, radius: radius || 60 });
  }
}

// ---- 技能是否在當前距離可用 (依 action type 概略門檻) ----
function usable(a, d) {
  if (!a) return false;
  switch (a.type) {
    case 'melee': return d <= (a.range || 80) + 60;
    case 'charge': return d >= 90 && d <= (a.range || 320) + 40;
    case 'leap': return d >= 60 && d <= (a.range || 280) + 40;
    case 'blink': return d <= (a.range || 280) + 80;
    case 'projectile': return d <= 760;
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

  return computeProfileInput(PROFILES[ent.aiId] || PROFILES.minion, state, ent, dt);
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
    telegraph(state, ent, a && a.color, s.teleX, s.teleY, s.teleR, dt);
    s.windupT -= dt;
    if (s.windupT <= 0) {
      input[s.slot] = true;          // 按下該槽一個 tick → step 觸發 tryAction/tryUltimate
      input.aim = s.aimAng;
      s.mode = 'recover';
      s.recoverT = 0.35 + Math.random() * 0.25;
      s.slot = null;
    }
    return input;
  }

  // ---- recover：施放後短暫停頓，避免機關槍 ----
  if (s.mode === 'recover') {
    s.recoverT -= dt;
    input.aim = aimAt(ent, target.x, target.y);
    // 遠程王施放後拉開距離
    if (prof.kite && d < prof.kite) moveAway(input, ent, target.x, target.y);
    if (s.recoverT <= 0) s.mode = 'idle';
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
    s.mode = 'windup';
    s.slot = chosen;
    s.windupT = a.windup != null ? a.windup : 0.5;
    if (a.once) s['_used_' + chosen] = true;
    // 鎖定瞄準與預警落點
    let tx = target.x, ty = target.y;
    if (selfCentered(a)) { tx = ent.x; ty = ent.y; }
    s.aimAng = aimAt(ent, target.x, target.y);
    // 預警圈位置：射程型落在目標、近身型在自己
    if (a.type === 'zone' && (a.range || 0) > 0) {
      const ang = s.aimAng; s.teleX = ent.x + Math.cos(ang) * a.range; s.teleY = ent.y + Math.sin(ang) * a.range; s.teleR = a.radius || 120;
    } else if (selfCentered(a)) {
      s.teleX = ent.x; s.teleY = ent.y; s.teleR = a.radius || a.range || 120;
    } else {
      s.teleX = target.x; s.teleY = target.y; s.teleR = a.radius || a.hitRadius || 80;
    }
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
