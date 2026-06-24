// 天賦 timeprism（時稜）：施放非普攻技能後，自我獲得加速（haste）。
import { registerTalent } from '../../talents/registry';
import { applyEffect } from '../../../entities/effects.ts';

registerTalent('timeprism', {
  onCastResolved(_state, p, _action, slot, talent) {
    if (slot !== 'basic') applyEffect(p, 'haste', { duration: talent.duration || 1.5, factor: talent.factor || 1.25 });
  },
});
