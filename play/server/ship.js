/* Geometria jogável: colisão, salas, portas e dutos. */
import { ROOMS, CORRIDORS, EMERGENCY } from '../shared/skeld.js';
import { ROOM_PLANS, CORRIDOR_PLANS, ROOM_PROPS } from '../shared/rooms.js';
import { MAPS } from '../shared/mapdata.js';
import { GAME_CONSTANTS } from '../shared/rules.js';

// Plantas: ROOM_PLANS/CORRIDOR_PLANS são a fonte de verdade do chão.
const ROOM_FLOOR = ROOM_PLANS.map((p) => ({
  room: p.id,
  name: p.name,
  plan: { ...p, bounds: planBounds(p) },
  props: ROOM_PROPS[p.id] || [],
}));
const CORRIDOR_FLOOR = CORRIDOR_PLANS.map((p) => ({
  room: null,
  plan: { ...p, bounds: planBounds(p) },
}));
const ALL_PARTS = [...ROOM_FLOOR, ...CORRIDOR_FLOOR];

const inRect = (x, y, r) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];

/** Ponto dentro de polígono (ray casting). */
function inPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Caixa delimitadora de uma planta (para atalho de colisão). */
function planBounds(plan) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const shape of plan.shapes) {
    for (const [x, y] of shape.points) {
      if (x < x1) x1 = x;
      if (y < y1) y1 = y;
      if (x > x2) x2 = x;
      if (y > y2) y2 = y;
    }
  }
  return [x1, y1, x2, y2];
}

/** O ponto está dentro do chão da sala/corredor? */
function inPlan(plan, x, y) {
  const b = plan.bounds;
  if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) return false;
  return plan.shapes.some((s) => (s.type === 'poly' ? inPoly(x, y, s.points) : inRect(x, y, s)));
}

// Frestas: retângulos que deveriam se tocar mas ficaram com um vão mínimo.
// A tolerância é pequena de propósito: um valor alto abriria "chão falso" fora
// das salas e os bots ficariam presos no vazio (já aconteceu com 0.35).
const STITCH = 0.08;
function inRectStitched(x, y, r) {
  return x >= r[0] - STITCH && x <= r[2] + STITCH && y >= r[1] - STITCH && y <= r[3] + STITCH;
}

export class Ship {
  constructor(mapId = 'skeld') {
    this.mapId = mapId;
    this.data = MAPS[mapId] || MAPS.skeld;
    this.rooms = ROOMS;
    this.roomById = Object.fromEntries(ROOM_FLOOR.map((r) => [r.room, {
      id: r.room, name: r.name, shapes: r.plan.shapes, bounds: r.plan.bounds, props: r.props,
    }]));
    this.doors = this.data.doors.map((d) => ({ ...d, closedUntil: 0 }));
    this.emergency = EMERGENCY;
    this.corridors = CORRIDORS;
    this.floorRooms = ROOM_FLOOR;
    this.floorCorridors = CORRIDOR_FLOOR;
  }

  /** Salas no formato usado pelo cliente (planta + props). */
  serializedRooms() {
    return ROOM_FLOOR.map((r) => ({
      id: r.room, name: r.name, shapes: r.plan.shapes, props: r.props,
      bounds: r.plan.bounds,
    }));
  }

  /** Corredores no formato usado pelo cliente. */
  serializedCorridors() {
    return CORRIDOR_FLOOR.map((c) => ({ id: c.plan.id, shapes: c.plan.shapes }));
  }

  roomAt(x, y) {
    for (const r of ROOM_FLOOR) if (inPlan(r.plan, x, y)) return r.room;
    // costura mínima entre plantas (evita "null" exatamente na junção)
    for (const r of ROOM_FLOOR) {
      const b = r.plan.bounds;
      if (x >= b[0] - STITCH && x <= b[2] + STITCH && y >= b[1] - STITCH && y <= b[3] + STITCH) return r.room;
    }
    return null;
  }

  isWalkableStrict(x, y) {
    return ALL_PARTS.some((g) => inPlan(g.plan, x, y));
  }

  isWalkable(x, y) {
    // portas fechadas bloqueiam
    for (const d of this.doors) {
      if (d.closedUntil > Date.now() && Math.hypot(d.x - x, d.y - y) < 0.85) return false;
    }
    if (ALL_PARTS.some((g) => inPlan(g.plan, x, y))) return true;
    // costura entre plantas vizinhas
    for (const g of ALL_PARTS) {
      const b = g.plan.bounds;
      if (x >= b[0] - STITCH && x <= b[2] + STITCH && y >= b[1] - STITCH && y <= b[3] + STITCH) return true;
    }
    return false;
  }

  /** Move com colisão: tenta o eixo X e depois o Y (permite deslizar nas paredes). */
  move(fromX, fromY, dx, dy) {
    let x = fromX;
    let y = fromY;
    // passo de "deslizar" pela parede: nunca 0 (Math.sign(0) === 0 travaria o eixo)
    const slideX = Math.abs(dx) > 1e-9 ? Math.sign(dx) * 0.02 : 0;
    const slideY = Math.abs(dy) > 1e-9 ? Math.sign(dy) * 0.02 : 0;
    if (this.isWalkable(x + dx, y)) x += dx;
    else if (slideX && this.isWalkable(x + slideX, y)) x += slideX;
    if (this.isWalkable(x, y + dy)) y += dy;
    else if (slideY && this.isWalkable(x, y + slideY)) y += slideY;
    return { x, y };
  }

