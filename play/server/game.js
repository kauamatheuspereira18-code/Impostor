import { COLORS, MAPS } from '../shared/mapdata.js';
import { GAME_CONSTANTS, DEFAULT_SETTINGS, MAP_SABOTAGES, SABOTAGE_INFO } from '../shared/rules.js';
import { makeShip } from './ship.js';

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const uid = (n = 8) => Math.random().toString(36).slice(2, 2 + n);

const BOT_NAMES = [
  'Pipoca', 'Zeus', 'Kiwi', 'Tuco', 'Luna', 'Nina', 'Sombra', 'Bolinho',
  'Turbo', 'Pixel', 'Foguinho', 'Mel', 'Zeca', 'Duda', 'Cacau', 'Brisa',
  'Trovão', 'Nuggets', 'Fada', 'Tofu',
];

export class Game {
  constructor(code, onUpdate = () => {}) {
    this.code = code;
    this.onUpdate = onUpdate;
    this.players = new Map();
    this.hostId = null;
    this.state = 'lobby'; // lobby | starting | tasks | meeting | ended
    this.settings = { ...DEFAULT_SETTINGS };
    this.ship = makeShip(this.settings.map);
    this.log = [];
    this.bodies = [];
    this.tasks = []; // instâncias de tarefas do mapa
    this.meeting = null;
    this.sabotage = null;
    this.winner = null;
    this.gameOverReason = null;
    this.emergencyUsed = 0;
    this.emergencyCooldownUntil = 0;
    this.sabotageReadyAt = 0;
    this.voteTimer = null;
    this.tickTimer = null;
    this.lastTick = 0;
    this.startedAt = 0;
    this.taskBarSnapshot = { done: 0, total: 1 };
    this.round = 0;
  }

  /* ============================ jogadores ============================ */
  addPlayer(id, name, colorIndex, isBot = false) {
    const usedColors = new Set([...this.players.values()].map((p) => p.color));
    let color = typeof colorIndex === 'number' && !usedColors.has(colorIndex) ? colorIndex : null;
    if (color === null) {
      for (let i = 0; i < COLORS.length; i++) {
        if (!usedColors.has(i)) { color = i; break; }
      }
    }
    if (color === null) color = 0;

    const spawn = this.ship.randomSpawn();
    const player = {
      id,
      name: (name || 'Tripulante').slice(0, 12),
      color,
      x: spawn.x,
      y: spawn.y,
      facing: 1,
      moving: false,
      isBot,
      alive: true,
      connected: true,
      role: null,
      roleType: null,
      tasks: [],
      inVent: false,
      ventId: null,
      ventChain: 0,
      killReadyAt: 0,
      kills: 0,
      reportedBy: null,
      votedFor: null,
      voted: false,
      ghostX: spawn.x,
      ghostY: spawn.y,
      botState: { goal: null, cooldownUntil: 0, idleUntil: 0 },
      lastMoveAt: 0,
    };
    this.players.set(id, player);
    if (!this.hostId) this.hostId = id;
    this.push();
    return player;
  }

  removePlayer(id) {
    const p = this.players.get(id);
    if (!p) return;
    this.players.delete(id);
    if (this.hostId === id) {
      this.hostId = [...this.players.values()].find((x) => !x.isBot)?.id || [...this.players.keys()][0] || null;
    }
    if (['tasks', 'meeting'].includes(this.state)) this.checkWin();
    this.push();
  }

  get humanCount() {
    return [...this.players.values()].filter((p) => !p.isBot).length;
  }

  fillBots() {
    const target = clamp(this.settings.maxPlayers, 4, 15);
    const current = this.players.size;
    const need = target - current;
    for (let i = 0; i < need; i++) {
      const used = new Set([...this.players.values()].map((p) => p.name));
      const name = BOT_NAMES.filter((n) => !used.has(n))[0] || BOT_NAMES[i % BOT_NAMES.length];
      this.addPlayer('bot_' + uid(), name, null, true);
    }
    this.push();
  }

  clearBots() {
    for (const p of [...this.players.values()]) {
      if (p.isBot) this.players.delete(p.id);
    }
    this.push();
  }

  /* ============================ lobby ============================ */
  setSettings(patch) {
    const allowed = Object.keys(DEFAULT_SETTINGS);
    for (const [k, v] of Object.entries(patch || {})) {
      if (!allowed.includes(k)) continue;
      if (k === 'map') {
        if (!MAPS[v]) continue;
        this.settings.map = v;
        this.ship = makeShip(v);
        continue;
      }
      if (typeof DEFAULT_SETTINGS[k] === 'number' && typeof v === 'number') {
        this.settings[k] = Math.round(v * 100) / 100;
      } else {
        this.settings[k] = v;
      }
    }
    const s = this.settings;
    s.maxPlayers = clamp(Math.round(s.maxPlayers), 4, 15);
    s.numImpostors = clamp(Math.round(s.numImpostors), 1, Math.max(1, Math.floor(s.maxPlayers / 2) - 1));
    s.killCooldown = clamp(s.killCooldown, 10, 60);
    s.discussionTime = clamp(s.discussionTime, 0, 120);
    s.votingTime = clamp(s.votingTime, 30, 300);
    s.playerSpeed = clamp(s.playerSpeed, 0.5, 3);
    s.numCommonTasks = clamp(Math.round(s.numCommonTasks), 0, 4);
    s.numLongTasks = clamp(Math.round(s.numLongTasks), 0, 4);
    s.numShortTasks = clamp(Math.round(s.numShortTasks), 0, 6);
    s.emergencyMeetings = clamp(Math.round(s.emergencyMeetings), 0, 9);
    this.push();
  }

