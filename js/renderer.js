// 稍微傾斜的俯視渲染 + HUD (血條/魔力條/名稱/計分)

import {
  ARENA, TILT, BODY_HEIGHT, PROJECTILE_HEIGHT, PLAYER_RADIUS,
  CANVAS_W, CANVAS_H, FLOOR_TOP, FLOOR_LEFT,
} from './constants.js';
import { getCharacter } from './characters.js';

function sx(wx) { return FLOOR_LEFT + wx; }
function sy(wy) { return FLOOR_TOP + wy * TILT; }

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const spriteCache = new Map();

  function drawShape(shape, cx, cy, r) {
    ctx.beginPath();
    if (shape === 'square') {
      ctx.rect(cx - r, cy - r, r * 2, r * 2);
    } else if (shape === 'triangle') {
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy + r);
      ctx.lineTo(cx - r, cy + r);
      ctx.closePath();
    } else {
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
    }
  }

  function drawFloor() {
    const x0 = sx(0), y0 = sy(0), w = ARENA.width, h = ARENA.height * TILT;
    const g = ctx.createLinearGradient(0, y0, 0, y0 + h);
    g.addColorStop(0, '#243447');
    g.addColorStop(1, '#16202c');
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, w, h);

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    const step = 100;
    for (let gx = 0; gx <= ARENA.width; gx += step) {
      ctx.beginPath(); ctx.moveTo(sx(gx), sy(0)); ctx.lineTo(sx(gx), sy(ARENA.height)); ctx.stroke();
    }
    for (let gy = 0; gy <= ARENA.height; gy += step) {
      ctx.beginPath(); ctx.moveTo(sx(0), sy(gy)); ctx.lineTo(sx(ARENA.width), sy(gy)); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(120,200,255,0.5)';
    ctx.lineWidth = 3;
    ctx.strokeRect(x0, y0, w, h);
  }

  function drawZone(z) {
    const x = sx(z.x), y = sy(z.y);
    const telegraph = z.delay > 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, TILT);
    ctx.beginPath();
    ctx.arc(0, 0, z.radius, 0, Math.PI * 2);
    ctx.fillStyle = telegraph ? 'rgba(255,80,80,0.12)' : hexA(z.color, 0.22);
    ctx.fill();
    ctx.lineWidth = telegraph ? 4 : 2;
    ctx.strokeStyle = telegraph ? 'rgba(255,80,80,0.8)' : hexA(z.color, 0.7);
    ctx.stroke();
    ctx.restore();
  }

  function drawShadow(wx, wy, r) {
    ctx.save();
    ctx.translate(sx(wx), sy(wy));
    ctx.scale(1, TILT);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();
    ctx.restore();
  }

  function drawBody(p, isSelf) {
    const c = getCharacter(p.charId);
    const bx = sx(p.x), by = sy(p.y);
    const topY = by - BODY_HEIGHT;
    const r = PLAYER_RADIUS;
    const sprite = getSprite(c.sprite);

    drawShadow(p.x, p.y, r);

    ctx.save();
    const invis = p.effects && p.effects.invis;
    ctx.globalAlpha = invis ? (isSelf ? 0.5 : 0.22) : 1;

    if (sprite) {
      const size = r * 4.15;
      ctx.save();
      ctx.translate(bx, topY);
      ctx.rotate(p.facing + Math.PI / 2);
      ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
      ctx.restore();

      if (isSelf) {
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(bx, topY, r + 19, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else {
      // 連接腳底與身體的柱體
      ctx.fillStyle = shade(c.color, -25);
      ctx.fillRect(bx - r, topY, r * 2, BODY_HEIGHT);

      // 身體頂部形狀
      ctx.fillStyle = c.color;
      ctx.strokeStyle = isSelf ? '#ffffff' : 'rgba(0,0,0,0.45)';
      ctx.lineWidth = isSelf ? 3 : 2;
      drawShape(c.shape, bx, topY, r);
      ctx.fill();
      ctx.stroke();

      // 面向指示
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(bx, topY);
      ctx.lineTo(bx + Math.cos(p.facing) * (r + 8), topY + Math.sin(p.facing) * (r + 8));
      ctx.stroke();
    }

    // 護盾圈
    if (p.shield > 0) {
      ctx.strokeStyle = 'rgba(120,220,255,0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(bx, topY, r + (sprite ? 20 : 6), 0, Math.PI * 2);
      ctx.stroke();
    }
    // 狂暴光環
    if (p.effects && p.effects.rage) {
      ctx.strokeStyle = 'rgba(255,70,70,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(bx, topY, r + (sprite ? 24 : 10), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    drawBars(p, bx, topY - r - 16);
  }

  function drawBars(p, cx, top) {
    const w = 46, h = 5;
    const x = cx - w / 2;
    // 名稱
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillText(p.name, cx + 1, top - 7 + 1);
    ctx.fillStyle = '#fff';
    ctx.fillText(p.name, cx, top - 7);
    // 血條
    bar(x, top, w, h, p.hp / p.maxHp, '#2ecc71', '#0c2a18');
    // 魔力條
    bar(x, top + h + 2, w, h - 1, p.mana / p.maxMana, '#3aa0ff', '#0c1c2a');
  }

  function bar(x, y, w, h, ratio, fg, bg) {
    ratio = Math.max(0, Math.min(1, ratio));
    ctx.fillStyle = bg; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = fg; ctx.fillRect(x, y, w * ratio, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  function drawProjectile(pr) {
    const x = sx(pr.x), y = sy(pr.y) - PROJECTILE_HEIGHT;
    drawShadow(pr.x, pr.y, pr.radius * 0.8);
    ctx.save();
    ctx.shadowColor = pr.color; ctx.shadowBlur = 12;
    ctx.fillStyle = pr.color;
    ctx.beginPath();
    ctx.arc(x, y, pr.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawFx(f) {
    const t = f.life / f.maxLife;
    ctx.save();
    if (f.type === 'melee') {
      const bx = sx(f.x), by = sy(f.y) - BODY_HEIGHT;
      ctx.globalAlpha = t;
      ctx.strokeStyle = f.color; ctx.lineWidth = 4;
      ctx.beginPath();
      const a0 = f.facing - f.arc / 2, a1 = f.facing + f.arc / 2;
      ctx.arc(bx, by, f.range, a0, a1);
      ctx.stroke();
    } else if (f.type === 'hit' || f.type === 'blink' || f.type === 'death' || f.type === 'buff') {
      const x = sx(f.x), y = sy(f.y) - (f.type === 'hit' ? PROJECTILE_HEIGHT : BODY_HEIGHT * 0.5);
      ctx.globalAlpha = t;
      ctx.strokeStyle = f.color; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, (f.radius || 14) * (1.2 - t * 0.6), 0, Math.PI * 2);
      ctx.stroke();
    } else if (f.type === 'dash') {
      const x = sx(f.x), y = sy(f.y) - BODY_HEIGHT;
      ctx.globalAlpha = t * 0.8;
      ctx.strokeStyle = f.color; ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - Math.cos(f.facing) * 40, y - Math.sin(f.facing) * 40);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawHUD(state, selfId) {
    const me = state.players[selfId];
    // 左下：自身大血條/魔力條
    if (me) {
      const x = 24, y = CANVAS_H - 70, w = 280;
      const c = getCharacter(me.charId);
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = me.alive ? '#fff' : '#ff7675';
      ctx.fillText(`${me.name}  (${c.name})${me.alive ? '' : ' — 淘汰'}`, x, y - 8);
      bar(x, y, w, 14, me.hp / me.maxHp, '#2ecc71', '#0c2a18');
      ctx.fillStyle = '#fff'; ctx.font = '11px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(`${Math.ceil(me.hp)}/${me.maxHp}`, x + w / 2, y + 11);
      bar(x, y + 18, w, 12, me.mana / me.maxMana, '#3aa0ff', '#0c1c2a');
      ctx.fillStyle = '#fff'; ctx.fillText(`${Math.ceil(me.mana)}/${me.maxMana}`, x + w / 2, y + 28);
      // 技能冷卻
      drawSkillIcons(me, x, y + 36, c);
    }
    // 右上：存活計分板
    const players = Object.values(state.players).sort((a, b) => b.kills - a.kills);
    ctx.textAlign = 'left';
    ctx.font = '13px system-ui, sans-serif';
    let ry = 24;
    const alive = players.filter((p) => p.alive).length;
    ctx.fillStyle = '#ffd166'; ctx.font = 'bold 14px system-ui';
    ctx.fillText(`存活 ${alive} 人`, CANVAS_W - 180, ry);
    ry += 22;
    ctx.font = '13px system-ui';
    for (const p of players) {
      ctx.fillStyle = p.id === selfId ? '#ffd166' : p.alive ? '#fff' : '#7b8a97';
      const tag = p.alive ? '' : ' ✕';
      ctx.fillText(`${getCharacter(p.charId).name} ${p.name}  K:${p.kills}${tag}`, CANVAS_W - 180, ry);
      ry += 19;
    }
  }

  function drawSkillIcons(me, x, y, c) {
    const slots = [['J', c.basic], ['K', c.skill1], ['L', c.skill2]];
    let ix = x;
    for (const [key, a] of slots) {
      const ready = me.cd[key === 'J' ? 'basic' : key === 'K' ? 'skill1' : 'skill2'] <= 0;
      ctx.fillStyle = ready ? 'rgba(60,160,255,0.85)' : 'rgba(80,80,90,0.7)';
      ctx.fillRect(ix, y, 86, 18);
      ctx.fillStyle = '#fff'; ctx.font = '11px system-ui'; ctx.textAlign = 'left';
      ctx.fillText(`${key} ${a.name}`, ix + 5, y + 13);
      ix += 92;
    }
  }

  function render(state, selfId) {
    ctx.fillStyle = '#0b1118';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    drawFloor();

    // 地面區域 (先畫)
    for (const z of state.zones) drawZone(z);

    // 深度排序的實體 (玩家 + 投射物)
    const drawables = [];
    for (const p of Object.values(state.players)) if (p.alive) drawables.push({ wy: p.y, kind: 'p', ref: p });
    for (const pr of state.projectiles) drawables.push({ wy: pr.y, kind: 'pr', ref: pr });
    drawables.sort((a, b) => a.wy - b.wy);
    for (const d of drawables) {
      if (d.kind === 'p') drawBody(d.ref, d.ref.id === selfId);
      else drawProjectile(d.ref);
    }

    // 特效 (最上層)
    for (const f of state.fx) drawFx(f);

    drawHUD(state, selfId);
  }

  return { render, ctx };

  function getSprite(src) {
    if (!src) return null;
    let img = spriteCache.get(src);
    if (!img) {
      img = new Image();
      img.decoding = 'async';
      img.src = src;
      spriteCache.set(src, img);
    }
    return img.complete && img.naturalWidth > 0 ? img : null;
  }
}

// ---- 顏色工具 ----
function hexA(hex, a) {
  const { r, g, b } = parseHex(hex);
  return `rgba(${r},${g},${b},${a})`;
}
function shade(hex, amt) {
  let { r, g, b } = parseHex(hex);
  r = Math.max(0, Math.min(255, r + amt));
  g = Math.max(0, Math.min(255, g + amt));
  b = Math.max(0, Math.min(255, b + amt));
  return `rgb(${r},${g},${b})`;
}
function parseHex(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}
