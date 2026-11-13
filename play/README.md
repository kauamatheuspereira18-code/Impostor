# Impostor Play — Among Us jogável no navegador

Recriação jogável do **The Skeld** direto no navegador, usando os **dados oficiais do jogo**
que vivem neste repositório (`src/Impostor.Api/Innersloth/Data`): posição de cada console,
tarefa, duto, porta, botão de emergência, spawn e o elenco de 18 cores.

Tudo roda em Node.js + Socket.IO, sem instalar cliente, sem .NET e sem asset externo:
o navio, os personagens, os sons e os minigames são gerados em tempo real.

## Rodar

```bash
cd play
npm install
npm start
```

Abra <http://localhost:3000>. Na tela inicial:

- **Jogar agora** — partida imediata com 9 bots (não aparece na lista pública).
- **Criar sala** — gera um código de 4 letras (ex.: `K7QP`).
- **Entrar** — digite o código, ou clique em uma sala da lista **Salas abertas**.
- A lista é atualizada sozinha e mostra host, humanos, bots, mapa e estado.

Para jogar com amigos: crie a sala, mande o código e cada um entra pelo celular ou PC.
A partida é autoritativa no servidor, então todos veem a mesma coisa.

## Multiplayer de verdade

| Recurso | Como funciona |
| --- | --- |
| Salas | Código de 4 caracteres, lobby com até 15 jogadores, bots para completar. |
| Lista pública | `/api/games` + evento `listGames`; a home mostra as salas abertas em tempo real. |
| Host | Configura regras, adiciona bots, inicia a partida e remove jogadores. |
| Reconexão | Queda de rede ou F5: o servidor reserva a vaga por 45 s e o cliente retoma a sessão (token salvo no navegador). |
| Troca de host | Se o host sai, o próximo humano assume. |
| Cores | 18 cores oficiais, sem repetição na mesma sala. |
| Chat | Chat no lobby e na reunião. |
| Servidor autoritativo | Movimento, tarefas, kills, sabotagens, portas e votos são validados no servidor. |

## O que tem no jogo

