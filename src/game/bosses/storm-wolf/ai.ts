export const aiProfile = {
  range: 110,
  slots: ['ultimate', 'skill1', 'skill2', 'basic'],
  pickTarget: 'lowestTarget',
  combos: {
    skill1: [{ slot: 'basic', windup: 0.1, delay: 0.15 }, { slot: 'basic', windup: 0.1, delay: 0.15 }],
    ultimate: [{ slot: 'skill1', windup: 0.2, delay: 0.8 }, { slot: 'skill2', windup: 0.3, delay: 1.0 }, { slot: 'ultimate', windup: 0.3, delay: 1.0 }],
  },
} as const;
