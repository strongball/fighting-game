// @ts-nocheck
import { BaseCharacter } from '../../BaseCharacter.ts';
import { characterSprite } from '../../textureSprite.ts';
import { drawElementalistTexture } from './texture.ts';
import { modelConfig, buildModel, buildWeapon } from './model.ts';
import './vfx.ts';

const data = {
    id: 'elementalist', order: 8, evadeType: 'blink', name: '元素使', color: '#e67e22', shape: 'circle', sprite: characterSprite('elementalist', '#e67e22', true, drawElementalistTexture),
    maxHp: 220, maxMana: 150, speed: 160,
    desc: '封鎖地形的持續法師。推進火牆封路、寒霜足跡留下凍徑風箏，大招隕石風暴覆蓋大片區域持續灼燒。不擅爆發、極耗魔，靠擊退類隊友把敵人逼進火海。',
    role: '控制 · 區域封鎖',
    synergy: '配擊退/控場隊友(戰士/坦克)把敵人逼進火海與凍徑、鎖死戰場。',
    talent: { id: 'pyromancy', name: '烈焰精通', desc: '自身造成的燃燒傷害更高、持續更久。', burnDmg: 1.3, burnDur: 1.2 },
    basic: { name: '火花', type: 'melee', dmg: 14, range: 135, arc: 1.35, knockback: 40, cd: 0.4, color: '#f39c12', effect: { kind: 'burn', duration: 2, tick: 0.5, dmg: 4 }, vfx: 'elem_spark' },
    skill1: { name: '烈焰洪流', type: 'zone', range: 60, radius: 110, dmg: 22, lifetime: 2.6, tick: 0.4, moving: 320, effect: { kind: 'burn', duration: 2, tick: 0.5, dmg: 6 }, manaCost: 40, cd: 7, color: '#e74c3c', vfx: 'elem_firezone' },
    skill2: { name: '寒霜足跡', type: 'buff', duration: 3, manaCost: 40, cd: 9, color: '#74e0ff', vfx: 'elem_frost', effect: { kind: 'haste', duration: 3, factor: 1.2 }, trail: { duration: 3, spacing: 44, zone: { radius: 90, dmg: 14, lifetime: 1.6, tick: 0.5, effect: { kind: 'chill', stacks: 1, duration: 2, max: 4, freezeDur: 1.0 }, color: '#9fe8ff', vfx: 'elem_frost' } } },
    ultimate: { name: '隕石風暴', type: 'zone', range: 150, radius: 130, dmg: 55, lifetime: 0.4, tick: 0.4, delay: 0.8, count: 7, scatter: 220, stagger: 0.14, effect: { kind: 'burn', duration: 3, tick: 0.5, dmg: 10 }, cd: 11, color: '#ff5a1f', vfx: 'elem_ultimate' },
  };

export class ElementalistCharacter extends BaseCharacter {
  constructor() {
    super(data, {
      modelConfig,
      buildModel,
      buildWeapon,
      paintTexture: drawElementalistTexture,
      loadVfx: () => undefined,
    });
  }
}

export default new ElementalistCharacter();