  /* ============================ partida ============================ */
  startGame() {
    if (this.state !== 'lobby') return { error: 'A partida já está em andamento.' };
    if (this.players.size < 4) this.fillBots();
    const players = [...this.players.values()];
    if (players.length < 4) return { error: 'São necessários pelo menos 4 jogadores.' };

    this.state = 'starting';
    this.round++;
    this.bodies = [];
    this.meeting = null;
    this.sabotage = null;
    this.winner = null;
    this.gameOverReason = null;
    this.emergencyUsed = 0;
    this.emergencyCooldownUntil = 0;
    this.sabotageReadyAt = Date.now(); // sabotagens liberadas desde o começo
    this.ship = makeShip(this.settings.map);
    this.tasks = this.buildTasks();

    // sorteia impostores
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const impostorCount = clamp(this.settings.numImpostors, 1, players.length - 2);
    const impostorIds = new Set(shuffled.slice(0, impostorCount).map((p) => p.id));

    for (const p of players) {
      p.role = impostorIds.has(p.id) ? 'impostor' : 'crew';
      p.roleType = impostorIds.has(p.id) ? 'Impostor' : 'Crewmate';
      p.alive = true;
      p.kills = 0;
      p.inVent = false;
      p.ventId = null;
      p.votedFor = null;
      p.voted = false;
      p.killReadyAt = Date.now() + 10000;
      p.reportedBy = null;
      p.botState = { goal: null, cooldownUntil: 0, idleUntil: 0 };
      const spawn = this.ship.randomSpawn();
      p.x = spawn.x;
      p.y = spawn.y;
      p.facing = 1;
      p.tasks = [];
    }

    // distribui tarefas (2 comuns iguais para todos, longas e curtas por jogador)
    const crew = players.filter((p) => p.role === 'crew');
    for (const task of this.tasks) task.assignedTo = [];
    this.assignTasks(crew);

    this.startedAt = Date.now();
    this.log.length = 0;
    this.log.push({ type: 'system', text: 'A partida começou!' });
    this.startTicking();
    this.push();
    return { ok: true };
  }

  buildTasks() {
    const map = MAPS[this.settings.map] || MAPS.skeld;
    const list = [];
    for (const t of map.tasks) {
      list.push({
        key: `${t.taskType}-${t.id}`,
        taskType: t.taskType,
        name: t.name,
        game: t.game,
        length: t.length, // Common | Long | Short
        consoles: t.consoles,
        progress: {}, // playerId -> estado
        completedBy: new Set(),
        assignedTo: [],
      });
    }
    return list;
  }

  assignTasks(crew) {
    const byLength = (len) => this.tasks.filter((t) => t.length === len);
    const common = byLength('Common');
    const longs = byLength('Long');
    const shorts = byLength('Short');
    const s = this.settings;

    // comuns: a mesma tarefa para todos os tripulantes
    const commonPick = common.slice(0, clamp(s.numCommonTasks, 0, common.length));
    for (const p of crew) p.tasks = commonPick.map((t) => t.key);

    // longas/curtas: cada jogador recebe uma seleção embaralhada (como no jogo),
    // evitando repetir o mesmo tipo de tarefa entre jogadores diferentes
    const pickDistinct = (pool, count) => {
      const groups = new Map();
      for (const t of pool) {
        if (!groups.has(t.taskType)) groups.set(t.taskType, []);
        groups.get(t.taskType).push(t);
      }
      const types = [...groups.keys()].sort(() => Math.random() - 0.5);
      return types.slice(0, count).map((type) => {
        const options = groups.get(type);
        return options[Math.floor(Math.random() * options.length)];
      });
    };

    for (const p of crew) {
      const used = new Set(p.tasks);
      const longsForP = pickDistinct(longs, clamp(s.numLongTasks, 0, longs.length)).filter((t) => !used.has(t.key));
      const shortsForP = pickDistinct(shorts.filter((t) => !used.has(t.key)), clamp(s.numShortTasks, 0, shorts.length));
      p.tasks.push(...longsForP.map((t) => t.key));
      p.tasks.push(...shortsForP.map((t) => t.key));
      p.tasks = [...new Set(p.tasks)];
    }

    for (const t of this.tasks) {
      t.assignedTo = crew.filter((p) => p.tasks.includes(t.key)).map((p) => p.id);
    }
    this.taskBarSnapshot = this.currentTaskProgress();
  }

  totalTasksForCrew() {
    const crew = [...this.players.values()].filter((p) => p.role === 'crew');
    return crew.reduce((acc, p) => acc + p.tasks.length, 0);
  }

  currentTaskProgress() {
    const crew = [...this.players.values()].filter((p) => p.role === 'crew');
    let total = 0;
    let done = 0;
    for (const p of crew) {
      for (const key of p.tasks) {
        // tarefas de tripulantes mortos saem da barra: no jogo, quem morreu não
        // pode mais contribuir e a barra não pode ficar presa em 100% impossível
        if (!p.alive) continue;
        total++;
        const task = this.tasks.find((t) => t.key === key);
        if (task?.completedBy.has(p.id)) done++;
      }
    }
    return { done, total };
  }

  /* ============================ loop ============================ */
  startTicking() {
    if (this.tickTimer) return;
    this.lastTick = Date.now();
    this.tickTimer = setInterval(() => this.tick(), 1000 / GAME_CONSTANTS.TICK_HZ);
  }

  stopTicking() {
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = null;
  }

  tick() {
    const now = Date.now();
    const dt = Math.min(0.25, (now - this.lastTick) / 1000);
    this.lastTick = now;

    if (this.state === 'tasks' || this.state === 'starting') {
      if (this.state === 'starting' && now - this.startedAt > 3000) this.state = 'tasks';
      this.tickBots(dt, now);
      this.tickSabotage(now);
    } else if (this.state === 'meeting') {
      this.tickMeeting(now);
    }
    this.push();
  }

