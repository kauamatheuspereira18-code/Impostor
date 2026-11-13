/* Testa o sistema de papéis: metamorfo, fantasma, víbora, engenheiro, cientista,
   barulhento, rastreador e anjo da guarda (motor puro, sem socket). */
import { Game } from '../server/game.js';
import { ABILITY, ROLE_INFO } from '../shared/rules.js';

let fails = 0;
const check = (n, c, e = '') => { console.log(`  ${c ? 'OK  ' : 'FAIL'} ${n}${e ? ' :: ' + e : ''}`); if (!c) fails++; };

const newGame = () => {
  const g = new Game('TEST');
  g.addPlayer('h', 'Humano', 0, false);
  for (let i = 1; i < 10; i++) g.addPlayer('b' + i, 'Bot' + i, i, true);
  g.settings.roles = {
    shapeshifter: 1, phantom: 1,
    engineer: 1, scientist: 1, noisemaker: 1, tracker: 1, guardianAngel: 1,
  };
  g.settings.numImpostors = 3;
  const res = g.startGame();
  if (res.error) throw new Error(res.error);
  if (g.tickTimer) { clearInterval(g.tickTimer); g.tickTimer = null; }
  g.state = 'tasks';
  g.startedAt = Date.now();
  for (const p of g.players.values()) p.killReadyAt = 0;
  return g;
};

const roleOf = (g, type) => [...g.players.values()].find((p) => p.roleType === type);
const crewMember = (g, notId) => [...g.players.values()].find((p) => p.role === 'crew' && p.id !== notId);
const impostor = (g, notId) => [...g.players.values()].find((p) => p.role === 'impostor' && p.id !== notId);
const setRole = (p, type, role) => { p.roleType = type; p.role = role; };
const moveToVent = (g, p) => { const v = g.ship.data.vents[0]; p.x = v.x; p.y = v.y; return v; };

console.log('[1] distribuição de papéis');
{
  const g = newGame();
  const specials = [...g.players.values()].filter((p) => p.roleType !== 'Impostor' && p.roleType !== 'Crewmate');
  check('7 papéis sorteados (2 de impostor + 5 de tripulante)', specials.length === 7, `n=${specials.length}`);
  const imps = [...g.players.values()].filter((p) => p.role === 'impostor');
  check('impostores com papel de impostor', imps.every((p) => ['Impostor', 'Shapeshifter', 'Phantom'].includes(p.roleType)));
  const crew = [...g.players.values()].filter((p) => p.role === 'crew');
  check('tripulantes só com papéis de tripulante', crew.every((p) => !['Shapeshifter', 'Phantom'].includes(p.roleType)));
  const human = g.players.get('h');
  check('humano recebeu papel', human.roleType !== 'Impostor' && human.roleType !== 'Crewmate', human.roleType);
  check('ROLE_INFO tem os 2 papéis de impostor', ['Shapeshifter', 'Phantom'].every((k) => ROLE_INFO[k]?.team === 'impostor'));
  check('Víbora não existe (não é papel oficial)', !ROLE_INFO.Viper);
  check('ROLE_INFO tem os 5 papéis de tripulante', ['Engineer', 'Scientist', 'Noisemaker', 'Tracker', 'Guardian Angel'].every((k) => ROLE_INFO[k]?.team === 'crew'));
}

