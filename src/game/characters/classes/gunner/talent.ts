// 天賦 suppress（壓制）：對同一目標持續壓制累積層數增傷；命中後累加層數（換目標則重置）。
import { registerTalent } from '../../talents/registry';

registerTalent('suppress', {
  modifyOutgoing({ attacker, target, dmg, talent }) {
    if (attacker.suppressTarget === target.id) {
      const stacks = Math.min(talent.maxStacks || 5, attacker.suppressStacks || 0);
      if (stacks > 0) return dmg * (1 + stacks * (talent.perStack || 0.08));
    }
    return dmg;
  },
  onDealt({ attacker, target, talent }) {
    if (attacker.suppressTarget === target.id) attacker.suppressStacks = Math.min(talent.maxStacks || 5, (attacker.suppressStacks || 0) + 1);
    else { attacker.suppressTarget = target.id; attacker.suppressStacks = 1; }
  },
});
