// HUD resource bar registry.
//
// Character-specific self resource bars (fury, sword energy, etc.) live here
// instead of growing render3d/hud.js with one branch per character.

const RESOURCE_BARS = [];

export function registerHudResourceBar(def) {
  if (!def || !def.id || typeof def.matches !== 'function' || typeof def.update !== 'function') return;
  const existing = RESOURCE_BARS.findIndex((bar) => bar.id === def.id);
  if (existing >= 0) RESOURCE_BARS.splice(existing, 1, def);
  else RESOURCE_BARS.push(def);
  RESOURCE_BARS.sort((a, b) => (a.order || 0) - (b.order || 0));
}

export function updateHudResourceBars(ctx, slots) {
  for (const slot of Object.values(slots)) {
    if (slot && slot.wrap) slot.wrap.style.display = 'none';
  }

  for (const bar of RESOURCE_BARS) {
    const slot = slots[bar.slotId || bar.id];
    if (!slot || !bar.matches(ctx)) continue;
    slot.wrap.style.display = '';
    bar.update(ctx, slot);
  }
}

export function getHudResourceBars() {
  return RESOURCE_BARS;
}
