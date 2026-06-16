// @ts-nocheck
import { ARENA, PLAYER_RADIUS, KNOCKBACK_FRICTION } from '../constants.js';
import { getCharacter } from '../characters.js';
import { clamp } from '../entities/math.ts';

export function speedOf(p) {
  const character = getCharacter(p.charId);
  let speed = character.speed;
  if (p.effects.slow) speed *= p.effects.slow.factor;
  if (p.effects.chill) speed *= p.effects.chill.factor;
  if (p.effects.haste) speed *= p.effects.haste.factor;
  if (p.effects.rage) speed *= p.effects.rage.speed;
  return speed;
}

export function applyMovement(p, input, dt) {
  const rooted = !!p.effects.root;
  const scrambled = !!p.effects.scramble;
  if (!p.effects.stun) {
    let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    if (scrambled) {
      dx = -dx;
      dy = -dy;
    }
    if (dx || dy) {
      const l = Math.hypot(dx, dy);
      dx /= l;
      dy /= l;
      if (input.aim == null) p.facing = Math.atan2(dy, dx);
      if (rooted) {
        p.vx = 0;
        p.vy = 0;
      } else {
        const moveSpeed = p.chargeState ? speedOf(p) * 0.35 : speedOf(p);
        p.vx = dx * moveSpeed;
        p.vy = dy * moveSpeed;
      }
    } else {
      p.vx = 0;
      p.vy = 0;
    }
  } else {
    p.vx = 0;
    p.vy = 0;
  }
  if (input.aim != null && !p.effects.stun) p.facing = input.aim;

  p.x += (p.vx + p.kvx) * dt;
  p.y += (p.vy + p.kvy) * dt;

  const f = Math.exp(-KNOCKBACK_FRICTION * dt);
  p.kvx *= f;
  p.kvy *= f;

  p.x = clamp(p.x, PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
  p.y = clamp(p.y, PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);
}
