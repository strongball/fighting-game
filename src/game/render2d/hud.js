import { CANVAS_H, CANVAS_W, ULT_MAX } from '../constants.js';
import { getCharacter } from '../characters.js';
import { drawBar } from './utils.js';

export function drawHUD(ctx, state, selfId) {
  const me = state.players[selfId];
  if (me) {
    const x = 24, y = CANVAS_H - 70, w = 280;
    const c = getCharacter(me.charId);
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = me.alive ? '#fff' : '#ff7675';
    ctx.fillText(`${me.name}  (${c.name})${me.alive ? '' : ' — 淘汰'}`, x, y - 8);
    drawBar(ctx, x, y, w, 14, me.hp / me.maxHp, '#2ecc71', '#0c2a18');
    ctx.fillStyle = '#fff'; ctx.font = '11px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(`${Math.ceil(me.hp)}/${me.maxHp}`, x + w / 2, y + 11);
    drawBar(ctx, x, y + 18, w, 12, me.mana / me.maxMana, '#3aa0ff', '#0c1c2a');
    ctx.fillStyle = '#fff'; ctx.fillText(`${Math.ceil(me.mana)}/${me.maxMana}`, x + w / 2, y + 28);
    drawSkillIcons(ctx, me, x, y + 36, c);
  }

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

function drawSkillIcons(ctx, me, x, y, c) {
  const slots = [
    ['J', c.basic, 'basic'],
    ['K', c.skill1, 'skill1'],
    ['L', c.skill2, 'skill2'],
    [';', c.ultimate, 'ultimate'],
    ['Shift', c.evade, 'evade'],
  ];

  const IW = 82;
  const IH = 28;
  const GAP = 6;
  const CDH = 4;

  for (let i = 0; i < slots.length; i++) {
    const [key, action, cdKey] = slots[i];
    if (!action) continue;
    const ix = x + i * (IW + GAP);
    const cdVal = me.cd[cdKey] || 0;
    const cdMax = action.cd || 1;
    const cdRatio = Math.max(0, Math.min(1, cdVal / cdMax));
    const onCd = cdVal > 0;
    const isUlt = cdKey === 'ultimate';
    const manaCost = action.manaCost || 0;
    const noMana = isUlt ? (me.ult || 0) < ULT_MAX : manaCost > 0 && me.mana < manaCost;

    let bgColor;
    if (onCd) bgColor = 'rgba(40,40,50,0.85)';
    else if (noMana) bgColor = 'rgba(120,30,30,0.85)';
    else bgColor = 'rgba(60,160,255,0.85)';
    ctx.fillStyle = bgColor;
    ctx.fillRect(ix, y, IW, IH);

    ctx.font = 'bold 10px system-ui';
    ctx.textAlign = 'left';
    ctx.fillStyle = onCd ? '#7a8a9a' : noMana ? '#ff7a7a' : '#d0eeff';
    ctx.fillText(key, ix + 4, y + 12);
    ctx.fillStyle = onCd ? '#9aaab8' : noMana ? '#ffaaaa' : '#ffffff';
    ctx.font = '10px system-ui';
    ctx.fillText(action.name, ix + 16, y + 12);

    if (!onCd && noMana) {
      ctx.fillStyle = '#ff6060';
      ctx.font = '9px system-ui';
      if (isUlt) {
        const ultPct = Math.floor(((me.ult || 0) / ULT_MAX) * 100);
        ctx.fillText(`能量 ${ultPct}%`, ix + 4, y + 22);
      } else {
        ctx.fillText(`魔力不足 (${manaCost})`, ix + 4, y + 22);
      }
    }

    if (onCd) {
      ctx.fillStyle = '#aabbc8';
      ctx.font = '9px system-ui';
      ctx.fillText(`${cdVal.toFixed(1)}s`, ix + 4, y + 22);
    }

    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(ix, y + IH - CDH, IW, CDH);
    if (onCd) {
      ctx.fillStyle = '#3aa0ff';
      ctx.fillRect(ix, y + IH - CDH, IW * (1 - cdRatio), CDH);
    } else if (isUlt && noMana) {
      const ultRatio = Math.max(0, Math.min(1, (me.ult || 0) / ULT_MAX));
      ctx.fillStyle = '#f9ca24';
      ctx.fillRect(ix, y + IH - CDH, IW * ultRatio, CDH);
    } else if (!noMana) {
      ctx.fillStyle = '#2ecc71';
      ctx.fillRect(ix, y + IH - CDH, IW, CDH);
    } else {
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(ix, y + IH - CDH, IW, CDH);
    }

    ctx.strokeStyle = onCd ? 'rgba(80,100,120,0.6)' : noMana ? 'rgba(200,60,60,0.7)' : 'rgba(100,180,255,0.7)';
    ctx.lineWidth = 1;
    ctx.strokeRect(ix + 0.5, y + 0.5, IW - 1, IH - 1);
  }
}
