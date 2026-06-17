// @ts-nocheck
import { BaseCharacter } from '../../BaseCharacter.ts';
import { characterSprite } from '../../textureSprite.ts';
import { drawFighterTexture } from './texture.ts';
import { modelConfig, buildModel, buildWeapon } from './model.ts';
import { attachSkinGear } from './gear.ts';
import './vfx.ts';

const data = {
    id: 9, name: '格鬥家', color: '#f1c40f', shape: 'circle', sprite: characterSprite('fighter', '#f1c40f', true, drawFighterTexture), meleeRole: true,
    maxHp: 260, maxMana: 70, speed: 196,
    desc: '自給自足的連段決鬥者。連環拳累積氣勢、上勾拳擊飛收尾、招架反擊彈回傷害，大招真·昇龍霸一記定身重擊。最不依賴隊友的萬用 flex。',
    role: '近戰 · 連段決鬥',
    synergy: '自給自足的 flex，最不依賴隊友；隊伍缺前排/補位時的萬用選擇。',
    talent: { id: 'momentum', name: '連擊氣勢', desc: '短時間內連續命中，每層 +10% 傷害（最多 5 層）。', maxStacks: 5, perStack: 0.1, window: 2.2 },
    basic: { name: '連環拳', type: 'melee', dmg: 16, range: 95, arc: 1.55, knockback: 100, cd: 0.3, color: '#f7dc6f', vfx: 'fighter_combo' },
    skill1: { name: '上勾拳', type: 'melee', dmg: 80, range: 110, arc: 1.35, knockback: 520, manaCost: 25, cd: 6, color: '#f9e79f', vfx: 'fighter_uppercut' },
    skill2: { name: '招架反擊', type: 'buff', shield: 200, cleanse: true, effect: { kind: 'reflect', duration: 3, factor: 0.8 }, duration: 3, manaCost: 30, cd: 9, color: '#f4d03f', vfx: 'fighter_counter' },
    ultimate: { name: '真·昇龍霸', type: 'dash', impulse: 900, dmg: 200, range: 160, arc: 1.85, knockback: 700, effect: { kind: 'stun', duration: 1.0 }, cd: 11, color: '#ffe27a', vfx: 'fighter_ultimate', self: { shield: 100, duration: 4 } },
  };

export class FighterCharacter extends BaseCharacter {
  constructor() {
    super(data, {
      modelConfig,
      buildModel,
      buildWeapon,
      paintTexture: drawFighterTexture, attachSkinGear,
      loadVfx: () => undefined,
    });
  }
}

export default new FighterCharacter();
