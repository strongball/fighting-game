// @ts-nocheck
import { BaseCharacter } from '../../BaseCharacter.ts';
import { characterSprite } from '../../textureSprite.ts';
import { drawNinjaTexture } from './texture.ts';
import { modelConfig, buildModel, buildWeapon } from './model.ts';
import { attachSkinGear } from './gear.ts';
import './vfx.ts';
import './talent.ts';

const data = {
    id: 'ninja', order: 7, evadeType: 'blink', name: '忍者', color: '#2c3e50', shape: 'triangle', sprite: characterSprite('ninja', '#2c3e50', true, drawNinjaTexture),
    maxHp: 200, maxMana: 90, speed: 235,
    desc: '高機動的控制側翼。影縛符遠程定身、影襲瞬移突進並落下煙幕緩速，大招煙影亂舞化身環身刃絞殺敵群。專剋被控制的目標——價值在接控與絞殺，而非隱身偷襲。',
    role: '機動 · 控制/絞殺',
    synergy: '遠程定身為隊友接控；對被控(暈/縛/緩)的敵人傷害暴增，與任何控場隊友(戰士/坦克/元素)完美銜接。',
    talent: { id: 'shadowstrike', name: '影殺', desc: '對被控制(暈眩/定身/緩速/凍結)的敵人造成 +35% 傷害。', bonus: 0.35 },
    basic: { name: '飛鏢', type: 'projectile', dmg: 16, speed: 640, radius: 9, lifetime: 1.0, knockback: 40, cd: 0.4, color: '#95a5a6', vfx: 'ninja_shuriken' },
    skill1: { name: '影縛符', type: 'projectile', dmg: 30, speed: 620, radius: 11, lifetime: 0.8, knockback: 30, manaCost: 25, cd: 8, color: '#636e72', effect: { kind: 'root', duration: 1.4 }, vfx: 'ninja_bind' },
    skill2: { name: '影襲瞬移', type: 'blink', range: 320, dmg: 60, hitRadius: 95, knockback: 120, manaCost: 30, cd: 6, color: '#636e72', vfx: 'ninja_shadowblink', leaveZone: { radius: 120, dmg: 10, lifetime: 2.4, tick: 0.5, effect: { kind: 'slow', duration: 1.2, factor: 0.55 }, color: '#5a6472', vfx: 'ninja_smoke' }, self: { effect: { kind: 'haste', duration: 1.4, factor: 1.35 } } },
    ultimate: { name: '煙影亂舞', type: 'zone', range: 0, radius: 175, dmg: 42, lifetime: 2.4, tick: 0.3, follow: true, effect: { kind: 'slow', duration: 0.6, factor: 0.55 }, cd: 10, color: '#b0bec5', vfx: 'ninja_ultimate', self: { effect: { kind: 'haste', duration: 2.5, factor: 1.4 } } },
  };

export class NinjaCharacter extends BaseCharacter {
  constructor() {
    super(data, {
      modelConfig,
      buildModel,
      buildWeapon,
      paintTexture: drawNinjaTexture, attachSkinGear,
      loadVfx: () => undefined,
    });
  }
}

export default new NinjaCharacter();
