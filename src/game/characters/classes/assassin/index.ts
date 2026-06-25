// @ts-nocheck
import { BaseCharacter } from '../../BaseCharacter.ts';
import { characterSprite } from '../../textureSprite.ts';
import { drawAssassinTexture } from './texture.ts';
import { modelConfig, buildModel, buildWeapon } from './model.ts';
import './vfx.ts';
import './talent.ts';

const data = {
    id: 'assassin', order: 2, evadeType: 'dash', name: '刺客', color: '#9b59b6', shape: 'triangle', sprite: characterSprite('assassin', '#9b59b6', true, drawAssassinTexture), meleeRole: true,
    maxHp: 190, maxMana: 70, speed: 240,
    desc: '黏著輸出的近身收割者。連刃疊加流血、影刺突拉近補刀並標記，噬血爆刃引爆標記灌出爆發，殘血敵人在死罪處決下直接蒸發。要的是貼臉不放、滾雪球收人頭——和忍者的瞬移暗殺完全相反。',
    role: '近戰 · 流血/處決',
    synergy: '靠隊友控場貼上去後就不鬆口；對流血目標傷害更高、吸血更多，殘血一個處決帶走，擅長滾雪球收割脆皮。',
    talent: { id: 'bloodthirst', name: '嗜血', desc: '對流血中的敵人造成 +30% 傷害。連刃會持續疊加流血，越黏越痛。', bonus: 0.30 },
    basic: { name: '連刃', type: 'melee', dmg: 18, range: 95, arc: 1.5, knockback: 40, cd: 0.3, color: '#c39bd3', effect: { kind: 'bleed', dmg: 6, duration: 4, tick: 0.5, moveMult: 1.4 }, vfx: 'assassin_slash' },
    skill1: { name: '影刺突', type: 'dash', impulse: 860, dmg: 45, range: 120, arc: 1.6, knockback: 80, effect: { kind: 'mark', factor: 0.25, duration: 4 }, manaCost: 22, cd: 6, color: '#c39bd3', vfx: 'assassin_dash' },
    skill2: { name: '噬血爆刃', type: 'melee', dmg: 70, range: 120, arc: 2.2, knockback: 150, detonate: { mult: 2.2 }, manaCost: 35, cd: 8, color: '#e056fd', vfx: 'assassin_backstab', self: { effects: [{ kind: 'lifesteal', duration: 4, factor: 0.45 }] } },
    ultimate: { name: '死罪處決', type: 'melee', dmg: 95, range: 160, arc: 2.8, knockback: 160, execute: { threshold: 0.4, mult: 3.0 }, cd: 11, color: '#e056fd', vfx: 'assassin_ultimate', self: { heal: 60, effects: [{ kind: 'lifesteal', duration: 6, factor: 0.5 }, { kind: 'haste', duration: 3, factor: 1.3 }] } },
  };

export class AssassinCharacter extends BaseCharacter {
  constructor() {
    super(data, {
      modelConfig,
      buildModel,
      buildWeapon,
      paintTexture: drawAssassinTexture,
      loadVfx: () => undefined,
    });
  }
}

export default new AssassinCharacter();
