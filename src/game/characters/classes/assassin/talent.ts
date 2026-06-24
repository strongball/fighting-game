// 天賦 lethal（致命）：隱身中或從背後攻擊時大幅增傷。
import { registerTalent } from '../../talents/registry';
import { angleDiff } from '../../../entities/math.ts';

registerTalent('lethal', {
  modifyOutgoing({ attacker, target, dmg, talent }) {
    const behind = Math.abs(angleDiff(Math.atan2(attacker.y - target.y, attacker.x - target.x), target.facing)) > Math.PI - (talent.arc || 1.2);
    if ((attacker.effects && attacker.effects.invis) || behind) return dmg * (1 + (talent.bonus || 0.6));
    return dmg;
  },
});
