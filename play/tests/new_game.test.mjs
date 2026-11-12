/* Testa o motor novo: solo com bots, tarefas reais, kill, report, votação, sabotagem. */
import { io } from 'socket.io-client';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ack = (s, ev, payload) => new Promise((res) => {
  const to = setTimeout(() => res({ error: 'timeout:' + ev }), 6000);
  const done = (r) => { clearTimeout(to); res(r); };
  if (payload === undefined) s.emit(ev, done); else s.emit(ev, payload, done);
});
let fails = 0;
const check = (n, c, e = '') => { console.log(`  ${c ? 'OK  ' : 'FAIL'} ${n}${e ? ' :: ' + e : ''}`); if (!c) fails++; };

const s = io('http://localhost:3000', { transports: ['websocket'], forceNew: true });
let st = null;
s.on('state', (x) => (st = x));
await wait(500);

console.log('[1] solo com bots');
const solo = await ack(s, 'solo', { name: 'Tester', color: 0 });
check('entrou e iniciou', solo?.ok, JSON.stringify(solo));
await wait(4000);
check('estado tasks', st?.state === 'tasks', st?.state);
check('tem 10 jogadores', st?.players.length === 10, `n=${st?.players.length}`);
check('recebi papel', !!st?.you?.role, st?.you?.role);
check('mapa Skeld com salas', st?.ship?.spaces?.length === 13, `salas=${st?.ship?.spaces?.length}`);
const isCrew = st.you.role === 'crew';
if (isCrew) {
  check('tarefas do jogador têm consoles', (st?.you?.tasks?.length || 0) > 0, `tarefas=${st?.you?.tasks?.length}`);
  const tt = st.you.tasks?.[0];
  check('tarefa com console real', !!tt?.consoles?.[0]?.x, JSON.stringify(tt?.consoles?.[0]));
  // padrão oficial (taskBarMode=1) mostra a barra apenas em reuniões
  const tbVisible = st?.settings?.taskBarMode === 0 ? !!st?.taskBar : st?.taskBar === null;
  check('barra de tarefas coerente com a config', tbVisible, `mode=${st?.settings?.taskBarMode} bar=${JSON.stringify(st?.taskBar)}`);
} else {
  check('impostor sem tarefas', st.you.tasks.length === 0);
  check('impostor vê aliados ou sozinho', Array.isArray(st.you.impostorTeammates), `aliados=${st.you.impostorTeammates.length}`);
}
const t0 = isCrew ? st.you.tasks?.[0] : null;

console.log('[2] mover até a tarefa e concluir');
if (t0) {
  const c0 = t0.consoles[0];
  // teleporta em passos (o servidor limita o passo)
  for (let i = 0; i < 60; i++) {
    s.emit('move', { x: c0.x, y: c0.y });
    await wait(20);
    const meP = st.players.find((p) => p.id === st.you.id);
    if (Math.hypot(meP.x - c0.x, meP.y - c0.y) < 1) break;
  }
  const meP = st.players.find((p) => p.id === st.you.id);
  check('chegou ao console', Math.hypot(meP.x - c0.x, meP.y - c0.y) < 2, `d=${Math.hypot(meP.x - c0.x, meP.y - c0.y).toFixed(2)}`);
  if (st.you.role === 'crew') {
    const start = await ack(s, 'startTask', { taskKey: t0.key, consoleId: c0.id });
    check('startTask responde', !!start?.ok || !!start?.error, JSON.stringify(start));
    if (start?.ok) {
      const total = start.task.totalSteps;
      let adv;
      for (let i = 0; i < total; i++) {
        adv = await ack(s, 'advanceTask', { taskKey: t0.key, consoleId: c0.id, data: 'test' });
      }
      check('tarefa concluída', adv?.finished === true, JSON.stringify(adv));
    }
  }
}

console.log('[3] validações do servidor');
const badTask = await ack(s, 'startTask', { taskKey: 'nao-existe', consoleId: 0 });
check('tarefa inexistente rejeitada', !!badTask?.error, badTask?.error);
if (st.you.role === 'crew') {
  const k = await ack(s, 'kill', { targetId: st.players[1].id });
  check('tripulante não mata', !!k?.error, k?.error);
  const sab = await ack(s, 'sabotage', { type: 'lights' });
  check('tripulante não sabota', !!sab?.error, sab?.error);
} else {
  const sab = await ack(s, 'sabotage', { type: 'lights' });
  check('impostor sabota', sab?.ok === true, JSON.stringify(sab));
  await wait(300);
  if (sab?.ok) {
    check('sabotagem aparece', !!st.sabotage, JSON.stringify(st.sabotage));
    check('luzes apagadas', st.lightsOut === true);
  }
}

console.log('[4] bots se movem');
const before = st.players.filter((p) => p.isBot).map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`);
await wait(2500);
const after = st.players.filter((p) => p.isBot).map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`);
check('bots mudaram de posição', before.join('|') !== after.join('|'));

console.log('[5] reunião por emergência');
// move até o botão
const emg = st.ship.emergency;
for (let i = 0; i < 80; i++) {
  s.emit('move', { x: emg.x, y: emg.y });
  await wait(20);
  const meP2 = st.players.find((p) => p.id === st.you.id);
  if (Math.hypot(meP2.x - emg.x, meP2.y - emg.y) < 1.5) break;
}
const emgRes = await ack(s, 'emergency');
check('emergência chamada', emgRes?.ok || !!emgRes?.error, JSON.stringify(emgRes));
await wait(600);
check('reunião aberta', st.state === 'meeting', st.state);
if (st.state === 'meeting') {
  check('fase de discussão', st.meeting.phase === 'discussion', st.meeting.phase);
  await ack(s, 'chat', { text: 'oi pessoal' });
  await wait(300);
  check('chat chegou', (st.log || []).some((l) => l.type === 'chat' && l.text === 'oi pessoal'));
  // espera a votação começar
  await wait(15000);
  check('votação aberta', st.meeting?.phase === 'voting', st.meeting?.phase);
  const voteRes = await ack(s, 'vote', { targetId: 'skip' });
  check('voto aceito', voteRes?.ok, JSON.stringify(voteRes));
}

console.log('\nfails =', fails);
s.close();
process.exit(fails ? 1 : 0);
