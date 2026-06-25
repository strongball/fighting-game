// 天賦 bloodthirst（嗜血）：對流血中的敵人增傷（與「連刃」持續疊流血形成黏著滾雪球）。
import { registerTalent } from '../../talents/registry';

registerTalent('bloodthirst', {
  modifyOutgoing({ target, dmg, talent }) {
    if (target.effects && target.effects.bleed) return dmg * (1 + (talent.bonus || 0.3));
    return dmg;
  },
});
