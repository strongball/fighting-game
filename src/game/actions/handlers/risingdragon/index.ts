// 格鬥家大招「真·昇龍霸」：消耗全部氣球、飛撲到最近敵人身旁落地重砸。
//   傷害 = 基底 dmg + 氣球數 × dmgPerChi（氣球越多、龍越大、傷害越高）。
//   重用既有 leap 機制（actions/runtime.ts 推進 caster.leap，落地以 meleeHit 結算範圍傷害）。
//   消耗氣球後設一段 chiGainCd，避免「落地那一擊」又經天賦 onDealt 回補氣球。
import { ARENA, PLAYER_RADIUS } from '../../../constants.js';
import { clamp } from '../../../entities/math.ts';
import { addFx } from '../../../entities/fx.ts';
import { isEnemy } from '../../../entities/team.ts';
import type { ActionContext } from '../../../types';

export function risingdragon(ctx: ActionContext) {
  const { state, caster, action, cos, sin, silent } = ctx;
  const maxChi = action.maxChi || 5;
  const chi = Math.min(maxChi, caster.chi || 0);
  caster.chi = 0;                                                   // 消耗全部氣球
  caster.chiGainCd = Math.max(caster.chiGainCd || 0, (action.dur || 0.5) + 0.2); // 落地擊不回補
  const dmg = (action.dmg || 160) + chi * (action.dmgPerChi || 55);
  const range = action.range || 320;

  // 飛撲到最近敵人方向（最多 range）；無敵人則朝面向衝刺。
  let aimX = caster.x + cos * range;
  let aimY = caster.y + sin * range;
  let best: any = null, bestD = Infinity;
  for (const o of Object.values(state.players) as any[]) {
    if (!o.alive || !isEnemy(state, caster.id, o)) continue;
    const d = Math.hypot(o.x - caster.x, o.y - caster.y);
    if (d < bestD) { bestD = d; best = o; }
  }
  if (best) {
    const d = Math.max(1, bestD);
    const reach = Math.min(d, range);
    aimX = caster.x + (best.x - caster.x) / d * reach;
    aimY = caster.y + (best.y - caster.y) / d * reach;
  }
  const tx = clamp(aimX, PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
  const ty = clamp(aimY, PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);

  caster.leap = {
    t: 0,
    dur: action.dur || 0.5,
    fromx: caster.x,
    fromy: caster.y,
    tx,
    ty,
    dmg,
    radius: action.radius || 150,
    knockback: action.knockback || 650,
    effect: action.effect || null,
    leaveZone: null,
    color: action.color,
    vfx: action.vfx,
    srcSlot: ctx.source,
  };
  // 落地點主視覺（金龍/砸地/地裂）：另開一支 'fighter_dragon' fx，無條件送出。
  //   （大招施放時 casting.ts 會以 silent 呼叫 handler、並自行送出 vfx='fighter_ultimate' 的施放氣爆，
  //    故這支落地龍特效用獨立 vfx id，避免與施放氣爆重複觸發。帶 chi → 龍/地裂越多氣球越大；
  //    帶 dur → VFX 自行延後到落地瞬間才爆發。）
  void silent;
  // 龍以「目標中心」為環繞圓心、帶 targetR（目標體型）→ 圍著目標升天（打大王也繞得住，而非從身上長出來）。
  const dragonX = best ? best.x : tx;
  const dragonY = best ? best.y : ty;
  const targetR = best ? (best.hitR || PLAYER_RADIUS) : PLAYER_RADIUS;
  addFx(state, { type: 'ultimate', x: dragonX, y: dragonY, facing: caster.facing, color: action.color, life: 1.5, vfx: 'fighter_dragon', chi, dur: action.dur || 0.5, targetR });
}

export const handlers = { risingdragon };
