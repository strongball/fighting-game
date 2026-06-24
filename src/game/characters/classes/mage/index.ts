// @ts-nocheck
import { BaseCharacter } from '../../BaseCharacter.ts';
import { characterSprite } from '../../textureSprite.ts';
import { drawMageTexture } from './texture.ts';
import { modelConfig, buildModel, buildWeapon } from './model.ts';
import { attachSkinGear } from './gear.ts';
import './vfx.ts';
import './talent.ts';

const data = {
    id: 'mage', order: 1, evadeType: 'blink', name: '法師', color: '#3498db', shape: 'circle', sprite: characterSprite('mage', '#3498db', true, drawMageTexture),
    maxHp: 170, maxMana: 140, speed: 158,
    desc: '遠程爆發法師，全靠瞄準。飛彈不再追蹤、寒冰矛凍結起手、烈焰吐息近身爆發，大招天降流星（落點預警可閃避）單體灌爆。脆皮且極耗魔，落空就斷魔。',
    role: '後排 · 遠程爆發',
    synergy: '需前排(戰士/坦克)保護與控場，替你定住目標好讓流星與冰矛命中。',
    talent: { id: 'arcane_flow', name: '奧術迴流', desc: '法術命中敵人時回復 8 點魔力。', mana: 8 },
    basic: { name: '奧術飛彈', type: 'projectile', dmg: 26, speed: 460, radius: 14, lifetime: 1.6, knockback: 60, cd: 0.6, color: '#7aa2ff', vfx: 'mage_fireball' },
    skill1: { name: '烈焰吐息', type: 'projectile', dmg: 18, speed: 540, radius: 13, lifetime: 0.45, count: 5, spread: 0.32, knockback: 40, manaCost: 45, cd: 6, color: '#ff9f43', effect: { kind: 'burn', duration: 2, tick: 0.5, dmg: 5 }, freezeBonus: 1.6, vfx: 'mage_flamebreath' },
    skill2: { name: '寒冰矛', type: 'projectile', dmg: 55, speed: 780, radius: 12, lifetime: 0.7, pierce: true, knockback: 50, manaCost: 45, cd: 8, color: '#74e0ff', effect: { kind: 'chill', stacks: 4, duration: 3, max: 4, freezeDur: 4 }, vfx: 'mage_iceshard' },
    ultimate: { name: '天降流星', type: 'zone', range: 150, radius: 140, dmg: 420, lifetime: 0.4, tick: 0.4, delay: 0.8, effect: { kind: 'burn', duration: 3, tick: 0.5, dmg: 10 }, cd: 11, color: '#ff5a3c', vfx: 'mage_ultimate' },
  };

export class MageCharacter extends BaseCharacter {
  constructor() {
    super(data, {
      modelConfig,
      buildModel,
      buildWeapon,
      paintTexture: drawMageTexture, attachSkinGear,
      loadVfx: () => undefined,
    });
  }
}

export default new MageCharacter();
