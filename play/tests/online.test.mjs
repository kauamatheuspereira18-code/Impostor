/* Multiplayer: criar sala, entrar por código, lista pública, reconexão e kick. */
import { io } from 'socket.io-client';

const URL = process.env.URL || 'http://127.0.0.1:3000';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const check = (name, ok, extra = '') => {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ' :: ' + extra : ''}`);
  if (!ok) fails++;
};
const connect = () => new Promise((resolve) => {
  const s = io(URL, { transports: ['websocket'] });
  s.on('hello', () => resolve(s));
});
const call = (s, ev, payload) => new Promise((resolve) => s.emit(ev, payload, resolve));

const a = await connect();
const b = await connect();

const created = await call(a, 'create', { name: 'Ana', color: 0 });
check('criar sala devolve código', !!created.code, created.code);
check('criar sala devolve sessão', !!created.session);

const joined = await call(b, 'join', { code: created.code, name: 'Beto', color: 1 });
check('entrar pelo código', joined.ok === true);
check('cor diferente quando já está em uso', joined.color !== created.color, `${created.color} vs ${joined.color}`);

const list = await new Promise((r) => a.emit('listGames', {}, r));
const row = (list.games || []).find((g) => g.code === created.code);
check('sala aparece na lista pública', !!row && row.humans === 2, row ? `${row.humans} humanos` : 'ausente');

// inicia partida (2 humanos + bots)
const started = await call(a, 'start', {});
check('host inicia a partida', started.ok === true, JSON.stringify(started));

await sleep(900);
const stateB = await new Promise((r) => b.once('state', r));
check('cliente recebe estado da partida', ['starting', 'tasks'].includes(stateB.state), stateB.state);
check('estado traz 14 salas e corredores', stateB.ship.spaces.length === 14 && stateB.ship.corridors.length >= 20);

// reconexão: Beto cai e volta com a sessão
b.disconnect();
await sleep(600);
const stateA = await new Promise((r) => a.once('state', r));
const betoOff = stateA.players.find((p) => p.name === 'Beto');
check('jogador desconectado continua na vaga', betoOff && betoOff.connected === false);

const b2 = await connect();
const resumed = await call(b2, 'resume', { code: created.code, session: joined.session });
check('reconexão com a sessão', resumed.ok === true, JSON.stringify(resumed));
await sleep(600);
const afterResume = await new Promise((r) => { b2.once('state', r); setTimeout(() => r(null), 1500); });
check('estado volta para o jogador reconectado', !!afterResume && afterResume.you?.id === b2.id);

// kick
const kicked = new Promise((r) => b2.once('kicked', r));
const kickRes = await call(a, 'kick', { targetId: b2.id });
check('host remove jogador', kickRes.ok === true, JSON.stringify(kickRes));
const wasKicked = await Promise.race([kicked, sleep(1200).then(() => null)]);
check('removido recebe aviso', !!wasKicked);

a.emit('leave');
a.disconnect();
b2.disconnect();
await sleep(300);
console.log(`\nfails = ${fails}`);
process.exit(fails ? 1 : 0);
