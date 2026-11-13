/* Regras de fidelidade: fantasmas em tarefas, portas, O2, abate e ejeção. */
import { Game } from '../server/game.js';

let fails = 0;
const check = (name, ok, extra = '') => {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ' :: ' + extra : ''}`);
  if (!ok) fails++;
};

const game = new Game('TEST');
for (let i = 0; i < 6; i++) game.addPlayer('p' + i, 'J' + i, i);
const start = game.startGame();
check('partida inicia', start.ok === true, JSON.stringify(start));
game.state = 'tasks';
game.stopTicking();

const players = [...game.players.values()];
const imp = players[0];
const crew = players.slice(1);
for (const p of players) {
  p.role = p === imp ? 'impostor' : 'crew';
  p.alive = true;
  p.inVent = false;
}
// garante tarefas para o tripulante que vai virar fantasma
const ghost = crew[0];
if (!ghost.tasks.length) ghost.tasks = [game.tasks[0].key];

/* ---- abate ---- */
imp.x = 0; imp.y = 0;
ghost.x = 0.9; ghost.y = 0;
imp.killReadyAt = 0;
const killed = game.kill(imp.id, ghost.id);
check('impostor mata no alcance', killed.ok === true, JSON.stringify(killed));
check('corpo aparece no mapa', game.bodies.length === 1);
check('evento de abate para a animação', !!game.lastKill && game.lastKill.victimId === ghost.id);

/* ---- fantasma faz tarefa ---- */
const taskKey = ghost.tasks[0];
const task = game.tasks.find((t) => t.key === taskKey);
const console0 = task.consoles[0];
ghost.x = console0.x;
ghost.y = console0.y;
const startedTask = game.startTask(ghost.id, taskKey, console0.id);
check('fantasma abre tarefa', startedTask.ok === true, JSON.stringify(startedTask));
const steps = game.taskSteps(task);
let advanced;
for (let i = 0; i < steps; i++) {
  advanced = game.advanceTask(ghost.id, taskKey, { consoleId: console0.id });
}
check('fantasma conclui tarefa', advanced?.finished === true, JSON.stringify(advanced));

/* ---- portas ---- */
const imp2 = imp;
imp2.alive = true;
imp2.role = 'impostor';
const doorRoom = [...new Set(game.ship.doors.map((d) => d.room))][0];
const closed = game.closeDoors(imp2.id, doorRoom);
check('portas fecham', closed.ok === true && closed.doors > 0, JSON.stringify(closed));
check('portas fechadas no estado', game.ship.serializedDoors().some((d) => d.room === doorRoom && !d.open));
const again = game.closeDoors(imp2.id, doorRoom);
check('cooldown de portas por sala', !!again.error, again.error || '');

/* ---- sabotagem de oxigênio ---- */
game.sabotage = null;
game.sabotageReadyAt = 0;
const sab = game.startSabotage(imp2.id, 'o2');
check('sabotagem de O2 existe', sab.ok === true, JSON.stringify(sab));
check('O2 exige dois consertos', game.sabotage?.requiredFixes === 2);

/* dois tripulantes consertam no Suporte Vital */
const life = game.ship.roomById.LifeSupp;
const [x1, y1, x2, y2] = life.bounds;
let spot = null;
outer:
for (let x = x1; x <= x2; x += 0.3) {
  for (let y = y1; y <= y2; y += 0.3) {
    if (game.ship.isWalkable(x, y) && game.ship.roomAt(x, y) === 'LifeSupp') { spot = { x, y }; break outer; }
  }
}
const fixers = crew.slice(1, 3);
for (const f of fixers) { f.alive = true; f.role = 'crew'; f.x = spot.x; f.y = spot.y; }
const f1 = game.fixSabotage(fixers[0].id);
const f2 = game.fixSabotage(fixers[1].id);
check('primeiro conserto conta', f1.ok === true && f1.fixed === false, JSON.stringify(f1));
check('segundo conserto resolve a sabotagem', f2.ok === true && f2.fixed === true, JSON.stringify(f2));

/* ---- reunião e ejeção ---- */
game.bodies = [];
game.startMeeting(crew[1].id, 'emergency');
check('reunião abre com fase de discussão', game.meeting?.phase === 'discussion');
for (const p of game.players.values()) {
  if (!p.alive) continue;
  p.voted = true;
  p.votedFor = p.id === crew[1].id ? imp2.id : imp2.id;
}
game.finishMeeting();
check('jogador mais votado é ejetado', game.meeting?.ejectedId === imp2.id, game.meeting?.ejectedId || 'nenhum');
check('ejeção informa nome e papel', game.meeting?.ejectedName === imp2.name, game.meeting?.ejectedName || '');
check('ejeção entra no feed', game.log.some((l) => l.type === 'eject'));

game.stopTicking();
console.log(`\nfails = ${fails}`);
setTimeout(() => process.exit(fails ? 1 : 0), 100);
