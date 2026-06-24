// @ts-nocheck
import { BaseCharacter } from '../../BaseCharacter.ts';
import { characterSprite } from '../../textureSprite.ts';
import { drawStarOrbitTexture } from './texture.ts';
import { modelConfig, buildModel, buildWeapon } from './model.ts';
import { tickStarOrbit } from './orbit.ts';
import './vfx.ts';

const data = {
  id: 'star-orbit', order: 18, evadeType: 'dash', name: '星環使', color: '#5ad7ff', shape: 'circle', sprite: characterSprite('star-orbit', '#5ad7ff', false, drawStarOrbitTexture),
  maxHp: 210, maxMana: 100, speed: 185,
  desc: '遠程星砲爆發者。身邊最多環繞三顆星球，星球會隨時間回復；星軌砲會把目前星球全部打出去，群星歸位則立刻補滿。',
  role: '遠程 · 星砲爆發',
  synergy: '搭配控場隊友能讓星軌砲與終焉砲完整命中；護盾補滿星星後能立即接一波爆發。',
  talent: { id: 'star_orbit', name: '星球環繞', desc: '身邊最多維持 3 顆星球，每 2 秒回復 1 顆。星軌砲會消耗現有星球，每顆提高傷害與光束寬度；群星歸位可立刻補滿。', maxShards: 3, regen: 2.0 },
  basic: { name: '星火連彈', desc: '連射兩枚快速星彈，適合遠距離穩定消耗。', type: 'projectile', dmg: 18, speed: 820, radius: 9, lifetime: 1.05, count: 2, spread: 0.08, knockback: 36, cd: 0.46, color: '#5ad7ff', vfx: 'star_orbit_shot' },
  skill1: { name: '星軌砲', desc: '消耗目前所有環繞星球，發射穿透直線星砲；星球越多，傷害與光束寬度越高。', type: 'star_orbit_cannon', dmg: 46, shardBonus: 24, range: 720, width: 30, shardWidth: 8, knockback: 210, manaCost: 24, cd: 6.5, color: '#5ad7ff', vfx: 'star_orbit_cannon' },
  skill2: { name: '群星歸位', desc: '立刻補滿 3 顆環繞星球並獲得短時間護盾，準備下一發星軌砲。', type: 'star_orbit_guard', refillTo: 3, manaCost: 28, cd: 9, color: '#ffd166', vfx: 'star_orbit_guard', self: { shield: 150, duration: 2.5 } },
  ultimate: { name: '星環終焉砲', desc: '鎖定面向連續轟出三道延遲星砲，最後一砲更粗且造成大量傷害。', type: 'star_orbit_burst', pulses: 3, dmg: 62, finalDmg: 130, range: 780, width: 42, finalWidth: 68, interval: 0.28, knockback: 260, cd: 12, color: '#ffd166', vfx: 'star_orbit_ultimate', self: { shield: 70, duration: 3 } },
};

export class StarOrbitCharacter extends BaseCharacter {
  constructor() {
    super(data, {
      modelConfig,
      buildModel,
      buildWeapon,
      paintTexture: drawStarOrbitTexture,
      loadVfx: () => undefined,
      tick: tickStarOrbit,
    });
  }
}

export default new StarOrbitCharacter();
