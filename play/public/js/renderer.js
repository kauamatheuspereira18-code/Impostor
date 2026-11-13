/* Renderização do Skeld com a geometria oficial, arte procedural e animações. */
import { GAME_CONSTANTS } from '/shared/rules.js';
import { COLORS } from '/shared/mapdata.js';
import {
  drawSpace, drawCrew, drawCorpse, drawVent, drawDoor,
  drawEmergencyButton, drawMeetingTable, shade,
} from './art.js';

const lerp = (a, b, t) => a + (b - a) * t;

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
    // escala de jogo: o personagem tem ~1 unidade de altura, como no original
    this.zoom = Math.max(38, Math.min(96, Math.min(this.w / 15, this.h / 10)));
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
      if (p.poisoned && p.id !== me?.id) this.drawPoison(p);
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
    const dark = lightsOut ? 0.9 : (me?.role === 'impostor' ? 0.42 : 0.6);
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
    ctx.globalAlpha = 0.5;
    this.fillPlanWorld([...spaces, ...corridors], '#02040a', 0.5);
    ctx.restore();

    // corredores primeiro (piso + paredes) para que as salas fiquem por cima
    for (const c of corridors) this.fillPlanWorld(c.shapes, '#556680');
    for (const c of corridors) this.strokePlanOutline(c.shapes, z, true);
    for (const space of spaces) this.fillPlanWorld(space.shapes, '#5e6f8f');
    this.drawFloorTiles(spaces, corridors);
    for (const space of spaces) this.strokePlanOutline(space.shapes, z);

    // consoles oficiais (posições vindas dos dados do jogo)
    for (const c of state.ship?.consoles || []) this.drawConsole(c, z, state);

    // mesa central da Cafeteria
    const cafe = spaces.find((s) => s.id === 'Cafeteria');
    if (cafe) {
      const [x1, , x2, y2] = cafe.bounds || [0, 0, 0, 0];
      drawMeetingTable(ctx, { x: this.worldToScreen((x1 + x2) / 2, y2 - 3.4).x, y: this.worldToScreen((x1 + x2) / 2, y2 - 3.4).y, size: z * 0.5 });
    }

    // props + nomes das salas
    for (const space of spaces) {
      const [x1, , x2, y2] = space.bounds || [0, 0, 0, 0];
      for (const p of space.props || []) this.drawProp(p, z, state);
      this.drawRoomLabel(space.name, (x1 + x2) / 2, y2 - 0.75);
    }

    // botão de emergência
    if (state.ship?.emergency) {
      const e = state.ship.emergency;
      const s = this.worldToScreen(e.x, e.y);
      drawEmergencyButton(ctx, { x: s.x, y: s.y, size: z * 0.8, t: this.time, disabled: state.emergencyLeft <= 0 });
    }

    // tarefas do jogador no chão
    if (state.you?.role === 'crew' && state.you.alive !== false) {
      for (const t of state.you.tasks || []) {
        if (t.done) continue;
        for (const c of t.consoles) this.drawTaskMarker(c);
      }
    }
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
    ctx.save();
    // parede externa grossa + linha clara interna
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(24, 36, 54, 0.95)';
    ctx.lineWidth = thin ? 6 : 8;
    ctx.beginPath();
    for (const shape of shapes || []) {
      (shape.points || []).forEach(([x, y], i) => {
        const s = this.worldToScreen(x, y);
        i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y);
      });
      ctx.closePath();
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(206, 226, 250, 0.95)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }

  drawFloorTiles(spaces, corridors) {
    const { ctx } = this;
    ctx.save();
    ctx.beginPath();
    for (const g of [...spaces, ...corridors]) {
      for (const shape of g.shapes || []) {
        (shape.points || []).forEach(([x, y], i) => {
          const s = this.worldToScreen(x, y);
          i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y);
        });
        ctx.closePath();
      }
    }
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.055)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const STEP = 1.8;
    for (let x = -28; x <= 24; x += STEP) {
      const a = this.worldToScreen(x, -20);
      const b = this.worldToScreen(x, 12);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    for (let y = -20; y <= 12; y += STEP) {
      const a = this.worldToScreen(-28, y);
      const b = this.worldToScreen(24, y);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
    // vinheta interna do piso
    ctx.restore();
  }

  drawRoomLabel(text, x, y) {
    const { ctx } = this;
    const s = this.worldToScreen(x, y);
    const label = String(text).toUpperCase();
    ctx.save();
    ctx.font = `700 ${Math.max(9, this.zoom * 0.32)}px "Baloo 2", "Trebuchet MS", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(label).width + this.zoom * 0.28;
    const h = Math.max(12, this.zoom * 0.36);
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = 'rgba(18, 28, 44, 0.6)';
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(s.x - w / 2, s.y - h / 2, w, h, h / 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(232, 242, 255, 0.78)';
    ctx.fillText(label, s.x, s.y + 0.5);
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
    const panel = (w, h, fill = body) => {
      ctx.fillStyle = fill;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1.4;
      ctx.strokeRect(-w / 2, -h / 2, w, h);
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
    ctx.font = `700 ${Math.max(9, this.zoom * 0.30)}px "Baloo 2", "Trebuchet MS", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = p.name;
    const by = s.y - h * 0.87;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 4;
    ctx.fillStyle = isMe ? '#a8eeff' : '#f4f9ff';
    ctx.fillText(label, s.x, by + 0.5);
    ctx.shadowBlur = 0;
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
    });

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

  /** Veneno da Víbora: fumaça verde subindo do alvo. */
  drawPoison(p) {
    const { ctx } = this;
    const sm = this.smoothFor(p);
    const s = this.worldToScreen(sm.x, sm.y);
    const h = this.zoom * 0.9;
    ctx.save();
    for (let i = 0; i < 5; i++) {
      const t = (this.time * 0.7 + i / 5) % 1;
      const a = 0.22 * (1 - t);
      ctx.globalAlpha = a;
      ctx.fillStyle = '#6ef07a';
      ctx.beginPath();
      ctx.arc(s.x + Math.sin((t + i) * 7) * h * 0.22, s.y - t * h * 0.85, h * 0.07 * (1 - t * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 0.5 + 0.2 * Math.sin(this.time * 5);
    ctx.strokeStyle = '#8dff7a';
    ctx.lineWidth = Math.max(1, this.zoom * 0.03);
    ctx.beginPath();
    ctx.arc(s.x, s.y + h * 0.1, h * 0.42, 0, Math.PI * 2);
    ctx.stroke();
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
  drawProp(p, z) {
    const { ctx } = this;
    const s = this.worldToScreen(p.x, p.y);
    ctx.save();
    ctx.translate(s.x, s.y);
    switch (p.type) {
      case 'table': {
        const r = (p.r || 0.95) * z;
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(0, r * 0.25, r * 1.02, r * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4a5a70';
        ctx.beginPath();
        ctx.ellipse(0, 0, r, r * 0.78, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#8ba1bd';
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.82, r * 0.62, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'chair':
        ctx.globalAlpha = 0.65;
        ctx.fillStyle = '#39455a';
        ctx.beginPath();
        ctx.arc(0, 0, 0.3 * z, 0, Math.PI * 2);
        ctx.fill();
        break;
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
        ctx.fillStyle = '#dfe8f5';
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.fillStyle = '#9fb8d6';
        ctx.fillRect(-w / 2, -h / 2, w, h * 0.35);
        break;
      }
      case 'plant':
        ctx.fillStyle = '#2f6b47';
        ctx.beginPath();
        ctx.arc(0, 0, 0.42 * z, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'bench': {
        const w = (p.w || 2) * z;
        const h = (p.h || 0.7) * z;
        ctx.fillStyle = '#33507a';
        ctx.fillRect(-w / 2, -h / 2, w, h);
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
      case 'panel': {
        const w = (p.w || 1.2) * z;
        const h = (p.h || 0.5) * z;
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
        ctx.fillStyle = 'rgba(120, 220, 255, 0.8)';
        ctx.fillRect(-w / 2 + 2, -h / 2 + 2, w - 4, h / 2.4);
        break;
      }
      case 'crate': {
        const w = (p.w || 1.2) * z;
        const h = (p.h || 1.1) * z;
        ctx.fillStyle = '#6b4a2b';
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.strokeStyle = '#a97b4a';
        ctx.lineWidth = 1.4;
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

  /* ---------------- escuridão / visão ---------------- */
  drawVision(state, me, dark, vision, lightsOut) {
    const { ctx } = this;
    const oc = this.overlayCtx;
    if (!oc) return;
    const W = this.overlay.width;
    const H = this.overlay.height;
    oc.setTransform(1, 0, 0, 1, 0, 0);
    oc.clearRect(0, 0, W, H);
    const c = me
      ? this.worldToScreen(state.__meX ?? me.x ?? 0, state.__meY ?? me.y ?? 0)
      : { x: this.w / 2, y: this.h / 2 };
    const px = c.x * this.dpr;
    const py = c.y * this.dpr;
    const radiusWorld = (lightsOut ? 2.7 : 5.4) * Math.max(0.45, vision);
    const R = Math.max(70, radiusWorld * this.zoom * this.dpr);

    oc.fillStyle = `rgba(3, 6, 12, ${dark})`;
    oc.fillRect(0, 0, W, H);
    oc.globalCompositeOperation = 'destination-out';
    const g = oc.createRadialGradient(px, py, R * 0.35, px, py, R);
    g.addColorStop(0, 'rgba(0,0,0,0.98)');
    g.addColorStop(0.6, 'rgba(0,0,0,0.72)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    oc.fillStyle = g;
    oc.beginPath();
    oc.arc(px, py, R, 0, Math.PI * 2);
    oc.fill();
    oc.globalCompositeOperation = 'source-over';

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.overlay, 0, 0);
    ctx.restore();

    if (lightsOut) {
      // brilho residual nas lâmpadas
      ctx.save();
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = '#7fd4ff';
      for (const sp of state.ship?.spaces || []) {
        const [x1, , x2, y2] = sp.bounds || [0, 0, 0, 0];
        const s = this.worldToScreen((x1 + x2) / 2, y2 - 2);
        ctx.beginPath();
        ctx.arc(s.x, s.y, this.zoom * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
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
