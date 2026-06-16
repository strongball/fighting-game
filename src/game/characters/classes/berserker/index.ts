// @ts-nocheck
import { BaseCharacter } from '../../BaseCharacter.ts';
import { characterSprite } from '../../textureSprite.ts';
import { drawBerserkerTexture } from './texture.ts';
import { modelConfig, buildModel, buildWeapon } from './model.ts';
import './vfx.ts';

const data = {
    id: 6, name: '狂戰士', color: '#922b21', shape: 'square', sprite: characterSprite('berserker', '#922b21', true, drawBerserkerTexture),
    maxHp: 290, maxMana: 50, speed: 152,
    desc: '殘血滾雪球的處決者。躍斬入場撕裂流血、血怒爆走自損續戰，大招血祭對殘敵直接斬殺。高風險高回報，靠治療補上自損的血量。',
    role: '突進 · 處決鬥士',
    synergy: '配治療師補上自損與血怒的血量；殘血越強，剋高血肉盾(坦克/戰士)。',
    talent: { id: 'bloodlust', name: '嗜血狂暴', desc: '血量越低，攻擊速度與吸血量越高。', haste: 0.6, lifesteal: 0.25 },
    basic: { name: '雙斧', type: 'melee', dmg: 22, range: 110, arc: 1.7, knockback: 130, cd: 0.46, lowHpBonus: true, color: '#cd6155', vfx: 'berserker_axes' },
    skill1: { name: '嗜血躍斬', type: 'leap', range: 270, dur: 0.45, dmg: 80, radius: 130, knockback: 200, effect: { kind: 'bleed', duration: 4, tick: 0.5, dmg: 8, moveMult: 1.5 }, manaCost: 20, cd: 7, color: '#ec7063', vfx: 'berserker_leap' },
    skill2: { name: '血怒', type: 'buff', hpCost: 25, heal: 40, effect: { kind: 'rage', duration: 8, speed: 1.4, dmg: 1.5 }, duration: 8, cd: 10, color: '#e74c3c', vfx: 'berserker_rage', self: { effects: [{ kind: 'lifesteal', duration: 8, factor: 0.35 }] } },
    ultimate: { name: '血祭處決', type: 'dash', impulse: 980, dmg: 90, range: 200, arc: 7, knockback: 280, execute: { threshold: 0.25, mult: 3 }, cd: 11, color: '#ff3b2f', vfx: 'berserker_ultimate', self: { heal: 120, effects: [{ kind: 'rage', duration: 10, speed: 1.7, dmg: 1.7 }, { kind: 'lifesteal', duration: 10, factor: 0.5 }] } },
  };

export class BerserkerCharacter extends BaseCharacter {
  constructor() {
    super(data, {
      modelConfig,
      buildModel,
      buildWeapon,
      paintTexture: drawBerserkerTexture,
      loadVfx: () => undefined,
    });
  }
}

export default new BerserkerCharacter();
