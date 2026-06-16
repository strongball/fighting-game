import { CHARACTERS } from '../../characters/index.ts';
import { BOSSES } from '../../bosses/index.ts';

for (const character of CHARACTERS) character.loadVfx();
for (const boss of BOSSES) boss.loadVfx();

export { getVfx, hasVfx, registerVfx } from './registry.js';
