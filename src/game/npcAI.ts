// @ts-nocheck
// NPC 玩家 AI — 用「決策樹」驅動大廳加入的電腦玩家 (lobby 的 isNpc 角色)。
//
// host-authoritative：只有房主跑 step()，故只有房主跑此 AI；加入者僅渲染快照。
// 因此可自由使用 Math.random，無需決定性 (NPC 不會出現在決定性測試的場景裡)。
//
// 對外：computeNpcInput(state, p, dt) → 與鍵盤相同形狀的 input 物件
//   { up,down,left,right, basic,skill1,skill2,ultimate,evade, aim }
// step() 對任何 p.isNpc 的玩家呼叫此函式取代鍵盤輸入。
//
// 與魔王 AI (bossAI.js) 不同：魔王是「telegraph 狀態機」(蓄力→施放→破綻) 刻意露破綻給玩家打；
// NPC 玩家則是「正常玩家」，目標是把技能打好、走位風箏、低血量求生 —— 故採決策樹而非腳本。
//
// ── 決策樹 (由上而下，先命中者勝) ──────────────────────────────
//   ┌ 無存活敵人        → 待命 (朝場中央靠攏)
//   ├ 被擊暈/凍結       → 放空 (動不了)
//   ├ 低血量且敵人逼近   → 撤退並風箏 (遠離最近敵人，仍朝其放遠程技能)
//   ├ 大招就緒且敵在範圍 → 施放大招
//   └ 一般接戰          → 走位 (近戰貼身 / 遠程拉開繞圈) + 依距離選最佳技能攻擊
// ──────────────────────────────────────────────────────────

import { ARENA } from './constants.js';
import { dist } from './entities/math.ts';
import { isEnemy } from './entities/team.ts';
import { getCharacter } from './characters.js';

const ULT_FULL = 100; // = constants.ULT_MAX；NPC 走「人類大招」路徑，需滿槽才放

function mkInput() {
  return { up: false, down: false, left: false, right: false, basic: false, skill1: false, skill2: false, ultimate: false, evade: false, item1: false, item2: false, aim: null };
}

// ---- 目標選擇 ----
function enemiesOf(state, ent) {
  const out = [];
  for (const o of Object.values(state.players)) {
    if (o.alive && !o.isPart && isEnemy(state, ent.id, o)) out.push(o);
  }
  return out;
}

// 威脅評分：近的、血少的更值得鎖定 (能補刀又能脫離被夾擊)。
function pickTarget(list, ent) {
  let best = null, bestScore = -Infinity;
  for (const o of list) {
    const d = dist(ent.x, ent.y, o.x, o.y) || 1;
    const hpFrac = o.maxHp ? o.hp / o.maxHp : 1;
    // 距離越近分越高；血量越低分越高 (補刀誘因)
    const score = 1000 / d + (1 - hpFrac) * 1.5;
    if (score > bestScore) { bestScore = score; best = o; }
  }
  return best;
}

// ---- 移動輔助：把朝向轉成 8 方向 input 布林 (門檻避免原地抖動) ----
const DZ = 8;
function moveToward(input, ent, tx, ty) {
  const dx = tx - ent.x, dy = ty - ent.y;
  if (dx > DZ) input.right = true; else if (dx < -DZ) input.left = true;
  if (dy > DZ) input.down = true; else if (dy < -DZ) input.up = true;
}
function moveAway(input, ent, tx, ty) {
  moveToward(input, ent, 2 * ent.x - tx, 2 * ent.y - ty);
}
// 沿著「與目標連線垂直」的方向繞圈 (side, +1/-1)，並把繞圈點往場內拉避免貼牆卡死。
function strafe(input, ent, tx, ty, side) {
  const ang = Math.atan2(ty - ent.y, tx - ent.x) + side * (Math.PI / 2);
  let gx = ent.x + Math.cos(ang) * 120;
  let gy = ent.y + Math.sin(ang) * 120;
  // 偏牆時改朝場中心修正，避免沿邊卡住
  const margin = 140;
  if (gx < margin || gx > ARENA.width - margin || gy < margin || gy > ARENA.height - margin) {
    gx = ARENA.width / 2; gy = ARENA.height / 2;
  }
  moveToward(input, ent, gx, gy);
}

