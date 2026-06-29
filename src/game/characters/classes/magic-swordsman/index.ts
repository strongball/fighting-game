// @ts-nocheck
import { BaseCharacter } from '../../BaseCharacter.ts';
import { characterSprite } from '../../textureSprite.ts';
import { drawMagicSwordsmanTexture } from './texture.ts';
import { modelConfig, buildModel, buildWeapon } from './model.ts';
import { tickMagicSwordsman } from './talent.ts';
import './vfx.ts';

const data = {
  id: 'magic-swordsman', order: 20, evadeType: 'dash', name: '魔劍士', color: '#00d2ff', shape: 'triangle', sprite: characterSprite('magic-swordsman', '#00d2ff', true, drawMagicSwordsmanTexture),
  meleeRole: true,
  maxHp: 230, maxMana: 100, speed: 192,
  desc: '魔武雙修的單手劍士。普攻累積劍氣與魔力，劍氣層數強化技能效果——消耗越多層、招越致命。魔力與劍氣的雙資源取捨是操作核心。',
  role: '近戰 · 魔武雙修',
  synergy: '劍氣滿層時爆發極高，配控場隊友定住目標後極限解放可打出毀滅性傷害；魔力鎧甲提供生存窗口。',
  talent: { id: 'arcane_contract', name: '魔劍契約', desc: '普攻命中回復 5 魔力、累積 1 層【劍氣】（上限 5）。每層劍氣提供 3% 減傷。劍氣每 8 秒自動補充 1 層。', maxSwordEnergy: 5, drPerStack: 0.03, regenTime: 8.0 },
  basic: { name: '魔刃連斬', desc: '二連快速斬擊，每刀附加當前魔力 8% 的魔法傷害。命中回魔並疊劍氣。', type: 'melee', dmg: 14, arc: 0.8, range: 160, knockback: 80, cd: 0.4, color: '#00d2ff', vfx: 'magic_swordsman_slash' },
  skill1: { name: '劍氣波', desc: '發射一道飛行劍氣，命中造成傷害並緩速。消耗 1 層劍氣強化傷害與穿透。', type: 'projectile', dmg: 50, speed: 700, radius: 14, range: 520, knockback: 120, effect: { kind: 'slow', duration: 1.5, factor: 0.4 }, manaCost: 25, cd: 7, color: '#00d2ff', vfx: 'magic_swordsman_wave' },
  skill2: { name: '魔能護體', desc: '獲得護盾與淨化。消耗 2 層劍氣進入魔刃強化狀態：所有傷害 +100%，持續 5 秒。', type: 'buff', manaCost: 30, cd: 9, color: '#ffd700', vfx: 'magic_swordsman_guard', self: { shield: 180, duration: 3, cleanse: true } },
  ultimate: { name: '極限解放', desc: '消耗全部魔力造成範圍爆炸傷害並依消耗量回血。消耗 3~5 層劍氣，每層額外提升 30% 傷害。', type: 'zone', range: 0, radius: 180, dmg: 120, lifetime: 0.3, tick: 0.3, knockback: 300, effect: { kind: 'stun', duration: 0.6 }, manaCost: 0, cd: 13, color: '#00d2ff', vfx: 'magic_swordsman_ultimate' },
};

export class MagicSwordsmanCharacter extends BaseCharacter {
  constructor() {
    super(data, {
      modelConfig,
      buildModel,
      buildWeapon,
      paintTexture: drawMagicSwordsmanTexture,
      loadVfx: () => undefined,
      tick: tickMagicSwordsman,
    });
  }
}

export default new MagicSwordsmanCharacter();
