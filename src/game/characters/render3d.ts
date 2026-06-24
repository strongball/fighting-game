import { CHARACTERS } from './index.ts';
import { getMinion } from './minions/index.ts';

// 玩家角色以 slug 字串 id 查找（魔王為 number>=100、由 models.js 另行處理；召喚物為 number<0）。
const BY_SLUG = new Map<string, any>(CHARACTERS.map((c: any) => [c.id, c]));

const WEAPON_BUILDERS = new Map<string, (hand: any, ctx: any) => void>();
for (const character of CHARACTERS) {
  const weapon = character.modelConfig?.weapon;
  if (typeof weapon === 'string') {
    WEAPON_BUILDERS.set(weapon, character.buildWeapon.bind(character));
  }
}
WEAPON_BUILDERS.set('axe', WEAPON_BUILDERS.get('axes') || (() => {}));

export function getCharacterModelDef(charId: string | number) {
  if (typeof charId === 'number' && charId < 0) return getMinion(charId);
  return BY_SLUG.get(charId as string) || null;
}

export function getWeaponBuilder(type: string) {
  return WEAPON_BUILDERS.get(type) || null;
}

export function getCharacterTexturePainter(charId: string | number) {
  const character = BY_SLUG.get(charId as string);
  return character ? character.paintTexture.bind(character) : null;
}
