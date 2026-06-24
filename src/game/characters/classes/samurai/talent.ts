// 天賦 iaido（居合）：原地不施放時持續累積居合計時。
// 註：「居合就緒」判定（施放時讀寫 p.iaiReady、與施放序列緊密耦合）仍內聯於 actions/casting.ts；
// 居合強化傷害（outMult）見 actions/combat.ts。此處僅搬移單純的每幀計時累積。
import { registerTalent } from '../../talents/registry';

registerTalent('iaido', {
  onTimers(_state, p, dt) {
    p.iaiTimer = (p.iaiTimer || 0) + dt;
  },
});
