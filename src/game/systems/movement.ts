// @ts-nocheck
import { ARENA, PLAYER_RADIUS, KNOCKBACK_FRICTION } from '../constants.js';
import { getCharacter } from '../characters.js';
import { clamp } from '../entities/math.ts';

// Boss 全域基底速度倍率：讓所有魔王比玩家略慢 (玩家可拉開距離 / 風箏)，
// 但移動仍流暢不卡頓。recover 破綻期再額外減速。
const BOSS_BASE_SPEED_MULT = 0.95;
const BOSS_RECOVER_SPEED_MULT = 0.62;

export function speedOf(p) {
  const character = getCharacter(p.charId);
  let speed = character.speed;
  if (p.effects.slow) speed *= p.effects.slow.factor;
  if (p.effects.chill) speed *= p.effects.chill.factor;
  if (p.effects.haste) speed *= p.effects.haste.factor;
  if (p.effects.rage) speed *= p.effects.rage.speed;
  if (p.effects.overdrive) speed *= p.effects.overdrive.speed;
  if (p.isBoss) {
    speed *= BOSS_BASE_SPEED_MULT;
    if (p.phaseSpeedMult) speed *= p.phaseSpeedMult;
    if ((p.recoverWindow || 0) > 0) speed *= BOSS_RECOVER_SPEED_MULT;
  } else if (character.meleeRole) {
    speed *= 1.12; // 近戰補正：黏 Boss 不脫節
  }
  return speed;
}

// 加速度：起步 / 煞車的響應度 (越大越靈敏；玩家比 Boss 更敏捷)
const PLAYER_ACCEL = 14;
const BOSS_ACCEL = 9;

export function applyMovement(p, input, dt) {
  const rooted = !!p.effects.root;
  const scrambled = !!p.effects.scramble;
  let targetVx = 0, targetVy = 0;
  if (!p.effects.stun) {
    let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    if (scrambled) { dx = -dx; dy = -dy; }
    if (dx || dy) {
      const l = Math.hypot(dx, dy);
      dx /= l; dy /= l;
      if (input.aim == null && !p.chargeState) p.facing = Math.atan2(dy, dx);
      if (!rooted) {
        const moveSpeed = p.chargeState ? speedOf(p) * 0.5 : speedOf(p); // 蓄力時減速從 0.35 放寬到 0.5
        targetVx = dx * moveSpeed;
        targetVy = dy * moveSpeed;
      }
    }
  }
  // 加速度平滑 (起步漸進、放開鍵慢慢煞車)
  const accel = p.isBoss ? BOSS_ACCEL : PLAYER_ACCEL;
  const k = Math.min(1, dt * accel);
  p.vx += (targetVx - p.vx) * k;
  p.vy += (targetVy - p.vy) * k;
  if (input.aim != null && !p.effects.stun) p.facing = input.aim;

  p.x += (p.vx + p.kvx) * dt;
  p.y += (p.vy + p.kvy) * dt;

  const f = Math.exp(-KNOCKBACK_FRICTION * dt);
  p.kvx *= f;
  p.kvy *= f;

  p.x = clamp(p.x, PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
  p.y = clamp(p.y, PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);
}
