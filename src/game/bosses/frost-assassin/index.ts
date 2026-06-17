import { BaseBoss } from '../BaseBoss.ts';
import { BURN, STUN, SLOW, ROOT, CHILL } from '../effects.js';
import { aiProfile } from './ai.ts';
import { modelConfig } from './model.ts';
import './action.ts';

const data = {
    id: 103, round: 4, name: '霜雪刺客', subtitle: '冰原幻影',
    color: '#74e0ff', shape: 'triangle', maxHp: 5000, maxMana: 999, speed: 220,
    baseHp: 5000,
    appearance: {
      size: '等身 (約玩家 1.5 倍)，纖細靈巧',
      style: '半透明的淡藍冰晶刺客，身後拖曳霜霧殘影，雙手冰結匕首。配色：冰藍 #74e0ff + 霜白 #e0f8ff + 內透幽光。',
      weapon: '雙冰匕',
      telegraph: '真身出手前匕首更亮、霜煙較濃；分身更透明且閃爍。瞬移前原地爆出霜煙。',
    },
    ai: 'frost_assassin',
    mechanic: { clones: 3, swapTell: true }, // 召喚 3 個假身；真身可與分身換位 (有細微 tell)
    hint: '牠會放分身騙你 —— 真身較「實」、分身半透明會閃，認準真身再打！',
    tags: [
      { icon: '👥', text: '會放 3 個假分身' },
      { icon: '🗡️', text: '真身較實·分身半透明' },
      { icon: '❄️', text: '攻擊會冰凍堆疊' },
    ],
    hazardText: '❄️ 站在冰域裡會被凍！快離開',
    hazardColor: '#74e0ff',

    phases: [
      { hpPct: 0.5, name: '冰鏡幻奏', sub: '繁衍分身', color: '#74e0ff', dmgMult: 1.2, speedMult: 1.15, cdMult: 0.6,
        tagsOverride: [
          { icon: '👥', text: '分身產出加快' },
          { icon: '⚡', text: '突襲冷卻減半' },
          { icon: '❄️', text: '冰凍堆疊更快' },
        ] },
    ],

    basic: { name: '寒霜疾刺', type: 'melee', dmg: 34, range: 70, arc: 0.9, knockback: 90, cd: 0.7, windup: 0.25, telegraph: 'arc', color: '#9fe8ff', effect: CHILL(1), vfx: 'boss_frost_slash' },
    skill1: { name: '霜影突襲', type: 'blink', range: 280, dmg: 55, hitRadius: 95, knockback: 120, effect: CHILL(2), cd: 5, windup: 0.4, telegraph: 'self', color: '#74e0ff', vfx: 'boss_frost_blink' },
    skill2: { name: '鏡花幻影', type: 'summon_clones', count: 3, cd: 13, windup: 0.6, telegraph: 'self', color: '#bfefff', vfx: 'boss_frost_clones' },
    ultimate: { name: '絕對冰域', type: 'zone', range: 0, radius: 220, dmg: 30, lifetime: 2.0, tick: 0.5, follow: true, effect: CHILL(2), cd: 17, windup: 1.0, telegraph: 'circle', color: '#cdf6ff', vfx: 'boss_frost_ult' },
  };

export default new BaseBoss(data, { aiProfile, modelConfig });
