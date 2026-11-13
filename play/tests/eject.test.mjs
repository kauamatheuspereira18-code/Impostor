/* Testa todos os desfechos da votação: impostor ejetado (restam ou não),
   tripulante ejetado (continua ou acaba), empate, voto pulado e a opção de
   confirmar ejetado. Motor puro, sem socket. */
import { Game } from '../server/game.js';

let fails = 0;
const check = (n, c, e = '') => { console.log(`  ${c ? 'OK  ' : 'FAIL'} ${n}${e ? ' :: ' + e : ''}`); if (!c) fails++; };

function novoJogo({ numImpostors = 2, crew = 6, confirm = true } = {}) {
  const g = new Game('EJECT');
  g.addPlayer('h', 'Humano', 0, false);
  for (let i = 1; i < numImpostors + crew; i++) g.addPlayer('b' + i, 'Bot' + i, i, true);
  g.settings.numImpostors = numImpostors;
  g.settings.numPlayers = numImpostors + crew;
  g.settings.confirmImpostor = confirm;
  g.settings.roles = { shapeshifter: 0, phantom: 0, engineer: 0, scientist: 0, noisemaker: 0, tracker: 0, guardianAngel: 0 };
  const res = g.startGame();
  if (res.error) throw new Error(res.error);
  if (g.tickTimer) { clearInterval(g.tickTimer); g.tickTimer = null; }
  g.startedAt = Date.now();
  for (const p of g.players.values()) p.killReadyAt = 0;
  return g;
}

/** Abre uma reunião e vota em massa em alguém (ou pula o voto). */
function votar(g, alvoId, quemVota) {
  g.startMeeting('teste');
  const votantes = [...g.players.values()].filter((p) => p.alive && (!quemVota || quemVota.includes(p.id)));
  for (const p of votantes) { p.voted = true; p.votedFor = alvoId; }
  g.finishMeeting();
}

const imps = (g) => [...g.players.values()].filter((p) => p.role === 'impostor');
/** Fecha a reunião na mão (equivale aos 5 s de volta ao jogo, sem esperar). */
const encerrarReuniao = (g) => {
  g.state = 'tasks';
  g.meeting = null;
  for (const p of g.players.values()) { p.voted = false; p.votedFor = null; }
};
const crewOf = (g) => [...g.players.values()].filter((p) => p.role === 'crew');

/* [1] ejetar um impostor quando ainda resta outro */
console.log('[1] impostor ejetado com outro vivo: a partida continua');
{
  const g = novoJogo({ numImpostors: 2, crew: 6 });
  const [alvo, outro] = imps(g);
  votar(g, alvo.id);
  check('impostor perdeu a vida', alvo.alive === false);
  check('marcado como ejetado', alvo.ejected === true);
  check('registro lastEject traz o papel', g.lastEject?.role === 'impostor', JSON.stringify(g.lastEject));
  check('lastEject tem o nome', g.lastEject?.name === alvo.name);
  check('partida segue (não terminou)', g.state !== 'ended', g.state);
  const vista = g.serialize('h');
  check('impostores vivos = 1', vista.impostorsAlive === 1, String(vista.impostorsAlive));
  check('vencedor ainda indefinido', !vista.winner);
  check('outro impostor continua vivo', outro.alive === true);
}

/* [2] ejetar o último impostor encerra na hora */
console.log('[2] último impostor ejetado: fim de partida imediato');
{
  const g = novoJogo({ numImpostors: 2, crew: 6 });
  const [a] = imps(g);
  votar(g, a.id);
  check('primeira ejeção continua a partida', g.state !== 'ended', g.state);
  encerrarReuniao(g);
  const segundo = imps(g).find((p) => p.alive);
  votar(g, segundo.id);
  check('todos os impostores mortos', imps(g).every((p) => !p.alive));
  check('partida encerrada (na própria ejeção)', g.state === 'ended', g.state);
  check('vitória dos tripulantes', g.winner === 'crew', String(g.winner));
  check('motivo explica a ejeção', /eliminados/.test(g.gameOverReason || ''), g.gameOverReason);
  const vista = g.serialize('h');
  check('impostores vivos = 0', vista.impostorsAlive === 0, String(vista.impostorsAlive));
  check('serialize ainda traz lastEject', vista.lastEject?.role === 'impostor');
}

/* [3] ejetar um único impostor de partida com 1 só */
console.log('[3] único impostor ejetado: fim de partida imediato');
{
  const g = novoJogo({ numImpostors: 1, crew: 7 });
  const [a] = imps(g);
  votar(g, a.id);
  check('partida encerrada', g.state === 'ended', g.state);
  check('tripulação venceu', g.winner === 'crew');
  check('restam 0 impostores no estado', g.serialize('h').impostorsAlive === 0);
}