  /* ============================ movimento ============================ */
  move(id, x, y) {
    const p = this.players.get(id);
    if (!p || !p.alive || this.state === 'meeting') return;
    if (p.inVent) {
      // no duto: só pode ir para o próximo duto da rede
      const vent = this.ship.ventById(p.ventId);
      if (vent && dist({ x, y }, vent) < 1.2) {
        p.x = vent.x;
        p.y = vent.y;
      }
      return;
    }
    const speed = GAME_CONSTANTS.BASE_SPEED * this.settings.playerSpeed;
    const maxStep = speed * 0.35 + 0.4;
    const dx = clamp(x - p.x, -maxStep, maxStep);
    const dy = clamp(y - p.y, -maxStep, maxStep);
    const next = this.ship.move(p.x, p.y, dx, dy);
    if (Math.abs(next.x - p.x) > 0.0001) p.facing = next.x > p.x ? 1 : -1;
    p.x = next.x;
    p.y = next.y;
    p.moving = Math.hypot(dx, dy) > 0.02;
    p.lastMoveAt = Date.now();
    p.botState.goal = null;
  }

  /* ============================ tarefas ============================ */
  startTask(id, taskKey, consoleId) {
    const p = this.players.get(id);
    const task = this.tasks.find((t) => t.key === taskKey);
    if (!p || !task || !p.alive) return { error: 'Tarefa inválida.' };
    if (p.role === 'impostor') return { error: 'Impostores não fazem tarefas.' };
    if (!p.tasks.includes(task.key)) return { error: 'Essa tarefa não é sua.' };
    if (task.completedBy.has(p.id)) return { error: 'Tarefa já concluída.' };
    if (this.sabotage?.type === 'comms') return { error: 'Comunicação caída: tarefas desativadas.' };
    const console_ = task.consoles.find((c) => c.id === consoleId) || task.consoles[0];
    if (!console_) return { error: 'Console inválido.' };
    if (dist(p, console_) > GAME_CONSTANTS.TASK_USE_DISTANCE + 0.6) {
      return { error: 'Você precisa estar no console da tarefa.' };
    }
    const prog = this.taskProgress(p.id, task.key);
    if (prog.finished) return { error: 'Tarefa já concluída.' };
    return {
      ok: true,
      task: {
        key: task.key,
        name: task.name,
        game: task.game,
        length: task.length,
        step: prog.step,
        totalSteps: this.taskSteps(task),
        data: prog.data,
      },
    };
  }

  taskSteps(task) {
    switch (task.game) {
      case 'wires': return task.consoles.length;
      case 'fuel': return 3;
      case 'upload': return 2;
      case 'divert': return 2;
      case 'multistep': return 3;
      default: return 1;
    }
  }

  taskProgress(playerId, taskKey) {
    const task = this.tasks.find((t) => t.key === taskKey);
    if (!task) return { step: 0, finished: true, data: null };
    const prog = task.progress[playerId] || { step: 0, data: null };
    return { ...prog, finished: task.completedBy.has(playerId) };
  }

  /** Avança um passo da tarefa. O cliente faz o minigame e confirma o passo. */
  advanceTask(id, taskKey, payload = {}) {
    const p = this.players.get(id);
    const task = this.tasks.find((t) => t.key === taskKey);
    if (!p || !task || !p.alive) return { error: 'Tarefa inválida.' };
    if (!p.tasks.includes(task.key)) return { error: 'Essa tarefa não é sua.' };
    if (task.completedBy.has(p.id)) return { error: 'Tarefa já concluída.' };
    if (this.sabotage?.type === 'comms') return { error: 'Comunicação caída.' };
    const console_ = task.consoles.find((c) => c.id === payload.consoleId) || task.consoles[0];
    if (dist(p, console_) > GAME_CONSTANTS.TASK_USE_DISTANCE + 1.2) return { error: 'Longe do console.' };

    const prog = task.progress[p.id] || { step: 0, data: null };
    const total = this.taskSteps(task);
    prog.step = Math.min(total, prog.step + 1);
    prog.data = payload.data ?? prog.data;
    task.progress[p.id] = prog;

    let finished = false;
    if (prog.step >= total) {
      finished = true;
      task.completedBy.add(p.id);
      if (this.settings.taskBarMode === 0) this.taskBarSnapshot = this.currentTaskProgress();
      this.log.push({ type: 'task', text: `${p.name} completou ${task.name}.` });
      this.checkWin();
    }
    this.push();
    return { ok: true, finished, step: prog.step, totalSteps: total };
  }

  /* ============================ kill / report / dutos ============================ */
  kill(killerId, targetId) {
    const killer = this.players.get(killerId);
    const target = this.players.get(targetId);
    if (this.state !== 'tasks') return { error: 'Não é possível matar agora.' };
    if (!killer || !killer.alive || killer.role !== 'impostor') return { error: 'Você não é um impostor.' };
    if (!target || !target.alive) return { error: 'Alvo inválido.' };
    if (target.role === 'impostor') return { error: 'Não pode matar outro impostor.' };
    if (Date.now() < killer.killReadyAt) return { error: 'Aguarde o cooldown do kill.' };
    const range = GAME_CONSTANTS.KILL_DISTANCES[this.settings.killDistance] || 1.8;
    if (dist(killer, target) > range) return { error: 'Alvo fora de alcance.' };

    target.alive = false;
    target.inVent = false;
    target.killedAt = Date.now();
    target.killedBy = killerId;
    killer.kills++;
    killer.killReadyAt = Date.now() + this.settings.killCooldown * 1000;
    // bots: ~55% do cooldown humano para a partida não arrastar
    if (killer.isBot) killer.killReadyAt = Date.now() + Math.max(9000, this.settings.killCooldown * 550);
    this.bodies.push({
      id: 'body_' + uid(5),
      playerId: target.id,
      color: target.color,
      name: target.name,
      x: target.x,
      y: target.y,
      room: this.ship.roomAt(target.x, target.y),
      at: Date.now(),
    });
    this.checkWin();
    this.push();
    return { ok: true };
  }

  report(bodyId, reporterId) {
    const p = this.players.get(reporterId);
    if (this.state !== 'tasks' || !p || !p.alive) return { error: 'Não é possível reportar agora.' };
    const body = this.bodies.find((b) => b.id === bodyId);
    if (!body) return { error: 'Corpo não encontrado.' };
    if (dist(p, body) > GAME_CONSTANTS.REPORT_DISTANCE + 0.8) return { error: 'Longe do corpo.' };
    this.startMeeting(reporterId, 'report', body);
    return { ok: true };
  }

