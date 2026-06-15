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
//   buff        對自己施加效果 (shield/heal/cleanse/effect/trail)；可帶 ally 對友方施加增益
//   zone        生成地面範圍區 (range 0 = 自身腳下；moving 速度=移動火牆/地裂線；
//               follow=跟隨自己的光環；pull=向心吸引黑洞；drainHeal=範圍汲取回血；knockback=擊退)
//
// 共同欄位：name, cd(冷卻秒), manaCost?, hpCost?
// 攻擊欄位：dmg, speed, radius, lifetime, range, arc, count, spread, knockback,
//          color, pierce, recoil, lowHpBonus, homing, hitRadius, execute, detonate
// 效果 effect: { kind:'slow'|'stun'|'haste'|'invis'|'rage'|'burn'|'bleed'|'mark'|'reflect'|'chill'|'root'|'lifesteal'|'protect', ... }
//   protect = 友方減傷光環 (factor 為減傷比例)
// buff 額外: shield(數值), heal(數值), cleanse(true), trail({duration,spacing,zone})
// zone 額外: tick(傷害間隔), delay(延遲生效，做隕石用), effect, moving, follow, pull, drainHeal, allyHeal(每跳對友方回血), knockback
// 友方增益 ally: { radius, heal?, shield?, cleanse?, duration?, effect?, effects? } 對範圍內友方(含自己)施加(支援型技能)
// 天賦 talent: { id, name, desc, ...參數 }  由 simulation/entities 依 id 套用被動效果

import { getBoss } from './bosses.js';

const publicAsset = (path) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;

