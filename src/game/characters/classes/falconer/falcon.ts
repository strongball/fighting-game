// 鳥獵的鷹隼夥伴：每幀 AI。
//   • 平時：每隔一段（偽隨機）時間自動發動一次「獵鷹突擊」——鷹自肩飛出、俯衝敵人多段連擊、再飛回。
//   • 大絕「鷹擊風暴」：一段時間內讓鷹「連續來回」不斷俯衝，打更多次（見 startFalconStorm）。
// 仿 RO 弓獵 Blitz Beat（多段、濺射）。本體攻擊調低，改由老鷹補回一份穩定輸出。
//
// ⚠️ 決定性：模擬禁用 Math.random（破壞多人同步與測試）。偽隨機間隔以 mulberry32（整數 PRNG）
//    + player.id 派生種子；飛行/連擊皆依固定時間軸推進 → 跨端一致、可重現。
import { addFx } from '../../../entities/fx.ts';
import { dealDamage } from '../../../entities/damage.ts';
import { isEnemy } from '../../../entities/team.ts';
import type { Player } from '../../../types';

// 共用參數
const FALCON = {
  crit: 1.7,          // 爆擊倍率（+70%，與鷹瞳同調）
  splashRadius: 130,  // 對目標周圍敵人的濺射半徑（仿 Blitz Beat 3x3）
  splashFactor: 0.6,  // 濺射目標承受比例
  range: 460,         // 索敵半徑（基礎放大，鷹打得更遠＝走位時更安全）
  intervalMin: 2.4,   // 平時兩次鷹擊間隔（秒）下限
  intervalMax: 3.4,   // 上限（區間內偽隨機）
  retry: 0.25,        // 射程內無敵人時的重試間隔
};

// 鷹的「有效索敵半徑」：鷹眼凝視 / 大招期間（p._falconRange）放大觸發範圍。
function effectiveRange(p: any): number {
  const fr = p._falconRange;
  return FALCON.range * (fr && fr.remaining > 0 ? fr.mult : 1);
}

// 一次飛行的「招式參數」。總傷害守恆：hits × hitDmg × crit。
// 平時獵鷹突擊：10 × 5.4 × 1.7 ≈ 91.8（不帶擊退，避免把敵人推離自己的輸出範圍）。
const BLITZ = { hits: 10, hitDmg: 5.4, hitGap: 0.035, strikeAt: 0.2, dur: 0.62, knockback: 0 };
// 大絕鷹擊風暴：每趟更快（0.4s 來回）、6 段；風暴持續期間連續來回 → 打很多次。
// 每趟首擊帶「中等擊退」（弱於 K 的鷹擊·震退），把敵群推開＝保命。
const STORM = { hits: 6, hitDmg: 6.2, hitGap: 0.04, strikeAt: 0.12, dur: 0.4, knockback: 160 };

