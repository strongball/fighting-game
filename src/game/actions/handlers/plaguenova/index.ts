// 刺客大招「瘟疫爆發」：引爆＋擴散。
//   ・對場上每個中毒敵人造成「層數 × 每層爆傷」的爆發傷害（層數越高越痛）。
//   ・把毒「擴散」——每個中毒敵人周圍的敵人染上其半數層數。
//   不消耗原層數（DoT 繼續滾），純爆發＋鋪場。self.heal 由 executor 套用。
// 決定性：以當前中毒者快照（id 排序）迭代；擴散出去的新中毒者不在本輪，避免連鎖爆炸。
import { dist } from '../../../entities/math.ts';
import { dealDamage } from '../../../entities/damage.ts';
import { addFx } from '../../../entities/fx.ts';
import { isEnemy } from '../../../entities/team.ts';
import { outMult, applyEffectFrom } from '../../combat.ts';
import type { ActionContext } from '../../../types';

export function plaguenova(ctx: ActionContext) {
  const { state, caster, silent } = ctx;
  const action = ctx.action as any;
  const burst = action.burstPerStack || 8;
  const spreadRadius = action.spreadRadius || 200;
  const m = outMult(caster, action);

  const poisoned = (Object.values(state.players) as any[])
    .filter((o) => isEnemy(state, caster.id, o) && o.hp > 0 && o.effects && o.effects.poison)
    .sort((a, b) => Number(a.id) - Number(b.id));

  for (const o of poisoned) {
    const ps = o.effects.poison;
    const stacks = ps.stacks || 0;
    if (stacks <= 0) continue;
    // 引爆：層數 × 每層爆傷
    dealDamage(state, o, stacks * burst * m, caster.id, { source: ctx.source });
    if (!silent) addFx(state, { type: 'hit', x: o.x, y: o.y, color: '#7ee787', life: 0.4, radius: 44, vfx: action.vfx });
    // 擴散：周圍敵人染上半數層數
    const half = Math.ceil(stacks / 2);
    if (half > 0) {
      for (const n of Object.values(state.players) as any[]) {
        if (n === o || !isEnemy(state, caster.id, n) || n.hp <= 0) continue;
        if (dist(o.x, o.y, n.x, n.y) <= spreadRadius) {
          applyEffectFrom(state, n, { kind: 'poison', stacks: half, dmgPerStack: ps.dmgPerStack, duration: ps.remaining || 5 }, caster.id, ctx.source);
        }
      }
    }
  }

  // 施法者處的大爆（type 'ultimate' → vfx onCast 大爆分支）
  if (!silent) addFx(state, { type: 'ultimate', x: caster.x, y: caster.y, facing: caster.facing, color: action.color, life: 0.6, vfx: action.vfx });
}

export const handlers = { plaguenova };
