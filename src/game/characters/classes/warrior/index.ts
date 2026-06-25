// @ts-nocheck
import { BaseCharacter } from '../../BaseCharacter.ts';
import { characterSprite } from '../../textureSprite.ts';
import { drawWarriorTexture } from './texture.ts';
import { modelConfig, buildModel, buildWeapon } from './model.ts';
import './vfx.ts';

const data = {
    id: 'warrior', order: 0, evadeType: 'dash', name: '戰士', color: '#e74c3c', shape: 'square', sprite: characterSprite('warrior', '#e74c3c', true, drawWarriorTexture), meleeRole: true,
    maxHp: 300, maxMana: 60, speed: 175,
    desc: '前排錨點。突刺開團、鉤索拉人，大招化身不動堡壘為全隊套上護盾並震懾敵群。傷害不高，價值在保護與控制。',
    role: '前排 · 開團/保護',
    synergy: '搭配脆皮爆發(法師/弓箭手/刺客)：突刺開團、鉤索拉人，替隊友創造擊殺空間。',
    talent: { id: 'unbreakable', name: '不屈鬥志', desc: '血量越低，受到的傷害減免越高（最高 −30%）。', maxDr: 0.30 },
    basic: { name: '橫掃', type: 'melee', dmg: 26, range: 200, arc: Math.PI, knockback: 180, cd: 0.55, color: '#ff6b5b', vfx: 'warrior_slash' }, // 180° 扇形橫掃
    skill1: { name: '戰矛突刺', type: 'charge', speed: 1000, range: 320, dmg: 70, hitRadius: 50, knockback: 300, stopOnHit: true, effect: { kind: 'stun', duration: 0.6 }, manaCost: 25, cd: 9, color: '#ff8a5b', vfx: 'warrior_charge' },
    skill2: { name: '鎖鏈鉤爪', type: 'grapple', speed: 820, dmg: 40, radius: 13, lifetime: 0.6, gap: 28, effect: { kind: 'slow', duration: 1.6, factor: 0.5 }, manaCost: 30, cd: 11, color: '#f0a35b', vfx: 'warrior_grapple' },
    ultimate: { name: '不動如山', type: 'zone', range: 0, radius: 150, dmg: 90, lifetime: 0.4, tick: 0.4, knockback: 300, effect: { kind: 'stun', duration: 0.8 }, cd: 11, color: '#ffcaa0', vfx: 'warrior_ultimate', self: { shield: 280, cleanse: true, duration: 6 }, ally: { radius: 320, shield: 160, cleanse: true } },
  };

export class WarriorCharacter extends BaseCharacter {
  constructor() {
    super(data, {
      modelConfig,
      buildModel,
      buildWeapon,
      paintTexture: drawWarriorTexture,
      loadVfx: () => undefined,
    });
  }
}

export default new WarriorCharacter();