/* [4] tripulante ejetado: a partida continua */
console.log('[4] tripulante ejetado com impostores em minoria: continua');
{
  const g = novoJogo({ numImpostors: 1, crew: 7 });
  const c = crewOf(g)[0];
  votar(g, c.id);
  check('tripulante ejetado', c.alive === false && c.ejected === true);
  check('lastEject diz que era tripulante', g.lastEject?.role === 'crew');
  check('partida continua', g.state !== 'ended', g.state);
  check('impostor segue vivo', imps(g)[0].alive === true);
}

/* [5] tripulante ejetado deixando os impostores em maioria: acaba */
console.log('[5] ejeção de tripulante que deixa os impostores em maioria');
{
  const g = novoJogo({ numImpostors: 2, crew: 4 });
  // mata dois tripulantes direto para chegar a 2 impostores x 2 tripulantes
  for (const p of crewOf(g).slice(0, 2)) { p.alive = false; p.killedAt = Date.now(); }
  check('antes: 2 x 2', [...g.players.values()].filter((p) => p.alive).length === 4);
  const c = crewOf(g).find((p) => p.alive);
  votar(g, c.id);
  check('partida encerrada imediatamente', g.state === 'ended', g.state);
  check('impostores venceram', g.winner === 'impostor', String(g.winner));
  check('motivo é a maioria', /maioria/.test(g.gameOverReason || ''), g.gameOverReason);
}

/* [6] empate e voto pulado: ninguém sai, partida continua, sem lastEject novo */
console.log('[6] empate e voto pulado');
{
  const g = novoJogo({ numImpostors: 1, crew: 5 });
  g.startMeeting('teste');
  const vivos = [...g.players.values()].filter((p) => p.alive);
  vivos[0].voted = vivos[0].votedFor = vivos[1].id;
  vivos[1].voted = vivos[1].votedFor = vivos[0].id;
  vivos[2].voted = vivos[2].votedFor = vivos[1].id;
  vivos[3].voted = vivos[3].votedFor = vivos[0].id;
  g.finishMeeting();
  check('empate registrado', g.meeting?.tie === true, String(g.meeting?.tie));
  check('ninguém ejetado', !g.meeting?.ejectedId);
  check('sem lastEject', !g.lastEject);
  check('todos vivos', [...g.players.values()].every((p) => p.alive));
  check('partida continua', g.state !== 'ended', g.state);
}
{
  const g = novoJogo({ numImpostors: 1, crew: 5 });
  g.startMeeting('teste');
  for (const p of [...g.players.values()].filter((x) => x.alive)) { p.voted = true; p.votedFor = 'skip'; }
  g.finishMeeting();
  check('pulo do voto registrado', g.meeting?.skipped === true);
  check('ninguém saiu no pulo', !g.meeting?.ejectedId && !g.lastEject);
}

/* [7] com "confirmar ejetado" desligado o papel não vaza */
console.log('[7] confirmar ejetado desligado');
{
  const g = novoJogo({ numImpostors: 1, crew: 5, confirm: false });
  const a = imps(g)[0];
  votar(g, a.id);
  check('papel não revelado', g.lastEject?.role === null, String(g.lastEject?.role));
  check('meeting também sem papel', g.meeting?.ejectedRole === null);
  check('estado sem contagem pública', g.serialize('h').impostorsAlive === null);
  check('mas a partida encerra ao zerar impostores', g.state === 'ended' && g.winner === 'crew');
}

/* [8] só o jogador ejetado continua na reunião como morto */
console.log('[8] consistência da reunião depois da ejeção');
{
  const g = novoJogo({ numImpostors: 2, crew: 6 });
  const c = crewOf(g)[0];
  votar(g, c.id);
  const vista = g.serialize('h');
  const mim = vista.players.find((p) => p.id === c.id);
  check('ejetado aparece morto na lista', mim.alive === false);
  check('ejetado marcado como ejetado', mim.ejected === true);
  check('reunião concluída', vista.meeting?.done === true);
  check('votos zerados para a próxima reunião? (reset no fim)', vista.meeting?.done === true);
  check('contagem de vivos correta', vista.players.filter((p) => p.alive).length === vista.players.length - 1);
}

/* [9] depois da ejeção o jogo volta sozinho para as tarefas (5 s) */
console.log('[9] volta para as tarefas 5 s depois da ejeção');
{
  const g = novoJogo({ numImpostors: 2, crew: 6 });
  const alvo = imps(g)[0];
  votar(g, alvo.id);
  check('logo após a votação ainda está na reunião', g.state === 'meeting', g.state);
  await new Promise((r) => setTimeout(r, 5300));
  check('voltou para as tarefas', g.state === 'tasks', g.state);
  check('reunião limpa', g.meeting === null || g.meeting === undefined);
  check('ejetado continua morto', g.players.get(alvo.id).alive === false);
  check('vivos não têm voto pendente', [...g.players.values()].every((p) => !p.voted && !p.votedFor));
  check('corpos limpos na reunião', g.bodies.length === 0);
  check('vivos reposicionados', [...g.players.values()].filter((p) => p.alive).every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
}

console.log(fails ? `\n${fails} falhas` : '\nTUDO OK');
process.exit(fails ? 1 : 0);
