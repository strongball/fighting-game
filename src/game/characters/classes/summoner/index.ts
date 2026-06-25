// @ts-nocheck
import { BaseCharacter } from '../../BaseCharacter.ts';
import { characterSprite } from '../../textureSprite.ts';
import { drawSummonerTexture } from './texture.ts';
import { modelConfig, buildModel, buildWeapon } from './model.ts';
import './vfx.ts';
import './talent.ts';

const data = {
    id: 'summoner', order: 15, evadeType: 'blink', name: '召喚師', color: '#16a085', shape: 'circle', sprite: characterSprite('summoner', '#16a085', false, drawSummonerTexture),
    maxHp: 210, maxMana: 130, speed: 155,
    desc: '操控召喚物建立數量優勢的特殊角色。召喚共鏈讓戰靈護主回血，並隨在場召喚物提升自身傷害；召喚戰靈一次喚出兩隻耐打打手持續施壓、靈魂爆破炸開敵群並立刻重置召喚冷卻（炸完馬上補兵），大招大召喚術喚出一群遠程精魂。召喚物越多，你越強。',
    role: '特殊 · 召喚操控',
    synergy: '以召喚物製造混亂與數量壓制；戰靈吸引火力、護主回血又增傷，配輔助延命滾雪球。',
    talent: { id: 'summonbond', name: '召喚共鏈', desc: '每隻存活召喚物給自身 −7% 受傷且 +6% 傷害（各最多 3 層 = −21% / +18%）；召喚物命中敵人回復自身 3 HP。', dr: 0.07, maxStacks: 3, heal: 3, dmgPerStack: 0.06 },
    basic: { name: '靈魂碎片', type: 'projectile', dmg: 18, speed: 420, radius: 11, lifetime: 1, knockback: 10, homing: 2.5, cd: 0.55, color: '#48d8b8', vfx: 'summoner_shard' },
    skill1: { name: '召喚戰靈', type: 'summon', count: 2, cap: 4, minionCharId: -3, minionName: '靈魂戰靈', minionHp: 90, minionScale: 0.82, minionLife: 11, manaCost: 25, cd: 7, color: '#1abc9c', vfx: 'summoner_summon' },
    skill2: { name: '靈魂爆破', type: 'summon', detonate: true, refundCd: 'skill1', radius: 130, dmg: 78, effect: { kind: 'stun', duration: 0.6 }, manaCost: 30, cd: 8, color: '#16a085', vfx: 'summoner_burst' },
    ultimate: { name: '大召喚術', type: 'summon', count: 4, cap: 6, minionCharId: -4, minionName: '元素精魂', minionHp: 70, minionScale: 0.8, minionLife: 13, cd: 12, color: '#2ee6c0', vfx: 'summoner_ultimate', self: { shield: 220, duration: 6, effect: { kind: 'haste', duration: 6, factor: 1.35 } } },
  };

export class SummonerCharacter extends BaseCharacter {
  constructor() {
    super(data, {
      modelConfig,
      buildModel,
      buildWeapon,
      paintTexture: drawSummonerTexture,
      loadVfx: () => undefined,
    });
  }
}

export default new SummonerCharacter();
