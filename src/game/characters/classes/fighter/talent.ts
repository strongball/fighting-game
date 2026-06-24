// 天賦 momentum（連擊）：連續命中累積層數增傷；每次造成傷害 +1 層並刷新計時。
import { registerTalent } from '../../talents/registry';

registerTalent('momentum', {
  modifyOutgoing({ attacker, dmg, talent }) {
    const stacks = Math.min(talent.maxStacks || 5, attacker.combo || 0);
    if (stacks > 0) return dmg * (1 + stacks * (talent.perStack || 0.1));
    return dmg;
  },
  onDealt({ attacker, talent }) {
    attacker.combo = Math.min(talent.maxStacks || 5, (attacker.combo || 0) + 1);
    attacker.comboTimer = talent.window || 2.2;
  },
});
