/**
 * Valida a geometria do Skeld: todo console, duto, porta e o botão de emergência
 * precisam estar em área caminhável, e todas as salas precisam ser alcançáveis
 * a partir do spawn (flood fill em grade fina).
 *
 * Uso: node tools/validate-map.mjs
 */
import { EMERGENCY, VIEW } from '../shared/skeld.js';
import { ROOM_PLANS, CORRIDOR_PLANS, ROOM_PROPS } from '../shared/rooms.js';
import { MAPS } from '../shared/mapdata.js';

const STEP = 0.15;

function inPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const inShape = (x, y, s) => inPoly(x, y, s.points);
const inPlan = (plan, x, y) => plan.shapes.some((s) => inShape(x, y, s));

const ALL_PLANS = [...ROOM_PLANS, ...CORRIDOR_PLANS];
const walkable = (x, y) => ALL_PLANS.some((p) => inPlan(p, x, y));

// "ROOMS" para os laços abaixo: id + nome + âncoras
const ROOMS = ROOM_PLANS.map((p) => ({ id: p.id, name: p.name, plan: p }));

// flood fill a partir do spawn oficial
const spawn = MAPS.skeld.spawn.initial;
const key = (i, j) => `${i},${j}`;
const toCell = (v, min) => Math.round((v - min) / STEP);
const toWorld = (i, min) => min + i * STEP;
const X0 = VIEW.x1, Y0 = VIEW.y1;
const W = Math.ceil((VIEW.x2 - X0) / STEP), H = Math.ceil((VIEW.y2 - Y0) / STEP);

const visited = new Set();
const queue = [[toCell(spawn.x, X0), toCell(spawn.y, Y0)]];
visited.add(key(...queue[0]));
while (queue.length) {
  const [i, j] = queue.pop();
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const ni = i + di, nj = j + dj;
    if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
    const k = key(ni, nj);
    if (visited.has(k)) continue;
    if (!walkable(toWorld(ni, X0), toWorld(nj, Y0))) continue;
    visited.add(k);
    queue.push([ni, nj]);
  }
}

const reachable = (x, y) => {
  // aceita se algum ponto num raio de 0.5 está na área alcançada
  for (let dx = -0.5; dx <= 0.5; dx += STEP) {
    for (let dy = -0.5; dy <= 0.5; dy += STEP) {
      if (visited.has(key(toCell(x + dx, X0), toCell(y + dy, Y0)))) return true;
    }
  }
  return false;
};

let fails = 0;
const fail = (msg) => { console.log('  FALHA ' + msg); fails++; };

console.log('=== alcance das salas ===');
console.log(`  ${ROOMS.length} salas + ${CORRIDOR_PLANS.length} corredores`);
if (ROOMS.length !== 14) fail(`esperava 14 salas, achei ${ROOMS.length}`);
if (CORRIDOR_PLANS.length < 20) fail(`esperava >= 20 corredores, achei ${CORRIDOR_PLANS.length}`);

console.log('=== consoles de tarefa oficiais ===');
const data = MAPS.skeld;
let consoles = 0;
for (const task of data.tasks) {
  for (const c of task.consoles) {
    consoles++;
    if (!reachable(c.x, c.y)) fail(`${task.taskType} em ${c.room} (${c.x.toFixed(1)}, ${c.y.toFixed(1)}) fora da área`);
  }
}
console.log(`  ${consoles} consoles verificados`);

console.log('=== dutos ===');
for (const v of data.vents) {
  if (!reachable(v.x, v.y)) fail(`duto ${v.name} (${v.x.toFixed(1)}, ${v.y.toFixed(1)}) fora da área`);
}
console.log(`  ${data.vents.length} dutos verificados`);

console.log('=== portas ===');
for (const d of data.doors) {
  if (!reachable(d.x, d.y)) fail(`porta de ${d.room} (${d.x.toFixed(1)}, ${d.y.toFixed(1)}) fora da área`);
}
console.log(`  ${data.doors.length} portas verificadas`);

console.log('=== botão de emergência ===');
if (!reachable(EMERGENCY.x, EMERGENCY.y)) fail('botão de emergência inalcançável');
if (Math.hypot(EMERGENCY.x - spawn.x, EMERGENCY.y - spawn.y) > EMERGENCY.radius + 0.4) {
  fail('spawn do lobby não fica junto do botão');
}
console.log(`  botão em (${EMERGENCY.x}, ${EMERGENCY.y})`);

console.log('=== props ===');
for (const [roomId, props] of Object.entries(ROOM_PROPS)) {
  for (const p of props) {
    if (!walkable(p.x, p.y)) fail(`prop ${p.type} em ${roomId} (${p.x}, ${p.y}) fora do chão`);
  }
  // nenhum prop pode cobrir um console oficial da sala
  for (const t of data.tasks) {
    for (const c of t.consoles) {
      if (c.room !== roomId) continue;
      for (const p of props) {
        if (Math.hypot(c.x - p.x, c.y - p.y) < 0.5) fail(`prop ${p.type} cobre o console ${t.taskType} em ${roomId}`);
      }
    }
  }
}
console.log('  props verificados');

const area = visited.size * STEP * STEP;
console.log(`\nárea caminhável conectada: ${area.toFixed(1)} unidades²`);
console.log(fails ? `\n${fails} PROBLEMA(S)` : '\nMAPA OK');
process.exit(fails ? 1 : 0);
