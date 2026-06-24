// @ts-nocheck
import { BaseCharacter } from '../../BaseCharacter.ts';
import { characterSprite } from '../../textureSprite.ts';
import { drawTankTexture } from './texture.ts';
import { modelConfig, buildModel, buildWeapon } from './model.ts';
import './vfx.ts';

const data = {
    id: 'tank', order: 3, evadeType: 'dash', name: '坦克', color: '#7f8c8d', shape: 'square', sprite: characterSprite('tank', '#7f8c8d', true, drawTankTexture), meleeRole: true,
    maxHp: 460, maxMana: 70, speed: 125,
    desc: '前排保護與擾亂堡壘。守護壁壘分享護盾、巨力擒抱聚怪定身，大招橫掃震開敵陣並為全隊罩上減傷護罩。傷害極低，價值在開團與保護。',
    role: '前排 · 保護/擾亂',
    synergy: '頂級前排，分享護盾與減傷光環；啟用突進陣容、保護後排 carry。',
    talent: { id: 'bulwark', name: '鋼鐵壁壘', desc: '永久減免 12% 所受傷害。', dr: 0.12 },
    basic: { name: '重拳', type: 'melee', dmg: 18, range: 115, arc: 1.55, knockback: 280, cd: 0.62, color: '#aab7b8', vfx: 'tank_punch' },
    skill1: { name: '守護壁壘', type: 'buff', shield: 260, cleanse: true, duration: 8, effect: { kind: 'reflect', duration: 8, factor: 0.35 }, manaCost: 30, cd: 11, color: '#dfe6e9', vfx: 'tank_shield', ally: { radius: 280, shield: 140, cleanse: true } },
    skill2: { name: '巨力擒抱', type: 'zone', range: 0, radius: 200, dmg: 30, lifetime: 1.0, tick: 0.5, pull: 340, effect: { kind: 'root', duration: 1.0 }, manaCost: 40, cd: 12, color: '#a0744a', vfx: 'tank_quake' },
    ultimate: { name: '大地崩裂', type: 'zone', range: 60, radius: 160, dmg: 90, lifetime: 1.4, tick: 0.2, moving: 480, knockback: 460, effect: { kind: 'stun', duration: 0.6 }, cd: 12, color: '#cfd8dc', vfx: 'tank_ultimate', ally: { radius: 320, shield: 120, effect: { kind: 'protect', duration: 6, factor: 0.25 } } },
  };

export class TankCharacter extends BaseCharacter {
  constructor() {
    super(data, {
      modelConfig,
      buildModel,
      buildWeapon,
      paintTexture: drawTankTexture,
      loadVfx: () => undefined,
    });
  }
}

export default new TankCharacter();