| Recurso | Como funciona |
| --- | --- |
| **Papéis** | Tripulante ou Impostor, com visões diferentes e impostores se reconhecendo. |
| **Tarefas** | As 18 tarefas oficiais do Skeld (26 consoles), 17 minigames: cartão, fios, asteroides, scan, amostra, upload/download, desviar energia, filtro de O₂, direção, reator, manifolds, alinhar motor, abastecer, lixo, rota, distribuidor e escudos. |
| **Barra de tarefas** | Modos "sempre", "só em reuniões" e "nunca", como no jogo. |
| **Impostor** | Kill com cooldown e alcance configurável, dutos e painel com os aliados. |
| **Sabotagem** | Luzes, comunicação, reator e **oxigênio** (duas pessoas consertam). Reator/O₂ zeram e dão a vitória ao impostor. Alarme sonoro e visão reduzida. |
| **Portas** | O impostor fecha as portas de uma sala por 10 s, com cooldown de 30 s por sala e fechamento animado. |
| **Corpos** | Quem encontra reporta; a reunião mostra onde o corpo estava. |
| **Reunião** | Mesa com todos sentados ao redor (como no jogo), discussão + votação, chat, votos anônimos, empate e "pular voto". |
| **Ejeção** | Cinemática no espaço: escotilha abrindo, tripulante girando com rastro, estrelas passando, ~2 s de silêncio e então o veredito. Cobre os cinco desfechos: impostor ejetado com outros vivos ("ERA O IMPOSTOR · restam N"), **último impostor** ("ERA O ÚLTIMO IMPOSTOR" + vitória da tripulação), tripulante ejetado com a partida seguindo ("Não era o impostor · restam N"), tripulante ejetado que deixa os impostores em maioria (fim de partida) e papel oculto quando "confirmar ejetado" está desligado. O jogo termina **na hora** da ejeção quando ela zera os impostores ou deixa a tripulação em minoria; o som de vitória/derrota espera o veredito sair. Empate ou voto pulado não abrem a cena, como no jogo. Clique/ESC pula. |
| **Fantasmas** | Mortos atravessam paredes, continuam completando as tarefas (contam na barra) e assistem à votação. |
| **Bots** | Fazem tarefas, matam, reportam, consertam sabotagem, votam em duas ondas e continuam tarefas como fantasmas. |
| **Mapa (Tab)** | Mapa do navio com salas nomeadas, sua posição, suas tarefas, sabotagem piscando e (para impostor) os demais jogadores. |
| **Admin** | Na Administração: mesa com quantos jogadores vivos há em cada sala, em tempo real. |
| **Vitais** | Na Enfermaria: batimento de cada jogador (vivo/morto) com a cor dele. |
| **Câmeras** | Na Segurança: quatro telas ao vivo (Cafeteria, Armas, Navegação, Armazém) com jogadores, corpos e ruído de vídeo; a luz vermelha pisca. |
| **Música de fundo (extra)** | Fora do jogo original: a **tela inicial** toca "União Flasco" e, no **lobby** (partida criada e não começada), uma das três — "Vida de Empreguete", "Bomba Pet" e "Jin Sheng Yuan" — sorteada a cada entrada (nunca repete a anterior), em loop e baixinho (barramento próprio a 18%). Para ao começar a partida e volta ao sair para a tela inicial. Botão **♪ MÚSICA** no canto liga/desliga (salvo no navegador); o botão **SOM** silencia tudo. As gravações originais não vêm no repositório: o jogo sintetiza uma versão instrumental e, se você colocar seus arquivos em `public/music/` (veja o README de lá), usa os arquivos. |
| **Som por tarefa** | Cada uma das 17 tarefas do Skeld tem efeito próprio (cartão magnético, faísca da fiação, laser/explosão dos asteroides, scanner, gotas da amostra, chirps do upload, energia desviada, sopro do filtro de O₂, volante, reator, batidas dos manifolds, motor, combustível, lixo, sonar do curso, cliques do distribuidor, escudos), com variação curta no passo e confirmação na conclusão. Dá para ouvir todos em **Ajuda → Sons**. |
| **Som** | 33 efeitos sintetizados em WebAudio (sem arquivos): passos, kill (volume cai com a distância), report, sirene de reunião, contagem regressiva dos últimos 5 s, voto, ejeção (ar comprimido) e veredito, duto, porta, sabotagem/conserto, alarme de reator/O₂, vitória/derrota, tarefa e conclusão das tarefas, chat, emergência, morte/fantasma, habilidade de cada papel, aviso de kill/habilidade prontos, escudo e transformação de outros jogadores, além do zumbido ambiente do casco com fade. Botão de mudo persistido. |
| **Animação** | Caminhada com pernas alternadas, mochila, viseira com reflexo, tremor de câmera no abate, respingos, duto abrindo, portas deslizando, visão em círculo. |
| **Geometria** | 14 salas com planta própria (octógono na Cafeteria, canto cortado em Armas, bico na Navegação, Armazém em L) e 21 corredores ligados de acordo com o mapa clássico, colisão por polígono. |
| **Tarefas visuais** | Scan na Enfermaria, tiros de asteroide em Armas e anéis em Escudos aparecem para todos, como no jogo. |
| **Bots com papéis** | Bots usam as habilidades: Metamorfo se disfarça antes de atacar, Fantasma desaparece quando há testemunha, Engenheiro atravessa dutos, Rastreador marca alvos, Cientista abre os vitais, Anjo da Guarda protege quem está exposto e todo impostor usa dutos para se locomover. Bots também convocam reunião de emergência quando há corpo antigo sem report. |
| **Papéis** | Até 3 impostores com Metamorfo e Fantasma; tripulantes com Engenheiro, Cientista, Barulhento, Rastreador, Anjo da Guarda ou sem papel. Configurável de 0 a 3 de cada no lobby. |
| **Cosméticos** | Catálogo oficial completo extraído de `Cosmetics.json`: **584 chapéus, 215 trajes, 185 visores, 166 placas de nome e 53 pets**. Traje, visor, chapéu, pet e placa são escolhidos na tela inicial; o Metamorfo copia tudo junto com cor e nome. |
| **Habilidades** | Botão de habilidade com recarga em anel, escolha de alvo, transformação com faíscas, invisibilidade, veneno, escudo, marcações no mapa, vitais com bateria e alarme do Barulhento. |
| **Revelação de papel** | Cartão animado no começo de cada partida com papel, equipe, descrição e cúmplices. |
| **Chat de mortos** | Quem morreu conversa só com quem morreu; os vivos não veem essas mensagens (e as mensagens aparecem marcadas como "fantasma" para os mortos). |
| **Perfil local** | Nome, cor, chapéu, traje, visor, pet, placa e mudo ficam salvos no navegador (`localStorage`) e voltam na próxima visita. |

