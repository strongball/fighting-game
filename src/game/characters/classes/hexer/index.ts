// @ts-nocheck
import { BaseCharacter } from '../../BaseCharacter.ts';
import { characterSprite } from '../../textureSprite.ts';
import { drawHexerTexture } from './texture.ts';
import { modelConfig, buildModel, buildWeapon } from './model.ts';
import './vfx.ts';

const data = {
    id: 'hexer', order: 11, evadeType: 'blink', name: '咒術師', color: '#8e44ad', shape: 'triangle', sprite: characterSprite('hexer', '#8e44ad', false, drawHexerTexture),
    maxHp: 210, maxMana: 130, speed: 165,
    desc: '以詛咒削弱敵軍的控制型輔助。詛咒彈使目標易傷、噩夢束縛定身緩速、衰弱領域同時減速敵人並削弱其輸出，大招萬咒齊發鎖死整片戰場。傷害普通，價值在削弱與控場。',
    role: '支援 · 控制/削弱',
    synergy: '控制型核心：定身、易傷、削弱敵人輸出，替隊友 carry 創造輸出與生存空間。',
    talent: { id: 'plague', name: '詛咒擴散', desc: '帶有易傷詛咒的敵人死亡時，詛咒傳染給周圍 200 範圍內的其他敵人。', radius: 200 },
    basic: { name: '詛咒彈', type: 'projectile', dmg: 14, speed: 520, radius: 12, lifetime: 1.4, knockback: 30, cd: 0.55, color: '#b86fd6', effect: { kind: 'weaken', duration: 3, factor: 0.15 }, vfx: 'hexer_bolt' },
    skill1: { name: '噩夢束縛', type: 'projectile', dmg: 24, speed: 560, radius: 12, lifetime: 0.9, knockback: 30, manaCost: 25, cd: 8, color: '#6c3483', effect: { kind: 'root', duration: 1.5 }, vfx: 'hexer_bind' },
    skill2: { name: '衰弱領域', type: 'zone', range: 0, radius: 175, dmg: 10, lifetime: 5, tick: 0.5, follow: true, effects: [{ kind: 'slow', duration: 0.7, factor: 0.6 }, { kind: 'dmg_reduce', duration: 0.7, factor: 0.25 }], allyEffect: { kind: 'haste', duration: 0.7, factor: 1.25 }, manaCost: 40, cd: 11, color: '#9b59b6', vfx: 'hexer_field' },
    ultimate: { name: '萬咒齊發', type: 'zone', range: 0, radius: 240, dmg: 40, lifetime: 0.4, tick: 0.4, effects: [{ kind: 'root', duration: 1.6 }, { kind: 'weaken', duration: 3, factor: 0.3 }, { kind: 'slow', duration: 3, factor: 0.5 }], cd: 12, color: '#bb6bd9', vfx: 'hexer_ultimate', ally: { radius: 320, shield: 150, cleanse: true } },
  };

export class HexerCharacter extends BaseCharacter {
  constructor() {
    super(data, {
      modelConfig,
      buildModel,
      buildWeapon,
      paintTexture: drawHexerTexture,
      loadVfx: () => undefined,
    });
  }
}

export default new HexerCharacter();
