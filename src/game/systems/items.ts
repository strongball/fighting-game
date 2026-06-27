import { PLAYER_RADIUS, ARENA } from '../constants.js';
import { applyHeal } from '../entities/heal.ts';
import { applyEffect } from '../entities/effects.ts';
import { addFx } from '../entities/fx.ts';
import { makeDropItem } from '../entities/factories.ts';
import type { GameState, Player } from '../types';

const MAX_ITEMS = 5;

export function spawnDropItem(state: GameState, kind: 'heal' | 'mana', x: number, y: number, opt: any = {}) {
  if (!state.items) state.items = [];
  
  // Clean oldest if exceeding maximum
  if (state.items.length >= MAX_ITEMS) {
    state.items.shift();
  }
  
  const item = makeDropItem(kind, x, y, opt);
  state.items.push(item);
  
  // Play spawn warning zone FX if it drops from sky
  if (item.warningTime > 0) {
    addFx(state, {
      type: 'hit', // generic FX type for simple flash
      x: item.x,
      y: item.y,
      life: 0.3,
      color: item.color,
      radius: item.radius * 2,
    });
  }
}

// Spawning from broken pillar (55% chance)
export function spawnDropFromPillar(state: GameState, x: number, y: number) {
  if (state.mode !== 'boss') return;
  if (Math.random() > 0.55) return;
  const kind = Math.random() < 0.5 ? 'heal' : 'mana';
  spawnDropItem(state, kind, x, y, { warningTime: 0 }); // Spawns instantly without landing warning
}

// Spawning from dead minions (35% chance)
export function spawnDropFromMinion(state: GameState, x: number, y: number) {
  if (state.mode !== 'boss') return;
  if (Math.random() > 0.35) return;
  const kind = Math.random() < 0.5 ? 'heal' : 'mana';
  spawnDropItem(state, kind, x, y, { warningTime: 0 });
}

// Regular sky drop (every 20s in Boss Mode)
export function spawnSkyDrop(state: GameState) {
  if (state.mode !== 'boss') return;
  const margin = 120;
  const x = margin + Math.random() * (ARENA.width - margin * 2);
  const y = margin + Math.random() * (ARENA.height - margin * 2);
  const kind = Math.random() < 0.5 ? 'heal' : 'mana';
  spawnDropItem(state, kind, x, y, { warningTime: 1.5 });
}

// Potion usage logic
export function useHpPotion(state: GameState, p: Player) {
  if (!p.alive || !(p.itemHp > 0)) return;
  p.itemHp--;
  
  // Instant heal: 20% max HP + 30 HP
  const instantHealAmount = p.maxHp * 0.20 + 30;
  applyHeal(state, p, instantHealAmount, { burst: true });
  
  // Slow heal (HoT): 35% max HP over 7 seconds (5% per second)
  const amountPerSec = p.maxHp * 0.05;
  applyEffect(p, 'regen_hot', { duration: 7, amountPerSec });
  
  // Play FX
  addFx(state, { type: 'buff', x: p.x, y: p.y, color: '#ff4d4d', life: 0.6, radius: PLAYER_RADIUS * 2.0 });
}

export function useMpPotion(state: GameState, p: Player) {
  if (!p.alive || !(p.itemMp > 0)) return;
  p.itemMp--;
  
  // Instantly restores 40 Mana
  p.mana = Math.min(p.maxMana, p.mana + 40);
  
  // Show popup text
  addFx(state, { type: 'popup', x: p.x, y: p.y, color: '#3aa0ff', life: 0.7, text: '+40', kind: 'mana' });
  // Play FX
  addFx(state, { type: 'buff', x: p.x, y: p.y, color: '#3aa0ff', life: 0.6, radius: PLAYER_RADIUS * 2.0 });
}

// Tick drop items
let skyDropTimer = 0;

export function tickDropItems(state: GameState, dt: number) {
  if (state.mode !== 'boss') return;
  if (!state.items) state.items = [];
  
  // Handle periodically spawning sky drops (every 12 seconds)
  if (state.roundPhase === 'fighting') {
    skyDropTimer += dt;
    if (skyDropTimer >= 12) {
      skyDropTimer = 0;
      spawnSkyDrop(state);
    }
  } else {
    skyDropTimer = 0;
  }
  
  // Update items
  for (let i = state.items.length - 1; i >= 0; i--) {
    const item = state.items[i];
    
    if (item.warningTime != null && item.warningTime > 0) {
      item.warningTime -= dt;
      if (item.warningTime < 0) item.warningTime = 0;
      continue; // Cannot pick up during landing warning
    }
    
    item.lifetime -= dt;
    if (item.lifetime <= 0) {
      state.items.splice(i, 1);
      continue;
    }
    
    // Check collision with alive players
    for (const p of Object.values(state.players)) {
      if (!p.alive || p.ownerId || p.isBoss || p.isPart) continue; // Only actual players can pick up
      
      const d = Math.hypot(p.x - item.x, p.y - item.y);
      if (d <= PLAYER_RADIUS + item.radius) {
        let pickedUp = false;
        
        if (item.kind === 'heal' && p.itemHp < 10) {
          p.itemHp++;
          pickedUp = true;
        } else if (item.kind === 'mana' && p.itemMp < 10) {
          p.itemMp++;
          pickedUp = true;
        }
        
        if (pickedUp) {
          // Play pickup flash/pop FX and remove item
          addFx(state, {
            type: 'hit',
            x: item.x,
            y: item.y,
            color: item.color,
            life: 0.2,
            radius: item.radius * 1.5,
          });
          state.items.splice(i, 1);
          break; // Item is gone, stop checking other players
        }
      }
    }
  }
}
