// @ts-nocheck
import { BaseCharacter } from '../../BaseCharacter.ts';
import { characterSprite } from '../../textureSprite.ts';
import { drawFalconerTexture } from './texture.ts';
import { modelConfig, buildModel, buildWeapon } from './model.ts';
import { attachSkinGear } from './gear.ts';
import { tickFalcon } from './falcon.ts';
import './vfx.ts';
import './talent.ts';

const data = {
    id: 'falconer', order: 19, evadeType: 'dash', name: '鳥獵', color: '#e0a82e', shape: 'circle',
    sprite: characterSprite('falconer', '#e0a82e', true, drawFalconerTexture),
    maxHp: 185, maxMana: 90, speed: 200,
    desc: '攻速爆擊型獵手，類 RO 弓獵。本體箭傷不高，靠極快攻速與鷹瞳爆擊（每第三發必爆 +70%）穩定輸出；肩上鷹隼會自動發動「獵鷹突擊」——多段連擊必爆＋範圍濺射，補回一份輸出。風之步為全隊套上移速＋攻速加速、利於拉扯與集火；鷹眼凝視短時間箭無虛發、全程必爆＋自身加速；大招鷹擊風暴喚鷹連續來回俯衝、瘋狂連擊敵群。身板極脆，靠走位與爆發節奏取勝。',
    role: '後排 · 攻速爆發/輔助',
    synergy: '靠隊友開團與 peel 拉開安全距離；風之步幫全隊加速追擊或脫離、鷹眼凝視窗口集中秒掉脆皮；鷹隼自動連擊讓你走位時也持續吃傷。',
    talent: { id: 'talonsight', name: '鷹瞳', desc: '連續命中累積，每第三次命中必定爆擊，造成 +70% 傷害。攻速越快、爆擊越密。', bonus: 0.7, every: 3 },
    basic: { name: '連珠快矢', type: 'projectile', dmg: 6, speed: 660, radius: 12, lifetime: 1.3, knockback: 28, cd: 0.32, color: '#f5c542', vfx: 'falconer_arrow' },
    skill1: { name: '風之步', type: 'buff', duration: 5, manaCost: 35, cd: 14, color: '#aef5d0', vfx: 'falconer_windstep', ally: { radius: 340, effect: { kind: 'overdrive', duration: 5, speed: 1.22, atkSpeed: 1.25 } } },
    skill2: { name: '鷹眼凝視', type: 'buff', duration: 3, manaCost: 35, cd: 12, color: '#ffe9a8', vfx: 'falconer_eagleeye', effect: { kind: 'overdrive', duration: 3, speed: 1.1, atkSpeed: 1.4 } },
    ultimate: { name: '鷹擊風暴', type: 'buff', duration: 3.4, cd: 12, color: '#ffd76a', vfx: 'falconer_ultimate', effect: { kind: 'overdrive', duration: 3.4, speed: 1.12, atkSpeed: 1.15 } },
  };

export class FalconerCharacter extends BaseCharacter {
  constructor() {
    super(data, {
      modelConfig,
      buildModel,
      buildWeapon,
      paintTexture: drawFalconerTexture, attachSkinGear,
      loadVfx: () => undefined,
      tick: tickFalcon,
    });
  }
}

export default new FalconerCharacter();
