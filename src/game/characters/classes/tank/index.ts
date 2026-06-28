// @ts-nocheck
import { BaseCharacter } from '../../BaseCharacter.ts';
import { characterSprite } from '../../textureSprite.ts';
import { drawTankTexture } from './texture.ts';
import { modelConfig, buildModel, buildWeapon } from './model.ts';
import './vfx.ts';
import './talent.ts';

// 坦克 — 鋼鐵壁壘（怒氣壁壘）
// 定位不變：前排・保護/擾亂。重做核心＝「越被打越強」的主動坦資源迴圈：
//   承受/造成傷害累積【怒氣】→ 怒氣越高受傷越少、反擊越痛、戰意沸騰時加速貼身；
//   巨力踏陣補上切入手段（躍擊聚怪定身），大招釋放怒氣化身不動壁壘並為全隊罩上護罩。
// 怒氣引擎與數值平衡見同資料夾 talent.ts（天賦 bulwark hooks）。
const data = {
    id: 'tank', order: 3, evadeType: 'dash', name: '坦克', color: '#7f8c8d', shape: 'square', sprite: characterSprite('tank', '#7f8c8d', true, drawTankTexture), meleeRole: true,
    maxHp: 480, maxMana: 70, speed: 128,
    desc: '越被打越強的前排堡壘。承傷累積【怒氣】：怒氣越高、受傷越少、反擊越痛，戰意沸騰時加速貼身。巨力踏陣躍入敵陣聚怪定身、守護壁壘分享護盾淨化，大招釋放怒氣震開敵陣、化身不動壁壘為全隊罩上護罩。價值在開團、保護與滾雪球的承傷威脅。',
    role: '前排 · 保護/擾亂',
    synergy: '頂級開團前排：躍擊切入、分享護盾與減傷護罩；承傷越多越猛，保護後排 carry 站樁輸出。',
    talent: {
      id: 'bulwark', name: '鋼鐵壁壘',
      desc: '永久減免 12% 傷害。承受/造成傷害累積【怒氣】(脫戰衰減)：怒氣越高減傷最高 25%、反擊傷害最高 +35%；怒氣 ≥55 戰意沸騰，移動與攻速 +16% 貼身擾亂。守護壁壘額外蓄怒；大招釋放全部怒氣化身不動壁壘 (依怒氣量獲得護體與反射)。',
      dr: 0.12, drMax: 0.25, dmgMax: 0.35,
      gainTake: 0.55, gainDeal: 0.16, idleGrace: 3, decay: 14,
      threshold: 55, hasteFactor: 1.16,
      brace: 20, ultProtect: 0.20, ultProtectPerFury: 0.0022, ultReflect: 0.20, ultReflectPerFury: 0.0025, ultBuffDur: 6,
    },
    basic: { name: '盾擊', type: 'melee', dmg: 20, range: 122, arc: 1.5, knockback: 150, cd: 0.55, color: '#aab7b8', effect: { kind: 'slow', duration: 0.8, factor: 0.75 }, vfx: 'tank_punch' },
    skill1: { name: '守護壁壘', type: 'buff', shield: 200, cleanse: true, duration: 6, effect: { kind: 'reflect', duration: 6, factor: 0.25 }, manaCost: 25, cd: 14, color: '#dfe6e9', vfx: 'tank_shield', ally: { radius: 300, shield: 120, cleanse: true } },
    skill2: { name: '巨力踏陣', type: 'leap', range: 300, dur: 0.42, radius: 190, dmg: 38, knockback: 0, effect: { kind: 'root', duration: 0.9 }, manaCost: 30, cd: 12, color: '#a0744a', vfx: 'tank_quake',
      leaveZone: { radius: 200, dmg: 6, lifetime: 1.1, tick: 0.4, pull: 280, effect: { kind: 'slow', duration: 0.5, factor: 0.7 }, color: '#a0744a', vfx: 'tank_quake' } },
    ultimate: { name: '大地崩裂', type: 'zone', range: 60, radius: 165, dmg: 90, lifetime: 1.4, tick: 0.2, moving: 470, knockback: 440, effect: { kind: 'stun', duration: 0.6 }, cd: 14, color: '#cfd8dc', vfx: 'tank_ultimate',
      self: { shield: 200, duration: 6 },
      ally: { radius: 340, shield: 140, cleanse: true, effect: { kind: 'protect', duration: 6, factor: 0.25 } } },
  };

export class TankCharacter extends BaseCharacter {
  constructor() {
    super(data, {
      modelConfig,
      buildModel,
      buildWeapon,
      paintTexture: drawTankTexture,
      loadVfx: () => undefined,
    });
  }
}

export default new TankCharacter();
