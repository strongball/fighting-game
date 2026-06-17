import { BaseBoss } from '../BaseBoss.ts';
import { BURN, STUN, SLOW, ROOT, CHILL } from '../effects.js';
import { aiProfile } from './ai.ts';
import { modelConfig } from './model.ts';
import './action.ts';

const data = {
    id: 105, round: 6, name: '死靈樂章', subtitle: '幽冥引路人',
    color: '#7d5fff', shape: 'circle', maxHp: 6500, maxMana: 999, speed: 130,
    baseHp: 6500,
    appearance: {
      size: '等身偏大 (約玩家 2 倍)，漂浮',
      style: '漂浮的幽靈指揮 / 巫妖，破舊暗袍隨幽風飄動，雙眼與雙手燃綠靈火，手持斷裂指揮棒兼死神鐮。身周籠罩半透明護盾泡。配色：幽紫 #7d5fff + 靈綠 #39ff88 + 屍袍灰。',
      weapon: '靈魂指揮棒 / 鐮刃',
      telegraph: '召喚前高舉指揮棒、地面綻開綠色法陣；護盾隨存活小怪數脈動發亮。',
    },
    ai: 'necromancer',
    mechanic: { minionShield: { perMinion: 0.18, max: 0.72 } }, // 每隻存活小怪給魔王減傷，清空才露破綻
    hint: '牠會召喚小怪 —— 每隻活著的小怪都讓牠減傷，先清掉小怪再打本體！',
    tags: [
      { icon: '💀', text: '會召喚小怪' },
      { icon: '🛡️', text: '每隻小怪給魔王減傷（最多 72%）' },
      { icon: '🎯', text: '清光小怪才打得動本體' },
    ],
    hazardText: '☠️ 站在亡靈領域裡！快離開',
    hazardColor: '#46f0a0',

    phases: [
      { hpPct: 0.5, name: '亡者大進行曲', sub: '亡魂奔流', color: '#7d5fff', dmgMult: 1.3, cdMult: 0.65,
        tagsOverride: [
          { icon: '💀', text: '召喚速度加快' },
          { icon: '🛡️', text: '護盾再生更頻繁' },
          { icon: '🎵', text: '攻擊強化 +30%' },
        ] },
    ],

    basic: { name: '靈魂彈', type: 'projectile', dmg: 26, speed: 480, radius: 12, lifetime: 1.6, count: 2, spread: 0.18, knockback: 40, cd: 1.0, windup: 0.4, telegraph: 'line', color: '#39ff88', vfx: 'boss_necro_bolt' },
    skill1: { name: '亡者召集', type: 'summon_minions', count: 3, minionHp: 240, minionCharId: -2, minionName: '亡者殘影', cd: 12, windup: 0.8, telegraph: 'self', color: '#7d5fff', vfx: 'boss_necro_summon' },
    skill2: { name: '亡靈護壁', type: 'buff', shield: 400, duration: 12, cd: 14, windup: 0.6, telegraph: 'self', color: '#b39dff', shieldPerMinion: 200, vfx: 'boss_necro_shield' },
    ultimate: { name: '安魂彌撒', type: 'zone', range: 0, radius: 240, dmg: 28, lifetime: 4, tick: 0.5, follow: true, healPerMinion: 30, effect: SLOW(0.6, 0.6), cd: 18, windup: 1.0, telegraph: 'circle', color: '#9d7dff', vfx: 'boss_necro_ult' },
  };

export default new BaseBoss(data, { aiProfile, modelConfig });
