// @ts-nocheck
import { BaseCharacter } from '../../BaseCharacter.ts';
import { characterSprite } from '../../textureSprite.ts';
import { drawAssassinTexture } from './texture.ts';
import { modelConfig, buildModel, buildWeapon } from './model.ts';
import './vfx.ts';
import './talent.ts';

const data = {
    id: 'assassin', order: 2, evadeType: 'dash', name: '刺客', color: '#9b59b6', shape: 'triangle', sprite: characterSprite('assassin', '#9b59b6', true, drawAssassinTexture), meleeRole: true,
    maxHp: 190, maxMana: 70, speed: 240,
    desc: '無限疊毒的近身收割者。毒牙連刺每刀疊一層劇毒、層數越高融得越快；毒霧步留毒雲掩護脫身、淬毒之刃爆疊劇毒並續戰，大招瘟疫爆發把全場的毒一次引爆並擴散。沒有爆發、靠毒慢慢溶掉敵人＋毒傷吸血在臉上苟住——和戰士的前置爆發完全相反。',
    role: '近戰 · 疊毒/續戰',
    synergy: '貼上去疊毒、毒越久越痛；毒霧步＋毒傷吸血讓你苟在臉上，大招對被你鋪滿毒的敵群一次引爆＋擴散。配控場隊友把目標釘住給你疊毒最強。',
    talent: { id: 'virulence', name: '劇毒', desc: '你施加的「劇毒」可無限疊加、每層持續造成傷害。對中毒目標 +20% 傷害，且毒傷的 30% 轉為治療（黏著續戰）。', bonus: 0.20, lifesteal: 0.30 },
    basic: { name: '毒牙連刺', type: 'melee', dmg: 10, range: 95, arc: 1.5, knockback: 28, cd: 0.28, color: '#a06cff', effect: { kind: 'poison', stacks: 1, dmgPerStack: 4, duration: 5, tick: 0.5 }, vfx: 'assassin_slash' },
    skill1: { name: '毒霧步', type: 'zone', range: 0, radius: 150, dmg: 6, lifetime: 3.0, tick: 0.5, effect: { kind: 'poison', stacks: 1, dmgPerStack: 4, duration: 5 }, manaCost: 25, cd: 9, color: '#7ee787', vfx: 'assassin_mist', self: { effects: [{ kind: 'haste', duration: 2.0, factor: 1.3 }, { kind: 'dmg_reduce', duration: 2.0, factor: 0.3 }] } },
    skill2: { name: '淬毒之刃', type: 'melee', dmg: 24, range: 110, arc: 1.8, knockback: 40, effect: { kind: 'poison', stacks: 5, dmgPerStack: 4, duration: 6 }, manaCost: 30, cd: 8, color: '#a06cff', vfx: 'assassin_backstab', self: { effects: [{ kind: 'lifesteal', duration: 5, factor: 0.4 }, { kind: 'haste', duration: 5, factor: 1.2 }] } },
    ultimate: { name: '瘟疫爆發', type: 'plaguenova', burstPerStack: 9, spreadRadius: 220, cd: 12, color: '#7ee787', vfx: 'assassin_ultimate', self: { heal: 70 } },
  };

export class AssassinCharacter extends BaseCharacter {
  constructor() {
    super(data, {
      modelConfig,
      buildModel,
      buildWeapon,
      paintTexture: drawAssassinTexture,
      loadVfx: () => undefined,
    });
  }
}

export default new AssassinCharacter();