  enterVent(playerId, ventId) {
    const p = this.players.get(playerId);
    if (this.state !== 'tasks' || !p || !p.alive || p.role !== 'impostor') return { error: 'Só impostores usam dutos.' };
    const vent = this.ship.ventById(ventId);
    if (!vent) return { error: 'Duto inválido.' };
    if (dist(p, vent) > 1.6) return { error: 'Longe do duto.' };
    p.inVent = true;
    p.ventId = vent.id;
    p.ventChain = 0;
    p.x = vent.x;
    p.y = vent.y;
    this.push();
    return { ok: true };
  }

  moveVent(playerId, direction = 1) {
    const p = this.players.get(playerId);
    if (!p?.inVent) return { error: 'Você não está em um duto.' };
    const next = this.ship.ventNeighbor(p.ventId, direction);
    if (!next) return { error: 'Não há outro duto conectado.' };
    p.ventId = next.id;
    p.x = next.x;
    p.y = next.y;
    p.ventChain++;
    this.push();
    return { ok: true };
  }

  exitVent(playerId) {
    const p = this.players.get(playerId);
    if (!p?.inVent) return { error: 'Você não está em um duto.' };
    const vent = this.ship.ventById(p.ventId);
    p.inVent = false;
    p.ventId = null;
    if (vent) {
      // sai ao lado do duto
      const spot = this.ship.move(vent.x, vent.y, 0.9, 0.9);
      p.x = spot.x;
      p.y = spot.y;
    }
    this.push();
    return { ok: true };
  }

  /* ============================ sabotagem ============================ */
  startSabotage(playerId, type) {
    const p = this.players.get(playerId);
    if (this.state !== 'tasks') return { error: 'Não é possível sabotar agora.' };
    if (!p || !p.alive || p.role !== 'impostor') return { error: 'Só impostores sabotam.' };
    if (this.sabotage) return { error: 'Já existe uma sabotagem ativa.' };
    if (Date.now() < this.sabotageReadyAt) return { error: 'Sabotagem em cooldown.' };
    const allowed = MAP_SABOTAGES[this.settings.map] || [];
    if (!allowed.includes(type)) return { error: 'Sabotagem indisponível neste mapa.' };
    const info = SABOTAGE_INFO[type];
    const endsAt = Date.now() + info.time * 1000;
    this.sabotage = {
      type,
      endsAt,
      by: playerId,
      fixedBy: [],
      roomId: info.room,
      requiredFixes: type === 'reactor' ? 2 : 1,
    };
    this.log.push({ type: 'sabotage', text: `Sabotagem: ${info.name}!` });
    this.push();
    return { ok: true };
  }

  fixSabotage(playerId, station) {
    const p = this.players.get(playerId);
    if (!this.sabotage || !p || !p.alive || p.role !== 'crew') return { error: 'Não é possível consertar.' };
    const room = this.ship.roomAt(p.x, p.y);
    if (room !== this.sabotage.roomId && station !== this.sabotage.roomId) {
      return { error: `Vá para ${this.sabotage.roomId} para consertar.` };
    }
    if (!this.sabotage.fixedBy.includes(playerId)) this.sabotage.fixedBy.push(playerId);
    if (this.sabotage.fixedBy.length >= this.sabotage.requiredFixes) {
      this.log.push({ type: 'system', text: 'Sabotagem resolvida.' });
      this.sabotage = null;
      this.sabotageReadyAt = Date.now() + GAME_CONSTANTS.SABOTAGE_COOLDOWN * 1000;
      this.push();
      return { ok: true, fixed: true };
    }
    this.push();
    return { ok: true, fixed: false, progress: `${this.sabotage.fixedBy.length}/${this.sabotage.requiredFixes}` };
  }

  tickSabotage(now) {
    if (!this.sabotage) return;
    if (now < this.sabotage.endsAt) return;
    const info = SABOTAGE_INFO[this.sabotage.type];
    if (info?.fatal) {
      this.endGame('impostor', `A sabotagem de ${info.name} não foi consertada.`);
    } else {
      // luzes/comms simplesmente se recuperam
      this.log.push({ type: 'system', text: `A sabotagem de ${info?.name || ''} se resolveu sozinha.` });
      this.sabotage = null;
      this.sabotageReadyAt = now + GAME_CONSTANTS.SABOTAGE_COOLDOWN * 1000;
    }
    this.push();
  }

  closeDoors(playerId, roomId) {
    const p = this.players.get(playerId);
    if (this.state !== 'tasks' || !p?.alive || p.role !== 'impostor') return { error: 'Só impostores fecham portas.' };
    const count = this.ship.closeDoors(roomId, GAME_CONSTANTS.DOOR_TIME * 1000);
    if (!count) return { error: 'Essa sala não tem portas.' };
    this.push();
    return { ok: true, doors: count };
  }

  /* ============================ reunião / votação ============================ */
  callEmergency(playerId) {
    const p = this.players.get(playerId);
    if (this.state !== 'tasks' || !p?.alive) return { error: 'Não é possível agora.' };
    if (this.settings.emergencyMeetings === 0) return { error: 'Reuniões de emergência desativadas.' };
    if (this.emergencyUsed >= this.settings.emergencyMeetings) return { error: 'Sem reuniões de emergência restantes.' };
    if (Date.now() < this.emergencyCooldownUntil) return { error: 'Botão em cooldown.' };
    if (!this.ship.nearEmergency(p.x, p.y)) return { error: `O botão fica na Cafeteria.` };
    this.emergencyUsed++;
    this.startMeeting(playerId, 'emergency', null);
    return { ok: true };
  }

