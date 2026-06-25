// 天賦 talonsight（鷹瞳）：連續命中累積，每第 N 次命中必定爆擊（+bonus）。
// 攻速越快 → 命中越密 → 爆擊越頻繁，與本角色的「攻速爆發」定位相扣。
//
// 另：技能「鷹眼凝視 (skill2)」會開啟一段「必爆窗口」——窗口期間每次命中皆爆擊。
// 窗口計時由 onTimers 每幀遞減，於 onCastResolved 施放 skill2 時設定。
// （老鷹的鷹擊另為必定爆擊，見 falcon.ts。）
import { registerTalent } from '../../talents/registry';
import { startFalconStorm } from './falcon.ts';

// 每名玩家的鷹瞳狀態（命中計數 + 必爆窗口剩餘秒數），lazy 初始化以相容舊存檔/測試。
function talonState(p: any) {
  return p._talon || (p._talon = { hits: 0, eagleEye: 0 });
}

registerTalent('talonsight', {
  // 傷害管線：每次對敵命中 +1，達到「每 N 次」或處於必爆窗口時必定爆擊。
  modifyOutgoing({ attacker, dmg, talent }) {
    const s = talonState(attacker);
    s.hits++;
    const every = talent.every || 3;
    const crit = s.eagleEye > 0 || s.hits % every === 0;
    return crit ? dmg * (1 + (talent.bonus || 0.7)) : dmg;
  },
  // 每幀遞減必爆窗口。
  onTimers(_state, p, dt) {
    const s = talonState(p);
    if (s.eagleEye > 0) s.eagleEye = Math.max(0, s.eagleEye - dt);
  },
  // skill2 鷹眼凝視 → 開啟必爆窗口；ultimate 鷹擊風暴 → 鷹連續來回俯衝。
  onCastResolved(state, p, action, slot) {
    if (slot === 'skill2') talonState(p).eagleEye = action.duration || 3;
    else if (slot === 'ultimate') startFalconStorm(state, p, action.duration || 3.4);
  },
});
