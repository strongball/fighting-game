// 格鬥家 K「聚氣」：每次施放 +1 氣球（上限 maxChi，預設 5）。
//   氣球本身的「增益」（攻擊/減傷/滿氣加速）由天賦 qiflow 在傷害管線與計時 hook 讀 caster.chi 套用；
//   本 handler 只負責累積氣球數並送出 VFX。chi 已納入網路快照（給 HUD/環繞氣球視覺）。
import { addFx } from '../../../entities/fx.ts';
import type { ActionContext } from '../../../types';

export function gatherqi(ctx: ActionContext) {
  const { state, caster, action, silent } = ctx;
  const max = action.maxChi || 5;
  const before = caster.chi || 0;
  caster.chi = Math.min(max, before + (action.gain || 1));
  caster.chiIdle = 0;                       // 聚氣＝活躍，重置閒置消散計時
  if (!silent) {
    addFx(state, { type: 'buff', x: caster.x, y: caster.y, facing: caster.facing, color: action.color, life: 0.6, vfx: action.vfx, chi: caster.chi, full: caster.chi >= max });
  }
}

export const handlers = { gatherqi };