  startMeeting(callerId, reason, body = null) {
    if (this.state === 'meeting') return;
    const caller = this.players.get(callerId);
    this.state = 'meeting';
    this.emergencyCooldownUntil = Date.now() + this.settings.emergencyCooldown * 1000;
    this.bodies = this.bodies.filter((b) => b.id !== body?.id);
    if (body) this.bodies = [];
    this.sabotage = null;
    this.ship = makeShip(this.settings.map); // portas reabrem

    const now = Date.now();
    this.meeting = {
      callerId,
      callerName: caller?.name || '?',
      reason,
      bodyRoom: body?.room || null,
      startedAt: now,
      discussionUntil: now + this.settings.discussionTime * 1000,
      votingUntil: now + (this.settings.discussionTime + this.settings.votingTime) * 1000,
      phase: this.settings.discussionTime > 0 ? 'discussion' : 'voting',
      ejectedId: null,
      tie: false,
      skipped: false,
    };
    for (const p of this.players.values()) {
      p.votedFor = null;
      p.voted = false;
      p.inVent = false;
      p.ventId = null;
      if (p.alive) {
        const spawn = this.ship.randomSpawn(this.ship.data.spawn.meeting);
        p.x = spawn.x;
        p.y = spawn.y;
        p.moving = false;
      }
    }
    // barra de tarefas: modo "reuniões"
    this.taskBarSnapshot = this.currentTaskProgress();
    this.log.push({
      type: 'meeting',
      text: reason === 'report'
        ? `${caller?.name} reportou o corpo de ${this.players.get(body?.playerId)?.name || '?'}.`
        : `${caller?.name} chamou uma reunião de emergência.`,
    });
    this.scheduleBotVotes();
    this.push();
  }

  scheduleBotVotes() {
    if (this.voteTimer) clearTimeout(this.voteTimer);
    const votingEndsAt = this.meeting?.votingUntil || Infinity;
    this.voteTimer = setTimeout(() => {
      if (this.state !== 'meeting' || !this.meeting) return;
      for (const p of [...this.players.values()]) {
        if (!p.isBot || !p.alive) continue;
        // vota cedo o suficiente para contar: nunca depois do fim da votação
        const latest = Math.max(500, votingEndsAt - Date.now() - 3000);
        const delay = Math.min(rand(1200, 6000), latest);
        setTimeout(() => {
          if (this.state !== 'meeting' || p.voted) return;
          this.vote(p.id, this.botVoteChoice(p));
        }, delay);
      }
    }, Math.max(0, this.settings.discussionTime * 1000 + 800));
  }

  botVoteChoice(bot) {
    const alive = [...this.players.values()].filter((p) => p.alive);
    if (bot.role === 'impostor') {
      // vota em quem não é impostor, evitando companheiros
      const innocents = alive.filter((p) => p.role !== 'impostor');
      if (innocents.length > 0 && Math.random() < 0.85) {
        return innocents[Math.floor(Math.random() * innocents.length)].id;
      }
      return 'skip';
    }
    // tripulante: desconfia de quem estava perto do corpo ou é aleatório
    const suspects = alive.filter((p) => p.id !== bot.id);
    if (suspects.length && Math.random() < 0.7) {
      return suspects[Math.floor(Math.random() * suspects.length)].id;
    }
    return 'skip';
  }

  vote(playerId, targetId) {
    const p = this.players.get(playerId);
    if (this.state !== 'meeting' || !this.meeting) return { error: 'Sem votação ativa.' };
    if (!p || !p.alive) return { error: 'Você não pode votar.' };
    if (p.voted) return { error: 'Você já votou.' };
    if (Date.now() > this.meeting.votingUntil) return { error: 'Votação encerrada.' };
    p.voted = true;
    p.votedFor = targetId;
    const alive = [...this.players.values()].filter((x) => x.alive);
    if (alive.every((x) => x.voted)) setTimeout(() => this.finishMeeting(), 2000);
    this.push();
    return { ok: true };
  }

  skipVote(playerId) {
    return this.vote(playerId, 'skip');
  }

  tickMeeting(now) {
    const m = this.meeting;
    if (!m) return;
    if (m.phase === 'discussion' && now >= m.discussionUntil) {
      m.phase = 'voting';
      this.log.push({ type: 'system', text: 'Votação aberta.' });
      this.push();
    }
    if (now >= m.votingUntil) this.finishMeeting();
  }

  finishMeeting() {
    if (this.state !== 'meeting' || !this.meeting || this.meeting.done) return;
    const m = this.meeting;
    m.done = true;

    const tally = new Map();
    for (const p of this.players.values()) {
      if (!p.alive || !p.voted) continue;
      const t = p.votedFor;
      tally.set(t, (tally.get(t) || 0) + 1);
    }
    const alive = [...this.players.values()].filter((p) => p.alive);
    let topId = null;
    let topCount = 0;
    let tie = false;
    for (const [id, count] of tally.entries()) {
      if (id === 'skip') continue;
      if (count > topCount) {
        topCount = count;
        topId = id;
        tie = false;
      } else if (count === topCount) {
        tie = true;
      }
    }
    const skipCount = tally.get('skip') || 0;
    if (skipCount >= topCount) { topId = null; tie = false; }

    m.ejectedId = tie ? null : topId;
    m.tie = tie;
    m.skipped = !topId && !tie;
    m.voteTally = Object.fromEntries(tally);

    if (m.ejectedId) {
      const ejected = this.players.get(m.ejectedId);
      if (ejected) {
        ejected.alive = false;
        ejected.ejected = true;
        ejected.killedAt = Date.now();
        const reveal = this.settings.confirmImpostor;
        this.log.push({
          type: 'eject',
          text: `${ejected.name} foi ejetado.${reveal ? (ejected.role === 'impostor' ? ' ERA O IMPOSTOR!' : ' Não era o impostor.') : ''}`,
          wasImpostor: reveal ? ejected.role === 'impostor' : null,
        });
      }
    } else if (m.tie) {
      this.log.push({ type: 'system', text: 'Empate: ninguém foi ejetado.' });
    } else {
      this.log.push({ type: 'system', text: 'Ninguém foi ejetado.' });
    }

    this.meetingEndsAt = Date.now() + 5000;
    setTimeout(() => {
      if (this.state !== 'meeting') return;
      this.state = 'tasks';
      this.meeting = null;
      for (const p of this.players.values()) {
        if (p.alive) {
          const spawn = this.ship.randomSpawn();
          p.x = spawn.x;
          p.y = spawn.y;
        }
        p.voted = false;
        p.votedFor = null;
      }
      this.taskBarSnapshot = this.currentTaskProgress();
      this.checkWin();
      this.push();
    }, 5000);
    this.push();
  }

