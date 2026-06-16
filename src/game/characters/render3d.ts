import { CHARACTERS } from './index.ts';
import { getMinion } from './minions/index.ts';

const WEAPON_BUILDERS = new Map<string, (hand: any, ctx: any) => void>();
for (const character of CHARACTERS) {
  const weapon = character.modelConfig?.weapon;
  if (typeof weapon === 'string') {
    WEAPON_BUILDERS.set(weapon, character.buildWeapon.bind(character));
  }
}
WEAPON_BUILDERS.set('axe', WEAPON_BUILDERS.get('axes') || (() => {}));

export function getCharacterModelDef(charId: number) {
  if (charId < 0) return getMinion(charId);
  return CHARACTERS[charId] || null;
}

export function getWeaponBuilder(type: string) {
  return WEAPON_BUILDERS.get(type) || null;
}

export function getCharacterTexturePainter(charId: number) {
  const character = CHARACTERS[charId];
  return character ? character.paintTexture.bind(character) : null;
}
