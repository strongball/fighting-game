// 玩家自動瞄準 / 鎖定。
//
// 痛點：俯視角下「攻擊方向＝移動方向」，難以邊走邊瞄。提供兩段式輔助：
//   A 出招微吸附（input.assist）：按下「瞄準型」招式時，依招式類型分流（方案 D）：
//       近戰/grapple → 完全對準前方錐內敵人；melee 再加「微衝刺」貼到攻擊邊緣。
//       遠程 projectile → 只在「中近距離」且「小幅修正」，遠射仍要手動瞄。
//   C 按住鎖定（input.lock）：依角色類型分流（meleeRole）：
//       近戰角色 → 完全對準目標、每幀更新、可繞步(strafe)。
//       遠程角色 → 站定才完全瞄準；一移動就不瞄（避免邊走邊免費瞄＝風箏無腦）。
//
// 機制：在 applyMovement 之前設定 input.aim，movement.ts 便以它覆寫 facing（line 57），
// velocity 仍由 WASD 決定 → 鎖定時「身體朝目標、腳步自由」。
//
// 決定性：只對「帶 assist/lock 旗標的本地真人輸入」生效。AI/NPC/魔王/腳本(harness)輸入
// 不帶這些旗標 → 直接 return，模擬行為與黃金快照完全不變。

import { getCharacter } from '../characters.js';
import { isEnemy } from '../entities/team.ts';
import { dist, angleDiff } from '../entities/math.ts';
import type { GameState, Player, Input } from '../types';

// ── A 微吸附調校（世界單位；ARENA 2400×1600）──
// 近戰系：補「貼上去打到」，較寬錐形 + 完全對準 + 微衝刺。
const MELEE_ASSIST_CONE = 1.2;    // 吸附半角(rad，~69°)：approach 中即轉向
const MELEE_ASSIST_RANGE = 420;   // facing 對準距離（接近過程就生效）
const MELEE_LUNGE_BAND = 110;     // 目標超出 reach 這麼多內，出招才補位移
const MELEE_LUNGE_MAX = 70;       // 單次微衝刺上限；且只補到 reach 邊緣 → 絕不更靠近
// 遠程系：刻意收斂，保留「會瞄才強」的技術門檻。
const RANGED_ASSIST_CONE = 0.5;   // 吸附半角(rad，~28°)：要大致瞄對才幫
const RANGED_ASSIST_RANGE = 450;  // 吸附距離：< deadeye 甜蜜點(520) → 遠射不自動瞄
const RANGED_MAX_CORRECT = 0.3;   // 最大修正角(rad，~17°)：只小幅修、不完全 snap

// ── C 鎖定調校 ──
const LOCK_ACQUIRE_CONE = 2.0;    // 取靶時「前方」偏好半角(rad，~115°)
const LOCK_RANGE = 4000;          // 近戰鎖定取靶/維持距離（≈整個場地）

// 只有「瞄準型」招式吃自動瞄準；位移技（dash/blink/leap/charge/multiblink）維持吃移動方向。
const AIMED_TYPES = new Set(['projectile', 'melee', 'grapple']);
const ATTACK_SLOTS = ['basic', 'skill1', 'skill2', 'ultimate'] as const;

// 與 npcAI.enemiesOf 同邏輯（存活、非部位、敵對）。刻意不共用，隔離 NPC AI 行為。
function enemiesOf(state: GameState, ent: Player): Player[] {
  const out: Player[] = [];
  for (const o of Object.values(state.players)) {
    if (o.alive && !o.isPart && isEnemy(state, ent.id, o)) out.push(o);
  }
  return out;
}

const angleTo = (p: Player, t: Player): number => Math.atan2(t.y - p.y, t.x - p.x);
const clampCorr = (x: number): number => Math.max(-RANGED_MAX_CORRECT, Math.min(RANGED_MAX_CORRECT, x));

// 玩家「意圖方向」：移動中取移動向量，否則取目前朝向。
function intentAngle(p: Player, input: Input): number {
  const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  if (dx || dy) return Math.atan2(dy, dx);
  return p.facing;
}

// 前方錐形（半角 cone）＋射程(range)內最近的敵人（無則 null）。
function coneTarget(state: GameState, p: Player, base: number, range: number, cone: number): Player | null {
  let best: Player | null = null, bestD = Infinity;
  for (const o of enemiesOf(state, p)) {
    const d = dist(p.x, p.y, o.x, o.y);
    if (d > range || d >= bestD) continue;
    if (Math.abs(angleDiff(angleTo(p, o), base)) > cone) continue;
    bestD = d; best = o;
  }
  return best;
}

// 遠程系收斂輔助（A 與 C 的遠程分支共用）：中近距離 + 小幅修正，遠射不吸。
function rangedAssist(state: GameState, p: Player, base: number): { target: Player; aim: number } | null {
  const t = coneTarget(state, p, base, RANGED_ASSIST_RANGE, RANGED_ASSIST_CONE);
  if (!t) return null;
  return { target: t, aim: base + clampCorr(angleDiff(angleTo(p, t), base)) };
}

