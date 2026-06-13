// 10 種角色定義
//
// 每個角色有 3 個動作：basic (J)、skill1 (K)、skill2 (L) + 1 個大絕 ultimate (;)
// 以及 1 個預設天賦被動 talent。
// 動作 type 由模擬器通用解讀：
//   projectile  發射投射物 (count/spread 散射；homing 追蹤；pierce 穿透；split 分裂)
//   melee       面前扇形即時命中 (arc 為總角度，>=6 視為全方位；detonate 引爆印記；execute 處決)
//   dash        朝面向施加衝量位移 (dmg 則同時做一次面前命中；可帶 execute)
//   charge      沿面向高速衝鋒，撞到第一個敵人即停並命中 (stopOnHit)
//   leap        拋向面前 range 處落地，造成範圍命中
//   grapple     射出鉤爪，命中後把目標拉到自己面前 (gap 為落點間距)
//   blink       朝面向瞬間位移 range 距離 (hitRadius 落點命中；可帶 detonate)
//   multiblink  在最近/帶印記的多個敵人間連續瞬移斬擊 (count 為次數)
//   channel     持續鎖定最近敵人的汲取鏈 (duration/tick/range/dmg/heal)
//   buff        對自己施加效果 (shield/heal/cleanse/effect/trail)
//   zone        生成地面範圍區 (range 0 = 自身腳下；moving 速度=移動火牆/地裂線；
//               follow=跟隨自己的光環；pull=向心吸引黑洞；drainHeal=範圍汲取回血；knockback=擊退)
//
// 共同欄位：name, cd(冷卻秒), manaCost?, hpCost?
// 攻擊欄位：dmg, speed, radius, lifetime, range, arc, count, spread, knockback,
//          color, pierce, recoil, lowHpBonus, homing, hitRadius, execute, detonate
// 效果 effect: { kind:'slow'|'stun'|'haste'|'invis'|'rage'|'burn'|'bleed'|'mark'|'reflect'|'chill'|'root'|'lifesteal', ... }
// buff 額外: shield(數值), heal(數值), cleanse(true), trail({duration,spacing,zone})
// zone 額外: tick(傷害間隔), delay(延遲生效，做隕石用), effect, moving, follow, pull, drainHeal, knockback
// 天賦 talent: { id, name, desc, ...參數 }  由 simulation/entities 依 id 套用被動效果

const publicAsset = (path) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;

