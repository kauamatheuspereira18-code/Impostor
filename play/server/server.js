import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Server } from 'socket.io';
import { Game } from './game.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// mesma ideia do Impostor: config.json na raiz, env vars com prioridade
function loadConfig() {
  const fallback = { Server: { ListenIp: '0.0.0.0', ListenPort: 3000 } };
  try {
    const raw = JSON.parse(readFileSync(path.join(__dirname, '..', 'config.json'), 'utf8'));
    return { ...fallback, ...raw, Server: { ...fallback.Server, ...(raw.Server || {}) } };
  } catch {
    return fallback;
  }
}

const config = loadConfig();
const PORT = Number(process.env.PORT || config.Server.ListenPort || 3000);
const HOST = process.env.HOST || config.Server.ListenIp || '0.0.0.0';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  // permite ser embutido no preview do Arena
  allowRequest: (req, callback) => callback(null, true),
});

app.use(express.static(path.join(__dirname, '..', 'public')));
// o cliente importa as mesmas constantes do servidor em /shared/*
app.use('/shared', express.static(path.join(__dirname, '..', 'shared')));
app.get('/api/health', (req, res) => res.json({ ok: true, games: games.size }));

/** @type {Map<string, Game>} */
const games = new Map();
const socketGame = new Map(); // socketId -> code

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode() {
  let code;
  do {
    code = Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  } while (games.has(code));
  return code;
}

const reply = (cb, payload) => { if (typeof cb === 'function') cb(payload); };
// aceita tanto emit(ev, cb) quanto emit(ev, data, cb)
const ackArg = (a, b) => (typeof a === 'function' ? a : typeof b === 'function' ? b : null);

function getGameFor(socketId) {
  const code = socketGame.get(socketId);
  return code ? games.get(code) : null;
}

function broadcast(game) {
  for (const p of game.players.values()) {
    if (p.isBot) continue;
    io.to(p.id).emit('state', game.serialize(p.id));
  }
}

function createGame() {
  const code = newCode();
  const game = new Game(code, () => {});
  game.onUpdate = () => broadcast(game);
  games.set(code, game);
  // limpa partidas vazias
  game.cleanupTimer = setInterval(() => {
    if (game.humanCount === 0 && game.players.size === 0) {
      game.stopTicking();
      clearInterval(game.cleanupTimer);
      games.delete(code);
    }
  }, 60000);
  return game;
}

