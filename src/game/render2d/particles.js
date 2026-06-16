import { BODY_HEIGHT, PARTICLE_MAX, PLAYER_RADIUS, TILT } from '../constants.js';
import { clamp, sx, sy } from './utils.js';

export function createParticleSystem(ctx) {
  const particles = [];

  function add(p) {
    p.maxLife = p.life;
    particles.push(p);
    if (particles.length > PARTICLE_MAX) particles.splice(0, particles.length - PARTICLE_MAX);
  }

  function update(dt) {
    for (const p of particles) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.vz !== undefined) { p.z += p.vz * dt; p.vz -= (p.gravity || 0) * dt; }
      if (p.z !== undefined && p.z < 0) { p.z = 0; p.vz = 0; p.vx *= 0.5; p.vy *= 0.5; }
      const f = Math.exp(-(p.drag || 0) * dt);
      p.vx *= f; p.vy *= f;
    }
    let n = 0;
    for (const p of particles) if (p.life > 0) particles[n++] = p;
    particles.length = n;
  }

  function draw() {
    ctx.save();
    for (const p of particles) {
      const lf = clamp(p.life / p.maxLife, 0, 1);
      const px = sx(p.x), py = sy(p.y) - (p.z || 0);
      ctx.globalAlpha = lf;
      ctx.globalCompositeOperation = p.additive ? 'lighter' : 'source-over';
      ctx.fillStyle = p.color; ctx.strokeStyle = p.color;
      if (p.streak && (p.vx || p.vy)) {
        ctx.lineWidth = p.size; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px - p.vx * 0.045, py - p.vy * 0.045 * TILT);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(px, py, p.size * (0.45 + 0.55 * lf), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function spawnSparks(wx, wy, z, color, n, opt = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = (opt.speed || 130) * (0.4 + Math.random());
      add({
        x: wx, y: wy, z,
        vx: Math.cos(a) * spd, vy: Math.sin(a) * spd * 0.75,
        vz: opt.up ? 70 + Math.random() * 110 : Math.random() * 150 - 30,
        gravity: opt.up ? 70 : 220, drag: 2.5,
        life: 0.28 + Math.random() * 0.4, size: 1.6 + Math.random() * 2.4,
        color, additive: true, streak: true,
      });
    }
  }

  function spawnDebris(wx, wy, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 90 + Math.random() * 230;
      add({
        x: wx, y: wy, z: BODY_HEIGHT * 0.4,
        vx: Math.cos(a) * spd, vy: Math.sin(a) * spd * 0.7,
        vz: 120 + Math.random() * 200, gravity: 460, drag: 1.2,
        life: 0.5 + Math.random() * 0.5, size: 2 + Math.random() * 3,
        color, additive: false,
      });
    }
  }

  function spawnStreaks(wx, wy, facing, color) {
    for (let i = 0; i < 10; i++) {
      const a = facing + Math.PI + (Math.random() - 0.5) * 0.9;
      const spd = 180 + Math.random() * 260;
      add({
        x: wx, y: wy, z: BODY_HEIGHT * (0.3 + Math.random() * 0.6),
        vx: Math.cos(a) * spd, vy: Math.sin(a) * spd * 0.75, vz: 0,
        gravity: 0, drag: 4, life: 0.22 + Math.random() * 0.18,
        size: 2 + Math.random() * 2, color, additive: true, streak: true,
      });
    }
  }

  function spawnDust(wx, wy) {
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2;
      add({
        x: wx + Math.cos(a) * PLAYER_RADIUS * 0.5, y: wy + Math.sin(a) * PLAYER_RADIUS * 0.4, z: 0,
        vx: Math.cos(a) * 32, vy: Math.sin(a) * 24, vz: 18 + Math.random() * 26,
        gravity: 120, drag: 4.5, life: 0.32 + Math.random() * 0.22,
        size: 2.4 + Math.random() * 2.2, color: 'rgba(150,162,175,0.55)', additive: false,
      });
    }
  }

  return { add, update, draw, spawnSparks, spawnDebris, spawnStreaks, spawnDust };
}
