import { GAME_CONSTANTS, RULE_PRESETS, SABOTAGE_INFO, MAP_SABOTAGES } from '/shared/rules.js';
import { Renderer } from './renderer.js';
import { TASK_GAMES } from './tasks.js';

const $ = (id) => document.getElementById(id);
const socket = io({ transports: ['websocket', 'polling'] });

/** estado global do cliente */
const C = {
  me: { name: 'Tripulante', color: 0 },
  state: null,
  code: null,
  keys: new Set(),
  pointer: { active: false, id: null, ox: 0, oy: 0, dx: 0, dy: 0 },
  local: { x: -0.72, y: 0.62 },
  taskOpen: null,
  taskGame: null,
  lastSent: 0,
  feedSeen: new Set(),
  colors: [],
  info: null,
  chatLines: [],
  meetingKey: null,
  joinedAt: 0,
};

const renderer = new Renderer($('gameCanvas'));
window.addEventListener('resize', () => renderer.resize());

/* ================================================================
   Boot: recebe dados do servidor (cores, presets, versão)
   ================================================================ */
window.__state = () => C.state;
window.__testMove = (x, y) => { C.local.x = x; C.local.y = y; socket.emit('move', { x, y }); };

socket.on('hello', (info) => {
  C.info = info;
  C.colors = info.colors;
  $('dataVersion').textContent = `dados do jogo ${info.gameDataVersion}`;
  buildColorGrid();
  buildPresets();
});

socket.on('toast', (msg) => toast(msg));

function buildColorGrid() {
  const grid = $('colorGrid');
  grid.innerHTML = '';
  for (const c of C.colors) {
    const b = document.createElement('button');
    b.className = 'color-swatch' + (c.id === C.me.color ? ' selected' : '');
    b.style.background = c.hex;
    b.title = c.name;
    b.dataset.color = c.id;
    b.addEventListener('click', () => {
      C.me.color = c.id;
      grid.querySelectorAll('.color-swatch').forEach((x) => x.classList.toggle('selected', +x.dataset.color === c.id));
    });
    grid.append(b);
  }
}

function buildPresets() {
  const row = $('presetRow');
  row.innerHTML = '';
  for (const [key, preset] of Object.entries(C.info?.presets || RULE_PRESETS)) {
    const b = document.createElement('button');
    b.className = 'preset-btn';
    b.dataset.preset = key;
    b.textContent = preset.label;
    b.addEventListener('click', () => {
      emit('setSettings', { preset: key }, () => {
        row.querySelectorAll('.preset-btn').forEach((x) => x.classList.toggle('active', x === b));
      });
    });
    row.append(b);
  }
}

/* ================================================================
   Ações da tela inicial
   ================================================================ */
function nameValue() {
  return ($('nameInput').value || 'Tripulante').trim().slice(0, 12) || 'Tripulante';
}

$('btnSolo').addEventListener('click', () => {
  C.me.name = nameValue();
  socket.emit('solo', { name: C.me.name, color: C.me.color }, (res) => {
    if (res?.error) return showHomeError(res.error);
    onJoined(res);
  });
});

$('btnCreate').addEventListener('click', () => {
  C.me.name = nameValue();
  socket.emit('create', { name: C.me.name, color: C.me.color }, (res) => {
    if (res?.error) return showHomeError(res.error);
    onJoined(res);
  });
});

$('btnJoin').addEventListener('click', () => {
  C.me.name = nameValue();
  const code = $('codeInput').value.trim().toUpperCase();
  if (code.length < 3) return showHomeError('Digite o código da sala.');
  socket.emit('join', { code, name: C.me.name, color: C.me.color }, (res) => {
    if (res?.error) return showHomeError(res.error);
    onJoined(res);
  });
});

$('codeInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btnJoin').click(); });
$('nameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btnSolo').click(); });

function showHomeError(msg) {
  $('homeError').textContent = msg;
  setTimeout(() => { if ($('homeError').textContent === msg) $('homeError').textContent = ''; }, 4500);
}

function onJoined(res) {
  C.code = res.code;
  if (typeof res.color === 'number') C.me.color = res.color;
  C.joinedAt = Date.now();
  $('lobbyCode').textContent = res.code;
}

$('btnCopy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(C.code);
    toast('Código copiado: ' + C.code);
  } catch {
    toast('Código: ' + C.code);
  }
});

$('btnLeave').addEventListener('click', () => {
  socket.emit('leave');
  C.state = null;
  C.code = null;
  showScreen('home');
});

$('btnHelp').addEventListener('click', () => $('helpModal').removeAttribute('hidden'));
$('helpClose').addEventListener('click', () => $('helpModal').setAttribute('hidden', ''));

function showScreen(name) {
  for (const s of ['home', 'lobby', 'game']) {
    $('screen-' + s).classList.toggle('active', s === name);
  }
}

/* ================================================================
   Estado vindo do servidor
   ================================================================ */
