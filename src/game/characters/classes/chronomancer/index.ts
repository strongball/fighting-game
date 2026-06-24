// @ts-nocheck
import { BaseCharacter } from '../../BaseCharacter.ts';
import { characterSprite } from '../../textureSprite.ts';
import { drawChronomancerTexture } from './texture.ts';
import { modelConfig, buildModel, buildWeapon } from './model.ts';
import './vfx.ts';
import './talent.ts';

const data = {
    id: 'chronomancer', order: 17, evadeType: 'blink', name: '時空術士', color: '#00bcd4', shape: 'circle', sprite: characterSprite('chronomancer', '#00bcd4', false, drawChronomancerTexture),
    maxHp: 180, maxMana: 140, speed: 175,
    desc: '操控時空節奏的高技巧法師。時間稜鏡讓施法後快速走位、時間加速增幅友軍、時間停滯凍結敵群，大招時空逆轉回溯自身的位置與血量並在原地引爆。脆皮但能扭轉戰局。',
    role: '特殊 · 戰場操控',
    synergy: '加速友軍、減速敵人、回溯自保；高上限操控型，配爆發 carry 把握時停窗口。',
    talent: { id: 'timeprism', name: '時間稜鏡', desc: '每次施放技能後獲得 1.5 秒加速（+25% 移速），便於施法後重新走位。', duration: 1.5, factor: 1.25 },
    basic: { name: '時空裂隙', type: 'projectile', dmg: 16, speed: 560, radius: 12, lifetime: 1.4, knockback: 30, cd: 0.55, color: '#4dd0e1', effect: { kind: 'slow', duration: 1.5, factor: 0.6 }, vfx: 'chrono_rift' },
    skill1: { name: '時間加速', type: 'buff', manaCost: 30, cd: 9, color: '#80deea', vfx: 'chrono_haste', ally: { radius: 300, effects: [{ kind: 'haste', duration: 5, factor: 1.4 }, { kind: 'rage', duration: 5, speed: 1.0, dmg: 1.2 }] } },
    skill2: { name: '時間停滯', type: 'zone', range: 130, radius: 140, dmg: 20, lifetime: 0.4, tick: 0.4, effects: [{ kind: 'stun', duration: 1.2 }, { kind: 'slow', duration: 2, factor: 0.5 }], manaCost: 40, cd: 11, color: '#00bcd4', vfx: 'chrono_stasis' },
    ultimate: { name: '時空逆轉', type: 'zone', range: 0, radius: 170, dmg: 60, lifetime: 0.4, tick: 0.4, knockback: 200, effect: { kind: 'stun', duration: 1.0 }, rewindSelf: { seconds: 3 }, cd: 12, color: '#26c6da', vfx: 'chrono_ultimate', ally: { radius: 320, shield: 180, cleanse: true } },
  };

export class ChronomancerCharacter extends BaseCharacter {
  constructor() {
    super(data, {
      modelConfig,
      buildModel,
      buildWeapon,
      paintTexture: drawChronomancerTexture,
      loadVfx: () => undefined,
    });
  }
}

export default new ChronomancerCharacter();
