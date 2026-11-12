/* Simula uma partida inteira só com bots e verifica se ela termina com um vencedor. */
import { io } from 'socket.io-client';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ack = (s, ev, data) =>
  new Promise((res) => {
    const to = setTimeout(() => res({ error: 'timeout' }), 4000);
    const done = (r) => { clearTimeout(to); res(r); };
    if (typeof data === 'function') s.emit(ev, done);
    else s.emit(ev, data, done);
  });

const s = io(process.env.URL || 'http://localhost:3000', { transports: ['websocket'] });
let st = null;
s.on('state', (x) => (st = x));
await wait(400);

await ack(s, 'create', { name: 'Host', color: 'red' });
await ack(s, 'setSettings', { players: 6, impostors: 1, crewTasks: 2 });
await ack(s, 'addBots', {});
const started = await ack(s, 'start');
console.log('partida iniciada:', JSON.stringify(started), '| jogadores:', st.players.length);

const t0 = Date.now();
let lastLog = '';
let ended = null;
let meetings = 0;
let lastState = st.state;

while (Date.now() - t0 < 150000) {
  await wait(500);
  if (!st) continue;
  if (st.state === 'meeting' && lastState !== 'meeting') {
    meetings++;
    // host (humano) vota em alguém aleatório para acelerar
    const target = st.players.filter((p) => p.alive && p.id !== st.you.id)[0];
    if (target && st.you.alive) await ack(s, 'vote', { targetId: target.id });
  }
  const logLine = (st.log || []).slice(-1)[0] || '';
  if (logLine !== lastLog) {
    lastLog = logLine;
    if (Date.now() - t0 > 0) console.log(`  [${Math.round((Date.now() - t0) / 1000)}s]`, logLine);
  }
  lastState = st.state;
  if (st.state === 'ended') {
    ended = st;
    break;
  }
}

if (ended) {
  console.log('\nFIM DE JOGO');
  console.log('  vencedor:', ended.winner);
  console.log('  duração:', Math.round((Date.now() - t0) / 1000) + 's');
  console.log('  reuniões:', meetings);
  console.log('  todos os papéis revelados:', ended.players.every((p) => !!p.role));
  console.log('  impostores:', ended.players.filter((p) => p.role === 'impostor').map((p) => p.name).join(', '));
  console.log('  progresso tarefas:', JSON.stringify(ended.taskProgress));
  s.close();
  process.exit(0);
}

console.log('A partida não terminou em 150s. Estado:', st?.state, 'vencedor:', st?.winner);
s.close();
process.exit(1);
