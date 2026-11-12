/* Testes de borda: validações, abandono, sabotagem e vitória por tarefas. */
import { io } from 'socket.io-client';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ack = (s, ev, data) => new Promise((res) => {
  const to = setTimeout(() => res({ error: 'timeout' }), 4000);
  const done = (r) => { clearTimeout(to); res(r); };
  if (typeof data === 'function') s.emit(ev, done); else s.emit(ev, data, done);
});
const mk = () => { const s = io(process.env.URL || 'http://localhost:3000', { transports: ['websocket'], forceNew: true }); s.on('state', (x) => (s.state = x)); return s; };
let fails = 0;
const check = (n, c, e = '') => { console.log(`  ${c ? 'OK  ' : 'FAIL'} ${n}${e ? ' :: ' + e : ''}`); if (!c) fails++; };

const A = mk();
await wait(400);
const c = await ack(A, 'create', { name: 'A', color: 'red' });
await wait(200);

console.log('[validações]');
check('entrar em sala inexistente', !!(await ack(mk(), 'join', { code: 'ZZZZZ', name: 'X', color: 'blue' }))?.error);
await ack(A, 'setSettings', { players: 4 });
await ack(A, 'addBots', {});
await wait(400);
const beforeStart = A.state.players.length;
check('addBots respeita o limite', beforeStart === 4, `jogadores=${beforeStart}`);
check('kick/latência: nome sanitizado', A.state.players.every((p) => p.name.length <= 14));
await ack(A, 'setSettings', { players: 3 });
await ack(A, 'addBots', {});
await wait(300);
check('não reduz a sala ao diminuir o limite', A.state.players.length >= 4, `jogadores=${A.state.players.length}`);

console.log('[abandono]');
const B = mk();
await wait(300);
const join = await ack(B, 'join', { code: c.code, name: 'B', color: 'blue' });
check('segundo jogador entra', join?.ok);
await wait(300);
const nBefore = A.state.players.length;
B.close();
await wait(700);
check('jogador removido ao sair', A.state.players.length === nBefore - 1, `${nBefore} -> ${A.state.players.length}`);

console.log('[cooldowns e permissões]');
await ack(A, 'setSettings', { players: 6, impostors: 1, crewTasks: 1 });
await ack(A, 'addBots', {});
await wait(300);
await ack(A, 'start');
await wait(500);
const you = A.state.you;
if (you.role === 'crew') {
  const res = await ack(A, 'kill', { targetId: A.state.players[1].id });
  check('tripulante não mata', !!res?.error, res?.error);
  const sabot = await ack(A, 'sabotage', { type: 'lights' });
  check('tripulante não sabota', !!sabot?.error, sabot?.error);
} else {
  const res = await ack(A, 'kill', { targetId: A.state.players[1].id });
  check('impostor longe não mata', !!res?.error, res?.error);
  const sabot = await ack(A, 'sabotage', { type: 'lights' });
  check('impostor sabota (ou cooldown)', sabot?.ok || /cooldown/i.test(sabot?.error || ''), JSON.stringify(sabot));
}
const voteEarly = await ack(A, 'vote', { targetId: 'skip' });
check('não vota fora de reunião', !!voteEarly?.error, voteEarly?.error);
const taskHack = await ack(A, 'doTask', { taskId: 'nao-existe' });
check('tarefa inexistente é ignorada', !taskHack?.ok);
A.close();
console.log(fails ? `\n${fails} FALHA(S)` : '\nTODOS OS TESTES DE BORDA OK');
process.exit(fails ? 1 : 0);
