// 天賦 summonbond（戰靈護主）：身邊存活的召喚物越多，主人受到的傷害越低。
// 註：另有「召喚物命中敵人時回血給主人」的互動仍內聯於 damage.ts（召喚物本身無天賦，
// 屬跨實體 owner 邏輯，之後可隨 onTick/aura hook 一併搬移）。
import { registerTalent } from '../../talents/registry';

registerTalent('summonbond', {
  modifyIncoming({ state, target, dmg, talent }) {
    let n = 0;
    for (const other of Object.values(state.players) as any[]) if (other.isMinion && other.ownerId === target.id && other.alive) n++;
    if (n > 0) return dmg * (1 - Math.min(talent.maxStacks || 3, n) * (talent.dr || 0.1));
    return dmg;
  },
});
