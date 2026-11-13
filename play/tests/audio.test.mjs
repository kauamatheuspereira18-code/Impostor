/* Audita a cobertura de efeitos sonoros: cada som declarado existe, todo som
   chamado pelo app está defininido, e cada evento do jogo tem seu gatilho.
   Sem dependências externas: lê os arquivos e cruza as chamadas. */
import fs from 'node:fs';

let fails = 0;
const check = (n, c, e = '') => { console.log(`  ${c ? 'OK  ' : 'FAIL'} ${n}${e ? ' :: ' + e : ''}`); if (!c) fails++; };

const sfxSrc = fs.readFileSync(new URL('../public/js/sfx.js', import.meta.url), 'utf8');
const appSrc = fs.readFileSync(new URL('../public/js/app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../public/style.css', import.meta.url), 'utf8');
const tasksSrc = fs.readFileSync(new URL('../public/js/tasks.js', import.meta.url), 'utf8');

const defs = new Set([...sfxSrc.matchAll(/^  ([a-zA-Z]+)\s*\(/gm)].map((m) => m[1]));
const calls = new Set([...appSrc.matchAll(/sfx\.([a-zA-Z]+)\s*\(/g)].map((m) => m[1]));

console.log('[1] todo som usado pelo app existe no motor');
for (const c of calls) check(`sfx.${c}()`, defs.has(c));

console.log('[2] sons obrigatórios por evento do jogo');
const obrigatorios = [
  'click', 'hover', 'task', 'footstep', 'vent', 'kill', 'report', 'meeting',
  'vote', 'eject', 'ejectResult', 'denied', 'door', 'sabotage', 'fixed', 'win', 'lose',
  'shift', 'phantom', 'shield', 'track', 'abilityReady', 'killReady',
  'chat', 'tick', 'emergency', 'ghost', 'allTasks', 'startAlarm', 'stopAlarm', 'startAmbient', 'stopAmbient',
];
for (const s of obrigatorios) check(`motor tem ${s}()`, defs.has(s));
for (const s of obrigatorios) check(`app dispara ${s}()`, calls.has(s));

console.log('[3] sons declarados são realmente usados (sem som morto)');
for (const d of defs) {
  if (['init', 'setMuted', 'tone', 'noise', 'constructor', 'taskStep', 'taskDone'].includes(d)) continue;
  check(`sfx.${d} usado`, calls.has(d) || appSrc.includes(`.${d}(`));
}

console.log('[4] gatilhos ligados aos eventos certos');
const perto = (re) => re.test(appSrc);
check('andar toca passos', perto(/footstep\(\)/));
check('kill (com volume por distância) e report tocam', perto(/sfx\.kill\(/) && perto(/sfx\.report\(\)/));
check('reunião e voto tocam', perto(/sfx\.meeting\(\)/) && perto(/sfx\.vote\(\)/));
check('sabotagem e conserto tocam', perto(/sfx\.sabotage\(\)/) && perto(/sfx\.fixed\(\)/));
check('vitória e derrota tocam', perto(/sfx\.win\(\)/) && perto(/sfx\.lose\(\)/));
check('habilidades tocam som próprio', /Phantom: \(\) => sfx\.phantom\(\)/.test(appSrc) && /Engineer: \(\) => sfx\.vent\(\)/.test(appSrc));
check('cooldowns prontos avisam', perto(/sfx\.killReady\(\)/) && perto(/sfx\.abilityReady\(\)/));
check('chat, tick e emergência tocam', perto(/sfx\.chat\(\)/) && perto(/sfx\.tick\(\)/) && perto(/sfx\.emergency\(\)/));
check('morte vira som de fantasma', perto(/sfx\.ghost\(\)/));
check('fim das tarefas toca fanfarra', perto(/sfx\.allTasks\(\)/));
check('conclusão de tarefa usa o som daquela tarefa', perto(/sfx\.task\(task\.game, true\)/) && perto(/sfx\.task\(task\.game, false\)/));

console.log('[5b] uma tarefa, um som');
const jogos = [...tasksSrc.matchAll(/^  ([a-z0-9]+): \{ title:/gm)].map((m) => m[1]);
const cases = [...sfxSrc.matchAll(/case '([a-z0-9]+)': \/\//g)].map((m) => m[1]);
check('todos os minigames cadastrados', jogos.length >= 16, String(jogos.length));
for (const j of jogos) check(`som próprio de "${j}"`, cases.includes(j));
check('seletor de som de tarefa no help', /id="taskSoundSel"/.test(html) && /sfx\.task\(selTarefa\?\.value/.test(appSrc));
check('alarme crítico liga e desliga', perto(/startAlarm\(\)/) && perto(/stopAlarm\(\)/));
check('ambiente da nave toca nas tarefas e para fora delas', perto(/startAmbient\(\)/) && perto(/stopAmbient\(\)/));

console.log('[5] ejeção da nave');
check('overlay de ejeção no HTML', /id="ejectOverlay"/.test(html));
check('tripulante e escotilha no palco', /id="ejectCrew"/.test(html) && /eject-airlock/.test(html) && /eject-trail/.test(html));
check('legenda entra com o veredito', /id="ejectCaption"/.test(html) && /eject-caption\.show/.test(css));
check('voo do tripulante animado', /@keyframes ejectFly/.test(css));
check('estrelas e riscos de velocidade', /@keyframes starDrift/.test(css) && /@keyframes streakPass/.test(css));
check('escotilha abre', /@keyframes airlockOpen/.test(css));
check('overlay esmaece ao sair', /\.eject-overlay\.fade/.test(css));
check('empate/pular voto não abre cena espacial', /if \(!m\.ejectedId\) \{/.test(appSrc) && /Empate! Ninguém foi ejetado\./.test(appSrc));
check('clique/ESC pulam a cena', /'Escape', 'Space', 'Enter'/.test(appSrc));
check('silêncio antes do veredito (2.1s)', /\}, 2100\)/.test(appSrc));
check('veredito com som de acerto/erro', /sfx\.ejectResult\(true\)/.test(appSrc) && /sfx\.ejectResult\(false\)/.test(appSrc));
check('contagem de impostores restantes', /impostorsAlive/.test(appSrc));
check('último impostor encerra a partida na cena', /ERA O ÚLTIMO IMPOSTOR!/.test(appSrc));
check('ejeção mostra o motivo do fim da partida', /note\.textContent = state\.gameOverReason/.test(appSrc));
check('cor do aviso segue o time do jogador', /note\.classList\.add\(ganhei \? 'win' : 'lose'\)/.test(appSrc));
check('som de vitória/derrota espera a cinemática', /pendingEndSound/.test(appSrc));
check('partida acaba na hora ao ejetar (servidor)', /if \(m\.ejectedId\) this\.checkWin\(\);/.test(
  fs.readFileSync(new URL('../server/game.js', import.meta.url), 'utf8')));

console.log('[6] banco de sons do help (testar áudio)');
const botoes = [...html.matchAll(/data-sound="([a-zA-Z]+)"/g)].map((m) => m[1]);
check('banco com todos os efeitos principais', botoes.length >= 20, String(botoes.length));
for (const b of botoes) check(`botão "${b}" tem som`, defs.has(b));
check('clique no banco toca o som', /soundBoard/.test(appSrc) && /sfx\[nome\]/.test(appSrc));

console.log('[7] mixagem');
check('motor tem ganho mestre', /this\.master\.gain\.value = 0\.7/.test(sfxSrc));
check('ambiente tem fade de entrada', /exponentialRampToValueAtTime\(0\.030/.test(sfxSrc));
check('ambiente tem fade de saída', /exponentialRampToValueAtTime\(0\.0001, t \+ 0\.35\)/.test(sfxSrc));
check('mudo persiste no navegador', /muted: C\.muted/.test(appSrc));

console.log(fails ? `\n${fails} falhas` : '\nTUDO OK');
process.exit(fails ? 1 : 0);
