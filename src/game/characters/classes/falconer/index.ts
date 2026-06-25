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
    desc: '攻速爆擊型獵手，類 RO 弓獵。本體箭傷不高，靠極快攻速與鷹瞳爆擊（每第三發必爆 +70%）穩定輸出；肩上鷹隼自動「獵鷹突擊」多段連擊＋濺射補回輸出，索敵範圍大、走位時也持續吃傷。鷹擊·震退讓鷹飛出把貼臉的敵人強力擊退保命；鷹眼凝視必爆＋放大鷹的觸發範圍；大招鷹擊風暴喚鷹連續俯衝、範圍更大且每趟把敵群推開。身板極脆，靠走位與擊退節奏苟活。',
    role: '後排 · 攻速爆發/風箏',
    synergy: '靠走位與鷹擊·震退自保、拉開安全距離；鷹眼凝視窗口集中秒脆皮，大招範圍俯衝清場兼推開威脅。鷹隼自動連擊讓你風箏時也持續吃傷。',
    talent: { id: 'talonsight', name: '鷹瞳', desc: '連續命中累積，每第三次命中必定爆擊，造成 +70% 傷害。攻速越快、爆擊越密。', bonus: 0.7, every: 3 },
    basic: { name: '連珠快矢', type: 'projectile', dmg: 6, speed: 660, radius: 12, lifetime: 1.3, knockback: 28, cd: 0.32, color: '#f5c542', vfx: 'falconer_arrow' },
    skill1: { name: '鷹擊·震退', type: 'buff', radius: 240, dmg: 36, knockback: 220, manaCost: 30, cd: 9, color: '#ffd76a', effect: { kind: 'haste', duration: 1.6, factor: 1.22 } },
    skill2: { name: '鷹眼凝視', type: 'buff', duration: 3, falconRange: 1.6, manaCost: 35, cd: 12, color: '#ffe9a8', vfx: 'falconer_eagleeye', effect: { kind: 'overdrive', duration: 3, speed: 1.1, atkSpeed: 1.4 } },
    ultimate: { name: '鷹擊風暴', type: 'buff', duration: 4.0, falconRange: 1.4, cd: 12, color: '#ffd76a', vfx: 'falconer_ultimate', effect: { kind: 'overdrive', duration: 4.0, speed: 1.12, atkSpeed: 1.15 } },
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
