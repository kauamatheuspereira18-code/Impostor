import { COLORS, COLOR_BY_ID, MAP, ROOM_BY_ID, TASKS } from '../shared/config.js';

const TICK_MS = 50;
const PLAYER_SPEED = 210; // unidades de mundo por segundo
const KILL_COOLDOWN_MS = 20000;
const KILL_RANGE = 55;
const TASK_INTERACT_RANGE = 55;
const EMERGENCY_COOLDOWN_MS = 20000;
const MEETING_DISCUSSION_MS = 30000;
const MEETING_VOTE_MS = 45000;
const SABOTAGE_COOLDOWN_MS = 30000;
const VENTS = [
  { id: 'v1', x: 470, y: 200 },
  { id: 'v2', x: 720, y: 250 },
];

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const rand = (min, max) => min + Math.random() * (max - min);
const uid = () => Math.random().toString(36).slice(2, 9);

export class Game {
  constructor(roomCode, onUpdate) {
    this.code = roomCode;
    this.onUpdate = onUpdate;
    this.players = new Map(); // id -> player
    this.hostId = null;
    this.state = 'lobby'; // lobby | playing | meeting | ended
    this.settings = {
      players: 8,
      impostors: 1,
      crewTasks: 4,
      meeting: true,
      speed: 1,
    };
    this.map = MAP;
    this.tasks = []; // tarefas globais (com posição)
    this.bodies = []; // corpos no mapa
    this.sabotage = null; // {type, endsAt, fixedSteps}
    this.lightsOut = false;
    this.votes = new Map();
    this.meeting = null;
    this.endedAt = null;
    this.winner = null;
    this.tickTimer = null;
    this.lastTick = Date.now();
    this.log = [];
    this.emergencyUsed = false;
    this.emergencyAt = 0;
    this.sabotageAt = 0;
    this.freePlay = false;
  }

  // ---------- players ----------
  addPlayer(socketId, name, colorId, isBot = false, botLevel = 'normal') {
    const usedColors = new Set([...this.players.values()].map((p) => p.color));
    let color = colorId && !usedColors.has(colorId) ? colorId : COLORS.find((c) => !usedColors.has(c.id))?.id;
    if (!color) color = COLORS[0].id;

    const spawn = this.randomSpawn();
    const player = {
      id: socketId,
      name: (name || 'Tripulante').slice(0, 14),
      color,
      x: spawn.x,
      y: spawn.y,
      facing: 1,
      moving: false,
      isBot,
      botLevel,
      alive: true,
      role: null, // 'crew' | 'impostor'
      tasks: [],
      tasksDone: 0,
      kills: 0,
      killedAt: null,
      killCooldownEnd: 0,
      inVent: false,
      ventId: null,
      votedFor: null,
      voted: false,
      ready: false,
      connected: true,
      ghostX: spawn.x,
      ghostY: spawn.y,
    };
    this.players.set(socketId, player);
    if (!this.hostId) this.hostId = socketId;
    this.pushUpdate();
    return player;
  }

  removePlayer(id) {
    const p = this.players.get(id);
    if (!p) return;
    this.players.delete(id);
    if (this.hostId === id) {
      this.hostId = [...this.players.values()].find((x) => !x.isBot)?.id || this.players.keys().next().value || null;
    }
    if (this.state === 'playing' || this.state === 'meeting') this.checkWinConditions();
    this.pushUpdate();
  }

  get humanCount() {
    return [...this.players.values()].filter((p) => !p.isBot).length;
  }

  roomAt(x, y) {
    return this.map.rooms.find(
      (r) => r.w > 0 && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h,
    ) || null;
  }

  randomSpawn() {
    const rooms = this.map.rooms.filter((r) => r.w > 0);
    const room = rooms[Math.floor(Math.random() * rooms.length)];
    return {
      x: rand(room.x + 30, room.x + room.w - 30),
      y: rand(room.y + 30, room.y + room.h - 30),
    };
  }

  // ---------- lobby ----------
  setSettings(partial) {
    const s = this.settings;
    if (typeof partial.players === 'number') s.players = clamp(Math.round(partial.players), 4, 15);
    if (typeof partial.impostors === 'number') s.impostors = clamp(Math.round(partial.impostors), 1, 3);
    if (typeof partial.crewTasks === 'number') s.crewTasks = clamp(Math.round(partial.crewTasks), 1, 9);
    if (typeof partial.meeting === 'boolean') s.meeting = partial.meeting;
    this.pushUpdate();
  }

