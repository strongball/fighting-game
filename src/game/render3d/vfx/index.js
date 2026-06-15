// 角色專屬特效彙整入口：載入所有角色模組(副作用註冊) 並再匯出查詢 API。
import './warrior.js';
import './mage.js';
import './assassin.js';
import './tank.js';
import './archer.js';
import './healer.js';
import './berserker.js';
import './ninja.js';
import './elementalist.js';
import './fighter.js';
import './paladin.js';
import './hexer.js';
import './bard.js';
import './samurai.js';
import './gunner.js';
import './summoner.js';
import './necromancer.js';
import './chronomancer.js';
import './boss.js';

export { getVfx, hasVfx, registerVfx } from './registry.js';