## Controles

- **WASD/setas** ou arraste o dedo na tela para andar.
- **E / espaço**: usar console, botão de emergência, reportar corpo.
- **Q**: matar (impostor) · **R**: sabotar · **F**: habilidade do papel · **Tab**: mapa · **M**: som.
- **Enter**: enviar mensagem no chat.

## Verificações

```bash
cd play
node tools/validate-map.mjs      # 14 salas, 26 consoles, 14 dutos, 13 portas, props e conectividade
node tools/extract-cosmetics.mjs # regenera o catálogo de cosméticos a partir dos dados do jogo
node tests/new_game.test.mjs     # socket: lobby, tarefas, sabotagem, reunião e voto
node tests/crewwin.test.mjs      # vitória dos tripulantes
node tests/taskwin.test.mjs      # vitória por tarefas (com fantasma terminando as dele)
node tests/fidelity.test.mjs     # abate, tarefa de fantasma, portas, O₂, ejeção
node tests/roles.test.mjs        # papéis, tempos ajustáveis, cópia do metamorfo, cosméticos e bots com habilidades
node tests/eject.test.mjs        # todos os desfechos da votação (impostor/tripulante, restam ou acabou, empate, pulo)
node tests/audio.test.mjs        # cobertura de som: 33 efeitos, gatilhos por evento e cena de ejeção
node tests/music.test.mjs        # música de fundo: trilhas, sorteio do lobby, volume e mudo
node tests/fullgame2.test.mjs    # partida completa só com bots
node tests/online.test.mjs       # criar/entrar/lista pública/reconexão/kick (servidor rodando)
```

Também dá para rodar por npm: `npm test` (áudio + ejeção + papéis + mapa),
`npm run test:game`, `npm run test:full` e `npm run test:online` (com o servidor no ar).

Resultado atual: `MAPA OK`, `TUDO OK`/`fails = 0` em todos, partida completa terminando em ~1 a 3
minutos com vencedor definido.

## Configuração

`config.json` usa o formato do Impostor original:

```json
{
  "Server": {
    "ListenIp": "0.0.0.0",
    "ListenPort": 3000
  }
}
```

Também aceita `PORT` e `HOST`. As regras (jogadores, impostores, kill, velocidade, visão,
tarefas, tempo de discussão/votação, reuniões de emergência, barra de tarefas, fantasmas e papéis)
são ajustadas no lobby pelo host, com presets Clássico/Casual/Especialista/**Com papéis**/Caos.

## Papéis

O host liga de 0 a 3 de cada papel no lobby. Um impostor recebe no máximo um papel especial;
o sorteio é aleatório a cada partida e o jogador humano sempre recebe um papel quando algum
está ligado.

