export const aiProfile = {
  range: 400,
  slots: ['ultimate', 'skill2', 'skill1', 'basic'],
  pickTarget: 'nearestTarget',
  kite: 300,
  combos: {
    ultimate: [
      { slot: 'skill2', windup: 0.35, delay: 0.9 },
      { slot: 'skill1', windup: 0.3, delay: 0.8 },
      { slot: 'basic', windup: 0.25, delay: 0.6 }
    ]
  }
} as const;
