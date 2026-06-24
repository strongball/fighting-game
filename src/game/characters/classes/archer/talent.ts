// 天賦 deadeye（鷹眼）：距離越遠傷害越高。
import { registerTalent } from '../../talents/registry';

registerTalent('deadeye', {
  modifyOutgoing({ attacker, target, dmg, talent }) {
    const d = Math.hypot(target.x - attacker.x, target.y - attacker.y);
    return dmg * (1 + (talent.bonus || 0.5) * Math.min(1, d / (talent.range || 520)));
  },
});