// C（近戰角色）：取得/維持鎖定目標。沿用上一幀目標（仍存活、敵對、在場內），否則取「前方優先、最近」。
function acquireLockTarget(state: GameState, p: Player, base: number): Player | null {
  const cur = p.lockTargetId != null ? state.players[p.lockTargetId] : null;
  if (cur && cur.alive && !cur.isPart && isEnemy(state, p.id, cur) && dist(p.x, p.y, cur.x, cur.y) <= LOCK_RANGE) {
    return cur;
  }
  let best: Player | null = null, bestScore = Infinity;
  for (const o of enemiesOf(state, p)) {
    const d = dist(p.x, p.y, o.x, o.y);
    if (d > LOCK_RANGE) continue;
    const inFront = Math.abs(angleDiff(angleTo(p, o), base)) <= LOCK_ACQUIRE_CONE;
    const score = d * (inFront ? 0.6 : 1); // 前方者加權 → 面向誰就鎖誰
    if (score < bestScore) { bestScore = score; best = o; }
  }
  return best;
}

// 本幀按下的第一個「瞄準型」招式（決定 A 是否介入、近戰或遠程分流）。
function firingAimed(p: Player, input: Input): { slot: string; action: any } | null {
  const character = getCharacter(p.charId);
  for (const slot of ATTACK_SLOTS) {
    if (!input[slot]) continue;
    const action = character[slot];
    if (action && AIMED_TYPES.has(action.type)) return { slot, action };
  }
  return null;
}

// 近戰微衝刺：目標剛好在攻擊範圍外、本招這幀會放出 → 只補到 reach 邊緣（不會更靠近）。
function meleeLunge(p: Player, t: Player, firing: { slot: string; action: any }): void {
  if ((p.cd[firing.slot] || 0) > 0) return;          // 只在本招這幀會放出時補
  const reach = firing.action.range || 120;
  const d = dist(p.x, p.y, t.x, t.y);
  const gap = d - reach;
  if (gap <= 0 || gap > MELEE_LUNGE_BAND) return;     // 已在範圍內 / 太遠 → 不補
  const step = Math.min(gap, MELEE_LUNGE_MAX);        // 至多補到 reach 邊緣，絕不更靠近
  const a = angleTo(p, t);
  p.x += Math.cos(a) * step;
  p.y += Math.sin(a) * step;
}

/**
 * 玩家自動瞄準（A 微吸附 / C 按住鎖定）。在 applyMovement 之前呼叫。
 * 透過設定 input.aim 讓 movement 把 facing 對準目標；velocity 仍跟 WASD → 鎖定可繞步。
 * 副作用：維護 p.lockTargetId（供 HUD 鎖頭、過網路 snapshot）；近戰可加微衝刺(位移)。
 */
export function applyPlayerAutoLock(state: GameState, p: Player, input: Input): void {
  if (p.aiId || p.isNpc || p.isBoss || p.isSummon || p.isMinion) return;
  const lockHeld = !!input.lock;
  const assistOn = !!input.assist;
  if (!lockHeld && p.lockTargetId != null) p.lockTargetId = null;
  if (!lockHeld && !assistOn) return;
  if (p.effects.stun) return;

  const base = intentAngle(p, input);

  // C 按住鎖定：依角色類型分流（meleeRole）。
  if (lockHeld) {
    const meleeChar = !!getCharacter(p.charId).meleeRole;
    const moving = !!(input.up || input.down || input.left || input.right);
    // 近戰：恆完全鎖定（可繞步）。遠程：站定才完全瞄準、一走路就不瞄（避免邊走邊免費瞄＝風箏無腦）。
    if (meleeChar || !moving) {
      const t = acquireLockTarget(state, p, base);
      if (t) { p.lockTargetId = t.id; input.aim = angleTo(p, t); }
      else p.lockTargetId = null;
    } else {
      p.lockTargetId = null; // 遠程角色移動中 → 不瞄準
    }
    return;
  }

  // A：出招微吸附——近戰/遠程分流（方案 D）。
  const firing = firingAimed(p, input);
  if (!firing) return;
  const type = firing.action.type;

  if (type === 'melee' || type === 'grapple') {
    // 近戰系：reach 小、需要幫 → 完全對準；melee 再加微衝刺貼到邊緣。
    const t = coneTarget(state, p, base, MELEE_ASSIST_RANGE, MELEE_ASSIST_CONE);
    if (t) {
      input.aim = angleTo(p, t);
      if (type === 'melee') meleeLunge(p, t, firing);
    }
  } else {
    // 遠程系(projectile)：中近距離小幅修正，遠射不吸。
    const r = rangedAssist(state, p, base);
    if (r) input.aim = r.aim;
  }
}