function generateTextureSprite(charId, baseHex) {
  if (typeof document === 'undefined') return '';
  const S = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const x = cv.getContext('2d');
  
  const hexToRgb = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  };
  
  const rgbToHex = (r, g, b) => {
    const clamp = (val) => Math.max(0, Math.min(255, Math.floor(val)));
    const rh = clamp(r).toString(16).padStart(2, '0');
    const gh = clamp(g).toString(16).padStart(2, '0');
    const bh = clamp(b).toString(16).padStart(2, '0');
    return `#${rh}${gh}${bh}`;
  };

  const c = hexToRgb(baseHex);
  const lightColor = rgbToHex(c.r + (255 - c.r) * 0.25, c.g + (255 - c.g) * 0.25, c.b + (255 - c.b) * 0.25);
  const darkColor = rgbToHex(c.r * 0.4, c.g * 0.4, c.b * 0.4);

  // 基礎漸層背景
  const grad = x.createLinearGradient(0, 0, 0, S);
  grad.addColorStop(0, lightColor);
  grad.addColorStop(0.5, baseHex);
  grad.addColorStop(1, darkColor);
  x.fillStyle = grad;
  x.fillRect(0, 0, S, S);
  
  // 繪製與 3D 貼圖相呼應的職業特色圖案
  x.lineWidth = 2.5;
  if (charId === 0) { // 戰士：鎧甲板甲線條與金色裝飾
    x.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    for (let i = 0; i < S; i += 16) {
      x.beginPath(); x.moveTo(i, 0); x.lineTo(i, S); x.stroke();
      x.beginPath(); x.moveTo(0, i); x.lineTo(S, i); x.stroke();
    }
    x.fillStyle = 'rgba(255, 215, 0, 0.4)';
    for (let i = 16; i < S; i += 32) {
      x.beginPath(); x.arc(i, i, 4, 0, 7); x.fill();
    }
  } 
  else if (charId === 1) { // 法師：奧術星辰與邊緣法線
    x.fillStyle = 'rgba(255, 255, 255, 0.25)';
    for (let i = 0; i < 15; i++) {
      x.beginPath(); x.arc(Math.random() * S, Math.random() * S, 2 + Math.random() * 3, 0, 7); x.fill();
    }
    x.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    x.lineWidth = 3;
    x.strokeRect(15, 15, S - 30, S - 30);
  }
  else if (charId === 2) { // 刺客：暗影束帶與紫色格紋
    x.fillStyle = '#110b1a';
    for (let i = 0; i < S; i += 12) {
      x.fillRect(0, i, S, 3);
    }
    x.strokeStyle = 'rgba(155, 89, 182, 0.6)';
    x.lineWidth = 4;
    x.beginPath(); x.moveTo(0, 0); x.lineTo(S, S); x.moveTo(S, 0); x.lineTo(0, S); x.stroke();
  }
  else if (charId === 3) { // 坦克：重型金屬鋼板與螺栓
    x.fillStyle = 'rgba(0,0,0,0.3)';
    for (let i = 0; i < S; i += 32) {
      x.fillRect(i, 0, 6, S);
      x.fillRect(0, i, S, 6);
    }
    x.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    x.lineWidth = 3;
    x.strokeRect(8, 8, S - 16, S - 16);
  }
  else if (charId === 4) { // 弓箭手：皮甲拼貼與林地迷彩
    x.fillStyle = 'rgba(46, 204, 113, 0.5)';
    for (let i = 0; i < 12; i++) {
      x.fillRect(Math.random() * (S - 20), Math.random() * (S - 10), 20, 10);
    }
  }
  else if (charId === 5) { // 治療師：聖光十字與白絲質地
    x.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    x.lineWidth = 4;
    x.beginPath();
    x.moveTo(S / 2, 12); x.lineTo(S / 2, S - 12);
    x.moveTo(12, S / 2); x.lineTo(S - 12, S / 2);
    x.stroke();
  }
  else if (charId === 6) { // 狂戰士：血腥尖刺與怒火塗鴉
    x.fillStyle = '#e74c3c';
    for (let i = 0; i < 8; i++) {
      x.beginPath();
      const px = Math.random() * S, py = Math.random() * S;
      x.moveTo(px, py); x.lineTo(px + 10, py + 20); x.lineTo(px - 10, py + 20);
      x.closePath(); x.fill();
    }
  }
  else if (charId === 7) { // 忍者：夜行緊身網格與忍具線條
    x.fillStyle = 'rgba(0,0,0,0.5)';
    x.fillRect(0, 0, S, S);
    x.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    x.lineWidth = 1;
    for (let i = 0; i < S; i += 6) {
      x.beginPath(); x.moveTo(i, 0); x.lineTo(i, S); x.stroke();
      x.beginPath(); x.moveTo(0, i); x.lineTo(S, i); x.stroke();
    }
  }
  else if (charId === 8) { // 元素使：三元元素混沌流光
    x.fillStyle = 'rgba(230, 126, 34, 0.5)'; // 火
    x.fillRect(0, 0, S, S/3);
    x.fillStyle = 'rgba(52, 152, 219, 0.5)'; // 冰
    x.fillRect(0, S/3, S, S/3);
    x.fillStyle = 'rgba(241, 196, 15, 0.5)'; // 雷
    x.fillRect(0, 2*S/3, S, S/3);
  }
  else if (charId === 9) { // 格鬥家：武僧服飾滾邊與修煉印記
    x.strokeStyle = '#000000';
    x.lineWidth = 6;
    x.strokeRect(0, 0, S, S);
    x.strokeRect(20, 20, S - 40, S - 40);
  }
  else if (charId === 10) { // 聖騎士：聖光十字盾紋與金色光輝
    x.strokeStyle = 'rgba(255, 248, 200, 0.8)';
    x.lineWidth = 6;
    x.beginPath(); x.moveTo(S / 2, 14); x.lineTo(S / 2, S - 14); x.moveTo(20, S * 0.42); x.lineTo(S - 20, S * 0.42); x.stroke();
    x.fillStyle = 'rgba(255, 215, 0, 0.35)';
    for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; x.beginPath(); x.arc(S / 2 + Math.cos(a) * 52, S / 2 + Math.sin(a) * 52, 3, 0, 7); x.fill(); }
  }
  else if (charId === 11) { // 咒術師：詛咒符文與紫色裂紋
    x.strokeStyle = 'rgba(180, 120, 220, 0.55)';
    x.lineWidth = 2;
    for (let i = 0; i < 10; i++) { const px = Math.random() * S, py = Math.random() * S; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (Math.random() - 0.5) * 50, py + (Math.random() - 0.5) * 50); x.lineTo(px + (Math.random() - 0.5) * 40, py + 30); x.stroke(); }
    x.fillStyle = 'rgba(220, 160, 255, 0.5)';
    for (let i = 0; i < 16; i++) { x.beginPath(); x.arc(Math.random() * S, Math.random() * S, 1.5 + Math.random() * 2, 0, 7); x.fill(); }
  }
  else if (charId === 12) { // 吟遊詩人：音符與五線譜流光
    x.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    x.lineWidth = 2;
    for (let i = 1; i < 6; i++) { x.beginPath(); x.moveTo(0, i * S / 6); x.lineTo(S, i * S / 6); x.stroke(); }
    x.fillStyle = 'rgba(255, 230, 245, 0.7)';
    for (let i = 0; i < 7; i++) { const py = ((i % 5) + 1) * S / 6; x.beginPath(); x.arc(16 + i * 16, py, 4, 0, 7); x.fill(); x.fillRect(16 + i * 16 + 3, py - 16, 1.6, 16); }
  }
  else if (charId === 13) { // 武士：和風波紋與緋紅刀痕
    x.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    x.lineWidth = 2;
    for (let i = 0; i < 5; i++) { x.beginPath(); x.arc(S / 2, S + 20, 30 + i * 22, Math.PI * 1.15, Math.PI * 1.85); x.stroke(); }
    x.strokeStyle = 'rgba(255, 80, 60, 0.7)';
    x.lineWidth = 4;
    x.beginPath(); x.moveTo(18, 24); x.lineTo(S - 24, S - 40); x.stroke();
  }
  else if (charId === 14) { // 槍手：彈孔與機械瞄準格紋
    x.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    x.lineWidth = 1.5;
    for (let i = 0; i < S; i += 22) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, S); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(S, i); x.stroke(); }
    x.fillStyle = 'rgba(40, 30, 10, 0.55)';
    for (let i = 0; i < 10; i++) { x.beginPath(); x.arc(Math.random() * S, Math.random() * S, 2 + Math.random() * 2.5, 0, 7); x.fill(); }
  }
  else if (charId === 15) { // 召喚師：召喚陣與青綠靈紋
    x.strokeStyle = 'rgba(120, 240, 210, 0.6)';
    x.lineWidth = 2.5;
    x.beginPath(); x.arc(S / 2, S / 2, 44, 0, 7); x.stroke();
    x.beginPath(); x.arc(S / 2, S / 2, 30, 0, 7); x.stroke();
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; x.beginPath(); x.moveTo(S / 2 + Math.cos(a) * 30, S / 2 + Math.sin(a) * 30); x.lineTo(S / 2 + Math.cos(a) * 44, S / 2 + Math.sin(a) * 44); x.stroke(); }
  }
  else if (charId === 16) { // 死靈法師：枯骨裂紋與幽綠死氣
    x.fillStyle = 'rgba(0, 0, 0, 0.4)';
    x.fillRect(0, 0, S, S);
    x.strokeStyle = 'rgba(120, 200, 140, 0.45)';
    x.lineWidth = 2;
    for (let i = 0; i < 8; i++) { const px = Math.random() * S, py = Math.random() * S; x.beginPath(); x.moveTo(px, py); for (let j = 0; j < 3; j++) x.lineTo(px + (Math.random() - 0.5) * 40, py + j * 18); x.stroke(); }
  }
  else if (charId === 17) { // 時空術士：時鐘刻度與青藍漩渦
    x.strokeStyle = 'rgba(150, 240, 255, 0.6)';
    x.lineWidth = 2;
    x.beginPath(); x.arc(S / 2, S / 2, 50, 0, 7); x.stroke();
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; x.beginPath(); x.moveTo(S / 2 + Math.cos(a) * 44, S / 2 + Math.sin(a) * 44); x.lineTo(S / 2 + Math.cos(a) * 50, S / 2 + Math.sin(a) * 50); x.stroke(); }
    x.strokeStyle = 'rgba(200, 250, 255, 0.5)';
    x.beginPath(); x.moveTo(S / 2, S / 2); x.lineTo(S / 2, S / 2 - 36); x.moveTo(S / 2, S / 2); x.lineTo(S / 2 + 26, S / 2); x.stroke();
  }
  
  return cv.toDataURL();
}