socket.on('state', (state) => {
  const prev = C.state;
  C.state = state;
  if (!state.you) return;

  if (state.state === 'lobby') {
    if (!prev || prev.state !== 'lobby') {
      closeTask();
      $('meeting').setAttribute('hidden', '');
      $('gameOver').setAttribute('hidden', '');
      C.local = { x: state.players.find((p) => p.id === state.you.id)?.x ?? 0, y: state.players.find((p) => p.id === state.you.id)?.y ?? 0 };
      showScreen('lobby');
    }
    renderLobby(state);
    return;
  }

  if (!$('screen-game').classList.contains('active')) {
    showScreen('game');
    renderer.resize();
    const meP = state.players.find((p) => p.id === state.you.id);
    if (meP) C.local = { x: meP.x, y: meP.y };
    if (prev?.state === 'lobby' || !prev) toast('A partida começou!');
  }

  renderHud(state);
  renderMeeting(state);
  renderGameOver(state);
  updateFeed(state);
});

/* ================================================================
   LOBBY
   ================================================================ */
function renderLobby(state) {
  const isHost = state.hostId === state.you.id;
  $('lobbyCode').textContent = state.code;
  $('playerCounter').textContent = `${state.players.length}/${state.settings.maxPlayers}`;
  $('hostBadge').hidden = !isHost;

  const ul = $('lobbyPlayers');
  ul.innerHTML = '';
  for (const p of state.players) {
    const li = document.createElement('li');
    const bean = document.createElement('span');
    bean.className = 'mini-bean';
    bean.style.background = (C.colors.find((c) => c.id === p.color)?.hex) || '#888';
    const who = document.createElement('span');
    who.className = 'who';
    who.textContent = p.name;
    const badges = document.createElement('span');
    badges.className = 'badges';
    if (p.isHost) badges.innerHTML += '<span class="badge badge-host">HOST</span>';
    if (p.isBot) badges.innerHTML += '<span class="badge badge-bot">BOT</span>';
    if (p.id === state.you.id) badges.innerHTML += '<span class="badge badge-you">VOCÊ</span>';
    li.append(bean, who, badges);
    ul.append(li);
  }
  // slots vazios até o máximo
  for (let i = state.players.length; i < Math.min(state.settings.maxPlayers, 15); i++) {
    const li = document.createElement('li');
    li.innerHTML = '<span class="mini-bean"></span><span class="who" style="color:#43536e">aguardando...</span><span class="badges"><span class="badge badge-empty">VAZIO</span></span>';
    li.querySelector('.mini-bean').style.background = 'repeating-linear-gradient(45deg,#1a2434,#1a2434 4px,#131c28 4px,#131c28 8px)';
    ul.append(li);
  }

  buildMapRow(state, isHost);
  buildSettings(state, isHost);

  $('btnStart').disabled = !isHost;
  $('btnStart').textContent = isHost ? 'Iniciar partida' : 'Aguardando o host...';
  $('btnAddBots').disabled = !isHost;
  $('btnClearBots').disabled = !isHost;
  for (const b of document.querySelectorAll('.preset-btn, .map-btn')) b.disabled = !isHost;
}

function buildMapRow(state, isHost) {
  const row = $('mapRow');
  if (row.dataset.map === state.settings.map && row.dataset.host === String(isHost)) return;
  row.dataset.map = state.settings.map;
  row.dataset.host = String(isHost);
  row.innerHTML = '';
  const maps = [
    { id: 'skeld', label: 'The Skeld', available: true },
    { id: 'mira', label: 'Mira HQ', available: false },
    { id: 'polus', label: 'Polus', available: false },
    { id: 'airship', label: 'Airship', available: false },
    { id: 'fungle', label: 'Fungle', available: false },
  ];
  for (const m of maps) {
    const b = document.createElement('button');
    b.className = 'map-btn' + (m.id === state.settings.map ? ' active' : '');
    b.textContent = m.available ? m.label : m.label + ' 🔒';
    b.disabled = !isHost || !m.available;
    b.title = m.available ? '' : 'Dados do mapa já estão no repositório, geometria jogável em breve';
    b.addEventListener('click', () => emit('setSettings', { patch: { map: m.id } }));
    row.append(b);
  }
}

