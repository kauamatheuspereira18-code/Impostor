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
| **Ejeção** | Cinemática no espaço com o tripulante girando e o texto "ERA O IMPOSTOR" / "Não era o impostor". |
| **Fantasmas** | Mortos atravessam paredes, continuam completando as tarefas (contam na barra) e assistem à votação. |
| **Bots** | Fazem tarefas, matam, reportam, consertam sabotagem, votam em duas ondas e continuam tarefas como fantasmas. |
| **Mapa (Tab)** | Mapa do navio com salas nomeadas, sua posição, suas tarefas, sabotagem piscando e (para impostor) os demais jogadores. |
| **Admin** | Na Administração: mesa com quantos jogadores vivos há em cada sala, em tempo real. |
| **Vitais** | Na Enfermaria: batimento de cada jogador (vivo/morto) com a cor dele. |
| **Câmeras** | Na Segurança: quatro telas ao vivo (Cafeteria, Armas, Navegação, Armazém) com jogadores, corpos e ruído de vídeo; a luz vermelha pisca. |
| **Som** | Efeitos sintetizados em WebAudio: passos, kill, report, sirene de reunião, voto, ejeção, duto, porta, tarefa e alarme do reator. Botão de mudo. |
| **Animação** | Caminhada com pernas alternadas, mochila, viseira com reflexo, tremor de câmera no abate, respingos, duto abrindo, portas deslizando, visão em círculo. |
| **Geometria** | 14 salas com planta própria (octógono na Cafeteria, canto cortado em Armas, bico na Navegação, Armazém em L) e 21 corredores ligados de acordo com o mapa clássico, colisão por polígono. |
| **Tarefas visuais** | Scan na Enfermaria, tiros de asteroide em Armas e anéis em Escudos aparecem para todos, como no jogo. |
| **Papéis** | Até 3 impostores com Metamorfo e Fantasma; tripulantes com Engenheiro, Cientista, Barulhento, Rastreador, Anjo da Guarda ou sem papel. Configurável de 0 a 3 de cada no lobby. |
| **Cosméticos** | 11 chapéus e 4 pets desenhados em canvas, escolhidos na tela inicial e copiados pelo Metamorfo junto com cor e nome. |
| **Habilidades** | Botão de habilidade com recarga em anel, escolha de alvo, transformação com faíscas, invisibilidade, veneno, escudo, marcações no mapa, vitais com bateria e alarme do Barulhento. |
| **Revelação de papel** | Cartão animado no começo de cada partida com papel, equipe, descrição e cúmplices. |

## Controles

- **WASD/setas** ou arraste o dedo na tela para andar.
- **E / espaço**: usar console, botão de emergência, reportar corpo.
- **Q**: matar (impostor) · **R**: sabotar · **F**: habilidade do papel · **Tab**: mapa · **M**: som.
- **Enter**: enviar mensagem no chat.

## Verificações

```bash
cd play
node tools/validate-map.mjs      # 14 salas, 26 consoles, 14 dutos, 13 portas, props e conectividade
node tests/new_game.test.mjs     # socket: lobby, tarefas, sabotagem, reunião e voto
node tests/crewwin.test.mjs      # vitória dos tripulantes
node tests/taskwin.test.mjs      # vitória por tarefas (com fantasma terminando as dele)
node tests/fidelity.test.mjs     # abate, tarefa de fantasma, portas, O₂, ejeção
node tests/roles.test.mjs        # 7 papéis + tempos ajustáveis + cópia perfeita do metamorfo
node tests/fullgame2.test.mjs    # partida completa só com bots
node tests/online.test.mjs       # criar/entrar/lista pública/reconexão/kick (servidor rodando)
```

Resultado atual: `MAPA OK`, `fails = 0` em todos, partida completa terminando em ~1 a 3 minutos
com vencedor definido.

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
    └── validate-map.mjs
```

## O que ainda falta para 100%

Comparado ao cliente oficial, ainda não estão aqui:

- **Outros mapas**: por escolha de escopo, o jogo fica só no **The Skeld** clássico; a
  geometria dos demais não é usada.
- **Bots usando habilidades**: os bots recebem papéis, mas não acionam Metamorfo/Fantasma
  nem o escudo do Anjo — só matam, fazem tarefas, reportam e votam.
- **Trajes/skins completos**: existem cor, chapéu e pet; não há o catálogo inteiro de skins,
  visores e nameplates do jogo.
- **Cosméticos** (chapéus, pets, skins) e progressão.
- **Matchmaking público com contas/regiões** — hoje as salas são por código e por lista.
- **Geometria exata do mesh original** do Unity: as plantas foram reconstruídas a partir do
  mapa e das coordenadas oficiais, não extraídas do asset 3D (não há mesh em texto no repo).
