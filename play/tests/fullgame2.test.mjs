/* Partida completa com bots: verifica se termina com vencedor e se as regras batem. */
import { io } from 'socket.io-client';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const s = io('http://localhost:3000', { transports: ['websocket'], forceNew: true });
let st = null;
s.on('state', (x) => (st = x));
await wait(400);
const ack = (ev, p) => new Promise((res) => { const t = setTimeout(() => res({ error: 'timeout' }), 5000); s.emit(ev, p ?? {}, (r) => { clearTimeout(t); res(r); }); });

await ack('solo', { name: 'Host', color: 3 });
await wait(3500);
const t0 = Date.now();
let meetings = 0;
let lastState = st.state;
let lastLog = '';
let votes = 0;
console.log(`início: ${st.players.length} jogadores, impostores=${st.settings.numImpostors}, tarefas=${st.you.tasks.length}`);

while (Date.now() - t0 < 240000) {
  await wait(400);
  if (!st) continue;
  if (st.state === 'meeting' && lastState !== 'meeting') {
    meetings++;
    // vota em quem não é você
    const target = st.players.find((p) => p.alive && p.id !== st.you.id);
    if (target) { const v = await ack('vote', { targetId: target.id }); if (v.ok) votes++; }
  }
  const logLine = (st.log || []).slice(-1)[0]?.text || '';
  if (logLine && logLine !== lastLog && !logLine.startsWith(':')) {
    lastLog = logLine;
    console.log(`  [${Math.round((Date.now() - t0) / 1000)}s] ${logLine}`);
  }
  lastState = st.state;
  if (st.state === 'ended') break;
}
if (st.state === 'ended') {
  console.log('\n=== FIM ===');
  console.log('vencedor:', st.winner, '|', st.gameOverReason);
  console.log('duração:', Math.round((Date.now() - t0) / 1000) + 's', '| reuniões:', meetings, '| votos:', votes);
  const tb = st.taskBar || (st.you.role === 'crew' ? st.you.tasks.filter((t) => t.done).length : null);
  console.log('progresso tarefas:', JSON.stringify(tb));
  console.log('vivos:', st.players.filter((p) => p.alive).length, '/', st.players.length);
  console.log('papéis revelados:', st.players.every((p) => !!p.role));
  console.log('impostores:', st.players.filter((p) => p.role === 'impostor').map((p) => p.name).join(', '));
  console.log('mortos:', st.players.filter((p) => !p.alive).length, '/', st.players.length);
  s.close();
  process.exit(0);
}
console.log('NÃO TERMINOU. estado:', st?.state, 'winner:', st?.winner);
if (st) {
  console.log('vivos:', st.players.filter((p) => p.alive).length, '| mortos:', st.players.filter((p) => !p.alive).map((p) => p.name).join(',') || '-');
  console.log('impostores:', st.players.filter((p) => p.role === 'impostor').map((p) => `${p.name}${p.alive ? '' : '(x)'}`).join(', ') || '-');
  console.log('tarefas do host:', st.you.role, '|', (st.you.tasks || []).map((t) => `${t.name}:${t.done ? 'ok' : 'pend'}`).join(' | '));
  console.log('sabotagem:', JSON.stringify(st.sabotage));
  console.log('posições:', st.players.map((p) => `${p.name}${p.alive ? '' : '(x)'}@${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));
}
s.close();
process.exit(1);
