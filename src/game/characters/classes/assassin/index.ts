// @ts-nocheck
import { BaseCharacter } from '../../BaseCharacter.ts';
import { characterSprite } from '../../textureSprite.ts';
import { drawAssassinTexture } from './texture.ts';
import { modelConfig, buildModel, buildWeapon } from './model.ts';
import './vfx.ts';
import './talent.ts';

const data = {
    id: 'assassin', order: 2, evadeType: 'blink', name: '刺客', color: '#9b59b6', shape: 'triangle', sprite: characterSprite('assassin', '#9b59b6', true, drawAssassinTexture), meleeRole: true,
    maxHp: 190, maxMana: 70, speed: 240,
    desc: '單體爆發突進手。影襲標記目標、印記引爆灌出致命一擊，得手後隱身重置。需隊友控場開路，專點脆皮核心；被抓住就脆。',
    role: '突進 · 單體爆發',
    synergy: '靠隊友控制(戰士暈/坦克定身)開路，瞬間刪除脆皮核心(法師/弓箭手/治療)。',
    talent: { id: 'lethal', name: '致命一擊', desc: '從隱身狀態或敵人背後攻擊，造成 +50% 傷害。', bonus: 0.5, arc: 1.2 },
    basic: { name: '快刀', type: 'melee', dmg: 20, range: 95, arc: 1.45, knockback: 80, cd: 0.34, color: '#c39bd3', vfx: 'assassin_slash' },
    skill1: { name: '影襲', type: 'blink', range: 260, dmg: 50, hitRadius: 95, knockback: 120, effect: { kind: 'mark', factor: 0.25, duration: 4 }, manaCost: 25, cd: 7, color: '#c39bd3', vfx: 'assassin_blink', self: { effect: { kind: 'invis', duration: 1.2, speed: 1.3 } } },
    skill2: { name: '印記引爆', type: 'melee', dmg: 70, range: 120, arc: 2.2, knockback: 160, detonate: { mult: 2.0 }, manaCost: 35, cd: 9, color: '#e056fd', vfx: 'assassin_backstab', self: { effects: [{ kind: 'lifesteal', duration: 4, factor: 0.4 }] } },
    ultimate: { name: '虛空換影', type: 'multiblink', count: 4, dmg: 80, knockback: 150, cd: 11, color: '#e056fd', vfx: 'assassin_ultimate', self: { heal: 70, effects: [{ kind: 'invis', duration: 2.5, speed: 1.4 }, { kind: 'lifesteal', duration: 6, factor: 0.5 }] } },
  };

export class AssassinCharacter extends BaseCharacter {
  constructor() {
    super(data, {
      modelConfig,
      buildModel,
      buildWeapon,
      paintTexture: drawAssassinTexture,
      loadVfx: () => undefined,
    });
  }
}

export default new AssassinCharacter();
