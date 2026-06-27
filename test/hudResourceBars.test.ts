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
    expect(getHudResourceBars().map((bar: any) => bar.id)).toEqual(['fury', 'sword-energy']);
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
});
