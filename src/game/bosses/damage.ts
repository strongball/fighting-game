import { getCharacter } from '../characters.js';

import { getBoss } from '../bosses.js';

function angleDiff(a: number, b: number) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function applyBossDamageModifiers(state: any, boss: any, attacker: any, amount: number) {
  const mech = getCharacter(boss.charId).mechanic;
  if (!mech) return amount;

  let dmg = amount;
  if (attacker && (mech.frontArmor || mech.backWeak)) {
    const ang = Math.atan2(attacker.y - boss.y, attacker.x - boss.x);
    const rel = Math.abs(angleDiff(ang, boss.facing));
    if (mech.frontArmor && rel < 0.9) dmg *= 1 - mech.frontArmor;
    if (mech.backWeak && rel > Math.PI - 0.9) dmg *= 1 + mech.backWeak;
  }

  const bossData = getBoss(boss.charId);
  if (bossData && typeof bossData.modifyIncomingDamage === 'function') {
    dmg = bossData.modifyIncomingDamage(state, boss, attacker, dmg);
  }

  if (mech.minionShield) {
    let alive = 0;
    for (const o of Object.values(state.players) as any[]) {
      if (o.isMinion && o.ownerId === boss.id && o.alive) alive++;
    }
    if (alive > 0) {
      dmg *= 1 - Math.min(mech.minionShield.max || 0.7, (mech.minionShield.perMinion || 0.15) * alive);
    }
  }

  if (mech.coreArmorUntilPartsDown) {
    let anyPartAlive = false;
    for (const o of Object.values(state.players) as any[]) {
      if (o.isPart && o.ownerId === boss.id && o.alive) { anyPartAlive = true; break; }
    }
    if (anyPartAlive) dmg *= 1 - mech.coreArmorUntilPartsDown;
  }

  return dmg;
}
