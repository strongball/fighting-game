// 天賦 lifebloom（生命綻放）：每幀持續回血。
import { registerTalent } from '../../talents/registry';
import { applyHeal } from '../../../entities/heal.ts';

registerTalent('lifebloom', {
  onRecovery(state, p, dt, talent) {
    applyHeal(state, p, (talent.regen || 6) * dt);
  },
});
