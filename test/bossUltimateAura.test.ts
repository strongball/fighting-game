import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createBossUltimateAura } from '../src/game/render3d/bossUltimateAura.js';

describe('boss ultimate aura lifecycle', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('bursts once, follows lock state, and disposes all visual objects', () => {
    const overlay = { style: { cssText: '', opacity: '' }, remove: vi.fn() };
    vi.stubGlobal('document', { createElement: vi.fn(() => overlay) });

    const scene = new THREE.Scene();
    const particles = {
      capacity: 5000,
      count: 0,
      spawn: vi.fn(),
    };
    const sceneMgr = {
      stage: { appendChild: vi.fn() },
      addFlash: vi.fn(),
      addShake: vi.fn(),
    };
    const aura = createBossUltimateAura({ scene, particles, sceneMgr });
    const boss = { id: 'boss', isBoss: true, alive: true, ultLockInvincible: true, x: 10, y: 20, scale: 1 };

    aura.sync({ boss }, 1 / 60);
    expect(sceneMgr.addFlash).toHaveBeenCalledTimes(1);
    expect(particles.spawn).toHaveBeenCalledTimes(102); // 100 burst + 2 time-based flow particles
    expect(overlay.style.opacity).toBe('0.68');

    aura.sync({ boss }, 1 / 60);
    expect(sceneMgr.addFlash).toHaveBeenCalledTimes(1);

    aura.sync({ boss: { ...boss, ultLockInvincible: false } }, 1 / 60);
    expect(overlay.style.opacity).toBe('0');

    aura.dispose();
    expect(scene.children).toHaveLength(0);
    expect(overlay.remove).toHaveBeenCalledTimes(1);
  });
});
