// @ts-nocheck
import { BaseCharacter } from '../../BaseCharacter.ts';
import { characterSprite } from '../../textureSprite.ts';
import { drawNecromancerTexture } from './texture.ts';
import { modelConfig, buildModel, buildWeapon } from './model.ts';
import './vfx.ts';

const data = {
    id: 'necromancer', order: 16, evadeType: 'blink', name: '死靈法師', color: '#2d3436', shape: 'triangle', sprite: characterSprite('necromancer', '#2d3436', false, drawNecromancerTexture),
    maxHp: 210, maxMana: 110, speed: 155,
    desc: '以血換取強力 DoT 與汲取的暗系法師。亡者之觸讓持續傷害回復自身、生命汲取鎖血、腐蝕爆發釋放毒霧，大招亡靈大軍召喚亡兵並大範圍腐蝕。與法師的瞬間爆發不同——你是持續壓血的死神。',
    role: '特殊 · 持續壓血',
    synergy: '持續 DoT 與汲取壓制肉盾，靠流血/燃燒回血續戰；配控場把敵人困在毒霧裡。',
    talent: { id: 'undeath', name: '亡者之觸', desc: '你造成的持續傷害(燃燒/流血)每跳回復自身等量 10% 的生命。', factor: 0.1 },
    basic: { name: '死亡射線', type: 'projectile', dmg: 16, speed: 560, radius: 12, lifetime: 1.3, knockback: 30, cd: 0.5, color: '#6ab04c', effect: { kind: 'bleed', duration: 3, tick: 0.5, dmg: 6, moveMult: 1.0 }, vfx: 'necro_ray' },
    skill1: { name: '生命汲取', type: 'channel', duration: 3, tick: 0.4, range: 320, dmg: 32, heal: 5, manaCost: 35, cd: 7, color: '#7bed9f', vfx: 'necro_drain' },
    skill2: { name: '腐蝕爆發', type: 'zone', range: 130, radius: 130, dmg: 18, lifetime: 4, tick: 0.5, effect: { kind: 'bleed', duration: 2, tick: 0.5, dmg: 5, moveMult: 1.0 }, manaCost: 40, cd: 9, color: '#27ae60', vfx: 'necro_corrupt' },
    ultimate: { name: '亡靈大軍', type: 'summon', count: 2, cap: 4, minionCharId: -1, minionName: '亡靈僕從', minionHp: 45, minionScale: 0.8, minionLife: 8, zone: { radius: 220, dmg: 20, lifetime: 5, tick: 0.5, effect: { kind: 'bleed', duration: 3, tick: 0.5, dmg: 7, moveMult: 1.0 }, color: '#1e8449', vfx: 'necro_ultimate' }, cd: 12, color: '#2ecc71', vfx: 'necro_ultimate', self: { shield: 150, duration: 6, effects: [{ kind: 'lifesteal', duration: 8, factor: 0.1 }] } },
  };

export class NecromancerCharacter extends BaseCharacter {
  constructor() {
    super(data, {
      modelConfig,
      buildModel,
      buildWeapon,
      paintTexture: drawNecromancerTexture,
      loadVfx: () => undefined,
    });
  }
}

export default new NecromancerCharacter();
