// @ts-nocheck
import { BaseCharacter } from '../../BaseCharacter.ts';
import { characterSprite } from '../../textureSprite.ts';
import { drawElementalistTexture } from './texture.ts';
import { modelConfig, buildModel, buildWeapon } from './model.ts';
import './vfx.ts';

const data = {
    id: 'elementalist', order: 8, evadeType: 'blink', name: '元素使', color: '#e67e22', shape: 'circle', sprite: characterSprite('elementalist', '#e67e22', true, drawElementalistTexture),
    maxHp: 220, maxMana: 150, speed: 160,
    desc: '三元素區域封鎖法師。火焰扇近身灼燒、雷霆風暴推進壓制、寒霜足跡留下凍徑封路，大招隕石風暴覆蓋大片區域持續灼燒。靠三系區域技能把戰場化為禁區。',
    role: '控制 · 區域封鎖',
    synergy: '配擊退/控場隊友(戰士/坦克)把敵人逼進雷雲與凍徑，鎖死戰場。',
    talent: { id: 'pyromancy', name: '烈焰精通', desc: '自身造成的燃燒傷害更高、持續更久。', burnDmg: 1.3, burnDur: 1.2 },
    basic: { name: '火焰扇', type: 'melee', dmg: 42, range: 280, arc: 1.8, knockback: 60, cd: 2.0, color: '#f39c12', effect: { kind: 'burn', duration: 2, tick: 0.5, dmg: 5 }, vfx: 'elem_flamefan' },
    skill1: { name: '雷霆風暴', type: 'zone', range: 80, radius: 180, dmg: 18, lifetime: 3.0, tick: 0.5, delay: 0.3, moving: 120, manaCost: 35, cd: 7, color: '#42a5f5', vfx: 'elem_lightningstorm' },
    skill2: { name: '寒霜足跡', type: 'buff', duration: 3, manaCost: 40, cd: 9, color: '#74e0ff', vfx: 'elem_frost', effect: { kind: 'haste', duration: 3, factor: 1.6 }, trail: { duration: 3, spacing: 120, zone: { radius: 120, dmg: 8, lifetime: 5.0, tick: 0.5, effect: { kind: 'chill', stacks: 1, duration: 2, max: 4, freezeDur: 1.0 }, color: '#9fe8ff', vfx: 'elem_frost' } }, castZone: { radius: 120, dmg: 8, lifetime: 5.0, tick: 0.5, effect: { kind: 'chill', stacks: 1, duration: 2, max: 4, freezeDur: 1.0 }, color: '#9fe8ff', vfx: 'elem_frost' } },
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
