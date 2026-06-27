// @ts-nocheck
import { BaseCharacter } from '../../BaseCharacter.ts';
import { characterSprite } from '../../textureSprite.ts';
import { drawFighterTexture } from './texture.ts';
import { modelConfig, buildModel, buildWeapon } from './model.ts';
import { attachSkinGear } from './gear.ts';
import './vfx.ts';
import './talent.ts';

const data = {
    id: 'fighter', order: 9, evadeType: 'dash', name: '格鬥家', color: '#f1c40f', shape: 'circle', sprite: characterSprite('fighter', '#f1c40f', true, drawFighterTexture), meleeRole: true,
    maxHp: 260, maxMana: 80, speed: 196,
    desc: '聚氣爆發的武僧。聚氣每按一次凝聚一顆氣球（最多 5），每顆同時強化拳勁與護體；不動明王短暫金身免傷立於不敗；氣滿時拳速與身法俱增；大招真·昇龍霸傾盡全身氣勁化龍撲擊、氣球越多威勢越猛。自給自足、愈打愈強。',
    role: '近戰 · 蓄氣爆發',
    synergy: '自給自足的 flex，最不依賴隊友；控場隊友能拉長他的蓄氣爆發窗。',
    talent: { id: 'qiflow', name: '氣勢·循環', desc: '普攻命中聚氣（每隔一小段時間 +1 氣球）；每顆氣球 +8% 傷害、−5% 受傷；蓄滿 5 氣時氣球轉赤、拳速與移速顯著提升。久未出手氣球會逐漸消散。', maxChi: 5, atkPerChi: 0.08, defPerChi: 0.05, chiThrottle: 1.5, fullHasteFactor: 1.2, fullCdRate: 1.3, idleDecay: 4, decayInterval: 2 },
    basic: { name: '連環拳', type: 'melee', dmg: 18, range: 95, arc: 1.55, knockback: 90, cd: 0.3, color: '#f7dc6f', vfx: 'fighter_combo' },
    skill1: { name: '聚氣', type: 'gatherqi', maxChi: 5, gain: 1, manaCost: 10, cd: 2.7, color: '#ffe9a8', vfx: 'fighter_qi' },
    skill2: { name: '不動明王', type: 'buff', shield: 160, cleanse: true, effect: { kind: 'evading', duration: 2 }, duration: 2, manaCost: 30, cd: 13, color: '#ffd76a', vfx: 'fighter_steelbody' },
    ultimate: { name: '真·昇龍霸', type: 'risingdragon', dmg: 150, dmgPerChi: 55, maxChi: 5, range: 320, dur: 0.45, radius: 155, knockback: 660, effect: { kind: 'stun', duration: 1.0 }, cd: 11, color: '#ffe27a', vfx: 'fighter_ultimate', self: { shield: 90, duration: 3 } },
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