Os tempos de cada habilidade (duração e recarga) são ajustáveis pelo host no lobby, em
**Tempos das habilidades** — os valores só valem para usos novos, não para o que já está ativo.

| Papel | Time | O que faz |
| --- | --- | --- |
| Metamorfo | impostor | Vira uma cópia perfeita de outro jogador — nome, cor, chapéu e pet — por 10s (recarga 25s). Você também se vê como a cópia até acabar. |
| Fantasma | impostor | Fica invisível por 5s (recarga 30s); não pode matar enquanto invisível. |
| Engenheiro | tripulante | Entra nos dutos por até 5s (recarga 30s). |
| Cientista | tripulante | Vê os vitais em qualquer lugar; a bateria cai 12/s e recarrega 6/s. |
| Barulhento | tripulante | Ao ser morto, dispara um alarme sonoro e visual no local. |
| Rastreador | tripulante | Marca até 3 jogadores por 20s e vê a posição no mapa (recarga 25s). |
| Anjo da Guarda | tripulante | Depois de morto, protege um vivo com escudo por 10s (recarga 60s). |

## Docker

```bash
cd play
docker build -t impostor-play .
docker run -p 3000:3000 impostor-play
```

## Estrutura

```
play/
├── config.json          # porta e IP (formato do Impostor)
├── server/
│   ├── server.js        # HTTP + Socket.IO, salas, sessões, lista pública
│   ├── game.js          # regras: papéis, tarefas, kills, sabotagem, portas, reuniões, bots
│   └── ship.js          # colisão por polígono, salas, dutos, portas, pathfinding
├── shared/
│   ├── rooms.js         # plantas das 14 salas + 21 corredores + props
│   ├── mapdata.js       # dados oficiais extraídos do repositório Impostor
│   ├── rules.js         # constantes, presets e sabotagens
│   ├── cosmetics.js     # catálogo oficial de cosméticos (gerado)
│   └── skeld.js         # botão de emergência e enquadramento
├── public/
│   ├── index.html       # home, lobby, HUD, mapa, reunião, ejeção, chat
│   ├── style.css
│   └── js/
│       ├── app.js       # estado do cliente, HUD, reunião, mapa, sessão
│       ├── renderer.js  # mapa, câmera, luz, personagens, animações, minimapa
│       ├── art.js       # arte procedural (tripulante, cadáver, duto, porta, nave)
│       ├── sfx.js       # efeitos sonoros sintetizados
│       └── tasks.js     # 17 minigames das tarefas oficiais
├── tests/               # integração via socket e regras do motor
└── tools/
    ├── extract-mapdata.mjs
    ├── extract-cosmetics.mjs   # gera shared/cosmetics.js a partir de Cosmetics.json
    └── validate-map.mjs
```

## O que ainda falta para 100%

Comparado ao cliente oficial, ainda não estão aqui:

- **Outros mapas**: por escolha de escopo, o jogo fica só no **The Skeld** clássico; a
  geometria dos demais não é usada.
- **Arte dos cosméticos**: os itens gratuitos e os mais icônicos têm desenho dedicado; o resto
  do catálogo usa desenho procedural determinístico (mesma silhueta/paleta por id), porque os
  textures/sprites originais não estão nos dados textuais do repositório.
- **Cosméticos** (chapéus, pets, skins) e progressão.
- **Voz**: não há chat de voz (só texto) e o áudio do jogo original não está no repositório —
  os efeitos são sintetizados. A música de fundo (recurso extra) usa versões instrumentais
  sintetizadas até você pôr arquivos seus em `public/music/`. Não há áudio posicional
  (panning estéreo) — o kill só abaixa o volume com a distância.
- **Matchmaking público com contas/regiões** — hoje as salas são por código e por lista.
- **Geometria exata do mesh original** do Unity: as plantas foram reconstruídas a partir do
  mapa e das coordenadas oficiais, não extraídas do asset 3D (não há mesh em texto no repo).
