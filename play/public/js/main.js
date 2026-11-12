import { COLORS, COLOR_BY_ID, ROOM_BY_ID, SABOTAGES } from '/shared/config.js';
import { render as renderWorld, renderMinimap, resize, screenToWorld } from './render.js';
import { MINIGAMES } from './minigames.js';

const socket = io({ transports: ['websocket', 'polling'] });
const $ = (id) => document.getElementById(id);

let me = { name: 'Tripulante', color: 'red' };
let state = null;
let clientPos = { x: 450, y: 230 };
let keys = new Set();
let touchStick = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0, dx: 0, dy: 0 };
let lastSent = 0;
let openTaskId = null;
let gameCode = null;
let chatLines = [];
let effectiveMap = null;
let seenLog = [];
let logGameCode = null;

/* ============================ MENU ============================ */
const colorPicker = $('colorPicker');
for (const c of COLORS) {
  const b = document.createElement('button');
  b.className = 'swatch' + (c.id === me.color ? ' selected' : '');
  b.style.background = c.hex;
  b.title = c.name;
  b.dataset.id = c.id;
  b.addEventListener('click', () => {
    me.color = c.id;
    [...colorPicker.children].forEach((x) => x.classList.toggle('selected', x.dataset.id === c.id));
  });
  colorPicker.append(b);
}

function currentName() {
  return ($('nameInput').value || 'Tripulante').trim().slice(0, 14) || 'Tripulante';
}

$('quickBtn').addEventListener('click', () => {
  me.name = currentName();
  socket.emit('quickplay', { name: me.name, color: me.color }, (res) => {
    if (res?.error) return showMenuError(res.error);
    gameCode = res.code;
    enterLobby();
  });
});

$('createBtn').addEventListener('click', () => {
  me.name = currentName();
  socket.emit('create', { name: me.name, color: me.color }, (res) => {
    if (res?.error) return showMenuError(res.error);
    gameCode = res.code;
    enterLobby();
  });
});

$('joinBtn').addEventListener('click', () => {
  me.name = currentName();
  const code = $('codeInput').value.trim().toUpperCase();
  if (code.length < 4) return showMenuError('Digite o código da sala.');
  socket.emit('join', { code, name: me.name, color: me.color }, (res) => {
    if (res?.error) return showMenuError(res.error);
    gameCode = res.code;
    enterLobby();
  });
});

$('codeInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('joinBtn').click(); });

function showMenuError(msg) {
  $('menuError').textContent = msg;
  setTimeout(() => ($('menuError').textContent = ''), 5000);
}

function enterLobby() {
  showScreen('lobby');
  $('lobbyCode').textContent = gameCode;
}

function showScreen(name) {
  for (const s of ['menu', 'lobby', 'game']) $(s).classList.toggle('active', s === name);
}

$('helpMenuBtn').addEventListener('click', () => $('helpModal').classList.remove('hidden'));
$('helpBtn').addEventListener('click', () => $('helpModal').classList.remove('hidden'));
$('helpClose').addEventListener('click', () => $('helpModal').classList.add('hidden'));

$('copyCode').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(gameCode);
    toast('Código copiado: ' + gameCode);
  } catch {
    toast('Código da sala: ' + gameCode);
  }
});

$('leaveBtn').addEventListener('click', () => {
  socket.emit('leave');
  state = null;
  gameCode = null;
  showScreen('menu');
});

/* ============================ LOBBY ============================ */
const isHost = () => !!(state && state.you && state.hostId === state.you.id);

