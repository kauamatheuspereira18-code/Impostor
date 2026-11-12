import express from 'express';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Server } from 'socket.io';
import { Game } from './game.js';
import { COLORS, GAME_DATA_VERSION, TASK_TYPES } from '../shared/mapdata.js';
import { DEFAULT_SETTINGS, RULE_PRESETS, GAME_CONSTANTS } from '../shared/rules.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
app.disable('x-powered-by');
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  maxHttpBufferSize: 2e6,
});

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/shared', express.static(path.join(__dirname, '..', 'shared')));

app.get('/api/info', (req, res) => {
  res.json({
    name: 'Impostor Play',
    gameDataVersion: GAME_DATA_VERSION,
    colors: COLORS.length,
    presets: RULE_PRESETS,
    defaults: DEFAULT_SETTINGS,
    games: [...games.values()].filter((g) => g.state === 'lobby').length,
    totalGames: games.size,
  });
});
app.get('/api/health', (req, res) => res.json({ ok: true, games: games.size }));

const games = new Map();
const socketGame = new Map();

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  } while (games.has(code));
  return code;
}

const reply = (cb, payload) => { if (typeof cb === 'function') cb(payload); };
const ackArg = (a, b) => (typeof a === 'function' ? a : typeof b === 'function' ? b : null);

function getGame(socketId) {
  const code = socketGame.get(socketId);
  return code ? games.get(code) : null;
}

function broadcast(game) {
  for (const p of game.players.values()) {
    if (p.isBot || !p.connected) continue;
    io.to(p.id).emit('state', game.serialize(p.id));
  }
}

function createGame() {
  const code = newCode();
  const game = new Game(code, null);
  game.onUpdate = () => broadcast(game);
  games.set(code, game);
  const cleaner = setInterval(() => {
    if (game.humanCount === 0) {
      game.stopTicking();
      clearInterval(cleaner);
      games.delete(code);
    }
  }, 60000);
  return game;
}

