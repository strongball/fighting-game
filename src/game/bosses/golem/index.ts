import { BaseBoss } from '../BaseBoss.ts';
import { BURN, STUN, SLOW, ROOT, CHILL } from '../effects.js';
import { aiProfile } from './ai.ts';
import { modelConfig, buildModel, buildWeapon } from './model.ts';
import { loadVfx } from './vfx.ts';
import { arena } from './arena.ts';

const data = {
    id: 100, round: 1, name: '巨木傀儡', subtitle: '森林守護者',
    color: '#6b8e23', shape: 'square', maxHp: 3500, maxMana: 999, speed: 110,
    baseHp: 3500,
    deathVfx: 'boss_golem_death',
    appearance: {
      size: '巨大 (約玩家 2.2 倍)',
      style: '木石魔像，覆滿樹皮與苔蘚的軀幹，胸口嵌一顆持續發光的綠色生命核心，雙臂是粗壯的樹幹。配色：樹皮褐 #6b4a2b + 苔綠 #6b8e23 + 核心翠光。',
      weapon: '雙樹幹臂 (無持械，以臂砸擊)',
      telegraph: '揮擊前樹幹臂發綠光並緩緩後拉、地面浮現弧形警示；旋掃前全身發光蓄力。動作整體緩慢、破綻大。',
    },
    ai: 'golem',
    mechanic: { backWeak: 0.5, aggroSwap: 3.0 }, // 背後受傷 +50%；每 3 秒換仇恨目標
    talent: { id: 'boss_backweak', name: '遲鈍核心', desc: '背後受到的傷害提高 50%。', backWeak: 0.5 },
    hint: '繞到背後攻擊，傷害 +50%！',
    tags: [
      { icon: '🪵', text: '背後弱點 +50%' },
      { icon: '🎯', text: '仇恨每 3 秒跳' },
    ],
    hazardText: '⚠️ 快離開攻擊範圍！',
    hazardColor: '#e6b352',
    // 場地（場景主題 + 神殿基座碰撞）定義於 ./arena.ts
    colliders: arena.colliders,
    theme: arena.theme,

    phases: [
      { hpPct: 0.66, name: '狂亂之根', sub: '怒火覺醒', color: '#a6d749', dmgMult: 1.0, speedMult: 1.1, cdMult: 0.85,
        tagsOverride: [
          { icon: '🪵', text: '背後弱點 +50%' },
          { icon: '🎯', text: '仇恨切換更快' },
          { icon: '⚡', text: '攻擊強化 +10%' },
        ] },
      { hpPct: 0.33, name: '森羅之怒', sub: '終末綻放', color: '#ff7a3d', dmgMult: 1.2, speedMult: 1.25, cdMult: 0.65,
        tagsOverride: [
          { icon: '🔥', text: '狂暴 — 攻擊 +50%' },
          { icon: '⚡', text: '出招間隔縮短' },
        ] },
    ],

    basic: { name: '橫掃巨臂', type: 'melee', dmg: 45, range: 300, arc: 1.5, knockback: 240, cd: 1.7, windup: 0.5, telegraph: 'arc', color: '#8fbf3f', vfx: 'boss_golem_sweep' },
    skill1: { name: '巨力砸地', type: 'zone', range: 260, radius: 220, dmg: 70, lifetime: 0.4, tick: 0.4, delay: 1.0, knockback: 200, effect: STUN(0.5), cd: 6.8, windup: 0.6, telegraph: 'circle', color: '#7a5a2b', vfx: 'boss_golem_slam' },
    skill2: { name: '纏根束縛', type: 'zone', range: 0, radius: 320, dmgPct: 0.025, lifetime: 1.2, tick: 0.5, pull: 200, effect: ROOT(1.2), cd: 9.8, windup: 0.5, telegraph: 'circle', color: '#4e7a2f', vfx: 'boss_golem_roots' },
    ultimate: { name: '森羅旋掃', type: 'zone', range: 0, radius: 280, dmg: 90, lifetime: 1.2, tick: 0.3, knockback: 500, effect: STUN(1.0), cd: 14.3, windup: 0.6, telegraph: 'circle', color: '#a6d749', vfx: 'boss_golem_ult' },
  };

export default new BaseBoss(data, { aiProfile, modelConfig, buildModel, buildWeapon, loadVfx });