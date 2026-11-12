/**
 * Valida a geometria do Skeld: todo console, duto, porta e o botão de emergência
 * precisam estar em área caminhável, e todas as salas precisam ser alcançáveis
 * a partir do spawn (flood fill em grade fina).
 *
 * Uso: node tools/validate-map.mjs
 */
import { ROOMS, CORRIDORS, EMERGENCY, VIEW } from '../shared/skeld.js';
import { MAPS } from '../shared/mapdata.js';

const STEP = 0.15;
const allParts = [...ROOMS.flatMap((r) => r.parts), ...CORRIDORS.flatMap((c) => c.parts)];

const inRect = (x, y, [x1, y1, x2, y2]) => x >= x1 && x <= x2 && y >= y1 && y <= y2;
const walkable = (x, y) => allParts.some((p) => inRect(x, y, p));

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
for (const room of ROOMS) {
  const [x1, y1, x2, y2] = room.parts[0];
  if (!reachable((x1 + x2) / 2, (y1 + y2) / 2)) fail(`sala ${room.name} inalcançável`);
}
console.log(`  ${ROOMS.length} salas verificadas`);

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

console.log('=== props (não podem bloquear consoles) ===');
for (const room of ROOMS) {
  for (const p of room.props || []) {
    if (p.type !== 'console') continue;
    // o console desenhado tem que coincidir com algum console oficial da sala
    const match = data.tasks.some((t) => t.consoles.some((c) =>
      c.room === room.id && Math.hypot(c.x - p.x, c.y - p.y) < 0.45));
    if (!match) fail(`console decorativo em ${room.name} (${p.x}, ${p.y}) não corresponde a nenhuma tarefa oficial`);
  }
}
console.log('  props verificados');

const area = visited.size * STEP * STEP;
console.log(`\nárea caminhável conectada: ${area.toFixed(1)} unidades²`);
console.log(fails ? `\n${fails} PROBLEMA(S)` : '\nMAPA OK');
process.exit(fails ? 1 : 0);
