// 闖關模式 — 10 關魔王資料
//
// 魔王沿用與角色 (characters.js) 完全相同的資料 schema，因此可直接重用整條
// 模型 / HUD / VFX / SFX / 傷害 / 效果 管線。getCharacter() 對 id >= 100 會
// fallthrough 到這裡 (見 characters.js)。
//
// 每個魔王額外帶：
//   appearance  美術說明 (體型 / 視覺風格 / 起手預警) — 文件用途，部分欄位渲染器會讀
//   model       程序化建模參數 { bulk, weapon, robe?, scale, head, parts? }
//   ai          AI 腳本 id (bossAI.js 依此挑選每王行為)
//   baseHp      4 人基準血量 (spawnBoss 依實際存活玩家數縮放)
//   round       關卡編號 1..10
//   mechanic    特殊機制旗標 (simulation/bossMode 依此啟用)
//   abilities   basic/skill1/skill2/ultimate 沿用 characters.js 的 action type
//
// 動作額外欄位 (魔王專用，AI 讀取)：
//   windup      起手預警秒數 (AI 先播放 telegraph 再命中；越簡單的王越長)
//   telegraph   預警樣式 'arc' | 'line' | 'circle' | 'self' (渲染提示用)
//   range/aimRange  AI 進入該技能的距離門檻
//
// 數值為 v1 起點，需真人多分頁連線實測調校 (與角色平衡備忘相同立場)。

// ---- 通用大招/技能效果片段 ----
const BURN = (dmg, dur = 3) => ({ kind: 'burn', duration: dur, tick: 0.5, dmg });
const STUN = (dur) => ({ kind: 'stun', duration: dur });
const SLOW = (dur, factor = 0.5) => ({ kind: 'slow', duration: dur, factor });
const ROOT = (dur) => ({ kind: 'root', duration: dur });
const CHILL = (stacks, dur = 3) => ({ kind: 'chill', stacks, duration: dur, max: 4, freezeDur: 2.0 });