export const CHARACTERS = [
  {
    id: 0, name: '戰士', color: '#e74c3c', shape: 'square', sprite: publicAsset('assets/characters/warrior.svg'),
    maxHp: 300, maxMana: 50, speed: 175,
    desc: '衝鋒拉近的單體控制者。鉤索勾人、突刺定身，把敵人按在身邊痛毆。',
    talent: { id: 'unbreakable', name: '不屈鬥志', desc: '血量越低，受到的傷害減免越高（最高 −35%）。', maxDr: 0.35 },
    basic: { name: '橫掃', type: 'melee', dmg: 22, range: 80, arc: 1.35, knockback: 200, cd: 0.5, color: '#ff6b5b', vfx: 'warrior_slash' },
    skill1: { name: '戰矛突刺', type: 'charge', speed: 1050, range: 330, dmg: 96, hitRadius: 50, knockback: 340, stopOnHit: true, effect: { kind: 'stun', duration: 0.8 }, manaCost: 15, cd: 5, color: '#ff8a5b', vfx: 'warrior_charge', self: { shield: 80, duration: 4 } },
    skill2: { name: '鎖鏈鉤爪', type: 'grapple', speed: 840, dmg: 46, radius: 13, lifetime: 0.6, gap: 28, effect: { kind: 'slow', duration: 1.6, factor: 0.5 }, manaCost: 20, cd: 8, color: '#f0a35b', vfx: 'warrior_grapple' },
    ultimate: { name: '天崩地裂', type: 'zone', range: 70, radius: 125, dmg: 46, lifetime: 0.95, tick: 0.2, moving: 540, knockback: 420, effect: { kind: 'stun', duration: 0.5 }, cd: 1, color: '#ffcaa0', vfx: 'warrior_ultimate', self: { shield: 180, heal: 60, duration: 6, effect: { kind: 'haste', duration: 6, factor: 1.4 } } },
  },
  {
    id: 1, name: '法師', color: '#3498db', shape: 'circle', sprite: publicAsset('assets/characters/mage.svg'),
    maxHp: 180, maxMana: 150, speed: 160,
    desc: '元素遠程操控者。追蹤飛彈、烈焰吐息、寒冰凍結，以黑洞奇點收割。',
    talent: { id: 'arcane_flow', name: '奧術迴流', desc: '法術命中敵人時回復 8 點魔力。', mana: 8 },
    basic: { name: '奧術飛彈', type: 'projectile', dmg: 18, speed: 380, radius: 10, lifetime: 1.7, homing: 3.6, knockback: 60, cd: 0.6, color: '#7aa2ff', vfx: 'mage_fireball' },
    skill1: { name: '烈焰吐息', type: 'projectile', dmg: 22, speed: 540, radius: 9, lifetime: 0.42, count: 5, spread: 0.32, knockback: 40, manaCost: 30, cd: 6, color: '#ff9f43', effect: { kind: 'burn', duration: 2, tick: 0.5, dmg: 8 }, vfx: 'mage_fireball' },
    skill2: { name: '寒冰矛', type: 'projectile', dmg: 48, speed: 780, radius: 8, lifetime: 0.7, pierce: true, knockback: 50, manaCost: 40, cd: 7, color: '#74e0ff', effect: { kind: 'chill', stacks: 1, duration: 3, max: 4, freezeDur: 1.1 }, vfx: 'mage_iceshard' },
    ultimate: { name: '時空奇點', type: 'zone', range: 150, radius: 240, dmg: 40, lifetime: 1.6, tick: 0.4, pull: 270, knockback: 0, effect: { kind: 'slow', duration: 2, factor: 0.35 }, cd: 1, color: '#b388ff', vfx: 'mage_ultimate' },
  },
  {
    id: 2, name: '刺客', color: '#9b59b6', shape: 'triangle', sprite: publicAsset('assets/characters/assassin.svg'),
    maxHp: 190, maxMana: 80, speed: 240,
    desc: '標記與引爆的單體爆發手。穿身標記、背刺引爆，隱身中連續瞬殺。',
    talent: { id: 'lethal', name: '致命一擊', desc: '從隱身狀態或敵人背後攻擊，造成 +60% 傷害。', bonus: 0.6, arc: 1.2 },
    basic: { name: '快刀', type: 'melee', dmg: 18, range: 58, arc: 0.95, knockback: 80, cd: 0.34, color: '#c39bd3', vfx: 'assassin_slash' },
    skill1: { name: '影襲', type: 'blink', range: 260, dmg: 60, hitRadius: 95, knockback: 120, effect: { kind: 'mark', factor: 0.25, duration: 4 }, manaCost: 20, cd: 4, color: '#c39bd3', vfx: 'assassin_blink', self: { effect: { kind: 'invis', duration: 1.2, speed: 1.3 } } },
    skill2: { name: '印記引爆', type: 'melee', dmg: 86, range: 80, arc: 1.6, knockback: 160, detonate: { mult: 2.0 }, manaCost: 35, cd: 7, color: '#e056fd', vfx: 'assassin_backstab', self: { effects: [{ kind: 'lifesteal', duration: 4, factor: 0.4 }] } },
    ultimate: { name: '虛空換影', type: 'multiblink', count: 6, dmg: 95, knockback: 150, cd: 1, color: '#e056fd', vfx: 'assassin_ultimate', self: { heal: 70, effects: [{ kind: 'invis', duration: 3, speed: 1.4 }, { kind: 'lifesteal', duration: 6, factor: 0.5 }] } },
  },
  {
    id: 3, name: '坦克', color: '#7f8c8d', shape: 'square', sprite: publicAsset('assets/characters/tank.svg'),
    maxHp: 460, maxMana: 70, speed: 125,
    desc: '聚怪反震的開團堡壘。擒抱定身拉人、反震護盾燙手，地裂線一波擊飛。',
    talent: { id: 'bulwark', name: '鋼鐵壁壘', desc: '永久減免 12% 所受傷害。', dr: 0.12 },
    basic: { name: '重拳', type: 'melee', dmg: 16, range: 78, arc: 1.05, knockback: 300, cd: 0.62, color: '#aab7b8', vfx: 'tank_punch' },
    skill1: { name: '反震護盾', type: 'buff', shield: 280, cleanse: true, duration: 8, effect: { kind: 'reflect', duration: 8, factor: 0.35 }, manaCost: 25, cd: 9, color: '#dfe6e9', vfx: 'tank_shield' },
    skill2: { name: '巨力擒抱', type: 'zone', range: 0, radius: 200, dmg: 36, lifetime: 1.0, tick: 0.5, pull: 340, effect: { kind: 'root', duration: 1.0 }, manaCost: 40, cd: 12, color: '#a0744a', vfx: 'tank_quake' },
    ultimate: { name: '大地崩裂', type: 'zone', range: 60, radius: 150, dmg: 42, lifetime: 1.4, tick: 0.2, moving: 480, knockback: 460, effect: { kind: 'stun', duration: 0.5 }, cd: 1, color: '#cfd8dc', vfx: 'tank_ultimate', self: { shield: 500, duration: 10, effect: { kind: 'haste', duration: 8, factor: 1.25 } } },
  },
  {
    id: 4, name: '弓箭手', color: '#27ae60', shape: 'circle', sprite: publicAsset('assets/characters/archer.svg'),
    maxHp: 220, maxMana: 90, speed: 188,
    desc: '拉開距離的精準獵手。越遠越痛，貫穿箭洞穿一線、寄生箭流血追獵。',
    talent: { id: 'deadeye', name: '致命瞄準', desc: '對越遠的敵人傷害越高（最遠 +50%）。', bonus: 0.5, range: 520 },
    basic: { name: '射箭', type: 'projectile', dmg: 20, speed: 600, radius: 6, lifetime: 1.4, knockback: 70, cd: 0.5, color: '#2ecc71', vfx: 'archer_arrow' },
    skill1: { name: '貫穿箭', type: 'projectile', dmg: 54, speed: 920, radius: 7, lifetime: 0.9, pierce: true, knockback: 90, manaCost: 25, cd: 5, color: '#7bed9f', vfx: 'archer_arrow' },
    skill2: { name: '寄生箭', type: 'projectile', dmg: 30, speed: 560, radius: 6, lifetime: 2.0, homing: 4.0, knockback: 40, manaCost: 30, cd: 8, color: '#1abc9c', effect: { kind: 'bleed', duration: 4, tick: 0.5, dmg: 11, moveMult: 2.2 }, vfx: 'archer_arrow' },
    ultimate: { name: '萬矢歸一', type: 'projectile', dmg: 26, speed: 640, radius: 6, lifetime: 2.2, count: 10, spread: 1.3, homing: 3.4, knockback: 40, cd: 1, color: '#7bed9f', vfx: 'archer_ultimate' },
  },
  {
    id: 5, name: '治療師', color: '#ecf0f1', shape: 'circle', sprite: publicAsset('assets/characters/healer.svg'),
    maxHp: 240, maxMana: 130, speed: 170,
    desc: '吸取轉化的續航法師。汲取鏈偷血、聖光環跟身灼敵，大招抽乾全場。',
    talent: { id: 'lifebloom', name: '生生不息', desc: '持續自動回復生命。', regen: 7 },
    basic: { name: '聖光彈', type: 'projectile', dmg: 13, speed: 420, radius: 8, lifetime: 1.2, knockback: 60, cd: 0.6, color: '#f1c40f', vfx: 'healer_holybolt' },
    skill1: { name: '生命汲取', type: 'channel', duration: 3, tick: 0.4, range: 320, dmg: 24, heal: 26, manaCost: 30, cd: 6, color: '#2ecc71', vfx: 'healer_cleanse' },
    skill2: { name: '神聖光環', type: 'zone', range: 0, radius: 150, dmg: 18, lifetime: 6, tick: 0.5, follow: true, drainHeal: 12, effect: { kind: 'burn', duration: 2, tick: 0.5, dmg: 8 }, manaCost: 35, cd: 10, color: '#55efc4', vfx: 'healer_aura', self: { effect: { kind: 'haste', duration: 6, factor: 1.2 } } },
    ultimate: { name: '生命匯流', type: 'zone', range: 0, radius: 280, dmg: 45, lifetime: 1.6, tick: 0.4, drainHeal: 120, knockback: 90, cd: 1, color: '#aaffcc', vfx: 'healer_ultimate', self: { heal: 300, shield: 300, cleanse: true, duration: 8, effect: { kind: 'haste', duration: 8, factor: 1.5 } } },
  },
  {
    id: 6, name: '狂戰士', color: '#922b21', shape: 'square', sprite: publicAsset('assets/characters/berserker.svg'),
    maxHp: 300, maxMana: 60, speed: 152,
    desc: '殘血越戰越猛的處決者。躍斬入場流血、血怒爆走，殘敵直接斬殺。',
    talent: { id: 'bloodlust', name: '嗜血狂暴', desc: '血量越低，攻擊速度與吸血量越高。', haste: 0.6, lifesteal: 0.25 },
    basic: { name: '雙斧', type: 'melee', dmg: 20, range: 70, arc: 1.2, knockback: 130, cd: 0.46, lowHpBonus: true, color: '#cd6155', vfx: 'berserker_axes' },
    skill1: { name: '嗜血躍斬', type: 'leap', range: 270, dur: 0.45, dmg: 90, radius: 130, knockback: 200, effect: { kind: 'bleed', duration: 4, tick: 0.5, dmg: 12, moveMult: 2.2 }, manaCost: 20, cd: 6, color: '#ec7063', vfx: 'berserker_leap' },
    skill2: { name: '血怒', type: 'buff', hpCost: 25, heal: 40, effect: { kind: 'rage', duration: 8, speed: 1.7, dmg: 1.7 }, duration: 8, cd: 8, color: '#e74c3c', vfx: 'berserker_rage', self: { effects: [{ kind: 'lifesteal', duration: 8, factor: 0.4 }] } },
    ultimate: { name: '血祭處決', type: 'dash', impulse: 980, dmg: 92, range: 150, arc: 7, knockback: 280, execute: { threshold: 0.25, mult: 4 }, cd: 1, color: '#ff3b2f', vfx: 'berserker_ultimate', self: { heal: 120, effects: [{ kind: 'rage', duration: 10, speed: 2.0, dmg: 2.0 }, { kind: 'lifesteal', duration: 10, factor: 0.6 }] } },
  },
  {
    id: 7, name: '忍者', color: '#2c3e50', shape: 'triangle', sprite: publicAsset('assets/characters/ninja.svg'),
    maxHp: 200, maxMana: 90, speed: 235,
    desc: '定身與煙遁的群襲刺客。影縛符釘人、影襲連斬，化身追蹤刃影獵全場。',
    talent: { id: 'smoke', name: '煙遁', desc: '靜止 1.5 秒後自動進入短暫隱身。', delay: 1.5, linger: 0.6 },
    basic: { name: '飛鏢', type: 'projectile', dmg: 15, speed: 640, radius: 5, lifetime: 1.0, knockback: 40, cd: 0.4, color: '#95a5a6', vfx: 'ninja_shuriken' },
    skill1: { name: '影縛符', type: 'projectile', dmg: 32, speed: 620, radius: 7, lifetime: 0.8, knockback: 30, manaCost: 25, cd: 6, color: '#636e72', effect: { kind: 'root', duration: 1.3 }, vfx: 'ninja_bind' },
    skill2: { name: '影襲瞬移', type: 'blink', range: 320, dmg: 74, hitRadius: 95, knockback: 120, manaCost: 30, cd: 5, color: '#636e72', vfx: 'ninja_shadowblink', self: { effect: { kind: 'invis', duration: 1.2, speed: 1.3 } } },
    ultimate: { name: '萬影亂舞', type: 'projectile', dmg: 30, speed: 720, radius: 6, lifetime: 1.0, count: 18, spread: 0.34, homing: 3.0, pierce: true, knockback: 50, cd: 1, color: '#b0bec5', vfx: 'ninja_ultimate', self: { effect: { kind: 'invis', duration: 2.5, speed: 1.5 } } },
  },
  {
    id: 8, name: '元素使', color: '#e67e22', shape: 'circle', sprite: publicAsset('assets/characters/elementalist.svg'),
    maxHp: 220, maxMana: 140, speed: 160,
    desc: '操控地形的持續法師。推進火牆、移動鋪設寒霜，天降隕石風暴覆滅全場。',
    talent: { id: 'pyromancy', name: '烈焰精通', desc: '自身造成的燃燒傷害更高、持續更久。', burnDmg: 1.6, burnDur: 1.4 },
    basic: { name: '火花', type: 'melee', dmg: 14, range: 96, arc: 0.85, knockback: 40, cd: 0.4, color: '#f39c12', effect: { kind: 'burn', duration: 2, tick: 0.5, dmg: 5 }, vfx: 'elem_spark' },
    skill1: { name: '烈焰洪流', type: 'zone', range: 60, radius: 110, dmg: 24, lifetime: 2.6, tick: 0.4, moving: 320, effect: { kind: 'burn', duration: 2, tick: 0.5, dmg: 8 }, manaCost: 30, cd: 6, color: '#e74c3c', vfx: 'elem_firezone' },
    skill2: { name: '寒霜足跡', type: 'buff', duration: 3, manaCost: 30, cd: 8, color: '#74e0ff', vfx: 'elem_frost', effect: { kind: 'haste', duration: 3, factor: 1.2 }, trail: { duration: 3, spacing: 44, zone: { radius: 90, dmg: 14, lifetime: 1.6, tick: 0.5, effect: { kind: 'chill', stacks: 1, duration: 2, max: 4, freezeDur: 1.0 }, color: '#9fe8ff', vfx: 'elem_frost' } } },
    ultimate: { name: '天地崩裂', type: 'zone', range: 150, radius: 140, dmg: 95, lifetime: 0.4, tick: 0.4, delay: 0.8, count: 7, scatter: 220, stagger: 0.14, effect: { kind: 'burn', duration: 3, tick: 0.5, dmg: 14 }, cd: 1, color: '#ff5a1f', vfx: 'elem_ultimate' },
  },
  {
    id: 9, name: '格鬥家', color: '#f1c40f', shape: 'circle', sprite: publicAsset('assets/characters/fighter.svg'),
    maxHp: 280, maxMana: 70, speed: 196,
    desc: '連段與招架的近戰宗師。連擊累積氣勢、招架反彈，昇龍突進一擊定勝。',
    talent: { id: 'momentum', name: '連擊氣勢', desc: '短時間內連續命中，每層 +10% 傷害（最多 5 層）。', maxStacks: 5, perStack: 0.1, window: 2.2 },
    basic: { name: '連環拳', type: 'melee', dmg: 15, range: 58, arc: 1.05, knockback: 100, cd: 0.3, color: '#f7dc6f', vfx: 'fighter_combo' },
    skill1: { name: '上勾拳', type: 'melee', dmg: 88, range: 72, arc: 0.85, knockback: 520, manaCost: 25, cd: 5, color: '#f9e79f', vfx: 'fighter_uppercut', self: { effect: { kind: 'haste', duration: 3, factor: 1.3 } } },
    skill2: { name: '招架反擊', type: 'buff', shield: 200, cleanse: true, effect: { kind: 'reflect', duration: 3, factor: 0.8 }, duration: 3, manaCost: 30, cd: 8, color: '#f4d03f', vfx: 'fighter_counter' },
    ultimate: { name: '真·昇龍霸', type: 'dash', impulse: 900, dmg: 185, range: 110, arc: 1.4, knockback: 700, effect: { kind: 'stun', duration: 1.0 }, cd: 1, color: '#ffe27a', vfx: 'fighter_ultimate', self: { shield: 120, heal: 40, duration: 5, effect: { kind: 'haste', duration: 5, factor: 1.5 } } },
  },
];

export function getCharacter(id) {
  return CHARACTERS[id] || CHARACTERS[0];
}
