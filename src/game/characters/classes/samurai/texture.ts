// @ts-nocheck
export function drawSamuraiTexture(x, S) {
  // 武士：和風波紋與緋紅刀痕
  x.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  x.lineWidth = 2;
  for (let i = 0; i < 5; i++) { x.beginPath(); x.arc(S / 2, S + 20, 30 + i * 22, Math.PI * 1.15, Math.PI * 1.85); x.stroke(); }
  x.strokeStyle = 'rgba(255, 80, 60, 0.7)';
  x.lineWidth = 4;
  x.beginPath(); x.moveTo(18, 24); x.lineTo(S - 24, S - 40); x.stroke();
}

export function drawSamuraiMaterialTexture(x, S, meta = {}) {
  const variant = meta.variant || 'body';
  const cx = S / 2;
  const cy = S / 2;

  if (variant === 'hair') {
    // 髮根深褐陰影到髮梢白金
    const grad = x.createLinearGradient(0, S, 0, 0);
    grad.addColorStop(0, '#544941');    // 髮梢/底層陰影
    grad.addColorStop(0.3, '#d4cfc5');  // 灰白
    grad.addColorStop(0.7, '#f4f2eb');  // 亮白
    grad.addColorStop(1, '#ffffff');    // 高光極致白
    x.fillStyle = grad;
    x.fillRect(0, 0, S, S);

    // 髮絲紋理：暗色髮絲陰影
    x.strokeStyle = 'rgba(95, 85, 75, 0.4)';
    x.lineWidth = Math.max(1.5, S / 30);
    for (let u = S / 8; u < S; u += S / 4) {
      x.beginPath();
      x.moveTo(u, S);
      x.lineTo(cx + (u - cx) * 0.15, 0);
      x.stroke();
    }

    // 細部髮絲陰影
    x.strokeStyle = 'rgba(100, 90, 80, 0.2)';
    x.lineWidth = Math.max(1, S / 60);
    for (let u = S / 6; u < S; u += S / 3) {
      x.beginPath();
      x.moveTo(u, S);
      x.lineTo(cx + (u - cx) * 0.25, 0);
      x.stroke();
    }

    // 髮絲亮線
    x.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    x.lineWidth = Math.max(1.5, S / 45);
    for (let u = S / 3; u < S; u += S / 3) {
      x.beginPath();
      x.moveTo(u - S / 10, S);
      x.lineTo(cx + (u - S / 10 - cx) * 0.1, 0);
      x.stroke();
    }
    return;
  }

  if (variant === 'hat') {
    // 斗笠：編織竹篾紋理
    const bg = x.createRadialGradient(cx, cy, 5, cx, cy, S * 0.7);
    bg.addColorStop(0, '#dcd3b8');      // 頂部淺黃褐
    bg.addColorStop(0.6, '#bfa680');    // 中部草黃色
    bg.addColorStop(1, '#8a6e4d');      // 邊緣深褐
    x.fillStyle = bg;
    x.fillRect(0, 0, S, S);

    // 編織放射紋
    x.strokeStyle = 'rgba(110, 85, 55, 0.22)';
    x.lineWidth = Math.max(1.2, S / 100);
    const radialSpokes = 32;
    for (let i = 0; i < radialSpokes; i++) {
      const angle = (i / radialSpokes) * Math.PI * 2;
      x.beginPath();
      x.moveTo(cx, cy);
      x.lineTo(cx + Math.cos(angle) * S, cy + Math.sin(angle) * S);
      x.stroke();
    }

    // 編織同心圓環線
    x.strokeStyle = 'rgba(87, 65, 40, 0.18)';
    x.lineWidth = Math.max(1.5, S / 80);
    for (let r = S / 8; r < S * 0.7; r += S / 10) {
      x.beginPath();
      x.arc(cx, cy, r, 0, Math.PI * 2);
      x.stroke();
    }

    // 斗笠邊緣陰影與金色外框
    x.strokeStyle = 'rgba(56, 40, 24, 0.65)';
    x.lineWidth = Math.max(3, S / 40);
    x.strokeRect(4, 4, S - 8, S - 8);

    x.strokeStyle = '#c5a363'; // 金色緣邊
    x.lineWidth = Math.max(1.5, S / 80);
    x.strokeRect(6, 6, S - 12, S - 12);
    return;
  }

  if (variant === 'robe' || variant === 'cloth') {
    // 墮天黑袍布料紋理 (深灰色偏黑帶微紅調)
    const bg = x.createLinearGradient(0, 0, S, S);
    bg.addColorStop(0, '#151313');
    bg.addColorStop(0.5, '#262020');
    bg.addColorStop(1, '#1b1919');
    x.fillStyle = bg;
    x.fillRect(0, 0, S, S);

    // 和風波浪與深灰波浪格線
    x.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    x.lineWidth = 1.5;
    for (let i = -S; i < S * 2; i += 24) {
      x.beginPath();
      x.arc(i, S / 2, S * 0.4, Math.PI * 1.2, Math.PI * 1.8);
      x.stroke();
    }

    // 緋紅刀痕/血印摺痕 (與主題呼應)
    x.strokeStyle = 'rgba(217, 67, 67, 0.2)';
    x.lineWidth = Math.max(4, S / 30);
    x.beginPath();
    x.moveTo(S * 0.1, S * 0.25);
    x.lineTo(S * 0.9, S * 0.75);
    x.stroke();

    // 邊緣縫線
    x.strokeStyle = '#d94343'; // 緋紅滾邊線
    x.lineWidth = Math.max(2, S / 60);
    x.setLineDash([Math.max(3, S / 40), Math.max(3, S / 40)]);
    x.strokeRect(4, 4, S - 8, S - 8);
    x.setLineDash([]);
    return;
  }

  if (variant === 'steel' || variant === 'armor') {
    // 鋼鐵/刀刃暗色紋理
    const bg = x.createLinearGradient(0, 0, S, S);
    bg.addColorStop(0, '#2b2a27');
    bg.addColorStop(0.5, '#52504a');
    bg.addColorStop(1, '#1a1918');
    x.fillStyle = bg;
    x.fillRect(0, 0, S, S);

    // 暗影凹槽與亮面拉絲
    x.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    x.lineWidth = 1;
    for (let i = 0; i < S; i += 8) {
      x.beginPath();
      x.moveTo(0, i); x.lineTo(S, i);
      x.stroke();
    }

    // 鋼鐵倒角邊緣高光
    x.strokeStyle = '#f2f0dc'; // 鋼鐵亮白色
    x.lineWidth = Math.max(2, S / 60);
    x.strokeRect(3, 3, S - 6, S - 6);
    return;
  }

  if (variant === 'gold') {
    // 奢華浮雕黃金
    const bg = x.createLinearGradient(0, 0, 0, S);
    bg.addColorStop(0, '#f9db7b');
    bg.addColorStop(0.4, '#cda341');
    bg.addColorStop(0.8, '#8b691b');
    bg.addColorStop(1, '#533e0d');
    x.fillStyle = bg;
    x.fillRect(0, 0, S, S);

    // 迴紋雕花 - 暗色凹槽
    x.strokeStyle = '#423108';
    x.lineWidth = Math.max(3, S / 40);
    x.beginPath();
    x.arc(cx + 1.5, cy + 1.5, S * 0.25, 0, Math.PI * 1.6);
    x.stroke();

    // 迴紋雕花 - 亮色高光
    x.strokeStyle = '#ffffff';
    x.lineWidth = Math.max(1.5, S / 80);
    x.beginPath();
    x.arc(cx - 1.5, cy - 1.5, S * 0.25, 0, Math.PI * 1.6);
    x.stroke();
    return;
  }

  // Fallback
  const bgDef = x.createLinearGradient(0, 0, S, S);
  bgDef.addColorStop(0, '#1c1b1b');
  bgDef.addColorStop(0.5, '#2e2c2c');
  bgDef.addColorStop(1, '#121111');
  x.fillStyle = bgDef;
  x.fillRect(0, 0, S, S);

  x.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  x.lineWidth = 1;
  for (let i = 0; i < S; i += 16) {
    x.beginPath(); x.moveTo(i, 0); x.lineTo(i, S); x.stroke();
    x.beginPath(); x.moveTo(0, i); x.lineTo(S, i); x.stroke();
  }
}
