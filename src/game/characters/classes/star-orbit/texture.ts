// @ts-nocheck
export function drawStarOrbitTexture(x, S) {
  x.strokeStyle = 'rgba(90, 215, 255, 0.65)';
  x.lineWidth = 3;
  x.beginPath(); x.arc(S / 2, S / 2, 46, 0, Math.PI * 2); x.stroke();
  x.strokeStyle = 'rgba(255, 209, 102, 0.7)';
  x.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const px = S / 2 + Math.cos(a) * 35;
    const py = S / 2 + Math.sin(a) * 35;
    x.beginPath(); x.arc(px, py, 7, 0, Math.PI * 2); x.stroke();
  }
  x.fillStyle = 'rgba(242, 247, 255, 0.55)';
  x.beginPath(); x.arc(S / 2, S / 2, 12, 0, Math.PI * 2); x.fill();
}

export function drawStarOrbitMaterialTexture(x, S, meta = {}) {
  const variant = meta.variant || 'body';
  const cx = S / 2;
  const cy = S / 2;

  if (variant === 'hair') {
    const grad = x.createLinearGradient(0, S, 0, 0);
    grad.addColorStop(0, '#664e14');    // Soft warm golden-brown shadow at roots
    grad.addColorStop(0.3, '#b38c24');  // Soft medium gold
    grad.addColorStop(0.7, '#ffd166');  // Bright starlight gold
    grad.addColorStop(1, '#ffffff');    // Shining starlight tips
    x.fillStyle = grad;
    x.fillRect(0, 0, S, S);

    // Draw vertical strand shadow lines with softer opacity and warmer color
    x.strokeStyle = 'rgba(102, 78, 20, 0.38)';
    x.lineWidth = Math.max(3, S / 15);
    for (let u = S / 8; u < S; u += S / 4) {
      x.beginPath();
      x.moveTo(u, S);
      x.lineTo(cx + (u - cx) * 0.1, 0);
      x.stroke();
    }

    // Secondary thinner shadow lines
    x.strokeStyle = 'rgba(128, 100, 30, 0.28)';
    x.lineWidth = Math.max(1.5, S / 30);
    for (let u = S / 6; u < S; u += S / 3) {
      x.beginPath();
      x.moveTo(u, S);
      x.lineTo(cx + (u - cx) * 0.2, 0);
      x.stroke();
    }

    // Bright highlights lines
    x.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    x.lineWidth = Math.max(2, S / 35);
    for (let u = S / 3; u < S; u += S / 3) {
      x.beginPath();
      x.moveTo(u - S / 12, S);
      x.lineTo(cx + (u - S / 12 - cx) * 0.1, 0);
      x.stroke();
    }
    return;
  }

  if (variant === 'robe') {
    // Deep Space Midnight Blue robe
    const bg = x.createLinearGradient(0, 0, S, S);
    bg.addColorStop(0, '#020614');
    bg.addColorStop(0.5, '#071638');
    bg.addColorStop(1, '#030822');
    x.fillStyle = bg;
    x.fillRect(0, 0, S, S);

    // Diagonal fold shading (glow lines representing starlight folds)
    x.lineWidth = Math.max(12, S / 40);
    for (let i = 0; i < S * 2; i += S / 4) {
      const grad = x.createLinearGradient(i - S / 2, 0, i + S / 2, S);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
      grad.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
      grad.addColorStop(1, 'rgba(90, 215, 255, 0.12)');
      x.strokeStyle = grad;
      x.beginPath();
      x.moveTo(i, 0); x.lineTo(i - S, S);
      x.stroke();
    }

    // Outer border trim drop shadow
    x.strokeStyle = 'rgba(0, 0, 0, 0.85)';
    x.lineWidth = Math.max(6, S / 50);
    x.strokeRect(6, 6, S - 12, S - 12);

    // Gold borders
    x.strokeStyle = '#ffd166';
    x.lineWidth = Math.max(4, S / 60);
    x.strokeRect(4, 4, S - 8, S - 8);

    // Orbital ring carvings on robe
    x.strokeStyle = 'rgba(90, 215, 255, 0.55)';
    x.lineWidth = Math.max(1.5, S / 180);
    x.beginPath();
    x.arc(cx, cy, S * 0.3, 0, Math.PI * 2);
    x.stroke();

    // Star connections
    x.strokeStyle = 'rgba(255, 209, 102, 0.4)';
    x.lineWidth = Math.max(1, S / 200);
    x.beginPath();
    x.moveTo(S * 0.3, S * 0.4);
    x.lineTo(S * 0.5, S * 0.35);
    x.lineTo(S * 0.7, S * 0.45);
    x.lineTo(S * 0.6, S * 0.7);
    x.lineTo(S * 0.4, S * 0.65);
    x.closePath();
    x.stroke();

    // Glowing stars
    for (const [px, py] of [[0.3, 0.4], [0.5, 0.35], [0.7, 0.45], [0.6, 0.7], [0.4, 0.65]]) {
      const r = Math.max(2.5, S / 90);
      x.fillStyle = 'rgba(90, 215, 255, 0.55)';
      x.beginPath(); x.arc(px * S, py * S, r * 2.2, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#ffffff';
      x.beginPath(); x.arc(px * S, py * S, r, 0, Math.PI * 2); x.fill();
    }
    return;
  }

  if (variant === 'armor') {
    // Stellar White Armor Plates
    const bg = x.createLinearGradient(0, 0, S, S);
    bg.addColorStop(0, '#f8f9fa');
    bg.addColorStop(0.5, '#e9ecef');
    bg.addColorStop(1, '#dee2e6');
    x.fillStyle = bg;
    x.fillRect(0, 0, S, S);

    // Curved plates
    const cellSize = S / 4;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const px = c * cellSize;
        const py = r * cellSize;
        const cellGrad = x.createRadialGradient(px + cellSize * 0.3, py + cellSize * 0.3, 2, px + cellSize / 2, py + cellSize / 2, cellSize * 0.75);
        cellGrad.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        cellGrad.addColorStop(0.5, 'rgba(233, 236, 239, 0.3)');
        cellGrad.addColorStop(1, 'rgba(173, 181, 189, 0.4)');
        x.fillStyle = cellGrad;
        x.fillRect(px + 1, py + 1, cellSize - 2, cellSize - 2);
      }
    }

    // Glowing cyan circuit lines
    x.strokeStyle = '#5ad7ff';
    x.lineWidth = Math.max(2.2, S / 110);
    x.shadowColor = '#5ad7ff';
    x.shadowBlur = 10;
    x.beginPath();
    for (let i = S / 4; i < S; i += S / 4) {
      x.moveTo(i, 0); x.lineTo(i, S);
      x.moveTo(0, i); x.lineTo(S, i);
    }
    x.stroke();
    x.shadowBlur = 0;

    // Bevels
    x.strokeStyle = 'rgba(100, 110, 130, 0.42)';
    x.lineWidth = Math.max(2, S / 120);
    x.beginPath();
    for (let i = S / 4; i < S; i += S / 4) {
      x.moveTo(i - 1, 0); x.lineTo(i - 1, S);
      x.moveTo(0, i - 1); x.lineTo(S, i - 1);
    }
    x.stroke();

    x.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    x.lineWidth = Math.max(1, S / 200);
    x.beginPath();
    for (let i = S / 4; i < S; i += S / 4) {
      x.moveTo(i + 1.5, 0); x.lineTo(i + 1.5, S);
      x.moveTo(0, i + 1.5); x.lineTo(S, i + 1.5);
    }
    x.stroke();
    return;
  }

  if (variant === 'gold') {
    const bg = x.createLinearGradient(0, 0, 0, S);
    bg.addColorStop(0, '#ffd97d');
    bg.addColorStop(0.3, '#ffd166');
    bg.addColorStop(0.7, '#b38a2e');
    bg.addColorStop(1, '#664e14');
    x.fillStyle = bg;
    x.fillRect(0, 0, S, S);

    // Engraving shadow (offset bottom-right)
    x.strokeStyle = '#33240a';
    x.lineWidth = Math.max(2.5, S / 90);
    x.beginPath();
    x.arc(cx + 1.5, cy + 1.5, S * 0.35, 0, Math.PI * 1.5);
    x.arc(cx + 1.5, cy + 1.5, S * 0.2, Math.PI * 0.5, Math.PI * 2);
    x.stroke();

    // Specular highlight (offset top-left)
    x.strokeStyle = '#ffffff';
    x.lineWidth = Math.max(1.5, S / 150);
    x.beginPath();
    x.arc(cx - 1.5, cy - 1.5, S * 0.35, 0, Math.PI * 1.5);
    x.arc(cx - 1.5, cy - 1.5, S * 0.2, Math.PI * 0.5, Math.PI * 2);
    x.stroke();
    return;
  }

  if (variant === 'glass') {
    const bg = x.createLinearGradient(0, 0, S, 0);
    bg.addColorStop(0, '#a8f2ff');
    bg.addColorStop(0.35, '#5ad7ff');
    bg.addColorStop(0.7, '#009bd4');
    bg.addColorStop(1, '#003e5c');
    x.fillStyle = bg;
    x.fillRect(0, 0, S, S);

    const fillFacet = (p1, p2, p3, fillStyle) => {
      x.fillStyle = fillStyle;
      x.beginPath();
      x.moveTo(p1[0], p1[1]);
      x.lineTo(p2[0], p2[1]);
      x.lineTo(p3[0], p3[1]);
      x.closePath();
      x.fill();
    };

    fillFacet([0, 0], [cx, cy], [S, 0], 'rgba(0, 30, 80, 0.35)');
    fillFacet([S, S], [cx, cy], [0, S], 'rgba(0, 20, 60, 0.25)');
    fillFacet([S, 0], [cx, cy], [S, S], 'rgba(255, 255, 255, 0.1)');
    fillFacet([0, S], [cx, cy], [0, 0], 'rgba(255, 255, 255, 0.18)');

    // Facet borders
    x.strokeStyle = 'rgba(0, 30, 60, 0.7)';
    x.lineWidth = Math.max(3, S / 90);
    x.beginPath();
    x.moveTo(0, 0); x.lineTo(cx, cy); x.lineTo(S, 0);
    x.moveTo(S, 0); x.lineTo(cx, cy); x.lineTo(S, S);
    x.moveTo(S, S); x.lineTo(cx, cy); x.lineTo(0, S);
    x.moveTo(0, S); x.lineTo(cx, cy); x.lineTo(0, 0);
    x.stroke();

    // Refraction highlights
    x.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    x.lineWidth = Math.max(1.8, S / 150);
    x.strokeRect(4, 4, S - 8, S - 8);

    x.beginPath();
    x.moveTo(S * 0.1, 0); x.lineTo(S, S * 0.9);
    x.stroke();
    return;
  }

  const bg = x.createLinearGradient(0, 0, S, S);
  bg.addColorStop(0, '#0c1a2e');
  bg.addColorStop(0.5, '#1e3c5c');
  bg.addColorStop(1, '#081220');
  x.fillStyle = bg;
  x.fillRect(0, 0, S, S);
}