// ---- 技能評估：估算「有效射程」與「是否可用」----
// 不同 type 的攻擊距離差異大；用簡單模型估算 NPC 願意在多遠出手。
function reachOf(a) {
  if (!a) return 0;
  switch (a.type) {
    case 'melee': return a.range || 120;
    case 'charge': case 'leap': case 'dash': case 'blink': case 'multiblink': case 'grapple':
      return a.range || (a.speed ? a.speed * (a.lifetime || 0.45) : 320);
    case 'projectile':
      // 行進距離 = 速度×存活，但瞄太遠不可靠 → 上限 700
      return Math.min(700, (a.speed || 500) * (a.lifetime || 1));
    case 'zone':
      return (a.range || 0) + (a.radius || 120);
    case 'channel':
      return a.range || 300;
    default:
      return 220;
  }
}

// 攻擊性技能 (需要瞄準敵人) vs 輔助技能 (增益/召喚，原地放)。
const SUPPORT_TYPES = new Set(['buff', 'summon']);
const isSupport = (a) => !!a && SUPPORT_TYPES.has(a.type);

// 概略傷害權重 (含多重投射)，供選「最痛且能命中」的技能。
const dmgWeight = (a) => (a ? (a.dmg || 0) * (a.count || 1) : 0);

function manaOk(state, p, a) {
  if (state.flags && state.flags.freeMana) return true;
  return !a.manaCost || p.mana >= a.manaCost;
}
function hpOk(p, a) {
  return !a.hpCost || p.hp > a.hpCost + 1;
}
// 技能此刻是否可施放 (冷卻 / 魔力 / 生命門檻)。大招另需滿槽。
function ready(state, p, a, slot) {
  if (!a) return false;
  if ((p.cd[slot] || 0) > 0) return false;
  if (slot === 'ultimate') { if ((p.ult || 0) < ULT_FULL) return false; }
  return manaOk(state, p, a) && hpOk(p, a);
}

// ---- 單發脈衝：press 一幀 → release 一幀，反覆。 ----
// 原因：蓄力型技能 (chargeMax，如弓箭手貫穿箭) 必須「放開」才會發射；
// 若 AI 一直按住會永遠蓄力不放。脈衝同時相容瞬發技能 (cd 才是真正節流)。
function pulse(input, brain, slot, want) {
  if (want && !brain.press[slot]) { input[slot] = true; brain.press[slot] = true; }
  else { input[slot] = false; brain.press[slot] = false; }
}