export const BOSSES = [
  // ============================================================ R1 巨木傀儡
  {
    id: 100, round: 1, name: '巨木傀儡', subtitle: '森林守護者',
    color: '#6b8e23', shape: 'square', maxHp: 3500, maxMana: 999, speed: 110,
    baseHp: 3500,
    appearance: {
      size: '巨大 (約玩家 2.2 倍)',
      style: '木石魔像，覆滿樹皮與苔蘚的軀幹，胸口嵌一顆持續發光的綠色生命核心，雙臂是粗壯的樹幹。配色：樹皮褐 #6b4a2b + 苔綠 #6b8e23 + 核心翠光。',
      weapon: '雙樹幹臂 (無持械，以臂砸擊)',
      telegraph: '揮擊前樹幹臂發綠光並緩緩後拉、地面浮現弧形警示；旋掃前全身發光蓄力。動作整體緩慢、破綻大。',
    },
    model: { bulk: 5.0, weapon: 'sword', scale: 2.2, head: 'square', emissiveCore: '#9acd32' },
    ai: 'golem',
    mechanic: { backWeak: 0.5, aggroSwap: 3.0 }, // 背後受傷 +50%；每 3 秒換仇恨目標
    talent: { id: 'boss_backweak', name: '遲鈍核心', desc: '背後受到的傷害提高 50%。', backWeak: 0.5 },
    // 教學提示 (渲染端讀取)：hint=開場橫幅戰術一行；tags=血條旁常駐機制晶片
    hint: '繞到背後攻擊，傷害 +50%！',
    tags: [
      { icon: '🪵', text: '背後弱點 +50%' },
      { icon: '🎯', text: '仇恨每 3 秒跳' },
    ],
    hazardText: '⚠️ 快離開攻擊範圍！',
    hazardColor: '#e6b352', // 中性琥珀：R1 招式無屬性，用中性警示色 (不用毒綠)
    basic: { name: '橫掃巨臂', type: 'melee', dmg: 45, range: 130, arc: 1.5, knockback: 240, cd: 1.6, windup: 0.8, telegraph: 'arc', color: '#8fbf3f', vfx: 'boss_golem_sweep' },
    skill1: { name: '巨力砸地', type: 'zone', range: 120, radius: 130, dmg: 70, lifetime: 0.4, tick: 0.4, delay: 1.0, knockback: 200, effect: STUN(0.5), cd: 7, windup: 1.0, telegraph: 'circle', color: '#7a5a2b', vfx: 'boss_golem_slam' },
    skill2: { name: '纏根束縛', type: 'zone', range: 0, radius: 200, dmg: 24, lifetime: 1.2, tick: 0.5, pull: 200, effect: ROOT(1.2), cd: 11, windup: 0.7, telegraph: 'circle', color: '#4e7a2f', vfx: 'boss_golem_roots' },
    ultimate: { name: '森羅旋掃', type: 'zone', range: 0, radius: 200, dmg: 90, lifetime: 0.5, tick: 0.5, knockback: 360, effect: STUN(0.6), cd: 16, windup: 1.2, telegraph: 'circle', color: '#a6d749', vfx: 'boss_golem_ult' },
  },

  // ============================================================ R2 劇毒飛蜥
  {
    id: 101, round: 2, name: '劇毒飛蜥', subtitle: '沼澤潛伏者',
    color: '#7fbf3f', shape: 'triangle', maxHp: 4500, maxMana: 999, speed: 175,
    baseHp: 4500,
    appearance: {
      size: '等身偏大 (約玩家 1.8 倍)，低伏敏捷',
      style: '四足毒蜥，紫綠交雜的鱗甲、背脊滴落綠色毒液、口器外露毒牙。配色：毒綠 #7fbf3f + 暗紫 #6a3d9a + 螢光毒滴。',
      weapon: '毒牙利爪 + 毒液吐息',
      telegraph: '吐毒前口部鼓脹發綠光並噴氣、飛撲前後肢蹲伏冒紫煙。',
    },
    model: { bulk: 3.5, weapon: 'daggers', scale: 1.8, head: 'triangle', emissiveCore: '#aaff55' },
    ai: 'lizard',
    mechanic: { poisonFloor: true }, // 招式在地面留毒池
    // 教學提示 (渲染端讀取)：R2 機制是「地面毒沼」，重點在別久站、會中毒
    hint: '別踩地上的綠色毒沼 —— 會持續中毒掉血！',
    tags: [
      { icon: '☠️', text: '地面毒沼別久站' },
      { icon: '🧪', text: '攻擊附帶中毒' },
      { icon: '🦎', text: '高機動·會飛撲' },
    ],
    hazardText: '☠️ 中毒中！快離開毒沼',
    hazardColor: '#8ee03a', // 毒綠
    basic: { name: '毒爪', type: 'melee', dmg: 30, range: 80, arc: 1.1, knockback: 120, cd: 0.9, windup: 0.4, telegraph: 'arc', color: '#9acd32', effect: BURN(6, 2), vfx: 'boss_lizard_claw' },
    skill1: { name: '腐蝕毒吐', type: 'projectile', dmg: 22, speed: 460, radius: 16, lifetime: 1.1, count: 3, spread: 0.28, knockback: 40, cd: 6, windup: 0.6, telegraph: 'line', color: '#7fff00', effect: BURN(10, 3), leaveZone: { radius: 90, dmg: 16, lifetime: 4, tick: 0.5, effect: BURN(10, 2), color: '#5a8f2f', vfx: 'boss_lizard_pool' }, vfx: 'boss_lizard_spit' },
    skill2: { name: '毒沼飛撲', type: 'leap', range: 280, dur: 0.5, dmg: 60, radius: 120, knockback: 160, cd: 8, windup: 0.5, telegraph: 'circle', color: '#6a3d9a', effect: BURN(8, 2), leaveZone: { radius: 110, dmg: 18, lifetime: 5, tick: 0.5, effect: BURN(12, 2), color: '#4e7a2f', vfx: 'boss_lizard_pool' }, vfx: 'boss_lizard_pounce' },
    ultimate: { name: '瘴氣風暴', type: 'zone', range: 140, radius: 120, dmg: 30, lifetime: 5, tick: 0.5, delay: 0.8, count: 6, scatter: 260, stagger: 0.16, effect: BURN(14, 3), cd: 16, windup: 1.0, telegraph: 'circle', color: '#6abf2f', vfx: 'boss_lizard_ult' },
  },

  // ============================================================ R3 熔岩鐵衛
  {
    id: 102, round: 3, name: '熔岩鐵衛', subtitle: '烈焰重裝兵',
    color: '#c0392b', shape: 'square', maxHp: 5500, maxMana: 999, speed: 140,
    baseHp: 5500,
    appearance: {
      size: '巨大 (約玩家 2.2 倍)，厚重',
      style: '黑鐵全身重甲，甲縫間透出熔岩裂縫的橘紅光，左手巨盾、右手熔岩大劍。配色：玄鐵黑 #2b2b30 + 熔岩橘 #ff5a1f + 餘燼紅。',
      weapon: '熔岩巨劍 + 鐵塔盾',
      telegraph: '衝鋒前身體發紅後仰、腳下噴煙與火星、地面浮現直線瞄準指示；揮劍前劍刃熾紅。',
    },
    model: { bulk: 4.5, weapon: 'sword', scale: 2.2, head: 'square', emissiveCore: '#ff5a1f' },
    ai: 'juggernaut',
    mechanic: { frontArmor: 0.45, chargeWallStun: 2.2 }, // 正面前弧減傷 45%；衝鋒撞牆自暈 2.2s
    talent: { id: 'boss_frontarmor', name: '熔岩重甲', desc: '正面前方受到的傷害減免 45%，背後無防護。', frontArmor: 0.45, arc: 1.6 },
    // 教學提示：R3 機制是正面重甲(要打背後) + 衝鋒撞牆會自暈
    hint: '正面有厚甲擋傷 —— 繞到背後打！閃過衝鋒，牠撞牆會自己暈',
    tags: [
      { icon: '🛡️', text: '正面減傷·打背後' },
      { icon: '💥', text: '衝鋒撞牆會自暈' },
      { icon: '🔥', text: '攻擊附帶燃燒' },
    ],
    hazardText: '🔥 站在烈焰上！快離開',
    hazardColor: '#ff5a2a', // 熔岩紅
    basic: { name: '熔岩劈斬', type: 'melee', dmg: 50, range: 120, arc: 1.2, knockback: 200, cd: 1.4, windup: 0.7, telegraph: 'arc', color: '#ff7043', effect: BURN(8, 2), vfx: 'boss_juggernaut_slash' },
    skill1: { name: '烈焰衝鋒', type: 'charge', speed: 900, range: 520, dmg: 80, hitRadius: 70, knockback: 320, stopOnHit: true, effect: STUN(1.0), cd: 8, windup: 0.9, telegraph: 'line', color: '#ff5a1f', wallStun: 2.2, vfx: 'boss_juggernaut_charge' },
    skill2: { name: '震地烈焰', type: 'zone', range: 90, radius: 150, dmg: 40, lifetime: 2.4, tick: 0.5, delay: 0.8, moving: 0, effect: BURN(12, 3), cd: 10, windup: 0.8, telegraph: 'circle', color: '#e74c3c', vfx: 'boss_juggernaut_quake' },
    ultimate: { name: '熔岩噴發', type: 'zone', range: 130, radius: 120, dmg: 55, lifetime: 4, tick: 0.5, delay: 0.9, count: 7, scatter: 280, stagger: 0.12, effect: BURN(14, 3), cd: 16, windup: 1.0, telegraph: 'circle', color: '#ff5a1f', vfx: 'boss_juggernaut_ult' },
  },

  // ============================================================ R4 霜雪刺客
  {
    id: 103, round: 4, name: '霜雪刺客', subtitle: '冰原幻影',
    color: '#74e0ff', shape: 'triangle', maxHp: 5000, maxMana: 999, speed: 220,
    baseHp: 5000,
    appearance: {
      size: '等身 (約玩家 1.5 倍)，纖細靈巧',
      style: '半透明的淡藍冰晶刺客，身後拖曳霜霧殘影，雙手冰結匕首。配色：冰藍 #74e0ff + 霜白 #e0f8ff + 內透幽光。',
      weapon: '雙冰匕',
      telegraph: '真身出手前匕首更亮、霜煙較濃；分身更透明且閃爍。瞬移前原地爆出霜煙。',
    },
    model: { bulk: 2.5, weapon: 'daggers', scale: 1.5, head: 'triangle', emissiveCore: '#bfefff', translucent: true },
    ai: 'frost_assassin',
    mechanic: { clones: 3, swapTell: true }, // 召喚 3 個假身；真身可與分身換位 (有細微 tell)
    // 教學提示：R4 機制是分身騙人 (要認真身) + 冰凍
    hint: '牠會放分身騙你 —— 真身較「實」、分身半透明會閃，認準真身再打！',
    tags: [
      { icon: '👥', text: '會放 3 個假分身' },
      { icon: '🗡️', text: '真身較實·分身半透明' },
      { icon: '❄️', text: '攻擊會冰凍堆疊' },
    ],
    hazardText: '❄️ 站在冰域裡會被凍！快離開',
    hazardColor: '#74e0ff', // 冰藍
    basic: { name: '寒霜疾刺', type: 'melee', dmg: 34, range: 70, arc: 0.9, knockback: 90, cd: 0.7, windup: 0.25, telegraph: 'arc', color: '#9fe8ff', effect: CHILL(1), vfx: 'boss_frost_slash' },
    skill1: { name: '霜影突襲', type: 'blink', range: 280, dmg: 55, hitRadius: 95, knockback: 120, effect: CHILL(2), cd: 5, windup: 0.4, telegraph: 'self', color: '#74e0ff', vfx: 'boss_frost_blink' },
    skill2: { name: '鏡花幻影', type: 'summon_clones', count: 3, cd: 13, windup: 0.6, telegraph: 'self', color: '#bfefff', vfx: 'boss_frost_clones' },
    ultimate: { name: '絕對冰域', type: 'zone', range: 0, radius: 220, dmg: 30, lifetime: 2.0, tick: 0.5, follow: true, effect: CHILL(2), cd: 17, windup: 1.0, telegraph: 'circle', color: '#cdf6ff', vfx: 'boss_frost_ult' },
  },

  // ============================================================ R5 廢墟古代巨兵
  {
    id: 104, round: 5, name: '廢墟古代巨兵', subtitle: '機關核心',
    color: '#95a5a6', shape: 'square', maxHp: 6000, maxMana: 999, speed: 90,
    baseHp: 6000,
    appearance: {
      size: '極巨大 (約玩家 3 倍，全場最大)',
      style: '石與金屬構成的遠古守護巨像，覆滿苔蘚與廢墟碎石，胸口符文核心發藍光。左臂為藍光雷射砲、右臂為火星四濺的旋轉巨鋸。配色：石灰 #95a5a6 + 金屬銅 #b08d57 + 符文藍 #49d0ff。',
      weapon: '左臂雷射砲 (藍) + 右臂旋轉巨鋸 (橙火星)',
      telegraph: '雷射臂藍光由弱漸強並投出直線警示後發射；鋸臂火星旋轉提速後橫掃。核心踏地前微微下沉蓄力。',
    },
    model: {
      bulk: 7.0, weapon: 'none', scale: 3.0, head: 'square', emissiveCore: '#49d0ff',
      parts: [
        { id: 'arm_left', label: '雷射臂', side: 'left', color: '#49d0ff', hp: 2000 },
        { id: 'arm_right', label: '巨鋸臂', side: 'right', color: '#ff7043', hp: 2000 },
      ],
    },
    ai: 'ancient_titan',
    mechanic: {
      parts: [
        { id: 'arm_left', baseHp: 2000, disablesSlot: 'skill1', offset: { x: -70, y: 0 } },
        { id: 'arm_right', baseHp: 2000, disablesSlot: 'skill2', offset: { x: 70, y: 0 } },
      ],
      coreArmorUntilPartsDown: 0.6, // 雙臂未破時核心減傷 60%
    },
    // 教學提示：R5 機制是先破壞左右雙臂，核心才不再減傷
    hint: '先打掉牠左右兩隻手臂！雙臂沒破時，本體會減傷 60%',
    tags: [
      { icon: '🦾', text: '先破壞左右雙臂' },
      { icon: '🛡️', text: '雙臂未破·本體減傷 60%' },
      { icon: '⚡', text: '破臂後可關掉牠的招' },
    ],
    hazardText: '⚠️ 站在攻擊範圍裡！快閃開',
    hazardColor: '#ffa83a',
    basic: { name: '踏地震波', type: 'zone', range: 0, radius: 160, dmg: 36, lifetime: 0.4, tick: 0.4, knockback: 220, cd: 2.0, windup: 0.7, telegraph: 'circle', color: '#b0a99f', effect: STUN(0.4), vfx: 'boss_titan_stomp' },
    skill1: { name: '殲滅雷射', type: 'zone', range: 110, radius: 90, dmg: 50, lifetime: 1.6, tick: 0.3, delay: 1.0, moving: 200, requiresPart: 'arm_left', cd: 7, windup: 1.0, telegraph: 'line', color: '#49d0ff', vfx: 'boss_titan_laser' },
    skill2: { name: '旋轉巨鋸', type: 'zone', range: 100, radius: 150, dmg: 30, lifetime: 2.2, tick: 0.25, moving: 280, requiresPart: 'arm_right', cd: 8, windup: 0.8, telegraph: 'arc', color: '#ff7043', effect: BURN(6, 2), vfx: 'boss_titan_saw' },
    ultimate: { name: '核心過載', type: 'zone', range: 0, radius: 260, dmg: 70, lifetime: 0.6, tick: 0.6, delay: 1.2, knockback: 300, effect: STUN(0.6), requiresPartsDown: true, cd: 18, windup: 1.2, telegraph: 'circle', color: '#9fe8ff', vfx: 'boss_titan_ult' },
  },

  // ============================================================ R6 死靈樂章
  {
    id: 105, round: 6, name: '死靈樂章', subtitle: '幽冥引路人',
    color: '#7d5fff', shape: 'circle', maxHp: 6500, maxMana: 999, speed: 130,
    baseHp: 6500,
    appearance: {
      size: '等身偏大 (約玩家 2 倍)，漂浮',
      style: '漂浮的幽靈指揮 / 巫妖，破舊暗袍隨幽風飄動，雙眼與雙手燃綠靈火，手持斷裂指揮棒兼死神鐮。身周籠罩半透明護盾泡。配色：幽紫 #7d5fff + 靈綠 #39ff88 + 屍袍灰。',
      weapon: '靈魂指揮棒 / 鐮刃',
      telegraph: '召喚前高舉指揮棒、地面綻開綠色法陣；護盾隨存活小怪數脈動發亮。',
    },
    model: { bulk: 3.5, weapon: 'staff', robe: true, scale: 2.0, head: 'circle', float: true, emissiveCore: '#39ff88' },
    ai: 'necromancer',
    mechanic: { minionShield: { perMinion: 0.18, max: 0.72 } }, // 每隻存活小怪給魔王減傷，清空才露破綻
    // 教學提示：R6 機制是召喚小怪給自己護盾，要先清小怪
    hint: '牠會召喚小怪 —— 每隻活著的小怪都讓牠減傷，先清掉小怪再打本體！',
    tags: [
      { icon: '💀', text: '會召喚小怪' },
      { icon: '🛡️', text: '每隻小怪給魔王減傷（最多 72%）' },
      { icon: '🎯', text: '清光小怪才打得動本體' },
    ],
    hazardText: '☠️ 站在亡靈領域裡！快離開',
    hazardColor: '#46f0a0', // 靈魂綠
    basic: { name: '靈魂彈', type: 'projectile', dmg: 26, speed: 480, radius: 12, lifetime: 1.6, count: 2, spread: 0.18, knockback: 40, cd: 1.0, windup: 0.4, telegraph: 'line', color: '#39ff88', vfx: 'boss_necro_bolt' },
    skill1: { name: '亡者召集', type: 'summon_minions', count: 3, minionHp: 240, minionCharId: 7, cd: 12, windup: 0.8, telegraph: 'self', color: '#7d5fff', vfx: 'boss_necro_summon' },
    skill2: { name: '亡靈護壁', type: 'buff', shield: 400, duration: 12, cd: 14, windup: 0.6, telegraph: 'self', color: '#b39dff', shieldPerMinion: 200, vfx: 'boss_necro_shield' },
    ultimate: { name: '安魂彌撒', type: 'zone', range: 0, radius: 240, dmg: 28, lifetime: 4, tick: 0.5, follow: true, healPerMinion: 30, effect: SLOW(0.6, 0.6), cd: 18, windup: 1.0, telegraph: 'circle', color: '#9d7dff', vfx: 'boss_necro_ult' },
  },

  // ============================================================ R7 風暴巨狼
  {
    id: 106, round: 7, name: '風暴巨狼', subtitle: '狂暴之爪',
    color: '#4a6fa5', shape: 'triangle', maxHp: 7000, maxMana: 999, speed: 250,
    baseHp: 7000,
    appearance: {
      size: '等身偏大 (約玩家 2.2 倍)，低伏蓄勢',
      style: '籠罩雷暴的巨狼，深灰鬃毛間奔竄藍白電弧，雙眼發藍光，利爪帶電。奔跑時拖出殘影與雷光。配色：暴雲灰 #4a6fa5 + 雷電藍白 #aee3ff + 怒目藍。',
      weapon: '雷電利爪 + 撕咬',
      telegraph: '撲擊前壓低身軀、爪下迸放電火並投出衝刺線、雙眼閃光；起手極短，考驗反應。',
    },
    model: { bulk: 4.0, weapon: 'gloves', scale: 2.2, head: 'triangle', emissiveCore: '#aee3ff', beast: true },
    ai: 'storm_wolf',
    mechanic: { targetLowest: true, enrageBelow: 0.4, enrageHaste: 1.4 }, // 鎖最低血玩家；殘血暴怒加速
    // 教學提示：R7 機制是鎖血最少的人猛撲(起手極短) + 殘血暴怒
    hint: '牠專咬血最少的人 —— 被盯上就拉開距離！起手極短，看到撲擊馬上閃',
    tags: [
      { icon: '🎯', text: '鎖定血最少的隊友' },
      { icon: '⚡', text: '起手極短·撲擊要快閃' },
      { icon: '🔴', text: '殘血會暴怒加速' },
    ],
    basic: { name: '雷爪連擊', type: 'melee', dmg: 28, range: 90, arc: 1.0, knockback: 100, cd: 0.5, windup: 0.2, telegraph: 'arc', color: '#aee3ff', vfx: 'boss_wolf_claw' },
    skill1: { name: '迅雷撲擊', type: 'leap', range: 360, dur: 0.35, dmg: 70, radius: 110, knockback: 200, effect: STUN(0.4), cd: 5, windup: 0.3, telegraph: 'line', color: '#7ec8ff', targetLowest: true, vfx: 'boss_wolf_pounce' },
    skill2: { name: '暴風咆哮', type: 'buff', duration: 6, effect: { kind: 'rage', duration: 6, speed: 1.5, dmg: 1.4 }, cd: 12, windup: 0.5, telegraph: 'self', color: '#cfe8ff', knockbackAura: 260, vfx: 'boss_wolf_howl' },
    ultimate: { name: '雷霆亂舞', type: 'multiblink', count: 5, dmg: 60, knockback: 160, effect: STUN(0.3), cd: 16, windup: 0.6, telegraph: 'self', color: '#aee3ff', targetLowest: true, vfx: 'boss_wolf_ult' },
  },

  // ============================================================ R8 虛空大魔導
  {
    id: 107, round: 8, name: '虛空大魔導', subtitle: '時空扭曲者',
    color: '#8e44ad', shape: 'circle', maxHp: 7500, maxMana: 999, speed: 150,
    baseHp: 7500,
    appearance: {
      size: '等身 (約玩家 1.8 倍)，漂浮',
      style: '漂浮的宇宙魔導，紫黑星空長袍內流動星雲，周身環繞旋轉符文環，雙手凝聚扭曲空間的紫光。配色：虛空紫 #8e44ad + 星雲靛 #3d2b8e + 符文金光。',
      weapon: '空間扭曲術 (雙手施法)',
      telegraph: '扭曲前地面與目標身上浮現旋轉符文圈、畫面邊緣出現空間漣漪微光。',
    },
    model: { bulk: 3.0, weapon: 'orb', robe: true, scale: 1.8, head: 'circle', float: true, emissiveCore: '#c39bff' },
    ai: 'void_mage',
    mechanic: { rewind: true }, // 大招倒流玩家位置
    // 教學提示：R8 機制是打亂操作的符咒 + 黑洞吸入 + 大招倒流位置
    hint: '符咒會打亂你的移動、黑洞會把你吸進去、大招把你拉回幾秒前 —— 看到預警快閃開！',
    tags: [
      { icon: '🌀', text: '符咒會打亂你的操作' },
      { icon: '🕳️', text: '黑洞會吸入·別靠近' },
      { icon: '⏪', text: '大招會倒流你的位置' },
    ],
    hazardText: '🕳️ 被黑洞吸住了！快脫離',
    hazardColor: '#a06cff',
    basic: { name: '虛空彈', type: 'projectile', dmg: 28, speed: 520, radius: 14, lifetime: 1.6, count: 3, spread: 0.4, knockback: 50, cd: 1.0, windup: 0.4, telegraph: 'line', color: '#c39bff', vfx: 'boss_void_bolt' },
    skill1: { name: '混沌符咒', type: 'apply_scramble', radius: 320, duration: 2.4, cd: 9, windup: 0.8, telegraph: 'circle', color: '#b14fd8', vfx: 'boss_void_scramble' },
    skill2: { name: '奇點黑洞', type: 'zone', range: 140, radius: 200, dmg: 30, lifetime: 2.4, tick: 0.4, delay: 0.6, pull: 360, effect: SLOW(1.0, 0.5), cd: 11, windup: 0.7, telegraph: 'circle', color: '#5b2c8e', swapHit: true, vfx: 'boss_void_blackhole' },
    ultimate: { name: '時光倒流', type: 'time_rewind', rewindSeconds: 3.0, dmg: 90, radius: 150, cd: 18, windup: 1.2, telegraph: 'circle', color: '#a06cff', vfx: 'boss_void_ult' },
  },

  // ============================================================ R9 審判之翼
  {
    id: 108, round: 9, name: '審判之翼', subtitle: '墮落天使',
    color: '#f5d76e', shape: 'triangle', maxHp: 9000, maxMana: 999, speed: 160,
    baseHp: 9000,
    appearance: {
      size: '巨大 (約玩家 2.6 倍)，雙翼展開更寬',
      style: '墮落的天使，一側純白羽翼、一側焦黑墮翼，黑化的光環與聖痕，手持聖墮交織的審判巨劍，自身延伸出發光的束縛鎖鏈。配色：聖金 #f5d76e + 墮黑 #2c2c34 + 神聖白光 / 暗影紫。',
      weapon: '審判巨劍 + 靈魂鎖鏈',
      telegraph: '靈魂綁定前鎖鏈從魔王延伸連向目標 (明確連線)；審判光柱前展翼上升、地面投出光柱警示。Phase 2 全身光環轉為暗紫。',
    },
    model: { bulk: 5.0, weapon: 'sword', scale: 2.6, head: 'triangle', wings: true, emissiveCore: '#fff2b0' },
    ai: 'fallen_angel',
    mechanic: { soulBind: { count: 2, minGap: 200, dmg: 18, tick: 0.5 }, phases: 2 }, // 隨機綁定 2 人，過近雙扣
    // 教學提示：R9 機制是用鎖鏈把兩人綁定(過近雙扣) + 兩階段
    hint: '牠會用鎖鏈把兩名玩家綁在一起 —— 被綁就和隊友拉開距離，否則一起扣血！',
    tags: [
      { icon: '🔗', text: '會綁定兩名玩家' },
      { icon: '↔️', text: '被綁要和隊友拉開' },
      { icon: '⚔️', text: '第二階段更兇' },
    ],
    hazardText: '☀️ 站在審判光柱下！快離開',
    hazardColor: '#ffd24a',
    basic: { name: '聖劍光弧', type: 'melee', dmg: 40, range: 140, arc: 1.4, knockback: 180, cd: 1.2, windup: 0.5, telegraph: 'arc', color: '#fff2b0', vfx: 'boss_angel_slash' },
    skill1: { name: '靈魂綁定', type: 'soul_bind', count: 2, minGap: 200, dmg: 18, duration: 6, cd: 13, windup: 0.9, telegraph: 'self', color: '#d8b3ff', vfx: 'boss_angel_bind' },
    skill2: { name: '審判光柱', type: 'zone', range: 150, radius: 110, dmg: 60, lifetime: 0.5, tick: 0.5, delay: 1.0, count: 3, scatter: 240, stagger: 0.2, cd: 10, windup: 1.0, telegraph: 'circle', color: '#fff7d6', vfx: 'boss_angel_judgment' },
    ultimate: { name: '光暗審判', type: 'light_dark', dmg: 80, radius: 1200, cd: 19, windup: 1.4, telegraph: 'self', color: '#ffe9a8', vfx: 'boss_angel_ult' },
  },

  // ============================================================ R10 另一個自己
  {
    id: 109, round: 10, name: '另一個自己', subtitle: '終焉之神',
    color: '#e8e8f0', shape: 'circle', maxHp: 12000, maxMana: 999, speed: 180,
    baseHp: 12000,
    appearance: {
      size: '巨大 (約玩家 3 倍)，會隨階段變形',
      style: '一具不斷流動、變形的「另一個自己」剪影，由虛空與星光構成的軀體，表面裂開流瀉白光，頭頂懸浮王者光環，外型會模仿並扭曲玩家的姿態。配色：虛空黑 + 星光白 #e8e8f0 + 裂縫白光 + 階段染色。',
      weapon: '隨階段化形 (複製玩家武器 / 凝聚虛空)',
      telegraph: '複製前周身泛起鏡面波紋、變階段時軀體裂開迸光；施放玩家大招前手勢與該角色一致。',
    },
    model: { bulk: 7.0, weapon: 'none', scale: 3.0, head: 'circle', emissiveCore: '#ffffff', phases: 3, voidBody: true },
    ai: 'doppelganger',
    mechanic: { mirrorPlayers: true, phases: 3 }, // 複製全體玩家成鏡像；多階段
    // 教學提示：R10 機制是複製全體玩家 + 偷學大招 + 多階段
    hint: '牠會複製全體玩家、還會偷學你們的大招 —— 牠出的招跟你們一樣，預判它！',
    tags: [
      { icon: '🪞', text: '複製全體玩家' },
      { icon: '🎭', text: '會偷用你們的大招' },
      { icon: '💠', text: '多階段·會變形' },
    ],
    hazardText: '💥 站在終焉領域裡！快離開',
    hazardColor: '#c9c0ff',
    basic: { name: '虛空裂斬', type: 'melee', dmg: 44, range: 150, arc: 1.3, knockback: 200, cd: 1.0, windup: 0.4, telegraph: 'arc', color: '#ffffff', vfx: 'boss_doppel_slash' },
    skill1: { name: '鏡像複製', type: 'mirror_players', cd: 22, once: true, windup: 1.0, telegraph: 'self', color: '#cfcfff', vfx: 'boss_doppel_mirror' },
    skill2: { name: '竊取絕技', type: 'steal_ultimate', cd: 10, windup: 0.8, telegraph: 'self', color: '#b0b0ff', vfx: 'boss_doppel_steal' },
    ultimate: { name: '終焉之刻', type: 'zone', range: 0, radius: 320, dmg: 60, lifetime: 1.2, tick: 0.3, delay: 1.4, knockback: 200, effect: STUN(0.5), cd: 20, windup: 1.4, telegraph: 'circle', color: '#ffffff', vfx: 'boss_doppel_ult' },
  },
];

const BY_ID = new Map(BOSSES.map((b) => [b.id, b]));

export function getBoss(id) { return BY_ID.get(id) || null; }
export function isBossId(id) { return id >= 100 && BY_ID.has(id); }

// 依關卡 (1..10) 取得魔王資料
export function getBossForRound(round) {
  return BOSSES.find((b) => b.round === round) || null;
}

export const BOSS_COUNT = BOSSES.length;
