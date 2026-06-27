// HUD self-alert registry.
//
// Self-alerts are short, high-priority messages shown near the player HUD.
// The DOM stays in hud.js; alert decision branches live here so adding a new
// Boss/status warning does not grow the main HUD update function.

const ALERTS = [];

export function registerSelfAlert(def) {
  if (!def || !def.id || typeof def.getText !== 'function') return;
  const existing = ALERTS.findIndex((alert) => alert.id === def.id);
  if (existing >= 0) ALERTS.splice(existing, 1, def);
  else ALERTS.push(def);
  ALERTS.sort((a, b) => (b.priority || 0) - (a.priority || 0));
}

export function getSelfAlert(ctx) {
  for (const alert of ALERTS) {
    const text = alert.getText(ctx);
    if (text) return text;
  }
  return '';
}

export function getSelfAlerts() {
  return ALERTS;
}