export function computeNpcInput(state, p, dt) {
  const input = mkInput();
  const brain = p.npcAI || (p.npcAI = { think: 0, targetId: null, strafe: 1, strafeT: 0, press: {} });

  // 走位繞圈方向每 ~1.4 秒換邊，製造左右晃動而非直線對沖
  brain.strafeT -= dt;
  if (brain.strafeT <= 0) { brain.strafe = Math.random() < 0.5 ? 1 : -1; brain.strafeT = 1.0 + Math.random() * 0.8; }

  // 被暈眩/凍結：什麼都做不了
  if (p.effects && (p.effects.stun || p.effects.freeze)) { brain.press = {}; return input; }

  const enemies = enemiesOf(state, p);
  if (enemies.length === 0) {
    // 無敵人 → 朝場中央靠攏待命
    moveToward(input, p, ARENA.width / 2, ARENA.height / 2);
    return input;
  }

  // 目標每 ~0.45 秒重選一次 (節流，避免兩敵之間反覆橫跳)
  brain.think -= dt;
  let target = brain.targetId ? state.players[brain.targetId] : null;
  if (!target || !target.alive || brain.think <= 0) {
    target = pickTarget(enemies, p);
    brain.targetId = target ? target.id : null;
    brain.think = 0.45;
  }
  if (!target) { moveToward(input, p, ARENA.width / 2, ARENA.height / 2); return input; }

  const d = dist(p.x, p.y, target.x, target.y);
  // 朝目標瞄準 (input.aim 直接設 facing，無視移動方向 → 可邊撤邊射)。
  // 依難度加入微小瞄準誤差，越低難度手越抖。
  const difficulty = (state.flags && state.flags.difficulty != null) ? state.flags.difficulty : 0.5;
  const jitter = (1 - difficulty) * 0.18 * (Math.random() - 0.5);
  input.aim = Math.atan2(target.y - p.y, target.x - p.x) + jitter;

  const char = getCharacter(p.charId);
  const melee = !!char.meleeRole;
  const basic = char.basic;

  // 各槽位的「可用 + 射程」清單，供攻擊與走位共用
  const slots = ['skill1', 'skill2', 'basic'];
  const usable = [];
  for (const s of slots) {
    const a = char[s];
    if (a && ready(state, p, a, s)) usable.push({ slot: s, a, reach: reachOf(a), support: isSupport(a), dmg: dmgWeight(a) });
  }
  // 走位用的「主武器射程」：可用攻擊技能中最遠者，否則用普攻射程
  const offensiveReach = usable.filter((u) => !u.support).reduce((m, u) => Math.max(m, u.reach), 0);
  const weaponReach = offensiveReach || reachOf(basic);

  const hpFrac = p.maxHp ? p.hp / p.maxHp : 1;
  const nearestD = enemies.reduce((m, o) => Math.min(m, dist(p.x, p.y, o.x, o.y)), Infinity);

  // 各槽位本幀「想不想按」，最後統一脈衝一次 (避免同槽被覆寫)
  const want = { skill1: false, skill2: false, basic: false, ultimate: false };
  // 增益/召喚類：就緒即放，與距離無關 (戰吼、護盾、召喚物…)
  for (const u of usable) if (u.support) want[u.slot] = true;

  // ===== 決策節點 1：低血量求生 — 撤退並風箏 =====
  // 血量 < 30% 且有敵人逼近 → 遠離最近敵人。仍朝目標放可用遠程技能 (邊跑邊輸出)。
  if (hpFrac < 0.3 && nearestD < weaponReach + 160) {
    let nearest = null, nd = Infinity;
    for (const o of enemies) { const dd = dist(p.x, p.y, o.x, o.y); if (dd < nd) { nd = dd; nearest = o; } }
    if (nearest) moveAway(input, p, nearest.x, nearest.y);
    let best = null;                                        // 只放當前距離能命中的遠程技能
    for (const u of usable) if (!u.support && u.reach >= d && (!best || u.dmg > best.dmg)) best = u;
    if (best) want[best.slot] = true;
    flushPulse(input, brain, want);
    return input;
  }

  // ===== 決策節點 2：大招就緒且敵在範圍 → 施放 =====
  const ult = char.ultimate;
  want.ultimate = ready(state, p, ult, 'ultimate') && d <= reachOf(ult) + 30;

  // ===== 決策節點 3：走位 =====
  // 近戰：貼到普攻射程內後原地繞圈施壓；遠程：維持理想距離，太近就風箏、太遠就接近。
  const desired = melee ? Math.max(40, weaponReach * 0.8) : Math.min(620, Math.max(260, weaponReach * 0.62));
  const tooClose = melee ? 0 : 175;
  if (d > desired * 1.12) {
    moveToward(input, p, target.x, target.y);              // 太遠 → 接近
  } else if (!melee && d < tooClose) {
    moveAway(input, p, target.x, target.y);                // 遠程太近 → 風箏後撤
  } else {
    strafe(input, p, target.x, target.y, brain.strafe);    // 進入射程 → 繞圈走位
  }

  // ===== 決策節點 4：攻擊 — 選「能命中且最痛」的技能，否則普攻 =====
  let chosen = null;
  for (const u of usable) {
    if (u.support || u.slot === 'basic') continue;          // 增益已處理；普攻當保底
    if (u.reach >= d && (!chosen || u.dmg > chosen.dmg)) chosen = u;
  }
  if (chosen) want[chosen.slot] = true;
  else if (char.basic && ready(state, p, char.basic, 'basic') && reachOf(char.basic) >= d) want.basic = true;

  flushPulse(input, brain, want);
  return input;
}

// 把 want 對映成單發脈衝 (含未列出的槽位 → 釋放)，確保蓄力技能能正常發射。
function flushPulse(input, brain, want) {
  for (const slot of ['basic', 'skill1', 'skill2', 'ultimate']) {
    pulse(input, brain, slot, !!want[slot]);
  }
}
