/* Teste de fumaça: dois clientes reais (socket.io) jogando uma partida. */
import { io } from 'socket.io-client';

const URL = process.env.URL || 'http://localhost:3000';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ack = (s, ev, data) => new Promise((res) => {
  const to = setTimeout(() => res({ error: 'timeout' }), 4000);
  const done = (r) => { clearTimeout(to); res(r); };
  if (typeof data === 'function') s.emit(ev, (r) => done(r));
  else s.emit(ev, data, (r) => done(r));
});

let failures = 0;
function check(name, cond, extra = '') {
  console.log(`${cond ? '  OK ' : ' FAIL'} ${name}${extra ? ' :: ' + extra : ''}`);
  if (!cond) failures++;
}

const mkClient = () => {
  const s = io(URL, { transports: ['websocket'], forceNew: true });
  s.state = null;
  s.on('state', (st) => (s.state = st));
  return s;
};

const A = mkClient();
const B = mkClient();
await wait(600);

console.log('\n[1] Criar / entrar na sala');
const created = await ack(A, 'create', { name: 'Ana', color: 'red' });
check('criar sala', created?.ok && created.code?.length === 5, created?.code);
const joined = await ack(B, 'join', { code: created.code, name: 'Bia', color: 'blue' });
check('entrar na sala', joined?.ok);
await wait(300);
check('2 humanos no lobby', A.state.players.filter((p) => !p.isBot).length === 2);

console.log('\n[2] Bots e configurações');
await ack(A, 'setSettings', { players: 7, impostors: 1, crewTasks: 3 });
await wait(200);
await ack(A, 'addBots', {});
await wait(500);
check('bots preenchem a sala', A.state.players.length === 7, `total=${A.state.players.length}`);
check('configurações aplicadas', A.state.settings.players === 7 && A.state.settings.impostors === 1);
check('B não é host', B.state.hostId === A.state.you.id);

console.log('\n[3] Iniciar partida');
const noHost = await ack(B, 'start');
check('não-host não inicia', !!noHost?.error, noHost?.error);
const started = await ack(A, 'start');
check('host inicia', started?.ok);
await wait(600);
check('estado = playing', A.state.state === 'playing', A.state.state);
const rolesA = A.state.players.map((p) => p.role).filter(Boolean);
check('cada um só vê o próprio papel', rolesA.length === 1, `viu=${rolesA.length}`);
const visibleImps = A.state.players.filter((p) => p.role === 'impostor').length;
check('papéis de impostor escondidos para tripulante', A.state.you.role === 'impostor' ? visibleImps === 1 : visibleImps === 0, `visíveis=${visibleImps}`);
const crew = A.state.players.filter((p) => p.role === 'crew');
check('tripulantes receberam tarefas', A.state.you.role === 'impostor' || A.state.you.tasks.length === 3, `tarefas=${A.state.you.tasks?.length}`);
check('mapa enviado', A.state.map.rooms.length > 5);

console.log('\n[4] Movimento e tarefa');
const myTask = A.state.you.tasks?.[0];
if (myTask) {
  await ack(A, 'move', { x: myTask.x, y: myTask.y });
  await wait(250);
  const meNow = A.state.players.find((p) => p.id === A.state.you.id);
  check('servidor aceita movimento', Math.abs(meNow.x - myTask.x) < 2 && Math.abs(meNow.y - myTask.y) < 2);
  await ack(A, 'doTask', { taskId: myTask.id });
  await wait(350);
  check('tarefa concluída', A.state.you.tasks.find((t) => t.id === myTask.id).done);
} else {
  check('impostor não tem tarefas', A.state.you.role === 'impostor');
}