  /* ============================ fim de jogo ============================ */
  checkWin() {
    if (this.state === 'ended') return;
    const alive = [...this.players.values()].filter((p) => p.alive);
    const imps = alive.filter((p) => p.role === 'impostor');
    const crew = alive.filter((p) => p.role === 'crew');
    if (imps.length === 0) return this.endGame('crew', 'Todos os impostores foram eliminados.');
    if (imps.length >= crew.length) return this.endGame('impostor', 'Os impostores são maioria.');

    const progress = this.currentTaskProgress();
    if (progress.total > 0 && progress.done >= progress.total) {
      return this.endGame('crew', 'Todas as tarefas foram concluídas.');
    }
  }

  endGame(winner, reason) {
    if (this.state === 'ended') return;
    this.state = 'ended';
    this.winner = winner;
    this.gameOverReason = reason;
    this.sabotage = null;
    this.stopTicking();
    this.log.push({
      type: 'gameover',
      text: winner === 'crew' ? 'VITÓRIA DOS TRIPULANTES!' : 'VITÓRIA DOS IMPOSTORES!',
      reason,
    });
    this.push();
    setTimeout(() => {
      if (this.state === 'ended') this.backToLobby();
    }, 15000);
  }

  backToLobby() {
    this.state = 'lobby';
    this.winner = null;
    this.meeting = null;
    this.sabotage = null;
    this.bodies = [];
    this.stopTicking();
    this.ship = makeShip(this.settings.map);
    for (const p of this.players.values()) {
      p.alive = true;
      p.role = null;
      p.roleType = null;
      p.tasks = [];
      p.inVent = false;
      p.kills = 0;
      const spawn = this.ship.randomSpawn();
      p.x = spawn.x;
      p.y = spawn.y;
    }
    this.push();
  }

  /* ============================ bots ============================ */
  tickBots(dt, now) {
    for (const p of this.players.values()) {
      if (!p.isBot || !p.alive) continue;
      const bs = p.botState;
      if (p.inVent) { this.exitVent(p.id); continue; }

      if (!bs.goal) {
        bs.goal = this.pickBotGoal(p, now);
        bs.taskUntil = 0;
        if (!bs.goal) continue;
      }
      const goal = bs.goal;
      const d = dist(p, goal);
      const speed = GAME_CONSTANTS.BASE_SPEED * this.settings.playerSpeed * 1.05;

      // rede de segurança: objetivo inalcançável por muito tempo -> troca de plano
      if (!bs.goalSince || bs.goalSince !== bs.goal) { bs.goalSince = bs.goal; bs.goalAt = now; }
      if (now - (bs.goalAt || now) > 25000 && d > 1.5) {
        bs.goal = null; bs.path = null; bs.goalAt = now; bs.stuck = 0;
        continue;
      }

      // marca quando o bot chegou ao console para esperar o tempo da tarefa
      if (goal.type === 'task' && !bs.taskUntil && d < 0.75) bs.taskUntil = now + rand(900, 2200);

      const arriveDist = goal.type === 'kill' ? 0.35 : 0.55;
      if (d > arriveDist) {
        const step = speed * dt;
        // waypoint: se o caminho estiver livre, vai reto; senão segue a rota em grade
        if (!bs.path || bs.pathGoal !== `${goal.x.toFixed(2)},${goal.y.toFixed(2)}` || bs.pathIndex >= (bs.path?.length || 0)) {
          bs.path = this.ship.findPath(p, goal);
          bs.pathIndex = 0;
          bs.pathGoal = `${goal.x.toFixed(2)},${goal.y.toFixed(2)}`;
        }
        const waypoint = bs.path?.[Math.min(bs.pathIndex, (bs.path?.length || 1) - 1)] || goal;
        const wd = Math.hypot(waypoint.x - p.x, waypoint.y - p.y);
        if (wd < 0.35 && bs.pathIndex < (bs.path?.length || 0) - 1) bs.pathIndex++;

        const tw = bs.path?.[Math.min(bs.pathIndex, (bs.path?.length || 1) - 1)] || goal;
        const td = Math.hypot(tw.x - p.x, tw.y - p.y) || 1;
        const dx = ((tw.x - p.x) / td) * step;
        const dy = ((tw.y - p.y) / td) * step;
        const next = this.ship.move(p.x, p.y, dx, dy);
        if (Math.abs(next.x - p.x) < 1e-4 && Math.abs(next.y - p.y) < 1e-4) {
          // desencalhe: tenta os lados
          const angles = [Math.PI / 3, -Math.PI / 3, Math.PI / 2, -Math.PI / 2];
          const a0 = Math.atan2(dy, dx);
          let moved = false;
          for (const off of angles) {
            const alt = this.ship.move(p.x, p.y, Math.cos(a0 + off) * step, Math.sin(a0 + off) * step);
            if (Math.hypot(alt.x - p.x, alt.y - p.y) > 1e-4) { p.x = alt.x; p.y = alt.y; moved = true; break; }
          }
          bs.stuck = moved ? 0 : (bs.stuck || 0) + 1;
          if (bs.stuck > 30) { bs.goal = null; bs.path = null; bs.stuck = 0; }
        } else {
          if (Math.abs(next.x - p.x) > 1e-4) p.facing = next.x > p.x ? 1 : -1;
          p.x = next.x;
          p.y = next.y;
          p.moving = true;
        }
        continue;
      }

      p.moving = false;
      // chegou ao objetivo
      if (goal.type === 'task') {
        const task = this.tasks.find((t) => t.key === goal.taskKey);
        if (task) {
          // "executa" a tarefa por alguns segundos, como um humano faria
          if (!bs.taskUntil) bs.taskUntil = now + rand(900, 2200);
          if (now >= bs.taskUntil) {
            const total = this.taskSteps(task);
            for (let i = 0; i < total; i++) this.advanceTask(p.id, task.key, { consoleId: goal.consoleId, data: 'bot' });
            bs.taskUntil = 0;
          } else {
            continue; // fica no console até concluir
          }
        }
      } else if (goal.type === 'kill') {
        const victim = this.players.get(goal.targetId);
        if (victim?.alive) {
          const r = this.kill(p.id, goal.targetId);
          if (r.error) {
            bs.killError = r.error;
            // se não deu para matar (alcance), tenta de novo em seguida
            bs.idleUntil = now + 300;
            p.killReadyAt = Math.min(p.killReadyAt, now + 500);
          }
        }
      } else if (goal.type === 'report') {
        const body = this.bodies.find((b) => b.id === goal.bodyId);
        if (body) {
          const r = this.report(body.id, p.id);
          if (r.error) bs.reportError = r.error;
        }
      } else if (goal.type === 'fixSabotage') {
        if (this.sabotage) this.fixSabotage(p.id, this.sabotage.roomId);
      }
      bs.goal = null;
      bs.idleUntil = now + rand(60, 220);
    }
  }

