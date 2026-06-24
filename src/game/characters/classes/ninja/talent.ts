// 天賦 shadowstrike（影襲）：目標被控場（暈/定身/緩速/冰寒/冰凍）時增傷。
import { registerTalent } from '../../talents/registry';

registerTalent('shadowstrike', {
  modifyOutgoing({ target, dmg, talent }) {
    const effects = target.effects || {};
    if (effects.stun || effects.root || effects.slow || effects.chill || effects.frozen) return dmg * (1 + (talent.bonus || 0.35));
    return dmg;
  },
});
