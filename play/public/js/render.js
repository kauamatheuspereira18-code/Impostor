import { MAP, COLORS } from '/shared/config.js';

/* ============================================================
   Renderização do mapa, jogadores, corpos e ventilações
   ============================================================ */

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

export const view = { scale: 1, ox: 0, oy: 0, w: 0, h: 0 };

let dpr = 1;

export function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  view.w = rect.width;
  view.h = rect.height;
  computeView();
}

function computeView(focus, map = MAP) {
  const pad = 40;
  const scale = Math.min((view.w - pad * 2) / map.width, (view.h - pad * 2) / map.height);
  view.scale = Math.max(0.25, scale);
  const mw = map.width * view.scale;
  const mh = map.height * view.scale;
  if (focus && view.w < 900) {
    // móvel: centraliza um pouco no jogador
    const tx = view.w / 2 - focus.x * view.scale;
    const ty = view.h / 2 - focus.y * view.scale;
    view.ox = clamp(tx, Math.min(0, view.w - mw - 20), 20);
    view.oy = clamp(ty, Math.min(0, view.h - mh - 20), 20);
  } else {
    view.ox = (view.w - mw) / 2;
    view.oy = (view.h - mh) / 2;
  }
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

export function worldToScreen(x, y) {
  return { x: x * view.scale + view.ox, y: y * view.scale + view.oy };
}

export function screenToWorld(x, y) {
  return { x: (x - view.ox) / view.scale, y: (y - view.oy) / view.scale };
}

/* ---------- desenho do mapa ---------- */
function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function drawMap(state) {
  const map = state?.map || MAP;
  const s = view.scale;
  ctx.save();
  ctx.translate(view.ox, view.oy);
  ctx.scale(s, s);

  // fundo do espaço
  ctx.fillStyle = '#070b14';
  ctx.fillRect(-200, -200, map.width + 400, map.height + 400);

  // estrelas
  for (let i = 0; i < 90; i++) {
    const sx = ((i * 137.5) % (map.width + 300)) - 150;
    const sy = ((i * 91.7) % (map.height + 300)) - 150;
    const tw = 0.4 + ((i * 13) % 10) / 14;
    ctx.fillStyle = `rgba(255,255,255,${0.12 + tw * 0.22})`;
    ctx.fillRect(sx, sy, 1.6, 1.6);
  }

  // corredores
  ctx.strokeStyle = 'rgba(120, 145, 190, 0.28)';
  ctx.lineWidth = 20;
  ctx.lineCap = 'round';
  for (const cor of map.corridors || []) {
    const a = map.rooms.find((r) => r.id === cor.from);
    const b = map.rooms.find((r) => r.id === cor.to);
    if (!a || !b || a.w <= 0 || b.w <= 0) continue;
    ctx.beginPath();
    ctx.moveTo(a.x + a.w / 2, a.y + a.h / 2);
    ctx.lineTo(b.x + b.w / 2, b.y + b.h / 2);
    ctx.stroke();
  }

  // salas
  for (const room of map.rooms) {
    if (room.w <= 0) continue;
    const lit = state?.lightsOut ? 0.35 : 1;
    roundRect(ctx, room.x, room.y, room.w, room.h, 16);
    ctx.fillStyle = `rgba(38, 52, 78, ${0.92 * lit})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(140, 175, 235, ${0.42 * lit})`;
    ctx.lineWidth = 3;
    ctx.stroke();

    // padrão de piso
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = `rgba(120, 160, 225, ${0.07 * lit})`;
    ctx.lineWidth = 1;
    for (let gx = room.x; gx < room.x + room.w; gx += 26) {
      ctx.beginPath();
      ctx.moveTo(gx, room.y);
      ctx.lineTo(gx, room.y + room.h);
      ctx.stroke();
    }
    for (let gy = room.y; gy < room.y + room.h; gy += 26) {
      ctx.beginPath();
      ctx.moveTo(room.x, gy);
      ctx.lineTo(room.x + room.w, gy);
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = `rgba(200, 220, 250, ${0.62 * lit})`;
    ctx.font = 'bold 13px Trebuchet MS, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(room.name.toUpperCase(), room.x + room.w / 2, room.y + 19);
  }

  // tarefas
  if (state && state.tasks && state.you) {
    for (const t of state.tasks) {
      if (!state.you.tasks?.some((mt) => mt.id === t.id && !mt.done)) continue;
      drawTaskMarker(t.x, t.y);
    }
  }

  // ventilações (visíveis para impostor)
  if (state?.you?.role === 'impostor') {
    for (const v of state.vents || []) {
      ctx.fillStyle = 'rgba(90, 220, 255, 0.55)';
      roundRect(ctx, v.x - 13, v.y - 11, 26, 22, 7);
      ctx.fill();
      ctx.strokeStyle = 'rgba(160, 240, 255, 0.9)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(v.x - 7, v.y - 5);
      ctx.lineTo(v.x + 7, v.y - 5);
      ctx.moveTo(v.x - 7, v.y + 1);
      ctx.lineTo(v.x + 7, v.y + 1);
      ctx.moveTo(v.x - 7, v.y + 7);
      ctx.lineTo(v.x + 7, v.y + 7);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawTaskMarker(x, y) {
  const t = (performance.now() / 1000) % 2;
  const pulse = 1 + Math.sin(t * Math.PI * 2) * 0.12;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = 'rgba(255, 214, 64, 0.95)';
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a2200';
  ctx.font = 'bold 12px Trebuchet MS';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('!', 0, 1);
  ctx.restore();
}

/* ---------- desenho do personagem ---------- */
export function drawCrewmate(c, x, y, colorHex, visorHex, opts = {}) {
  const { ghost = false, alpha = 1, scale = 1, facing = 1, moving = false, wobble = 0, role } = opts;
  c.save();
  c.globalAlpha = alpha;
  c.translate(x, y);
  c.scale(facing * scale, scale);

  const bob = moving ? Math.sin(wobble) * 1.6 : 0;
  c.translate(0, bob);

  if (!ghost) {
    // sombra
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.beginPath();
    c.ellipse(0, 16, 13, 5, 0, 0, Math.PI * 2);
    c.fill();
  }

  // corpo
  c.fillStyle = colorHex;
  roundRect(c, -13, -16, 26, 30, 11);
  c.fill();

  // pernas/tentáculos
  c.fillStyle = colorHex;
  c.beginPath();
  if (moving) {
    c.ellipse(-7, 15 + Math.sin(wobble) * 2, 5, 6 + Math.sin(wobble) * 2, 0, 0, Math.PI * 2);
    c.ellipse(7, 15 - Math.sin(wobble) * 2, 5, 6 - Math.sin(wobble) * 2, 0, 0, Math.PI * 2);
  } else {
    c.ellipse(-6, 14, 5.5, 6, 0, 0, Math.PI * 2);
    c.ellipse(6, 14, 5.5, 6, 0, 0, Math.PI * 2);
  }
  c.fill();

  // mochila
  c.fillStyle = 'rgba(0,0,0,0.22)';
  roundRect(c, -16, -11, 5, 16, 2);
  c.fill();

  // visor
  c.fillStyle = '#9fd9e8';
  roundRect(c, -1, -11, 15, 11, 5.5);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,0.65)';
  roundRect(c, 4, -9.5, 7, 4, 2);
  c.fill();
  c.strokeStyle = visorHex;
  c.lineWidth = 1.6;
  roundRect(c, -1, -11, 15, 11, 5.5);
  c.stroke();

  // marcas de impostor (aparecem no fim do jogo)
  if (role === 'impostor') {
    c.fillStyle = '#ff2d4a';
    c.font = 'bold 13px Trebuchet MS';
    c.textAlign = 'center';
    c.fillText('▲', 0, -22);
  }

  c.restore();
}

function drawBody(c, body) {
  const col = COLORS.find((x) => x.id === body.color) || COLORS[0];
  c.save();
  c.translate(body.x, body.y);
  const t = (performance.now() / 1000) % 4;
  c.fillStyle = 'rgba(255, 60, 80, 0.16)';
  c.beginPath();
  c.arc(0, 4, 26 + Math.sin(t * Math.PI) * 3, 0, Math.PI * 2);
  c.fill();

  // corpo caído
  c.rotate(Math.PI / 2);
  drawCrewmate(c, 0, -2, col.hex, col.visor, { scale: 0.95, alpha: 0.95, wobble: 0 });
  c.rotate(-Math.PI / 2);

  // "osso" / base
  c.fillStyle = 'rgba(240, 245, 255, 0.85)';
  c.beginPath();
  c.ellipse(0, 24, 13, 5, 0, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

/* ---------- render principal ---------- */
let lastPlayers = {};

export function render(state, me, camera) {
  resizeIfNeeded();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, view.w, view.h);

  computeView(camera, state?.map || MAP);

  // fundo gradiente
  const g = ctx.createRadialGradient(view.w / 2, view.h / 2, 50, view.w / 2, view.h / 2, Math.max(view.w, view.h));
  g.addColorStop(0, '#0a1220');
  g.addColorStop(1, '#05070c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, view.w, view.h);

  drawMap(state);

  ctx.save();
  ctx.translate(view.ox, view.oy);
  ctx.scale(view.scale, view.scale);

  if (!state) { ctx.restore(); return; }

  // corpos
  for (const b of state.bodies || []) drawBody(ctx, b);

  // jogadores
  const now = performance.now();
  for (const p of state.players) {
    if (!p.alive) continue;
    if (p.inVent) {
      // só o impostor dentro do duto se vê
      if (p.id !== me?.id) continue;
    }
    const prev = lastPlayers[p.id];
    const wobble = now / 90;
    const col = COLORS.find((x) => x.id === p.color) || COLORS[0];
    const isMe = p.id === me?.id;

    if (isMe) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 24, 0, Math.PI * 2);
      ctx.stroke();
    }

    drawCrewmate(ctx, p.x, p.y, col.hex, col.visor, {
      facing: p.facing || 1,
      moving: p.moving,
      wobble,
      scale: isMe ? 1.08 : 1,
      alpha: p.inVent && p.id === me?.id ? 0.45 : 1,
      role: state.state === 'ended' ? p.role : null,
    });

    // nome
    ctx.font = 'bold 11px Trebuchet MS, sans-serif';
    ctx.textAlign = 'center';
    const label = p.name;
    const w = ctx.measureText(label).width + 12;
    ctx.fillStyle = 'rgba(6, 10, 18, 0.72)';
    roundRect(ctx, p.x - w / 2, p.y - 46, w, 16, 8);
    ctx.fill();
    ctx.fillStyle = isMe ? '#8fe9ff' : 'rgba(232, 240, 255, 0.92)';
    ctx.fillText(label, p.x, p.y - 34);

    lastPlayers[p.id] = { x: p.x, y: p.y };
  }

  // fantasmas (jogadores mortos que ainda estão na partida)
  for (const p of state.players) {
    if (p.alive) continue;
    const col = COLORS.find((x) => x.id === p.color) || COLORS[0];
    drawCrewmate(ctx, p.x, p.y, col.hex, col.visor, {
      ghost: true,
      alpha: 0.3,
      facing: p.facing || 1,
      wobble: now / 120,
    });
  }

  // efeito de escuridão quando as luzes são sabotadas
  ctx.restore();

  if (state.lightsOut) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    const cx = me ? me.x * view.scale + view.ox : view.w / 2;
    const cy = me ? me.y * view.scale + view.oy : view.h / 2;
    const rad = ctx.createRadialGradient(cx, cy, 30, cx, cy, Math.max(320, view.w * 0.42));
    rad.addColorStop(0, 'rgba(0,0,0,0)');
    rad.addColorStop(0.55, 'rgba(0,0,0,0.55)');
    rad.addColorStop(1, 'rgba(0,0,0,0.93)');
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.restore();
  }
}

let lastW = 0;
let lastH = 0;
function resizeIfNeeded() {
  const rect = canvas.getBoundingClientRect();
  if (Math.abs(rect.width - lastW) > 1 || Math.abs(rect.height - lastH) > 1) {
    lastW = rect.width;
    lastH = rect.height;
    resize();
  }
}

/* ---------- minimapa ---------- */
const mini = document.getElementById('minimap');
const mctx = mini.getContext('2d');

export function renderMinimap(state) {
  if (!state || !state.map) return;
  const rect = mini.getBoundingClientRect();
  const dpr2 = Math.min(2, window.devicePixelRatio || 1);
  if (mini.width !== Math.floor(rect.width * dpr2)) {
    mini.width = Math.floor(rect.width * dpr2);
    mini.height = Math.floor(rect.height * dpr2);
  }
  mctx.setTransform(dpr2, 0, 0, dpr2, 0, 0);
  mctx.clearRect(0, 0, rect.width, rect.height);

  const map = state.map || MAP;
  const s = Math.min(rect.width / map.width, rect.height / map.height);
  const ox = (rect.width - map.width * s) / 2;
  const oy = (rect.height - map.height * s) / 2;

  mctx.fillStyle = 'rgba(8, 12, 20, 0.9)';
  mctx.fillRect(0, 0, rect.width, rect.height);

  for (const room of map.rooms || []) {
    if (room.w <= 0) continue;
    mctx.fillStyle = 'rgba(80, 110, 160, 0.55)';
    mctx.fillRect(ox + room.x * s, oy + room.y * s, room.w * s, room.h * s);
  }

  const me = state.players.find((p) => p.id === state.you?.id);
  for (const p of state.players) {
    if (!p.alive) continue;
    const col = COLORS.find((x) => x.id === p.color) || COLORS[0];
    mctx.fillStyle = p.id === me?.id ? '#ffffff' : col.hex;
    mctx.beginPath();
    mctx.arc(ox + p.x * s, oy + p.y * s, p.id === me?.id ? 3 : 2.2, 0, Math.PI * 2);
    mctx.fill();
  }
}
