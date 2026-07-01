// @ts-nocheck
import { BaseCharacter } from '../../BaseCharacter.ts';
import { characterSprite } from '../../textureSprite.ts';
import { drawSamuraiTexture, drawSamuraiMaterialTexture } from './texture.ts';
import { modelConfig, buildModel, buildWeapon } from './model.ts';
import { tickSamuraiIaijutsu } from './iaijutsu.ts';
import './vfx.ts';
import './talent.ts';

const data = {
    id: 'samurai', order: 13, evadeType: 'dash', name: '武士', color: '#151515', shape: 'triangle', sprite: characterSprite('samurai', '#151515', false, drawSamuraiTexture), meleeRole: true,
    maxHp: 240, maxMana: 60, speed: 196,
    desc: '可玩版無明劍聖。以窄角一文字、縮地斬與納刀架勢掌控距離，奧義斬業一閃會排出三條延遲死線，逼敵人連續側閃。',
    role: '近戰 · 居合死線',
    synergy: '高爆發決鬥者，適合配合定身、減速或隊友壓位，讓斬業一閃的三段死線完整命中。',
    talent: { id: 'iaido', name: '居合之道', desc: '持續 2 秒未攻擊後，下一次攻擊 +80% 傷害並短暫提升移速。', delay: 2, bonus: 0.8 },
    basic: { name: '一文字', type: 'melee', dmg: 30, range: 165, arc: 0.9, knockback: 150, cd: 0.65, color: '#f2f0dc', vfx: 'samurai_draw' },
    skill1: { name: '縮地斬', type: 'dash', impulse: 940, dmg: 72, range: 190, arc: 0.95, knockback: 180, effect: { kind: 'bleed', duration: 3, tick: 0.5, dmg: 8, moveMult: 1.5 }, manaCost: 20, cd: 6.5, color: '#f2f0dc', vfx: 'samurai_iai' },
    skill2: { name: '納刀架勢', type: 'buff', shield: 200, cleanse: true, effect: { kind: 'reflect', duration: 1.4, factor: 0.65 }, duration: 1.4, manaCost: 25, cd: 9, color: '#d94343', vfx: 'samurai_guard', noIaiReset: true },
    ultimate: { name: '斬業一閃', type: 'samurai_iaijutsu', count: 3, dmg: 80, finalDmg: 125, range: 760, radius: 34, strikeDelay: 0.32, knockback: 220, effect: { kind: 'bleed', duration: 4, tick: 0.5, dmg: 11, moveMult: 1.5 }, cd: 12, color: '#d94343', telegraphColor: '#f2f0dc', vfx: 'samurai_ultimate', self: { shield: 80, duration: 3 } },
  };

export class SamuraiCharacter extends BaseCharacter {
  constructor() {
    super(data, {
      modelConfig,
      buildModel,
      buildWeapon,
      paintTexture: drawSamuraiTexture,
      paintMaterialTexture: drawSamuraiMaterialTexture,
      loadVfx: () => undefined,
      tick: tickSamuraiIaijutsu,
    });
  }
}

export default new SamuraiCharacter();