const SETTINGS_DEFS = [
  { key: 'maxPlayers', label: 'Jogadores', min: 4, max: 15, step: 1, fmt: (v) => v },
  { key: 'numImpostors', label: 'Impostores', min: 1, max: 3, step: 1, fmt: (v) => v },
  { key: 'killCooldown', label: 'Cooldown de kill', min: 10, max: 60, step: 1, fmt: (v) => `${v}s` },
  { key: 'playerSpeed', label: 'Velocidade', min: 0.5, max: 2, step: 0.05, fmt: (v) => `${v.toFixed(2)}x` },
  { key: 'crewVision', label: 'Visão (tripulante)', min: 0.3, max: 1.5, step: 0.05, fmt: (v) => `${v.toFixed(2)}x` },
  { key: 'impostorVision', label: 'Visão (impostor)', min: 0.8, max: 3, step: 0.05, fmt: (v) => `${v.toFixed(2)}x` },
  { key: 'killDistance', label: 'Distância de kill', min: 0, max: 2, step: 1, fmt: (v) => ['Curta', 'Média', 'Longa'][v] },
  { key: 'discussionTime', label: 'Discução', min: 0, max: 120, step: 5, fmt: (v) => `${v}s` },
  { key: 'votingTime', label: 'Votação', min: 30, max: 300, step: 15, fmt: (v) => `${v}s` },
  { key: 'numCommonTasks', label: 'Tarefas comuns', min: 0, max: 4, step: 1, fmt: (v) => v },
  { key: 'numLongTasks', label: 'Tarefas longas', min: 0, max: 4, step: 1, fmt: (v) => v },
  { key: 'numShortTasks', label: 'Tarefas curtas', min: 0, max: 6, step: 1, fmt: (v) => v },
  { key: 'emergencyMeetings', label: 'Reuniões de emergência', min: 0, max: 9, step: 1, fmt: (v) => (v === 0 ? 'Nenhuma' : v) },
  { key: 'emergencyCooldown', label: 'Cooldown da emergência', min: 0, max: 60, step: 5, fmt: (v) => `${v}s` },
];
const TOGGLES = [
  { key: 'confirmImpostor', label: 'Confirmar impostor na ejeção' },
  { key: 'anonymousVotes', label: 'Votos anônimos' },
  { key: 'visualTasks', label: 'Tarefas visuais' },
  { key: 'ghostsDoTasks', label: 'Fantasmas fazem tarefas' },
];

function buildSettings(state, isHost) {
  const list = $('settingsList');
  const sig = JSON.stringify(state.settings) + isHost;
  if (list.dataset.sig === sig) return;
  list.dataset.sig = sig;
  list.innerHTML = '';

  const barModes = ['Sempre visível', 'Somente em reuniões', 'Nunca'];
  const barControl = el('div', 'setting-row');
  barControl.innerHTML = `
    <div class="setting-head"><span>Barra de tarefas</span><b>${barModes[state.settings.taskBarMode]}</b></div>
    <div class="preset-row" style="margin:6px 0 0">
      ${barModes.map((m, i) => `<button class="preset-btn ${state.settings.taskBarMode === i ? 'active' : ''}" data-bar="${i}">${m.split(' ')[0]}</button>`).join('')}
    </div>`;
  barControl.querySelectorAll('[data-bar]').forEach((b) => {
    b.disabled = !isHost;
    b.addEventListener('click', () => emit('setSettings', { patch: { taskBarMode: +b.dataset.bar } }));
  });
  list.append(barControl);

  for (const def of SETTINGS_DEFS) {
    const row = el('div', 'setting-row');
    const value = state.settings[def.key];
    row.innerHTML = `
      <div class="setting-head"><span>${def.label}</span><b>${def.fmt(value)}</b></div>
      <input type="range" min="${def.min}" max="${def.max}" step="${def.step}" value="${value}" ${isHost ? '' : 'disabled'} />`;
    const input = row.querySelector('input');
    input.addEventListener('input', () => { row.querySelector('b').textContent = def.fmt(+input.value); });
    input.addEventListener('change', () => emit('setSettings', { patch: { [def.key]: +input.value } }));
    list.append(row);
  }

  for (const t of TOGGLES) {
    const row = el('div', 'setting-row toggle');
    row.innerHTML = `<div class="setting-head"><span>${t.label}</span></div>
      <button class="toggle-switch ${state.settings[t.key] ? 'on' : ''}"></button>`;
    const sw = row.querySelector('.toggle-switch');
    sw.disabled = !isHost;
    if (!isHost) sw.style.opacity = '0.5';
    sw.addEventListener('click', () => emit('setSettings', { patch: { [t.key]: !state.settings[t.key] } }));
    list.append(row);
  }
}

function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
}

$('btnAddBots').addEventListener('click', () => emit('addBots'));
$('btnClearBots').addEventListener('click', () => emit('clearBots'));
$('btnStart').addEventListener('click', () => emit('start', {}, (res) => { if (res?.error) toast(res.error); }));

function emit(ev, payload, cb) {
  if (typeof payload === 'function') { socket.emit(ev, payload); return; }
  socket.emit(ev, payload, (res) => {
    if (res?.error) toast(res.error);
    cb?.(res);
  });
}

/* ================================================================
   CONTROLES DE MOVIMENTO
   ================================================================ */
window.addEventListener('keydown', (e) => {
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
  C.keys.add(e.key.toLowerCase());
  if (e.key === 'e' || e.key === ' ') { e.preventDefault(); $('btnUse').click(); }
  if (e.key === 'q') $('btnKill').click();
  if (e.key === 'r') $('btnReport').click();
  if (e.key === 'f') $('btnSabotage').click();
});
window.addEventListener('keyup', (e) => C.keys.delete(e.key.toLowerCase()));

