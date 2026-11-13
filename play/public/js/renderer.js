/* Renderização do mapa Skeld com a geometria real do navio. */
import { GAME_CONSTANTS } from '/shared/rules.js';
import { COLORS } from '/shared/mapdata.js';

const VIEW = { x1: -27.5, y1: -19, x2: 23, y2: 11 };

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.camera = { x: -2, y: -2 };
    this.zoom = 1;
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.w = rect.width;
    this.h = rect.height;
    this.canvas.width = Math.floor(this.w * this.dpr);
    this.canvas.height = Math.floor(this.h * this.dpr);
    this.fitZoom();
  }

  fitZoom() {
    const vw = VIEW.x2 - VIEW.x1;
    const vh = VIEW.y2 - VIEW.y1;
    // zoom "de jogo": a câmera segue o jogador e mostra ~2 salas de largura
    this.fitScale = Math.min(this.w / vw, this.h / vh);
    this.baseZoom = Math.max(34, Math.min(62, this.w / 26));
    this.zoom = this.baseZoom;
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

  follow(player) {
    if (!player) return;
    this.camera.x += (player.x - this.camera.x) * 0.15;
    this.camera.y += (player.y - this.camera.y) * 0.15;
  }

  render(state, me, opts = {}) {
    const { ctx } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    if (!state) return;

    const lightsOut = !!state.lightsOut;
    const vision = me?.role === 'impostor' ? state.settings.impostorVision : state.settings.crewVision;
    const dark = lightsOut ? 0.94 : (me?.role === 'impostor' ? 0.55 : 0.72);

    ctx.fillStyle = '#04060b';
    ctx.fillRect(0, 0, this.w, this.h);
    this.drawSpace();
    this.drawShip(state, opts);

    const scaleZ = this.zoom;
    // corpos
    for (const body of state.bodies || []) this.drawBody(body, scaleZ);
    // jogadores
    for (const p of state.players) {
      if (!p.alive) continue;
      if (p.inVent && p.id !== me?.id) continue;
      this.drawPlayer(p, p.id === me?.id, scaleZ, state);
    }
    // fantasmas
    for (const p of state.players) {
      if (p.alive) continue;
      this.drawGhost(p, scaleZ, state);
    }
    // dutos para impostor
    if (me?.role === 'impostor' && state.ship?.vents?.length) this.drawVents(state.ship.vents, scaleZ, me);
    // portas fechadas
    for (const d of state.ship?.doors || []) {
      if (d.open) continue;
      const s = this.worldToScreen(d.x, d.y);
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.fillStyle = '#8b96ad';
      ctx.fillRect(-0.9 * scaleZ, -0.28 * scaleZ, 1.8 * scaleZ, 0.56 * scaleZ);
      ctx.strokeStyle = '#e2e8f5';
      ctx.lineWidth = 2;
      ctx.strokeRect(-0.9 * scaleZ, -0.28 * scaleZ, 1.8 * scaleZ, 0.56 * scaleZ);
      ctx.restore();
    }

    // escuridão / visão
    this.drawVision(me, state, dark, vision);

    if (state.commsDown) this.drawCommsStatic();
    if (lightsOut) this.drawElectricalFlicker();
  }

  drawSpace() {
    const { ctx } = this;
    ctx.fillStyle = '#050810';
    ctx.fillRect(0, 0, this.w, this.h);
    // estrelas fixas
    ctx.fillStyle = 'rgba(200,220,255,0.35)';
    for (let i = 0; i < 90; i++) {
      const x = ((i * 379) % this.w);
      const y = ((i * 211) % this.h);
      const s = i % 7 === 0 ? 2 : 1;
      ctx.globalAlpha = 0.25 + ((i * 37) % 60) / 100;
      ctx.fillRect(x, y, s, s);
    }
    ctx.globalAlpha = 1;
  }

  /** Desenha as salas/corredores do navio. */
  drawShip(state, opts = {}) {
    const { ctx } = this;
    const spaces = state.ship?.spaces || [];
    const corridors = opts.corridors || [];
    const z = this.zoom;

    // Piso metálico contínuo (salas + corredores têm o mesmo chão)
    for (const space of spaces) this.fillPlanWorld(space.shapes, '#63799c');
    for (const c of corridors) this.fillPlanWorld(c.shapes, '#5a6f90');
    // hachura sutil do piso
    this.drawFloorTiles(spaces, corridors);

    // cada sala tem sua parede (contorno da planta)
    for (const space of spaces) this.strokePlanOutline(space.shapes, z);

    // consoles oficiais do jogo (posições vindas dos dados, não desenhadas à mão)
    for (const c of state.ship?.consoles || []) this.drawConsole(c, z, state);

    // props decorativos das salas
    for (const space of spaces) {
      const label = space.name;
      const [x1, , x2, y2] = space.bounds || [0, 0, 0, 0];
      this.drawRoomLabel(label, (x1 + x2) / 2, y2 - 0.75, space.id);
      for (const p of space.props || []) this.drawProp(p, z, state);
    }

    // tarefas do jogador (marcadores)
    if (state.you?.role === 'crew') {
      for (const t of state.you.tasks || []) {
        if (t.done) continue;
        for (const c of t.consoles) this.drawTaskMarker(c, state);
      }
    }
    // botão de emergência
    if (state.ship?.emergency) {
      const e = state.ship.emergency;
      const s = this.worldToScreen(e.x, e.y);
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.fillStyle = '#c62b3b';
      ctx.beginPath();
      ctx.arc(0, 0, 0.42 * z, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffd7db';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }

  /** Console de tarefa oficial. O visual depende do tipo (como no jogo). */
  drawConsole(c, z, state) {
    const { ctx } = this;
    const s = this.worldToScreen(c.x, c.y);
    const mine = (state.you?.tasks || []).find((t) => (t.consoles || []).some((x) => x.id === c.id && x.room === c.room));
    ctx.save();
    ctx.translate(s.x, s.y);
    const body = '#2f3d54';
    const edge = '#8fb4e6';
    const glow = 'rgba(120, 220, 255, 0.9)';
    const unit = z * 0.34;
    switch (c.task) {
      case 'SwipeCard': // leitor de cartão na parede
        ctx.fillStyle = body; ctx.fillRect(-unit * 1.1, -unit * 0.75, unit * 2.2, unit * 1.5);
        ctx.strokeStyle = edge; ctx.lineWidth = 1.5; ctx.strokeRect(-unit * 1.1, -unit * 0.75, unit * 2.2, unit * 1.5);
        ctx.fillStyle = glow; ctx.fillRect(-unit * 0.8, -unit * 0.45, unit * 1.6, unit * 0.28);
        break;
      case 'FixWiring': // painel elétrico
        ctx.fillStyle = body; ctx.fillRect(-unit, -unit, unit * 2, unit * 2);
        ctx.strokeStyle = edge; ctx.lineWidth = 1.5; ctx.strokeRect(-unit, -unit, unit * 2, unit * 2);
        ctx.strokeStyle = '#e8b64c'; ctx.lineWidth = 1.2; ctx.beginPath();
        ctx.moveTo(-unit * 0.6, -unit * 0.5); ctx.lineTo(unit * 0.2, 0); ctx.lineTo(-unit * 0.2, unit * 0.2); ctx.lineTo(unit * 0.6, unit * 0.6);
        ctx.stroke();
        break;
      case 'DownloadData':
      case 'UploadData': // painel de dados
        ctx.fillStyle = body; ctx.fillRect(-unit, -unit * 0.8, unit * 2, unit * 1.6);
        ctx.strokeStyle = '#7fe3b0'; ctx.lineWidth = 1.5; ctx.strokeRect(-unit, -unit * 0.8, unit * 2, unit * 1.6);
        ctx.fillStyle = glow; ctx.fillRect(-unit * 0.7, -unit * 0.45, unit * 1.4, unit * 0.9);
        break;
      case 'EmptyGarbage':
      case 'FuelEngines': // chute/alavanca
        ctx.fillStyle = '#4a5c78'; ctx.fillRect(-unit * 1.2, -unit * 0.6, unit * 2.4, unit * 1.2);
        ctx.strokeStyle = edge; ctx.strokeRect(-unit * 1.2, -unit * 0.6, unit * 2.4, unit * 1.2);
        ctx.fillStyle = '#e8b64c'; ctx.beginPath(); ctx.arc(0, 0, unit * 0.35, 0, Math.PI * 2); ctx.fill();
        break;
      case 'DivertPower': // caixa de energia
        ctx.fillStyle = '#24344d'; ctx.fillRect(-unit, -unit, unit * 2, unit * 2);
        ctx.strokeStyle = '#f0d25a'; ctx.lineWidth = 1.5; ctx.strokeRect(-unit, -unit, unit * 2, unit * 2);
        ctx.fillStyle = '#f0d25a'; ctx.beginPath();
        ctx.moveTo(-unit * 0.2, -unit * 0.6); ctx.lineTo(unit * 0.35, -unit * 0.05); ctx.lineTo(0, -unit * 0.05);
        ctx.lineTo(unit * 0.2, unit * 0.6); ctx.lineTo(-unit * 0.35, unit * 0.05); ctx.lineTo(0, unit * 0.05);
        ctx.closePath(); ctx.fill();
        break;
      case 'StartReactor': // alavanca do reator
        ctx.fillStyle = '#243b33'; ctx.fillRect(-unit * 1.3, -unit * 0.7, unit * 2.6, unit * 1.4);
        ctx.strokeStyle = '#6ef0b5'; ctx.lineWidth = 1.5; ctx.strokeRect(-unit * 1.3, -unit * 0.7, unit * 2.6, unit * 1.4);
        ctx.strokeStyle = '#6ef0b5'; ctx.beginPath(); ctx.moveTo(-unit * 0.5, unit * 0.3); ctx.lineTo(unit * 0.5, -unit * 0.3); ctx.stroke();
        break;
      case 'ResetSeismic':
      case 'StabilizeSteering': // volante
        ctx.strokeStyle = edge; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, unit * 0.9, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-unit * 0.9, 0); ctx.lineTo(unit * 0.9, 0);
        ctx.moveTo(0, 0); ctx.lineTo(0, unit * 0.9); ctx.stroke();
        break;
      case 'PrimeShields':
      case 'ClearAsteroids': // console de armas
        ctx.fillStyle = body; ctx.fillRect(-unit * 1.1, -unit * 0.9, unit * 2.2, unit * 1.8);
        ctx.strokeStyle = edge; ctx.lineWidth = 1.5; ctx.strokeRect(-unit * 1.1, -unit * 0.9, unit * 2.2, unit * 1.8);
        ctx.fillStyle = '#ff8a5c'; ctx.beginPath(); ctx.arc(0, 0, unit * 0.3, 0, Math.PI * 2); ctx.fill();
        break;
      default: // console genérico
        ctx.fillStyle = body; ctx.fillRect(-unit, -unit * 0.85, unit * 2, unit * 1.7);
        ctx.strokeStyle = edge; ctx.lineWidth = 1.5; ctx.strokeRect(-unit, -unit * 0.85, unit * 2, unit * 1.7);
        ctx.fillStyle = glow; ctx.fillRect(-unit * 0.7, -unit * 0.5, unit * 1.4, unit * 0.5);
        break;
    }
    // destaque suave se for uma tarefa do jogador
    if (mine) {
      ctx.strokeStyle = 'rgba(255, 214, 64, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-unit * 1.4, -unit * 1.3, unit * 2.8, unit * 2.6);
    }
    ctx.restore();
  }

  /** Hachura de placas do piso: recortada pelo contorno das salas. */
  drawFloorTiles(spaces, corridors) {
    const { ctx } = this;
    ctx.save();
    ctx.beginPath();
    for (const g of [...spaces, ...corridors]) {
      for (const shape of g.shapes || []) {
        shape.points.forEach(([x, y], i) => {
          const s = this.worldToScreen(x, y);
          i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y);
        });
        ctx.closePath();
      }
    }
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const STEP = 1.6;
    for (let x = -28; x <= 24; x += STEP) {
      const a = this.worldToScreen(x, -19);
      const b = this.worldToScreen(x, 11);
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    }
    for (let y = -19; y <= 11; y += STEP) {
      const a = this.worldToScreen(-28, y);
      const b = this.worldToScreen(24, y);
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  /** Preenche uma planta (lista de polígonos) com uma cor. */
  fillPlanWorld(shapes, color) {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    for (const shape of shapes || []) {
      shape.points.forEach(([x, y], i) => {
        const s = this.worldToScreen(x, y);
        i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y);
      });
      ctx.closePath();
    }
    ctx.fill();
    ctx.restore();
  }

  /** Parede de uma sala: contorno de cada polígono da planta. */
  strokePlanOutline(shapes, z) {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = 'rgba(205, 224, 250, 0.95)';
    ctx.lineWidth = 3.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (const shape of shapes || []) {
      shape.points.forEach(([x, y], i) => {
        const s = this.worldToScreen(x, y);
        i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y);
      });
      ctx.closePath();
    }
    ctx.stroke();
    ctx.restore();
  }

  /** Contorno de uma sala: arestas que não têm outra parte da mesma sala do lado. */
  strokeUnionOutline(parts, z) {
    const { ctx } = this;
    const EPS = 0.12;
    const covered = (x, y) => parts.some(([x1, y1, x2, y2]) =>
      x >= x1 - EPS && x <= x2 + EPS && y >= y1 - EPS && y <= y2 + EPS);
    ctx.save();
    ctx.strokeStyle = 'rgba(205, 224, 250, 0.95)';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'square';
    ctx.beginPath();
    for (const [x1, y1, x2, y2] of parts) {
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      if (!covered(mx, y2 + 0.25)) { const a = this.worldToScreen(x1, y2), b = this.worldToScreen(x2, y2); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
      if (!covered(mx, y1 - 0.25)) { const a = this.worldToScreen(x1, y1), b = this.worldToScreen(x2, y1); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
      if (!covered(x1 - 0.25, my)) { const a = this.worldToScreen(x1, y1), b = this.worldToScreen(x1, y2); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
      if (!covered(x2 + 0.25, my)) { const a = this.worldToScreen(x2, y1), b = this.worldToScreen(x2, y2); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
    }
    ctx.stroke();
    ctx.restore();
  }

  /** Contorno da união: cada aresta só é desenhada se não houver vizinho do outro lado. */
  strokeFloorOutline(parts, z) {
    const { ctx } = this;
    const EPS = 0.045;
    const covered = (x, y) => parts.some(([x1, y1, x2, y2]) =>
      x >= x1 - EPS && x <= x2 + EPS && y >= y1 - EPS && y <= y2 + EPS);

    ctx.save();
    ctx.strokeStyle = 'rgba(128, 165, 220, 0.85)';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'square';
    ctx.beginPath();
    for (const [x1, y1, x2, y2] of parts) {
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const h = 0.06;
      // topo / base
      if (!covered(midX, y2 + 0.12)) { const a = this.worldToScreen(x1, y2); const b = this.worldToScreen(x2, y2); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
      if (!covered(midX, y1 - 0.12)) { const a = this.worldToScreen(x1, y1); const b = this.worldToScreen(x2, y1); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
      // esquerda / direita
      if (!covered(x1 - 0.12, midY)) { const a = this.worldToScreen(x1, y1); const b = this.worldToScreen(x1, y2); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
      if (!covered(x2 + 0.12, midY)) { const a = this.worldToScreen(x2, y1); const b = this.worldToScreen(x2, y2); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
    }
    ctx.stroke();
    ctx.restore();
  }

  fillRectWorld([x1, y1, x2, y2], color) {
    const { ctx } = this;
    const a = this.worldToScreen(x1, y2);
    const b = this.worldToScreen(x2, y1);
    ctx.fillStyle = color;
    ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
  }

  strokeRectWorld([x1, y1, x2, y2]) {
    const { ctx } = this;
    const a = this.worldToScreen(x1, y2);
    const b = this.worldToScreen(x2, y1);
    ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
  }

  drawRoomLabel(text, x, y, id) {
    const { ctx } = this;
    const s = this.worldToScreen(x, y);
    ctx.save();
    ctx.fillStyle = 'rgba(232, 243, 255, 0.8)';
    ctx.font = `700 ${Math.max(10, this.zoom * 0.48)}px "Trebuchet MS", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(text.toUpperCase(), s.x, s.y);
    ctx.restore();
  }

  drawProp(p, z, state) {
    const { ctx } = this;
    const s = this.worldToScreen(p.x, p.y);
    ctx.save();
    ctx.translate(s.x, s.y);
    switch (p.type) {
      case 'table': {
        const r = (p.r || 0.95) * z;
        ctx.fillStyle = '#54637a';
        ctx.beginPath();
        ctx.ellipse(0, 0, r, r * 1.08, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#8fa3bd';
        ctx.beginPath();
        ctx.ellipse(0, -r * 0.06, r * 0.82, r * 0.9, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'chair': {
        ctx.fillStyle = '#465268';
        ctx.beginPath();
        ctx.arc(0, 0, 0.3 * z, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'engine': {
        const r = (p.r || 1.6) * z;
        ctx.strokeStyle = 'rgba(150, 190, 240, 0.55)';
        ctx.lineWidth = Math.max(2, 2.2 * z * 0.12);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-r, -r); ctx.lineTo(r, r);
        ctx.moveTo(-r, r); ctx.lineTo(r, -r);
        ctx.stroke();
        break;
      }
      case 'reactor': {
        const r = (p.r || 1.5) * z;
        ctx.strokeStyle = 'rgba(120, 255, 190, 0.5)';
        ctx.lineWidth = Math.max(2, 2.4 * z * 0.12);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'shieldGen': {
        const r = (p.r || 1.4) * z;
        ctx.strokeStyle = 'rgba(140, 200, 255, 0.55)';
        ctx.lineWidth = Math.max(2, 2 * z * 0.12);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'bed': {
        const w = (p.w || 1.5) * z, h = (p.h || 0.9) * z;
        ctx.fillStyle = '#dfe8f5';
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.fillStyle = '#9fb8d6';
        ctx.fillRect(-w / 2, -h / 2, w, h * 0.35);
        break;
      }
      case 'plant': {
        ctx.fillStyle = '#2f6b47';
        ctx.beginPath();
        ctx.arc(0, 0, 0.42 * z, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'bench': {
        const w = (p.w || 2) * z, h = (p.h || 0.7) * z;
        ctx.fillStyle = '#33507a';
        ctx.fillRect(-w / 2, -h / 2, w, h);
        break;
      }
      case 'trash': {
        ctx.fillStyle = '#4a5c78';
        ctx.fillRect(-0.35 * z, -0.45 * z, 0.7 * z, 0.9 * z);
        break;
      }
      case 'fuel': {
        const w = (p.w || 1.1) * z;
        ctx.fillStyle = '#b8873a';
        ctx.fillRect(-w / 2, -w / 2, w, w);
        break;
      }
      case 'panel': {
        const w = (p.w || 1.2) * z, h = (p.h || 0.5) * z;
        ctx.fillStyle = '#24344d';
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.strokeStyle = '#4f7099';
        ctx.lineWidth = 1;
        ctx.strokeRect(-w / 2, -h / 2, w, h);
        break;
      }
      case 'console': {
        const w = (p.w || 1.2) * z;
        const h = (p.h || 0.7) * z;
        ctx.fillStyle = '#39506f';
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.fillStyle = 'rgba(120, 220, 255, 0.85)';
        ctx.fillRect(-w / 2 + 2, -h / 2 + 2, w - 4, h / 2.4);
        ctx.strokeStyle = '#7ea6d8';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-w / 2, -h / 2, w, h);
        break;
      }
      case 'crate': {
        const w = (p.w || 1.2) * z;
        const h = (p.h || 1.1) * z;
        ctx.fillStyle = '#6b4a2b';
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.strokeStyle = '#a97b4a';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-w / 2, -h / 2, w, h);
        ctx.beginPath();
        ctx.moveTo(-w / 2, -h / 2);
        ctx.lineTo(w / 2, h / 2);
        ctx.moveTo(w / 2, -h / 2);
        ctx.lineTo(-w / 2, h / 2);
        ctx.stroke();
        break;
      }
      default:
        break;
    }
    ctx.restore();
  }

  drawTaskMarker(console_, state) {
    const { ctx } = this;
    const s = this.worldToScreen(console_.x, console_.y);
    const t = (performance.now() / 1000) % 2;
    const pulse = 1 + Math.sin(t * Math.PI * 2) * 0.15;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = 'rgba(255, 214, 64, 0.92)';
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(6, this.zoom * 0.3), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a2200';
    ctx.font = `bold ${Math.max(9, this.zoom * 0.34)}px "Trebuchet MS"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', 0, 1);
    ctx.restore();
  }

  drawVents(vents, z, me) {
    const { ctx } = this;
    for (const v of vents) {
      const s = this.worldToScreen(v.x, v.y);
      const active = me?.ventId === v.id;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.fillStyle = active ? 'rgba(120, 255, 200, 0.7)' : 'rgba(90, 200, 255, 0.35)';
      ctx.beginPath();
      ctx.roundRect(-0.42 * z, -0.32 * z, 0.84 * z, 0.64 * z, 0.12 * z);
      ctx.fill();
      ctx.strokeStyle = active ? 'rgba(180, 255, 230, 0.95)' : 'rgba(150, 225, 255, 0.75)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.beginPath();
      for (let i = -1; i <= 1; i++) {
        ctx.moveTo(-0.24 * z, i * 0.15 * z);
        ctx.lineTo(0.24 * z, i * 0.15 * z);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  drawPlayer(p, isMe, z, state) {
    const { ctx } = this;
    const col = COLORS[p.color] || COLORS[0];
    const s = this.worldToScreen(p.x, p.y);
    const bob = p.moving ? Math.sin(performance.now() / 110) * 0.05 * z : 0;
    ctx.save();
    ctx.translate(s.x, s.y + bob);
    const bodyH = 0.86 * z;
    const bodyW = 0.66 * z;

    if (isMe) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0.1 * z, 0.62 * z, 0.44 * z, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // sombra
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 0.4 * z, 0.36 * z, 0.14 * z, 0, 0, Math.PI * 2);
    ctx.fill();
    this.drawBean(0, 0, col.hex, col.visor, bodyW, bodyH, p.facing, isMe, state?.you?.role === 'impostor' && p.role === 'impostor');
    // nome
    ctx.font = `700 ${Math.max(9, z * 0.36)}px "Trebuchet MS"`;
    ctx.textAlign = 'center';
    const label = p.name;
    const w = ctx.measureText(label).width + 8;
    ctx.fillStyle = 'rgba(4,8,14,0.72)';
    ctx.beginPath();
    ctx.roundRect(-w / 2, -0.95 * z, w, 0.38 * z, 0.1 * z);
    ctx.fill();
    ctx.fillStyle = isMe ? '#8fe9ff' : 'rgba(232,240,255,0.92)';
    ctx.fillText(label, 0, -0.68 * z);
    ctx.restore();
  }

  drawBean(x, y, color, visor, w, h, facing, isMe, impMate) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(x, y);
    if (facing < 0) ctx.scale(-1, 1);
    // corpo
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h * 0.62, w, h, w * 0.42);
    ctx.fill();
    // pernas
    ctx.beginPath();
    ctx.ellipse(-w * 0.2, h * 0.34, w * 0.2, h * 0.17, 0, 0, Math.PI * 2);
    ctx.ellipse(w * 0.2, h * 0.34, w * 0.2, h * 0.17, 0, 0, Math.PI * 2);
    ctx.fill();
    // mochila
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath();
    ctx.roundRect(-w * 0.62, -h * 0.42, w * 0.22, h * 0.6, w * 0.1);
    ctx.fill();
    // visor
    ctx.fillStyle = '#a8e0ef';
    ctx.beginPath();
    ctx.roundRect(-w * 0.05, -h * 0.44, w * 0.55, h * 0.34, h * 0.17);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.roundRect(w * 0.16, -h * 0.38, w * 0.24, h * 0.12, h * 0.06);
    ctx.fill();
    if (impMate) {
      ctx.fillStyle = '#ff4a5e';
      ctx.font = `bold ${Math.max(9, w * 0.8)}px "Trebuchet MS"`;
      ctx.textAlign = 'center';
      ctx.fillText('▲', 0, -h * 0.78);
    }
    ctx.restore();
  }

  drawGhost(p, z, state) {
    const { ctx } = this;
    const col = COLORS[p.color] || COLORS[0];
    const s = this.worldToScreen(p.x, p.y);
    ctx.save();
    ctx.translate(s.x, s.y + Math.sin(performance.now() / 500) * 0.06 * z);
    ctx.globalAlpha = 0.42;
    this.drawBean(0, 0, col.hex, col.visor, 0.6 * z, 0.8 * z, p.facing, false);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = 'rgba(232,240,255,0.85)';
    ctx.font = `700 ${Math.max(8, z * 0.3)}px "Trebuchet MS"`;
    ctx.textAlign = 'center';
    ctx.fillText(p.name, s.x, s.y - 0.9 * z);
    ctx.restore();
  }

  drawBody(body, z) {
    const { ctx } = this;
    const col = COLORS[body.color] || COLORS[0];
    const s = this.worldToScreen(body.x, body.y);
    ctx.save();
    ctx.translate(s.x, s.y);
    // poça/aura vermelha
    const t = (performance.now() / 900) % 1;
    ctx.fillStyle = `rgba(180, 20, 40, ${0.18 + Math.sin(t * Math.PI) * 0.08})`;
    ctx.beginPath();
    ctx.arc(0, 0, 0.75 * z, 0, Math.PI * 2);
    ctx.fill();
    // corpo caído (girado)
    ctx.rotate(Math.PI / 2.1);
    this.drawBean(0, 0, col.hex, col.visor, 0.58 * z, 0.78 * z, 1, false);
    ctx.rotate(-Math.PI / 2.1);
    // osso
    ctx.fillStyle = '#eef3ff';
    ctx.beginPath();
    ctx.ellipse(0, 0.44 * z, 0.26 * z, 0.1 * z, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawVision(me, state, dark, vision) {
    const { ctx } = this;
    // círculo de visão ao redor do jogador
    const center = me ? this.worldToScreen(state.__meX ?? me.x ?? 0, state.__meY ?? me.y ?? 0) : { x: this.w / 2, y: this.h / 2 };
    // No jogo a visão é um círculo ao redor do tripulante: claro no centro,
    // escuro nas bordas. Um único gradiente radial cobre a tela inteira.
    const worldR = (state.lightsOut ? 2.4 : 5.2) * Math.max(0.5, vision / 1);
    const radius = Math.max(worldR * this.zoom, 60);
    // penumbra do jogo: perto é claro, longe fica escuro mas o navio continua visível
    const grad = ctx.createRadialGradient(center.x, center.y, radius * 0.6, center.x, center.y, radius * 1.5);
    grad.addColorStop(0, 'rgba(2,5,12,0)');
    grad.addColorStop(0.45, `rgba(2,5,12,${dark * 0.22})`);
    grad.addColorStop(1, `rgba(2,5,12,${dark * 0.72})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  drawCommsStatic() {
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = 0.10;
    ctx.fillStyle = '#7fffd4';
    for (let i = 0; i < 220; i++) {
      ctx.fillRect(Math.random() * this.w, Math.random() * this.h, 2, 2);
    }
    ctx.restore();
  }

  drawElectricalFlicker() {
    const { ctx } = this;
    const flicker = Math.sin(performance.now() / 90) > 0.85;
    if (!flicker) return;
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.restore();
  }
}
