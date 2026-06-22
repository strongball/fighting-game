import { BaseBoss } from '../BaseBoss.ts';
import { SLOW, ROOT } from '../effects.js';
import { aiProfile } from './ai.ts';
import { modelConfig, buildModel, buildWeapon } from './model.ts';
import { loadVfx } from './vfx.ts';
import './action.ts';

const data = {
  id: 110, round: 11, name: '奧羅克洛斯', subtitle: '萬古吞噬者',
  color: '#d6b45f', shape: 'triangle', maxHp: 15000, baseHp: 15000, maxMana: 999, speed: 165,
  deathVfx: 'boss_time_dragon_death',
  appearance: {
    size: '巨大（約玩家 2.8 倍）',
    style: '黑曜石龍軀包覆金色鐘盤胸腔，左翼流動時間青光、右翼燃燒終焉紫紅，尾端如巨大時針。',
    weapon: '時間龍息、時針尾刃與斷秒利爪',
    telegraph: '吐息前喉部鐘盤亮起；墜擊前地面浮現刻度；紀元終結時全場褪色並響起倒數鐘聲。',
  },
  ai: 'time_devourer',
  mechanic: { timeAnchors: true, temporalEchoes: true },
  hint: '紀元終結時，每位存活玩家都要各站一座時間錨點；少一人就會全滅。青色殘影會重演剛才的攻擊！',
  tags: [
    { icon: '⏳', text: '全員各站一座時間錨點' },
    { icon: '🐉', text: '青色殘影會重演攻擊' },
    { icon: '☠️', text: '錨點失敗將直接全滅' },
  ],
  hazardText: '⏳ 時間正在崩解！立刻進入你的錨點',
  hazardColor: '#ff6b9f',
  theme: {
    sky: 0x050713, fog: 0x161124, fogNear: 650, fogFar: 2400,
    floor: 0x211b2d, ring: 0xd6b45f,
    wallStone: 0x171522, wallTrim: 0x70e6ff,
    hemiSky: 0x826cff, hemiGround: 0x050713, hemiInt: 0.42,
    sunColor: 0xffe3a0, sunInt: 1.5, rimColor: 0xd06cff, rimInt: 0.75,
    decorations: ['crystal', 'pillar'],
    crystal: { count: 24, color: 0x70e6ff, glow: 0xd06cff, glowInt: 1.0 },
    pillar: { count: 12, color: 0x30263f },
    atmosphere: { kind: 'stardust', color: '#8d78b8', rate: 18 },
    floorDecal: { kind: 'rings', color: '#34264d', opacity: 0.16, glow: 0.12 },
  },
  phases: [
    { hpPct: 0.7, name: '歷史重演', sub: '過去追上了現在', color: '#70e6ff', dmgMult: 1.2, speedMult: 1.05, cdMult: 0.85,
      tagsOverride: [
        { icon: '👥', text: '技能會在 1.5 秒後重演' },
        { icon: '⏳', text: '終結時仍須全員站位' },
      ] },
    { hpPct: 0.35, name: '時間盡頭', sub: '歷史加速崩解', color: '#ff6b9f', dmgMult: 1.45, speedMult: 1.1, cdMult: 0.75,
      tagsOverride: [
        { icon: '⚡', text: '殘影僅延遲 0.8 秒' },
        { icon: '⏱️', text: '紀元終結倒數縮短' },
        { icon: '🔥', text: '20% 將進入限界狂暴' },
      ] },
  ],
  basic: { name: '斷秒爪', type: 'melee', dmg: 48, range: 210, arc: 1.4, knockback: 180, cd: 1.3, windup: 0.7, telegraph: 'arc', color: '#d6b45f', vfx: 'boss_time_claw' },
  skill1: { name: '歲蝕吐息', type: 'projectile', dmg: 24, speed: 560, radius: 16, lifetime: 1.7, count: 5, spread: 0.65, knockback: 70, effect: SLOW(1.5, 0.75), cd: 7, windup: 1.1, telegraph: 'line', color: '#70e6ff', vfx: 'boss_time_breath' },
  skill2: { name: '時針墜落', type: 'zone', range: 260, radius: 100, dmg: 55, lifetime: 0.45, tick: 0.45, delay: 1.2, count: 4, scatter: 330, effect: ROOT(0.5), cd: 10, windup: 1.2, telegraph: 'circle', suppressWindupTelegraph: true, color: '#d06cff' },
  ultimate: { name: '紀元終結', type: 'time_anchor_ritual', cd: 26, windup: 5, finalPhaseWindup: 3.8, recover: 3, anchorRadius: 95, barrageDelay: 0.8, barrageInterval: 1.1, barrageCount: 3, barrageDmg: 20, telegraph: 'self', color: '#ff6b9f', vfx: 'boss_time_ult' },
};

export default new BaseBoss(data, { aiProfile, modelConfig, buildModel, buildWeapon, loadVfx });
