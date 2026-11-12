/* Geometria jogável: colisão, salas, portas e dutos. */
import { ROOMS, CORRIDORS, EMERGENCY } from '../shared/skeld.js';
import { MAPS } from '../shared/mapdata.js';
import { GAME_CONSTANTS } from '../shared/rules.js';

const ALL_PARTS = [
  ...ROOMS.map((r) => ({ room: r.id, parts: r.parts })),
  ...CORRIDORS.map((c) => ({ room: null, parts: c.parts })),
];

const inRect = (x, y, r) => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];

// Frestas: a geometria é feita de retângulos encostados. Um ponto no vão de 0.25
// entre dois retângulos deve contar como chão (senão os bots travam na costura).
const STITCH = 0.35;
function inRectStitched(x, y, r) {
  return x >= r[0] - STITCH && x <= r[2] + STITCH && y >= r[1] - STITCH && y <= r[3] + STITCH;
}

export class Ship {
  constructor(mapId = 'skeld') {
    this.mapId = mapId;
    this.data = MAPS[mapId] || MAPS.skeld;
    this.rooms = ROOMS;
    this.roomById = Object.fromEntries(ROOMS.map((r) => [r.id, r]));
    this.doors = this.data.doors.map((d) => ({ ...d, closedUntil: 0 }));
    this.emergency = EMERGENCY;
  }

  roomAt(x, y) {
    for (const r of ROOMS) {
      for (const p of r.parts) if (inRect(x, y, p)) return r.id;
    }
    // costura: se estiver no vão entre retângulos, pertence à sala mais próxima
    for (const r of ROOMS) {
      for (const p of r.parts) if (inRectStitched(x, y, p)) return r.id;
    }
    return null;
  }

  isWalkableStrict(x, y) {
    return ALL_PARTS.some((g) => g.parts.some((p) => inRect(x, y, p)));
  }

  isWalkable(x, y) {
    // portas fechadas bloqueiam
    for (const d of this.doors) {
      if (d.closedUntil > Date.now() && Math.hypot(d.x - x, d.y - y) < 0.85) return false;
    }
    return ALL_PARTS.some((g) => g.parts.some((p) => inRectStitched(x, y, p)));
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
    for (const d of affected) d.closedUntil = until;
    return affected.length;
  }

  serializedDoors() {
    const now = Date.now();
    return this.doors.map((d) => ({ id: d.id, room: d.room, x: d.x, y: d.y, open: d.closedUntil <= now }));
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