  pickBotGoal(p, now) {
    if (now < p.botState.idleUntil) return null;
    const alive = [...this.players.values()].filter((x) => x.alive);
    const imps = alive.filter((x) => x.role === 'impostor');

    // tripulantes consertam sabotagem primeiro
    if (p.role === 'crew' && this.sabotage) {
      const room = this.ship.roomById[this.sabotage.roomId];
      if (room) {
        const pt = consolePointForRoom(room, this.ship);
        // reator exige 2 pessoas: espalha em cantos opostos para não empatar no mesmo ponto
        if (this.sabotage.type === 'reactor') {
          const others = [...this.players.values()].filter((x) => x.isBot && x.role === 'crew' && x.botState?.goal?.type === 'fixSabotage');
          const [rx1, ry1, rx2, ry2] = room.parts[0];
          const side = others.length % 2;
          const tx = side ? rx2 - 1.2 : rx1 + 1.2;
          const ty = side ? ry2 - 1.2 : ry1 + 1.2;
          if (this.ship.roomAt(tx, ty) === room.id) return { x: tx, y: ty, type: 'fixSabotage' };
        }
        return { x: pt.x, y: pt.y, type: 'fixSabotage' };
      }
    }

    // reportar corpos por perto (alcance maior: bots "veem" a sala)
    if (p.role === 'crew') {
      let closest = null;
      const myRoom = this.ship.roomAt(p.x, p.y);
      for (const b of this.bodies) {
        const d = dist(p, b);
        const seen = d < 3 || (myRoom && this.ship.roomAt(b.x, b.y) === myRoom);
        if (seen && (!closest || d < closest.d)) closest = { ...b, d };
      }
      if (closest) return { x: closest.x, y: closest.y, type: 'report', bodyId: closest.id };
    }

    if (p.role === 'impostor') {
      // sabotagem ocasional
      if (!this.sabotage && now > this.sabotageReadyAt && Math.random() < 0.08) {
        const allowed = MAP_SABOTAGES[this.settings.map] || [];
        this.startSabotage(p.id, allowed[Math.floor(Math.random() * allowed.length)]);
      }
      // caça: sempre persegue o tripulante mais próximo quando o kill está pronto
      const victims = alive.filter((x) => x.role === 'crew');
      if (victims.length) {
        const ready = now >= p.killReadyAt;
        // prefere alvos isolados (sem outro tripulante por perto)
        const scored = victims.map((v) => {
          const witnesses = victims.filter((o) => o.id !== v.id && dist(o, v) < 5).length;
          return { v, score: dist(p, v) + witnesses * 12 };
        }).sort((a, b) => a.score - b.score);
        const closest = scored[0].v;
        if (ready) {
          return { x: closest.x, y: closest.y, type: 'kill', targetId: closest.id };
        }
        // sem kill pronto: segue o alvo mais próximo de longe (parece "seguir")
        if (Math.random() < 0.4) return { x: closest.x, y: closest.y, type: 'wander' };
        // sem kill pronto: ronda perto das vítimas
        return { x: closest.x, y: closest.y, type: 'wander' };
      }
      const room = this.ship.rooms[Math.floor(Math.random() * this.ship.rooms.length)];
      const pt = consolePointForRoom(room);
      return { x: pt.x, y: pt.y, type: 'wander' };
    }

    // tripulante: próxima tarefa pendente
    const pending = p.tasks.filter((key) => {
      const t = this.tasks.find((x) => x.key === key);
      return t && !t.completedBy.has(p.id);
    });
    if (!pending.length) {
      const room = this.ship.rooms[Math.floor(Math.random() * this.ship.rooms.length)];
      const pt = consolePointForRoom(room);
      return { x: pt.x, y: pt.y, type: 'wander' };
    }
    // escolhe a tarefa pendente mais próxima, evitando consoles já ocupados
    const busy = new Map();
    for (const other of this.players.values()) {
      if (other.id === p.id || !other.isBot || !other.botState?.goal) continue;
      const g = other.botState.goal;
      if (g.type === 'task' && g.consoleId != null) busy.set(g.consoleId, (busy.get(g.consoleId) || 0) + 1);
    }
    const withPos = pending.map((key) => {
      const t = this.tasks.find((x) => x.key === key);
      const prog = t.progress[p.id] || { step: 0 };
      const c = t.consoles[Math.min(prog.step, t.consoles.length - 1)] || t.consoles[0];
      if (!c) return null;
      const crowd = busy.get(c.id) || 0;
      return { key, c, score: Math.hypot(c.x - p.x, c.y - p.y) * (1 + crowd * 1.8) };
    }).filter(Boolean).sort((a, b) => a.score - b.score);
    if (!withPos.length) return null;
    const pick = withPos[0];
    const key = pick.key;
    const task = this.tasks.find((t) => t.key === key);
    const prog = task.progress[p.id] || { step: 0 };
    const console_ = task.consoles[Math.min(prog.step, task.consoles.length - 1)];
    return { x: console_.x, y: console_.y, type: 'task', taskKey: key, consoleId: console_.id };
  }

