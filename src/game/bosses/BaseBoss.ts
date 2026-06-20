export type BossAiProfile = {
  range?: number;
  slots?: readonly string[];
  pickTarget?: 'aggroSwap' | 'nearestTarget' | 'lowestTarget';
  kite?: number;
  slow?: boolean;
};

export type BossInputHelpers = {
  computeProfileInput: (profile: BossAiProfile | null, state: any, ent: any, dt: number) => any;
};

export type BossLoaders = {
  aiProfile?: BossAiProfile;
  computeInput?: (state: any, ent: any, dt: number, helpers: BossInputHelpers) => any;
  modelConfig?: Record<string, unknown>;
  buildModel?: (ctx: any) => any;
  buildWeapon?: (hand: any, ctx: any) => void;
  attachSkinGear?: (ctx: any) => void;
  loadVfx?: () => void;
};

export class BaseBoss {
  [key: string]: any;

  readonly data: Record<string, any>;
  readonly loaders: BossLoaders;

  constructor(data: Record<string, any>, loaders: BossLoaders = {}) {
    Object.assign(this, data);
    this.data = data;
    this.loaders = loaders;

    // Enhance boss ultimate skills dynamically (balanced for instant shockwave blast + combo chains)
    if (this.ultimate) {
      const u = this.ultimate;
      if (this.id === 100) { // golem
        u.radius = 280; u.dmg = 90; u.lifetime = 1.2; u.tick = 0.3; u.knockback = 500; u.effect = { kind: 'stun', duration: 1.0 };
        u.chain = [{ slot: 'ultimate', windup: 0.2, delay: 1.2 }, { slot: 'ultimate', windup: 0.2, delay: 1.2 }];
      } else if (this.id === 101) { // poison-lizard
        u.range = 240; u.radius = 200; u.dmg = 35; u.lifetime = 6; u.count = 8; u.scatter = 400;
        u.chain = [{ slot: 'skill1', windup: 0.3, delay: 1.0 }, { slot: 'skill2', windup: 0.3, delay: 1.2 }, { slot: 'skill1', windup: 0.3, delay: 1.0 }];
      } else if (this.id === 102) { // lava-juggernaut
        u.range = 220; u.radius = 200; u.dmg = 60; u.lifetime = 4; u.count = 10; u.scatter = 450;
        u.chain = [{ slot: 'skill1', windup: 0.3, delay: 1.2 }, { slot: 'skill2', windup: 0.3, delay: 1.2 }, { slot: 'skill1', windup: 0.3, delay: 1.0 }];
      } else if (this.id === 103) { // frost-assassin
        u.radius = 300; u.dmg = 35; u.lifetime = 3.0; u.tick = 0.5; u.effect = { kind: 'chill', duration: 4.0, stacks: 3, max: 4, freezeDur: 2.0 };
        u.chain = [{ slot: 'skill1', windup: 0.2, delay: 0.8 }, { slot: 'skill1', windup: 0.2, delay: 0.8 }, { slot: 'skill2', windup: 0.3, delay: 1.2 }];
      } else if (this.id === 104) { // ancient-titan
        u.radius = 380; u.dmg = 70; u.lifetime = 0.8; u.tick = 0.4; u.knockback = 450; u.effect = { kind: 'stun', duration: 1.0 };
        u.chain = [{ slot: 'skill1', windup: 0.4, delay: 1.2 }, { slot: 'skill2', windup: 0.4, delay: 1.2 }, { slot: 'ultimate', windup: 0.4, delay: 1.0 }];
      } else if (this.id === 105) { // necromancer-conductor
        u.radius = 320; u.dmg = 30; u.lifetime = 4; u.tick = 0.5; u.healPerMinion = 60; u.effect = { kind: 'slow', duration: 0.6, factor: 0.8 };
        u.chain = [{ slot: 'skill1', windup: 0.4, delay: 1.0 }, { slot: 'skill2', windup: 0.4, delay: 1.2 }, { slot: 'skill1', windup: 0.4, delay: 1.0 }];
      } else if (this.id === 106) { // storm-wolf
        u.count = 6; u.dmg = 60; u.knockback = 250; u.effect = { kind: 'stun', duration: 0.6 };
        u.chain = [{ slot: 'skill1', windup: 0.2, delay: 0.8 }, { slot: 'skill2', windup: 0.3, delay: 1.0 }, { slot: 'ultimate', windup: 0.3, delay: 1.0 }];
      } else if (this.id === 107) { // void-mage
        u.rewindSeconds = 5.0; u.dmg = 90; u.radius = 220;
        u.chain = [{ slot: 'skill1', windup: 0.3, delay: 1.0 }, { slot: 'skill2', windup: 0.3, delay: 1.2 }, { slot: 'skill1', windup: 0.3, delay: 1.0 }];
      } else if (this.id === 108) { // fallen-angel
        u.dmg = 100; u.radius = 1500;
        u.chain = [{ slot: 'skill1', windup: 0.3, delay: 1.0 }, { slot: 'skill2', windup: 0.3, delay: 1.2 }, { slot: 'ultimate', windup: 0.3, delay: 1.0 }];
      } else if (this.id === 109) { // doppelganger
        u.radius = 400; u.dmg = 60; u.lifetime = 1.2; u.tick = 0.3; u.knockback = 350; u.effect = { kind: 'stun', duration: 1.0 };
        u.chain = [{ slot: 'skill1', windup: 0.3, delay: 1.0 }, { slot: 'skill2', windup: 0.3, delay: 1.2 }, { slot: 'ultimate', windup: 0.3, delay: 1.0 }];
      }
    }
  }

  get modelConfig() {
    return this.loaders.modelConfig || null;
  }

  get aiProfile() {
    return this.loaders.aiProfile || null;
  }

  buildModel(ctx: any) {
    return this.loaders.buildModel ? this.loaders.buildModel(ctx) : null;
  }

  buildWeapon(hand: any, ctx: any) {
    if (this.loaders.buildWeapon) this.loaders.buildWeapon(hand, ctx);
  }

  attachSkinGear(ctx: any) {
    if (this.loaders.attachSkinGear) this.loaders.attachSkinGear(ctx);
  }

  computeInput(state: any, ent: any, dt: number, helpers: BossInputHelpers) {
    if (this.loaders.computeInput) return this.loaders.computeInput(state, ent, dt, helpers);
    return helpers.computeProfileInput(this.aiProfile, state, ent, dt);
  }

  loadVfx() {
    if (this.loaders.loadVfx) this.loaders.loadVfx();
  }
}
