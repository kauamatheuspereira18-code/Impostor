# Impostor Play — a versão jogável no navegador

Este diretório coloca o **Impostor** (o servidor privado de Among Us escrito em C#) para
rodar de um jeito que dá para **jogar de verdade no navegador, sem instalar nada**.

> **Por que não é o `Impostor.Server` original compilado?**
> O servidor oficial fala o protocolo UDP do jogo Among Us 16.x, então ele só funciona com
> o cliente oficial do jogo (e exige .NET 8 + NuGet para compilar). Aqui recriamos as
> **regras do jogo do Impostor** — tripulantes, impostor, tarefas, sabotagem, dutos,
> reuniões e votação — em um servidor Node.js com WebSocket, jogável em qualquer navegador.
> O código C# original continua intacto em `../src`.

## Rodar

```bash
cd play
npm install
npm start
```

Abra <http://localhost:3000>. Na tela inicial:

- **Jogar sozinho com bots** — entra em uma sala de 10 jogadores e a partida começa na hora.
- **Criar sala** — gera um código de 5 letras para você compartilhar.
- **Entrar** — digite o código da sala de um amigo.

Para jogar com alguém: crie a sala em uma aba e entre com o código em outra aba, celular ou
em outro computador na mesma rede.

## O que tem no jogo

| Recurso | Como funciona |
| --- | --- |
| **Papéis** | Tripulante ou Impostor. Cada um só vê o próprio papel; impostores se reconhecem. |
| **Tarefas** | As tarefas oficiais do Skeld (dados do repositório Impostor) espalhadas pelas 13 salas. 17 minigames: fios, cartão, asteroides, escanear, inspecionar amostra, enviar dados, desviar energia, filtro de O₂, direção, reator, manifolds, alinhar motor, abastecer, lixo, rota, calibrar distribuidor e multitarefa. |
| **Barra de tarefas** | Quando todos os tripulantes concluem suas tarefas, eles vencem. |
| **Impostor** | Matar (com cooldown), dutos e sabotagem. Vence quando os impostores empatam em número com os tripulantes. |
| **Sabotagem** | Luzes (escurece o mapa), comunicação e reator (se zerar, impostores vencem). Tripulantes consertam na sala certa. |
| **Corpos** | Quem encontra reporta e abre reunião; o corpo some ao começar a votação. |
| **Reunião** | Discussão + votação (tempos configuráveis, padrão 15s/120s), chat e votos anônimos. O mais votado é ejetado; empate não ejeta ninguém. |
| **Emergência** | Botão na Cafeteria, 1 vez por partida (configurável). |
| **Bots** | Preenchem a sala, fazem tarefas, matam, reportam, consertam sabotagem e votam. |
| **Mapa** | Skeld com as 14 salas e 21 corredores, cada sala com planta própria (octógono na Cafeteria, canto cortado em Armas, bico na Navegação...), consoles e dutos nas posições oficiais. Névoa de visão, câmera acompanhando o jogador e escuridão quando as luzes são cortadas. |
| **Fantasmas** | Jogadores mortos continuam vendo o mapa e a votação (não podem votar). |
| **Controles** | **WASD** ou **setas** para andar; **E** para usar o console/objeto mais próximo (tarefa, botão de emergência, duto, reportar corpo); **Q** para matar (impostor); **R** para sabotar; **V** para entrar/sair do duto; **Enter** para abrir o chat da reunião. No celular: arraste o dedo para andar e use os botões na tela. |

## Verificações

```bash
cd play
node tools/validate-map.mjs     # geometria: 14 salas, 26 consoles, 14 dutos, 13 portas
node tests/new_game.test.mjs    # API do socket, tarefas, sabotagem e reunião
node tests/crewwin.test.mjs     # regra de vitória dos tripulantes
node tests/taskwin.test.mjs     # tripulantes vencem completando todas as tarefas
node tests/fullgame2.test.mjs   # partida completa só com bots (até 240s)
```

Todos precisam terminar com `fails = 0`, `MAPA OK` ou um vencedor.

## Configuração

`config.json` usa o mesmo formato de seções do Impostor original:

```json
{
  "Server": {
    "ListenIp": "0.0.0.0",
    "ListenPort": 3000
  }
}
```

Também aceita as variáveis `PORT` e `HOST`. As regras da partida (número de jogadores,
impostores, tarefas e botão de emergência) são ajustadas no lobby pelo host.

## Docker

```bash
cd play
docker build -t impostor-play .
docker run -p 3000:3000 impostor-play
```

## Testes

Com o servidor rodando (`npm start`):

```bash
npm test           # fluxo completo com 2 humanos + bots (lobby, início, tarefas, kill, report, votos, sabotagem)
npm run test:edge  # validações: permissões, cooldowns, abandono de sala, limites
npm run test:full  # uma partida inteira só com bots até alguém vencer
```

## Estrutura

```
play/
├── config.json        # porta e IP (formato do Impostor)
├── server/
│   ├── server.js      # HTTP + Socket.IO (eventos da partida)
│   └── game.js        # regras: papéis, tarefas, kills, sabotagem, reuniões, IA dos bots
├── shared/
│   └── config.js      # mapa, salas, cores, tarefas e sabotagens (usado pelo servidor e pelo cliente)
├── public/
│   ├── index.html     # menu, lobby, HUD, modais
│   ├── style.css
│   └── js/
│       ├── main.js      # estado do cliente, HUD, reunião/votação, entrada
│       ├── render.js    # canvas: mapa, personagens, corpos, minimapa
│       └── minigames.js # fios, cartão, asteroides, scanner, etapas, progresso
└── tests/             # testes de integração via socket
```
