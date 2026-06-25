export const aiProfile = {
  range: 220,                           // Ideal engagement distance (in pixels)
  slots: ['ultimate', 'skill2', 'skill1', 'basic'], // Priority of evaluation
  pickTarget: 'nearestTarget',          // Targeting logic: 'nearestTarget' | 'lowestTarget' | 'aggroSwap'
  kite: 100,                            // Retreat distance (if player gets too close)
  combos: {                             // Chain combos if specific skills hit/cast
    ultimate: [
      { slot: 'skill1', windup: 0.3, delay: 0.8 },
      { slot: 'basic', windup: 0.25, delay: 0.6 }
    ]
  }
} as const;
