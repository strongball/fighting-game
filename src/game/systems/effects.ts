import { PLAYER_RADIUS } from '../constants.js';
import { getCharacter } from '../characters.js';
import { dealDamage, hatchParasite } from '../entities/damage.ts';
import { applyEffect } from '../entities/effects.ts';
import { applyHeal } from '../entities/heal.ts';
import { addFx } from '../entities/fx.ts';
import type { GameState, Player, EntityId } from '../types';

function dotLifesteal(state: GameState, srcId: EntityId | null | undefined, dmg: number) {
  if (srcId == null || !dmg) return;
  const src = state.players[srcId];
  if (!src || !src.alive) return;
  const talent = getCharacter(src.charId).talent;
  if (talent && talent.id === 'undeath') applyHeal(state, src, dmg * (talent.factor || 0.15));
}

// 死靈「亡者之觸」收割：來源帶 undeath 天賦、且目標殘血(低於門檻)時，DoT 每跳傷害放大。
// 把慢性 DoT 變成能真正收尾的處決手段（其餘來源回傳 1，不受影響）。
function necroDotMult(state: GameState, srcId: EntityId | null | undefined, target: Player): number {
  if (srcId == null) return 1;
  const src = state.players[srcId];
  if (!src || !src.alive) return 1;
  const talent = getCharacter(src.charId).talent;
  if (!talent || talent.id !== 'undeath' || !talent.execBonus) return 1;
  const frac = target.maxHp ? target.hp / target.maxHp : 1;
  return frac <= (talent.execThreshold || 0.35) ? 1 + talent.execBonus : 1;
}

export function tickStatusEffects(state: GameState, p: Player, dt: number) {
  // 遞減 CC 冷卻
  if (p.ccCooldown) {
    for (const kind of Object.keys(p.ccCooldown)) {
      p.ccCooldown[kind] -= dt;
      if (p.ccCooldown[kind] <= 0) delete p.ccCooldown[kind];
    }
  }

  for (const kind of Object.keys(p.effects)) {
    const effect = p.effects[kind]!;
    effect.remaining -= dt;

    if (kind === 'burn') {
      effect.tickTimer -= dt;
      if (effect.tickTimer <= 0) {
        effect.tickTimer += effect.tick;
        const dmg = effect.dmg * necroDotMult(state, effect.srcId, p);
        dealDamage(state, p, dmg, effect.srcId, { source: effect.srcSlot });
        dotLifesteal(state, effect.srcId, dmg);
        addFx(state, { type: 'burn', x: p.x, y: p.y, color: '#ff6b3d', life: 0.3, radius: PLAYER_RADIUS });
      }
    } else if (kind === 'bleed') {
      const moving = (Math.abs(p.vx) + Math.abs(p.vy)) > 1;
      effect.tickTimer -= dt * (moving ? effect.moveMult : 1);
      if (effect.tickTimer <= 0) {
        effect.tickTimer += effect.tick;
        const dmg = effect.dmg * necroDotMult(state, effect.srcId, p);
        dealDamage(state, p, dmg, effect.srcId, { source: effect.srcSlot });
        dotLifesteal(state, effect.srcId, dmg);
        addFx(state, { type: 'burn', x: p.x, y: p.y, color: '#e84141', life: 0.3, radius: PLAYER_RADIUS });
      }
    } else if (kind === 'parasite') {
      effect.tickTimer -= dt;
      if (effect.tickTimer <= 0) {
        effect.tickTimer += effect.tick;
        const dmg = effect.dmg * necroDotMult(state, effect.srcId, p);
        dealDamage(state, p, dmg, effect.srcId, { dot: true, source: effect.srcSlot });
        dotLifesteal(state, effect.srcId, dmg);
        addFx(state, { type: 'burn', x: p.x, y: p.y, color: '#1abc9c', life: 0.3, radius: PLAYER_RADIUS });
      }
      // 時間到 → 孵化引爆（DoT 已先擊殺者由死亡區引爆，此處以 p.alive 防重複）。
      if (effect.remaining <= 0 && p.alive) hatchParasite(state, p);
    } else if (kind === 'chill') {
      if (effect.stacks >= effect.max && !effect.froze) {
        effect.froze = true;
        applyEffect(p, 'stun', { duration: effect.freezeDur });
        applyEffect(p, 'frozen', { duration: effect.freezeDur });
        effect.remaining = 0;
        addFx(state, { type: 'hit', x: p.x, y: p.y, color: '#9fe8ff', life: 0.4, radius: PLAYER_RADIUS * 2.5, vfx: 'mage_iceshard' });
      }
    } else if (kind === 'regen_hot') {
      effect.tickTimer -= dt;
      if (effect.tickTimer <= 0) {
        effect.tickTimer += 1.0;
        applyHeal(state, p, effect.amountPerSec, { burst: true });
      }
    }

    if (effect.remaining <= 0) delete p.effects[kind];
  }
}
