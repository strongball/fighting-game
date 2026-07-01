// @ts-nocheck
export function drawGunnerTexture(x, S) {
  // 槍手：彈孔與機械瞄準格紋
  x.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  x.lineWidth = 1.5;
  for (let i = 0; i < S; i += 22) {
    x.beginPath(); x.moveTo(i, 0); x.lineTo(i, S); x.stroke();
    x.beginPath(); x.moveTo(0, i); x.lineTo(S, i); x.stroke();
  }
  x.fillStyle = 'rgba(40, 30, 10, 0.55)';
  for (let i = 0; i < 10; i++) {
    x.beginPath(); x.arc(Math.random() * S, Math.random() * S, 2 + Math.random() * 2.5, 0, 7); x.fill();
  }
}

export function drawGunnerMaterialTexture(x, S, meta = {}) {
  const variant = meta.variant || 'body';
  const cx = S / 2;
  const cy = S / 2;

  if (variant === 'hair') {
    // 瀟灑金髮：頂部明亮白金，底部溫暖金褐
    const grad = x.createLinearGradient(0, S, 0, 0);
    grad.addColorStop(0, '#5a4512');    // 髮根深褐陰影
    grad.addColorStop(0.3, '#d4a017');  // 溫暖金黃
    grad.addColorStop(0.75, '#ffd76a'); // 明亮金黃
    grad.addColorStop(1, '#ffffff');    // 髮梢/高光白金
    x.fillStyle = grad;
    x.fillRect(0, 0, S, S);

    // 髮絲紋理：暗色髮絲陰影
    x.strokeStyle = 'rgba(90, 69, 18, 0.65)';
    x.lineWidth = Math.max(2.5, S / 20);
    for (let u = S / 8; u < S; u += S / 4) {
      x.beginPath();
      x.moveTo(u, S);
      x.lineTo(cx + (u - cx) * 0.15, 0);
      x.stroke();
    }

    // 細部髮絲陰影
    x.strokeStyle = 'rgba(60, 45, 10, 0.45)';
    x.lineWidth = Math.max(1.2, S / 40);
    for (let u = S / 6; u < S; u += S / 3) {
      x.beginPath();
      x.moveTo(u, S);
      x.lineTo(cx + (u - cx) * 0.25, 0);
      x.stroke();
    }

    // 髮絲亮線
    x.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    x.lineWidth = Math.max(1.8, S / 30);
    for (let u = S / 3; u < S; u += S / 3) {
      x.beginPath();
      x.moveTo(u - S / 10, S);
      x.lineTo(cx + (u - S / 10 - cx) * 0.1, 0);
      x.stroke();
    }
    return;
  }

  if (variant === 'robe' || variant === 'leather') {
    // 琥珀真皮紋理
    const bg = x.createLinearGradient(0, 0, S, S);
    bg.addColorStop(0, '#3e2510');      // 暗褐皮革
    bg.addColorStop(0.5, '#78461b');    // 琥珀真皮
    bg.addColorStop(1, '#4e2d12');      // 深琥珀色
    x.fillStyle = bg;
    x.fillRect(0, 0, S, S);

    // 皮革摺痕陰影 (斜角繪製)
    x.lineWidth = Math.max(8, S / 50);
    for (let i = 0; i < S * 2; i += S / 4) {
      const grad = x.createLinearGradient(i - S/2, 0, i + S/2, S);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0.4)');
      grad.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0.08)');
      x.strokeStyle = grad;
      x.beginPath();
      x.moveTo(i, 0); x.lineTo(i - S, S);
      x.stroke();
    }

    // 皮革縫線痕跡 (四週描邊細縫線)
    x.strokeStyle = 'rgba(0, 0, 0, 0.65)';
    x.lineWidth = Math.max(4, S / 80);
    x.strokeRect(6, 6, S - 12, S - 12);

    x.strokeStyle = '#ffd76a'; // 縫線金線
    x.lineWidth = Math.max(1.5, S / 180);
    x.setLineDash([Math.max(4, S/64), Math.max(4, S/64)]);
    x.strokeRect(8, 8, S - 16, S - 16);
    x.setLineDash([]); // 重設 dash

    // 皮革鈕扣與裝飾
    for (const [px, py] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
      const r = Math.max(4, S / 60);
      x.fillStyle = 'rgba(0, 0, 0, 0.45)'; // 扣子投影
      x.beginPath(); x.arc(px * S + 1.5, py * S + 1.5, r, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#d4a017'; // 金色扣子
      x.beginPath(); x.arc(px * S, py * S, r, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#ffffff'; // 高光
      x.beginPath(); x.arc(px * S - 1, py * S - 1, r * 0.4, 0, Math.PI * 2); x.fill();
    }
    return;
  }

  if (variant === 'gold') {
    // 黃金壓邊與金屬雕花
    const bg = x.createLinearGradient(0, 0, 0, S);
    bg.addColorStop(0, '#ffd76a');
    bg.addColorStop(0.4, '#d4a017');
    bg.addColorStop(0.8, '#8c6600');
    bg.addColorStop(1, '#543d00');
    x.fillStyle = bg;
    x.fillRect(0, 0, S, S);

    // 浮雕暗影刻線
    x.strokeStyle = '#3a2700';
    x.lineWidth = Math.max(3, S / 80);
    x.beginPath();
    x.arc(cx + 2, cy + 2, S * 0.3, 0, Math.PI * 1.5);
    x.arc(cx + 2, cy + 2, S * 0.15, Math.PI * 0.5, Math.PI * 2);
    x.stroke();

    // 浮雕亮線
    x.strokeStyle = '#ffffff';
    x.lineWidth = Math.max(1.5, S / 150);
    x.beginPath();
    x.arc(cx - 2, cy - 2, S * 0.3, 0, Math.PI * 1.5);
    x.arc(cx - 2, cy - 2, S * 0.15, Math.PI * 0.5, Math.PI * 2);
    x.stroke();
    return;
  }

  if (variant === 'steel' || variant === 'gunmetal') {
    // 深鐵槍色 / 鋼鐵質感
    const bg = x.createLinearGradient(0, 0, S, S);
    bg.addColorStop(0, '#2e2e2e');
    bg.addColorStop(0.5, '#4a4a4a');
    bg.addColorStop(1, '#1b1b1b');
    x.fillStyle = bg;
    x.fillRect(0, 0, S, S);

    // 金屬拉絲拉痕
    x.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    x.lineWidth = Math.max(1, S / 200);
    for (let i = 0; i < S; i += S / 20) {
      x.beginPath();
      x.moveTo(0, i); x.lineTo(S, i);
      x.stroke();
    }

    // 金屬倒角邊緣亮線
    x.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    x.lineWidth = Math.max(2, S / 120);
    x.strokeRect(3, 3, S - 6, S - 6);
    return;
  }

  if (variant === 'bullet') {
    // 子彈黃銅與彈頭質感
    const bg = x.createLinearGradient(0, 0, S, 0);
    bg.addColorStop(0, '#543d00');
    bg.addColorStop(0.5, '#d4a017');
    bg.addColorStop(0.7, '#ffd76a');
    bg.addColorStop(1, '#543d00');
    x.fillStyle = bg;
    x.fillRect(0, 0, S, S);

    // 彈頭與彈殼分界凹槽線 (垂直分界)
    x.strokeStyle = '#2d1f00';
    x.lineWidth = Math.max(4, S / 60);
    x.beginPath();
    x.moveTo(S * 0.65, 0); x.lineTo(S * 0.65, S);
    x.stroke();

    // 彈頭亮銅色 gradient
    const bulletTip = x.createLinearGradient(S * 0.65, 0, S, 0);
    bulletTip.addColorStop(0, '#b33c00'); // 紅銅/金屬紅
    bulletTip.addColorStop(0.5, '#ff7a18'); // 亮彈頭
    bulletTip.addColorStop(1, '#5a1200');
    x.fillStyle = bulletTip;
    x.fillRect(S * 0.65 + 2, 0, S * 0.35, S);
    return;
  }

  // Fallback / Default body: 皮革網格
  const bgDef = x.createLinearGradient(0, 0, S, S);
  bgDef.addColorStop(0, '#4e2d12');
  bgDef.addColorStop(0.5, '#78461b');
  bgDef.addColorStop(1, '#331d0b');
  x.fillStyle = bgDef;
  x.fillRect(0, 0, S, S);

  x.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  x.lineWidth = 1.5;
  for (let i = 0; i < S; i += S / 16) {
    x.beginPath(); x.moveTo(i, 0); x.lineTo(i, S); x.stroke();
    x.beginPath(); x.moveTo(0, i); x.lineTo(S, i); x.stroke();
  }
}