function renderLobby() {
  if (!state) return;
  $('lobbyCode').textContent = state.code;
  const list = $('playerList');
  list.innerHTML = '';
  for (const p of state.players) {
    const li = document.createElement('li');
    const col = COLOR_BY_ID[p.color] || COLORS[0];
    li.innerHTML = `<span class="dot" style="background:${col.hex}"></span><span>${escapeHtml(p.name)}</span>`;
    const tags = document.createElement('span');
    tags.className = 'spacer';
    if (p.isHost) tags.innerHTML += `<span class="tag">HOST</span> `;
    if (p.isBot) tags.innerHTML += `<span class="tag gray">BOT</span> `;
    if (p.id === state.you?.id) tags.innerHTML += `<span class="tag green">VOCÊ</span>`;
    li.append(tags);
    list.append(li);
  }

  const s = state.settings;
  $('setPlayers').value = s.players;
  $('setImpostors').value = s.impostors;
  $('setTasks').value = s.crewTasks;
  $('setMeeting').checked = s.meeting;
  $('valPlayers').textContent = s.players;
  $('valImpostors').textContent = s.impostors;
  $('valTasks').textContent = s.crewTasks;

  const host = isHost();
  for (const id of ['setPlayers', 'setImpostors', 'setTasks', 'setMeeting', 'botsBtn', 'startBtn']) {
    $(id).disabled = !host;
  }
  $('startBtn').textContent = host ? 'Iniciar partida' : 'Aguardando o host...';
}

$('setPlayers').addEventListener('input', (e) => socket.emit('setSettings', { players: +e.target.value }));
$('setImpostors').addEventListener('input', (e) => socket.emit('setSettings', { impostors: +e.target.value }));
$('setTasks').addEventListener('input', (e) => socket.emit('setSettings', { crewTasks: +e.target.value }));
$('setMeeting').addEventListener('change', (e) => socket.emit('setSettings', { meeting: e.target.checked }));
$('botsBtn').addEventListener('click', () => socket.emit('addBots'));
$('startBtn').addEventListener('click', () => {
  socket.emit('start', (res) => { if (res?.error) toast(res.error); });
});

/* ============================ ESTADO ============================ */
socket.on('state', (snap) => {
  const prev = state;
  state = snap;
  if (!snap.you) return;

  if (snap.state === 'lobby') {
    if (!prev || prev.state !== 'lobby') {
      $('endScreen').classList.add('hidden');
      $('meeting').classList.add('hidden');
      closeModal();
      showScreen('lobby');
    }
    renderLobby();
    return;
  }

  if (!$('game').classList.contains('active')) {
    showScreen('game');
    resize();
    clientPos = { x: 450, y: 230 };
  }

  if (snap.map) effectiveMap = snap.map;
  if (snap.emergencyUsed !== undefined) state.emergencyUsed = snap.emergencyUsed;
  updateEventFeed();
  syncLocal(true);
  renderHud();
  renderActions();
  renderMeeting();
  renderEnd();
});

socket.on('toast', (msg) => toast(msg));