console.log('\n[5] Impostor mata e tripulante reporta');
// descobre qual cliente é impostor
let impSocket = null;
let crewSocket = null;
if (A.state.you.role === 'impostor') { impSocket = A; crewSocket = B; } else if (B.state.you.role === 'impostor') { impSocket = B; crewSocket = A; }
const humanIsImpostor = !!impSocket;
if (!humanIsImpostor) {
  console.log('  SKIP impostor é um bot nesta rodada — teste de kill humano pulado');
}
await wait(9000); // espera acabar o cooldown inicial de kill (12s) parcialmente
// joga um humano para cima do outro
let bodies = [];
if (humanIsImpostor) {
  const impId = impSocket.state.you.id;
  const crewId = crewSocket.state.you.id;
  const impPlayer = impSocket.state.players.find((p) => p.id === impId);
  await ack(impSocket, 'move', { x: impPlayer.x, y: impPlayer.y });
  await wait(150);
  const targetPos = impSocket.state.players.find((p) => p.id === impId);
  await ack(crewSocket, 'move', { x: targetPos.x + 10, y: targetPos.y });
  await wait(300);
  await wait(4000);
  const killRes = await ack(impSocket, 'kill', { targetId: crewId });
  check('impostor consegue matar', killRes?.ok || /cooldown|longe|andamento/i.test(killRes?.error || ''), JSON.stringify(killRes));
  await wait(400);
  bodies = impSocket.state.bodies;
  check('corpo aparece no mapa', bodies.length >= 1, `corpos=${bodies.length}`);
}
if (bodies.length) {
  // tripulante morto não reporta: usa o outro humano (o impostor) - reportar corpo deve funcionar
  const body = bodies[0];
  await ack(crewSocket, 'move', { x: body.x, y: body.y });
  await wait(250);
  await ack(crewSocket, 'report', { bodyId: body.id });
  await wait(500);
  check('report abre reunião', impSocket.state.state === 'meeting', impSocket.state.state);
}

console.log('\n[6] Votação');
if (impSocket && impSocket.state.state === 'meeting') {
  const vote = await ack(A, 'vote', { targetId: A.state.players.find((p) => p.id !== A.state.you.id)?.id || 'skip' });
  check('voto registrado', vote?.ok, JSON.stringify(vote));
  await wait(300);
  const doubleVote = await ack(A, 'vote', { targetId: 'skip' });
  check('não vota duas vezes', !!doubleVote?.error, doubleVote?.error);
  check('votos anônimos contados', Object.values(A.state.voteCounts || {}).reduce((a, b) => a + b, 0) >= 1, JSON.stringify(A.state.voteCounts));
  check('meu voto registrado no cliente', !!A.state.myVote, A.state.myVote);
}

console.log('\n[7] Sabotagem (se impostor vivo)');
// fecha a reunião atual para voltar ao jogo
if (impSocket && impSocket.state.state === 'meeting') {
  await ack(A, 'vote', { targetId: 'skip' });
  await ack(B, 'vote', { targetId: 'skip' });
  await wait(9000);
}
if (impSocket && impSocket.state.state === 'playing' && impSocket.state.you.alive) {
  await ack(impSocket, 'sabotage', { type: 'lights' });
  await wait(400);
  check('sabotagem ativa', !!impSocket.state.sabotage, JSON.stringify(impSocket.state.sabotage));
  check('luzes apagadas', impSocket.state.lightsOut === true);
}

console.log('\n[8] Chat da reunião');
await ack(A, 'chat', { text: 'oi gente' });
await wait(300);
check('chat chega no log', (A.state.log || []).some((l) => l.includes('oi gente')), JSON.stringify(A.state.log?.slice(-2)));

console.log('\n[9] Bot completo: partida só com bots');
const C = mkClient();
await wait(400);
const qp = await ack(C, 'quickplay', { name: 'Duda', color: 'green' });
check('quickplay acha sala', qp?.ok, JSON.stringify(qp));
await wait(400);
await ack(C, 'setSettings', { players: 4, impostors: 1, crewTasks: 1 });
await ack(C, 'addBots', {});
await wait(500);
const st = await ack(C, 'start');
check('quickplay inicia', st?.ok, JSON.stringify(st));
await wait(3000);
check('bots se movem', C.state.state === 'playing' && C.state.players.some((p) => p.isBot && p.moving));

A.close(); B.close(); C.close();
console.log(`\n${failures === 0 ? 'TUDO PASSOU' : failures + ' FALHA(S)'}`);
process.exit(failures ? 1 : 0);
