// 天賦 arcane_flow（奧術流轉）：造成傷害後回復魔力。
import { registerTalent } from '../../talents/registry';

registerTalent('arcane_flow', {
  onDealt({ attacker, talent }) {
    attacker.mana = Math.min(attacker.maxMana, attacker.mana + (talent.mana || 8));
  },
});