/* ============================ ENTRADA ============================ */
window.addEventListener('keydown', (e) => {
  if (document.activeElement?.tagName === 'INPUT') return;
  keys.add(e.key.toLowerCase());
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

const canvasEl = $('canvas');

canvasEl.addEventListener('pointerdown', (e) => {
  if (state?.state !== 'playing' && state?.state !== 'ended') return;
  touchStick.active = true;
  touchStick.id = e.pointerId;
  touchStick.ox = e.clientX;
  touchStick.oy = e.clientY;
  touchStick.x = e.clientX;
  touchStick.y = e.clientY;
  touchStick.dx = 0;
  touchStick.dy = 0;
  canvasEl.setPointerCapture(e.pointerId);
});

canvasEl.addEventListener('pointermove', (e) => {
  if (!touchStick.active || e.pointerId !== touchStick.id) return;
  touchStick.x = e.clientX;
  touchStick.y = e.clientY;
  const max = 52;
  let dx = e.clientX - touchStick.ox;
  let dy = e.clientY - touchStick.oy;
  const d = Math.hypot(dx, dy);
  if (d > max) {
    dx = (dx / d) * max;
    dy = (dy / d) * max;
  }
  touchStick.dx = dx / max;
  touchStick.dy = dy / max;
});

function endTouch(e) {
  if (e && touchStick.id !== null && e.pointerId !== touchStick.id) return;
  touchStick.active = false;
  touchStick.id = null;
  touchStick.dx = 0;
  touchStick.dy = 0;
}
canvasEl.addEventListener('pointerup', endTouch);
canvasEl.addEventListener('pointercancel', endTouch);

setInterval(() => {
  if (!state || (state.state !== 'playing' && state.state !== 'ended')) return;
  const speed = 235;
  let vx = 0;
  let vy = 0;
  if (keys.has('w') || keys.has('arrowup')) vy -= 1;
  if (keys.has('s') || keys.has('arrowdown')) vy += 1;
  if (keys.has('a') || keys.has('arrowleft')) vx -= 1;
  if (keys.has('d') || keys.has('arrowright')) vx += 1;
  if (touchStick.active) {
    vx += touchStick.dx;
    vy += touchStick.dy;
  }

  if (Math.abs(vx) < 0.06 && Math.abs(vy) < 0.06) return;
  const len = Math.hypot(vx, vy) || 1;
  clientPos.x += (vx / len) * speed * 0.05;
  clientPos.y += (vy / len) * speed * 0.05;
  const map = effectiveMap || state.map;
  if (map) {
    clientPos.x = Math.max(18, Math.min(map.width - 18, clientPos.x));
    clientPos.y = Math.max(18, Math.min(map.height - 18, clientPos.y));
  }
  const now = Date.now();
  if (now - lastSent > 45) {
    lastSent = now;
    socket.emit('move', { x: clientPos.x, y: clientPos.y });
  }
}, 50);

function syncLocal(instant) {
  if (!state?.you) return;
  const mine = state.players.find((p) => p.id === state.you.id);
  if (!mine) return;
  if (instant && (Math.abs(mine.x - clientPos.x) > 140 || Math.abs(mine.y - clientPos.y) > 140)) {
    clientPos.x = mine.x;
    clientPos.y = mine.y;
  } else if (Date.now() - lastSent > 350) {
    clientPos.x += (mine.x - clientPos.x) * 0.25;
    clientPos.y += (mine.y - clientPos.y) * 0.25;
  }
}

/* ============================ HUD ============================ */
function myPlayer() {
  return state?.players.find((p) => p.id === state.you?.id) || { x: clientPos.x, y: clientPos.y, facing: 1, moving: false };
}

function renderHud() {
  const you = state.you;
  const mine = myPlayer();
  const badge = $('roleBadge');
  if (!you.alive) {
    badge.textContent = 'FANTASMA';
    badge.className = 'role-badge dead';
  } else if (you.role === 'impostor') {
    badge.textContent = 'IMPOSTOR';
    badge.className = 'role-badge impostor';
  } else {
    badge.textContent = 'TRIPULANTE';
    badge.className = 'role-badge';
  }

  const panel = $('taskPanel');
  const list = $('taskList');
  if (you.role === 'crew' && you.tasks?.length) {
    panel.classList.remove('hidden');
    list.innerHTML = '';
    for (const t of you.tasks) {
      const li = document.createElement('li');
      if (t.done) li.classList.add('done');
      const room = ROOM_BY_ID[t.room]?.name || '';
      li.innerHTML = `<span class="box"></span><span>${escapeHtml(t.name)}</span><span class="roomname">${escapeHtml(room)}</span>`;
      list.append(li);
    }
    const prog = document.createElement('li');
    prog.style.cssText = 'margin-top:4px;color:#8fa2c4;font-size:11px';
    prog.textContent = `Progresso geral: ${state.taskProgress.done}/${state.taskProgress.total}`;
    list.append(prog);
  } else if (you.role === 'impostor') {
    panel.classList.remove('hidden');
    list.innerHTML = `<li style="color:#ff8d99">Mate os tripulantes e sabote a nave.</li>
      <li style="color:#8fa2c4;margin-top:6px">Abates: ${you.kills || 0}</li>
      <li style="color:#8fa2c4">Tarefas deles: ${state.taskProgress.done}/${state.taskProgress.total}</li>
      <li style="color:#ffb3bd;margin-top:6px">Aliados: ${state.players.filter((p) => p.role === 'impostor' && p.id !== you.id).map((p) => escapeHtml(p.name)).join(', ') || 'nenhum (você está sozinho)'}</li>`;
  } else {
    panel.classList.add('hidden');
  }

  const sab = $('sabotagePanel');
  if (state.sabotage) {
    sab.classList.remove('hidden');
    const names = { lights: 'LUZES CORTADAS', reactor: 'REATOR EM COLAPSO', comms: 'COMUNICAÇÃO CAÍDA' };
    $('sabotageTitle').textContent = names[state.sabotage.type] || 'SABOTAGEM';
    const left = Math.max(0, Math.ceil((state.sabotage.endsAt - Date.now()) / 1000));
    $('sabotageTimer').textContent = left + 's';
    const fixRoom = { lights: 'electrical', reactor: 'reactor', comms: 'admin' }[state.sabotage.type];
    const room = ROOM_BY_ID[fixRoom];
    const here = room && Math.abs(mine.x - (room.x + room.w / 2)) < room.w / 2 + 24 && Math.abs(mine.y - (room.y + room.h / 2)) < room.h / 2 + 24;
    const fixBtn = $('fixBtn');
    fixBtn.style.display = you.role === 'impostor' ? 'none' : 'block';
    fixBtn.disabled = !here;
    fixBtn.textContent = here ? 'Consertar sabotagem' : `Vá para ${room?.name || '?'}`;
  } else {
    sab.classList.add('hidden');
  }

  renderMinimap(state);
}

let actionsKey = '';
function renderActions() {
  const bar = $('actionBar');
  const you = state.you;
  const mine = myPlayer();
  const killLeft = Math.max(0, Math.ceil(((you.killReadyAt || 0) - Date.now()) / 500));
  const nearTask = you.role === 'crew' && you.alive ? nearestTask(mine) : null;
  const nearBody = you.alive ? nearestBody(mine) : null;
  const caf = ROOM_BY_ID.cafeteria;
  const inCaf = Math.abs(mine.x - (caf.x + caf.w / 2)) < caf.w / 2 && Math.abs(mine.y - (caf.y + caf.h / 2)) < caf.h / 2;
  const key = [state.state, you.role, you.alive, you.inVent, killLeft, nearTask?.id, nearBody?.id, inCaf].join('|');
  if (key === actionsKey && bar.children.length) {
    updateKillCooldown();
    return;
  }
  actionsKey = key;
  bar.innerHTML = '';
  if (state.state !== 'playing' || !you.alive) return;

  if (you.role === 'impostor') {
    const killBtn = document.createElement('button');
    killBtn.id = 'killBtn';
    killBtn.className = 'btn kill';
    killBtn.addEventListener('click', () => {
      const target = nearestTarget();
      if (!target) return toast('Nenhum tripulante por perto.');
      socket.emit('kill', { targetId: target.id }, (res) => { if (res?.error) toast(res.error); });
    });
    bar.append(killBtn);
    updateKillCooldown();

    const ventBtn = document.createElement('button');
    ventBtn.className = 'btn use';
    ventBtn.textContent = you.inVent ? 'Sair do duto' : 'Entrar no duto';
    ventBtn.addEventListener('click', () => {
      const v = (state.vents || []).reduce((best, cur) => {
        const d = Math.hypot(cur.x - clientPos.x, cur.y - clientPos.y);
        return !best || d < best.d ? { ...cur, d } : best;
      }, null);
      if (!v || v.d > 80) return toast('Nenhum duto por perto.');
      socket.emit('vent', { ventId: v.id });
    });
    bar.append(ventBtn);

    const sabBtn = document.createElement('button');
    sabBtn.className = 'btn';
    sabBtn.textContent = 'Sabotagem';
    sabBtn.addEventListener('click', openSabotageMenu);
    bar.append(sabBtn);
  }

  if (nearTask) {
    const btn = document.createElement('button');
    btn.className = 'btn use';
    btn.textContent = 'Usar: ' + nearTask.name;
    btn.addEventListener('click', () => openTask(nearTask));
    bar.append(btn);
  }

  if (nearBody) {
    const btn = document.createElement('button');
    btn.className = 'btn danger';
    btn.textContent = 'Reportar corpo';
    btn.addEventListener('click', () => socket.emit('report', { bodyId: nearBody.id }));
    bar.append(btn);
  }

  if (state.settings.meeting && inCaf && !state.emergencyUsed) {
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = 'Emergência';
    btn.addEventListener('click', () => socket.emit('emergency'));
    bar.append(btn);
  }
}

function updateKillCooldown() {
  const btn = document.getElementById('killBtn');
  if (!btn || !state?.you) return;
  const left = (state.you.killReadyAt || 0) - Date.now();
  if (left > 0) {
    btn.innerHTML = `Matar <span class="cd">${Math.ceil(left / 1000)}s</span>`;
    btn.disabled = true;
  } else {
    btn.innerHTML = 'Matar';
    btn.disabled = false;
  }
}

function nearestTarget() {
  let best = null;
  for (const p of state.players) {
    if (!p.alive || p.role === 'impostor') continue;
    const d = Math.hypot(p.x - clientPos.x, p.y - clientPos.y);
    if (d < 130 && (!best || d < best.d)) best = { ...p, d };
  }
  return best;
}

function nearestBody(pos) {
  let best = null;
  for (const b of state.bodies || []) {
    const d = Math.hypot(b.x - pos.x, b.y - pos.y);
    if (d < 95 && (!best || d < best.d)) best = { ...b, d };
  }
  return best;
}

function nearestTask(pos) {
  if (!state.you?.tasks) return null;
  let best = null;
  for (const t of state.you.tasks) {
    if (t.done) continue;
    const d = Math.hypot(t.x - pos.x, t.y - pos.y);
    if (d < 105 && (!best || d < best.d)) best = { ...t, d };
  }
  return best;
}

$('fixBtn').addEventListener('click', () => socket.emit('fixSabotage'));

/* ============================ SABOTAGEM ============================ */
function openSabotageMenu() {
  $('modalTitle').textContent = 'Sabotagem';
  $('modalDesc').textContent = 'Escolha o que sabotar. Tripulantes precisam consertar.';
  const body = $('modalBody');
  body.innerHTML = '';
  for (const [id, s] of Object.entries(SABOTAGES)) {
    const b = document.createElement('button');
    b.className = 'btn';
    b.style.cssText = 'display:block;width:100%;margin-bottom:8px;text-align:left';
    b.textContent = s.name;
    b.addEventListener('click', () => {
      socket.emit('sabotage', { type: id });
      closeModal();
    });
    body.append(b);
  }
  $('modalOk').classList.add('hidden');
  $('modal').classList.remove('hidden');
}

/* ============================ TAREFAS ============================ */
function openTask(task) {
  if (openTaskId) return;
  openTaskId = task.id;
  $('modalTitle').textContent = task.name;
  $('modalDesc').textContent = ROOM_BY_ID[task.room]?.name || '';
  const body = $('modalBody');
  body.innerHTML = '';
  const okBtn = $('modalOk');
  okBtn.disabled = true;
  okBtn.classList.remove('hidden');
  okBtn.textContent = 'Concluir';

  const finish = () => {
    okBtn.disabled = false;
    okBtn.textContent = 'Entregar tarefa';
    okBtn.onclick = () => {
      socket.emit('doTask', { taskId: task.id });
      closeModal();
    };
  };

  let el;
  if (task.type === 'progress') el = MINIGAMES.progress({ label: task.name, ms: 3200, onDone: finish });
  else if (task.type === 'card') el = MINIGAMES.card({ onDone: finish });
  else if (task.type === 'asteroids') el = MINIGAMES.asteroids({ onDone: finish, target: 6 });
  else if (task.type === 'multistep') el = MINIGAMES.multistep({ label: 'Executar passo', onDone: finish });
  else if (task.type === 'scan') el = MINIGAMES.scan({ onDone: finish });
  else if (task.type === 'wires') el = MINIGAMES.wires(finish);
  else el = MINIGAMES.progress({ label: 'Processando...', ms: 2500, onDone: finish });

  body.append(el);
  $('modal').classList.remove('hidden');
}

$('modalCancel').addEventListener('click', () => closeModal());
$('modalOk').addEventListener('click', () => closeModal());

function closeModal() {
  const body = $('modalBody');
  if (body.firstElementChild?._cleanup) body.firstElementChild._cleanup();
  body.innerHTML = '';
  $('modal').classList.add('hidden');
  const ok = $('modalOk');
  ok.onclick = null;
  ok.textContent = 'Concluir';
  ok.classList.remove('hidden');
  ok.disabled = true;
  openTaskId = null;
}

/* ============================ REUNIÃO ============================ */
let meetingKey = '';
function renderMeeting() {
  const overlay = $('meeting');
  if (state.state !== 'meeting' || !state.meeting) {
    if (!overlay.classList.contains('hidden')) overlay.classList.add('hidden');
    meetingKey = '';
    return;
  }
  overlay.classList.remove('hidden');
  const m = state.meeting;
  const k = m.callerId + m.reason + m.endsAt;
  if (meetingKey !== k) {
    meetingKey = k;
    chatLines = [];
    $('chatLog').innerHTML = '';
    $('meetingTitle').textContent = m.reason === 'report' ? 'Corpo reportado!' : 'Reunião de emergência';
    $('meetingSub').textContent = `Convocada por ${m.callerName}`;
  }
  const left = Math.max(0, Math.ceil((m.voteEndsAt - Date.now()) / 1000));
  const phaseTxt = m.phase === 'discussion' ? 'Discussão' : 'Votação';
  $('meetingTimer').textContent = `${phaseTxt} · ${left}s`;
  renderVotes();
}

function renderVotes() {
  const list = $('voteList');
  const you = state.you;
  const counts = state.voteCounts || {};
  const already = !!state.myVote;
  list.innerHTML = '';

  if (!you.alive) {
    list.innerHTML = '<li style="opacity:0.65">Você está morto e não vota. Assista à votação.</li>';
    for (const p of state.players) {
      const col = COLOR_BY_ID[p.color] || COLORS[0];
      const li = document.createElement('li');
      li.innerHTML = `<span class="dot" style="background:${col.hex}"></span><span>${escapeHtml(p.name)}</span><span class="tag gray" style="margin-left:auto">${counts[p.id] || 0} voto(s)</span>`;
      list.append(li);
    }
    return;
  }

  for (const p of state.players) {
    if (p.id === you.id) continue;
    const col = COLOR_BY_ID[p.color] || COLORS[0];
    const li = document.createElement('li');
    li.innerHTML = `<span class="dot" style="background:${col.hex}"></span><span>${escapeHtml(p.name)}${p.alive ? '' : ' (morto)'}</span>`;
    if (already) {
      const isMine = state.myVote === p.id;
      li.innerHTML += `<span class="tag${isMine ? ' green' : ' gray'}" style="margin-left:auto">${counts[p.id] || 0} voto(s)</span>`;
    } else {
      const btn = document.createElement('button');
      btn.className = 'mini';
      btn.style.marginLeft = 'auto';
      btn.textContent = 'Votar';
      btn.addEventListener('click', () => socket.emit('vote', { targetId: p.id }));
      li.append(btn);
    }
    list.append(li);
  }

  if (!already) {
    const skip = document.createElement('li');
    skip.innerHTML = '<span class="dot" style="background:#6b7b99"></span><span>Pular voto</span>';
    const btn = document.createElement('button');
    btn.className = 'mini';
    btn.style.marginLeft = 'auto';
    btn.textContent = 'Pular';
    btn.addEventListener('click', () => socket.emit('vote', { targetId: 'skip' }));
    skip.append(btn);
    list.append(skip);
  } else {
    const done = document.createElement('li');
    done.style.opacity = '0.7';
    done.innerHTML = `<span>Votos recebidos: ${state.votesCast || 0}/${state.players.filter((p) => p.alive).length}</span>`;
    list.append(done);
  }
}

$('chatSend').addEventListener('click', sendChat);
$('chatInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });
function sendChat() {
  const text = $('chatInput').value.trim();
  if (!text) return;
  socket.emit('chat', { text });
  $('chatInput').value = '';
}

/* ============================ FIM ============================ */
function renderEnd() {
  const el = $('endScreen');
  if (state.state !== 'ended') {
    el.classList.add('hidden');
    return;
  }
  el.classList.remove('hidden');
  const youWin = (state.winner === 'impostor' && state.you.role === 'impostor') || (state.winner === 'crew' && state.you.role === 'crew');
  $('endTitle').textContent = youWin ? 'VITÓRIA!' : 'DERROTA';
  $('endTitle').style.color = youWin ? '#45e07a' : '#ff5566';
  $('endSub').textContent = state.winner === 'impostor' ? 'Os impostores venceram.' : 'Os tripulantes venceram.';
  $('endLobby').style.display = isHost() ? 'inline-block' : 'none';
}

$('endLobby').addEventListener('click', () => {
  socket.emit('toLobby');
  $('endScreen').classList.add('hidden');
});

/* ============================ LOOP ============================ */
function loop() {
  if (state && $('game').classList.contains('active')) {
    syncLocal(false);
    const mine = myPlayer();
    renderWorld({ ...state, map: effectiveMap || state.map }, { ...state.you, x: clientPos.x, y: clientPos.y }, { x: clientPos.x, y: clientPos.y });
    drawJoystick();
    if (state.state === 'playing') renderActions();
  }
  requestAnimationFrame(loop);
}

function drawJoystick() {
  if (!touchStick.active) return;
  const c = $('canvas');
  const g = c.getContext('2d');
  g.save();
  g.globalAlpha = 0.6;
  g.strokeStyle = '#ffffff';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(touchStick.ox, touchStick.oy, 46, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.28)';
  g.beginPath();
  g.arc(touchStick.ox + touchStick.dx * 46, touchStick.oy + touchStick.dy * 46, 20, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

// hooks de depuração (usados pelos testes automatizados)
window.__lastState = () => state;
Object.defineProperty(window, '__state', { get: () => state });
window.__testMove = (x, y) => {
  clientPos.x = x;
  clientPos.y = y;
  socket.emit('move', { x, y });
};

loop();
window.addEventListener('resize', () => resize());
resize();

/* ============================ feed de eventos ============================ */
function updateEventFeed() {
  const feed = $('eventFeed');
  if (!state) return;
  if (logGameCode !== state.code) {
    logGameCode = state.code;
    seenLog = [];
    feed.innerHTML = '';
  }
  const log = state.log || [];
  // o servidor manda só as últimas linhas; compara por conteúdo e adiciona as novas
  const fresh = log.filter((line, i) => {
    if (!seenLog.includes(line)) return true;
    return i > log.length - 2 && log.filter((l) => l === line).length > seenLog.filter((l) => l === line).length;
  });
  if (!fresh.length) return;
  for (const line of fresh) {
    if (line.includes(':')) continue; // chat tem tratamento próprio
    const el = document.createElement('div');
    el.className = 'ev' +
      (/eliminado|ejetado/i.test(line) ? ' kill' : '') +
      (/VENCERAM/i.test(line) ? ' win' : '');
    el.textContent = line;
    feed.append(el);
    setTimeout(() => el.remove(), 5200);
  }
  while (feed.children.length > 4) feed.firstChild.remove();
  seenLog = [...seenLog, ...fresh].slice(-12);
}

/* ============================ utils ============================ */
let toastTimer;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