  /* ============================ serialização ============================ */
  serialize(forId) {
    const me = this.players.get(forId);
    const isImp = me?.role === 'impostor';
    const now = Date.now();
    const showTaskBar = this.settings.taskBarMode === 0
      ? true
      : this.settings.taskBarMode === 1
        ? this.state === 'meeting' || this.state === 'ended'
        : false;
    const liveProgress = this.currentTaskProgress();

    const myTasks = (me?.tasks || []).map((key) => {
      const t = this.tasks.find((x) => x.key === key);
      if (!t) return null;
      const prog = t.progress[forId] || { step: 0 };
      const stepConsole = t.consoles[Math.min(prog.step, t.consoles.length - 1)] || t.consoles[0];
      return {
        key: t.key,
        name: t.name,
        game: t.game,
        length: t.length,
        consoles: t.consoles,
        room: stepConsole?.room || t.consoles[0]?.room || '',
        target: stepConsole ? { x: stepConsole.x, y: stepConsole.y } : null,
        step: prog.step,
        totalSteps: this.taskSteps(t),
        done: t.completedBy.has(forId),
      };
    }).filter(Boolean);

    const players = [...this.players.values()].map((p) => {
      const revealRole = this.state === 'ended' || p.id === forId || (isImp && p.role === 'impostor');
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        x: p.x,
        y: p.y,
        facing: p.facing,
        moving: p.moving,
        alive: p.alive,
        isBot: p.isBot,
        isHost: p.id === this.hostId,
        role: revealRole ? p.role : null,
        voted: p.voted,
        inVent: p.id === forId ? p.inVent : false,
        ejected: p.ejected || false,
        taskCount: p.tasks?.length || 0,
      };
    });

    return {
      code: this.code,
      state: this.state,
      now,
      hostId: this.hostId,
      round: this.round,
      settings: this.settings,
      ship: {
        mapId: this.settings.map,
        spaces: this.ship.rooms.map((r) => ({
          id: r.id, name: r.name, parts: r.parts, props: r.props || [], radius: r.radius,
        })),
        corridors: this.ship.corridors.map((c) => ({ id: c.id, parts: c.parts })),
        vents: isImp || this.state === 'ended' ? this.ship.data.vents : [],
        doors: this.ship.serializedDoors(),
        emergency: this.ship.emergency,
      },
      you: me ? {
        id: me.id,
        role: me.role,
        roleType: me.roleType,
        alive: me.alive,
        color: me.color,
        tasks: myTasks,
        killReadyAt: me.killReadyAt,
        killCooldownMs: this.settings.killCooldown * 1000,
        kills: me.kills,
        inVent: me.inVent,
        ventId: me.ventId,
        impostorTeammates: isImp
          ? [...this.players.values()].filter((p) => p.role === 'impostor' && p.id !== forId).map((p) => ({ id: p.id, name: p.name, color: p.color }))
          : [],
      } : null,
      players,
      bodies: this.bodies,
      sabotage: this.sabotage ? {
        type: this.sabotage.type,
        endsAt: this.sabotage.endsAt,
        roomId: this.sabotage.roomId,
        fixed: this.sabotage.fixedBy.length,
        required: this.sabotage.requiredFixes,
        name: SABOTAGE_INFO[this.sabotage.type]?.name,
      } : null,
      lightsOut: this.sabotage?.type === 'lights',
      commsDown: this.sabotage?.type === 'comms',
      meeting: this.meeting,
      votes: this.state === 'meeting'
        ? Object.fromEntries([...this.players.values()].filter((p) => p.voted).map((p) => [p.id, this.settings.anonymousVotes && p.id !== forId ? null : p.votedFor]))
        : {},
      myVote: me?.votedFor || null,
      voteTally: this.state === 'meeting' && this.meeting?.done ? this.meeting.voteTally : null,
      taskBar: showTaskBar ? (this.settings.taskBarMode === 0 ? liveProgress : this.taskBarSnapshot) : null,
      taskBarMode: this.settings.taskBarMode,
      taskProgress: this.state === 'ended' ? liveProgress : undefined,
      winner: this.winner,
      gameOverReason: this.gameOverReason,
      emergencyUsed: this.emergencyUsed,
      emergencyLeft: this.settings.emergencyMeetings - this.emergencyUsed,
      sabotageReadyAt: this.sabotageReadyAt,
      log: this.log.slice(-12),
      startedAt: this.startedAt,
    };
  }

  push() {
    this.onUpdate?.();
  }
}

function consolePointForRoom(room, ship) {
  // o centro do bounding box pode cair fora do chão (salas em L): procura o ponto
  // navegável mais próximo do centro
  const [x1, y1, x2, y2] = room.parts[0];
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  if (!ship) return { x: cx, y: cy };
  if (ship.isWalkable(cx, cy) && ship.roomAt(cx, cy) === room.id) return { x: cx, y: cy };
  let best = null;
  let bestD = Infinity;
  for (let x = x1; x <= x2; x += 0.4) {
    for (let y = y1; y <= y2; y += 0.4) {
      if (ship.roomAt(x, y) !== room.id) continue;
      const d = Math.hypot(x - cx, y - cy);
      if (d < bestD) { bestD = d; best = { x, y }; }
    }
  }
  return best || { x: cx, y: cy };
}
