// @ts-nocheck
import { BaseCharacter } from '../../BaseCharacter.ts';
import { characterSprite } from '../../textureSprite.ts';
import { drawNecromancerTexture } from './texture.ts';
import { modelConfig, buildModel, buildWeapon } from './model.ts';
import './vfx.ts';

const data = {
    id: 'necromancer', order: 16, evadeType: 'blink', name: '死靈法師', color: '#2d3436', shape: 'triangle', sprite: characterSprite('necromancer', '#2d3436', false, drawNecromancerTexture),
    maxHp: 210, maxMana: 120, speed: 155,
    desc: '以血換取強力 DoT 與汲取的暗系法師。亡者之觸讓持續傷害回血、並收割殘血敵人（DoT 對低血量目標暴增）；死亡射線貫穿鋪血、生命汲取邊吸血邊鎖速、腐蝕爆發釋放毒霧汲取，大招亡靈大軍召喚會流血的亡兵並大範圍腐蝕。與法師的瞬間爆發不同——你是持續壓血、越打越穩的死神。',
    role: '特殊 · 持續壓血',
    synergy: '持續 DoT 與汲取壓制肉盾，靠流血/燃燒回血續戰；殘血敵人被 DoT 收割，配控場把敵人困在毒霧裡慢慢榨乾。',
    talent: { id: 'undeath', name: '亡者之觸', desc: '你造成的持續傷害(燃燒/流血)每跳回復自身等量 18% 生命；對生命低於 35% 的敵人，你的持續傷害提升 60%（收割）。', factor: 0.18, execThreshold: 0.35, execBonus: 0.6 },
    basic: { name: '死亡射線', type: 'projectile', dmg: 22, speed: 560, radius: 12, lifetime: 1.3, knockback: 30, pierce: true, cd: 0.5, color: '#6ab04c', effect: { kind: 'bleed', duration: 3, tick: 0.5, dmg: 7, moveMult: 1.0 }, vfx: 'necro_ray' },
    skill1: { name: '生命汲取', type: 'channel', duration: 3, tick: 0.4, range: 320, dmg: 32, heal: 10, effect: { kind: 'slow', factor: 0.55, duration: 0.6 }, manaCost: 30, cd: 6, color: '#7bed9f', vfx: 'necro_drain' },
    skill2: { name: '腐蝕爆發', type: 'zone', range: 130, radius: 130, dmg: 24, lifetime: 4, tick: 0.5, drainHeal: 4, effects: [{ kind: 'bleed', duration: 2, tick: 0.5, dmg: 5, moveMult: 1.0 }, { kind: 'slow', factor: 0.7, duration: 0.8 }], manaCost: 35, cd: 8, color: '#27ae60', vfx: 'necro_corrupt' },
    ultimate: { name: '亡靈大軍', type: 'summon', count: 3, cap: 5, minionCharId: -5, minionName: '亡靈僕從', minionHp: 95, minionScale: 0.8, minionLife: 12, zone: { radius: 220, dmg: 26, lifetime: 5, tick: 0.5, drainHeal: 5, effect: { kind: 'bleed', duration: 3, tick: 0.5, dmg: 7, moveMult: 1.0 }, color: '#1e8449', vfx: 'necro_ultimate' }, cd: 12, color: '#2ecc71', vfx: 'necro_ultimate', self: { shield: 200, duration: 7, effects: [{ kind: 'lifesteal', duration: 8, factor: 0.2 }] } },
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
