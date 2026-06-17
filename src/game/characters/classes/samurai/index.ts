// @ts-nocheck
import { BaseCharacter } from '../../BaseCharacter.ts';
import { characterSprite } from '../../textureSprite.ts';
import { drawSamuraiTexture } from './texture.ts';
import { modelConfig, buildModel, buildWeapon } from './model.ts';
import './vfx.ts';

const data = {
    id: 13, name: '武士', color: '#c0392b', shape: 'triangle', sprite: characterSprite('samurai', '#c0392b', false, drawSamuraiTexture), meleeRole: true,
    maxHp: 240, maxMana: 60, speed: 192,
    desc: '蓄勢一擊的精準近戰。居合之道讓蓄力後的出刀致命、居合·閃高速突斬、刀背擋格擋反擊，大招一閃·千刀流連斬群敵。講究的是一擊斃命，與格鬥家的連段、狂戰士的狂暴截然不同。',
    role: '近戰 · 蓄力一擊',
    synergy: '高爆發決鬥者，配控場隊友(忍者/坦克)定住目標，居合一刀致命。',
    talent: { id: 'iaido', name: '居合之道', desc: '持續 2 秒未攻擊後，下一次攻擊 +80% 傷害並短暫提升移速。', delay: 2, bonus: 0.8 },
    basic: { name: '拔刀斬', type: 'melee', dmg: 30, range: 150, arc: 1.0, knockback: 160, cd: 0.7, color: '#ff6b5b', vfx: 'samurai_draw' },
    skill1: { name: '居合·閃', type: 'dash', impulse: 880, dmg: 70, range: 180, arc: 1.1, knockback: 180, effect: { kind: 'bleed', duration: 3, tick: 0.5, dmg: 8, moveMult: 1.5 }, manaCost: 20, cd: 6, color: '#ff8a5b', vfx: 'samurai_iai' },
    skill2: { name: '刀背擋', type: 'buff', shield: 200, cleanse: true, effect: { kind: 'reflect', duration: 1.5, factor: 0.7 }, duration: 1.5, manaCost: 25, cd: 9, color: '#e74c3c', vfx: 'samurai_guard', noIaiReset: true },
    ultimate: { name: '一閃·千刀流', type: 'multiblink', count: 3, dmg: 95, knockback: 160, effect: { kind: 'bleed', duration: 4, tick: 0.5, dmg: 11, moveMult: 1.5 }, cd: 11, color: '#ff3b2f', vfx: 'samurai_ultimate', self: { shield: 80, duration: 3 } },
  };

export class SamuraiCharacter extends BaseCharacter {
  constructor() {
    super(data, {
      modelConfig,
      buildModel,
      buildWeapon,
      paintTexture: drawSamuraiTexture,
      loadVfx: () => undefined,
    });
  }
}

export default new SamuraiCharacter();
