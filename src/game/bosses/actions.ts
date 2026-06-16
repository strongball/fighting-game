export type BossActionHelpers = {
  ARENA: any;
  PLAYER_RADIUS: number;
  BOSS_TEAM: number;
  clamp: (v: number, min: number, max: number) => number;
  dist: (x1: number, y1: number, x2: number, y2: number) => number;
  makeBoss: (id: string, charId: number, x: number, y: number, team: number, opts?: any) => any;
  addFx: (state: any, fx: any) => void;
  isEnemy: (state: any, a: string, b: any) => boolean;
  applyEffect: (target: any, kind: string, opt?: any, srcId?: string) => void;
  dealDamage: (state: any, target: any, amount: number, attackerId: any, opts?: any) => void;
  getCharacter: (id: number) => any;
  executeAction: (state: any, caster: any, action: any, opts?: any) => void;
};

export type BossActionHandler = (state: any, boss: any, action: any, helpers: BossActionHelpers) => void;

const ACTIONS = new Map<string, BossActionHandler>();

export function registerBossAction(type: string, handler: BossActionHandler) {
  if (type) ACTIONS.set(type, handler);
}

export function executeBossAction(state: any, boss: any, action: any, helpers: BossActionHelpers) {
  const handler = action && ACTIONS.get(action.type);
  if (!handler) return false;
  handler(state, boss, action, helpers);
  return true;
}
