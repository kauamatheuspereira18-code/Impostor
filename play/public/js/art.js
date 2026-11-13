/* Arte procedural no estilo do Among Us.
   Tudo é desenhado em canvas: corpo, mochila, viseira, pernas animadas,
   cadáver, duto, porta, botão de emergência e mesa da Cafeteria. */

/* ---------- utilidades de cor ---------- */
export function hexToRgb(hex) {
  const h = String(hex).replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function shade(hex, amt) {
  const { r, g, b } = hexToRgb(hex);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + amt)));
  return `rgb(${f(r)}, ${f(g)}, ${f(b)})`;
}

export function mix(hexA, hexB, t) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const f = (x, y) => Math.round(x + (y - x) * t);
  return `rgb(${f(a.r, b.r)}, ${f(a.g, b.g)}, ${f(a.b, b.b)})`;
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

/* ============================================================
   TRIPULANTE
   ============================================================
   h        altura em pixels
   walk     0..1 fase da caminhada (0 = parado)
   facing   -1 esquerda / 1 direita
   ghost    fantasma (translúcido, sem sombra, cauda ondulada)
   outline  contorno escuro (o jogo usa silhueta recortada)
*/
/* Catálogo enxuto de chapéus e pets (mesmas categorias do jogo). */
export const HATS = [
  'Sem chapéu', 'Boné', 'Gorro', 'Cartola', 'Coroa', 'Auréola',
  'Antena', 'Chapéu de festa', 'Flor', 'Pirata', 'Capacete', 'Chifres',
];
export const PETS = ['Sem pet', 'Mini tripulante', 'Cachorro', 'Gato', 'Robô'];

