export const aiProfile = {
  range: 140,
  slots: ['skill1', 'skill2', 'ultimate', 'basic'],
  pickTarget: 'nearestTarget',
  combos: {
    skill2: [{ slot: 'basic', windup: 0.2, delay: 0.15 }],
    ultimate: [{ slot: 'skill1', windup: 0.3, delay: 1.0 }, { slot: 'skill2', windup: 0.3, delay: 1.2 }, { slot: 'ultimate', windup: 0.3, delay: 1.0 }],
  },
} as const;
