/* Vitória por tarefas em partida real: 1 impostor com kill travado contra 6 bots
   que só fazem tarefas. Verifica que o motor encerra quando o progresso chega a 100%. */
import { Game } from '../server/game.js';

const g = new Game('TASK');
g.setSettings({ maxPlayers: 7, numImpostors: 1, numCommonTasks: 1, numLongTasks: 1, numShortTasks: 1 });
g.addPlayer('me', 'Eu', 0);
g.fillBots();          // completa a sala com bots (como no modo solo)
g.settings.numImpostors = 1;
g.startGame();

const crew = [...g.players.values()].filter((p) => p.role === 'crew');
const imp = [...g.players.values()].find((p) => p.role === 'impostor');
// o jogador humano também vira tripulante e não se move: deixa ele morto para não travar a barra
const me = g.players.get('me');
if (me && me.role === 'crew') { me.alive = false; }
console.log('jogadores:', [...g.players.values()].map((p) => `${p.name}:${p.role}${p.isBot ? '🤖' : ''}`).join(' '));
if (!imp) { console.log('FALHA: sem impostor'); process.exit(1); }
// desliga o kill do impostor para forçar a corrida de tarefas
imp.killReadyAt = Date.now() + 3600_000;
console.log(`partida: ${crew.length} tripulantes contra 1 impostor`);

// fantasma do jogador humano: continua as tarefas que sobraram (como no jogo)
const ghostDoTask = () => {
  const human = g.players.get('me');
  if (!human || human.alive || human.role !== 'crew') return;
  for (const key of human.tasks) {
    const t = g.tasks.find((x) => x.key === key);
    if (!t || t.completedBy.has(human.id)) continue;
    const prog = t.progress[human.id] || { step: 0 };
    const c = t.consoles[Math.min(prog.step, t.consoles.length - 1)] || t.consoles[0];
    human.x = c.x;
    human.y = c.y;
    const steps = g.taskSteps(t);
    for (let i = 0; i < steps; i++) g.advanceTask(human.id, key, { consoleId: c.id });
    return;
  }
};

const t0 = Date.now();
while (Date.now() - t0 < 180000) {
  await new Promise((r) => setTimeout(r, 1000));
  ghostDoTask();
  if (g.state === 'ended') break;
  // impede reuniões (o teste é sobre tarefas)
  if (g.state === 'meeting') g.finishMeeting();
}
const tb = g.currentTaskProgress();
console.log('mortos:', [...g.players.values()].filter((x) => !x.alive).map((x) => `${x.name}:${x.role}`).join(',') || '-');
console.log('tarefas concluídas por jogador:', [...g.players.values()].filter((x) => x.role === 'crew').map((x) => `${x.name}${x.alive ? '' : '☠'}=${x.tasks.filter((k) => g.tasks.find((t) => t.key === k)?.completedBy.has(x.id)).length}/${x.tasks.length}`).join(' '));
for (const p of [...g.players.values()].filter((x) => x.role === 'crew' && x.alive)) {
  const pend = p.tasks.filter((key) => { const t = g.tasks.find((x) => x.key === key); return t && !t.completedBy.has(p.id); });
  if (pend.length) {
    const t = g.tasks.find((x) => x.key === pend[0]);
    const prog = t.progress[p.id] || { step: 0 };
    const c = t.consoles[Math.min(prog.step, t.consoles.length - 1)];
    console.log(`  ${p.name}${p.isBot ? '🤖' : ''} falta ${t.name} em ${c.room} dist=${Math.hypot(c.x-p.x,c.y-p.y).toFixed(1)} alvo=${p.botState?.goal?.type || '-'}`);
  }
}
console.log('progresso:', JSON.stringify(tb), '| estado:', g.state, '| vencedor:', g.winner);
console.log('motivo:', g.gameOverReason);
const ok = g.state === 'ended' && g.winner === 'crew';
console.log(ok ? 'OK: tripulantes venceram completando tarefas' : 'FALHA: a partida não terminou por tarefas');
process.exit(ok ? 0 : 1);
