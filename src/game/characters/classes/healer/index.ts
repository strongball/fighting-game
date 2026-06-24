// @ts-nocheck
import { BaseCharacter } from '../../BaseCharacter.ts';
import { characterSprite } from '../../textureSprite.ts';
import { drawHealerTexture } from './texture.ts';
import { modelConfig, buildModel, buildWeapon } from './model.ts';
import { attachSkinGear } from './gear.ts';
import './vfx.ts';
import './talent.ts';

const data = {
    id: 'healer', order: 5, evadeType: 'dash', name: '治療師', color: '#ecf0f1', shape: 'circle', sprite: characterSprite('healer', '#ecf0f1', true, drawHealerTexture),
    maxHp: 200, maxMana: 140, speed: 170,
    desc: '團隊續航核心。治癒之觸為全隊回血淨化、聖光環跟身治療並灼傷踏入的敵人，大招生命匯流逆轉團戰。單打靠天賦自療與風箏苟活、輸出極低。',
    role: '支援 · 團隊核心',
    synergy: '萬用支援，搭配任何 carry/突進延長續航；雙治療陣容無輸出、難收尾。',
    talent: { id: 'lifebloom', name: '生生不息', desc: '持續自動回復生命。', regen: 7 },
    basic: { name: '聖光彈', type: 'projectile', dmg: 14, speed: 420, radius: 12, lifetime: 1.2, knockback: 60, cd: 0.6, color: '#f1c40f', vfx: 'healer_holybolt' },
    skill1: { name: '治癒之觸', type: 'buff', manaCost: 45, cd: 7, color: '#2ecc71', vfx: 'healer_cleanse', ally: { radius: 400, heal: 220, cleanse: true, vfx: 'healer_heal_ally', color: '#2ecc71' } },
    skill2: { name: '神聖光環', type: 'zone', range: 0, radius: 150, dmg: 8, lifetime: 6, tick: 0.5, follow: true, allyHeal: 14, effect: { kind: 'burn', duration: 2, tick: 0.5, dmg: 5 }, manaCost: 40, cd: 11, color: '#55efc4', vfx: 'healer_aura', self: { effect: { kind: 'haste', duration: 6, factor: 1.2 } } },
    ultimate: { name: '生命匯流', type: 'zone', range: 0, radius: 280, dmg: 30, lifetime: 1.6, tick: 0.4, knockback: 90, cd: 12, color: '#aaffcc', vfx: 'healer_ultimate', ally: { radius: 280, heal: 250, shield: 250, cleanse: true, effect: { kind: 'haste', duration: 6, factor: 1.3 }, vfx: 'healer_ultimate_ally', color: '#aaffcc' } },
  };

export class HealerCharacter extends BaseCharacter {
  constructor() {
    super(data, {
      modelConfig,
      buildModel,
      buildWeapon,
      paintTexture: drawHealerTexture, attachSkinGear,
      loadVfx: () => undefined,
    });
  }
}

export default new HealerCharacter();
