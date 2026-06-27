// 天賦 qiflow（氣勢·循環）：氣球（caster.chi 0–5）是格鬥家的核心。
//   ・modifyOutgoing：持有氣球時，每顆 +atkPerChi 輸出傷害。
//   ・modifyIncoming：持有氣球時，每顆 −defPerChi 承受傷害。
//   ・onDealt：普攻命中聚氣 —— 以 chiGainCd 節流，每隔一小段時間 +1 氣球。
//     （大招落地那一擊由 risingdragon handler 預設 chiGainCd 擋住、不會回補剛消耗掉的氣球。）
//   ・onTimers：遞減 chiGainCd；蓄滿 5 氣 → 持續刷新加速（移速）。
//   ・cooldownRate：蓄滿 5 氣 → 冷卻流速加快（拳速/攻速）。
// 氣球的累積（K 聚氣 +1、大招消耗）在各自 handler；本檔只負責「持有氣球的增益」與「命中聚氣/滿氣獎勵」。
import { registerTalent } from '../../talents/registry';

registerTalent('qiflow', {
  modifyOutgoing({ attacker, dmg, talent }) {
    const chi = Math.min(talent.maxChi || 5, attacker.chi || 0);
    return chi > 0 ? dmg * (1 + chi * (talent.atkPerChi || 0.08)) : dmg;
  },
  modifyIncoming({ target, dmg, talent }) {
    const chi = Math.min(talent.maxChi || 5, target.chi || 0);
    return chi > 0 ? dmg * Math.max(0, 1 - chi * (talent.defPerChi || 0.05)) : dmg;
  },
  onDealt({ attacker, talent }) {
    attacker.chiIdle = 0;                                  // 有出手＝活躍，重置消散計時
    if ((attacker.chiGainCd || 0) > 0) return;            // 節流中：不聚氣（也擋掉大招落地的回補）
    const max = talent.maxChi || 5;
    if ((attacker.chi || 0) < max) {
      attacker.chi = (attacker.chi || 0) + 1;
      attacker.chiGainCd = talent.chiThrottle || 1.5;
    }
  },
  onTimers(_state, p, dt, talent) {
    if ((p.chiGainCd || 0) > 0) p.chiGainCd = Math.max(0, p.chiGainCd - dt);
    // 閒置消散：一段時間沒攻擊/聚氣 → 氣球逐顆散去（讓滿氣需要持續作戰、K 不是聚假的）。
    const idleThresh = talent.idleDecay || 4;
    const decayInt = talent.decayInterval || 2;
    if ((p.chi || 0) > 0) {
      p.chiIdle = (p.chiIdle || 0) + dt;
      if (p.chiIdle >= idleThresh) { p.chi -= 1; p.chiIdle = idleThresh - decayInt; }
    } else {
      p.chiIdle = 0;
    }
    if ((p.chi || 0) >= (talent.maxChi || 5)) {            // 滿氣：持續刷新加速（移速）
      const prev = (p.effects.haste && p.effects.haste.remaining) || 0;
      p.effects.haste = { remaining: Math.max(prev, 0.3), factor: talent.fullHasteFactor || 1.2 };
    }
  },
  cooldownRate(_state, p, talent) {
    return (p.chi || 0) >= (talent.maxChi || 5) ? (talent.fullCdRate || 1.3) : 1;
  },
});