io.on('connection', (socket) => {
  socket.emit('hello', {
    id: socket.id,
    colors: COLORS.map((c) => ({ id: c.id, name: c.name, hex: c.hex, visor: c.visor })),
    presets: RULE_PRESETS,
    defaults: DEFAULT_SETTINGS,
    gameDataVersion: GAME_DATA_VERSION,
    taskTypes: TASK_TYPES,
  });

  const joinRoom = (game, name, color) => {
    socketGame.set(socket.id, game.code);
    socket.join(game.code);
    const player = game.addPlayer(socket.id, name, color);
    broadcast(game);
    return player;
  };

  socket.on('create', ({ name, color } = {}, cb) => {
    const game = createGame();
    joinRoom(game, name, color);
    reply(cb, { ok: true, code: game.code, id: socket.id });
  });

  socket.on('join', ({ code, name, color } = {}, cb) => {
    const game = games.get(String(code || '').toUpperCase().trim());
    if (!game) return reply(cb, { error: 'Sala não encontrada.' });
    if (game.state !== 'lobby') return reply(cb, { error: 'Partida em andamento.' });
    if (game.players.size >= 15) return reply(cb, { error: 'Sala cheia.' });
    const p = joinRoom(game, name, color);
    reply(cb, { ok: true, code: game.code, id: socket.id, color: p.color });
  });

  socket.on('quickplay', ({ name, color, bots = 9 } = {}, cb) => {
    let game = [...games.values()].find((g) => g.state === 'lobby' && g.players.size < 15 && g.humanCount > 0);
    if (!game) {
      game = createGame();
      const p = joinRoom(game, name, color);
      game.setSettings({ maxPlayers: Math.max(6, Math.min(10, bots + 1)) });
      game.fillBots();
      reply(cb, { ok: true, code: game.code, id: socket.id, color: p.color });
      return;
    }
    const p = joinRoom(game, name, color);
    reply(cb, { ok: true, code: game.code, id: socket.id, color: p.color });
  });

  socket.on('solo', ({ name, color } = {}, cb) => {
    // salinha só sua com bots, começa já
    const game = createGame();
    const p = joinRoom(game, name, color);
    game.setSettings({ maxPlayers: 10, numImpostors: 2 });
    game.fillBots();
    game.startGame();
    reply(cb, { ok: true, code: game.code, id: socket.id, color: p.color });
  });

  socket.on('setSettings', ({ patch, preset, applyToBots } = {}, cb) => {
    const game = getGame(socket.id);
    if (!game) return reply(cb, { error: 'Sem sala.' });
    if (game.hostId !== socket.id) return reply(cb, { error: 'Só o host configura.' });
    if (preset && RULE_PRESETS[preset]) game.setSettings(RULE_PRESETS[preset].values);
    if (patch) game.setSettings(patch);
    if (applyToBots) game.settings.maxPlayers = game.settings.maxPlayers;
    reply(cb, { ok: true });
  });

  socket.on('addBots', (data, cb) => {
    const game = getGame(socket.id);
    if (!game || game.hostId !== socket.id) return reply(ackArg(data, cb), { error: 'Só o host adiciona bots.' });
    game.fillBots();
    reply(ackArg(data, cb), { ok: true });
  });

  socket.on('clearBots', (data, cb) => {
    const game = getGame(socket.id);
    if (!game || game.hostId !== socket.id) return reply(ackArg(data, cb), { error: 'Só o host remove bots.' });
    game.clearBots();
    reply(ackArg(data, cb), { ok: true });
  });

  socket.on('start', (a, b) => {
    const cb = ackArg(a, b);
    const game = getGame(socket.id);
    if (!game) return reply(cb, { error: 'Sem sala.' });
    if (game.hostId !== socket.id) return reply(cb, { error: 'Só o host inicia.' });
    reply(cb, game.startGame());
  });

  socket.on('move', ({ x, y } = {}, cb) => {
    const game = getGame(socket.id);
    if (game && Number.isFinite(x) && Number.isFinite(y)) game.move(socket.id, x, y);
    reply(cb, { ok: true });
  });

  socket.on('startTask', ({ taskKey, consoleId } = {}, cb) => {
    const game = getGame(socket.id);
    if (!game) return reply(cb, { error: 'Sem sala.' });
    reply(cb, game.startTask(socket.id, taskKey, consoleId));
  });

  socket.on('advanceTask', ({ taskKey, consoleId, data } = {}, cb) => {
    const game = getGame(socket.id);
    if (!game) return reply(cb, { error: 'Sem sala.' });
    reply(cb, game.advanceTask(socket.id, taskKey, { consoleId, data }));
  });

  socket.on('kill', ({ targetId } = {}, cb) => {
    const game = getGame(socket.id);
    if (!game) return reply(cb, { error: 'Sem sala.' });
    reply(cb, game.kill(socket.id, targetId));
  });

  socket.on('report', ({ bodyId } = {}, cb) => {
    const game = getGame(socket.id);
    if (!game) return reply(cb, { error: 'Sem sala.' });
    reply(cb, game.report(bodyId, socket.id));
  });

  socket.on('vent', (a, b) => {
    const payload = typeof a === 'object' && a ? a : {};
    const cb = ackArg(a, b);
    const game = getGame(socket.id);
    if (!game) return reply(cb, { error: 'Sem sala.' });
    reply(cb, game.enterVent(socket.id, payload.ventId));
  });

  socket.on('ventMove', (a, b) => {
    const payload = typeof a === 'object' && a ? a : {};
    const cb = ackArg(a, b);
    const game = getGame(socket.id);
    if (!game) return reply(cb, { error: 'Sem sala.' });
    reply(cb, game.moveVent(socket.id, payload.direction || 1));
  });

  socket.on('ventExit', (a, b) => {
    const cb = ackArg(a, b);
    const game = getGame(socket.id);
    if (!game) return reply(cb, { error: 'Sem sala.' });
    reply(cb, game.exitVent(socket.id));
  });

  socket.on('sabotage', (a, b) => {
    const payload = typeof a === 'object' && a ? a : {};
    const cb = ackArg(a, b);
    const game = getGame(socket.id);
    if (!game) return reply(cb, { error: 'Sem sala.' });
    const res = game.startSabotage(socket.id, payload.type);
    if (res.error) socket.emit('toast', res.error);
    reply(cb, res);
  });

  socket.on('fixSabotage', ({ roomId } = {}, cb) => {
    const game = getGame(socket.id);
    if (!game) return reply(cb, { error: 'Sem sala.' });
    reply(cb, game.fixSabotage(socket.id, roomId));
  });

  socket.on('doors', ({ roomId } = {}, cb) => {
    const game = getGame(socket.id);
    if (!game) return reply(cb, { error: 'Sem sala.' });
    reply(cb, game.closeDoors(socket.id, roomId));
  });

  socket.on('emergency', (a, b) => {
    const cb = ackArg(a, b);
    const game = getGame(socket.id);
    if (!game) return reply(cb, { error: 'Sem sala.' });
    const res = game.callEmergency(socket.id);
    if (res.error) socket.emit('toast', res.error);
    reply(cb, res);
  });

  socket.on('vote', ({ targetId } = {}, cb) => {
    const game = getGame(socket.id);
    if (!game) return reply(cb, { error: 'Sem sala.' });
    reply(cb, targetId === 'skip' ? game.skipVote(socket.id) : game.vote(socket.id, targetId));
  });

  socket.on('chat', (a, b) => {
    const payload = typeof a === 'object' && a ? a : {};
    const cb = ackArg(a, b);
    const { text } = payload;
    const game = getGame(socket.id);
    if (!game) return reply(cb, { error: 'Sem sala.' });
    const p = game.players.get(socket.id);
    if (!p) return reply(cb, { error: 'Sem jogador.' });
    const clean = String(text).slice(0, 120).trim();
    if (!clean) return reply(cb, { error: 'Mensagem vazia.' });
    game.log.push({ type: 'chat', text: clean, from: p.name, fromId: p.id, color: p.color, at: Date.now() });
    broadcast(game);
    reply(cb, { ok: true });
  });

  socket.on('toLobby', (a, b) => {
    const cb = ackArg(a, b);
    const game = getGame(socket.id);
    if (!game) return reply(cb, { error: 'Sem sala.' });
    if (game.hostId !== socket.id) return reply(cb, { error: 'Só o host volta ao lobby.' });
    game.backToLobby();
    reply(cb, { ok: true });
  });

  socket.on('leave', () => {
    const game = getGame(socket.id);
    if (game) {
      game.removePlayer(socket.id);
      socket.leave(game.code);
    }
    socketGame.delete(socket.id);
  });

  socket.on('disconnect', () => {
    const game = getGame(socket.id);
    if (game) game.removePlayer(socket.id);
    socketGame.delete(socket.id);
  });
});

httpServer.listen(PORT, HOST, () => {
  console.log(`Impostor Play — dados do jogo ${GAME_DATA_VERSION}`);
  console.log(`Rodando em http://${HOST}:${PORT}`);
});