io.on('connection', (socket) => {
  socket.emit('hello', { id: socket.id });

  socket.on('create', ({ name, color }, cb) => {
    const game = createGame();
    socketGame.set(socket.id, game.code);
    game.addPlayer(socket.id, name, color);
    socket.join(game.code);
    reply(cb, { ok: true, code: game.code });
    broadcast(game);
  });

  socket.on('join', ({ code, name, color }, cb) => {
    const game = games.get((code || '').toUpperCase().trim());
    if (!game) return reply(cb, { error: 'Sala não encontrada. Confira o código.' });
    if (game.state !== 'lobby') return reply(cb, { error: 'A partida já começou. Peça para voltarem ao lobby.' });
    if (game.players.size >= 15) return reply(cb, { error: 'Sala cheia (15 jogadores).' });
    socketGame.set(socket.id, game.code);
    game.addPlayer(socket.id, name, color);
    socket.join(game.code);
    reply(cb, { ok: true, code: game.code });
    broadcast(game);
  });

  socket.on('quickplay', ({ name, color }, cb) => {
    let game = [...games.values()].find((g) => g.state === 'lobby' && g.players.size < 15 && g.humanCount > 0);
    if (!game) {
      game = createGame();
      game.addPlayer(socket.id, name, color);
      game.fillWithBots();
    } else {
      game.addPlayer(socket.id, name, color);
      game.fillWithBots();
    }
    socketGame.set(socket.id, game.code);
    socket.join(game.code);
    reply(cb, { ok: true, code: game.code });
    broadcast(game);
  });

  socket.on('setSettings', (partial, cb) => {
    const game = getGameFor(socket.id);
    if (game && socket.id === game.hostId) game.setSettings(partial || {});
    reply(cb, { ok: true });
  });

  socket.on('ready', (ready, cb) => {
    const game = getGameFor(socket.id);
    if (game) game.setReady(socket.id, ready);
    reply(cb, { ok: true });
  });

  socket.on('addBots', (a, b) => {
    const cb = ackArg(a, b);
    const game = getGameFor(socket.id);
    if (game && socket.id === game.hostId && game.state === 'lobby') game.fillWithBots();
    reply(cb, { ok: true });
  });

  socket.on('start', (a, b) => {
    const cb = ackArg(a, b);
    const game = getGameFor(socket.id);
    if (!game) return reply(cb, { error: 'Você não está em uma sala.' });
    if (socket.id !== game.hostId) return reply(cb, { error: 'Apenas o host pode iniciar.' });
    const res = game.startGame();
    reply(cb, res);
  });

  socket.on('move', ({ x, y }, cb) => {
    const game = getGameFor(socket.id);
    if (game && Number.isFinite(x) && Number.isFinite(y)) game.move(socket.id, x, y);
    reply(cb, { ok: true });
  });

  socket.on('kill', ({ targetId }, cb) => {
    const game = getGameFor(socket.id);
    if (!game) return;
    reply(cb, game.killPlayer(socket.id, targetId));
  });

  socket.on('report', ({ bodyId }, cb) => {
    const game = getGameFor(socket.id);
    if (!game) return reply(cb, { error: 'Você não está em uma sala.' });
    reply(cb, game.reportBody(socket.id, bodyId) || { ok: true });
  });

  socket.on('emergency', (a, b) => {
    const cb = ackArg(a, b);
    const game = getGameFor(socket.id);
    if (!game) return reply(cb, { error: 'Você não está em uma sala.' });
    const res = game.callEmergency(socket.id) || { ok: true };
    socket.emit('toast', res.error || 'Reunião convocada!');
    reply(cb, res);
  });

  socket.on('vent', ({ ventId }, cb) => {
    const game = getGameFor(socket.id);
    if (game) game.useVent(socket.id, ventId);
    reply(cb, { ok: true });
  });

  socket.on('sabotage', ({ type }, cb) => {
    const game = getGameFor(socket.id);
    if (!game) return reply(cb, { error: 'Você não está em uma sala.' });
    const res = game.triggerSabotage(socket.id, type);
    if (res?.error) socket.emit('toast', res.error);
    reply(cb, res || { ok: true });
  });

  socket.on('fixSabotage', (a, b) => {
    const cb = ackArg(a, b);
    const game = getGameFor(socket.id);
    const player = game?.players.get(socket.id);
    if (game && player) {
      const room = game.map.rooms.find((r) => Math.abs(player.x - (r.x + r.w / 2)) < r.w / 2 + 20 && Math.abs(player.y - (r.y + r.h / 2)) < r.h / 2 + 20);
      game.fixSabotage(socket.id, room?.id);
    }
    reply(cb, { ok: true });
  });

  socket.on('doTask', ({ taskId }, cb) => {
    const game = getGameFor(socket.id);
    const player = game?.players.get(socket.id);
    if (!game || !player) return reply(cb, { error: 'Você não está em uma sala.' });
    const task = game.tasks.find((t) => t.id === taskId);
    if (!task) return reply(cb, { error: 'Tarefa não encontrada.' });
    if (!player.alive) return reply(cb, { error: 'Fantasmas não fazem tarefas.' });
    if (player.role === 'impostor') return reply(cb, { error: 'Impostores não fazem tarefas.' });
    if (Math.hypot(player.x - task.x, player.y - task.y) > 90) return reply(cb, { error: 'Você precisa estar perto da tarefa.' });
    game.completeTask(socket.id, taskId);
    reply(cb, { ok: true });
  });

  socket.on('vote', ({ targetId }, cb) => {
    const game = getGameFor(socket.id);
    if (!game) return;
    const res = game.castVote(socket.id, targetId);
    reply(cb, res);
  });

  socket.on('chat', ({ text }, cb) => {
    const game = getGameFor(socket.id);
    if (!game || !text) return reply(cb, { error: 'Mensagem vazia.' });
    const p = game.players.get(socket.id);
    if (!p) return;
    const clean = String(text).slice(0, 140);
    game.log.push(`${p.name}: ${clean}`);
    broadcast(game);
    reply(cb, { ok: true });
  });

  socket.on('toLobby', (a, b) => {
    const cb = ackArg(a, b);
    const game = getGameFor(socket.id);
    if (game && socket.id === game.hostId) game.returnToLobby();
    reply(cb, { ok: true });
  });

  socket.on('leave', () => {
    const game = getGameFor(socket.id);
    if (game) {
      game.removePlayer(socket.id);
      socket.leave(game.code);
    }
    socketGame.delete(socket.id);
  });

  socket.on('disconnect', () => {
    const game = getGameFor(socket.id);
    if (game) {
      const p = game.players.get(socket.id);
      if (p && game.state !== 'lobby') {
        // mantém o corpo/jogador por um tempo como desconectado
        p.connected = false;
        game.removePlayer(socket.id);
      } else {
        game.removePlayer(socket.id);
      }
    }
    socketGame.delete(socket.id);
  });
});

httpServer.listen(PORT, HOST, () => {
  console.log(`Impostor Play rodando em http://${HOST}:${PORT}`);
  console.log('Abra no navegador e clique em "Jogar sozinho com bots".');
});
