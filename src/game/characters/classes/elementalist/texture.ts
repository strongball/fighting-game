// @ts-nocheck
export function drawElementalistTexture(x, S) {
  // 1. Base Silk Vestment & Hair Shading Gradient (Ivory & Warm Platinum with high contrast bottom shadow)
  const baseGrad = x.createLinearGradient(0, 0, 0, S);
  baseGrad.addColorStop(0, '#ffffff');      // bright white shine at top
  baseGrad.addColorStop(0.35, '#f5ecd2');   // warm ivory mid
  baseGrad.addColorStop(0.75, '#c5b690');   // deep shadow base
  baseGrad.addColorStop(1.0, '#8f7f57');    // occlusion shadow at bottom
  x.fillStyle = baseGrad;
  x.fillRect(0, 0, S, S);

  // Vertical hair strand lines to simulate realistic dynamic hair fibers
  x.fillStyle = 'rgba(105, 90, 60, 0.16)';
  for (let i = 0; i < 14; i++) {
    const hWidth = Math.max(1, S * 0.012);
    const hPos = S * (i / 13);
    x.fillRect(hPos - hWidth/2, 0, hWidth, S);
  }
  x.fillStyle = 'rgba(255, 255, 255, 0.22)';
  for (let i = 0; i < 8; i++) {
    const hWidth = Math.max(1, S * 0.008);
    const hPos = S * ((i + 0.5) / 8);
    x.fillRect(hPos - hWidth/2, 0, hWidth, S * 0.82); // shines fade out near bottom
  }

  // Soft fabric folds & depth shading
  x.fillStyle = 'rgba(0, 0, 0, 0.05)';
  for (let i = 0; i < 5; i++) {
    const w = S * 0.08;
    const px = S * (0.2 + i * 0.15);
    x.beginPath();
    x.moveTo(px, 0);
    x.quadraticCurveTo(px + w, S * 0.5, px - w, S);
    x.lineTo(px - w + S * 0.04, S);
    x.quadraticCurveTo(px + w + S * 0.04, S * 0.5, px + S * 0.04, 0);
    x.closePath();
    x.fill();
  }

  // Soft highlights for fabric ridges
  x.fillStyle = 'rgba(255, 255, 255, 0.15)';
  for (let i = 0; i < 4; i++) {
    const w = S * 0.03;
    const px = S * (0.28 + i * 0.17);
    x.beginPath();
    x.moveTo(px, 0);
    x.quadraticCurveTo(px - w, S * 0.4, px + w, S);
    x.lineTo(px + w + S * 0.02, S);
    x.quadraticCurveTo(px - w + S * 0.02, S * 0.4, px + S * 0.02, 0);
    x.closePath();
    x.fill();
  }

  // 2. Fire Element Zone (Warm gradients, flame graphics at bottom-left)
  const fireGrad = x.createRadialGradient(S * 0.2, S * 0.8, 5, S * 0.2, S * 0.8, S * 0.35);
  fireGrad.addColorStop(0, 'rgba(255, 90, 16, 0.85)');
  fireGrad.addColorStop(0.5, 'rgba(243, 156, 18, 0.65)');
  fireGrad.addColorStop(1, 'rgba(243, 156, 18, 0)');
  x.fillStyle = fireGrad;
  x.beginPath();
  x.arc(S * 0.2, S * 0.8, S * 0.35, 0, Math.PI * 2);
  x.fill();

  // Draw flame sparks/curves
  x.fillStyle = 'rgba(255, 230, 138, 0.9)';
  for (let i = 0; i < 3; i++) {
    const fx = S * (0.12 + i * 0.08);
    const fy = S * (0.75 - i * 0.05);
    x.beginPath();
    x.moveTo(fx, fy);
    x.quadraticCurveTo(fx - S * 0.06, fy + S * 0.12, fx - S * 0.02, fy + S * 0.2);
    x.quadraticCurveTo(fx + S * 0.05, fy + S * 0.14, fx, fy);
    x.closePath();
    x.fill();
  }

  // 3. Ice Element Zone (Fractured crystal geometry at bottom-right)
  const iceGrad = x.createRadialGradient(S * 0.8, S * 0.8, 5, S * 0.8, S * 0.8, S * 0.35);
  iceGrad.addColorStop(0, 'rgba(116, 224, 255, 0.7)');
  iceGrad.addColorStop(0.6, 'rgba(160, 232, 255, 0.4)');
  iceGrad.addColorStop(1, 'rgba(160, 232, 255, 0)');
  x.fillStyle = iceGrad;
  x.beginPath();
  x.arc(S * 0.8, S * 0.8, S * 0.35, 0, Math.PI * 2);
  x.fill();

  // Draw crystalline facets
  const pts = [
    { x: S * 0.72, y: S * 0.82 },
    { x: S * 0.85, y: S * 0.72 },
    { x: S * 0.92, y: S * 0.88 },
    { x: S * 0.78, y: S * 0.94 },
    { x: S * 0.82, y: S * 0.84 }, // center
  ];
  const facets = [
    [0, 1, 4, 'rgba(255, 255, 255, 0.4)'],
    [1, 2, 4, 'rgba(180, 240, 255, 0.5)'],
    [2, 3, 4, 'rgba(120, 210, 255, 0.3)'],
    [3, 0, 4, 'rgba(200, 245, 255, 0.45)'],
  ];
  for (const [p1, p2, p3, col] of facets) {
    x.fillStyle = col;
    x.beginPath();
    x.moveTo(pts[p1].x, pts[p1].y);
    x.lineTo(pts[p2].x, pts[p2].y);
    x.lineTo(pts[p3].x, pts[p3].y);
    x.closePath();
    x.fill();
  }

  // 4. Lightning Element Zone (Electric blue rune waves at center-top)
  const stormGrad = x.createRadialGradient(S * 0.5, S * 0.25, 2, S * 0.5, S * 0.25, S * 0.25);
  stormGrad.addColorStop(0, 'rgba(140, 90, 255, 0.65)');
  stormGrad.addColorStop(0.7, 'rgba(66, 165, 245, 0.3)');
  stormGrad.addColorStop(1, 'rgba(66, 165, 245, 0)');
  x.fillStyle = stormGrad;
  x.beginPath();
  x.arc(S * 0.5, S * 0.25, S * 0.25, 0, Math.PI * 2);
  x.fill();

  // Draw lightning spikes
  x.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  x.lineWidth = Math.max(1.5, S * 0.012);
  x.shadowColor = '#42a5f5';
  x.shadowBlur = S * 0.04;
  x.beginPath();
  let lx = S * 0.38, ly = S * 0.22;
  x.moveTo(lx, ly);
  const steps = [
    { dx: 0.05, dy: -0.04 },
    { dx: -0.02, dy: 0.06 },
    { dx: 0.06, dy: -0.02 },
    { dx: 0.04, dy: 0.05 }
  ];
  for (const step of steps) {
    lx += step.dx * S;
    ly += step.dy * S;
    x.lineTo(lx, ly);
  }
  x.stroke();
  x.shadowBlur = 0; // Reset shadow

  // 5. Embossed Gold Engravings (Trims along bottom border)
  const drawEmbossedPath = (points, width) => {
    // 5A. Bottom shadow
    x.strokeStyle = 'rgba(58, 42, 5, 0.65)';
    x.lineWidth = width;
    x.beginPath();
    x.moveTo(points[0].x + S * 0.008, points[0].y + S * 0.008);
    for (let i = 1; i < points.length; i++) {
      x.lineTo(points[i].x + S * 0.008, points[i].y + S * 0.008);
    }
    x.stroke();

    // 5B. Top highlight
    x.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    x.lineWidth = width;
    x.beginPath();
    x.moveTo(points[0].x - S * 0.006, points[0].y - S * 0.006);
    for (let i = 1; i < points.length; i++) {
      x.lineTo(points[i].x - S * 0.006, points[i].y - S * 0.006);
    }
    x.stroke();

    // 5C. Main Gold Line
    const goldGrad = x.createLinearGradient(points[0].x, points[0].y, points[points.length - 1].x, points[points.length - 1].y);
    goldGrad.addColorStop(0, '#f9d375');
    goldGrad.addColorStop(0.5, '#e0ab32');
    goldGrad.addColorStop(1, '#f9d375');
    x.strokeStyle = goldGrad;
    x.lineWidth = width;
    x.beginPath();
    x.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      x.lineTo(points[i].x, points[i].y);
    }
    x.stroke();
  };

  // Draw gold border lines
  const borderPoints = [
    { x: S * 0.05, y: S * 0.9 },
    { x: S * 0.35, y: S * 0.85 },
    { x: S * 0.5, y: S * 0.88 },
    { x: S * 0.65, y: S * 0.85 },
    { x: S * 0.95, y: S * 0.9 },
  ];
  drawEmbossedPath(borderPoints, Math.max(3, S * 0.024));

  // Draw gold spiral details (emblems) at center
  x.fillStyle = 'rgba(58, 42, 5, 0.5)';
  x.beginPath();
  x.arc(S * 0.5, S * 0.55, S * 0.08, 0, Math.PI * 2);
  x.fill();
  
  const goldCoreGrad = x.createRadialGradient(S * 0.5, S * 0.55, 1, S * 0.5, S * 0.55, S * 0.08);
  goldCoreGrad.addColorStop(0, '#ffe8a3');
  goldCoreGrad.addColorStop(0.7, '#dca629');
  goldCoreGrad.addColorStop(1, '#9d7211');
  x.fillStyle = goldCoreGrad;
  x.beginPath();
  x.arc(S * 0.5, S * 0.55, S * 0.07, 0, Math.PI * 2);
  x.fill();

  // Specular highlight cross
  x.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  x.lineWidth = Math.max(1, S * 0.008);
  x.beginPath();
  x.moveTo(S * 0.45, S * 0.55);
  x.lineTo(S * 0.55, S * 0.55);
  x.moveTo(S * 0.5, S * 0.5);
  x.lineTo(S * 0.5, S * 0.6);
  x.stroke();

  // Floating magic sparkles
  x.fillStyle = 'rgba(255, 255, 255, 0.8)';
  for (let i = 0; i < 15; i++) {
    const px = Math.abs((Math.sin(i * 12.9898 + 4.2) * 43758.5453) % 1);
    const py = Math.abs((Math.sin(i * 78.233 - 1.8) * 24634.6345) % 1);
    x.fillRect(px * S, py * S, Math.max(1.5, S * 0.015), Math.max(1.5, S * 0.015));
  }
}