const canvas = $('gameCanvas');
canvas.addEventListener('pointerdown', (e) => {
  if (C.state?.state !== 'tasks') return;
  C.pointer = { active: true, id: e.pointerId, ox: e.clientX, oy: e.clientY, dx: 0, dy: 0 };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!C.pointer.active || e.pointerId !== C.pointer.id) return;
  const max = 55;
  let dx = e.clientX - C.pointer.ox;
  let dy = e.clientY - C.pointer.oy;
  const d = Math.hypot(dx, dy);
  if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max; }
  C.pointer.dx = dx / max;
  C.pointer.dy = dy / max;
});
const endPointer = () => { C.pointer.active = false; C.pointer.dx = 0; C.pointer.dy = 0; };
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

setInterval(() => {
  const st = C.state;
  if (!st || st.state !== 'tasks') return;
  const me = st.players.find((p) => p.id === st.you.id);
  if (!me || !me.alive) return;

  let vx = 0;
  let vy = 0;
  if (C.keys.has('w') || C.keys.has('arrowup')) vy += 1;
  if (C.keys.has('s') || C.keys.has('arrowdown')) vy -= 1;
  if (C.keys.has('a') || C.keys.has('arrowleft')) vx -= 1;
  if (C.keys.has('d') || C.keys.has('arrowright')) vx += 1;
  if (C.pointer.active) { vx += C.pointer.dx; vy -= C.pointer.dy; }

  if (me.inVent) return;
  if (Math.abs(vx) < 0.06 && Math.abs(vy) < 0.06) return;

  const len = Math.hypot(vx, vy) || 1;
  const speed = GAME_CONSTANTS.BASE_SPEED * st.settings.playerSpeed;
  C.local.x += (vx / len) * speed * 0.05;
  C.local.y += (vy / len) * speed * 0.05;

  const now = Date.now();
  if (now - C.lastSent > 50) {
    C.lastSent = now;
    socket.emit('move', { x: C.local.x, y: C.local.y });
  }
}, 50);

/* reconciliação com o servidor */
function syncLocal(me) {
  if (!me) return;
  if (me.inVent) { C.local.x = me.x; C.local.y = me.y; return; }
  const d = Math.hypot(me.x - C.local.x, me.y - C.local.y);
  if (d > 2.5) { C.local.x = me.x; C.local.y = me.y; return; }
  if (Date.now() - C.lastSent > 300) {
    C.local.x += (me.x - C.local.x) * 0.25;
    C.local.y += (me.y - C.local.y) * 0.25;
  }
}

/* ================================================================
   GEOMETRIA / LOOP DE RENDER
   ================================================================ */
/** Ponto dentro da planta da sala (polígonos). */
function pointInRoom(room, x, y) {
  for (const shape of room.shapes || []) {
    const pts = shape.points || [];
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) return true;
  }
  return false;
}