export const CHARACTERS = [
  {
    id: 0, name: '戰士', color: '#e74c3c', shape: 'square', sprite: generateTextureSprite(0, '#e74c3c'),
    maxHp: 300, maxMana: 60, speed: 175,
    desc: '前排錨點。突刺開團、鉤索拉人，大招化身不動堡壘為全隊套上護盾並震懾敵群。傷害不高，價值在保護與控制。',
    role: '前排 · 開團/保護',
    synergy: '搭配脆皮爆發(法師/弓箭手/刺客)：突刺開團、鉤索拉人，替隊友創造擊殺空間。',
    talent: { id: 'unbreakable', name: '不屈鬥志', desc: '血量越低，受到的傷害減免越高（最高 −30%）。', maxDr: 0.30 },
    basic: { name: '橫掃', type: 'melee', dmg: 26, range: 200, arc: 0.5, knockback: 180, cd: 0.55, color: '#ff6b5b', vfx: 'warrior_slash' },
    skill1: { name: '戰矛突刺', type: 'charge', speed: 1000, range: 320, dmg: 70, hitRadius: 50, knockback: 300, stopOnHit: true, effect: { kind: 'stun', duration: 0.6 }, manaCost: 25, cd: 9, color: '#ff8a5b', vfx: 'warrior_charge' },
    skill2: { name: '鎖鏈鉤爪', type: 'grapple', speed: 820, dmg: 40, radius: 13, lifetime: 0.6, gap: 28, effect: { kind: 'slow', duration: 1.6, factor: 0.5 }, manaCost: 30, cd: 11, color: '#f0a35b', vfx: 'warrior_grapple' },
    ultimate: { name: '不動如山', type: 'zone', range: 0, radius: 150, dmg: 90, lifetime: 0.4, tick: 0.4, knockback: 300, effect: { kind: 'stun', duration: 0.8 }, cd: 11, color: '#ffcaa0', vfx: 'warrior_ultimate', self: { shield: 280, cleanse: true, duration: 6 }, ally: { radius: 320, shield: 160, cleanse: true } },
  },
  {
    id: 1, name: '法師', color: '#3498db', shape: 'circle', sprite: generateTextureSprite(1, '#3498db'),
    maxHp: 170, maxMana: 140, speed: 158,
    desc: '遠程爆發法師，全靠瞄準。飛彈不再追蹤、寒冰矛凍結起手、烈焰吐息近身爆發，大招天降流星（落點預警可閃避）單體灌爆。脆皮且極耗魔，落空就斷魔。',
    role: '後排 · 遠程爆發',
    synergy: '需前排(戰士/坦克)保護與控場，替你定住目標好讓流星與冰矛命中。',
    talent: { id: 'arcane_flow', name: '奧術迴流', desc: '法術命中敵人時回復 8 點魔力。', mana: 8 },
    basic: { name: '奧術飛彈', type: 'projectile', dmg: 26, speed: 460, radius: 14, lifetime: 1.6, knockback: 60, cd: 0.6, color: '#7aa2ff', vfx: 'mage_fireball' },
    skill1: { name: '烈焰吐息', type: 'projectile', dmg: 18, speed: 540, radius: 13, lifetime: 0.45, count: 5, spread: 0.32, knockback: 40, manaCost: 45, cd: 6, color: '#ff9f43', effect: { kind: 'burn', duration: 2, tick: 0.5, dmg: 8 }, freezeBonus: 1.6, vfx: 'mage_flamebreath' },
    skill2: { name: '寒冰矛', type: 'projectile', dmg: 55, speed: 780, radius: 12, lifetime: 0.7, pierce: true, knockback: 50, manaCost: 45, cd: 8, color: '#74e0ff', effect: { kind: 'chill', stacks: 4, duration: 3, max: 4, freezeDur: 4 }, vfx: 'mage_iceshard' },
    ultimate: { name: '天降流星', type: 'zone', range: 150, radius: 140, dmg: 420, lifetime: 0.4, tick: 0.4, delay: 0.8, effect: { kind: 'burn', duration: 3, tick: 0.5, dmg: 14 }, cd: 11, color: '#ff5a3c', vfx: 'mage_ultimate' },
  },
  {
    id: 2, name: '刺客', color: '#9b59b6', shape: 'triangle', sprite: generateTextureSprite(2, '#9b59b6'),
    maxHp: 190, maxMana: 70, speed: 240,
    desc: '單體爆發突進手。影襲標記目標、印記引爆灌出致命一擊，得手後隱身重置。需隊友控場開路，專點脆皮核心；被抓住就脆。',
    role: '突進 · 單體爆發',
    synergy: '靠隊友控制(戰士暈/坦克定身)開路，瞬間刪除脆皮核心(法師/弓箭手/治療)。',
    talent: { id: 'lethal', name: '致命一擊', desc: '從隱身狀態或敵人背後攻擊，造成 +50% 傷害。', bonus: 0.5, arc: 1.2 },
    basic: { name: '快刀', type: 'melee', dmg: 20, range: 95, arc: 1.45, knockback: 80, cd: 0.34, color: '#c39bd3', vfx: 'assassin_slash' },
    skill1: { name: '影襲', type: 'blink', range: 260, dmg: 50, hitRadius: 95, knockback: 120, effect: { kind: 'mark', factor: 0.25, duration: 4 }, manaCost: 25, cd: 7, color: '#c39bd3', vfx: 'assassin_blink', self: { effect: { kind: 'invis', duration: 1.2, speed: 1.3 } } },
    skill2: { name: '印記引爆', type: 'melee', dmg: 70, range: 120, arc: 2.2, knockback: 160, detonate: { mult: 2.0 }, manaCost: 35, cd: 9, color: '#e056fd', vfx: 'assassin_backstab', self: { effects: [{ kind: 'lifesteal', duration: 4, factor: 0.4 }] } },
    ultimate: { name: '虛空換影', type: 'multiblink', count: 4, dmg: 80, knockback: 150, cd: 11, color: '#e056fd', vfx: 'assassin_ultimate', self: { heal: 70, effects: [{ kind: 'invis', duration: 2.5, speed: 1.4 }, { kind: 'lifesteal', duration: 6, factor: 0.5 }] } },
  },
  {
    id: 3, name: '坦克', color: '#7f8c8d', shape: 'square', sprite: generateTextureSprite(3, '#7f8c8d'),
    maxHp: 460, maxMana: 70, speed: 125,
    desc: '前排保護與擾亂堡壘。守護壁壘分享護盾、巨力擒抱聚怪定身，大招橫掃震開敵陣並為全隊罩上減傷護罩。傷害極低，價值在開團與保護。',
    role: '前排 · 保護/擾亂',
    synergy: '頂級前排，分享護盾與減傷光環；啟用突進陣容、保護後排 carry。',
    talent: { id: 'bulwark', name: '鋼鐵壁壘', desc: '永久減免 12% 所受傷害。', dr: 0.12 },
    basic: { name: '重拳', type: 'melee', dmg: 18, range: 115, arc: 1.55, knockback: 280, cd: 0.62, color: '#aab7b8', vfx: 'tank_punch' },
    skill1: { name: '守護壁壘', type: 'buff', shield: 260, cleanse: true, duration: 8, effect: { kind: 'reflect', duration: 8, factor: 0.35 }, manaCost: 30, cd: 11, color: '#dfe6e9', vfx: 'tank_shield', ally: { radius: 280, shield: 140, cleanse: true } },
    skill2: { name: '巨力擒抱', type: 'zone', range: 0, radius: 200, dmg: 30, lifetime: 1.0, tick: 0.5, pull: 340, effect: { kind: 'root', duration: 1.0 }, manaCost: 40, cd: 12, color: '#a0744a', vfx: 'tank_quake' },
    ultimate: { name: '大地崩裂', type: 'zone', range: 60, radius: 160, dmg: 90, lifetime: 1.4, tick: 0.2, moving: 480, knockback: 460, effect: { kind: 'stun', duration: 0.6 }, cd: 12, color: '#cfd8dc', vfx: 'tank_ultimate', ally: { radius: 320, shield: 120, effect: { kind: 'protect', duration: 6, factor: 0.25 } } },
  },
  {
    id: 4, name: '弓箭手', color: '#27ae60', shape: 'circle', sprite: generateTextureSprite(4, '#27ae60'),
    maxHp: 220, maxMana: 80, speed: 188,
    desc: '持續輸出的遠程 carry，全為直線箭術、不再自動追蹤。越遠越痛、貫穿箭洞穿一線、寄生箭流血剋逃，大招緊密箭幕朝正面傾瀉。需前排掩護走位。',
    role: '後排 · 持續輸出',
    synergy: '需前排(坦克/戰士)掩護拉開距離；越遠越痛，靠隊友 peel 發揮最大火力。',
    talent: { id: 'deadeye', name: '致命瞄準', desc: '對越遠的敵人傷害越高（最遠 +50%）。', bonus: 0.5, range: 520 },
    basic: { name: '射箭', type: 'projectile', dmg: 22, speed: 620, radius: 14, lifetime: 1.4, knockback: 70, cd: 0.5, color: '#2ecc71', vfx: 'archer_arrow' },
    skill1: { name: '貫穿箭', type: 'projectile', dmg: 60, speed: 920, radius: 14, lifetime: 0.9, pierce: true, knockback: 90, manaCost: 25, cd: 6, chargeMax: 5, color: '#7bed9f', vfx: 'archer_arrow_charged' },
    skill2: { name: '寄生箭', type: 'projectile', dmg: 26, speed: 560, radius: 8, lifetime: 2.0, knockback: 40, manaCost: 30, cd: 9, color: '#1abc9c', effect: { kind: 'bleed', duration: 4, tick: 0.5, dmg: 11, moveMult: 2.2 }, vfx: 'archer_parasite' },
    ultimate: { name: '萬箭齊發', type: 'projectile', dmg: 22, speed: 700, radius: 14, lifetime: 1.0, count: 8, spread: 0.12, knockback: 40, cd: 9, color: '#7bed9f', vfx: 'archer_ultimate' },
  },
  {
    id: 5, name: '治療師', color: '#ecf0f1', shape: 'circle', sprite: generateTextureSprite(5, '#ecf0f1'),
    maxHp: 200, maxMana: 140, speed: 170,
    desc: '團隊續航核心。治癒之觸為全隊回血淨化、聖光環跟身治療並灼傷踏入的敵人，大招生命匯流逆轉團戰。單打靠天賦自療與風箏苟活、輸出極低。',
    role: '支援 · 團隊核心',
    synergy: '萬用支援，搭配任何 carry/突進延長續航；雙治療陣容無輸出、難收尾。',
    talent: { id: 'lifebloom', name: '生生不息', desc: '持續自動回復生命。', regen: 7 },
    basic: { name: '聖光彈', type: 'projectile', dmg: 14, speed: 420, radius: 12, lifetime: 1.2, knockback: 60, cd: 0.6, color: '#f1c40f', vfx: 'healer_holybolt' },
    skill1: { name: '治癒之觸', type: 'buff', manaCost: 45, cd: 7, color: '#2ecc71', vfx: 'healer_cleanse', ally: { radius: 400, heal: 220, cleanse: true } },
    skill2: { name: '神聖光環', type: 'zone', range: 0, radius: 150, dmg: 8, lifetime: 6, tick: 0.5, follow: true, allyHeal: 14, effect: { kind: 'burn', duration: 2, tick: 0.5, dmg: 8 }, manaCost: 40, cd: 11, color: '#55efc4', vfx: 'healer_aura', self: { effect: { kind: 'haste', duration: 6, factor: 1.2 } } },
    ultimate: { name: '生命匯流', type: 'zone', range: 0, radius: 280, dmg: 30, lifetime: 1.6, tick: 0.4, knockback: 90, cd: 12, color: '#aaffcc', vfx: 'healer_ultimate', ally: { radius: 280, heal: 250, shield: 250, cleanse: true, effect: { kind: 'haste', duration: 6, factor: 1.3 } } },
  },
  {
    id: 6, name: '狂戰士', color: '#922b21', shape: 'square', sprite: generateTextureSprite(6, '#922b21'),
    maxHp: 290, maxMana: 50, speed: 152,
    desc: '殘血滾雪球的處決者。躍斬入場撕裂流血、血怒爆走自損續戰，大招血祭對殘敵直接斬殺。高風險高回報，靠治療補上自損的血量。',
    role: '突進 · 處決鬥士',
    synergy: '配治療師補上自損與血怒的血量；殘血越強，剋高血肉盾(坦克/戰士)。',
    talent: { id: 'bloodlust', name: '嗜血狂暴', desc: '血量越低，攻擊速度與吸血量越高。', haste: 0.6, lifesteal: 0.25 },
    basic: { name: '雙斧', type: 'melee', dmg: 22, range: 110, arc: 1.7, knockback: 130, cd: 0.46, lowHpBonus: true, color: '#cd6155', vfx: 'berserker_axes' },
    skill1: { name: '嗜血躍斬', type: 'leap', range: 270, dur: 0.45, dmg: 80, radius: 130, knockback: 200, effect: { kind: 'bleed', duration: 4, tick: 0.5, dmg: 12, moveMult: 2.2 }, manaCost: 20, cd: 7, color: '#ec7063', vfx: 'berserker_leap' },
    skill2: { name: '血怒', type: 'buff', hpCost: 25, heal: 40, effect: { kind: 'rage', duration: 8, speed: 1.4, dmg: 1.5 }, duration: 8, cd: 10, color: '#e74c3c', vfx: 'berserker_rage', self: { effects: [{ kind: 'lifesteal', duration: 8, factor: 0.35 }] } },
    ultimate: { name: '血祭處決', type: 'dash', impulse: 980, dmg: 90, range: 200, arc: 7, knockback: 280, execute: { threshold: 0.25, mult: 3 }, cd: 11, color: '#ff3b2f', vfx: 'berserker_ultimate', self: { heal: 120, effects: [{ kind: 'rage', duration: 10, speed: 1.7, dmg: 1.7 }, { kind: 'lifesteal', duration: 10, factor: 0.5 }] } },
  },
  {
    id: 7, name: '忍者', color: '#2c3e50', shape: 'triangle', sprite: generateTextureSprite(7, '#2c3e50'),
    maxHp: 200, maxMana: 90, speed: 235,
    desc: '高機動的控制側翼。影縛符遠程定身、影襲瞬移突進並落下煙幕緩速，大招煙影亂舞化身環身刃絞殺敵群。專剋被控制的目標——價值在接控與絞殺，而非隱身偷襲。',
    role: '機動 · 控制/絞殺',
    synergy: '遠程定身為隊友接控；對被控(暈/縛/緩)的敵人傷害暴增，與任何控場隊友(戰士/坦克/元素)完美銜接。',
    talent: { id: 'shadowstrike', name: '影殺', desc: '對被控制(暈眩/定身/緩速/凍結)的敵人造成 +35% 傷害。', bonus: 0.35 },
    basic: { name: '飛鏢', type: 'projectile', dmg: 16, speed: 640, radius: 9, lifetime: 1.0, knockback: 40, cd: 0.4, color: '#95a5a6', vfx: 'ninja_shuriken' },
    skill1: { name: '影縛符', type: 'projectile', dmg: 30, speed: 620, radius: 11, lifetime: 0.8, knockback: 30, manaCost: 25, cd: 8, color: '#636e72', effect: { kind: 'root', duration: 1.4 }, vfx: 'ninja_bind' },
    skill2: { name: '影襲瞬移', type: 'blink', range: 320, dmg: 60, hitRadius: 95, knockback: 120, manaCost: 30, cd: 6, color: '#636e72', vfx: 'ninja_shadowblink', leaveZone: { radius: 120, dmg: 10, lifetime: 2.4, tick: 0.5, effect: { kind: 'slow', duration: 1.2, factor: 0.55 }, color: '#5a6472', vfx: 'ninja_smoke' }, self: { effect: { kind: 'haste', duration: 1.4, factor: 1.35 } } },
    ultimate: { name: '煙影亂舞', type: 'zone', range: 0, radius: 175, dmg: 42, lifetime: 2.4, tick: 0.3, follow: true, effect: { kind: 'slow', duration: 0.6, factor: 0.55 }, cd: 10, color: '#b0bec5', vfx: 'ninja_ultimate', self: { effect: { kind: 'haste', duration: 2.5, factor: 1.4 } } },
  },
  {
    id: 8, name: '元素使', color: '#e67e22', shape: 'circle', sprite: generateTextureSprite(8, '#e67e22'),
    maxHp: 220, maxMana: 150, speed: 160,
    desc: '封鎖地形的持續法師。推進火牆封路、寒霜足跡留下凍徑風箏，大招隕石風暴覆蓋大片區域持續灼燒。不擅爆發、極耗魔，靠擊退類隊友把敵人逼進火海。',
    role: '控制 · 區域封鎖',
    synergy: '配擊退/控場隊友(戰士/坦克)把敵人逼進火海與凍徑、鎖死戰場。',
    talent: { id: 'pyromancy', name: '烈焰精通', desc: '自身造成的燃燒傷害更高、持續更久。', burnDmg: 1.6, burnDur: 1.4 },
    basic: { name: '火花', type: 'melee', dmg: 14, range: 135, arc: 1.35, knockback: 40, cd: 0.4, color: '#f39c12', effect: { kind: 'burn', duration: 2, tick: 0.5, dmg: 5 }, vfx: 'elem_spark' },
    skill1: { name: '烈焰洪流', type: 'zone', range: 60, radius: 110, dmg: 22, lifetime: 2.6, tick: 0.4, moving: 320, effect: { kind: 'burn', duration: 2, tick: 0.5, dmg: 8 }, manaCost: 40, cd: 7, color: '#e74c3c', vfx: 'elem_firezone' },
    skill2: { name: '寒霜足跡', type: 'buff', duration: 3, manaCost: 40, cd: 9, color: '#74e0ff', vfx: 'elem_frost', effect: { kind: 'haste', duration: 3, factor: 1.2 }, trail: { duration: 3, spacing: 44, zone: { radius: 90, dmg: 14, lifetime: 1.6, tick: 0.5, effect: { kind: 'chill', stacks: 1, duration: 2, max: 4, freezeDur: 1.0 }, color: '#9fe8ff', vfx: 'elem_frost' } } },
    ultimate: { name: '隕石風暴', type: 'zone', range: 150, radius: 130, dmg: 55, lifetime: 0.4, tick: 0.4, delay: 0.8, count: 7, scatter: 220, stagger: 0.14, effect: { kind: 'burn', duration: 3, tick: 0.5, dmg: 14 }, cd: 11, color: '#ff5a1f', vfx: 'elem_ultimate' },
  },
  {
    id: 9, name: '格鬥家', color: '#f1c40f', shape: 'circle', sprite: generateTextureSprite(9, '#f1c40f'),
    maxHp: 260, maxMana: 70, speed: 196,
    desc: '自給自足的連段決鬥者。連環拳累積氣勢、上勾拳擊飛收尾、招架反擊彈回傷害，大招真·昇龍霸一記定身重擊。最不依賴隊友的萬用 flex。',
    role: '近戰 · 連段決鬥',
    synergy: '自給自足的 flex，最不依賴隊友；隊伍缺前排/補位時的萬用選擇。',
    talent: { id: 'momentum', name: '連擊氣勢', desc: '短時間內連續命中，每層 +10% 傷害（最多 5 層）。', maxStacks: 5, perStack: 0.1, window: 2.2 },
    basic: { name: '連環拳', type: 'melee', dmg: 16, range: 95, arc: 1.55, knockback: 100, cd: 0.3, color: '#f7dc6f', vfx: 'fighter_combo' },
    skill1: { name: '上勾拳', type: 'melee', dmg: 80, range: 110, arc: 1.35, knockback: 520, manaCost: 25, cd: 6, color: '#f9e79f', vfx: 'fighter_uppercut' },
    skill2: { name: '招架反擊', type: 'buff', shield: 200, cleanse: true, effect: { kind: 'reflect', duration: 3, factor: 0.8 }, duration: 3, manaCost: 30, cd: 9, color: '#f4d03f', vfx: 'fighter_counter' },
    ultimate: { name: '真·昇龍霸', type: 'dash', impulse: 900, dmg: 200, range: 160, arc: 1.85, knockback: 700, effect: { kind: 'stun', duration: 1.0 }, cd: 11, color: '#ffe27a', vfx: 'fighter_ultimate', self: { shield: 100, duration: 4 } },
  },
  {
    id: 10, name: '聖騎士', color: '#daa520', shape: 'square', sprite: generateTextureSprite(10, '#daa520'),
    maxHp: 380, maxMana: 80, speed: 138,
    desc: '以信仰反擊的前排坦克。聖光懲戒讓攻擊你的敵人自食惡果、神聖衝鋒暈眩開團、制裁之光淨化全隊並懲擊敵群，大招天堂審判降下光柱持續灼燒並庇佑友軍。傷害不高，價值在懲罰與守護。',
    role: '前排 · 反擊/淨化',
    synergy: '頂級反擊前排，懲罰聚火、淨化隊友 debuff；配脆皮 carry 站樁輸出。',
    talent: { id: 'retribution', name: '聖光懲戒', desc: '受到傷害時，以受傷量 15% 回擊攻擊者。', factor: 0.15 },
    basic: { name: '聖槌', type: 'melee', dmg: 20, range: 130, arc: 1.4, knockback: 160, cd: 0.55, color: '#ffe08a', effect: { kind: 'slow', duration: 0.8, factor: 0.7 }, vfx: 'paladin_smite' },
    skill1: { name: '神聖衝鋒', type: 'charge', speed: 920, range: 300, dmg: 55, hitRadius: 52, knockback: 220, stopOnHit: true, effect: { kind: 'stun', duration: 0.8 }, manaCost: 25, cd: 9, color: '#ffd700', vfx: 'paladin_charge', self: { shield: 160, duration: 5 } },
    skill2: { name: '制裁之光', type: 'zone', range: 0, radius: 170, dmg: 45, lifetime: 0.5, tick: 0.5, knockback: 120, manaCost: 35, cd: 10, color: '#fff2b0', vfx: 'paladin_sanction', ally: { radius: 200, shield: 120, cleanse: true } },
    ultimate: { name: '天堂審判', type: 'zone', range: 120, radius: 150, dmg: 60, lifetime: 3.2, tick: 0.5, delay: 0.4, effect: { kind: 'slow', duration: 1.0, factor: 0.6 }, allyHeal: 16, cd: 12, color: '#fff7d0', vfx: 'paladin_ultimate', self: { shield: 280, cleanse: true, duration: 6, effect: { kind: 'reflect', duration: 6, factor: 0.4 } }, ally: { radius: 320, cleanse: true } },
  },
  {
    id: 11, name: '咒術師', color: '#8e44ad', shape: 'triangle', sprite: generateTextureSprite(11, '#8e44ad'),
    maxHp: 210, maxMana: 130, speed: 165,
    desc: '以詛咒削弱敵軍的控制型輔助。詛咒彈使目標易傷、噩夢束縛定身緩速、衰弱領域同時減速敵人並削弱其輸出，大招萬咒齊發鎖死整片戰場。傷害普通，價值在削弱與控場。',
    role: '支援 · 控制/削弱',
    synergy: '控制型核心：定身、易傷、削弱敵人輸出，替隊友 carry 創造輸出與生存空間。',
    talent: { id: 'plague', name: '詛咒擴散', desc: '帶有易傷詛咒的敵人死亡時，詛咒傳染給周圍 200 範圍內的其他敵人。', radius: 200 },
    basic: { name: '詛咒彈', type: 'projectile', dmg: 14, speed: 520, radius: 12, lifetime: 1.4, knockback: 30, cd: 0.55, color: '#b86fd6', effect: { kind: 'weaken', duration: 3, factor: 0.15 }, vfx: 'hexer_bolt' },
    skill1: { name: '噩夢束縛', type: 'projectile', dmg: 24, speed: 560, radius: 12, lifetime: 0.9, knockback: 30, manaCost: 25, cd: 8, color: '#6c3483', effect: { kind: 'root', duration: 1.5 }, vfx: 'hexer_bind' },
    skill2: { name: '衰弱領域', type: 'zone', range: 0, radius: 175, dmg: 10, lifetime: 5, tick: 0.5, follow: true, effects: [{ kind: 'slow', duration: 0.7, factor: 0.6 }, { kind: 'dmg_reduce', duration: 0.7, factor: 0.25 }], allyEffect: { kind: 'haste', duration: 0.7, factor: 1.25 }, manaCost: 40, cd: 11, color: '#9b59b6', vfx: 'hexer_field' },
    ultimate: { name: '萬咒齊發', type: 'zone', range: 0, radius: 240, dmg: 40, lifetime: 0.4, tick: 0.4, effects: [{ kind: 'root', duration: 1.6 }, { kind: 'weaken', duration: 3, factor: 0.3 }, { kind: 'slow', duration: 3, factor: 0.5 }], cd: 12, color: '#bb6bd9', vfx: 'hexer_ultimate', ally: { radius: 320, shield: 150, cleanse: true } },
  },
  {
    id: 12, name: '吟遊詩人', color: '#e91e63', shape: 'circle', sprite: generateTextureSprite(12, '#e91e63'),
    maxHp: 190, maxMana: 120, speed: 182,
    desc: '以樂曲增幅全隊的進攻型輔助。激昂戰歌賜予友軍增傷與狂熱、不諧和音貫穿暈擊，大招英雄頌歌讓全隊爆發。不提供治療，價值在放大隊友的火力。',
    role: '支援 · 增傷/加速',
    synergy: '增傷型核心：放大隊友 carry 的輸出；人越多越強，配多 carry 陣容滾雪球。',
    talent: { id: 'warsong', name: '戰歌共鳴', desc: '周圍 250 內每多一名友方，自身與友方額外 +5% 傷害（最多 +15%）。', radius: 250, perAlly: 0.05, maxAllies: 3 },
    basic: { name: '音波衝擊', type: 'projectile', dmg: 18, speed: 600, radius: 12, lifetime: 1.3, knockback: 60, cd: 0.5, color: '#ff6fa5', vfx: 'bard_note' },
    skill1: { name: '激昂戰歌', type: 'buff', manaCost: 30, cd: 9, color: '#ff8fb8', vfx: 'bard_anthem', ally: { radius: 300, effect: { kind: 'rage', duration: 6, speed: 1.15, dmg: 1.3 } } },
    skill2: { name: '不諧和音', type: 'projectile', dmg: 40, speed: 720, radius: 13, lifetime: 0.9, pierce: true, knockback: 80, manaCost: 30, cd: 8, color: '#ec407a', effect: { kind: 'stun', duration: 0.5 }, vfx: 'bard_discord' },
    ultimate: { name: '英雄頌歌', type: 'zone', range: 0, radius: 180, dmg: 30, lifetime: 0.6, tick: 0.6, knockback: 60, effect: { kind: 'slow', duration: 1.5, factor: 0.6 }, cd: 12, color: '#ff4081', vfx: 'bard_ultimate', ally: { radius: 340, shield: 160, cleanse: true, effects: [{ kind: 'rage', duration: 7, speed: 1.2, dmg: 1.4 }, { kind: 'haste', duration: 7, factor: 1.3 }] } },
  },
  {
    id: 13, name: '武士', color: '#c0392b', shape: 'triangle', sprite: generateTextureSprite(13, '#c0392b'),
    maxHp: 240, maxMana: 60, speed: 192,
    desc: '蓄勢一擊的精準近戰。居合之道讓蓄力後的出刀致命、居合·閃高速突斬、刀背擋格擋反擊，大招一閃·千刀流連斬群敵。講究的是一擊斃命，與格鬥家的連段、狂戰士的狂暴截然不同。',
    role: '近戰 · 蓄力一擊',
    synergy: '高爆發決鬥者，配控場隊友(忍者/坦克)定住目標，居合一刀致命。',
    talent: { id: 'iaido', name: '居合之道', desc: '持續 2 秒未攻擊後，下一次攻擊 +80% 傷害並短暫提升移速。', delay: 2, bonus: 0.8 },
    basic: { name: '拔刀斬', type: 'melee', dmg: 30, range: 150, arc: 1.0, knockback: 160, cd: 0.7, color: '#ff6b5b', vfx: 'samurai_draw' },
    skill1: { name: '居合·閃', type: 'dash', impulse: 880, dmg: 70, range: 180, arc: 1.1, knockback: 180, effect: { kind: 'bleed', duration: 3, tick: 0.5, dmg: 12, moveMult: 2.2 }, manaCost: 20, cd: 6, color: '#ff8a5b', vfx: 'samurai_iai' },
    skill2: { name: '刀背擋', type: 'buff', shield: 200, cleanse: true, effect: { kind: 'reflect', duration: 1.5, factor: 0.7 }, duration: 1.5, manaCost: 25, cd: 9, color: '#e74c3c', vfx: 'samurai_guard', noIaiReset: true },
    ultimate: { name: '一閃·千刀流', type: 'multiblink', count: 3, dmg: 95, knockback: 160, effect: { kind: 'bleed', duration: 4, tick: 0.5, dmg: 16, moveMult: 2.2 }, cd: 11, color: '#ff3b2f', vfx: 'samurai_ultimate', self: { shield: 80, duration: 3 } },
  },
  {
    id: 14, name: '槍手', color: '#d4a017', shape: 'circle', sprite: generateTextureSprite(14, '#d4a017'),
    maxHp: 200, maxMana: 70, speed: 210,
    desc: '高機動的雙槍射手。火力壓制讓持續點射越打越痛、翻滾閃避位移強化、燃燒彈爆裂灼燒，大招彈幕風暴近距傾瀉。與弓箭手的定點遠射相反——越近越強、快節奏、多發。',
    role: '後排 · 機動跑打',
    synergy: '中近距跑打 carry，靠走位自保；持續壓制單一目標滾雪球，配前排掩護。',
    talent: { id: 'suppress', name: '火力壓制', desc: '連續命中同一目標，每次命中 +8% 傷害（最多 5 層），切換目標重置。', perStack: 0.08, maxStacks: 5 },
    basic: { name: '雙槍射擊', type: 'projectile', dmg: 11, speed: 720, radius: 9, lifetime: 1.0, count: 2, spread: 0.1, knockback: 20, cd: 0.45, color: '#f6c544', vfx: 'gunner_shot' },
    skill1: { name: '翻滾閃避', type: 'blink', range: 180, knockback: 0, manaCost: 20, cd: 5, color: '#ffd76a', vfx: 'gunner_roll', self: { effect: { kind: 'rage', duration: 1.2, speed: 1.2, dmg: 1.4 } } },
    skill2: { name: '燃燒彈', type: 'projectile', dmg: 55, speed: 640, radius: 13, lifetime: 1.0, knockback: 80, manaCost: 30, cd: 8, color: '#ff7a18', effect: { kind: 'burn', duration: 3, tick: 0.5, dmg: 12 }, leaveZone: { radius: 90, dmg: 14, lifetime: 1.6, tick: 0.5, effect: { kind: 'burn', duration: 2, tick: 0.5, dmg: 8 }, color: '#ff6a1a', vfx: 'gunner_incendiary' }, vfx: 'gunner_incendiary' },
    ultimate: { name: '彈幕風暴', type: 'projectile', dmg: 26, speed: 760, radius: 11, lifetime: 0.8, count: 12, spread: 0.7, knockback: 70, cd: 10, color: '#ffd76a', vfx: 'gunner_ultimate' },
  },
  {
    id: 15, name: '召喚師', color: '#16a085', shape: 'circle', sprite: generateTextureSprite(15, '#16a085'),
    maxHp: 210, maxMana: 130, speed: 155,
    desc: '操控召喚物建立數量優勢的特殊角色。召喚共鏈讓戰靈護主回血、召喚戰靈持續施壓、靈魂爆破犧牲召喚物炸開敵群，大招大召喚術一次喚出強化戰靈。自身戰力低，價值在召喚物。',
    role: '特殊 · 召喚操控',
    synergy: '以召喚物製造混亂與數量壓制；戰靈吸引火力、護主回血，配輔助延命滾雪球。',
    talent: { id: 'summonbond', name: '召喚共鏈', desc: '每隻存活召喚物給自身 −10% 受傷（最多 −30%），召喚物命中敵人回復自身 5 HP。', dr: 0.1, maxStacks: 3, heal: 5 },
    basic: { name: '靈魂碎片', type: 'projectile', dmg: 4, speed: 420, radius: 11, lifetime: 1, knockback: 10, homing: 2.5, cd: 1, color: '#48d8b8', vfx: 'summoner_shard' },
    skill1: { name: '召喚戰靈', type: 'summon', count: 1, cap: 3, minionCharId: 9, minionHp: 160, minionScale: 0.66, minionLife: 16, manaCost: 30, cd: 6, color: '#1abc9c', vfx: 'summoner_summon' },
    skill2: { name: '靈魂爆破', type: 'summon', detonate: true, radius: 130, dmg: 70, effect: { kind: 'stun', duration: 0.6 }, manaCost: 35, cd: 10, color: '#16a085', vfx: 'summoner_burst' },
    ultimate: { name: '大召喚術', type: 'summon', count: 3, cap: 6, minionCharId: 6, minionHp: 240, minionScale: 0.74, minionLife: 20, cd: 12, color: '#2ee6c0', vfx: 'summoner_ultimate', self: { shield: 160, duration: 6, effect: { kind: 'haste', duration: 6, factor: 1.3 } } },
  },
  {
    id: 16, name: '死靈法師', color: '#2d3436', shape: 'triangle', sprite: generateTextureSprite(16, '#2d3436'),
    maxHp: 210, maxMana: 110, speed: 155,
    desc: '以血換取強力 DoT 與汲取的暗系法師。亡者之觸讓持續傷害回復自身、生命汲取鎖血、腐蝕爆發釋放毒霧，大招亡靈大軍召喚亡兵並大範圍腐蝕。與法師的瞬間爆發不同——你是持續壓血的死神。',
    role: '特殊 · 持續壓血',
    synergy: '持續 DoT 與汲取壓制肉盾，靠流血/燃燒回血續戰；配控場把敵人困在毒霧裡。',
    talent: { id: 'undeath', name: '亡者之觸', desc: '你造成的持續傷害(燃燒/流血)每跳回復自身等量 15% 的生命。', factor: 0.15 },
    basic: { name: '死亡射線', type: 'projectile', dmg: 12, speed: 560, radius: 12, lifetime: 1.3, knockback: 30, cd: 0.5, color: '#6ab04c', effect: { kind: 'bleed', duration: 3, tick: 0.5, dmg: 9, moveMult: 1.0 }, vfx: 'necro_ray' },
    skill1: { name: '生命汲取', type: 'channel', duration: 3, tick: 0.4, range: 320, dmg: 26, heal: 5, manaCost: 50, cd: 8, color: '#7bed9f', vfx: 'necro_drain' },
    skill2: { name: '腐蝕爆發', type: 'zone', range: 130, radius: 130, dmg: 18, lifetime: 4, tick: 0.5, effect: { kind: 'bleed', duration: 2, tick: 0.5, dmg: 8, moveMult: 1.0 }, manaCost: 40, cd: 9, color: '#27ae60', vfx: 'necro_corrupt' },
    ultimate: { name: '亡靈大軍', type: 'summon', count: 2, cap: 4, minionCharId: 2, minionHp: 150, minionScale: 0.64, minionLife: 16, zone: { radius: 220, dmg: 20, lifetime: 5, tick: 0.5, effect: { kind: 'bleed', duration: 3, tick: 0.5, dmg: 10, moveMult: 1.0 }, color: '#1e8449', vfx: 'necro_ultimate' }, cd: 12, color: '#2ecc71', vfx: 'necro_ultimate', self: { shield: 150, duration: 6, effects: [{ kind: 'lifesteal', duration: 8, factor: 0.1 }] } },
  },
  {
    id: 17, name: '時空術士', color: '#00bcd4', shape: 'circle', sprite: generateTextureSprite(17, '#00bcd4'),
    maxHp: 180, maxMana: 140, speed: 175,
    desc: '操控時空節奏的高技巧法師。時間稜鏡讓施法後快速走位、時間加速增幅友軍、時間停滯凍結敵群，大招時空逆轉回溯自身的位置與血量並在原地引爆。脆皮但能扭轉戰局。',
    role: '特殊 · 戰場操控',
    synergy: '加速友軍、減速敵人、回溯自保；高上限操控型，配爆發 carry 把握時停窗口。',
    talent: { id: 'timeprism', name: '時間稜鏡', desc: '每次施放技能後獲得 1.5 秒加速（+25% 移速），便於施法後重新走位。', duration: 1.5, factor: 1.25 },
    basic: { name: '時空裂隙', type: 'projectile', dmg: 16, speed: 560, radius: 12, lifetime: 1.4, knockback: 30, cd: 0.55, color: '#4dd0e1', effect: { kind: 'slow', duration: 1.5, factor: 0.6 }, vfx: 'chrono_rift' },
    skill1: { name: '時間加速', type: 'buff', manaCost: 30, cd: 9, color: '#80deea', vfx: 'chrono_haste', ally: { radius: 300, effects: [{ kind: 'haste', duration: 5, factor: 1.4 }, { kind: 'rage', duration: 5, speed: 1.0, dmg: 1.2 }] } },
    skill2: { name: '時間停滯', type: 'zone', range: 130, radius: 140, dmg: 20, lifetime: 0.4, tick: 0.4, effects: [{ kind: 'stun', duration: 1.2 }, { kind: 'slow', duration: 2, factor: 0.5 }], manaCost: 40, cd: 11, color: '#00bcd4', vfx: 'chrono_stasis' },
    ultimate: { name: '時空逆轉', type: 'zone', range: 0, radius: 170, dmg: 60, lifetime: 0.4, tick: 0.4, knockback: 200, effect: { kind: 'stun', duration: 1.0 }, rewindSelf: { seconds: 3 }, cd: 12, color: '#26c6da', vfx: 'chrono_ultimate', ally: { radius: 320, shield: 180, cleanse: true } },
  },
];

export function getCharacter(id) {
  // id >= 100 → 闖關模式魔王資料 (沿用相同 schema，重用整條模型/HUD/VFX/傷害管線)
  if (id >= 100) { const b = getBoss(id); if (b) return b; }
  return CHARACTERS[id] || CHARACTERS[0];
}
