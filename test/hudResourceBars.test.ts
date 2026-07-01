import { describe, expect, it } from 'vitest';
import '../src/game/render3d/hud/resourceBars/default.js';
import { getHudResourceBars, updateHudResourceBars } from '../src/game/render3d/hud/resourceBars.js';

function classList() {
  const classes = new Set<string>();
  return {
    toggle(name: string, value?: boolean) {
      if (value) classes.add(name);
      else classes.delete(name);
    },
    contains(name: string) {
      return classes.has(name);
    },
  };
}

function slot() {
  return {
    wrap: { style: {} as Record<string, string>, classList: classList() },
    fill: { style: {} as Record<string, string> },
    text: { textContent: '' },
  } as any;
}

describe('HUD resource bar registry', () => {
  it('registers default resource bars in render order', () => {
    expect(getHudResourceBars().map((bar: any) => bar.id)).toEqual(['fury', 'sword-energy', 'glass-mirrors']);
  });

  it('updates only matching character resource bars', () => {
    const fury = slot();
    const sword = slot();

    updateHudResourceBars(
      {
        player: { fury: 60 },
        character: { talent: { id: 'bulwark', threshold: 55 } },
      },
      { fury, 'sword-energy': sword },
    );

    expect(fury.wrap.style.display).toBe('');
    expect(fury.fill.style.width).toBe('60%');
    expect(fury.wrap.classList.contains('boiling')).toBe(true);
    expect(fury.text.textContent).toBe('怒氣 60');
    expect(sword.wrap.style.display).toBe('none');
  });

  it('updates sword energy bars', () => {
    const fury = slot();
    const sword = slot();

    updateHudResourceBars(
      {
        player: { magicSwordsman: { swordEnergy: 3 } },
        character: { talent: { id: 'arcane_contract', maxSwordEnergy: 6 } },
      },
      { fury, 'sword-energy': sword },
    );

    expect(fury.wrap.style.display).toBe('none');
    expect(sword.wrap.style.display).toBe('');
    expect(sword.fill.style.width).toBe('50%');
    expect(sword.text.textContent).toBe('劍氣 3/6');
  });

  it('updates glass mirror bars in the fury slot', () => {
    const fury = slot();
    const sword = slot();

    updateHudResourceBars(
      {
        state: { zones: [
          { kind: 'glass_mirror', owner: 'p1', lifetime: 3 },
          { kind: 'glass_mirror', owner: 'p1', lifetime: 2 },
          { kind: 'glass_mirror', owner: 'p2', lifetime: 3 },
        ] },
        player: { id: 'p1' },
        character: { id: 'glass-astrologer', talent: { maxMirrors: 3 } },
      },
      { fury, 'sword-energy': sword },
    );

    expect(fury.wrap.style.display).toBe('');
    expect(fury.fill.style.width).toBe('66.66666666666666%');
    expect(fury.wrap.classList.contains('boiling')).toBe(false);
    expect(fury.text.textContent).toBe('星鏡 2/3');
    expect(sword.wrap.style.display).toBe('none');
  });
});
