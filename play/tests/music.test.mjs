/* Audita a música de fundo (recurso extra): trilhas, sorteio do lobby,
   volume baixo, integração com o mudo e os ganchos no app. */
import fs from 'node:fs';

let fails = 0;
const check = (n, c, e = '') => { console.log(`  ${c ? 'OK  ' : 'FAIL'} ${n}${e ? ' :: ' + e : ''}`); if (!c) fails++; };

const local = (caminho) => new URL(`../public/${caminho}`, import.meta.url);
const musicSrc = fs.readFileSync(local('js/music.js'), 'utf8');
const appSrc = fs.readFileSync(local('js/app.js'), 'utf8');
const html = fs.readFileSync(local('index.html'), 'utf8');
const css = fs.readFileSync(local('style.css'), 'utf8');

console.log('[1] trilhas pedidas');
check('tema da tela inicial é a União Flasco', /home: 'uniao-flasco'/.test(musicSrc));
for (const id of ['vida-de-empreguete', 'bombapet', 'jin-sheng-yuan']) {
  check(`lobby inclui ${id}`, new RegExp(`lobby: \\[[^\\]]*'${id}'`).test(musicSrc));
}
check('nomes de arquivo documentados', fs.existsSync(local('music/README.md')));

console.log('[2] composição de cada trilha');
const { music, MUSICAS } = await import(local('js/music.js'));
check('objeto music exportado', !!music && typeof music.play === 'function');
check('cena home definida', MUSICAS.home === 'uniao-flasco', MUSICAS.home);
check('três músicas de lobby', MUSICAS.lobby.length === 3, String(MUSICAS.lobby.length));

const IDS = ['uniao-flasco', 'vida-de-empreguete', 'bombapet', 'jin-sheng-yuan'];
const inicioFaixas = musicSrc.indexOf('const FAIXAS');
const fimFaixas = musicSrc.indexOf('export const MUSICAS');
const posicoes = IDS.map((id) => {
  const comAspas = musicSrc.indexOf(`'${id}': {`, inicioFaixas);
  const semAspas = musicSrc.indexOf(`
  ${id}: {`, inicioFaixas);
  const pos = comAspas >= 0 ? comAspas : semAspas;
  return pos >= 0 && pos < fimFaixas ? pos : -1;
});
for (const [i, id] of IDS.entries()) {
  const inicio = posicoes[i];
  const proximo = posicoes.slice(i + 1).find((p) => p > inicio);
  const bloco = inicio < 0 ? '' : musicSrc.slice(inicio, proximo > 0 ? proximo : fimFaixas);
  const notas = (bloco.match(/\{ b: /g) || []).length;
  check(`trilha "${id}" com melodia e baixo`, notas >= 20, `${notas} notas`);
  check(`trilha "${id}" tem bateria`, /drums: \{/.test(bloco));
  check(`trilha "${id}" define bpm e beats`, /bpm: \d+/.test(bloco) && /beats: \d+/.test(bloco));
}

console.log('[3] volume e mudo');
check('barramento baixo (≤ 20%)', /this\.volume = 0\.1\d/.test(musicSrc), (musicSrc.match(/this\.volume = ([0-9.]+)/) || [])[1]);
check('passa pelo ganho mestre do sfx (mudo vale)', /this\.bus\.connect\(sfx\.master/.test(musicSrc));
check('liga/desliga persistido', /localStorage\.setItem\('impostor:music'/.test(musicSrc) && /getItem\('impostor:music'\)/.test(musicSrc));
check('fade de entrada', /exponentialRampToValueAtTime\(0\.9, t \+ 1\.2\)/.test(musicSrc));
check('fade de saída', /exponentialRampToValueAtTime\(0\.0001, t \+ 0\.5\)/.test(musicSrc));

console.log('[4] ganchos no app');
check('toca na tela inicial', /music\.play\('home'\)/.test(appSrc));
check('toca no lobby', /music\.play\('lobby'\)/.test(appSrc));
check('para fora do lobby', /music\.parar\(\)/.test(appSrc));
check('retoma depois do primeiro gesto', /if \(music\.desejada\) music\.play\(music\.desejada\)/.test(appSrc));
check('botão de música no HTML', /id="btnMusic"/.test(html));
check('botão de música estilizado', /\.music-toggle/.test(css));
check('botão alterna e repinta', /music\.setLigada\(!music\.ligada\)/.test(appSrc) && /function pintaMusica/.test(appSrc));

console.log('[5] sorteio do lobby');
check('nunca repete a faixa anterior', /filter\(\(id\) => id !== this\.ultima\)/.test(musicSrc));
check('sorteia com Math.random', /Math\.random\(\)/.test(musicSrc));

console.log(fails ? `\n${fails} falhas` : '\nTUDO OK');
process.exit(fails ? 1 : 0);