  setReady(id, ready) {
    const p = this.players.get(id);
    if (!p || this.state !== 'lobby') return;
    p.ready = !!ready;
    this.pushUpdate();
  }

  fillWithBots() {
    const target = this.settings.players;
    const humans = [...this.players.values()].filter((p) => !p.isBot);
    const bots = [...this.players.values()].filter((p) => p.isBot);
    if (humans.length + bots.length >= target) return;

    const names = ['Bolinho', 'Pixel', 'Sombra', 'Turbo', 'Zeca', 'Nina', 'Ghost', 'Kiwi', 'Tuco', 'Luna', 'Beta', 'Mimi', 'Foguete', 'Xerife'];
    const levels = ['easy', 'normal', 'normal', 'hard'];
    const need = target - humans.length - bots.length;
    for (let i = 0; i < need; i++) {
      const name = names[(bots.length + i) % names.length] + (i > 11 ? i : '');
      this.addPlayer('bot_' + uid(), name, null, true, levels[Math.floor(Math.random() * levels.length)]);
    }
    this.pushUpdate();
  }

  // ---------- partida ----------
  startGame() {
    const list = [...this.players.values()];
    if (list.length < 3) return { error: 'Precisa de pelo menos 3 jogadores (chame amigos ou use bots).' };
    if (list.length < this.settings.players) this.fillWithBots();

    this.state = 'playing';
    this.bodies = [];
    this.votes.clear();
    this.meeting = null;
    this.sabotage = null;
    this.lightsOut = false;
    this.winner = null;
    this.endedAt = null;
    this.emergencyUsed = false;
    this.emergencyAt = Date.now() + 10000;
    this.sabotageAt = Date.now() + 15000;

    const players = [...this.players.values()];
    const impostorCount = this.settings.impostors;
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const impostors = shuffled.slice(0, impostorCount);

    this.generateTasks();

    for (const p of players) {
      p.alive = true;
      p.role = impostors.some((imp) => imp.id === p.id) ? 'impostor' : 'crew';
      p.tasks = [];
      p.tasksDone = 0;
      p.kills = 0;
      p.killedAt = null;
      p.votedFor = null;
      p.voted = false;
      p.inVent = false;
      p.ventId = null;
      p.ready = false;
      const spawn = this.randomSpawn();
      p.x = spawn.x;
      p.y = spawn.y;
      p.killCooldownEnd = Date.now() + 12000;
    }

    // distribui tarefas (shuffle para não serem sempre as mesmas)
    const taskPool = [...this.tasks].sort(() => Math.random() - 0.5).map((t) => t.id);
    for (const p of players) {
      if (p.role === 'crew') {
        p.tasks = taskPool.slice(0, clamp(this.settings.crewTasks, 1, taskPool.length));
      } else {
        p.tasks = [];
      }
    }

    this.log = [];
    this.log.push('A partida começou!');
    this.startTicking();
    this.pushUpdate();
    return { ok: true };
  }

  generateTasks() {
    const taskDefs = Object.entries(TASKS);
    this.tasks = [];
    let n = 0;
    for (const room of this.map.rooms) {
      if (room.w <= 0) continue;
      const roomTasks = taskDefs.filter(([, t]) => t.room === room.id);
      for (const [key, def] of roomTasks) {
        this.tasks.push({
          id: 'task_' + uid(),
          key,
          ...def,
          x: rand(room.x + 35, room.x + room.w - 35),
          y: rand(room.y + 35, room.y + room.h - 35),
          progress: 0,
          completedBy: [],
          owner: null,
        });
        n++;
      }
    }
    // adiciona tarefas extras se o mapa tiver poucas
    while (n < 14) {
      const room = this.map.rooms.filter((r) => r.w > 0)[n % 10];
      this.tasks.push({
        id: 'task_' + uid(),
        key: 'generic',
        name: 'Tarefa',
        room: room.id,
        type: 'progress',
        x: rand(room.x + 35, room.x + room.w - 35),
        y: rand(room.y + 35, room.y + room.h - 35),
        progress: 0,
        completedBy: [],
        owner: null,
      });
      n++;
    }
  }

