// @ts-nocheck
import { BaseCharacter } from '../../BaseCharacter.ts';
import { characterSprite } from '../../textureSprite.ts';
import { drawPaladinTexture } from './texture.ts';
import { modelConfig, buildModel, buildWeapon } from './model.ts';
import './vfx.ts';
import './talent.ts';

const data = {
    id: 'paladin', order: 10, evadeType: 'dash', name: '聖騎士', color: '#daa520', shape: 'square', sprite: characterSprite('paladin', '#daa520', false, drawPaladinTexture), meleeRole: true,
    maxHp: 380, maxMana: 80, speed: 138,
    desc: '以信仰反擊的前排坦克。聖光懲戒讓攻擊你的敵人自食惡果、神聖衝鋒暈眩開團並在落點留下灼燒的奉獻聖土、制裁之光降下天使淨化全隊並懲擊敵群，大招天堂審判召喚天使與聖十字降下光柱持續灼燒並庇佑友軍。傷害不高，價值在懲罰與守護。',
    role: '前排 · 反擊/淨化',
    synergy: '頂級反擊前排，懲罰聚火、淨化隊友 debuff；配脆皮 carry 站樁輸出。',
    talent: { id: 'retribution', name: '聖光懲戒', desc: '受到傷害時，以受傷量 15% 回擊攻擊者。', factor: 0.15 },
    basic: { name: '聖槌', type: 'melee', dmg: 20, range: 130, arc: 1.4, knockback: 160, cd: 0.55, color: '#ffe08a', effect: { kind: 'slow', duration: 0.8, factor: 0.7 }, vfx: 'paladin_smite' },
    skill1: { name: '神聖衝鋒', type: 'charge', speed: 920, range: 300, dmg: 55, hitRadius: 52, knockback: 220, stopOnHit: true, effect: { kind: 'stun', duration: 0.8 }, manaCost: 25, cd: 9, color: '#ffd700', vfx: 'paladin_charge', self: { shield: 160, duration: 5 }, leaveZone: { radius: 116, dmg: 12, tick: 0.5, lifetime: 4, color: '#ffcf5a', vfx: 'paladin_consecration' } },
    skill2: { name: '制裁之光', type: 'zone', range: 0, radius: 220, dmg: 45, lifetime: 0.5, tick: 0.5, knockback: 120, manaCost: 35, cd: 10, color: '#fff2b0', vfx: 'paladin_sanction', ally: { radius: 230, shield: 120, cleanse: true } },
    ultimate: { name: '天堂審判', type: 'zone', range: 120, radius: 195, dmg: 60, lifetime: 3.2, tick: 0.5, delay: 0.4, effect: { kind: 'slow', duration: 1.0, factor: 0.6 }, allyHeal: 16, cd: 12, color: '#fff7d0', vfx: 'paladin_ultimate', self: { shield: 280, cleanse: true, duration: 6, effect: { kind: 'reflect', duration: 6, factor: 0.4 } }, ally: { radius: 320, cleanse: true } },
  };

export class PaladinCharacter extends BaseCharacter {
  constructor() {
    super(data, {
      modelConfig,
      buildModel,
      buildWeapon,
      paintTexture: drawPaladinTexture,
      loadVfx: () => undefined,
    });
  }
}

export default new PaladinCharacter();