export function drawCrew(ctx, o) {
  const {
    x, y, h = 40, color = '#c51111', facing = 1,
    walk = 0, phase = 0, ghost = false, alpha = 1, outline = true,
    dead = false, highlight = false, hat = 0,
  } = o;
  const w = h * 0.74;
  ctx.save();
  ctx.translate(x, y);
  if (alpha !== 1) ctx.globalAlpha *= alpha;
  if (facing < 0) ctx.scale(-1, 1);

  // sombra no chão
  if (!ghost && !dead) {
    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    ctx.beginPath();
    ctx.ellipse(0, h * 0.46, w * 0.56, h * 0.10, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const step = Math.sin(walk * Math.PI * 2);
  const bob = Math.abs(step) * h * 0.035;
  const top = -h * 0.56 - bob;
  const bodyH = h * 0.86;

  // pernas (atrás do corpo)
  const legY = h * 0.22;
  const legW = w * 0.26;
  const legH = h * 0.26;
  const legs = [
    { dx: -w * 0.24, dy: step * h * 0.06, dark: 0.22 },
    { dx: w * 0.18, dy: -step * h * 0.06, dark: 0.1 },
  ];
  for (const l of legs) {
    ctx.fillStyle = shade(color, -40 - l.dark * 120);
    roundRect(ctx, l.dx - legW / 2, legY + l.dy, legW, legH, legW * 0.55);
    ctx.fill();
  }

  // mochila (atrás, do lado oposto ao rosto)
  ctx.fillStyle = shade(color, -55);
  roundRect(ctx, -w * 0.78, top + h * 0.20, w * 0.34, h * 0.40, w * 0.16);
  ctx.fill();
  ctx.fillStyle = shade(color, -20);
  roundRect(ctx, -w * 0.76, top + h * 0.23, w * 0.28, h * 0.10, w * 0.08);
  ctx.fill();

  // corpo: gradiente vertical (claro em cima, escuro embaixo)
  const grad = ctx.createLinearGradient(-w / 2, top, w / 2, top + bodyH);
  grad.addColorStop(0, shade(color, 26));
  grad.addColorStop(0.45, color);
  grad.addColorStop(1, shade(color, -48));
  ctx.fillStyle = grad;
  roundRect(ctx, -w / 2, top, w, bodyH, w * 0.46);
  ctx.fill();

  if (outline) {
    ctx.strokeStyle = shade(color, -110);
    ctx.lineWidth = Math.max(1.2, h * 0.035);
    ctx.stroke();
  }

  // brilho lateral
  ctx.save();
  ctx.globalAlpha *= 0.22;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, -w * 0.36, top + h * 0.08, w * 0.16, bodyH * 0.55, w * 0.08);
  ctx.fill();
  ctx.restore();

  // viseira
  const vw = w * 0.68;
  const vh = h * 0.30;
  const vx = w * 0.02;
  const vy = top + h * 0.16;
  const visorGrad = ctx.createLinearGradient(vx, vy, vx + vw, vy + vh);
  visorGrad.addColorStop(0, '#dff6ff');
  visorGrad.addColorStop(0.45, '#9fdcea');
  visorGrad.addColorStop(1, '#5fb6cc');
  ctx.fillStyle = visorGrad;
  roundRect(ctx, vx, vy, vw, vh, vh * 0.52);
  ctx.fill();
  ctx.strokeStyle = 'rgba(10,30,45,0.55)';
  ctx.lineWidth = Math.max(1, h * 0.026);
  ctx.stroke();
  // reflexo
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  roundRect(ctx, vx + vw * 0.16, vy + vh * 0.18, vw * 0.30, vh * 0.26, vh * 0.13);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  roundRect(ctx, vx + vw * 0.55, vy + vh * 0.55, vw * 0.22, vh * 0.16, vh * 0.08);
  ctx.fill();

  // fantasma: cauda ondulada no lugar das pernas
  if (ghost) {
    ctx.save();
    ctx.globalAlpha *= 0.5;
    ctx.fillStyle = shade(color, -10);
    ctx.beginPath();
    const by = h * 0.30;
    ctx.moveTo(-w / 2, by);
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const px = -w / 2 + w * t;
      const py = by + Math.sin(t * Math.PI * 3 + phase) * h * 0.07 + h * 0.14;
      ctx.lineTo(px, py);
    }
    ctx.lineTo(w / 2, by);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // chapéu (desenhado no mesmo espaço do corpo)
  if (hat > 0 && !ghost) drawHatInBody(ctx, hat, { w, h, top, color, phase });

  if (highlight) {
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.ellipse(0, h * 0.40, w * 0.72, h * 0.15, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

/** Chapéus desenhados no sistema de coordenadas do corpo. */
function drawHatInBody(ctx, id, o) {
  const { w, h, top, color, phase } = o;
  const cx = 0;
  const hy = top;              // topo da cabeça
  const hw = w * 0.84;         // largura do chapéu
  ctx.save();
  ctx.lineJoin = 'round';
  switch (id) {
    case 1: { // boné
      ctx.fillStyle = '#2f6fd0';
      ctx.beginPath();
      ctx.ellipse(cx, hy + h * 0.02, hw * 0.52, h * 0.17, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#24589f';
      roundRect(ctx, hw * 0.1, hy - h * 0.02, hw * 0.55, h * 0.06, h * 0.03);
      ctx.fill();
      break;
    }
    case 2: { // gorro
      ctx.fillStyle = '#e0533d';
      ctx.beginPath();
      ctx.ellipse(cx, hy + h * 0.04, hw * 0.5, h * 0.2, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#f4f6fa';
      roundRect(ctx, -hw * 0.5, hy - h * 0.02, hw, h * 0.075, h * 0.035);
      ctx.fill();
      ctx.fillStyle = '#fdf3e2';
      ctx.beginPath();
      ctx.arc(cx, hy - h * 0.16, h * 0.055, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 3: { // cartola
      ctx.fillStyle = '#1d2430';
      roundRect(ctx, -hw * 0.36, hy - h * 0.28, hw * 0.72, h * 0.28, h * 0.03);
      ctx.fill();
      ctx.fillStyle = '#8e2c3f';
      roundRect(ctx, -hw * 0.36, hy - h * 0.08, hw * 0.72, h * 0.06, h * 0.012);
      ctx.fill();
      ctx.fillStyle = '#232a38';
      roundRect(ctx, -hw * 0.56, hy - h * 0.03, hw * 1.12, h * 0.055, h * 0.026);
      ctx.fill();
      break;
    }
    case 4: { // coroa
      ctx.fillStyle = '#f6c945';
      ctx.beginPath();
      ctx.moveTo(-hw * 0.44, hy);
      ctx.lineTo(-hw * 0.44, hy - h * 0.15);
      ctx.lineTo(-hw * 0.2, hy - h * 0.06);
      ctx.lineTo(0, hy - h * 0.2);
      ctx.lineTo(hw * 0.2, hy - h * 0.06);
      ctx.lineTo(hw * 0.44, hy - h * 0.15);
      ctx.lineTo(hw * 0.44, hy);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffe89a';
      for (const dx of [-0.26, 0, 0.26]) {
        ctx.beginPath();
        ctx.arc(hw * dx, hy - h * 0.035, h * 0.018, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 5: { // auréola
      ctx.strokeStyle = 'rgba(255, 228, 120, 0.95)';
      ctx.lineWidth = Math.max(1.6, h * 0.035);
      ctx.shadowColor = 'rgba(255, 220, 110, 0.8)';
      ctx.shadowBlur = h * 0.12;
      ctx.beginPath();
      ctx.ellipse(cx, hy - h * 0.1, hw * 0.38, h * 0.1, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 6: { // antena alienígena
      ctx.strokeStyle = '#79e07a';
      ctx.lineWidth = Math.max(1.4, h * 0.028);
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + dir * hw * 0.2, hy);
        ctx.quadraticCurveTo(cx + dir * hw * 0.34, hy - h * 0.16, cx + dir * hw * 0.28, hy - h * 0.24);
        ctx.stroke();
        ctx.fillStyle = '#b6ff9e';
        ctx.beginPath();
        ctx.arc(cx + dir * hw * 0.28, hy - h * 0.25, h * 0.045, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 7: { // chapéu de festa
      ctx.fillStyle = '#f08a3c';
      ctx.beginPath();
      ctx.moveTo(cx, hy - h * 0.34);
      ctx.lineTo(hw * 0.32, hy);
      ctx.lineTo(-hw * 0.32, hy);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ffe3a8';
      ctx.lineWidth = Math.max(1.2, h * 0.022);
      for (let i = 1; i <= 2; i++) {
        const yy = hy - h * 0.34 + (h * 0.34 * i) / 3;
        const half = (hw * 0.32 * i) / 3;
        ctx.beginPath();
        ctx.moveTo(cx - half, yy);
        ctx.lineTo(cx + half, yy);
        ctx.stroke();
      }
      ctx.fillStyle = '#ffe08a';
      ctx.beginPath();
      ctx.arc(cx, hy - h * 0.35, h * 0.045, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 8: { // flor
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + phase * 0.2;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * hw * 0.22, hy - h * 0.08 + Math.sin(a) * h * 0.06,
          h * 0.06, h * 0.045, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#f6c445';
      ctx.beginPath();
      ctx.arc(cx, hy - h * 0.08, h * 0.045, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 9: { // pirata
      ctx.fillStyle = '#20262f';
      ctx.beginPath();
      ctx.moveTo(-hw * 0.58, hy - h * 0.07);
      ctx.quadraticCurveTo(cx, hy - h * 0.36, hw * 0.58, hy - h * 0.07);
      ctx.quadraticCurveTo(cx, hy + h * 0.03, -hw * 0.58, hy - h * 0.07);
      ctx.fill();
      ctx.fillStyle = '#f4f6fa';
      ctx.beginPath();
      ctx.arc(cx, hy - h * 0.13, h * 0.035, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e6ecf5';
      roundRect(ctx, -hw * 0.3, hy - h * 0.045, hw * 0.6, h * 0.035, h * 0.015);
      ctx.fill();
      break;
    }
    case 10: { // capacete espacial
      ctx.fillStyle = 'rgba(190, 234, 255, 0.35)';
      ctx.strokeStyle = 'rgba(226, 246, 255, 0.85)';
      ctx.lineWidth = Math.max(1.2, h * 0.03);
      ctx.beginPath();
      ctx.ellipse(cx, hy + h * 0.1, hw * 0.56, h * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.ellipse(cx - hw * 0.14, hy + h * 0.04, hw * 0.16, h * 0.09, -0.5, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 11: { // chifres
      ctx.fillStyle = '#e2453c';
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + dir * hw * 0.26, hy + h * 0.03);
        ctx.quadraticCurveTo(cx + dir * hw * 0.46, hy - h * 0.08, cx + dir * hw * 0.34, hy - h * 0.2);
        ctx.quadraticCurveTo(cx + dir * hw * 0.3, hy - h * 0.06, cx + dir * hw * 0.18, hy + h * 0.02);
        ctx.fill();
      }
      break;
    }
    default: break;
  }
  ctx.restore();
  void color;
}

/** Pets flutuando ao lado do jogador. */
export function drawPet(ctx, o) {
  const { id = 0, x = 0, y = 0, h = 40, color = '#c51111', t = 0, facing = 1 } = o;
  if (!id) return;
  const bob = Math.sin(t * 2.2) * h * 0.06;
  const s = h * 0.46;
  ctx.save();
  ctx.translate(x, y + bob);
  if (facing < 0) ctx.scale(-1, 1);
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = h * 0.18;
  if (id === 1) {
    // mini tripulante
    ctx.scale(0.8, 1.15);
    drawCrewMini(ctx, s, color);
  } else if (id === 2) {
    // cachorro
    ctx.fillStyle = '#a9713f';
    roundRect(ctx, -s * 0.45, -s * 0.28, s * 0.9, s * 0.62, s * 0.26);
    ctx.fill();
    ctx.fillStyle = '#8c5a30';
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(dir * s * 0.38, -s * 0.3, s * 0.14, s * 0.26, dir * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#2b1a10';
    ctx.beginPath();
    ctx.arc(s * 0.26, -s * 0.08, s * 0.055, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f4e3cf';
    ctx.beginPath();
    ctx.ellipse(s * 0.42, s * 0.02, s * 0.12, s * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (id === 3) {
    // gato
    ctx.fillStyle = '#8b93a6';
    roundRect(ctx, -s * 0.42, -s * 0.3, s * 0.86, s * 0.6, s * 0.28);
    ctx.fill();
    ctx.fillStyle = '#78808f';
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(dir * s * 0.14, -s * 0.3);
      ctx.lineTo(dir * s * 0.34, -s * 0.52);
      ctx.lineTo(dir * s * 0.4, -s * 0.24);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#a8f0c0';
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(dir * s * 0.14, -s * 0.1, s * 0.06, s * 0.045, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#78808f';
    ctx.lineWidth = Math.max(1, s * 0.06);
    ctx.beginPath();
    ctx.moveTo(-s * 0.42, -s * 0.05);
    ctx.quadraticCurveTo(-s * 0.75, -s * 0.1, -s * 0.62, -s * 0.42);
    ctx.stroke();
  } else if (id === 4) {
    // robô
    ctx.fillStyle = '#b9c4d4';
    roundRect(ctx, -s * 0.4, -s * 0.34, s * 0.8, s * 0.66, s * 0.16);
    ctx.fill();
    ctx.fillStyle = '#1b2432';
    roundRect(ctx, -s * 0.28, -s * 0.22, s * 0.56, s * 0.22, s * 0.08);
    ctx.fill();
    ctx.fillStyle = '#6ef0ff';
    ctx.beginPath();
    ctx.arc(s * 0.12, -s * 0.11, s * 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#cdd7e6';
    ctx.lineWidth = Math.max(1, s * 0.05);
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.34);
    ctx.lineTo(0, -s * 0.5);
    ctx.stroke();
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.arc(0, -s * 0.53, s * 0.05, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawCrewMini(ctx, s, colorLike) {
  const col = typeof colorLike === 'string' ? colorLike : '#c51111';
  const w = s * 0.72;
  ctx.fillStyle = shade(col, -30);
  ctx.beginPath();
  ctx.ellipse(0, s * 0.42, w * 0.42, s * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = col;
  roundRect(ctx, -w / 2, -s * 0.24, w, s * 0.68, w * 0.44);
  ctx.fill();
  ctx.fillStyle = '#9fdcea';
  roundRect(ctx, -w * 0.06, -s * 0.16, w * 0.6, s * 0.22, s * 0.1);
  ctx.fill();
}

/* ============================================================
   CADÁVER
   ============================================================ */
export function drawCorpse(ctx, o) {
  const { x, y, h = 40, color = '#c51111', facing = 1, rotation = 0.5, t = 0 } = o;
  const w = h * 0.74;
  ctx.save();
  ctx.translate(x, y);
  // poça de sangue
  ctx.fillStyle = 'rgba(96, 8, 20, 0.55)';
  ctx.beginPath();
  ctx.ellipse(0, h * 0.16, w * 0.85, h * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(150, 14, 30, 0.5)';
  ctx.beginPath();
  ctx.ellipse(w * 0.2, h * 0.2, w * 0.5, h * 0.16, 0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(rotation);
  if (facing < 0) ctx.scale(-1, 1);
  // corpo caído
  const top = -h * 0.42;
  const grad = ctx.createLinearGradient(-w / 2, top, w / 2, top + h * 0.8);
  grad.addColorStop(0, shade(color, 18));
  grad.addColorStop(1, shade(color, -55));
  ctx.fillStyle = grad;
  roundRect(ctx, -w / 2, top, w, h * 0.8, w * 0.42);
  ctx.fill();
  ctx.strokeStyle = shade(color, -110);
  ctx.lineWidth = Math.max(1.2, h * 0.03);
  ctx.stroke();
  // viseira apagada
  ctx.fillStyle = 'rgba(150, 200, 215, 0.6)';
  roundRect(ctx, -w * 0.1, top + h * 0.12, w * 0.5, h * 0.2, h * 0.1);
  ctx.fill();
  // osso exposto (como no jogo)
  ctx.fillStyle = '#f2f0e6';
  ctx.beginPath();
  ctx.ellipse(w * 0.34, h * 0.34, w * 0.16, h * 0.07, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(120, 12, 26, 0.9)';
  ctx.beginPath();
  ctx.ellipse(w * 0.34, h * 0.34, w * 0.06, h * 0.025, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ============================================================
   DUTO
   ============================================================ */
export function drawVent(ctx, o) {
  const { x, y, size = 30, open = 0, active = false, highlight = false } = o;
  ctx.save();
  ctx.translate(x, y);
  const w = size * 1.28;
  const h = size * 0.92;
  // base metálica
  ctx.fillStyle = '#2c3a4c';
  roundRect(ctx, -w / 2, -h / 2, w, h, size * 0.12);
  ctx.fill();
  ctx.strokeStyle = active ? '#8affd8' : '#93aec8';
  ctx.lineWidth = Math.max(1.4, size * 0.055);
  ctx.stroke();
  // tampa que abre
  const lift = open * h * 0.55;
  ctx.save();
  ctx.translate(0, -lift);
  ctx.fillStyle = '#566a83';
  roundRect(ctx, -w * 0.42, -h * 0.34, w * 0.84, h * 0.68, size * 0.08);
  ctx.fill();
  ctx.strokeStyle = '#a9c2dc';
  ctx.lineWidth = Math.max(1, size * 0.035);
  ctx.stroke();
  // frestas
  ctx.strokeStyle = 'rgba(20, 30, 44, 0.85)';
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(-w * 0.30, i * h * 0.16);
    ctx.lineTo(w * 0.30, i * h * 0.16);
    ctx.stroke();
  }
  ctx.restore();
  if (highlight) {
    ctx.strokeStyle = 'rgba(140, 255, 220, 0.9)';
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4);
    ctx.setLineDash([]);
  }
  ctx.restore();
}

/* ============================================================
   PORTA (painéis deslizantes)
   ============================================================ */
export function drawDoor(ctx, o) {
  const { x, y, size = 30, closed = 0, orientation = 'h' } = o;
  ctx.save();
  ctx.translate(x, y);
  if (orientation === 'v') ctx.rotate(Math.PI / 2);
  const w = size * 1.9;
  const h = size * 0.5;
  // batentes nas duas pontas (o que fica visível com a porta aberta)
  const frameW = Math.max(3, h * 0.34);
  ctx.fillStyle = '#28374a';
  ctx.strokeStyle = 'rgba(196, 214, 236, 0.9)';
  ctx.lineWidth = 1.1;
  for (const sx of [-w / 2, w / 2 - frameW]) {
    ctx.fillRect(sx, -h / 2, frameW, h);
    ctx.strokeRect(sx, -h / 2, frameW, h);
  }
  // painéis que fecham no centro
  if (closed > 0.01) {
    const panelW = (w / 2 - frameW) * closed;
    ctx.fillStyle = '#7d8ea3';
    ctx.fillRect(-w / 2 + frameW, -h / 2, panelW, h);
    ctx.fillRect(w / 2 - frameW - panelW, -h / 2, panelW, h);
    ctx.strokeStyle = '#c3d4e6';
    ctx.lineWidth = 1.4;
    ctx.strokeRect(-w / 2 + frameW, -h / 2, panelW, h);
    ctx.strokeRect(w / 2 - frameW - panelW, -h / 2, panelW, h);
  }
  // faixa de alerta
  if (closed > 0.35) {
    ctx.fillStyle = `rgba(255, 70, 80, ${0.35 + 0.3 * Math.sin(performance.now() / 180)})`;
    ctx.fillRect(-w / 2 + frameW, -h * 0.12, w - frameW * 2, h * 0.24);
  }
  ctx.restore();
}

/* ============================================================
   BOTÃO DE EMERGÊNCIA
   ============================================================ */
export function drawEmergencyButton(ctx, o) {
  const { x, y, size = 30, t = 0, disabled = false } = o;
  ctx.save();
  ctx.translate(x, y);
  const r = size * 0.42;
  // pedestal
  ctx.fillStyle = '#4a2a2e';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.55, r * 1.05, r * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  // corpo do botão
  const glow = disabled ? 0.25 : 0.5 + Math.sin(t * 3) * 0.18;
  ctx.fillStyle = `rgba(255, 60, 74, ${glow})`;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.25, 0, Math.PI * 2);
  ctx.fill();
  const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
  grad.addColorStop(0, disabled ? '#b26a6e' : '#ff8a92');
  grad.addColorStop(1, disabled ? '#7a3a3e' : '#c2182a');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2a0d12';
  ctx.lineWidth = Math.max(1.4, size * 0.05);
  ctx.stroke();
  // brilho
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.3, -r * 0.35, r * 0.28, r * 0.16, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ============================================================
   MESA DA CAFETERIA (reunião)
   ============================================================ */
export function drawMeetingTable(ctx, o) {
  const { x, y, size = 30 } = o;
  ctx.save();
  ctx.translate(x, y);
  const r = size * 2.1;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.28, r * 1.05, r * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3b4c63';
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();
  const grad = ctx.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.2, 0, 0, r);
  grad.addColorStop(0, '#8ba1bd');
  grad.addColorStop(1, '#5c718d');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.86, r * 0.60, 0, 0, Math.PI * 2);
  ctx.fill();
  // marcas do tampo
  ctx.strokeStyle = 'rgba(30,45,64,0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.55, r * 0.38, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/* ============================================================
   FUNDO ESPACIAL
   ============================================================ */
const STARS = Array.from({ length: 220 }, (_, i) => ({
  x: ((i * 733) % 2000) / 2000,
  y: ((i * 421) % 1400) / 1400,
  s: i % 11 === 0 ? 2.2 : i % 4 === 0 ? 1.6 : 1,
  a: 0.18 + ((i * 37) % 70) / 100,
}));

export function drawSpace(ctx, w, h, t, camX = 0, camY = 0, zoom = 1) {
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#05070f');
  bg.addColorStop(0.55, '#070b16');
  bg.addColorStop(1, '#04060c');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // nebulosa suave
  const neb = ctx.createRadialGradient(w * 0.72, h * 0.22, 0, w * 0.72, h * 0.22, w * 0.55);
  neb.addColorStop(0, 'rgba(70, 40, 120, 0.20)');
  neb.addColorStop(1, 'rgba(70, 40, 120, 0)');
  ctx.fillStyle = neb;
  ctx.fillRect(0, 0, w, h);

  const px = -camX * zoom * 0.06;
  const py = camY * zoom * 0.06;
  for (const st of STARS) {
    const x = ((st.x * w + px) % w + w) % w;
    const y = ((st.y * h + py) % h + h) % h;
    ctx.globalAlpha = st.a * (0.7 + 0.3 * Math.sin(t * 1.4 + st.x * 30));
    ctx.fillStyle = '#dbe9ff';
    ctx.fillRect(x, y, st.s, st.s);
  }
  ctx.globalAlpha = 1;
}