let lastFrame = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  const st = C.state;
  if (st && $('screen-game').classList.contains('active')) {
    const me = st.players.find((p) => p.id === st.you?.id);
    if (me) {
      syncLocal(me);
      renderer.follow({ x: C.local.x, y: C.local.y });
      const meForRender = { ...st.you, x: C.local.x, y: C.local.y };
      // passa as posições locais suavizadas para o render
      const players = st.players.map((p) => (p.id === me.id ? { ...p, x: C.local.x, y: C.local.y } : p));
      renderer.render(
        { ...st, players, __meX: C.local.x, __meY: C.local.y },
        meForRender,
        { corridors: st.ship?.corridors || [] },
      );
      renderJoystick();
      updateCooldowns();
      updateActionAvailability();
    }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function renderJoystick() {
  if (!C.pointer.active) return;
  const ctx = canvas.getContext('2d');
  const r = renderer;
  const x = C.pointer.ox;
  const y = C.pointer.oy;
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 52, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.arc(x + C.pointer.dx * 52, y + C.pointer.dy * 52, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ================================================================
   HUD
   ================================================================ */
function renderHud(st) {
  const me = st.players.find((p) => p.id === st.you.id);
  if (!me) return;

  // papel
  const roleCard = $('roleCard');
  const roleName = $('roleName');
  const roleDesc = $('roleDesc');
  if (st.state === 'tasks') {
    roleCard.hidden = false;
    if (!st.you.alive) {
      roleName.textContent = 'FANTASMA';
      roleName.classList.remove('impostor');
      roleDesc.textContent = 'Continue as tarefas e observe';
    } else if (st.you.role === 'impostor') {
      roleName.textContent = 'IMPOSTOR';
      roleName.classList.add('impostor');
      roleDesc.textContent = 'Mate a tripulação e sabote';
    } else {
      roleName.textContent = 'TRIPULANTE';
      roleName.classList.remove('impostor');
      roleDesc.textContent = 'Complete suas tarefas';
    }
  } else {
    roleCard.hidden = true;
  }

  // barra de tarefas
  const tb = $('taskBarWrap');
  if (st.taskBar && st.state === 'tasks' && me.alive) {
    tb.hidden = false;
    const pct = st.taskBar.total ? (st.taskBar.done / st.taskBar.total) * 100 : 0;
    $('taskBarFill').style.width = `${pct}%`;
    $('taskBarText').textContent = `${st.taskBar.done}/${st.taskBar.total}`;
  } else {
    tb.hidden = true;
  }

  // objetivos (lista de tarefas)
  const obj = $('objectiveList');
  obj.innerHTML = '';
  $('impostorPanel').hidden = true;
  if (st.you.role === 'crew' && st.you.tasks?.length) {
    for (const t of st.you.tasks) {
      const room = t.room || t.consoles?.[0]?.room || '';
      const node = el('div', 'objective' + (t.done ? ' done' : ''));
      node.innerHTML = `<span>${t.done ? '<span class="tick">✓</span>' : ''}${escapeHtml(t.name)}</span><span class="obj-room">${escapeHtml(room)}</span>`;
      obj.append(node);
    }
  } else if (st.you.role === 'impostor') {
    $('impostorPanel').hidden = false;
    $('impMates').textContent = st.you.impostorTeammates?.length
      ? st.you.impostorTeammates.map((m) => m.name).join(', ')
      : 'sozinho';
    $('impKills').textContent = st.you.kills || 0;
    const node = el('div', 'objective');
    node.innerHTML = `<span>Progresso das tarefas deles</span><span class="obj-room">${st.taskBar ? `${st.taskBar.done}/${st.taskBar.total}` : 'oculto'}</span>`;
    obj.append(node);
  }

  // sabotagem
  const banner = $('sabotageBanner');
  if (st.sabotage) {
    banner.hidden = false;
    const info = SABOTAGE_INFO[st.sabotage.type];
    $('sabTitle').textContent = info?.name || 'SABOTAGEM';
    const left = Math.max(0, Math.ceil((st.sabotage.endsAt - Date.now()) / 1000));
    $('sabTimer').textContent = left;
    const roomName = st.ship.spaces.find((s) => s.id === st.sabotage.roomId)?.name || st.sabotage.roomId;
    $('sabHint').textContent = st.you.role === 'impostor'
      ? 'Sabotagem ativa'
      : `Conserte em ${roomName}${st.sabotage.required > 1 ? ` (${st.sabotage.fixed}/${st.sabotage.required})` : ''}`;
  } else {
    banner.hidden = true;
  }
}

function updateActionAvailability() {
  const st = C.state;
  if (!st || st.state !== 'tasks') return;
  const me = st.players.find((p) => p.id === st.you.id);
  if (!me) return;
  const useBtn = $('btnUse');
  const killBtn = $('btnKill');
  const reportBtn = $('btnReport');
  const ventBtn = $('btnVent');
  const sabBtn = $('btnSabotage');
  const emgBtn = $('btnEmergency');

  const alive = me.alive;
  // DUTO: perto de um duto e impostor
  const nearVent = st.ship.vents.find((v) => Math.hypot(v.x - C.local.x, v.y - C.local.y) < 1.5);
  const showVent = st.you.role === 'impostor' && alive;
  ventBtn.hidden = !showVent;
  if (showVent) ventBtn.disabled = !nearVent && !st.you.inVent;

  // MATAR: alcance + cooldown
  let nearVictim = null;
  let best = Infinity;
  for (const p of st.players) {
    if (!p.alive || p.role === 'impostor') continue;
    const d = Math.hypot(p.x - C.local.x, p.y - C.local.y);
    if (d < 2.6 && d < best) { best = d; nearVictim = p; }
  }
  const killReady = Date.now() >= (st.you.killReadyAt || 0);
  killBtn.hidden = !(st.you.role === 'impostor' && alive);
  if (!killBtn.hidden) killBtn.disabled = !nearVictim || !killReady || st.you.inVent;
  killBtn.classList.toggle('pulse', !!nearVictim && killReady && !st.you.inVent);

  // REPORT
  const nearBody = st.bodies.find((b) => Math.hypot(b.x - C.local.x, b.y - C.local.y) < 2.6);
  reportBtn.hidden = !nearBody || !alive;

  // USAR TAREFA
  let taskHere = null;
  let bestT = Infinity;
  for (const t of st.you.tasks || []) {
    if (t.done) continue;
    for (const c of t.consoles) {
      const d = Math.hypot(c.x - C.local.x, c.y - C.local.y);
      if (d < GAME_CONSTANTS.TASK_USE_DISTANCE + 0.5 && d < bestT) { bestT = d; taskHere = { ...t, consoleId: c.id }; }
    }
  }
  useBtn.hidden = !(taskHere && alive) && !(st.sabotage && !st.you.role?.includes('impostor') && alive);
  if (taskHere && alive) {
    useBtn.disabled = false;
    useBtn.querySelector('.action-label').textContent = 'Usar';
    useBtn.dataset.mode = 'task';
    useBtn.dataset.taskKey = taskHere.key;
    useBtn.dataset.consoleId = taskHere.consoleId;
    useBtn.classList.add('pulse');
  } else if (st.sabotage && alive) {
    const room = st.ship.spaces.find((s) => s.id === st.sabotage.roomId);
    const here = room && pointInRoom(room, C.local.x, C.local.y);
    useBtn.hidden = !here;
    useBtn.disabled = false;
    useBtn.dataset.mode = 'fix';
    useBtn.querySelector('.action-label').textContent = 'Consertar';
    useBtn.classList.add('pulse');
  } else {
    useBtn.classList.remove('pulse');
  }

  // SABOTAGEM (impostor)
  sabBtn.hidden = !(st.you.role === 'impostor' && alive);
  // EMERGÊNCIA
  const nearEmg = Math.hypot(C.local.x - st.ship.emergency.x, C.local.y - st.ship.emergency.y) < st.ship.emergency.radius;
  emgBtn.hidden = !(nearEmg && alive && st.emergencyLeft > 0);

  // UI do duto
  const ventUi = $('ventUi');
  ventUi.hidden = !st.you.inVent;
}

function updateCooldowns() {
  const st = C.state;
  if (!st || !st.you) return;
  const left = Math.max(0, (st.you.killReadyAt || 0) - Date.now());
  const cd = $('killCd');
  cd.hidden = left <= 0;
  cd.textContent = left > 0 ? Math.ceil(left / 1000) : '';
}

/* ================================================================
   AÇÕES DOS BOTÕES
   ================================================================ */
$('btnUse').addEventListener('click', () => {
  const btn = $('btnUse');
  if (btn.dataset.mode === 'fix') {
    socket.emit('fixSabotage', { roomId: C.state.sabotage.roomId }, (res) => {
      if (res?.error) toast(res.error);
      else if (res.fixed) toast('Sabotagem consertada!');
      else toast(`Segurando... ${res.progress}`);
    });
    return;
  }
  if (!btn.dataset.taskKey) return;
  socket.emit('startTask', { taskKey: btn.dataset.taskKey, consoleId: +btn.dataset.consoleId }, (res) => {
    if (res?.error) return toast(res.error);
    openTask(res.task, +btn.dataset.consoleId);
  });
});

$('btnKill').addEventListener('click', () => {
  const st = C.state;
  const me = st.players.find((p) => p.id === st.you.id);
  let best = null;
  let bd = Infinity;
  for (const p of st.players) {
    if (!p.alive || p.role === 'impostor') continue;
    const d = Math.hypot(p.x - me.x, p.y - me.y);
    if (d < bd) { bd = d; best = p; }
  }
  if (!best) return toast('Ninguém por perto.');
  socket.emit('kill', { targetId: best.id }, (res) => { if (res?.error) toast(res.error); });
});

$('btnReport').addEventListener('click', () => {
  const st = C.state;
  let best = null;
  let bd = Infinity;
  for (const b of st.bodies) {
    const d = Math.hypot(b.x - C.local.x, b.y - C.local.y);
    if (d < bd) { bd = d; best = b; }
  }
  if (!best) return toast('Nenhum corpo por perto.');
  socket.emit('report', { bodyId: best.id }, (res) => { if (res?.error) toast(res.error); });
});

$('btnVent').addEventListener('click', () => {
  const st = C.state;
  if (st.you.inVent) return socket.emit('ventExit', (res) => { if (res?.error) toast(res.error); });
  let best = null;
  let bd = Infinity;
  for (const v of st.ship.vents) {
    const d = Math.hypot(v.x - C.local.x, v.y - C.local.y);
    if (d < bd) { bd = d; best = v; }
  }
  if (!best) return toast('Nenhum duto por perto.');
  socket.emit('vent', { ventId: best.id }, (res) => { if (res?.error) toast(res.error); });
});

$('btnSabotage').addEventListener('click', () => {
  const list = $('sabList');
  list.innerHTML = '';
  for (const type of MAP_SABOTAGES[C.state.settings.map] || []) {
    const info = SABOTAGE_INFO[type];
    const b = el('button', 'sab-option');
    b.innerHTML = `<span class="sab-ico">${type === 'lights' ? '💡' : type === 'reactor' ? '☢' : '📡'}</span>
      <span><b>${info.name}</b><small>${info.desc}</small></span>`;
    b.addEventListener('click', () => {
      $('sabotageModal').setAttribute('hidden', '');
      socket.emit('sabotage', { type }, (res) => { if (res?.error) toast(res.error); });
    });
    list.append(b);
  }
  $('sabotageModal').removeAttribute('hidden');
});
$('sabClose').addEventListener('click', () => $('sabotageModal').setAttribute('hidden', ''));

$('btnEmergency').addEventListener('click', () => {
  socket.emit('emergency', (res) => { if (res?.error) toast(res.error); });
});

$('ventNext').addEventListener('click', () => socket.emit('ventMove', { direction: 1 }, (r) => { if (r?.error) toast(r.error); }));
$('ventPrev').addEventListener('click', () => socket.emit('ventMove', { direction: -1 }, (r) => { if (r?.error) toast(r.error); }));
$('ventExit').addEventListener('click', () => socket.emit('ventExit', (r) => { if (r?.error) toast(r.error); }));

/* ================================================================
   TAREFAS (minigames)
   ================================================================ */
function openTask(task, consoleId) {
  closeTask();
  C.taskOpen = { ...task, consoleId };
  const game = TASK_GAMES[task.game] || TASK_GAMES.upload;
  $('taskTitle').textContent = task.name;

  const advance = (data) => {
    socket.emit('advanceTask', { taskKey: task.key, consoleId, data }, (res) => {
      if (res?.error) return toast(res.error);
      if (res.finished) {
        toast(`Tarefa concluída: ${task.name}`);
        closeTask();
      } else if (task.totalSteps > 1) {
        toast(`Passo ${res.step}/${res.totalSteps}`);
      }
    });
  };

  let built;
  if (task.game === 'wires' || task.game === 'fuel' || task.game === 'divert' || task.game === 'multistep') {
    built = game.build({ onComplete: () => advance(), onStep: () => advance(), steps: task.totalSteps - task.step, step: task.step });
  } else {
    built = game.build({ onComplete: () => advance() });
  }
  C.taskGame = built;
  $('taskBody').innerHTML = '';
  $('taskBody').append(built.el);
  $('taskModal').removeAttribute('hidden');
}

$('taskClose').addEventListener('click', closeTask);
function closeTask() {
  if (C.taskGame?.destroy) C.taskGame.destroy();
  C.taskGame = null;
  C.taskOpen = null;
  $('taskBody').innerHTML = '';
  $('taskModal').setAttribute('hidden', '');
}

/* ================================================================
   REUNIÃO
   ================================================================ */
function renderMeeting(st) {
  const box = $('meeting');
  if (st.state !== 'meeting' || !st.meeting) {
    box.setAttribute('hidden', '');
    C.meetingKey = null;
    return;
  }
  closeTask();
  box.removeAttribute('hidden');
  const m = st.meeting;
  const key = `${m.startedAt}`;
  if (C.meetingKey !== key) {
    C.meetingKey = key;
    C.chatLines = [];
    $('chatLog').innerHTML = '';
    $('meetingTitle').textContent = m.reason === 'report' ? 'Corpo reportado!' : 'Reunião de emergência';
    $('meetingSub').textContent = m.reason === 'report'
      ? `Corpo de ${st.players.find((p) => p.id === m.bodyPlayerId)?.name || 'alguém'} em ${m.bodyRoom || '?'}`
      : `Convocada por ${m.callerName}`;
    $('meetingResult').hidden = true;
  }

  const now = Date.now();
  const isVoting = now >= m.discussionUntil;
  const left = Math.max(0, Math.ceil(((isVoting ? m.votingUntil : m.discussionUntil) - now) / 1000));
  $('meetingPhase').textContent = isVoting ? 'Votação' : 'Discussão';
  $('meetingTime').textContent = left;

  const me = st.players.find((p) => p.id === st.you.id);
  const grid = $('voteGrid');
  const alreadyVoted = !!st.myVote;
  grid.innerHTML = '';

  const renderCard = (p) => {
    const card = el('div', 'vote-card' + (p.alive ? '' : ' dead') + (st.myVote === p.id ? ' my-vote' : ''));
    card.dataset.id = p.id;
    const color = C.colors.find((c) => c.id === p.color)?.hex || '#888';
    const bean = el('div', 'vote-avatar');
    bean.innerHTML = miniBean(color);
    const name = el('div', 'vote-name', escapeHtml(p.name));
    card.append(bean, name);
    const votesFor = Object.values(st.votes || {}).filter((v) => v === p.id).length;
    if (votesFor > 0) {
      const badge = el('span', 'vote-votes', String(votesFor));
      card.append(badge);
    }
    if (me.alive && !me.voted && isVoting && p.alive && p.id !== me.id) {
      card.addEventListener('click', () => socket.emit('vote', { targetId: p.id }, (res) => { if (res?.error) toast(res.error); }));
    }
    grid.append(card);
  };
  for (const p of st.players) renderCard(p);

  // pular
  const skip = el('div', 'vote-card vote-skip' + (st.myVote === 'skip' ? ' my-vote' : ''));
  skip.innerHTML = '<div class="vote-name">Pular voto</div>';
  const skipVotes = Object.values(st.votes || {}).filter((v) => v === 'skip').length;
  if (skipVotes) skip.append(el('span', 'vote-votes', String(skipVotes)));
  if (me.alive && !me.voted && isVoting) {
    skip.addEventListener('click', () => socket.emit('vote', { targetId: 'skip' }, (res) => { if (res?.error) toast(res.error); }));
  }
  grid.append(skip);

  if (me.alive && alreadyVoted) {
    $('meetingResult').hidden = false;
    $('meetingResult').textContent = `Você votou. Votos recebidos: ${Object.keys(st.votes || {}).length}/${st.players.filter((p) => p.alive).length}`;
  } else if (!me.alive) {
    $('meetingResult').hidden = false;
    $('meetingResult').textContent = 'Você está morto e não pode votar.';
  }

  renderChat(st);
}

function renderChat(st) {
  const log = $('chatLog');
  const lines = (st.log || []).filter((l) => l.type === 'chat');
  const sig = lines.map((l) => l.text).join('|');
  if (log.dataset.sig === sig) return;
  log.dataset.sig = sig;
  log.innerHTML = '';
  for (const line of lines) {
    const div = el('div', 'chat-line');
    const color = C.colors.find((c) => c.id === line.color)?.hex || '#fff';
    div.innerHTML = `<span class="chat-who" style="color:${color}">${escapeHtml(line.from)}:</span><span class="chat-text">${escapeHtml(line.text)}</span>`;
    log.append(div);
  }
  log.scrollTop = log.scrollHeight;
}

$('chatSend').addEventListener('click', sendChat);
$('chatInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });
function sendChat() {
  const input = $('chatInput');
  const text = input.value.trim();
  if (!text) return;
  socket.emit('chat', { text }, (res) => { if (res?.error) toast(res.error); });
  input.value = '';
}

/* ================================================================
   FIM DE JOGO
   ================================================================ */
function renderGameOver(st) {
  const box = $('gameOver');
  if (st.state !== 'ended') {
    box.setAttribute('hidden', '');
    return;
  }
  box.removeAttribute('hidden');
  const win = (st.winner === 'impostor' && st.you.role === 'impostor') || (st.winner === 'crew' && st.you.role === 'crew');
  const title = $('goTitle');
  title.textContent = win ? 'VITÓRIA' : 'DERROTA';
  title.className = win ? 'win' : 'lose';
  $('goReason').textContent = st.gameOverReason || '';

  const emblems = $('goEmblems');
  emblems.innerHTML = '';
  const imps = st.players.filter((p) => p.role === 'impostor');
  for (const p of imps) {
    const color = C.colors.find((c) => c.id === p.color)?.hex || '#888';
    const d = el('div');
    d.innerHTML = `<div style="width:44px;height:44px">${miniBean(color)}</div>`;
    emblems.append(d);
  }

  const rows = $('goRows');
  rows.innerHTML = '';
  for (const p of st.players) {
    const row = el('div', 'go-row');
    row.innerHTML = `<span>${escapeHtml(p.name)}</span><b>${p.role === 'impostor' ? 'IMPOSTOR' : 'TRIPULANTE'}</b>`;
    rows.append(row);
  }

  const isHost = st.hostId === st.you.id;
  $('goAgain').hidden = false;
  $('goLobby').hidden = !isHost;
}

$('goAgain').addEventListener('click', () => {
  $('gameOver').setAttribute('hidden', '');
  emit('start');
  // quem não é host espera o host; host reinicia a partida
});
$('goLobby').addEventListener('click', () => {
  $('gameOver').setAttribute('hidden', '');
  emit('toLobby');
});

/* ================================================================
   FEED + TOAST
   ================================================================ */
function updateFeed(st) {
  const feed = $('feed');
  for (const entry of st.log || []) {
    const sig = `${entry.type}:${entry.text}`;
    if (entry.type === 'chat' || C.feedSeen.has(sig)) continue;
    C.feedSeen.add(sig);
    if (entry.type === 'task') continue; // tarefas geram muito ruído
    const item = el('div', 'item' + (entry.type === 'eject' ? ' kill' : '') + (entry.type === 'gameover' ? ' win' : ''));
    item.textContent = entry.text;
    feed.append(item);
    setTimeout(() => item.remove(), 6000);
  }
  while (feed.children.length > 4) feed.firstChild.remove();
}

let toastTimer = null;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

/* ================================================================
   Utilitários
   ================================================================ */
function miniBean(hex) {
  return `<svg viewBox="0 0 40 40" width="100%" height="100%">
    <rect x="7" y="6" width="26" height="30" rx="12" fill="${hex}"/>
    <ellipse cx="13" cy="34" rx="5" ry="4" fill="${hex}"/>
    <ellipse cx="27" cy="34" rx="5" ry="4" fill="${hex}"/>
    <rect x="4" y="14" width="5" height="14" rx="2.5" fill="rgba(0,0,0,0.28)"/>
    <rect x="17" y="12" width="14" height="9" rx="4.5" fill="#a8e0ef"/>
    <rect x="21" y="14" width="6" height="3" rx="1.5" fill="rgba(255,255,255,0.8)"/>
  </svg>`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

socket.on('connect', () => {
  // se caiu a conexão, volta ao menu
  if (C.state && C.code) {
    // tenta reentrar
  }
});
