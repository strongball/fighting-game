// 天賦 bloodlust（嗜血）：造成傷害時依「失血比」吸血回復；血量越低、技能冷卻越快。
import { registerTalent } from '../../talents/registry';
import { missingHp } from '../../../entities/math.ts';

registerTalent('bloodlust', {
  onDealt({ state, attacker, dmg, talent, addFx }) {
    const lifesteal = dmg * (talent.lifesteal || 0.25) * (0.4 + missingHp(attacker));
    if (lifesteal > 0) {
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + lifesteal);
      addFx(state, { type: 'popup', x: attacker.x, y: attacker.y, color: '#5cffa6', life: 0.7, text: `+${Math.round(lifesteal)}`, kind: 'heal' });
    }
  },
  cooldownRate(_state, p, talent) {
    return 1 + (talent.haste || 0.6) * missingHp(p);
  },
});
