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

/** Corpo do tripulante: domo em cima, laterais retas, cantos arredondados embaixo. */
function beanPath(ctx, x, y, w, h, rTop = w * 0.5, rBottom = w * 0.32) {
  ctx.beginPath();
  ctx.moveTo(x, y + rTop);
  ctx.arc(x + rTop, y + rTop, rTop, Math.PI, 0);
  ctx.lineTo(x + w, y + h - rBottom);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rBottom, y + h);
  ctx.lineTo(x + rBottom, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rBottom);
  ctx.closePath();
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
export function drawCrew(ctx, o) {
  const {
    x, y, h = 40, color = '#c51111', facing = 1,
    walk = 0, phase = 0, ghost = false, alpha = 1, outline = true,
    dead = false, highlight = false,
    hat = 0, hatPal = null, skin = 0, skinPal = null, visor = 0, visorPal = null,
  } = o;
  const w = h * 0.72;
  ctx.save();
  ctx.translate(x, y);
  if (alpha !== 1) ctx.globalAlpha *= alpha;
  if (facing < 0) ctx.scale(-1, 1);

  const step = Math.sin(walk * Math.PI * 2);
  const bob = Math.abs(step) * h * 0.028;
  const bodyH = h * 0.84;
  const top = -h * 0.52 - bob;

  // sombra no chão (suave, de luz vinda de cima)
  if (!ghost && !dead) {
    const sh = ctx.createRadialGradient(0, h * 0.4, 0, 0, h * 0.4, w * 0.62);
    sh.addColorStop(0, 'rgba(0,0,0,0.42)');
    sh.addColorStop(0.6, 'rgba(0,0,0,0.24)');
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sh;
    ctx.beginPath();
    ctx.ellipse(0, h * 0.40, w * 0.60, h * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // pés (atrás do corpo): dois blocos arredondados que alternam ao andar
  const peW = w * 0.30;
  const peH = h * 0.20;
  const pes = [
    { dx: -w * 0.23, dy: step * h * 0.05, tom: -46 },
    { dx: w * 0.23, dy: -step * h * 0.05, tom: -26 },
  ];
  for (const pe of pes) {
    ctx.fillStyle = shade(color, pe.tom);
    roundRect(ctx, pe.dx - peW / 2, h * 0.24 + pe.dy, peW, peH, peW * 0.45);
    ctx.fill();
  }

  // mochila de oxigênio (lado esquerdo, aparecendo atrás do corpo)
  ctx.fillStyle = shade(color, -62);
  roundRect(ctx, -w * 0.74, top + bodyH * 0.30, w * 0.36, bodyH * 0.40, w * 0.14);
  ctx.fill();
  ctx.fillStyle = shade(color, -34);
  roundRect(ctx, -w * 0.72, top + bodyH * 0.32, w * 0.30, bodyH * 0.09, w * 0.05);
  ctx.fill();

  // corpo: gradiente diagonal (luz em cima à esquerda, sombra embaixo à direita)
  const grad = ctx.createLinearGradient(-w * 0.5, top, w * 0.55, top + bodyH);
  grad.addColorStop(0, shade(color, 34));
  grad.addColorStop(0.42, color);
  grad.addColorStop(1, shade(color, -46));
  ctx.fillStyle = grad;
  beanPath(ctx, -w / 2, top, w, bodyH);
  ctx.fill();

  // borda interna mais escura (dá a leitura de volume do original)
  ctx.save();
  ctx.strokeStyle = shade(color, -80);
  ctx.globalAlpha *= 0.5;
  ctx.lineWidth = Math.max(1, h * 0.016);
  beanPath(ctx, -w / 2 + ctx.lineWidth / 2, top + ctx.lineWidth / 2, w - ctx.lineWidth, bodyH - ctx.lineWidth);
  ctx.stroke();
  ctx.restore();

  // brilho suave na lateral esquerda
  ctx.save();
  ctx.globalAlpha *= 0.20;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, -w * 0.42, top + h * 0.10, w * 0.11, bodyH * 0.52, w * 0.06);
  ctx.fill();
  ctx.restore();

  // oclusão na base do corpo
  ctx.save();
  beanPath(ctx, -w / 2, top, w, bodyH);
  ctx.clip();
  const ao = ctx.createLinearGradient(0, top + bodyH * 0.55, 0, top + bodyH);
  ao.addColorStop(0, 'rgba(0,0,0,0)');
  ao.addColorStop(1, 'rgba(0,0,0,0.26)');
  ctx.fillStyle = ao;
  ctx.fillRect(-w / 2, top + bodyH * 0.5, w, bodyH * 0.5);
  ctx.restore();

  // traje (skin) por cima do corpo
  if (skin > 0) drawSkinArt(ctx, skin, { w, h, top, color, pal: skinPal, bodyH });

  // viseira (com as variantes oficiais)
  drawVisorArt(ctx, visor, { w, h, top, pal: visorPal });

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
  if (hat > 0 && !ghost) drawHatInBody(ctx, hat, { w, h, top, color, phase, pal: hatPal });

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
  const { w, h, top, color, phase, pal } = o;
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

/** Trajes (skins) desenhados por cima do corpo, recortados na silhueta. */
function drawSkinArt(ctx, art, o) {
  const { w, h, top, color, pal, bodyH } = o;
  const p1 = pal?.[0] || '#2f6fd0';
  const p2 = pal?.[1] || '#9fdcea';
  const swapped = { p1, p2 };
  ctx.save();
  roundRect(ctx, -w / 2, top, w, bodyH, w * 0.46);
  ctx.clip();
  switch (art) {
    case 1: { // astronauta
      ctx.fillStyle = swapped.p2;
      roundRect(ctx, -w * 0.5, top, w, bodyH * 0.34, w * 0.2);
      ctx.fill();
      ctx.fillStyle = shade(swapped.p1, 30);
      roundRect(ctx, -w * 0.34, top + bodyH * 0.06, w * 0.68, bodyH * 0.16, w * 0.1);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      roundRect(ctx, -w * 0.46, top + bodyH * 0.42, w * 0.14, bodyH * 0.34, w * 0.07);
      ctx.fill();
      break;
    }
    case 2: { // capitão
      ctx.fillStyle = swapped.p1;
      roundRect(ctx, -w * 0.5, top + bodyH * 0.18, w, bodyH * 0.5, w * 0.2);
      ctx.fill();
      ctx.fillStyle = '#f6c945';
      for (const y of [0.26, 0.34]) {
        roundRect(ctx, -w * 0.42, top + bodyH * y, w * 0.84, h * 0.022, h * 0.011);
        ctx.fill();
      }
      ctx.fillStyle = '#f6c945';
      for (const dx of [-0.12, 0.12]) {
        ctx.beginPath();
        ctx.arc(w * dx, top + bodyH * 0.47, h * 0.016, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 3: { // mecânico
      ctx.fillStyle = '#8a97a8';
      roundRect(ctx, -w * 0.46, top + bodyH * 0.2, w * 0.92, bodyH * 0.34, w * 0.12);
      ctx.fill();
      ctx.fillStyle = '#5d6979';
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 2; j++) {
          ctx.beginPath();
          ctx.arc(-w * 0.3 + i * w * 0.3, top + bodyH * (0.26 + j * 0.22), h * 0.014, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.fillStyle = '#3b4553';
      roundRect(ctx, -w * 0.18, top + bodyH * 0.62, w * 0.36, h * 0.03, h * 0.015);
      ctx.fill();
      break;
    }
    case 4: { // militar (camo)
      const spots = [[-0.3, 0.28], [0.06, 0.36], [0.3, 0.24], [-0.16, 0.5], [0.24, 0.52], [-0.36, 0.62], [0.02, 0.68]];
      ctx.fillStyle = '#4a5a34';
      roundRect(ctx, -w * 0.5, top + bodyH * 0.16, w, bodyH * 0.66, w * 0.2);
      ctx.fill();
      for (const [dx, dy] of spots) {
        ctx.fillStyle = dy % 0.3 ? '#6b7d48' : '#33402a';
        ctx.beginPath();
        ctx.ellipse(w * dx, top + bodyH * dy, w * 0.16, h * 0.05, dx, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 5: { // policial
      ctx.fillStyle = '#1f3d6b';
      roundRect(ctx, -w * 0.5, top + bodyH * 0.18, w, bodyH * 0.56, w * 0.18);
      ctx.fill();
      ctx.fillStyle = '#f6c945';
      ctx.beginPath();
      ctx.moveTo(-w * 0.2, top + bodyH * 0.32);
      ctx.lineTo(-w * 0.1, top + bodyH * 0.3);
      ctx.lineTo(-w * 0.1, top + bodyH * 0.44);
      ctx.lineTo(-w * 0.2, top + bodyH * 0.46);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#0f2547';
      roundRect(ctx, -w * 0.5, top + bodyH * 0.66, w, h * 0.035, h * 0.01);
      ctx.fill();
      break;
    }
    case 6: { // cientista (jaleco)
      ctx.fillStyle = '#f2f6fb';
      roundRect(ctx, -w * 0.5, top + bodyH * 0.22, w, bodyH * 0.58, w * 0.16);
      ctx.fill();
      ctx.strokeStyle = 'rgba(150,170,190,0.7)';
      ctx.lineWidth = Math.max(1, h * 0.02);
      ctx.beginPath();
      ctx.moveTo(0, top + bodyH * 0.22);
      ctx.lineTo(0, top + bodyH * 0.8);
      ctx.stroke();
      ctx.fillStyle = '#cfe0f2';
      roundRect(ctx, w * 0.06, top + bodyH * 0.44, w * 0.24, bodyH * 0.16, w * 0.05);
      ctx.fill();
      ctx.fillStyle = '#2f6fd0';
      roundRect(ctx, w * 0.1, top + bodyH * 0.36, w * 0.06, bodyH * 0.16, w * 0.02);
      ctx.fill();
      break;
    }
    case 7: { // terno preto
      ctx.fillStyle = '#161a22';
      roundRect(ctx, -w * 0.5, top + bodyH * 0.2, w, bodyH * 0.62, w * 0.16);
      ctx.fill();
      ctx.fillStyle = '#f4f7fb';
      ctx.beginPath();
      ctx.moveTo(-w * 0.16, top + bodyH * 0.2);
      ctx.lineTo(0, top + bodyH * 0.46);
      ctx.lineTo(w * 0.16, top + bodyH * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#a3212f';
      ctx.beginPath();
      ctx.moveTo(-w * 0.05, top + bodyH * 0.24);
      ctx.lineTo(w * 0.05, top + bodyH * 0.24);
      ctx.lineTo(0, top + bodyH * 0.56);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 8: { // terno branco
      ctx.fillStyle = '#eef2f7';
      roundRect(ctx, -w * 0.5, top + bodyH * 0.2, w, bodyH * 0.62, w * 0.16);
      ctx.fill();
      ctx.fillStyle = '#1b2130';
      ctx.beginPath();
      ctx.moveTo(-w * 0.16, top + bodyH * 0.2);
      ctx.lineTo(0, top + bodyH * 0.44);
      ctx.lineTo(w * 0.16, top + bodyH * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#2b3345';
      ctx.beginPath();
      ctx.moveTo(-w * 0.05, top + bodyH * 0.24);
      ctx.lineTo(w * 0.05, top + bodyH * 0.24);
      ctx.lineTo(0, top + bodyH * 0.54);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 9: { // parede
      ctx.fillStyle = '#b06a4f';
      ctx.fillRect(-w, top, w * 2, bodyH * 1.4);
      ctx.strokeStyle = 'rgba(240, 220, 205, 0.75)';
      ctx.lineWidth = Math.max(1.2, h * 0.022);
      const bh = h * 0.075;
      for (let y = top; y < top + bodyH * 1.2; y += bh) {
        ctx.beginPath();
        ctx.moveTo(-w, y);
        ctx.lineTo(w, y);
        ctx.stroke();
        const off = Math.round((y - top) / bh) % 2 ? w * 0.16 : 0;
        for (let x = -w + off; x < w; x += w * 0.32) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + bh);
          ctx.stroke();
        }
      }
      break;
    }
    default: break;
  }
  ctx.restore();
}

/** Visores: padrão + variantes (zangado, papel, óculos, tapa-olho...). */
function drawVisorArt(ctx, art, o) {
  const { w, h, top, pal } = o;
  const vw = w * 0.64;
  const vh = h * 0.34;
  const vx = w * 0.03;
  const vy = top + h * 0.11;
  const tint = pal?.[1];
  ctx.save();
  if (art === 2) { // máscara de papel
    ctx.fillStyle = '#f7f7f2';
    roundRect(ctx, vx - vw * 0.08, vy - vh * 0.15, vw * 1.14, vh * 1.3, vh * 0.25);
    ctx.fill();
    ctx.fillStyle = 'rgba(30,40,55,0.85)';
    for (const dx of [0.22, 0.62]) {
      ctx.beginPath();
      ctx.ellipse(vx + vw * dx, vy + vh * 0.42, vw * 0.08, vh * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(120,130,145,0.8)';
    ctx.lineWidth = Math.max(1, h * 0.02);
    ctx.beginPath();
    ctx.moveTo(vx - vw * 0.06, vy + vh * 0.35);
    ctx.lineTo(vx - vw * 0.2, vy + vh * 0.1);
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (art === 4) { // óculos escuros
    ctx.fillStyle = 'rgba(18,22,30,0.95)';
    roundRect(ctx, vx, vy + vh * 0.18, vw, vh * 0.66, vh * 0.22);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    roundRect(ctx, vx + vw * 0.12, vy + vh * 0.28, vw * 0.16, vh * 0.2, vh * 0.08);
    ctx.fill();
    ctx.restore();
    return;
  }
  if (art === 8) { // óculos de coração
    for (const dx of [0.26, 0.68]) {
      const cx = vx + vw * dx;
      const cy = vy + vh * 0.5;
      const r = vh * 0.34;
      ctx.fillStyle = '#e8324c';
      ctx.beginPath();
      ctx.moveTo(cx, cy + r * 0.85);
      ctx.bezierCurveTo(cx - r * 1.5, cy - r * 0.4, cx - r * 0.4, cy - r * 1.3, cx, cy - r * 0.45);
      ctx.bezierCurveTo(cx + r * 0.4, cy - r * 1.3, cx + r * 1.5, cy - r * 0.4, cx, cy + r * 0.85);
      ctx.fill();
    }
    ctx.restore();
    return;
  }
  if (art === 6) { // óculos de corrida
    ctx.fillStyle = 'rgba(20,26,34,0.9)';
    roundRect(ctx, vx - vw * 0.04, vy + vh * 0.12, vw * 1.08, vh * 0.8, vh * 0.3);
    ctx.fill();
    for (const dx of [0.28, 0.7]) {
      ctx.fillStyle = 'rgba(150,220,255,0.85)';
      ctx.beginPath();
      ctx.arc(vx + vw * dx, vy + vh * 0.52, vh * 0.26, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }
  if (art === 7) { // tapa-olho
    drawVisorBase(ctx, vx, vy, vw, vh, h, tint);
    ctx.fillStyle = '#171b23';
    ctx.beginPath();
    ctx.ellipse(vx + vw * 0.68, vy + vh * 0.5, vh * 0.44, vh * 0.4, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#171b23';
    ctx.lineWidth = Math.max(1.2, h * 0.022);
    ctx.beginPath();
    ctx.moveTo(vx - vw * 0.02, vy + vh * 0.24);
    ctx.lineTo(vx + vw * 1.02, vy + vh * 0.62);
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (art === 9) { // visor alienígena
    ctx.fillStyle = 'rgba(12, 26, 30, 0.92)';
    roundRect(ctx, vx, vy, vw, vh, vh * 0.52);
    ctx.fill();
    ctx.fillStyle = 'rgba(150, 255, 210, 0.92)';
    for (const dx of [0.3, 0.66]) {
      ctx.beginPath();
      ctx.ellipse(vx + vw * dx, vy + vh * 0.5, vw * 0.11, vh * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }
  drawVisorBase(ctx, vx, vy, vw, vh, h, tint);
  if (art === 1) { // olhos zangados dentro do visor
    ctx.strokeStyle = 'rgba(16, 24, 38, 0.88)';
    ctx.lineWidth = Math.max(1.8, h * 0.034);
    ctx.lineCap = 'round';
    for (const [x1, y1, x2, y2] of [[0.18, 0.4, 0.44, 0.74], [0.82, 0.4, 0.56, 0.74]]) {
      ctx.beginPath();
      ctx.moveTo(vx + vw * x1, vy + vh * y1);
      ctx.lineTo(vx + vw * x2, vy + vh * y2);
      ctx.stroke();
    }
  } else if (art === 3) { // olhos de adesivo
    for (const dx of [0.34, 0.66]) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(vx + vw * dx, vy + vh * 0.5, vh * 0.26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#101820';
      ctx.beginPath();
      ctx.arc(vx + vw * dx + vh * 0.06, vy + vh * 0.56, vh * 0.11, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (art === 5) { // três olhos
    ctx.fillStyle = 'rgba(15, 22, 32, 0.9)';
    for (const [dx, dy, r] of [[0.3, 0.85, 0.2], [0.7, 0.85, 0.2], [0.5, 0.4, 0.16]]) {
      ctx.beginPath();
      ctx.ellipse(vx + vw * dx, vy + vh * dy, vw * r * 0.5, vh * r, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawVisorBase(ctx, vx, vy, vw, vh, h, tint) {
  const r = vh * 0.5;
  // vidro: claro em cima à esquerda, azul profundo embaixo
  const visorGrad = ctx.createLinearGradient(vx, vy, vx + vw * 0.65, vy + vh);
  visorGrad.addColorStop(0, tint ? shade(tint, 46) : '#cdeefb');
  visorGrad.addColorStop(0.30, tint || '#8fd2e9');
  visorGrad.addColorStop(0.72, shade(tint || '#59aacb', -6));
  visorGrad.addColorStop(1, shade(tint || '#3f8dae', -14));
  ctx.fillStyle = visorGrad;
  roundRect(ctx, vx, vy, vw, vh, r);
  ctx.fill();

  // reflexo do ambiente na parte de baixo do vidro
  ctx.save();
  roundRect(ctx, vx, vy, vw, vh, r);
  ctx.clip();
  const baixo = ctx.createLinearGradient(0, vy + vh * 0.55, 0, vy + vh);
  baixo.addColorStop(0, 'rgba(255,255,255,0)');
  baixo.addColorStop(1, 'rgba(210, 245, 255, 0.34)');
  ctx.fillStyle = baixo;
  ctx.fillRect(vx, vy + vh * 0.5, vw, vh * 0.5);
  ctx.restore();

  // aro escuro fino
  ctx.strokeStyle = 'rgba(9, 28, 42, 0.55)';
  ctx.lineWidth = Math.max(1, h * 0.020);
  roundRect(ctx, vx, vy, vw, vh, r);
  ctx.stroke();

  // brilho especular (o "olho" brilhante do original)
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  roundRect(ctx, vx + vw * 0.15, vy + vh * 0.22, vw * 0.22, vh * 0.17, vh * 0.085);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  roundRect(ctx, vx + vw * 0.55, vy + vh * 0.48, vw * 0.16, vh * 0.11, vh * 0.055);
  ctx.fill();
}

/** Placa de nome (nameplate) desenhada atrás do nome. */
export function drawPlate(ctx, o) {
  const { art = 0, pal, x, y, w, h, alpha = 1 } = o;
  if (!art) return;
  const p1 = pal?.[0] || '#2f6fd0';
  const p2 = pal?.[1] || '#9fdcea';
  ctx.save();
  ctx.globalAlpha *= alpha;
  const g = ctx.createLinearGradient(x - w / 2, y, x + w / 2, y);
  if (art === 2) { g.addColorStop(0, p1); g.addColorStop(0.5, p2); g.addColorStop(1, p1); }
  else if (art === 3) { g.addColorStop(0, '#3d0b12'); g.addColorStop(1, '#b3121f'); }
  else if (art === 4) { g.addColorStop(0, '#f7c8d8'); g.addColorStop(1, '#b06a8f'); }
  else if (art === 5) { g.addColorStop(0, '#0b1a33'); g.addColorStop(1, '#3b2a63'); }
  else if (art === 6) { g.addColorStop(0, '#c2410c'); g.addColorStop(1, '#facc15'); }
  else if (art === 7) { g.addColorStop(0, '#111827'); g.addColorStop(1, '#22d3ee'); }
  else if (art === 8) { g.addColorStop(0, '#3f2a17'); g.addColorStop(1, '#8a6a44'); }
  else { g.addColorStop(0, p1); g.addColorStop(1, p2); }
  ctx.fillStyle = g;
  roundRect(ctx, x - w / 2, y - h / 2, w, h, h / 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = Math.max(1, h * 0.08);
  ctx.stroke();
  ctx.restore();
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
