/* Tripulantes devem vencer completando tarefas (com 0 impostores... o jogo exige >=1).
   Aqui usamos 1 impostor passivo não é possível; então validamos a regra direto no motor. */
import { Game } from '../server/game.js';

const g = new Game('TEST');
g.setSettings({ maxPlayers: 4, numImpostors: 1, numCommonTasks: 1, numLongTasks: 1, numShortTasks: 1 });
g.addPlayer('p1', 'A', 0);
g.addPlayer('p2', 'B', 1);
g.addPlayer('p3', 'C', 2);
g.fillBots();
g.settings.numImpostors = 1;
const res = g.startGame();
console.log('start:', JSON.stringify(res), 'jogadores:', g.players.size);
const crew = [...g.players.values()].filter((p) => p.role === 'crew');
const imp = [...g.players.values()].find((p) => p.role === 'impostor');
console.log('tripulantes:', crew.length, 'impostor:', imp?.name);
console.log('tarefas por tripulante:', crew.map((p) => p.tasks.length));

// completa todas as tarefas de todos os tripulantes
let done = 0;
for (const p of crew) {
  for (const key of p.tasks) {
    const task = g.tasks.find((t) => t.key === key);
    task.completedBy.add(p.id);
    done++;
  }
}
console.log('tarefas marcadas:', done, 'progresso:', JSON.stringify(g.currentTaskProgress()));
g.checkWin();
console.log('estado:', g.state, 'vencedor:', g.winner, '|', g.gameOverReason);
const ok = g.state === 'ended' && g.winner === 'crew';
console.log(ok ? 'OK: tripulantes vencem por tarefas' : 'FALHA');
process.exit(ok ? 0 : 1);