  startTicking() {
    if (this.tickTimer) return;
    this.lastTick = Date.now();
    this.tickTimer = setInterval(() => this.tick(), TICK_MS);
  }

  stopTicking() {
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = null;
  }

  tick() {
    const now = Date.now();
    const dt = Math.min(0.2, (now - this.lastTick) / 1000);
    this.lastTick = now;

    if (this.state === 'playing') {
      this.moveBots(dt, now);
      this.botActions(now);
      this.checkSabotage(now);
    } else if (this.state === 'meeting') {
      this.checkMeetingEnd(now);
    }
    this.pushUpdate(true);
  }

  moveBots(dt, now) {
    if (this.state !== 'playing') return;
    for (const p of this.players.values()) {
      if (!p.isBot || !p.alive) continue;
      const target = this.botTarget(p);
      if (!target) continue;
      const dx = target.x - p.x;
      const dy = target.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > 6) {
        const speed = PLAYER_SPEED * dt * (p.botLevel === 'hard' ? 1.05 : p.botLevel === 'easy' ? 0.75 : 0.9);
        p.x += (dx / d) * speed;
        p.y += (dy / d) * speed;
        p.facing = dx >= 0 ? 1 : -1;
        p.moving = true;
      } else {
        p.moving = false;
      }
    }
  }

  botTarget(p) {
    if (!p.botGoal || p.botGoalDone) {
      // escolhe novo objetivo
      if (p.role === 'impostor' && p.alive) {
        const victims = [...this.players.values()].filter((o) => o.alive && o.role !== 'impostor');
        if (victims.length && Math.random() < 0.65) {
          const v = victims[Math.floor(Math.random() * victims.length)];
          p.botGoal = { type: 'kill', x: v.x, y: v.y, target: v.id };
        } else {
          const room = this.map.rooms.filter((r) => r.w > 0)[Math.floor(Math.random() * 10)];
          p.botGoal = { type: 'wander', x: rand(room.x + 30, room.x + room.w - 30), y: rand(room.y + 30, room.y + room.h - 30) };
        }
      } else if (this.sabotage) {
        const roomId = { lights: 'electrical', reactor: 'reactor', comms: 'admin' }[this.sabotage.type];
        const room = this.map.rooms.find((r) => r.id === roomId);
        if (room) {
          p.botGoal = { type: 'fix', x: room.x + room.w / 2, y: room.y + room.h / 2, roomId };
          return p.botGoal;
        }
        const taskId = p.tasks.find((tid) => !this.taskCompletedBy(tid, p.id));
        const task = taskId ? this.tasks.find((t) => t.id === taskId) : null;
        if (task) p.botGoal = { type: 'task', x: task.x, y: task.y, taskId: task.id };
      } else {
        const taskId = p.tasks.find((tid) => !this.taskCompletedBy(tid, p.id));
        const task = taskId ? this.tasks.find((t) => t.id === taskId) : null;
        if (task) p.botGoal = { type: 'task', x: task.x, y: task.y, taskId: task.id };
        else {
          const room = this.map.rooms.filter((r) => r.w > 0)[Math.floor(Math.random() * 10)];
          p.botGoal = { type: 'wander', x: rand(room.x + 30, room.x + room.w - 30), y: rand(room.y + 30, room.y + room.h - 30) };
        }
      }
    }
    return p.botGoal;
  }

  botActions(now) {
    for (const p of this.players.values()) {
      if (!p.isBot || !p.alive || this.state !== 'playing') continue;

      // bots tripulantes reportam corpos que encontram
      if (p.role === 'crew') {
        const body = this.bodies.find((b) => Math.hypot(b.x - p.x, b.y - p.y) < 55);
        if (body && Math.random() < 0.12) {
          this.startMeeting(p.id, 'report');
          return;
        }
      }

      const goal = p.botGoal;
      if (!goal) continue;
      const d = Math.hypot(goal.x - p.x, goal.y - p.y);
      if (d > 45) continue;

      if (goal.type === 'task' && p.role === 'crew') {
        const task = this.tasks.find((t) => t.id === goal.taskId);
        if (task) {
          task.progress = Math.min(100, task.progress + 8 + Math.random() * 10);
          if (task.progress >= 100) {
            this.completeTask(p.id, task.id);
          }
        }
        p.botGoal = null;
      } else if (goal.type === 'fix') {
        this.fixSabotage(p.id, goal.roomId);
        p.botGoal = null;
      } else if (goal.type === 'kill' && p.role === 'impostor') {
        if (!this.sabotage && now > this.sabotageAt && Math.random() < 0.02) {
          this.triggerSabotage(p.id, ['lights', 'comms', 'reactor'][Math.floor(Math.random() * 3)]);
        }
        if (now < p.killCooldownEnd) {
          p.botGoal = null;
          continue;
        }
        const v = this.players.get(goal.target);
        if (v && v.alive && dist(p, v) < KILL_RANGE + 30) {
          this.killPlayer(p.id, v.id);
        }
        p.botGoal = null;
      } else {
        p.botGoal = null;
      }
    }
  }

  // ---------- movimento ----------
  move(id, x, y) {
    const p = this.players.get(id);
    if (!p) return;
    if (this.state !== 'playing' && this.state !== 'ended') return;
    if (p.inVent) return;
    p.x = clamp(x, 5, this.map.width - 5);
    p.y = clamp(y, 5, this.map.height - 5);
    p.moving = true;
    // corpo encontrado automaticamente
    if (p.alive) {
      const body = this.bodies.find((b) => dist(b, p) < 35 && b.foundBy?.includes(p.id) === false);
    }
  }

  completeTask(playerId, taskId) {
    const p = this.players.get(playerId);
    const task = this.tasks.find((t) => t.id === taskId);
    if (!p || !task) return;
    if (!task.completedBy.includes(playerId)) {
      task.completedBy.push(playerId);
      task.progress = 100;
      p.tasksDone++;
      this.log.push(`${p.name} completou uma tarefa.`);
      this.checkWinConditions();
      this.pushUpdate();
    }
  }

  taskCompletedBy(taskId, playerId) {
    const t = this.tasks.find((x) => x.id === taskId);
    return !!t && t.completedBy.includes(playerId);
  }

  // ---------- kill / vents ----------
  killPlayer(killerId, targetId) {
    if (this.state !== 'playing') return { error: 'Partida não está em andamento.' };
    const killer = this.players.get(killerId);
    const target = this.players.get(targetId);
    if (!killer || !target) return { error: 'Jogador não encontrado.' };
    if (killer.role !== 'impostor') return { error: 'Apenas impostores podem matar.' };
    if (!killer.alive) return { error: 'Você está morto.' };
    if (!target.alive) return { error: 'Alvo já está morto.' };
    if (target.role === 'impostor') return { error: 'Esse é seu parceiro de sabotagem.' };
    if (Date.now() < killer.killCooldownEnd) return { error: 'Cooldown de kill ativo.' };
    if (dist(killer, target) > KILL_RANGE + 12) return { error: 'Alvo longe demais.' };

    target.alive = false;
    target.killedAt = Date.now();
    target.moving = false;
    target.killCooldownEnd = 0;
    killer.kills++;
    killer.killCooldownEnd = Date.now() + KILL_COOLDOWN_MS;
    this.bodies.push({ id: 'body_' + uid(), playerId: target.id, color: target.color, name: target.name, x: target.x, y: target.y, at: Date.now() });
    this.log.push(`${target.name} foi eliminado.`);
    this.checkWinConditions();
    this.pushUpdate();
    return { ok: true };
  }

  reportBody(playerId, bodyId) {
    if (this.state !== 'playing') return { error: 'Não é possível reportar agora.' };
    const p = this.players.get(playerId);
    const body = this.bodies.find((b) => b.id === bodyId);
    if (!p || !p.alive) return { error: 'Você não pode reportar.' };
    if (!body || !body.playerId) return { error: 'Corpo inválido.' };
    if (dist(p, body) > 110) return { error: 'Longe demais do corpo.' };
    this.startMeeting(playerId, 'report');
    return { ok: true };
  }

  useVent(playerId, ventId) {
    const p = this.players.get(playerId);
    if (!p || p.role !== 'impostor' || !p.alive || this.state !== 'playing') return;
    const vent = VENTS.find((v) => v.id === ventId);
    if (!vent) return;
    p.inVent = !p.inVent;
    p.ventId = p.inVent ? ventId : null;
    if (p.inVent) {
      p.x = vent.x;
      p.y = vent.y;
    }
    this.pushUpdate();
  }

  // ---------- sabotagem ----------
  triggerSabotage(playerId, type) {
    const p = this.players.get(playerId);
    if (!p || p.role !== 'impostor' || !p.alive || this.state !== 'playing') return { error: 'Apenas impostores vivos podem sabotar.' };
    if (Date.now() < this.sabotageAt) return { error: 'Sabotagem em cooldown.' };
    if (this.sabotage) return { error: 'Já existe uma sabotagem ativa.' };

    const durations = { lights: 25000, reactor: 45000, comms: 35000 };
    if (!durations[type]) return { error: 'Sabotagem inválida.' };

    this.sabotage = { type, endsAt: Date.now() + durations[type], by: playerId, fixed: 0 };
    this.lightsOut = type === 'lights';
    this.sabotageAt = Date.now() + durations[type] + 15000;
    this.log.push(`Sabotagem: ${type}!`);
    this.pushUpdate();
    return { ok: true };
  }

  fixSabotage(playerId, roomId) {
    const p = this.players.get(playerId);
    if (!p || !p.alive || !this.sabotage) return;
    const fixMap = { lights: 'electrical', reactor: 'reactor', comms: 'admin' };
    if (fixMap[this.sabotage.type] !== roomId) return;
    if (this.roomAt(p.x, p.y)?.id !== roomId) return;
    // reator exige 2 tripulantes (ou 2 toques) para estabilizar
    if (this.sabotage.type === 'reactor') {
      this.sabotage.fixed = (this.sabotage.fixed || 0) + 1;
      if (this.sabotage.fixed < 2) {
        this.log.push(`${p.name} segurou uma alavanca do reator.`);
        this.pushUpdate();
        return;
      }
    }
    this.clearSabotage();
  }

  clearSabotage() {
    this.sabotage = null;
    this.lightsOut = false;
    this.sabotageAt = Date.now() + SABOTAGE_COOLDOWN_MS;
    this.log.push('Sabotagem resolvida.');
    this.pushUpdate();
  }

  checkSabotage(now) {
    if (!this.sabotage) return;
    if (now >= this.sabotage.endsAt) {
      // sabotagem não resolvida: impostores vencem (exceto luzes)
      if (this.sabotage.type === 'reactor' || this.sabotage.type === 'comms') {
        this.endGame('impostor', 'A sabotagem não foi consertada a tempo.');
      } else {
        this.clearSabotage();
      }
    }
  }

  // ---------- reunião ----------
  callEmergency(playerId) {
    const p = this.players.get(playerId);
    if (!p || !p.alive || this.state !== 'playing') return { error: 'Não é possível agora.' };
    if (!this.settings.meeting) return { error: 'Botão de emergência desativado nesta partida.' };
    if (this.roomAt(p.x, p.y)?.id !== 'cafeteria') return { error: 'O botão fica na Cafeteria.' };
    if (this.emergencyUsed) return { error: 'Botão de emergência já usado.' };
    if (Date.now() < this.emergencyAt) return { error: 'Botão em cooldown.' };
    this.emergencyUsed = true;
    this.emergencyAt = Date.now() + EMERGENCY_COOLDOWN_MS;
    this.startMeeting(playerId, 'emergency');
  }

  startMeeting(callerId, reason) {
    if (this.state === 'meeting') return;
    const caller = this.players.get(callerId);
    this.state = 'meeting';
    this.sabotage = null;
    this.lightsOut = false;
    this.bodies = [];
    this.meeting = {
      callerId,
      callerName: caller?.name || 'Alguém',
      reason,
      endsAt: Date.now() + MEETING_DISCUSSION_MS,
      votingAt: Date.now() + MEETING_DISCUSSION_MS,
      voteEndsAt: Date.now() + MEETING_DISCUSSION_MS + MEETING_VOTE_MS,
      phase: 'discussion',
    };
    this.votes.clear();
    for (const pl of this.players.values()) {
      pl.votedFor = null;
      pl.voted = false;
    }
    // bots votam depois de um tempo
    this.scheduleBotVotes();
    this.log.push(`${this.meeting.callerName} ${reason === 'report' ? 'reportou um corpo' : 'chamou uma reunião de emergência'}.`);
    this.pushUpdate();
  }

  scheduleBotVotes() {
    setTimeout(() => {
      if (this.state !== 'meeting') return;
      for (const p of this.players.values()) {
        if (!p.isBot || !p.alive) continue;
        setTimeout(() => {
          if (this.state !== 'meeting' || p.voted) return;
          this.castVote(p.id, this.botVoteChoice(p));
        }, rand(800, 5000));
      }
    }, MEETING_DISCUSSION_MS + 1200);
  }

  botVoteChoice(bot) {
    const alive = [...this.players.values()].filter((p) => p.alive);
    if (bot.role === 'impostor') {
      const innocents = alive.filter((p) => p.role !== 'impostor' && p.id !== bot.id);
      if (innocents.length) return innocents[Math.floor(Math.random() * innocents.length)].id;
    } else {
      const suspects = alive.filter((p) => p.id !== bot.id);
      if (suspects.length && Math.random() < 0.6) return suspects[Math.floor(Math.random() * suspects.length)].id;
    }
    return 'skip';
  }

  castVote(playerId, targetId) {
    if (this.state !== 'meeting') return { error: 'Sem votação ativa.' };
    const p = this.players.get(playerId);
    if (!p || !p.alive || p.voted) return { error: 'Voto não permitido.' };
    p.voted = true;
    p.votedFor = targetId;
    this.votes.set(playerId, targetId);
    // se todos votaram, encerra antes
    const alive = [...this.players.values()].filter((x) => x.alive);
    if (this.votes.size >= alive.length) {
      setTimeout(() => this.finishMeeting(), 2500);
    }
    this.pushUpdate();
    return { ok: true };
  }

  tallyVotes() {
    const counts = {};
    for (const [voter, target] of this.votes.entries()) {
      if (!this.players.get(voter)?.alive) continue;
      counts[target] = (counts[target] || 0) + 1;
    }
    return counts;
  }

  checkMeetingEnd(now) {
    if (!this.meeting) return;
    if (this.meeting.phase === 'discussion' && now >= this.meeting.votingAt) {
      this.meeting.phase = 'voting';
      this.log.push('Votação aberta.');
      this.pushUpdate();
    }
    if (now >= this.meeting.voteEndsAt) this.finishMeeting();
  }

  finishMeeting() {
    if (this.state !== 'meeting' || this.finishedMeeting) return;
    this.finishedMeeting = true;
    const tally = new Map();
    for (const [voter, target] of this.votes.entries()) {
      if (!this.players.get(voter)?.alive) continue;
      tally.set(target, (tally.get(target) || 0) + 1);
    }
    let ejected = null;
    let top = 0;
    let tie = false;
    for (const [target, count] of tally.entries()) {
      if (count > top) {
        top = count;
        ejected = target;
        tie = false;
      } else if (count === top) tie = true;
    }
    if (ejected === 'skip' || tie) ejected = null;
    const result = { ejectedId: ejected, tie, votes: [...tally.entries()] };
    this.lastMeetingResult = result;

    if (ejected) {
      const p = this.players.get(ejected);
      if (p) {
        p.alive = false;
        p.killedAt = Date.now();
        p.ejected = true;
        this.log.push(`${p.name} foi ejetado. ${p.role === 'impostor' ? 'ERA O IMPOSTOR!' : 'Não era o impostor.'}`);
      }
    } else {
      this.log.push('Ninguém foi ejetado.');
    }

    this.state = 'playing';
    this.meeting = null;
    this.votes.clear();
    this.finishedMeeting = false;
    this.emergencyAt = Date.now() + 10000;
    // recoloca vivos em spawns
    for (const p of this.players.values()) {
      if (p.alive) {
        const spawn = this.randomSpawn();
        p.x = spawn.x;
        p.y = spawn.y;
      }
    }
    this.checkWinConditions();
    this.pushUpdate();
  }

  // ---------- condições de vitória ----------
  checkWinConditions() {
    if (this.state === 'ended') return;
    const alive = [...this.players.values()].filter((p) => p.alive);
    const aliveImpostors = alive.filter((p) => p.role === 'impostor');
    const aliveCrew = alive.filter((p) => p.role === 'crew');
    if (aliveImpostors.length === 0) {
      this.endGame('crew', 'Todos os impostores foram eliminados.');
      return;
    }
    if (aliveImpostors.length >= aliveCrew.length) {
      this.endGame('impostor', 'Os impostores igualaram o número de tripulantes.');
      return;
    }
    const crewPlayers = [...this.players.values()].filter((p) => p.role === 'crew');
    const totalTasks = crewPlayers.length * this.settings.crewTasks;
    const doneTasks = crewPlayers.reduce((acc, p) => acc + p.tasksDone, 0);
    if (totalTasks > 0 && doneTasks >= totalTasks) {
      this.endGame('crew', 'Todos os tripulantes completaram as tarefas.');
    }
  }

  endGame(winner, reason) {
    if (this.state === 'ended') return;
    this.state = 'ended';
    this.winner = winner;
    this.endedAt = Date.now();
    this.stopTicking();
    this.log.push(winner === 'crew' ? 'TRIPULANTES VENCERAM!' : 'IMPOSTORES VENCERAM!');
    this.pushUpdate();
    setTimeout(() => {
      if (this.state === 'ended' && this.players.size > 0) {
        this.returnToLobby();
      }
    }, 12000);
  }

  returnToLobby() {
    this.state = 'lobby';
    this.bodies = [];
    this.sabotage = null;
    this.lightsOut = false;
    this.meeting = null;
    this.winner = null;
    this.stopTicking();
    for (const p of this.players.values()) {
      p.alive = true;
      p.role = null;
      p.tasks = [];
      p.tasksDone = 0;
      p.kills = 0;
      p.ready = p.isBot ? true : false;
      p.inVent = false;
    }
    this.pushUpdate();
  }

  // ---------- serialização ----------
  serialize(forId) {
    const me = this.players.get(forId);
    const viewerIsImpostor = me?.role === 'impostor';
    const now = Date.now();
    const players = [...this.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      x: p.x,
      y: p.y,
      facing: p.facing,
      moving: p.moving,
      alive: p.alive,
      role:
        p.id === forId || this.state === 'ended' || (viewerIsImpostor && p.role === 'impostor')
          ? p.role
          : null,
      isBot: p.isBot,
      kills: p.id === forId ? p.kills : undefined,
      votedFor: p.voted && p.id !== forId ? p.votedFor : undefined,
      voted: p.voted,
      ready: p.ready,
      isHost: p.id === this.hostId,
      ejected: p.ejected || false,
    }));

    const myTasks = (me?.tasks || []).map((tid) => {
      const t = this.tasks.find((x) => x.id === tid);
      return t ? { id: t.id, name: t.name, room: t.room, type: t.type, x: t.x, y: t.y, done: t.completedBy.includes(forId), progress: t.progress } : null;
    }).filter(Boolean);

    const globalTasks = this.state === 'lobby' ? [] : this.tasks.map((t) => ({ id: t.id, name: t.name, room: t.room, type: t.type, x: t.x, y: t.y }));

    const crewPlayers = [...this.players.values()].filter((p) => p.role === 'crew');
    const totalTasks = crewPlayers.length * this.settings.crewTasks;
    const doneTasks = crewPlayers.reduce((acc, p) => acc + p.tasksDone, 0);

    return {
      code: this.code,
      state: this.state,
      hostId: this.hostId,
      settings: this.settings,
      map: this.map,
      you: me ? { id: me.id, role: me.role, alive: me.alive, tasks: myTasks, killReadyAt: me.killCooldownEnd, kills: me.kills, inVent: me.inVent } : null,
      players,
      tasks: globalTasks,
      bodies: this.bodies,
      sabotage: this.sabotage ? { type: this.sabotage.type, endsAt: this.sabotage.endsAt, fixed: this.sabotage.fixed || 0 } : null,
      lightsOut: this.lightsOut,
      emergencyUsed: this.emergencyUsed,
      meeting: this.meeting,
      voteCounts: this.state === 'meeting' ? this.tallyVotes() : {},
      myVote: this.votes.get(forId) || null,
      votesCast: this.votes.size,
      taskProgress: { done: doneTasks, total: totalTasks },
      winner: this.winner,
      log: this.log.slice(-6),
      now,
      vents: VENTS,
      endedAt: this.endedAt,
    };
  }

  pushUpdate() {
    this.onUpdate?.();
  }
}
