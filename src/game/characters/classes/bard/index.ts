// @ts-nocheck
import { BaseCharacter } from '../../BaseCharacter.ts';
import { characterSprite } from '../../textureSprite.ts';
import { drawBardTexture } from './texture.ts';
import { modelConfig, buildModel, buildWeapon } from './model.ts';
import './vfx.ts';

const data = {
    id: 'bard', order: 12, evadeType: 'dash', name: '吟遊詩人', color: '#e91e63', shape: 'circle', sprite: characterSprite('bard', '#e91e63', false, drawBardTexture),
    maxHp: 190, maxMana: 120, speed: 182,
    desc: '以樂曲與治療增幅全隊的進攻型輔助。激昂戰歌賜予友軍增傷與狂熱、療癒和弦貫穿敵軍並治療路徑上的隊友，大招狂想交響樂擊退周圍敵軍並提供大範圍治療與強力增益。',
    role: '支援 · 增傷/加速',
    synergy: '增傷型核心：放大隊友 carry 的輸出；人越多越強，配多 carry 陣容滾雪球。',
    talent: { id: 'warsong', name: '戰歌共鳴', desc: '周圍 250 內每多一名友方，自身與友方額外 +5% 傷害（最多 +15%）。', radius: 250, perAlly: 0.05, maxAllies: 3 },
    basic: { name: '音波衝擊', type: 'projectile', dmg: 18, speed: 600, radius: 12, lifetime: 1.3, knockback: 60, cd: 0.5, color: '#ff6fa5', vfx: 'bard_note' },
    skill1: { name: '激昂戰歌', type: 'buff', manaCost: 30, cd: 9, color: '#ff8fb8', vfx: 'bard_anthem', ally: { radius: 300, effect: { kind: 'rage', duration: 6, speed: 1.35, dmg: 1.45 }, vfx: 'bard_anthem_ally', color: '#ff8fb8' } },
    skill2: { name: '療癒和弦', type: 'projectile', dmg: 40, heal: 50, speed: 760, radius: 22, lifetime: 1.0, pierce: true, knockback: 80, manaCost: 30, cd: 8, color: '#ec407a', effect: { kind: 'stun', duration: 2.5 }, vfx: 'bard_discord' },
    ultimate: { name: '狂想交響樂', type: 'zone', range: 0, radius: 300, dmg: 16, lifetime: 7.0, tick: 0.5, knockback: 280, follow: true, effect: { kind: 'slow', duration: 1.0, factor: 0.5 }, cd: 12, color: '#ff4081', vfx: 'bard_ultimate', allyHeal: 25, allyEffect: { kind: 'rage', duration: 1.5, speed: 1.25, dmg: 1.45 }, ally: { radius: 400, shield: 160, cleanse: true, vfx: 'bard_ultimate_ally', color: '#ff4081' } },
  };

export class BardCharacter extends BaseCharacter {
  constructor() {
    super(data, {
      modelConfig,
      buildModel,
      buildWeapon,
      paintTexture: drawBardTexture,
      loadVfx: () => undefined,
    });
  }
}

export default new BardCharacter();
