// 10 種角色定義
//
// 每個角色有 3 個動作：basic (J)、skill1 (K)、skill2 (L)
// 動作 type 由模擬器通用解讀：
//   projectile  發射投射物 (count/spread 可做散射)
//   melee       面前扇形即時命中 (arc 為總角度，>=6 視為全方位)
//   dash        朝面向施加衝量位移 (dmg 則同時做一次面前命中)
//   blink       朝面向瞬間位移 range 距離
//   buff        對自己施加效果 (shield/heal/cleanse/effect)
//   zone        在面前 range 距離生成地面範圍區 (range 0 = 自身腳下)
//
// 共同欄位：name, cd(冷卻秒), manaCost?, hpCost?
// 攻擊欄位：dmg, speed, radius, lifetime, range, arc, count, spread, knockback,
//          color, pierce, recoil, lowHpBonus
// 效果 effect: { kind:'slow'|'stun'|'haste'|'invis'|'rage', duration, factor?, speed?, dmg? }
// buff 額外: shield(數值), heal(數值), cleanse(true)
// zone 額外: tick(傷害間隔), delay(延遲生效，做隕石用), effect

export const CHARACTERS = [
  {
    id: 0, name: '戰士', color: '#e74c3c', shape: 'square', sprite: 'assets/characters/warrior.svg',
    maxHp: 150, maxMana: 50, speed: 175,
    desc: '高血量近戰，衝鋒接戰吼。強：肉與爆發；弱：沒有遠程手段。',
    basic: { name: '揮砍', type: 'melee', dmg: 14, range: 72, arc: 1.3, knockback: 180, cd: 0.5, color: '#ff6b5b' },
    skill1: { name: '衝鋒', type: 'dash', impulse: 920, dmg: 18, range: 78, arc: 1.0, knockback: 240, manaCost: 15, cd: 5, color: '#ff8a5b' },
    skill2: { name: '戰吼', type: 'buff', shield: 45, effect: { kind: 'haste', duration: 5, factor: 1.25 }, duration: 5, manaCost: 20, cd: 11, color: '#ffd166' },
  },
  {
    id: 1, name: '法師', color: '#3498db', shape: 'circle', sprite: 'assets/characters/mage.svg',
    maxHp: 80, maxMana: 150, speed: 160,
    desc: '遠程與範圍法術壓制。強：遠程 AoE；弱：血量薄。',
    basic: { name: '火球', type: 'projectile', dmg: 11, speed: 430, radius: 9, lifetime: 1.3, knockback: 60, cd: 0.55, color: '#ff9f43' },
    skill1: { name: '冰霜新星', type: 'zone', range: 0, radius: 135, dmg: 16, lifetime: 0.45, tick: 0.45, effect: { kind: 'slow', duration: 1.8, factor: 0.45 }, manaCost: 30, cd: 6, color: '#74e0ff' },
    skill2: { name: '閃電鏈', type: 'projectile', dmg: 34, speed: 760, radius: 8, lifetime: 0.85, pierce: true, knockback: 40, manaCost: 40, cd: 7, color: '#b388ff' },
  },
  {
    id: 2, name: '刺客', color: '#9b59b6', shape: 'triangle', sprite: 'assets/characters/assassin.svg',
    maxHp: 90, maxMana: 80, speed: 240,
    desc: '高機動瞬間爆發。強：突進與爆發；弱：容錯極低。',
    basic: { name: '快刀', type: 'melee', dmg: 12, range: 56, arc: 0.95, knockback: 70, cd: 0.34, color: '#c39bd3' },
    skill1: { name: '瞬步', type: 'blink', range: 240, manaCost: 20, cd: 4, color: '#c39bd3' },
    skill2: { name: '背刺爆發', type: 'melee', dmg: 42, range: 62, arc: 1.5, knockback: 120, manaCost: 35, cd: 7, color: '#e056fd' },
  },
  {
    id: 3, name: '坦克', color: '#7f8c8d', shape: 'square', sprite: 'assets/characters/tank.svg',
    maxHp: 220, maxMana: 70, speed: 125,
    desc: '超高血量與控場。強：肉盾與暈眩；弱：移動慢、輸出低。',
    basic: { name: '重拳', type: 'melee', dmg: 11, range: 76, arc: 1.0, knockback: 280, cd: 0.62, color: '#aab7b8' },
    skill1: { name: '護盾', type: 'buff', shield: 95, duration: 6, manaCost: 25, cd: 9, color: '#dfe6e9' },
    skill2: { name: '震地', type: 'zone', range: 0, radius: 155, dmg: 18, lifetime: 0.4, tick: 0.4, effect: { kind: 'stun', duration: 1.2 }, manaCost: 40, cd: 12, color: '#a0744a' },
  },
  {
    id: 4, name: '弓箭手', color: '#27ae60', shape: 'circle', sprite: 'assets/characters/archer.svg',
    maxHp: 100, maxMana: 90, speed: 188,
    desc: '穩定遠程輸出。強：遠程射擊與走位；弱：近身弱勢。',
    basic: { name: '射箭', type: 'projectile', dmg: 13, speed: 580, radius: 6, lifetime: 1.4, knockback: 60, cd: 0.5, color: '#2ecc71' },
    skill1: { name: '多重箭', type: 'projectile', dmg: 11, speed: 540, radius: 6, lifetime: 1.2, count: 3, spread: 0.34, knockback: 50, manaCost: 25, cd: 5, color: '#7bed9f' },
    skill2: { name: '後撤陷阱', type: 'zone', range: 0, radius: 95, dmg: 6, lifetime: 4, tick: 0.6, effect: { kind: 'slow', duration: 1.3, factor: 0.4 }, recoil: 560, manaCost: 30, cd: 8, color: '#1abc9c' },
  },
  {
    id: 5, name: '治療師', color: '#ecf0f1', shape: 'circle', sprite: 'assets/characters/healer.svg',
    maxHp: 110, maxMana: 130, speed: 170,
    desc: '高續航自我支援。強：耐久與自療；弱：輸出低。',
    basic: { name: '聖光彈', type: 'projectile', dmg: 8, speed: 390, radius: 8, lifetime: 1.2, knockback: 50, cd: 0.6, color: '#f1c40f' },
    skill1: { name: '自我治療', type: 'buff', heal: 55, manaCost: 30, cd: 6, color: '#2ecc71' },
    skill2: { name: '淨化加速', type: 'buff', heal: 20, cleanse: true, effect: { kind: 'haste', duration: 5, factor: 1.5 }, duration: 5, manaCost: 35, cd: 10, color: '#55efc4' },
  },
  {
    id: 6, name: '狂戰士', color: '#922b21', shape: 'square', sprite: 'assets/characters/berserker.svg',
    maxHp: 140, maxMana: 60, speed: 152,
    desc: '殘血越戰越猛。強：低血暴傷與血怒；弱：高風險、無遠程。',
    basic: { name: '雙斧', type: 'melee', dmg: 13, range: 66, arc: 1.15, knockback: 120, cd: 0.46, lowHpBonus: true, color: '#cd6155' },
    skill1: { name: '血怒', type: 'buff', hpCost: 25, effect: { kind: 'rage', duration: 6, speed: 1.55, dmg: 1.35 }, duration: 6, cd: 8, color: '#e74c3c' },
    skill2: { name: '旋風斬', type: 'melee', dmg: 22, range: 96, arc: 7, knockback: 160, manaCost: 30, cd: 7, color: '#ec7063' },
  },
  {
    id: 7, name: '忍者', color: '#2c3e50', shape: 'triangle', sprite: 'assets/characters/ninja.svg',
    maxHp: 95, maxMana: 90, speed: 235,
    desc: '隱身與瞬移難以捉摸。強：高機動與脫戰；弱：血量低。',
    basic: { name: '飛鏢', type: 'projectile', dmg: 10, speed: 620, radius: 5, lifetime: 1.0, knockback: 30, cd: 0.4, color: '#95a5a6' },
    skill1: { name: '煙霧隱身', type: 'buff', effect: { kind: 'invis', duration: 3, speed: 1.3 }, duration: 3, manaCost: 25, cd: 7, color: '#636e72' },
    skill2: { name: '影分身瞬移', type: 'blink', range: 300, manaCost: 30, cd: 5, color: '#636e72' },
  },
  {
    id: 8, name: '元素使', color: '#e67e22', shape: 'circle', sprite: 'assets/characters/elementalist.svg',
    maxHp: 105, maxMana: 140, speed: 160,
    desc: '地面範圍壓制。強：持續範圍傷害；弱：技能前搖明顯。',
    basic: { name: '火花', type: 'melee', dmg: 9, range: 92, arc: 0.8, knockback: 40, cd: 0.4, color: '#f39c12' },
    skill1: { name: '火焰地帶', type: 'zone', range: 120, radius: 100, dmg: 10, lifetime: 4, tick: 0.5, manaCost: 30, cd: 6, color: '#e74c3c' },
    skill2: { name: '隕石', type: 'zone', range: 170, radius: 135, dmg: 55, lifetime: 0.4, tick: 0.4, delay: 1.2, manaCost: 50, cd: 10, color: '#c0392b' },
  },
  {
    id: 9, name: '格鬥家', color: '#f1c40f', shape: 'circle', sprite: 'assets/characters/fighter.svg',
    maxHp: 130, maxMana: 70, speed: 196,
    desc: '均衡近戰連段。強：穩定連段與擊飛；弱：缺乏遠程。',
    basic: { name: '連環拳', type: 'melee', dmg: 10, range: 56, arc: 1.0, knockback: 90, cd: 0.3, color: '#f7dc6f' },
    skill1: { name: '上勾拳', type: 'melee', dmg: 26, range: 60, arc: 0.8, knockback: 360, manaCost: 25, cd: 5, color: '#f9e79f' },
    skill2: { name: '格擋反擊', type: 'buff', shield: 120, duration: 1.6, manaCost: 30, cd: 8, color: '#f4d03f' },
  },
];

export function getCharacter(id) {
  return CHARACTERS[id] || CHARACTERS[0];
}
