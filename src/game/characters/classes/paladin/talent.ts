// 天賦 retribution（反擊）：受到攻擊時反彈一定比例傷害給攻擊者。
// 回傳反傷量，由 damage.ts 代為施加（避免 talent.ts 反向匯入 dealDamage 造成循環）。
import { registerTalent } from '../../talents/registry';

registerTalent('retribution', {
  onAttacked({ dmg, talent }) {
    const reflectDamage = dmg * (talent.factor || 0.15);
    return reflectDamage > 0 ? reflectDamage : 0;
  },
});
