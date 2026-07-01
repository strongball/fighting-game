// @ts-nocheck
import { BaseCharacter } from '../../BaseCharacter.ts';
import { characterSprite } from '../../textureSprite.ts';
import { drawGlassAstrologerTexture } from './texture.ts';
import { modelConfig, buildModel, buildWeapon } from './model.ts';
import { tickGlassBeam } from './beam.ts';
import './vfx.ts';

const data = {
  id: 'glass-astrologer', order: 21, evadeType: 'dash', name: '玻璃占星師', color: '#9ee8ff', shape: 'diamond', sprite: characterSprite('glass-astrologer', '#9ee8ff', false, drawGlassAstrologerTexture),
  maxHp: 205, maxMana: 110, speed: 182,
  desc: '高反射彈幕輸出者。三連星片穿鏡後會繼續穿透並生成反射球；折星光束能持續壓線，萬華天球會鋪出前後回彈鏡陣。',
  role: '中距離 · 鏡面幾何',
  synergy: '適合和聚怪、定身或拉扯隊友搭配；開大後用普攻把星片送進鏡陣，可以快速形成多段穿透彈幕。',
  talent: { id: 'refraction_astrolabe', name: '入射角', desc: '普攻射出三連星片；星片穿過星鏡時原球會繼續穿透，鏡面同時射出一顆較大的反射球。', max: 3, maxMirrors: 3 },
  basic: { name: '星片', type: 'glass_shard', count: 3, spread: 0.3, dmg: 7, speed: 800, radius: 7, lifetime: 1.35, knockback: 16, cd: 0.44, color: '#9ee8ff', vfx: 'glass_astrologer_shard', maxReflects: 3, reflectBonus: 0.55, pierceOnReflect: true, splitOnMirror: true, splitDmgMult: 1.35, passRadiusMult: 0.9, reflectRadiusMult: 1.25, childMaxReflects: 2 },
  skill1: { name: '立鏡', type: 'glass_mirror', range: 180, length: 210, thickness: 18, charges: 6, maxMirrors: 3, lifetime: 9, angleOffset: Math.PI / 3, manaCost: 8, cd: 2.4, color: '#d8f7ff', vfx: 'glass_astrologer_mirror' },
  skill2: { name: '折星光束', type: 'glass_beam', duration: 0.75, tick: 0.25, directionCount: 8, pulseDmg: 5, range: 760, width: 30, widthPerReflect: 8, maxReflects: 2, reflectBonus: 0.35, markBonusPerStack: 4, manaCost: 24, cd: 8.5, color: '#9ee8ff', vfx: 'glass_astrologer_ray' },
  ultimate: { name: '萬華天球', type: 'glass_kaleidoscope', mirrorCount: 14, mirrorLife: 7, mirrorCharges: 8, catchSpread: 0.3, empoweredReflects: 6, empoweredDmgMult: 1.1, range: 820, cd: 12, color: '#ffe6a7', vfx: 'glass_astrologer_ultimate', self: { shield: 80, duration: 3 } },
};

export class GlassAstrologerCharacter extends BaseCharacter {
  constructor() {
    super(data, {
      modelConfig,
      buildModel,
      buildWeapon,
      paintTexture: drawGlassAstrologerTexture,
      loadVfx: () => undefined,
      tick: tickGlassBeam,
    });
  }
}

export default new GlassAstrologerCharacter();
