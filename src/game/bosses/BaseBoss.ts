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
