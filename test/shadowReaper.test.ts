import { describe, it, expect } from 'vitest';
import { getBossForRound } from '../src/game/bosses.js';
import { makePlayer, makeBoss, createInitialState } from '../src/game/entities/factories.ts';
import { executeAction } from '../src/game/actions/executor.ts';
import { tickBossSystems } from '../src/game/bosses/systems.ts';
import { dealDamage } from '../src/game/entities/damage.ts';
import { updateProjectiles } from '../src/game/systems/projectiles.ts';
import { prepareBossAction } from '../src/game/bosses/actions.ts';
import { computeBossInput } from '../src/game/bossAI.js';

describe('Round 5 Shadow Reaper (Redesigned)', () => {
  it('is registered as Round 5', () => {
    const boss = getBossForRound(5);
    expect(boss).toBeTruthy();
    expect(boss.name).toBe('幽冥影刃');
  });

  it('casts shuriken projectile and applies blind debuff via basic attack', () => {
    const state: any = createInitialState([], {}, { mode: 'boss' });
    state.roundPhase = 'fighting';
    state.round = 5;

    const boss = makeBoss('reaper', 115, 200, 200, 2, { isBoss: true });
    const hero = makePlayer('hero', 'Hero', 'warrior', 300, 200, 1); // nearby
    state.players = { [boss.id]: boss, [hero.id]: hero };

    // Cast basic attack (shuriken projectile)
    const shurikenAction = getBossForRound(5)!.basic;
    executeAction(state, boss, shurikenAction);

    // Expect 3 shuriken projectiles spawned
    const shurikens = state.projectiles.filter((p: any) => p.vfx === 'boss_shadow_shuriken');
    expect(shurikens.length).toBe(3);

    // Update projectiles to hit the hero
    shurikens[0].x = hero.x;
    shurikens[0].y = hero.y;

    updateProjectiles(state, 0.1);

    // Expect hero to be blinded
    expect(hero.effects.blind).toBeTruthy();
    expect(hero.effects.blind.remaining).toBe(1.5);
  });

  it('manages clone lifetimes and active swapping', () => {
    const state: any = createInitialState([], {}, { mode: 'boss' });
    state.roundPhase = 'fighting';
    state.round = 5;

    const boss = makeBoss('reaper', 115, 200, 200, 2, { isBoss: true });
    boss.hp = 5000;
    boss.maxHp = 5000;
    boss.cd = { skill1: 5.0, skill2: 0 };
    state.players = { [boss.id]: boss };

    const summonSwapAction = getBossForRound(5)!.skill2;

    // --- Phase 1: Summon 1st clone ---
    executeAction(state, boss, summonSwapAction);
    let clones = Object.values(state.players).filter((p: any) => p.isFake && p.ownerId === boss.id);
    expect(clones.length).toBe(1);
    const clone = clones[0] as any;
    expect(clone.lifetime).toBe(8.0);

    // --- Clone Lifetime Decrement ---
    tickBossSystems(state, 1.0);
    expect(clone.lifetime).toBe(7.0);

    // --- Phase 1 Swap Cast ---
    // Since 1 clone is active and limit is 1, casting skill2 should SWAP instead of summoning a new one
    boss.x = 200; boss.y = 200;
    clone.x = 400; clone.y = 400;
    boss.cd.skill1 = 5.0; // Put skill1 on CD

    executeAction(state, boss, summonSwapAction);

    // Positions should be swapped
    expect(boss.x).toBe(400); expect(boss.y).toBe(400);
    expect(clone.x).toBe(200); expect(clone.y).toBe(200);

    // Skill 1 cooldown should be reset (0)
    expect(boss.cd.skill1).toBe(0);

    // Total clones should still be 1
    clones = Object.values(state.players).filter((p: any) => p.isFake && p.ownerId === boss.id && p.alive);
    expect(clones.length).toBe(1);

    // --- Lifetime Expiry ---
    clone.lifetime = 0.5;
    tickBossSystems(state, 0.6); // Expire the clone

    // Clone should be cleaned up/deleted
    clones = Object.values(state.players).filter((p: any) => p.isFake && p.ownerId === boss.id && p.alive);
    expect(clones.length).toBe(0);
  });

  it('supports 2 clones in Phase 2 and swaps on max limit', () => {
    const state: any = createInitialState([], {}, { mode: 'boss' });
    state.roundPhase = 'fighting';
    state.round = 5;

    const boss = makeBoss('reaper', 115, 200, 200, 2, { isBoss: true });
    boss.hp = 2000; // Phase 2 (HP <= 50%)
    boss.maxHp = 5000;
    boss.cd = { skill1: 5.0, skill2: 0 };
    state.players = { [boss.id]: boss };

    // Initial tick to transition phases
    tickBossSystems(state, 0.1);
    expect(boss.phaseIdx).toBe(1);

    const summonSwapAction = getBossForRound(5)!.skill2;

    // Summon 1st clone
    executeAction(state, boss, summonSwapAction);
    // Summon 2nd clone (in Phase 2, limit is 2)
    executeAction(state, boss, summonSwapAction);

    let clones = Object.values(state.players).filter((p: any) => p.isFake && p.ownerId === boss.id && p.alive);
    expect(clones.length).toBe(2);

    // Casting again (now at limit) should swap with the oldest clone
    const oldest = clones[0] as any;
    boss.x = 100; boss.y = 100;
    oldest.x = 500; oldest.y = 500;

    executeAction(state, boss, summonSwapAction);

    // Boss should have swapped with the oldest clone
    expect(boss.x).toBe(500); expect(boss.y).toBe(500);
    expect(oldest.x).toBe(100); expect(oldest.y).toBe(100);

    // Cooldown is reset
    expect(boss.cd.skill1).toBe(0);

    // Total clones count remains 2
    clones = Object.values(state.players).filter((p: any) => p.isFake && p.ownerId === boss.id && p.alive);
    expect(clones.length).toBe(2);
  });

  it('makes clones invulnerable to all incoming damage', () => {
    const state: any = createInitialState([], {}, { mode: 'boss' });
    state.roundPhase = 'fighting';
    state.round = 5;

    const boss = makeBoss('reaper', 115, 200, 200, 2, { isBoss: true });
    boss.hp = 5000;
    boss.maxHp = 5000;
    state.players = { [boss.id]: boss };

    const summonSwapAction = getBossForRound(5)!.skill2;
    executeAction(state, boss, summonSwapAction);

    const clone: any = Object.values(state.players).find((p: any) => p.isFake && p.ownerId === boss.id);
    expect(clone).toBeTruthy();

    // Hit the clone
    dealDamage(state, clone, 1000, 'attacker-id');

    // Clone and Boss HP should remain untouched
    expect(clone.hp).toBe(5000);
    expect(boss.hp).toBe(5000);
  });

  it('makes clones cast ultimate in Phase 2', () => {
    const state: any = createInitialState([], {}, { mode: 'boss' });
    state.roundPhase = 'fighting';
    state.round = 5;

    const boss = makeBoss('reaper', 115, 200, 200, 2, { isBoss: true });
    boss.hp = 2000; // Phase 2
    boss.maxHp = 5000;
    const hero = makePlayer('hero', 'Hero', 'warrior', 300, 200, 1);
    state.players = { [boss.id]: boss, [hero.id]: hero };

    // Phase transition
    tickBossSystems(state, 0.1);

    const summonSwapAction = getBossForRound(5)!.skill2;
    executeAction(state, boss, summonSwapAction);

    const clone: any = Object.values(state.players).find((p: any) => p.isFake && p.ownerId === boss.id);
    expect(clone).toBeTruthy();

    // Cast ultimate
    const ultAction = getBossForRound(5)!.ultimate;
    executeAction(state, boss, ultAction);

        // Both boss and clone should have disappeared
    expect(boss.isUltDisappeared).toBe(true);
    expect(clone.isUltDisappeared).toBe(true);
    expect(boss._ultSlamTimer).toBe(9.0);
    expect(clone._ultSlamTimer).toBeUndefined();

    // Immediately on cast, 1st cross (Horizontal: 5 zones) spawned for both boss and clone (2 * 5 = 10 zones)
    let strikeZones = state.zones.filter((z: any) => z.vfx === 'boss_shadow_ult_strike');
    expect(strikeZones.length).toBe(10);

    // Tick 3.0s (total 3.0s) -> 2nd cross (Vertical: 5 zones) spawned (another 2 * 5 = 10 zones)
    tickBossSystems(state, 3.0);
    strikeZones = state.zones.filter((z: any) => z.vfx === 'boss_shadow_ult_strike');
    expect(strikeZones.length).toBe(20);

    // Tick 3.0s (total 6.0s) -> 3rd cross (X: 8 zones per caster, center skipped) spawned (another 2 * 8 = 16 zones)
    tickBossSystems(state, 3.0);
    strikeZones = state.zones.filter((z: any) => z.vfx === 'boss_shadow_ult_strike');
    expect(strikeZones.length).toBe(36);

    // Tick 3.0s (total 9.0s) -> Boss slams down behind target, and clone reappears
    tickBossSystems(state, 3.0);
    expect(boss._ultSlamTimer).toBe(0);

    // Boss should teleport behind the player (300 - 60 = 240)
    expect(boss.x).toBeCloseTo(240);
    expect(boss.y).toBeCloseTo(200);

    // Clone should reappear and be placed near the boss (isUltDisappeared set to false)
    expect(clone.isUltDisappeared).toBe(false);

    // Only boss's slam zone created
    let slamZones = state.zones.filter((z: any) => z.vfx === 'boss_shadow_ult_slam');
    expect(slamZones.length).toBe(1);
  });

  it('makes clones chase player when chaseTarget is true', () => {
    const state: any = createInitialState([], {}, { mode: 'boss' });
    state.roundPhase = 'fighting';
    state.round = 5;

    const boss = makeBoss('reaper', 115, 200, 200, 2, { isBoss: true });
    const hero = makePlayer('hero', 'Hero', 'warrior', 500, 200, 1);
    state.players = { [boss.id]: boss, [hero.id]: hero };

    // Summon clone
    const summonAction = getBossForRound(5)!.skill2;
    executeAction(state, boss, summonAction);

    const clone: any = Object.values(state.players).find((p: any) => p.isFake && p.ownerId === boss.id);
    expect(clone).toBeTruthy();
    expect(clone.chaseTarget).toBe(true);

    clone.x = 200;
    clone.y = 200;

    const input = computeBossInput(state, clone, 0.033);
    expect(input.right).toBe(true);
    expect(input.left).toBeFalsy();
  });

  it('teleports behind player on prepare and slashes on execute for skill1 (shadow_blink_slash), replicating to clones', () => {
    const state: any = createInitialState([], {}, { mode: 'boss' });
    state.roundPhase = 'fighting';
    state.round = 5;

    const boss = makeBoss('reaper', 115, 200, 200, 2, { isBoss: true });
    const hero = makePlayer('hero', 'Hero', 'warrior', 300, 200, 1);
    hero.facing = 0; // facing right (+X)
    state.players = { [boss.id]: boss, [hero.id]: hero };

    // Summon clone
    const summonAction = getBossForRound(5)!.skill2;
    executeAction(state, boss, summonAction);
    const clone: any = Object.values(state.players).find((p: any) => p.isFake && p.ownerId === boss.id);
    expect(clone).toBeTruthy();
    
    clone.x = 1000;
    clone.y = 1000;

    const blinkSlashAction = getBossForRound(5)!.skill1;

    const helpers = {
      dist: (x1: number, y1: number, x2: number, y2: number) => Math.hypot(x2 - x1, y2 - y1),
      clamp: (v: number, min: number, max: number) => Math.max(min, Math.min(max, v)),
      isEnemy: (state: any, a: string, b: any) => a !== b,
      addFx: () => {},
      PLAYER_RADIUS: 24,
      ARENA: { width: 1600, height: 1200 }
    } as any;

    // Replicate prepare to clone (as bossAI.js does)
    prepareBossAction(state, boss, blinkSlashAction, helpers);
    prepareBossAction(state, clone, blinkSlashAction, helpers);

    // Teleport behind hero (300 - 60 = 240)
    expect(boss.x).toBeCloseTo(240);
    expect(boss.y).toBeCloseTo(200);
    expect(clone.x).toBeCloseTo(240);
    expect(clone.y).toBeCloseTo(200);

    // Expect "影步！" popup FX to be spawned
    const popups = state.fx.filter((f: any) => f.type === 'popup' && f.text === '影步！');
    expect(popups.length).toBe(2);

    // Execute slash on boss (which replicates to clone)
    executeAction(state, boss, blinkSlashAction);

    // Both hit hero: 300 - (70 * 2 * 0.85) = 300 - 119 = 181
    expect(hero.hp).toBe(181);
  });
});