console.log('[2] metamorfo');
{
  const g = newGame();
  const shifter = g.players.get('h');
  setRole(shifter, 'Shapeshifter', 'impostor');
  const other = g.players.get('b1');
  const res = g.useAbility('h', 'Shapeshifter', 'b1');
  check('transformou', res.ok, JSON.stringify(res));
  const st = g.serialize('b2');
  const seen = st.players.find((p) => p.id === 'h');
  check('outros veem o nome do alvo', seen.name === other.name, `${seen.name} != ${other.name}`);
  check('outros veem a cor do alvo', seen.color === other.color);
  check('marca de transformado', seen.shifted === true);
  const self = g.serialize('h');
  const selfSeen = self.players.find((p) => p.id === 'h');
  check('eu também me vejo transformado', selfSeen.name === other.name, `${selfSeen.name} != ${other.name}`);
  check('meu nome real fica guardado', selfSeen.realName === 'Humano', selfSeen.realName);
  check('cooldown aplicado', shifter.abilityReadyAt > Date.now(), `em ${shifter.abilityReadyAt - Date.now()}ms`);
  shifter.shiftUntil = Date.now() - 1;
  g.tickAbilities(0.05, Date.now());
  check('volta ao normal ao expirar', g.serialize('b2').players.find((p) => p.id === 'h').name === 'Humano');

  // cópia perfeita: cor, chapéu e pet
  shifter.abilityReadyAt = 0;
  shifter.hat = 3; shifter.pet = 2; shifter.skin = 1; shifter.visor = 1; shifter.plate = 1;
  other.hat = 5; other.pet = 4; other.skin = 6; other.visor = 8; other.plate = 5;
  g.useAbility('h', 'Shapeshifter', other.id);
  const copy = g.serialize('b3').players.find((p) => p.id === 'h');
  check('copia o chapéu', copy.hat === other.hat, `hat=${copy.hat}`);
  check('copia o pet', copy.pet === other.pet, `pet=${copy.pet}`);
  check('copia o traje', copy.skin === other.skin, `skin=${copy.skin}`);
  check('copia o visor', copy.visor === other.visor, `visor=${copy.visor}`);
  check('copia a placa de nome', copy.plate === other.plate, `plate=${copy.plate}`);
  check('copia a cor', copy.color === other.color);
  const selfCopy = g.serialize('h').players.find((p) => p.id === 'h');
  check('eu vejo o chapéu copiado', selfCopy.hat === other.hat && selfCopy.pet === other.pet);
  check('eu vejo o traje/visor/placa copiados',
    selfCopy.skin === other.skin && selfCopy.visor === other.visor && selfCopy.plate === other.plate);
  check('cosméticos originais guardados', g.players.get('h').hat === 3 && g.players.get('h').pet === 2);
}

console.log('[3] fantasma (phantom)');
{
  const g = newGame();
  const phantom = g.players.get('h');
  setRole(phantom, 'Phantom', 'impostor');
  const res = g.useAbility('h', 'Phantom');
  check('ficou invisível', res.ok, JSON.stringify(res));
  const viewer = crewMember(g, 'h');
  check('outros não me veem', g.serialize(viewer.id).players.find((p) => p.id === 'h').hidden === true);
  check('eu me vejo', g.serialize('h').players.find((p) => p.id === 'h').hidden === false);
  const victim = crewMember(g, 'h');
  victim.x = phantom.x; victim.y = phantom.y;
  const k = g.kill('h', victim.id);
  check('não mata invisível', !!k.error, k.error);
  phantom.phantomUntil = Date.now() - 1;
  g.tickAbilities(0.05, Date.now());
  const k2 = g.kill('h', victim.id);
  check('mata ao ficar visível', k2.ok, JSON.stringify(k2));
}

console.log('[5] anjo da guarda');
{
  const g = newGame();
  const ga = g.players.get('h');
  setRole(ga, 'Guardian Angel', 'crew');
  ga.alive = false;
  const target = crewMember(g, 'h');
  const res = g.useAbility('h', 'Guardian Angel', target.id);
  check('protegeu', res.ok, JSON.stringify(res));
  check('escudo ativo', target.shieldUntil > Date.now());
  const killer = impostor(g);
  setRole(killer, 'Impostor', 'impostor');
  killer.x = target.x; killer.y = target.y;
  killer.killReadyAt = 0;
  const k = g.kill(killer.id, target.id);
  check('escudo bloqueia o kill', !!k.error, k.error);
  check('alvo continua vivo', target.alive === true);
  check('outros veem o escudo', g.serialize('b2').players.find((p) => p.id === target.id).shielded === true);
  target.shieldUntil = Date.now() - 1;
  const k2 = g.kill(killer.id, target.id);
  check('kill passa após o escudo', k2.ok, JSON.stringify(k2));
}

console.log('[6] rastreador');
{
  const g = newGame();
  const tr = g.players.get('h');
  setRole(tr, 'Tracker', 'crew');
  const res = g.useAbility('h', 'Tracker', 'b7');
  check('marcou', res.ok, JSON.stringify(res));
  check('usos decrementados', tr.trackerUses === ABILITY.Tracker.uses - 1, `usos=${tr.trackerUses}`);
  const you = g.serialize('h').you;
  check('marcação exposta no estado', you.tracked.some((t) => t.id === 'b7'));
  tr.tracked[0].until = Date.now() - 1;
  g.tickAbilities(0.05, Date.now());
  check('marcação expira', tr.tracked.length === 0);
}

