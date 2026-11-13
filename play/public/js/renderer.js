/* Renderização do Skeld com a geometria oficial, arte procedural e animações. */
import { GAME_CONSTANTS } from '/shared/rules.js';
import { COLORS } from '/shared/mapdata.js';
import { HATS, SKINS, VISORS, PETS, PLATES } from '/shared/cosmetics.js';
import {
  drawSpace, drawCrew, drawCorpse, drawVent, drawDoor,
  drawEmergencyButton, drawMeetingTable, drawPet, drawPlate, shade,
} from './art.js';

const lerp = (a, b, t) => a + (b - a) * t;
const pickCosmetic = (list, index) => list[Math.max(0, Math.min(list.length - 1, Number(index) || 0))] || list[0];

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

/* Paleta dos pisos por sala (tons de metal do Skeld). */
const PISO = {
  corredor: '#b3b8ab',
  porSala: {
    Cafeteria: '#b6bbad', Admin: '#b4b9ab', Weapons: '#b2b7aa', Nav: '#b6c0c2',
    Shields: '#a8b6bd', Storage: '#adb2a6', Electrical: '#a89a86', MedBay: '#b7c5c8',
    Security: '#aeb4ac', Reactor: '#aab4b6', UpperEngine: '#b2a99b', LowerEngine: '#b2a99b',
    LifeSupp: '#b3b9af', Comms: '#b1b6ae',
  },
  sala(id) {
    return this.porSala[id] || '#b0b5a9';
  },
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.camera = { x: -2, y: -2 };
    this.camLead = { x: 0, y: 0 };
    this.zoom = 60;
    this.time = 0;
    this.last = performance.now();
    this.shakeAmount = 0;
    this.shakeUntil = 0;
    this.kills = [];
    const doc = this.canvas.ownerDocument || (typeof document !== 'undefined' ? document : null);
    this.overlay = doc ? doc.createElement('canvas') : null;
    this.overlayCtx = this.overlay ? this.overlay.getContext('2d') : null;
    this.smooth = new Map();
    this.markers = [];
    this.visuals = [];
    this.ventOpen = new Map();
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.w = Math.max(320, rect.width);
    this.h = Math.max(320, rect.height);
    this.canvas.width = Math.floor(this.w * this.dpr);
    this.canvas.height = Math.floor(this.h * this.dpr);
    if (this.overlay) {
      this.overlay.width = this.canvas.width;
      this.overlay.height = this.canvas.height;
    }
    // enquadramento do navio inteiro (usado no mapa/screenshot)
    this.fitScale = Math.min(this.w / 52, this.h / 32);
    // escala de jogo: o original mostra ~11,5 x 6,6 unidades e o tripulante tem ~1 unidade
    this.zoom = Math.max(44, Math.min(190, Math.min(this.w / 14.6, this.h / 8.2)));
  }

  /* ---------------- câmera ---------------- */
  follow(player) {
    if (!player) return;
    const k = 0.16;
    this.camera.x = lerp(this.camera.x, player.x + this.camLead.x, k);
    this.camera.y = lerp(this.camera.y, player.y + this.camLead.y, k);
    this.camLead.x *= 0.92;
    this.camLead.y *= 0.92;
  }

  lead(dx, dy) {
    const max = 1.2;
    this.camLead.x = Math.max(-max, Math.min(max, this.camLead.x + dx * 0.5));
    this.camLead.y = Math.max(-max, Math.min(max, this.camLead.y + dy * 0.5));
  }

  shake(amount, ms = 380) {
    this.shakeAmount = Math.max(this.shakeAmount, amount);
    this.shakeUntil = performance.now() + ms;
  }

  /** Efeito de tarefa visual (scan, asteroides, escudos) visto por todos. */
  ventPuff(x, y, entering = true) {
    this.visuals.push({ kind: 'vent', x, y, t0: performance.now(), dur: 620, entering, seed: Math.random() * 6.28 });
  }

  visualTask(kind, x, y) {
    const dur = kind === 'scan' ? 4200 : kind === 'asteroids' ? 1800 : 2600;
    this.visuals.push({ kind, x, y, t0: performance.now(), dur });
  }

  /** Registra a animação de abate entre dois pontos. */
  killAt(victim, killer) {
    this.kills.push({ x: victim.x, y: victim.y, color: victim.color, killer, t0: performance.now() });
    this.shake(9, 520);
  }

  worldToScreen(x, y) {
    return {
      x: (x - this.camera.x) * this.zoom + this.w / 2,
      y: (this.h / 2) - (y - this.camera.y) * this.zoom,
    };
  }

  screenToWorld(sx, sy) {
    return {
      x: (sx - this.w / 2) / this.zoom + this.camera.x,
      y: (this.h / 2 - sy) / this.zoom + this.camera.y,
    };
  }

  /* ---------------- loop ---------------- */
  render(state, me, opts = {}) {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;

    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    if (!state) return;

    // tremor de câmera
    let ox = 0;
    let oy = 0;
    if (now < this.shakeUntil) {
      const k = this.shakeAmount * Math.pow((this.shakeUntil - now) / 520, 1.6);
      ox = (Math.random() - 0.5) * k;
      oy = (Math.random() - 0.5) * k;
    } else this.shakeAmount = 0;
    ctx.save();
    ctx.translate(ox, oy);

    drawSpace(ctx, this.w, this.h, this.time, this.camera.x, this.camera.y, this.zoom);

    this.drawShip(state, opts);
    this.bodyBirth = this.bodyBirth || new Map();
    for (const body of state.bodies || []) {
      if (!this.bodyBirth.has(body.id)) this.bodyBirth.set(body.id, performance.now());
      this.drawBody(body, state);
    }
    this.drawVisualTasks();
    this.drawKills(state);

    for (const a of state.noiseAlarms || []) this.drawNoiseAlarm(a);

    const tracked = new Set((state.you?.tracked || []).map((t) => t.id));
    const players = state.players || [];
    for (const p of players) {
      if (!p.alive) continue;
      if (tracked.has(p.id)) this.drawTracked(p);
      if (p.inVent && p.id !== me?.id) continue;
      if (p.hidden && p.id !== me?.id) continue;
      this.drawPlayer(p, p.id === me?.id, state);
      if (p.shielded) this.drawShield(p);
    }
    for (const p of players) {
      if (p.alive) continue;
      this.drawGhost(p, state);
    }

    const canVent = me?.role === 'impostor' || me?.roleType === 'Engineer';
    if (canVent && state.ship?.vents?.length) this.drawVents(state.ship.vents, me);
    this.drawDoors(state);
    this.drawTaskArrow(state, me);

    const lightsOut = !!state.lightsOut;
    const dark = lightsOut ? 0.88 : (me?.role === 'impostor' ? 0.34 : 0.46);
    const vision = me?.role === 'impostor' ? state.settings.impostorVision : state.settings.crewVision;
    this.drawVision(state, me, dark, vision, lightsOut);

    if (state.commsDown) this.drawCommsStatic();
    if (lightsOut) this.drawElectricalFlicker();
    ctx.restore();
  }

  /* ---------------- navio ---------------- */
  drawShip(state, opts = {}) {
    const { ctx } = this;
    const spaces = state.ship?.spaces || [];
    const corridors = state.ship?.corridors || opts.corridors || [];
    const z = this.zoom;

    // sombra do casco no espaço
    ctx.save();
    ctx.globalAlpha = 0.55;
    this.fillPlanWorld([...spaces, ...corridors], '#02040a', 0.9);
    ctx.restore();

    // casco da nave: as salas e corredores vivem dentro de um casco fechado
    const todas = [...spaces, ...corridors];
    this.drawHull(todas);

    // corredores primeiro (piso) para que as salas fiquem por cima
    for (const c of corridors) this.fillPlanWorld(c.shapes, PISO.corredor);
    for (const space of spaces) this.fillPlanWorld(space.shapes, PISO.sala(space.id));
    this.drawFloorTiles(todas);
    this.drawSceneVignette();
    // paredes: corredores com parede fina, salas com parede cheia
    this.strokePlanOutline(corridors, z, true);
    this.strokePlanOutline(spaces, z);

    // consoles oficiais (posições vindas dos dados do jogo)
    for (const c of state.ship?.consoles || []) this.drawConsole(c, z, state);

    // mesa da reunião: uma só, com o botão de emergência em cima (como no original)
    const em = state.ship?.emergency;
    if (em) {
      const s = this.worldToScreen(em.x, em.y);
      drawMeetingTable(ctx, { x: s.x, y: s.y, size: z * 0.42 });
    }

    // mesas azuis da Cafeteria (quatro laterais + a central do botão)
    const cafe = spaces.find((sp) => sp.id === 'Cafeteria');
    if (cafe) {
      const centro = em ? { x: em.x, y: em.y + 0.95 } : { x: -0.72, y: 1.6 };
      for (const [dx, dy] of [[-3.55, 2.6], [3.55, 2.6], [-3.55, -2.35], [3.55, -2.35]]) {
        this.drawCafeTable(centro.x + dx, centro.y + dy, 1.42, z);
      }
      this.drawCafeTable(centro.x, centro.y, 1.52, z);
    }

    // props das salas (sem os nomes gigantes de antes: o original só tem nome no mapa)
    for (const space of spaces) {
      for (const p of space.props || []) {
        // a mesa/cadeiras da Cafeteria são a mesa de reunião, já desenhada acima
        if (space.id === 'Cafeteria' && (p.type === 'table' || p.type === 'chair')) continue;
        this.drawProp(p, z, state);
      }
      // nome da sala, pequeno, junto à parede de baixo (como no original)
      const [rx1, ry1, rx2] = space.bounds || [0, 0, 0, 0];
      if (Math.abs(rx2 - rx1) > 3.2) this.drawRoomLabel(space.name, (rx1 + rx2) / 2, ry1 + 0.85);
    }

    // botão de emergência (em cima da mesa)
    if (em) {
      const s = this.worldToScreen(em.x, em.y);
      drawEmergencyButton(ctx, { x: s.x, y: s.y - z * 0.10, size: z * 0.62, t: this.time, disabled: state.emergencyLeft <= 0 });
    }

    // tarefas do jogador no chão
    if (state.you?.role === 'crew' && state.you.alive !== false) {
      for (const t of state.you.tasks || []) {
        if (t.done) continue;
        for (const c of t.consoles) this.drawTaskMarker(c);
      }
    }
  }

  /** Casco: silhueta convexa em volta de todas as salas e corredores. */
  drawHull(shapes) {
    const { ctx } = this;
    const pts = [];
    for (const g of shapes) {
      for (const sh of g.shapes || []) {
        for (const [x, y] of sh.points || []) pts.push([x, y]);
      }
    }
    if (pts.length < 3) return;

    // fecho convexo (monotone chain)
    const ordenado = pts.slice().sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
    const cruz = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const metade = (arr) => {
      const r = [];
      for (const p of arr) {
        while (r.length >= 2 && cruz(r[r.length - 2], r[r.length - 1], p) <= 0) r.pop();
        r.push(p);
      }
      return r;
    };
    const baixo = metade(ordenado);
    const cima = metade(ordenado.slice().reverse());
    const casco = baixo.slice(0, -1).concat(cima.slice(0, -1));

    // afasta cada vértice do centro (margem do casco)
    const cx = casco.reduce((a, p) => a + p[0], 0) / casco.length;
    const cy = casco.reduce((a, p) => a + p[1], 0) / casco.length;
    const margem = 1.15;
    const fora = casco.map(([x, y]) => {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy) || 1;
      return [x + (dx / d) * margem, y + (dy / d) * margem];
    });

    const caminho = () => {
      ctx.beginPath();
      fora.forEach(([x, y], i) => {
        const q = this.worldToScreen(x, y);
        i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y);
      });
      ctx.closePath();
    };
    ctx.save();
    caminho();
    const c0 = this.worldToScreen(cx, cy);
    const raio = Math.max(this.w, this.h) * 0.75;
    const g = ctx.createRadialGradient(c0.x, c0.y, raio * 0.15, c0.x, c0.y, raio);
    g.addColorStop(0, '#3d4d5b');
    g.addColorStop(0.6, '#33424f');
    g.addColorStop(1, '#283642');
    ctx.fillStyle = g;
    // cantos arredondados: traço grosso na mesma cor
    ctx.lineJoin = 'round';
    ctx.lineWidth = this.zoom * 1.6;
    ctx.strokeStyle = ctx.fillStyle;
    ctx.fill();
    ctx.stroke();

    // chapas do casco
    ctx.save();
    caminho();
    ctx.clip();
    ctx.strokeStyle = 'rgba(168, 202, 228, 0.09)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    const passo = 4.0 * this.zoom;
    const W = this.w + 200;
    const H = this.h + 200;
    for (let x = -100; x < W; x += passo) {
      ctx.moveTo(x, -100);
      ctx.lineTo(x, H);
    }
    for (let y = -100; y < H; y += passo) {
      ctx.moveTo(-100, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();
    ctx.restore();

    // borda e brilho externo do casco
    ctx.strokeStyle = 'rgba(132, 168, 196, 0.75)';
    ctx.lineWidth = Math.max(1.5, this.zoom * 0.16);
    caminho();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(12, 18, 26, 0.55)';
    ctx.lineWidth = Math.max(1, this.zoom * 0.07);
    ctx.stroke();
    ctx.restore();
  }

  /** Contorno grosso em unidades do mundo (usado para o casco da nave). */
  strokeHull(shapes, larguraMundo, color) {
    const { ctx } = this;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = color;
    ctx.lineWidth = larguraMundo * this.zoom;
    ctx.beginPath();
    for (const shape of shapes || []) {
      (shape.points || []).forEach(([x, y], i) => {
        const s = this.worldToScreen(x, y);
        i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y);
      });
      ctx.closePath();
    }
    ctx.stroke();
    ctx.restore();
  }

  fillPlanWorld(shapes, color, scale = 0) {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    for (const shape of shapes || []) {
      const pts = shape.points || [];
      pts.forEach(([x, y], i) => {
        const s = this.worldToScreen(x, y + scale);
        i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y);
      });
      ctx.closePath();
    }
    ctx.fill();
    ctx.restore();
  }

  strokePlanOutline(shapes, z, thin = false) {
    const { ctx } = this;
    // espessura em unidades do mundo: parede do original tem ~0,3 unidade
    const esp = (thin ? 0.20 : 0.32) * z;
    // aceita tanto uma lista de formas quanto uma lista de salas/corredores
    const lista = [];
    for (const g of shapes || []) {
      if (g && Array.isArray(g.shapes)) lista.push(...g.shapes);
      else if (g && Array.isArray(g.points)) lista.push(g);
    }
    const caminho = () => {
      ctx.beginPath();
      for (const shape of lista) {
        (shape.points || []).forEach(([x, y], i) => {
          const s = this.worldToScreen(x, y);
          i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y);
        });
        ctx.closePath();
      }
    };
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // sombra projetada da parede
    ctx.strokeStyle = 'rgba(3, 6, 10, 0.45)';
    ctx.lineWidth = esp * 1.5;
    caminho();
    ctx.stroke();
    // borda escura da parede
    ctx.strokeStyle = '#16202b';
    ctx.lineWidth = esp * 1.30;
    caminho();
    ctx.stroke();
    // face superior clara (o "topo" da parede, bem visível no original)
    ctx.strokeStyle = '#c9cbb8';
    ctx.lineWidth = esp * 0.66;
    caminho();
    ctx.stroke();
    // fio azul-petróleo no meio da parede (divisória)
    ctx.strokeStyle = 'rgba(40, 78, 92, 0.34)';
    ctx.lineWidth = esp * 0.12;
    caminho();
    ctx.stroke();
    ctx.restore();
  }

  /** Escurece as bordas do piso de uma sala (volume, como no original). */
  drawFloorVignette(space) {
    const { ctx } = this;
    const [x1, y1, x2, y2] = space.bounds || [0, 0, 0, 0];
    const a = this.worldToScreen(x1, y1);
    const b = this.worldToScreen(x2, y2);
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    const r = Math.max(b.x - a.x, b.y - a.y) * 0.78;
    ctx.save();
    ctx.beginPath();
    for (const shape of space.shapes || []) {
      (shape.points || []).forEach(([x, y], i) => {
        const s = this.worldToScreen(x, y);
        i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y);
      });
      ctx.closePath();
    }
    ctx.clip();
    const g = ctx.createRadialGradient(cx, cy, r * 0.35, cx, cy, r);
    g.addColorStop(0, 'rgba(6, 10, 18, 0)');
    g.addColorStop(0.72, 'rgba(6, 10, 18, 0.05)');
    g.addColorStop(1, 'rgba(6, 10, 18, 0.20)');
    ctx.fillStyle = g;
    ctx.fillRect(a.x - 4, a.y - 4, b.x - a.x + 8, b.y - a.y + 8);
    ctx.restore();
  }

  /** Piso de placas em losango, desenhado em coordenadas do mundo (nítido em qualquer zoom). */
  drawFloorTiles(grupos) {
    const { ctx } = this;
    const PASSO = 1.12; // lado do losango em unidades
    ctx.save();
    ctx.beginPath();
    for (const g of grupos || []) {
      for (const shape of g.shapes || []) {
        (shape.points || []).forEach(([x, y], i) => {
          const a = this.worldToScreen(x, y);
          i ? ctx.lineTo(a.x, a.y) : ctx.moveTo(a.x, a.y);
        });
        ctx.closePath();
      }
    }
    ctx.clip();

    const c0 = this.screenToWorld(-PASSO * 2, -PASSO * 2);
    const c1 = this.screenToWorld(this.w + PASSO * 2, this.h + PASSO * 2);
    const i0 = Math.floor(Math.min(c0.x, c1.x) / PASSO) - 1;
    const i1 = Math.ceil(Math.max(c0.x, c1.x) / PASSO) + 1;
    const j0 = Math.floor(Math.min(c0.y, c1.y) / PASSO) - 1;
    const j1 = Math.ceil(Math.max(c0.y, c1.y) / PASSO) + 1;
    const meio = PASSO * 0.5;
    const rx = meio * this.zoom;
    const ry = meio * this.zoom;
    // dois preenchimentos só (losangos claros e escuros)
    for (const tom of [1, 0]) {
      ctx.beginPath();
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          if ((((i + j) & 1) ? 1 : 0) !== tom) continue;
          const cx = i * PASSO + ((j & 1) ? meio : 0);
          const cy = j * PASSO;
          const s0 = this.worldToScreen(cx, cy);
          ctx.moveTo(s0.x, s0.y - ry);
          ctx.lineTo(s0.x + rx, s0.y);
          ctx.lineTo(s0.x, s0.y + ry);
          ctx.lineTo(s0.x - rx, s0.y);
          ctx.closePath();
        }
      }
      ctx.fillStyle = tom ? 'rgba(255, 255, 255, 0.050)' : 'rgba(28, 34, 28, 0.038)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(32, 40, 36, 0.16)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Vinheta de cena (cantos mais escuros), em espaço de tela. */
  drawSceneVignette() {
    const { ctx } = this;
    const g = ctx.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.30, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.78);
    g.addColorStop(0, 'rgba(4, 8, 14, 0)');
    g.addColorStop(1, 'rgba(4, 8, 14, 0.30)');
    ctx.save();
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.restore();
  }

  drawRoomLabel(text, x, y) {
    const { ctx } = this;
    const s = this.worldToScreen(x, y);
    ctx.save();
    ctx.font = `700 ${Math.max(11, this.zoom * 0.26)}px "Trebuchet MS", "Baloo 2", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(12, 18, 24, 0.55)';
    ctx.lineWidth = Math.max(1.6, this.zoom * 0.038);
    if (ctx.strokeText) ctx.strokeText(text, s.x, s.y);
    ctx.fillStyle = 'rgba(246, 249, 240, 0.92)';
    ctx.fillText(text, s.x, s.y);
    ctx.restore();
  }

  /* ---------------- consoles ---------------- */
  drawConsole(c, z, state) {
    const { ctx } = this;
    const s = this.worldToScreen(c.x, c.y);
    const mine = (state.you?.tasks || []).find((t) => (t.consoles || []).some((x) => x.id === c.id && x.room === c.room));
    const pulse = 0.55 + 0.35 * Math.sin(this.time * 2.4 + c.x);
    ctx.save();
    ctx.translate(s.x, s.y);
    const unit = z * 0.32;
    const body = '#2b3950';
    const edge = '#9abfe8';
    const glow = `rgba(120, 220, 255, ${pulse})`;
    // console com bisel, tela e sombra (como os painéis do original)
    const panel = (w, h, fill = body) => {
      const raio = Math.min(w, h) * 0.16;
      ctx.fillStyle = 'rgba(4, 8, 14, 0.35)';
      roundRect(ctx, -w / 2 + w * 0.06, -h / 2 + h * 0.10, w, h, raio);
      ctx.fill();
      const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
      g.addColorStop(0, '#3d5070');
      g.addColorStop(1, '#1d2a3d');
      ctx.fillStyle = fill === body ? g : fill;
      roundRect(ctx, -w / 2, -h / 2, w, h, raio);
      ctx.fill();
      ctx.strokeStyle = 'rgba(12, 20, 30, 0.85)';
      ctx.lineWidth = Math.max(1.2, Math.min(w, h) * 0.05);
      roundRect(ctx, -w / 2, -h / 2, w, h, raio);
      ctx.stroke();
      ctx.fillStyle = 'rgba(150, 196, 236, 0.30)';
      roundRect(ctx, -w / 2 + w * 0.06, -h / 2 + h * 0.08, w * 0.88, h * 0.16, raio * 0.6);
      ctx.fill();
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1;
      roundRect(ctx, -w / 2, -h / 2, w, h, raio);
      ctx.stroke();
      if (mine) {
        ctx.shadowColor = 'rgba(120, 220, 255, 0.8)';
        ctx.shadowBlur = z * 0.35;
        ctx.strokeStyle = `rgba(140, 230, 255, ${0.35 + 0.25 * Math.sin(this.time * 3)})`;
        ctx.lineWidth = Math.max(1.5, z * 0.055);
        roundRect(ctx, -w / 2 - 1, -h / 2 - 1, w + 2, h + 2, raio);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    };
    switch (c.task) {
      case 'SwipeCard':
        panel(unit * 2.2, unit * 1.5);
        ctx.fillStyle = glow;
        ctx.fillRect(-unit * 0.8, -unit * 0.45, unit * 1.6, unit * 0.28);
        break;
      case 'FixWiring':
        panel(unit * 2, unit * 2);
        ctx.strokeStyle = '#e8b64c';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(-unit * 0.6, -unit * 0.5);
        ctx.lineTo(unit * 0.15, 0);
        ctx.lineTo(-unit * 0.15, unit * 0.2);
        ctx.lineTo(unit * 0.6, unit * 0.6);
        ctx.stroke();
        break;
      case 'DownloadData':
      case 'UploadData':
        panel(unit * 2, unit * 1.6);
        ctx.fillStyle = glow;
        ctx.fillRect(-unit * 0.7, -unit * 0.45, unit * 1.4, unit * 0.9);
        break;
      case 'EmptyGarbage':
      case 'FuelEngines':
      case 'EmptyChute':
        ctx.fillStyle = '#465a76';
        ctx.fillRect(-unit * 1.2, -unit * 0.6, unit * 2.4, unit * 1.2);
        ctx.strokeStyle = edge;
        ctx.strokeRect(-unit * 1.2, -unit * 0.6, unit * 2.4, unit * 1.2);
        ctx.fillStyle = '#e8b64c';
        ctx.beginPath();
        ctx.arc(0, 0, unit * 0.35, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'DivertPower':
        panel(unit * 2, unit * 2, '#20304a');
        ctx.fillStyle = '#f0d25a';
        ctx.beginPath();
        ctx.moveTo(-unit * 0.2, -unit * 0.6);
        ctx.lineTo(unit * 0.35, -unit * 0.05);
        ctx.lineTo(0, -unit * 0.05);
        ctx.lineTo(unit * 0.2, unit * 0.6);
        ctx.lineTo(-unit * 0.35, unit * 0.05);
        ctx.lineTo(0, unit * 0.05);
        ctx.closePath();
        ctx.fill();
        break;
      case 'StartReactor':
        panel(unit * 2.6, unit * 1.4, '#1f3a32');
        ctx.strokeStyle = '#6ef0b5';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-unit * 0.5, unit * 0.3);
        ctx.lineTo(unit * 0.5, -unit * 0.3);
        ctx.stroke();
        break;
      case 'StabilizeSteering':
        ctx.strokeStyle = edge;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, unit * 0.9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-unit * 0.9, 0);
        ctx.lineTo(unit * 0.9, 0);
        ctx.moveTo(0, 0);
        ctx.lineTo(0, unit * 0.9);
        ctx.stroke();
        break;
      case 'PrimeShields':
      case 'ClearAsteroids':
        panel(unit * 2.2, unit * 1.8);
        ctx.fillStyle = '#ff8a5c';
        ctx.beginPath();
        ctx.arc(0, 0, unit * 0.3, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'SubmitScan':
        panel(unit * 2.2, unit * 2.4, '#20404a');
        ctx.fillStyle = `rgba(120, 255, 220, ${pulse})`;
        ctx.fillRect(-unit * 0.9, -unit * 1.0, unit * 1.8, unit * 0.25);
        break;
      default:
        panel(unit * 2, unit * 1.7);
        ctx.fillStyle = glow;
        ctx.fillRect(-unit * 0.7, -unit * 0.5, unit * 1.4, unit * 0.5);
        break;
    }
    if (mine) {
      ctx.strokeStyle = 'rgba(255, 214, 64, 0.7)';
      ctx.lineWidth = 1.6;
      ctx.strokeRect(-unit * 1.4, -unit * 1.35, unit * 2.8, unit * 2.7);
    }
    ctx.restore();
  }

  drawTaskMarker(console_) {
    const { ctx } = this;
    const s = this.worldToScreen(console_.x, console_.y);
    const pulse = 1 + Math.sin(this.time * 3.4) * 0.12;
    ctx.save();
    ctx.translate(s.x, s.y - this.zoom * 0.52);
    ctx.scale(pulse, pulse);
    const r = Math.max(7, this.zoom * 0.2);
    ctx.fillStyle = 'rgba(255, 214, 64, 0.96)';
    ctx.strokeStyle = 'rgba(60, 40, 0, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, r * 0.9);
    ctx.lineTo(-r * 0.85, -r * 0.5);
    ctx.lineTo(r * 0.85, -r * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#2a2200';
    ctx.font = `bold ${Math.max(9, this.zoom * 0.26)}px "Baloo 2", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', 0, -r * 0.06);
    ctx.restore();
  }

  /** Seta amarela na borda da tela apontando para a tarefa mais próxima. */
  drawTaskArrow(state, me) {
    if (!me || me.role !== 'crew' || me.alive === false) return;
    const tasks = (state.you?.tasks || []).filter((t) => !t.done);
    if (!tasks.length) return;
    let best = null;
    let bd = Infinity;
    for (const t of tasks) {
      for (const c of t.consoles) {
        const d = Math.hypot(c.x - this.camera.x, c.y - this.camera.y);
        if (d < bd) { bd = d; best = c; }
      }
    }
    if (!best) return;
    const s = this.worldToScreen(best.x, best.y);
    const margin = 62;
    const onScreen = s.x > margin && s.x < this.w - margin && s.y > margin && s.y < this.h - margin;
    if (onScreen) return;
    const { ctx } = this;
    const cx = this.w / 2;
    const cy = this.h / 2;
    const ang = Math.atan2(s.y - cy, s.x - cx);
    const rx = Math.min(cx, cy) - margin;
    const px = cx + Math.cos(ang) * (this.w / 2 - margin);
    const py = cy + Math.sin(ang) * (this.h / 2 - margin);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(ang + Math.PI / 2);
    ctx.fillStyle = 'rgba(255, 214, 64, 0.92)';
    ctx.strokeStyle = 'rgba(50, 35, 0, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(11, 10);
    ctx.lineTo(0, 4);
    ctx.lineTo(-11, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    void rx;
  }

  /* ---------------- jogadores ---------------- */
  smoothFor(p) {
    let s = this.smooth.get(p.id);
    if (!s) {
      s = { x: p.x, y: p.y, walk: Math.random(), facing: p.facing || 1, moving: false, name: p.name };
      this.smooth.set(p.id, s);
    }
    const dist = Math.hypot(p.x - s.x, p.y - s.y);
    if (dist > 3.5) {
      s.x = p.x;
      s.y = p.y;
    } else {
      s.x = lerp(s.x, p.x, 0.35);
      s.y = lerp(s.y, p.y, 0.35);
    }
    const speed = dist * 60;
    s.moving = p.moving || speed > 0.15;
    if (s.moving) s.walk += Math.min(0.09, 0.02 + speed * 0.004);
    else s.walk = lerp(s.walk, Math.round(s.walk), 0.2);
    if (p.facing) s.facing = p.facing;
    return s;
  }

  drawPlayer(p, isMe, state) {
    const { ctx } = this;
    const col = COLORS[p.color] || COLORS[0];
    const sm = this.smoothFor(p);
    const s = this.worldToScreen(sm.x, sm.y);
    const h = this.zoom * 0.98;
    const ghost = !p.alive;

    // nome (como no jogo: acima da cabeça)
    ctx.save();
    ctx.font = `800 ${Math.max(9, this.zoom * 0.205)}px "Baloo 2", "Trebuchet MS", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = p.name;
    const by = s.y - h * 0.78;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(4, 9, 18, 0.92)';
    ctx.lineWidth = Math.max(1.6, this.zoom * 0.040);
    if (ctx.strokeText) ctx.strokeText(label, s.x, by);
    ctx.fillStyle = isMe ? '#a8eeff' : '#f4f9ff';
    ctx.fillText(label, s.x, by);
    const plate = pickCosmetic(PLATES, p.plate);
    if (plate.art > 0) {
      const tw = ctx.measureText(label).width;
      drawPlate(ctx, {
        art: plate.art,
        pal: plate.pal,
        x: s.x,
        y: by + 0.5,
        w: tw + h * 0.34,
        h: h * 0.3,
        alpha: isMe ? 0.95 : 0.85,
      });
      ctx.fillStyle = isMe ? '#a8eeff' : '#f4f9ff';
      ctx.fillText(label, s.x, by + 0.5);
    }
    ctx.restore();

    drawCrew(ctx, {
      x: s.x,
      y: s.y,
      h,
      color: col.hex,
      facing: sm.facing,
      walk: sm.walk,
      phase: this.time * 3,
      ghost,
      alpha: ghost ? 0.55 : (p.hidden ? 0.42 : 1),
      highlight: false,
      hat: pickCosmetic(HATS, p.hat).art,
      hatPal: pickCosmetic(HATS, p.hat).pal,
      skin: pickCosmetic(SKINS, p.skin).art,
      skinPal: pickCosmetic(SKINS, p.skin).pal,
      visor: pickCosmetic(VISORS, p.visor).art,
      visorPal: pickCosmetic(VISORS, p.visor).pal,
    });

    // pet flutuando ao lado (como no jogo)
    const petItem = pickCosmetic(PETS, p.pet);
    if (petItem.art > 0 && !ghost) {
      drawPet(ctx, {
        id: petItem.art,
        x: s.x - sm.facing * h * 0.62,
        y: s.y + h * 0.18,
        h,
        color: col.hex,
        t: this.time,
        facing: sm.facing,
      });
    }

    // brilho de metamorfose (quem está transformado)
    if (p.shifted) this.drawShiftShimmer(s.x, s.y, h);
    // contorno fantasma quando invisível (só eu me vejo assim)
    if (p.hidden) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = 'rgba(170, 210, 255, 0.8)';
      ctx.lineWidth = Math.max(1, this.zoom * 0.03);
      ctx.setLineDash([this.zoom * 0.08, this.zoom * 0.07]);
      ctx.lineDashOffset = -this.time * this.zoom * 0.35;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y + h * 0.12, h * 0.42, h * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  /** Faíscas de metamorfose ao redor do impostor transformado. */
  drawShiftShimmer(x, y, h) {
    const { ctx } = this;
    ctx.save();
    for (let i = 0; i < 7; i++) {
      const a = this.time * 1.9 + (i / 7) * Math.PI * 2;
      const rr = h * (0.46 + 0.08 * Math.sin(this.time * 3 + i));
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr * 0.72;
      const sz = h * 0.05 * (0.7 + 0.5 * Math.sin(this.time * 5 + i * 1.7));
      ctx.globalAlpha = 0.35 + 0.35 * Math.sin(this.time * 4 + i);
      ctx.fillStyle = i % 2 ? '#d6b3ff' : '#8fd9ff';
      ctx.beginPath();
      ctx.moveTo(px, py - sz);
      ctx.lineTo(px + sz, py);
      ctx.lineTo(px, py + sz);
      ctx.lineTo(px - sz, py);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  drawGhost(p, state) {
    const { ctx } = this;
    const col = COLORS[p.color] || COLORS[0];
    const sm = this.smoothFor(p);
    const s = this.worldToScreen(sm.x, sm.y);
    const h = this.zoom * 0.95;
    ctx.save();
    // aura do fantasma
    const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, h * 0.9);
    grad.addColorStop(0, 'rgba(170, 220, 255, 0.16)');
    grad.addColorStop(1, 'rgba(170, 220, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(s.x - h, s.y - h, h * 2, h * 2);
    ctx.restore();
    drawCrew(ctx, {
      x: s.x,
      y: s.y,
      h,
      color: col.hex,
      facing: sm.facing,
      walk: sm.walk,
      phase: this.time * 2.4,
      ghost: true,
      alpha: 0.5,
      outline: false,
    });
    const { ctx: c2 } = this;
    c2.save();
    c2.globalAlpha = 0.5;
    c2.fillStyle = 'rgba(220, 238, 255, 0.9)';
    c2.font = `700 ${Math.max(8, this.zoom * 0.26)}px "Baloo 2", sans-serif`;
    c2.textAlign = 'center';
    c2.fillText(p.name, s.x, s.y - h * 0.8);
    c2.restore();
    void state;
  }

  /** Alvo marcado pelo Rastreador: mira girando. */
  drawTracked(p) {
    const { ctx } = this;
    const sm = this.smoothFor(p);
    const s = this.worldToScreen(sm.x, sm.y);
    const r = this.zoom * 0.5;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(this.time * 1.4);
    ctx.strokeStyle = 'rgba(255, 214, 106, 0.9)';
    ctx.lineWidth = Math.max(1.2, this.zoom * 0.035);
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, r, i * (Math.PI / 2) + 0.2, i * (Math.PI / 2) + 0.9);
      ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    ctx.fillStyle = 'rgba(255, 214, 106, 0.95)';
    ctx.font = `700 ${Math.max(8, this.zoom * 0.22)}px "Baloo 2", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('◎', s.x, s.y - r - this.zoom * 0.1);
    ctx.restore();
  }

  /** Bolha do Anjo da Guarda. */
  drawShield(p) {
    const { ctx } = this;
    const sm = this.smoothFor(p);
    const s = this.worldToScreen(sm.x, sm.y);
    const r = this.zoom * 0.72;
    const pulse = 0.6 + 0.4 * Math.sin(this.time * 3.2);
    ctx.save();
    const grad = ctx.createRadialGradient(s.x, s.y, r * 0.2, s.x, s.y, r * 1.25);
    grad.addColorStop(0, 'rgba(120, 220, 255, 0.05)');
    grad.addColorStop(0.7, `rgba(120, 220, 255, ${0.13 * pulse})`);
    grad.addColorStop(1, 'rgba(120, 220, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r * 1.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(150, 235, 255, ${0.55 + 0.25 * pulse})`;
    ctx.lineWidth = Math.max(1, this.zoom * 0.04);
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.stroke();
    // hexágonos orbitando
    for (let i = 0; i < 6; i++) {
      const a = this.time * 1.6 + (i / 6) * Math.PI * 2;
      const hx = s.x + Math.cos(a) * r;
      const hy = s.y + Math.sin(a) * r * 0.55;
      ctx.globalAlpha = 0.5 + 0.4 * pulse;
      ctx.fillStyle = '#bff2ff';
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const ang = (k / 6) * Math.PI * 2 + this.time;
        const rr = this.zoom * 0.055;
        const x = hx + Math.cos(ang) * rr;
        const y = hy + Math.sin(ang) * rr;
        k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  /** Alarme do Barulhento: ondas sonoras no local da morte. */
  drawNoiseAlarm(a) {
    const { ctx } = this;
    const s = this.worldToScreen(a.x, a.y);
    const left = Math.max(0, (a.until - Date.now()) / 1000);
    const k = 1 - Math.min(1, left / 5);
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const t = (this.time * 1.2 + i / 3) % 1;
      const r = this.zoom * (0.2 + t * 0.9);
      ctx.globalAlpha = (1 - t) * 0.5 * (1 - k * 0.4);
      ctx.strokeStyle = '#ffd76a';
      ctx.lineWidth = Math.max(1.2, this.zoom * 0.05);
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#ffe08a';
    ctx.font = `700 ${Math.max(10, this.zoom * 0.3)}px "Baloo 2", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('!', s.x, s.y - this.zoom * 0.2);
    ctx.restore();
    void a;
  }

  drawBody(body, state) {
    const { ctx } = this;
    const col = COLORS[body.color] || COLORS[0];
    const s = this.worldToScreen(body.x, body.y);
    const h = this.zoom * 0.95;
    // halo de "corpo" para facilitar achar
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 2);
    ctx.save();
    ctx.globalAlpha = 0.10 + pulse * 0.08;
    ctx.fillStyle = '#ff3b4e';
    ctx.beginPath();
    ctx.arc(s.x, s.y, h * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // "pop" de surgimento do corpo
    const born = this.bodyBirth?.get(body.id) || 0;
    const age = born ? Math.min(1, (performance.now() - born) / 320) : 1;
    const pop = 0.6 + 0.4 * age + 0.12 * Math.sin(age * Math.PI);
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.scale(pop, pop);
    ctx.translate(-s.x, -s.y);
    drawCorpse(ctx, { x: s.x, y: s.y, h, color: col.hex, rotation: (body.x * 13) % 1 + 0.2, t: this.time });
    ctx.restore();
    void state;
  }

  drawVisualTasks() {
    const now = performance.now();
    this.visuals = this.visuals.filter((v) => now - v.t0 < v.dur);
    const { ctx } = this;
    for (const v of this.visuals) {
      const t = (now - v.t0) / v.dur;
      const s = this.worldToScreen(v.x, v.y);
      const z = this.zoom;
      ctx.save();
      ctx.translate(s.x, s.y);
      if (v.kind === 'scan') {
        // feixe do scanner da Enfermaria
        const beam = ctx.createLinearGradient(0, -z * 1.6, 0, z * 0.2);
        beam.addColorStop(0, 'rgba(120, 255, 210, 0)');
        beam.addColorStop(0.5, `rgba(120, 255, 210, ${0.35 * (1 - t)})`);
        beam.addColorStop(1, 'rgba(120, 255, 210, 0.05)');
        ctx.fillStyle = beam;
        ctx.fillRect(-z * 0.42, -z * 1.6, z * 0.84, z * 1.8);
        for (let i = 0; i < 3; i++) {
          const k = (t * 1.6 + i / 3) % 1;
          ctx.strokeStyle = `rgba(150, 255, 220, ${(1 - k) * 0.6})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(0, z * 0.2 - k * z * 1.5, z * (0.3 + k * 0.25), z * (0.1 + k * 0.06), 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (v.kind === 'vent') {
        // nuvem de vapor quando alguém entra ou sai do duto
        const open = v.entering ? Math.min(1, t * 3) : Math.max(0, 1 - t * 1.6);
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2 + v.seed;
          const rr = z * (0.18 + open * 0.55) * (0.7 + 0.5 * Math.sin(i * 2.7 + t * 6));
          ctx.globalAlpha = (1 - t) * 0.5;
          ctx.fillStyle = i % 2 ? '#cfe0f2' : '#9fb6cf';
          ctx.beginPath();
          ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr * 0.75, z * 0.09 * (1 - t * 0.6), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = (1 - t) * 0.55;
        ctx.strokeStyle = '#dbe9f7';
        ctx.lineWidth = Math.max(1, z * 0.035);
        ctx.beginPath();
        ctx.ellipse(0, 0, z * (0.25 + t * 0.5), z * (0.16 + t * 0.32), 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (v.kind === 'asteroids') {
        // tiros saindo do console de Armas para o espaço
        for (let i = 0; i < 9; i++) {
          const a = -0.9 + i * 0.24 + Math.sin(i * 4.1) * 0.05;
          const len = z * (0.5 + t * 2.4);
          ctx.strokeStyle = `rgba(255, 220, 120, ${(1 - t) * 0.9})`;
          ctx.lineWidth = Math.max(1.5, z * 0.05);
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * z * 0.25, Math.sin(a) * z * 0.25);
          ctx.lineTo(Math.cos(a) * (z * 0.25 + len), Math.sin(a) * (z * 0.25 + len));
          ctx.stroke();
        }
        ctx.fillStyle = `rgba(255, 200, 90, ${0.5 * (1 - t)})`;
        ctx.beginPath();
        ctx.arc(0, 0, z * 0.3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // escudos: anéis hexagonais azuis
        for (let i = 0; i < 2; i++) {
          const k = (t * 1.4 + i * 0.5) % 1;
          const r = z * (0.9 + k * 2.2);
          ctx.strokeStyle = `rgba(120, 200, 255, ${(1 - k) * 0.55})`;
          ctx.lineWidth = Math.max(2, z * 0.07);
          ctx.beginPath();
          for (let a = 0; a < 6; a++) {
            const ang = (a / 6) * Math.PI * 2 + Math.PI / 6;
            const px = Math.cos(ang) * r;
            const py = Math.sin(ang) * r;
            a ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
          }
          ctx.closePath();
          ctx.stroke();
        }
        ctx.fillStyle = `rgba(140, 210, 255, ${0.25 * (1 - t)})`;
        ctx.beginPath();
        ctx.arc(0, 0, z * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  drawKills() {
    const now = performance.now();
    this.kills = this.kills.filter((k) => now - k.t0 < 1100);
    const { ctx } = this;
    for (const k of this.kills) {
      const t = (now - k.t0) / 1100;
      const s = this.worldToScreen(k.x, k.y);
      const h = this.zoom;
      ctx.save();
      ctx.translate(s.x, s.y);
      // golpe: risco branco entre o impostor e a vítima
      if (k.killer && t < 0.45) {
        const ks = this.worldToScreen(k.killer.x, k.killer.y);
        ctx.save();
        ctx.globalAlpha = (1 - t / 0.45) * 0.9;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(ks.x - s.x, ks.y - s.y);
        ctx.lineTo(0, 0);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255, 60, 80, 0.9)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0, 0, this.zoom * (0.15 + t), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      // clarão + respingos
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = 'rgba(255, 240, 240, 0.85)';
      ctx.beginPath();
      ctx.arc(0, 0, h * (0.25 + t * 0.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(200, 20, 40, 0.85)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + k.x;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * h * 0.1, Math.sin(a) * h * 0.1);
        ctx.lineTo(Math.cos(a) * h * (0.25 + t * 0.45), Math.sin(a) * h * (0.25 + t * 0.45));
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawVents(vents, me) {
    for (const v of vents) {
      const s = this.worldToScreen(v.x, v.y);
      const near = me && Math.hypot(v.x - (me.x ?? 0), v.y - (me.y ?? 0)) < 1.5;
      const target = me?.ventId === v.id ? 1 : 0;
      const cur = this.ventOpen.get(v.id) ?? 0;
      const open = cur + (target - cur) * 0.18;
      this.ventOpen.set(v.id, open);
      drawVent(this.ctx, {
        x: s.x,
        y: s.y,
        size: this.zoom * 0.5,
        open,
        active: me?.ventId === v.id,
        highlight: near,
      });
    }
  }

  drawDoors(state) {
    const now = Date.now();
    for (const d of state.ship?.doors || []) {
      const s = this.worldToScreen(d.x, d.y);
      let closed = 0;
      if (!d.open) {
        const remaining = d.closesIn ?? 6000;
        closed = Math.min(1, Math.max(0, 1 - remaining / 400));
      }
      drawDoor(this.ctx, {
        x: s.x,
        y: s.y,
        size: this.zoom * 0.5,
        closed: d.open ? 0 : Math.max(0.2, closed),
        orientation: d.orientation || 'h',
      });
      void now;
    }
  }

  /* ---------------- props ---------------- */
  /** Mesa redonda azul da Cafeteria (tampo, aro e base). */
  drawCafeTable(x, y, r, z) {
    const { ctx } = this;
    const s = this.worldToScreen(x, y);
    const R = r * z;
    ctx.save();
    ctx.translate(s.x, s.y);
    // sombra
    ctx.fillStyle = 'rgba(20, 26, 22, 0.20)';
    ctx.beginPath();
    ctx.arc(R * 0.05, R * 0.09, R, 0, Math.PI * 2);
    ctx.fill();
    // base/aro
    ctx.fillStyle = '#3c4a54';
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fill();
    // tampo
    const g = ctx.createRadialGradient(-R * 0.3, -R * 0.34, R * 0.12, 0, 0, R * 1.05);
    g.addColorStop(0, '#4b91bd');
    g.addColorStop(0.55, '#3a7aab');
    g.addColorStop(1, '#2f6491');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.90, 0, Math.PI * 2);
    ctx.fill();
    // aro claro interno, com quatro aberturas (segmentos da mesa do original)
    ctx.strokeStyle = 'rgba(186, 230, 248, 0.55)';
    ctx.lineWidth = Math.max(1.5, R * 0.035);
    for (let i = 0; i < 4; i++) {
      const a0 = i * (Math.PI / 2) + 0.16;
      const a1 = a0 + Math.PI / 2 - 0.32;
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.82, a0, a1);
      ctx.stroke();
    }
    // recortes escuros do aro
    ctx.strokeStyle = 'rgba(30, 44, 52, 0.55)';
    ctx.lineWidth = Math.max(2, R * 0.06);
    for (let i = 0; i < 4; i++) {
      const a = i * (Math.PI / 2) + Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * R * 0.94, Math.sin(a) * R * 0.94);
      ctx.lineTo(Math.cos(a) * R * 0.68, Math.sin(a) * R * 0.68);
      ctx.stroke();
    }
    // brilho no tampo
    ctx.fillStyle = 'rgba(255,255,255,0.09)';
    ctx.beginPath();
    ctx.ellipse(-R * 0.30, -R * 0.32, R * 0.30, R * 0.16, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawProp(p, z) {
    const { ctx } = this;
    const s = this.worldToScreen(p.x, p.y);
    ctx.save();
    ctx.translate(s.x, s.y);
    switch (p.type) {
      case 'table': {
        const r = (p.r || 0.95) * z;
        // mesa de escritório: tampo claro, borda escura e pés
        ctx.fillStyle = 'rgba(6, 10, 16, 0.30)';
        ctx.beginPath();
        ctx.ellipse(r * 0.06, r * 0.14, r * 1.02, r * 0.94, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#39485a';
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        const tg = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
        tg.addColorStop(0, '#9db3c9');
        tg.addColorStop(1, '#61748a');
        ctx.fillStyle = tg;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(226, 240, 255, 0.35)';
        ctx.lineWidth = Math.max(1, r * 0.05);
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.74, 0, Math.PI * 2);
        ctx.stroke();
        // monitorzinho em cima
        ctx.fillStyle = '#22303f';
        roundRect(ctx, -r * 0.34, -r * 0.52, r * 0.68, r * 0.34, r * 0.08);
        ctx.fill();
        ctx.fillStyle = 'rgba(120, 220, 255, 0.75)';
        roundRect(ctx, -r * 0.28, -r * 0.46, r * 0.56, r * 0.22, r * 0.05);
        ctx.fill();
        break;
      }
      case 'chair': {
        const r = 0.30 * z;
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.beginPath();
        ctx.ellipse(0, r * 0.5, r * 1.05, r * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#48576d';
        roundRect(ctx, -r, -r * 0.4, r * 2, r * 1.5, r * 0.4);
        ctx.fill();
        ctx.fillStyle = '#6a7d97';
        roundRect(ctx, -r * 0.82, -r * 0.28, r * 1.64, r * 0.7, r * 0.28);
        ctx.fill();
        break;
      }
      case 'engine': {
        const r = (p.r || 1.6) * z;
        ctx.strokeStyle = 'rgba(150, 190, 240, 0.5)';
        ctx.lineWidth = Math.max(2, 2.2 * z * 0.1);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-r, -r);
        ctx.lineTo(r, r);
        ctx.moveTo(-r, r);
        ctx.lineTo(r, -r);
        ctx.stroke();
        break;
      }
      case 'reactor':
      case 'shieldGen': {
        const r = (p.r || 1.5) * z;
        ctx.strokeStyle = p.type === 'reactor' ? 'rgba(120, 255, 190, 0.45)' : 'rgba(140, 200, 255, 0.5)';
        ctx.lineWidth = Math.max(2, 2.4 * z * 0.1);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(120, 200, 255, 0.22)';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.66, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'bed': {
        const w = (p.w || 1.5) * z;
        const h = (p.h || 0.9) * z;
        const raio = Math.min(w, h) * 0.14;
        ctx.fillStyle = 'rgba(4, 8, 14, 0.28)';
        roundRect(ctx, -w / 2 + h * 0.06, -h / 2 + h * 0.10, w, h, raio);
        ctx.fill();
        // estrutura
        ctx.fillStyle = '#5f6f80';
        roundRect(ctx, -w / 2, -h / 2, w, h, raio);
        ctx.fill();
        // colchão
        ctx.fillStyle = '#e8eef6';
        roundRect(ctx, -w / 2 + h * 0.08, -h / 2 + h * 0.10, w - h * 0.16, h - h * 0.20, raio * 0.8);
        ctx.fill();
        // travesseiro
        ctx.fillStyle = '#f7fbff';
        roundRect(ctx, -w / 2 + h * 0.16, -h / 2 + h * 0.18, w * 0.26, h * 0.30, h * 0.10);
        ctx.fill();
        ctx.strokeStyle = 'rgba(120, 140, 165, 0.5)';
        ctx.lineWidth = 1;
        roundRect(ctx, -w / 2 + h * 0.16, -h / 2 + h * 0.18, w * 0.26, h * 0.30, h * 0.10);
        ctx.stroke();
        // manta
        const mg = ctx.createLinearGradient(0, -h * 0.1, 0, h / 2);
        mg.addColorStop(0, '#8fc5dd');
        mg.addColorStop(1, '#4f8fb8');
        ctx.fillStyle = mg;
        roundRect(ctx, -w / 2 + w * 0.40, -h / 2 + h * 0.14, w * 0.48, h * 0.68, raio * 0.7);
        ctx.fill();
        break;
      }
      case 'plant': {
        const r = 0.42 * z;
        ctx.fillStyle = 'rgba(0,0,0,0.26)';
        ctx.beginPath();
        ctx.ellipse(0, r * 0.75, r * 0.9, r * 0.32, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3a4a63';
        ctx.beginPath();
        ctx.moveTo(-r * 0.45, r * 0.2);
        ctx.lineTo(r * 0.45, r * 0.2);
        ctx.lineTo(r * 0.32, r * 0.8);
        ctx.lineTo(-r * 0.32, r * 0.8);
        ctx.closePath();
        ctx.fill();
        for (const [dx, dy, rr] of [[-0.22, -0.1, 0.42], [0.24, -0.16, 0.38], [0, -0.5, 0.40], [-0.3, -0.55, 0.28], [0.32, -0.5, 0.26]]) {
          ctx.fillStyle = dy < -0.3 ? '#3f8a58' : '#2f6b47';
          ctx.beginPath();
          ctx.ellipse(dx * r, dy * r, rr * r, rr * r * 0.9, dx * 0.3, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'bench': {
        const w = (p.w || 2) * z;
        const h = (p.h || 0.7) * z;
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        roundRect(ctx, -w / 2 + h * 0.10, -h / 2 + h * 0.20, w, h, h * 0.22);
        ctx.fill();
        // pés
        ctx.fillStyle = '#1d2836';
        for (const dx of [-0.36, 0.36]) {
          roundRect(ctx, dx * w - w * 0.03, h * 0.02, w * 0.06, h * 0.5, h * 0.1);
          ctx.fill();
        }
        // assento
        const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
        g.addColorStop(0, '#5d80ab');
        g.addColorStop(1, '#33507a');
        ctx.fillStyle = g;
        roundRect(ctx, -w / 2, -h / 2, w, h * 0.72, h * 0.2);
        ctx.fill();
        ctx.fillStyle = 'rgba(210, 232, 255, 0.22)';
        roundRect(ctx, -w / 2 + h * 0.08, -h / 2 + h * 0.08, w - h * 0.16, h * 0.18, h * 0.1);
        ctx.fill();
        break;
      }
      case 'trash':
        ctx.fillStyle = '#4a5c78';
        ctx.fillRect(-0.35 * z, -0.45 * z, 0.7 * z, 0.9 * z);
        break;
      case 'fuel': {
        const w = (p.w || 1.1) * z;
        ctx.fillStyle = '#b8873a';
        ctx.fillRect(-w / 2, -w / 2, w, w);
        break;
      }
      case 'window': {
        let w = (p.w || 2.4) * z;
        let h = (p.h || 0.42) * z;
        if (h > w) {
          // janela em parede vertical: desenha girada
          ctx.rotate(Math.PI / 2);
          const t = w;
          w = h;
          h = t;
        }
        ctx.fillStyle = 'rgba(8, 14, 22, 0.55)';
        roundRect(ctx, -w / 2 - h * 0.18, -h / 2 - h * 0.18, w + h * 0.36, h + h * 0.36, h * 0.28);
        ctx.fill();
        ctx.fillStyle = '#1b242f';
        roundRect(ctx, -w / 2, -h / 2, w, h, h * 0.22);
        ctx.fill();
        const vidro = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
        vidro.addColorStop(0, '#a8e4f6');
        vidro.addColorStop(1, '#4d9fc9');
        ctx.fillStyle = vidro;
        const n = Math.max(2, Math.round(w / (z * 0.62)));
        const passa = w / n;
        for (let i = 0; i < n; i++) {
          roundRect(ctx, -w / 2 + i * passa + h * 0.12, -h / 2 + h * 0.14, passa - h * 0.24, h * 0.72, h * 0.16);
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(255,255,255,0.30)';
        ctx.fillRect(-w / 2, -h / 2 + h * 0.18, w, Math.max(1, h * 0.12));
        break;
      }
      case 'panel': {
        const w = (p.w || 1.2) * z;
        const h = (p.h || 0.5) * z;
        ctx.fillStyle = 'rgba(6, 10, 16, 0.35)';
        roundRect(ctx, -w / 2 + h * 0.1, -h / 2 + h * 0.14, w, h, h * 0.18);
        ctx.fill();
        ctx.fillStyle = '#2b3a4a';
        roundRect(ctx, -w / 2, -h / 2, w, h, h * 0.16);
        ctx.fill();
        ctx.fillStyle = '#16212c';
        roundRect(ctx, -w / 2 + h * 0.12, -h / 2 + h * 0.14, w - h * 0.24, h * 0.62, h * 0.12);
        ctx.fill();
        ctx.fillStyle = 'rgba(120, 220, 255, 0.55)';
        ctx.fillRect(-w / 2 + h * 0.22, -h / 2 + h * 0.26, w * 0.22, Math.max(1.5, h * 0.14));
        ctx.fillStyle = 'rgba(255, 190, 90, 0.75)';
        ctx.beginPath();
        ctx.arc(w / 2 - h * 0.3, -h * 0.02, Math.max(1.2, h * 0.08), 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'console': {
        const w = (p.w || 1.2) * z;
        const h = (p.h || 0.7) * z;
        ctx.fillStyle = '#39506f';
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.fillStyle = 'rgba(120, 220, 255, 0.8)';
        ctx.fillRect(-w / 2 + 2, -h / 2 + 2, w - 4, h / 2.4);
        break;
      }
      case 'crate': {
        const w = (p.w || 1.2) * z;
        const h = (p.h || 1.1) * z;
        ctx.fillStyle = 'rgba(8, 12, 18, 0.30)';
        roundRect(ctx, -w / 2 + h * 0.06, -h / 2 + h * 0.10, w, h, h * 0.09);
        ctx.fill();
        const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
        g.addColorStop(0, '#6d7d8c');
        g.addColorStop(1, '#3f4d5c');
        ctx.fillStyle = g;
        roundRect(ctx, -w / 2, -h / 2, w, h, h * 0.07);
        ctx.fill();
        ctx.strokeStyle = 'rgba(16, 24, 32, 0.65)';
        ctx.lineWidth = Math.max(1.2, h * 0.05);
        roundRect(ctx, -w / 2, -h / 2, w, h, h * 0.07);
        ctx.stroke();
        ctx.fillStyle = 'rgba(232, 196, 92, 0.85)';
        ctx.fillRect(-w / 2 + w * 0.10, -h * 0.06, w * 0.80, Math.max(2, h * 0.10));
        break;
      }
      default:
        break;
    }
    ctx.restore();
  }

  /* ---------------- escuridão / visão ---------------- */
  drawVision(state, me, dark, vision, lightsOut) {
    const { ctx } = this;
    const c = me
      ? this.worldToScreen(state.__meX ?? me.x ?? 0, state.__meY ?? me.y ?? 0)
      : { x: this.w / 2, y: this.h / 2 };
    const radiusWorld = (lightsOut ? 3.1 : 8.2) * Math.max(0.45, vision);
    const R = Math.max(80, radiusWorld * this.zoom);

    // máscara de luz em cache (só muda quando o raio/escurecimento mudam)
    const cache = this.mascaraLuz(R, dark);
    if (cache) {
      ctx.save();
      ctx.globalAlpha = 1;
      const mw = this.w * 1.6;
      const mh = this.h * 1.6;
      ctx.drawImage(cache, c.x - mw / 2, c.y - mh / 2, mw, mh);
      ctx.restore();
    } else {
      ctx.save();
      ctx.fillStyle = this.gradienteLuz(ctx, c.x, c.y, R, dark);
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.restore();
    }

    if (lightsOut) {
      // brilho residual nas lâmpadas
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = '#7fd4ff';
      for (const sp of state.ship?.spaces || []) {
        const [x1, , x2, y2] = sp.bounds || [0, 0, 0, 0];
        const s = this.worldToScreen((x1 + x2) / 2, y2 - 2);
        ctx.beginPath();
        ctx.arc(s.x, s.y, this.zoom * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /** Gradiente radial de escuridão (transparente perto do jogador). */
  gradienteLuz(ctx, cx, cy, R, dark) {
    const r0 = R * 0.28;
    const r1 = Math.max(R * 1.15, Math.hypot(this.w, this.h) * 0.75);
    const pos = (r) => Math.max(0, Math.min(1, (r - r0) / (r1 - r0)));
    const g = ctx.createRadialGradient(cx, cy, r0, cx, cy, r1);
    const tubo = (a) => `rgba(3, 6, 12, ${Math.min(0.95, a)})`;
    g.addColorStop(0, tubo(0));
    g.addColorStop(pos(R * 0.62), tubo(dark * 0.42));
    g.addColorStop(pos(R * 0.88), tubo(dark * 0.80));
    g.addColorStop(pos(R), tubo(dark));
    g.addColorStop(1, tubo(dark));
    return g;
  }

  /** Cache em baixa resolução da máscara de luz (gradiente suave não precisa de mais). */
  mascaraLuz(R, dark) {
    const doc = this.canvas?.ownerDocument;
    if (!doc || !doc.createElement) return null;
    const escala = 0.5;
    const w = Math.max(32, Math.round(this.w * 1.6 * escala));
    const h = Math.max(32, Math.round(this.h * 1.6 * escala));
    const chave = `${Math.round(R)}:${dark.toFixed(2)}:${w}x${h}`;
    if (this._luzChave === chave) return this._luzCanvas;
    const cv = this._luzCanvas && this._luzCanvas.width === w && this._luzCanvas.height === h
      ? this._luzCanvas
      : doc.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const g2 = cv.getContext('2d');
    g2.clearRect(0, 0, w, h);
    const anterior = { w: this.w, h: this.h };
    this.w = w;
    this.h = h;
    g2.fillStyle = this.gradienteLuz(g2, w / 2, h / 2, R * escala, dark);
    g2.fillRect(0, 0, w, h);
    this.w = anterior.w;
    this.h = anterior.h;
    this._luzCanvas = cv;
    this._luzChave = chave;
    return cv;
  }

  drawCommsStatic() {
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = '#8affe0';
    for (let i = 0; i < 90; i++) {
      ctx.fillRect(Math.random() * this.w, Math.random() * this.h, 2, 1);
    }
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = 'rgba(255, 90, 90, 0.85)';
    ctx.font = `700 ${Math.max(11, this.w * 0.012)}px "Baloo 2", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('COMUNICAÇÃO FORA DO AR', this.w / 2, 26);
    ctx.restore();
  }

  drawElectricalFlicker() {
    const { ctx } = this;
    if (Math.sin(this.time * 7.3) <= 0.82) return;
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.restore();
  }

  /** Desenha o mapa (Tab) num canvas separado. */
  drawMinimap(canvas, state, me, colors) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || 520;
    const h = canvas.clientHeight || 320;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const spaces = state.ship?.spaces || [];
    const corridors = state.ship?.corridors || [];
    let x1 = Infinity; let y1 = Infinity; let x2 = -Infinity; let y2 = -Infinity;
    for (const g of [...spaces, ...corridors]) {
      for (const sh of g.shapes || []) {
        for (const [px, py] of sh.points || []) {
          x1 = Math.min(x1, px); y1 = Math.min(y1, py);
          x2 = Math.max(x2, px); y2 = Math.max(y2, py);
        }
      }
    }
    const pad = 26;
    const scale = Math.min((w - pad * 2) / (x2 - x1), (h - pad * 2) / (y2 - y1));
    const ox = (w - (x2 - x1) * scale) / 2;
    const oy = (h - (y2 - y1) * scale) / 2;
    const toS = (px, py) => [ox + (px - x1) * scale, oy + (y2 - py) * scale];

    const path = (shapes) => {
      ctx.beginPath();
      for (const sh of shapes || []) {
        (sh.points || []).forEach(([px, py], i) => {
          const [sx, sy] = toS(px, py);
          i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy);
        });
        ctx.closePath();
      }
    };

    for (const c of corridors) {
      path(c.shapes);
      ctx.fillStyle = '#5f7294';
      ctx.fill();
    }
    for (const sp of spaces) {
      path(sp.shapes);
      ctx.fillStyle = '#7c90b3';
      ctx.fill();
      ctx.strokeStyle = 'rgba(220, 236, 255, 0.85)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      const [bx1, , bx2, by2] = sp.bounds || [0, 0, 0, 0];
      const [lx, ly] = toS((bx1 + bx2) / 2, by2 - 0.9);
      ctx.fillStyle = 'rgba(240, 248, 255, 0.92)';
      ctx.font = '700 10px "Baloo 2", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(sp.name).toUpperCase(), lx, ly);
    }

    const colorOf = (idx) => colors?.find((c) => c.id === idx)?.hex || '#c51111';

    // tarefas
    if (me?.role === 'crew') {
      for (const t of state.you?.tasks || []) {
        if (t.done) continue;
        for (const c of t.consoles || []) {
          const [sx, sy] = toS(c.x, c.y);
          ctx.fillStyle = '#ffd640';
          ctx.beginPath();
          ctx.arc(sx, sy, 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    // alvos marcados pelo rastreador
    for (const t of state.you?.tracked || []) {
      const p = state.players.find((q) => q.id === t.id);
      if (!p || !p.alive) continue;
      const [sx, sy] = toS(p.x, p.y);
      ctx.strokeStyle = 'rgba(255, 214, 106, 0.95)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = colorOf(p.color);
      ctx.beginPath();
      ctx.arc(sx, sy, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // sabotagem
    if (state.sabotage) {
      const room = spaces.find((s) => s.id === state.sabotage.roomId);
      if (room) {
        const [bx1, , bx2, by2] = room.bounds || [0, 0, 0, 0];
        const [sx, sy] = toS((bx1 + bx2) / 2, (by2 + (room.bounds?.[1] || by2)) / 2);
        ctx.strokeStyle = `rgba(255, 60, 70, ${0.55 + 0.4 * Math.sin(this.time * 6)})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(sx, sy, 14, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // outros jogadores (só impostor vê todos, como no jogo)
    if (me?.role === 'impostor') {
      for (const p of state.players) {
        if (!p.alive || p.id === me.id) continue;
        const [sx, sy] = toS(p.x, p.y);
        ctx.fillStyle = colorOf(p.color);
        ctx.beginPath();
        ctx.arc(sx, sy, 3.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // você
    const meP = state.players.find((p) => p.id === me?.id);
    if (meP) {
      const [sx, sy] = toS(meP.x, meP.y);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.fillStyle = colorOf(meP.color);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }
}