// 整數 PRNG（Math.imul 全平台一致），回傳 0..1。
function mulberry32(a: number): number {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function seedFromId(id: any): number {
  if (typeof id === 'number') return (id * 2654435761) | 0;
  let h = 0x811c9dc5;
  const s = String(id);
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h | 0;
}

function ensureFalcon(p: Player) {
  if (!(p as any)._falcon) {
    (p as any)._falcon = { timer: FALCON.intervalMin, seed: seedFromId(p.id), flight: null, frenzy: null };
  }
  return (p as any)._falcon;
}

function nextInterval(f: any): number {
  f.seed = (f.seed + 1) | 0;
  const r = mulberry32(f.seed);
  return FALCON.intervalMin + r * (FALCON.intervalMax - FALCON.intervalMin);
}

function nearestEnemy(state: any, p: Player): Player | null {
  let best: Player | null = null;
  let bestD = effectiveRange(p);
  for (const o of Object.values(state.players) as any[]) {
    if (!o.alive || !isEnemy(state, p.id, o)) continue;
    const d = Math.hypot(o.x - p.x, o.y - p.y);
    if (d <= bestD) { bestD = d; best = o; }
  }
  return best;
}

// 起飛：鎖定最近敵人並設定一趟飛行（用招式參數 P）。回傳是否成功。
function launchFlight(state: any, p: Player, f: any, P: any): boolean {
  const tgt = nearestEnemy(state, p);
  if (!tgt) return false;
  f.flight = {
    t: 0, dur: P.dur, hits: P.hits, hitDmg: P.hitDmg, hitGap: P.hitGap, strikeAt: P.strikeAt,
    knockback: P.knockback || 0,
    targetId: tgt.id, tdx: tgt.x - p.x, tdy: tgt.y - p.y, trail: 0,
  };
  return true;
}

// 單段鷹擊：主目標必爆 + 周圍濺射。noTalent 避免擾動本體「鷹瞳每三發」計數與重複加成。
// 每趟首擊（idx 0）帶擊退（把主目標推離自己），後續段不推、維持輸出。
function strike(state: any, p: Player, target: Player, idx: number, hitDmg: number, knockback: number) {
  const facing = Math.atan2(target.y - p.y, target.x - p.x);
  dealDamage(state, target, hitDmg * FALCON.crit, p.id, { noTalent: true, source: 'falcon' });
  for (const o of Object.values(state.players) as any[]) {
    if (o === target || !o.alive || !isEnemy(state, p.id, o)) continue;
    if (Math.hypot(o.x - target.x, o.y - target.y) <= FALCON.splashRadius) {
      dealDamage(state, o, hitDmg * FALCON.crit * FALCON.splashFactor, p.id, { noTalent: true, source: 'falcon' });
    }
  }
  const big = idx === 0;
  if (knockback && big) {
    const d = Math.hypot(target.x - p.x, target.y - p.y) || 1;
    target.kvx += (target.x - p.x) / d * knockback;
    target.kvy += (target.y - p.y) / d * knockback;
  }
  if (big) addFx(state, { type: 'dash', x: p.x, y: p.y, facing, color: '#ffd76a', life: 0.2, vfx: 'falconer_swoop' });
  addFx(state, { type: 'hit', x: target.x, y: target.y, facing, color: '#ffd76a', life: big ? 0.34 : 0.22, radius: big ? 30 : 18, width: idx, vfx: 'falconer_swoop' });
}

// 大絕：開啟「鷹擊風暴」——一段時間內鷹連續來回俯衝。由 talent.onCastResolved 呼叫。
export function startFalconStorm(state: any, p: Player, dur: number) {
  const f = ensureFalcon(p);
  f.frenzy = { t: 0, dur: dur || 3.2 };
  addFx(state, { type: 'skillname', x: p.x, y: p.y, color: '#ffd76a', life: 1.4, text: '鷹擊風暴', owner: p.id, ultimate: true });
}

export function tickFalcon(state: any, p: Player, dt: number) {
  if (!p.alive) {
    const fst = (p as any)._falcon;
    if (fst) { fst.flight = null; fst.frenzy = null; }
    return;
  }
  const f = ensureFalcon(p);

  // 鷹眼凝視 / 大招期間的「索敵範圍放大」buff 計時（由 talent.onCastResolved 設定）。
  if (p._falconRange && p._falconRange.remaining > 0) p._falconRange.remaining -= dt;

  // 風暴計時（持續期間讓鷹不斷來回），並週期性放出「風暴氛圍」脈衝（擴張金環＋旋繞金羽）。
  if (f.frenzy) {
    f.frenzy.t += dt;
    f.frenzy.pulse = (f.frenzy.pulse || 0) + dt;
    if (f.frenzy.pulse >= 0.16) {
      f.frenzy.pulse = 0;
      addFx(state, { type: 'hit', x: p.x, y: p.y, color: '#ffd76a', life: 0.5, radius: 40, vfx: 'falconer_storm' });
    }
    if (f.frenzy.t >= f.frenzy.dur) f.frenzy = null;
  }

  // 飛行進行中：推進時間軸、灑拖尾、落下各段連擊；結束時依狀態決定「立刻再飛(風暴)」或「進冷卻」。
  if (f.flight) {
    const fl = f.flight;
    // 每幀更新到鎖定目標的當前世界位移：棲位本就跟著玩家移動，故走位時鷹仍自然飛向敵人並飛回。
    const locked = state.players[fl.targetId];
    const aim = (locked && locked.alive) ? locked : nearestEnemy(state, p);
    if (aim) { fl.tdx = aim.x - p.x; fl.tdy = aim.y - p.y; }

    const prev = fl.t;
    fl.t += dt;
    fl.trail += dt;
    if (fl.trail >= 0.03) {
      fl.trail = 0;
      const u = Math.min(1, fl.t / fl.dur);
      const arc = Math.sin(u * Math.PI);
      addFx(state, { type: 'hit', x: p.x + (fl.tdx || 0) * arc, y: p.y + (fl.tdy || 0) * arc, color: '#ffd76a', life: 0.28, radius: 6, vfx: 'falconer_trail' });
    }
    for (let h = 0; h < fl.hits; h++) {
      const hitTime = fl.strikeAt + h * fl.hitGap;
      if (prev < hitTime && fl.t >= hitTime && aim) strike(state, p, aim, h, fl.hitDmg, fl.knockback);
    }
    if (fl.t >= fl.dur) {
      f.flight = null;
      if (f.frenzy) { if (!launchFlight(state, p, f, STORM)) f.frenzy = null; } // 連續來回
      else f.timer = nextInterval(f);
    }
    return;
  }

  // 風暴剛開始、尚未起飛 → 立刻起飛一趟。
  if (f.frenzy) { if (!launchFlight(state, p, f, STORM)) { /* 無敵人：等下一幀 */ } return; }

  // 平時冷卻：時間到放出一次獵鷹突擊（需射程內有敵人）。
  f.timer -= dt;
  if (f.timer > 0) return;
  if (!launchFlight(state, p, f, BLITZ)) { f.timer = FALCON.retry; return; }
  addFx(state, { type: 'skillname', x: p.x, y: p.y, color: '#ffd76a', life: 0.9, text: '獵鷹突擊', owner: p.id });
}