console.log('[7] engenheiro (dutos)');
{
  const g = newGame();
  const eng = g.players.get('h');
  setRole(eng, 'Engineer', 'crew');
  const vent = moveToVent(g, eng);
  const res = g.enterVent('h', vent.id);
  check('engenheiro entra no duto', res.ok, JSON.stringify(res));
  check('está no duto', eng.inVent === true);
  check('canVent para o cliente', g.serialize('h').you.canVent === true);
  g.tickAbilities(0.05, eng.ventEnteredAt + (ABILITY.Engineer.ventTime + 0.2) * 1000);
  check('sai sozinho após 5s', eng.inVent === false);
  check('cooldown de 30s', eng.abilityReadyAt - Date.now() > 25000, `${Math.round((eng.abilityReadyAt - Date.now()) / 1000)}s`);
  moveToVent(g, eng);
  check('não entra em recarga', !!g.enterVent('h', vent.id).error);
  eng.abilityReadyAt = 0;
  eng.x = 100; eng.y = 100;
  check('precisa estar perto do duto', !!g.enterVent('h', vent.id).error);
}

console.log('[8] cientista');
{
  const g = newGame();
  const sci = g.players.get('h');
  setRole(sci, 'Scientist', 'crew');
  const res = g.useAbility('h', 'Scientist');
  check('abriu vitais', res.ok, JSON.stringify(res));
  check('vitalsOpen', sci.vitalsOpen === true);
  g.tickAbilities(1, Date.now());
  check('bateria cai 12 por segundo', Math.round(sci.battery) === 88, `bateria=${sci.battery}`);
  sci.vitalsOpen = true;
  sci.vitalsUntil = Date.now() + 9999;
  g.tickAbilities(10, Date.now());
  check('bateria chega a 0 e fecha', sci.battery === 0 && sci.vitalsOpen === false, `bateria=${sci.battery}`);
  g.tickAbilities(1, Date.now());
  check('recarrega 6 por segundo', Math.round(sci.battery) === 6, `bateria=${sci.battery}`);
}

console.log('[9] barulhento');
{
  const g = newGame();
  const noisy = crewMember(g, 'h');
  setRole(noisy, 'Noisemaker', 'crew');
  const killer = impostor(g);
  setRole(killer, 'Impostor', 'impostor');
  killer.x = noisy.x; killer.y = noisy.y;
  killer.killReadyAt = 0;
  const k = g.kill(killer.id, noisy.id);
  check('matou o barulhento', k.ok, JSON.stringify(k));
  check('alarme disparado', g.noiseAlarms.length === 1, `n=${g.noiseAlarms.length}`);
  const st = g.serialize('b2');
  check('alarme visível para todos', st.noiseAlarms.length === 1);
  check('alarme expira', (g.tickAbilities(0.05, Date.now() + 6000), g.noiseAlarms.length === 0));
}

console.log('[10] três impostores');
{
  const g = newGame();
  const imps = [...g.players.values()].filter((p) => p.role === 'impostor');
  check('3 impostores na partida', imps.length === 3, `n=${imps.length}`);
  const anyImp = imps[0];
  const st = g.serialize(anyImp.id);
  check('cada impostor vê 2 cúmplices', (st.you.impostorTeammates || []).length === 2, JSON.stringify(st.you.impostorTeammates));
  check('papéis de impostor não se repetem', new Set(imps.map((p) => p.roleType)).size === imps.length, imps.map((p) => p.roleType).join(','));
  // mata tripulantes até os impostores dominarem
  const crew = [...g.players.values()].filter((p) => p.role === 'crew');
  for (const c of crew) { c.alive = false; }
  g.checkWin();
  check('vitória dos impostores com a tripulação eliminada', g.state === 'ended' && g.winner === 'impostor', `${g.state}/${g.winner} :: ${g.gameOverReason}`);
}

