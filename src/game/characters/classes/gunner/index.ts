// @ts-nocheck
import { BaseCharacter } from '../../BaseCharacter.ts';
import { characterSprite } from '../../textureSprite.ts';
import { drawGunnerTexture } from './texture.ts';
import { modelConfig, buildModel, buildWeapon } from './model.ts';
import './vfx.ts';

const data = {
    id: 14, name: '槍手', color: '#d4a017', shape: 'circle', sprite: characterSprite('gunner', '#d4a017', false, drawGunnerTexture),
    maxHp: 200, maxMana: 70, speed: 210,
    desc: '高機動的雙槍射手。火力壓制讓持續點射越打越痛、翻滾閃避位移強化、燃燒彈爆裂灼燒，大招彈幕風暴近距傾瀉。與弓箭手的定點遠射相反——越近越強、快節奏、多發。',
    role: '後排 · 機動跑打',
    synergy: '中近距跑打 carry，靠走位自保；持續壓制單一目標滾雪球，配前排掩護。',
    talent: { id: 'suppress', name: '火力壓制', desc: '連續命中同一目標，每次命中 +8% 傷害（最多 5 層），切換目標重置。', perStack: 0.08, maxStacks: 5 },
    basic: { name: '雙槍射擊', type: 'projectile', dmg: 11, speed: 720, radius: 9, lifetime: 1.0, count: 2, spread: 0.1, knockback: 20, cd: 0.45, color: '#f6c544', vfx: 'gunner_shot' },
    skill1: { name: '翻滾閃避', type: 'blink', range: 180, knockback: 0, manaCost: 20, cd: 5, color: '#ffd76a', vfx: 'gunner_roll', self: { effect: { kind: 'rage', duration: 1.2, speed: 1.2, dmg: 1.4 } } },
    skill2: { name: '燃燒彈', type: 'projectile', dmg: 55, speed: 640, radius: 13, lifetime: 1.0, knockback: 80, manaCost: 30, cd: 8, color: '#ff7a18', effect: { kind: 'burn', duration: 3, tick: 0.5, dmg: 8 }, leaveZone: { radius: 90, dmg: 14, lifetime: 1.6, tick: 0.5, effect: { kind: 'burn', duration: 2, tick: 0.5, dmg: 5 }, color: '#ff6a1a', vfx: 'gunner_incendiary' }, vfx: 'gunner_incendiary' },
    ultimate: { name: '彈幕風暴', type: 'projectile', dmg: 26, speed: 760, radius: 11, lifetime: 0.8, count: 12, spread: 0.7, knockback: 70, cd: 10, color: '#ffd76a', vfx: 'gunner_ultimate' },
  };

export class GunnerCharacter extends BaseCharacter {
  constructor() {
    super(data, {
      modelConfig,
      buildModel,
      buildWeapon,
      paintTexture: drawGunnerTexture,
      loadVfx: () => undefined,
    });
  }
}

export default new GunnerCharacter();
