// @ts-nocheck
import { BaseCharacter } from '../../BaseCharacter.ts';
import { characterSprite } from '../../textureSprite.ts';
import { drawArcherTexture } from './texture.ts';
import { modelConfig, buildModel, buildWeapon } from './model.ts';
import { attachSkinGear } from './gear.ts';
import './vfx.ts';
import './talent.ts';

const data = {
    id: 'archer', order: 4, evadeType: 'dash', name: '弓箭手', color: '#27ae60', shape: 'circle', sprite: characterSprite('archer', '#27ae60', true, drawArcherTexture),
    maxHp: 220, maxMana: 80, speed: 188,
    desc: '持續輸出的遠程 carry，全為直線箭術、不再自動追蹤。越遠越痛、貫穿箭洞穿一線、寄生箭流血剋逃，大招緊密箭幕朝正面傾瀉。需前排掩護走位。',
    role: '後排 · 持續輸出',
    synergy: '需前排(坦克/戰士)掩護拉開距離；越遠越痛，靠隊友 peel 發揮最大火力。',
    talent: { id: 'deadeye', name: '致命瞄準', desc: '對越遠的敵人傷害越高（最遠 +50%）。', bonus: 0.5, range: 520 },
    basic: { name: '射箭', type: 'projectile', dmg: 22, speed: 620, radius: 14, lifetime: 1.4, knockback: 70, cd: 0.5, color: '#2ecc71', vfx: 'archer_arrow' },
    skill1: { name: '貫穿箭', type: 'projectile', dmg: 60, speed: 920, radius: 14, lifetime: 0.9, pierce: true, knockback: 90, manaCost: 25, cd: 6, chargeMax: 1.5, color: '#7bed9f', vfx: 'archer_arrow_charged' },
    skill2: { name: '寄生箭', type: 'projectile', dmg: 26, speed: 560, radius: 8, lifetime: 2.0, knockback: 40, manaCost: 30, cd: 9, color: '#1abc9c', effect: { kind: 'bleed', duration: 4, tick: 0.5, dmg: 8, moveMult: 1.5 }, vfx: 'archer_parasite' },
    ultimate: { name: '萬箭齊發', type: 'projectile', dmg: 22, speed: 700, radius: 14, lifetime: 1.0, count: 8, spread: 0.12, knockback: 40, cd: 9, color: '#7bed9f', vfx: 'archer_ultimate' },
  };

export class ArcherCharacter extends BaseCharacter {
  constructor() {
    super(data, {
      modelConfig,
      buildModel,
      buildWeapon,
      paintTexture: drawArcherTexture, attachSkinGear,
      loadVfx: () => undefined,
    });
  }
}

export default new ArcherCharacter();
