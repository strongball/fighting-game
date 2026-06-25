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
    desc: '先縛、再殺的影處決者。影縛符遠程定身整整 2 秒，影襲·處決瞬移到被控目標背後灌出致命一擊並隱遁無敵，大招千影召出無數殘影瞬斬全場。專剋被控目標——控起手、處決收割。',
    role: '機動 · 控制/處決',
    synergy: '影縛符或任何隊友的控場都能讓「影襲·處決」鎖定發動；對被控(暈/縛/緩/凍)的敵人傷害暴增，控場隊友越多越致命。',
    talent: { id: 'shadowstrike', name: '影殺', desc: '對被控制(暈眩/定身/緩速/凍結)的敵人造成 +40% 傷害。', bonus: 0.40 },
    basic: { name: '飛鏢', type: 'projectile', dmg: 22, speed: 680, radius: 9, lifetime: 1.0, knockback: 40, cd: 0.36, color: '#95a5a6', vfx: 'ninja_shuriken' },
    skill1: { name: '影縛符', type: 'projectile', dmg: 28, speed: 640, radius: 12, lifetime: 0.85, knockback: 20, manaCost: 25, cd: 8, color: '#636e72', effect: { kind: 'root', duration: 2.0 }, vfx: 'ninja_bind' },
    skill2: { name: '影襲·處決', type: 'shadowstrike', range: 360, dmg: 150, hitRadius: 100, knockback: 80, fallbackRange: 300, stealthDur: 1.5, manaCost: 30, cd: 8, color: '#2c3e50', vfx: 'ninja_shadowstrike' },
    ultimate: { name: '千影', type: 'shadowflurry', count: 7, dmg: 52, knockback: 60, cd: 12, color: '#b0bec5', vfx: 'ninja_ultimate', self: { effects: [{ kind: 'invis', duration: 2.5 }, { kind: 'evading', duration: 2.5 }, { kind: 'haste', duration: 2.5, factor: 1.4 }] } },
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