console.log('[11] tempos das habilidades ajustáveis pelo host');
{
  const g = newGame();
  const shifter = g.players.get('h');
  setRole(shifter, 'Shapeshifter', 'impostor');
  g.setSettings({ ability: { shiftDuration: 20, shiftCooldown: 40 } });
  check('duração salva', g.settings.ability.shiftDuration === 20, String(g.settings.ability.shiftDuration));
  const res = g.useAbility('h', 'Shapeshifter', 'b1');
  check('habilidade aceita', res.ok, JSON.stringify(res));
  const dur = Math.round((shifter.shiftUntil - Date.now()) / 1000);
  const cd = Math.round((shifter.abilityReadyAt - Date.now()) / 1000);
  check('duração aplicada (20s)', dur === 20, `${dur}s`);
  check('recarga aplicada (40s)', cd === 40, `${cd}s`);

  const eng = g.players.get('b2');
  setRole(eng, 'Engineer', 'crew');
  g.setSettings({ ability: { ventTime: 9, ventCooldown: 45 } });
  const vent = moveToVent(g, eng);
  check('engenheiro entra', g.enterVent(eng.id, vent.id).ok);
  g.tickAbilities(0.05, eng.ventEnteredAt + 6000);
  check('continua no duto em 6s (limite 9s)', eng.inVent === true);
  g.tickAbilities(0.05, eng.ventEnteredAt + 9600);
  check('sai depois de 9s', eng.inVent === false);
  check('recarga de 45s', eng.abilityReadyAt - Date.now() > 40000, `${Math.round((eng.abilityReadyAt - Date.now()) / 1000)}s`);

  g.setSettings({ ability: { trackUses: 5, shiftDuration: 999, phantomCooldown: -5 } });
  check('limita ao máximo', g.settings.ability.shiftDuration === 30, String(g.settings.ability.shiftDuration));
  check('limita ao mínimo', g.settings.ability.phantomCooldown === 10, String(g.settings.ability.phantomCooldown));
  check('marcações ajustadas', g.settings.ability.trackUses === 5);
}

console.log('[12] catálogo de cosméticos oficial');
{
  const { HATS, SKINS, VISORS, PETS, PLATES, COSMETIC_TOTALS } = await import('../shared/cosmetics.js');
  check('584 chapéus oficiais', HATS.length === 584, `n=${HATS.length}`);
  check('215 trajes oficiais', SKINS.length === 215, `n=${SKINS.length}`);
  check('185 visores oficiais', VISORS.length === 185, `n=${VISORS.length}`);
  check('53 pets oficiais', PETS.length === 53, `n=${PETS.length}`);
  check('166 placas oficiais', PLATES.length === 166, `n=${PLATES.length}`);
  check('totais batem com os dados do jogo', COSMETIC_TOTALS.hat === 584 && COSMETIC_TOTALS.nameplate === 166, JSON.stringify(COSMETIC_TOTALS));
  check('primeiro item é "sem nada"', HATS[0].art === 0 && SKINS[0].art === 0 && VISORS[0].art === 0 && PETS[0].art === 0 && PLATES[0].art === 0);
  check('todos têm id oficial', [...HATS, ...SKINS, ...VISORS, ...PETS, ...PLATES].every((x) => /^(hat|hats|skin|visor|pet|nameplate)_/.test(x.id)));
  check('itens sem arte dedicada não são "sem nada"', HATS.filter((x) => !x.curated).every((x) => x.art !== 0));
  const g2 = newGame();
  const p = g2.players.get('h');
  p.hat = 100000; p.skin = -50; p.visor = 9999; p.pet = 9999; p.plate = 9999;
  g2.setSettings({}); // não deve mexer nos cosméticos
  check('índices grandes continuam seguros no serialize', !!g2.serialize('h').players.find((x) => x.id === 'h'));
}

console.log('[13] configurações de papéis');
{
  const g = newGame();
  g.setSettings({ roles: { engineer: 9, phantom: 2.4, shapeshifter: '2' } });
  const r = g.settings.roles;
  check('limita em 3', r.engineer === 3, `eng=${r.engineer}`);
  check('nunca negativo', r.tracker === 0, `tracker=${r.tracker}`);
  check('arredonda', r.phantom === 2, `phantom=${r.phantom}`);
  check('aceita string numérica', r.shapeshifter === 2, `shifter=${r.shapeshifter}`);
  check('mantém todas as chaves', Object.keys(r).length === 7, JSON.stringify(r));
}

console.log(fails ? `\n${fails} FALHA(S)` : '\nTUDO OK');
process.exit(fails ? 1 : 0);