  nearestVent(x, y, maxDist = 1.6) {
    let best = null;
    for (const v of this.data.vents) {
      const d = Math.hypot(v.x - x, v.y - y);
      if (d <= maxDist && (!best || d < best.d)) best = { vent: v, d };
    }
    return best?.vent || null;
  }

  ventById(id) {
    return this.data.vents.find((v) => v.id === id) || null;
  }

  /** Próximo duto da mesma rede (conexão esquerda/direita do jogo). */
  ventNeighbor(ventId, dir = 1) {
    const v = this.ventById(ventId);
    if (!v) return null;
    // dir 1 = próximo, -1 = anterior, seguindo a cadeia ligada
    const chain = [];
    const seen = new Set();
    let cur = v;
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      chain.push(cur);
      cur = this.ventById(cur.links[0]);
    }
    const idx = chain.findIndex((c) => c.id === v.id);
    if (chain.length < 2) return null;
    return chain[(idx + dir + chain.length) % chain.length];
  }

  nearEmergency(x, y) {
    return Math.hypot(x - this.emergency.x, y - this.emergency.y) <= this.emergency.radius;
  }

  nearDoor(x, y) {
    for (const d of this.doors) {
      if (Math.hypot(d.x - x, d.y - y) < 0.9) return d;
    }
    return null;
  }

  closeDoors(roomId, durationMs) {
    const until = Date.now() + durationMs;
    const affected = this.doors.filter((d) => d.room === roomId);
    for (const d of affected) {
      d.closedUntil = until;
      d.closedAt = Date.now();
    }
    return affected.length;
  }

  /** Orientação da porta: 'h' quando o corredor atravessa na horizontal. */
  doorOrientation(d) {
    const open = (x, y) => this.isWalkable(x, y);
    const horizontal = open(d.x - 0.85, d.y) && open(d.x + 0.85, d.y);
    return horizontal ? 'v' : 'h';
  }

  serializedDoors() {
    const now = Date.now();
    return this.doors.map((d) => ({
      id: d.id,
      room: d.room,
      x: d.x,
      y: d.y,
      open: d.closedUntil <= now,
      closesIn: Math.max(0, d.closedUntil - now),
      orientation: this.doorOrientation(d),
    }));
  }

  randomSpawn(spawnCenter) {
    const c = spawnCenter || this.data.spawn.initial;
    const r = Math.max(0.6, this.data.spawn.radius || 1.4);
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.sqrt(Math.random()) * r;
      const x = c.x + Math.cos(a) * d;
      const y = c.y + Math.sin(a) * d;
      if (this.isWalkable(x, y)) return { x, y };
    }
    return { x: c.x, y: c.y };
  }

  /** Caminho em grade (waypoints) até o destino, usado pelos bots. */
  findPath(from, to, step = 0.45) {
    const key = (i, j) => `${i},${j}`;
    const si = Math.round(from.x / step);
    const sj = Math.round(from.y / step);
    const gi = Math.round(to.x / step);
    const gj = Math.round(to.y / step);
    if (si === gi && sj === gj) return [{ x: to.x, y: to.y }];
    const prev = new Map();
    const seen = new Set([key(si, sj)]);
    const queue = [[si, sj]];
    let head = 0;
    let found = false;
    while (head < queue.length && !found) {
      const [i, j] = queue[head++];
      for (const [di, dj] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
        const ni = i + di;
        const nj = j + dj;
        const k = key(ni, nj);
        if (seen.has(k)) continue;
        if (!this.isWalkable(ni * step, nj * step)) continue;
        seen.add(k);
        prev.set(k, key(i, j));
        if (ni === gi && nj === gj) { found = true; break; }
        queue.push([ni, nj]);
        if (seen.size > 20000) return [{ x: to.x, y: to.y }];
      }
    }
    if (!found) return [{ x: to.x, y: to.y }];
    const path = [];
    let cur = key(gi, gj);
    while (cur !== key(si, sj)) {
      const [i, j] = cur.split(',').map(Number);
      path.push({ x: i * step, y: j * step });
      cur = prev.get(cur);
      if (!cur) break;
    }
    path.reverse();
    path.push({ x: to.x, y: to.y });
    return path;
  }

  /** Distância andável aproximada (BFS em grade) usada pelos bots. */
  pathDistance(from, to, step = 0.4) {
    const startKey = `${Math.round(from.x / step)},${Math.round(from.y / step)}`;
    const goalKey = `${Math.round(to.x / step)},${Math.round(to.y / step)}`;
    if (startKey === goalKey) return 0;
    const visited = new Map([[startKey, 0]]);
    const queue = [[Math.round(from.x / step), Math.round(from.y / step)]];
    let head = 0;
    const goal = [Math.round(to.x / step), Math.round(to.y / step)];
    while (head < queue.length) {
      const [i, j] = queue[head++];
      const dist = visited.get(`${i},${j}`);
      if (dist > 90) return Infinity;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di;
        const nj = j + dj;
        const k = `${ni},${nj}`;
        if (visited.has(k)) continue;
        if (!this.isWalkable(ni * step, nj * step)) continue;
        const nd = dist + 1;
        visited.set(k, nd);
        if (ni === goal[0] && nj === goal[1]) return nd * step;
        queue.push([ni, nj]);
      }
    }
    return Infinity;
  }
}

export function makeShip(mapId) {
  return new Ship(mapId);
}

export const SHIP_CONSTANTS = GAME_CONSTANTS;
