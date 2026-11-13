import { GAME_CONSTANTS, RULE_PRESETS, SABOTAGE_INFO, MAP_SABOTAGES, ROLE_INFO } from '/shared/rules.js';
import { Renderer } from './renderer.js';
import { TASK_GAMES } from './tasks.js';
import { sfx } from './sfx.js';

const $ = (id) => document.getElementById(id);

/** Botões de habilidade por papel (mesmos nomes do jogo). */
const ABILITY_UI = {
  Shapeshifter: { label: 'Transformar', ico: '◐', target: true, hint: 'Escolha quem você vai imitar por 10s.' },
  Phantom: { label: 'Invisível', ico: '◌', target: false, hint: 'Fique invisível por 5s.' },
  Viper: { label: 'Veneno', ico: '☣', target: true, hint: 'Escolha quem vai morrer envenenado.' },
  Tracker: { label: 'Rastrear', ico: '◎', target: true, hint: 'Marque um jogador e veja a posição dele.' },
  'Guardian Angel': { label: 'Proteger', ico: '✚', target: true, hint: 'Dê um escudo a um jogador vivo.' },
  Scientist: { label: 'Vitais', ico: '♥', target: false, hint: 'Abra os vitais gastando bateria.' },
};
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
  session: null,
  lastKillAt: 0,
  lastEjectAt: 0,
  revealKey: 0,
  lastAlarmAt: 0,
  revealTimer: null,
  mapOpen: false,
  muted: false,
  prevPhase: null,
  lastFootstep: 0,
  taskPulse: 0,
  ejectTimer: null,
};

const renderer = new Renderer($('gameCanvas'));
window.addEventListener('resize', () => renderer.resize());

/* ---------------- áudio (precisa de um gesto do usuário) ---------------- */
function unlockAudio() {
  sfx.init();
  if (C.state?.state === 'tasks') {
    sfx.startAmbient();
    sfx.setMuted(C.muted);
  }
}
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('keydown', unlockAudio, { once: true });
try {
  const saved = JSON.parse(localStorage.getItem('impostor:player') || '{}');
  if (saved && typeof saved.muted === 'boolean') C.muted = saved.muted;
} catch { /* sem storage */ }
sfx.setMuted(C.muted);

function savePlayer() {
  try {
    localStorage.setItem('impostor:player', JSON.stringify({
      name: C.me.name, color: C.me.color, muted: C.muted,
    }));
  } catch { /* sem storage */ }
}

function saveSession(res) {
  if (!res?.session) return;
  C.session = res.session;
  try {
    localStorage.setItem('impostor:session', JSON.stringify({ code: res.code, session: res.session, at: Date.now() }));
  } catch { /* sem storage */ }
}

/* ================================================================
   Boot: recebe dados do servidor (cores, presets, versão)
   ================================================================ */
window.__state = () => C.state;
window.__openSpecial = (kind) => openSpecial(kind);
window.__testMove = (x, y) => { C.local.x = x; C.local.y = y; socket.emit('move', { x, y }); };

socket.on('hello', (info) => {
  C.info = info;
  C.colors = info.colors;
  const saved = JSON.parse(localStorage.getItem('impostor:player') || '{}');
  if (saved.name) { C.me.name = saved.name; $('nameInput').value = saved.name; }
  if (typeof saved.color === 'number') C.me.color = saved.color;
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
   Navegador de salas (multiplayer online)
   ================================================================ */
const MAP_LABEL = { skeld: 'The Skeld', mira: 'Mira HQ', polus: 'Polus', airship: 'Airship', fungle: 'Fungle' };
const STATE_LABEL = { lobby: 'aguardando', starting: 'iniciando', tasks: 'em jogo', meeting: 'reunião', ended: 'encerrando' };

function renderGameList(games) {
  const box = $('gameList');
  $('gameCount').textContent = games.length;
  if (!games.length) {
    box.innerHTML = '<p class="game-empty">Nenhuma sala aberta. Crie uma ou jogue com bots.</p>';
    return;
  }
  box.innerHTML = '';
  for (const g of games) {
    const row = el('div', 'game-row' + (g.joinable ? '' : ' full'));
    row.innerHTML = `
      <span class="gr-code">${escapeHtml(g.code)}</span>
      <span>
        <span class="gr-host">${escapeHtml(g.host)}</span>
        <span class="gr-meta"> · ${g.humans} humano${g.humans === 1 ? '' : 's'}${g.bots ? ` + ${g.bots} bots` : ''} · ${MAP_LABEL[g.map] || g.map}</span>
      </span>
      <span class="gr-meta">${g.players}/${g.max} · ${STATE_LABEL[g.state] || g.state}</span>
      <button class="btn small" ${g.joinable ? '' : 'disabled'}>${g.joinable ? 'Entrar' : 'Em jogo'}</button>`;
    const btn = row.querySelector('button');
    btn?.addEventListener('click', () => {
      C.me.name = nameValue();
      sfx.init();
      socket.emit('join', { code: g.code, name: C.me.name, color: C.me.color }, (res) => {
        if (res?.error) return showHomeError(res.error);
        onJoined(res);
      });
    });
    box.append(row);
  }
}

function refreshGames() {
  socket.emit('listGames', {}, (res) => {
    if (res?.ok) renderGameList(res.games || []);
  });
}

$('btnRefreshGames').addEventListener('click', () => {
  refreshGames();
  sfx.click();
});
setInterval(() => {
  if ($('screen-home').classList.contains('active')) refreshGames();
}, 6000);

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
  saveSession(res);
  savePlayer();
  sfx.click();
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
  C.session = null;
  localStorage.removeItem('impostor:session');
  sfx.stopAlarm();
  sfx.stopAmbient();
  showScreen('home');
  refreshGames();
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

  // ---- ganchos de som e cinemática ----
  if (prev && prev.state === 'lobby' && state.state !== 'lobby') {
    sfx.init();
    sfx.startAmbient();
  }
  if (state.state === 'tasks' && prev?.state !== 'tasks') {
    sfx.startAlarm && sfx.stopAlarm();
  }
  if (state.lastKill && state.lastKill.at !== C.lastKillAt) {
    C.lastKillAt = state.lastKill.at;
    const meP = state.players.find((p) => p.id === state.you.id);
    const d = meP ? Math.hypot(meP.x - state.lastKill.x, meP.y - state.lastKill.y) : 99;
    if (state.you.role === 'impostor' || d < 11) {
      const killerP = state.players.find((p) => p.id === state.lastKill.killerId);
      renderer.killAt(
        { x: state.lastKill.x, y: state.lastKill.y, color: state.lastKill.victimColor },
        killerP ? { x: killerP.x, y: killerP.y } : null,
      );
      if (state.you.role === 'impostor' || d < 6.5) sfx.kill();
    }
  }
  if (state.state === 'meeting' && prev?.state !== 'meeting') {
    sfx.meeting();
    flashScreen('red', 220);
    document.querySelector('.meeting-card')?.classList.add('alarm');
  }
  if (state.state === 'ended' && prev?.state !== 'ended') {
    const won = (state.winner === 'impostor' && state.you.role === 'impostor') || (state.winner === 'crew' && state.you.role === 'crew');
    won ? sfx.win() : sfx.lose();
    sfx.stopAlarm();
    sfx.stopAmbient();
  }
  if (state.sabotage) {
    if (state.sabotage.type === 'reactor' || state.sabotage.type === 'o2') sfx.startAlarm();
    else sfx.stopAlarm();
  } else {
    sfx.stopAlarm();
  }
  document.body.classList.toggle(
    'sab-critical',
    !!state.sabotage && ['reactor', 'o2'].includes(state.sabotage.type) && state.state === 'tasks',
  );

  if (state.state === 'lobby' || state.state === 'ended') {
    if (C.special) closeSpecial();
  }
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

  if (state.state === 'meeting' && state.meeting?.done) showEject(state.meeting);
  if (state.state !== 'meeting' && !$('ejectOverlay').hidden && !state.meeting) {
    // a cinemática some sozinha, mas garante que não fique presa
    if (Date.now() - C.lastEjectAt > 4200) $('ejectOverlay').hidden = true;
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
    if (p.connected === false) badges.innerHTML += '<span class="badge badge-empty">OFF</span>';
    li.append(bean, who, badges);
    if (isHost && p.id !== state.you.id && !p.isBot) {
      const kick = el('button', 'kick-btn', 'REMOVER');
      kick.addEventListener('click', () => {
        socket.emit('kick', { targetId: p.id }, (res) => { if (res?.error) toast(res.error); });
      });
      li.append(kick);
    }
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
  renderLobbyChat(state);

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
  // só o mapa clássico: The Skeld
  const maps = [{ id: 'skeld', label: 'The Skeld' }];
  for (const m of maps) {
    const b = document.createElement('button');
    b.className = 'map-btn' + (m.id === state.settings.map ? ' active' : '');
    b.textContent = m.label;
    b.disabled = !isHost;
    b.addEventListener('click', () => emit('setSettings', { patch: { map: m.id } }));
    row.append(b);
  }
  const tag = document.createElement('span');
  tag.className = 'map-tag';
  tag.textContent = 'mapa clássico';
  row.append(tag);
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
const ROLE_DEFS = [
  { key: 'shapeshifter', role: 'Shapeshifter' },
  { key: 'phantom', role: 'Phantom' },
  { key: 'viper', role: 'Viper' },
  { key: 'engineer', role: 'Engineer' },
  { key: 'scientist', role: 'Scientist' },
  { key: 'noisemaker', role: 'Noisemaker' },
  { key: 'tracker', role: 'Tracker' },
  { key: 'guardianAngel', role: 'Guardian Angel' },
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

  // ---------------- papéis ----------------
  const roles = state.settings.roles || {};
  const roleHead = el('div', 'setting-row role-head-row');
  roleHead.innerHTML = '<div class="setting-head"><span>Papéis especiais</span><b>até 3 de cada</b></div>';
  list.append(roleHead);

  for (const def of ROLE_DEFS) {
    const info = ROLE_INFO[def.role];
    const value = roles[def.key] || 0;
    const row = el('div', 'setting-row role-row');
    row.dataset.team = info?.team || 'crew';
    row.innerHTML = `
      <div class="setting-head">
        <span>${escapeHtml(info?.name || def.role)} <em class="role-team">${info?.team === 'impostor' ? 'impostor' : 'tripulante'}</em></span>
        <b>${value === 0 ? 'desligado' : value}</b>
      </div>
      <input type="range" min="0" max="3" step="1" value="${value}" ${isHost ? '' : 'disabled'} />
      <p class="role-note">${escapeHtml(info?.desc || '')}</p>`;
    const input = row.querySelector('input');
    input.addEventListener('input', () => {
      row.querySelector('b').textContent = +input.value === 0 ? 'desligado' : input.value;
    });
    input.addEventListener('change', () => {
      emit('setSettings', { patch: { roles: { ...(C.state?.settings?.roles || {}), [def.key]: +input.value } } });
    });
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
  if (e.key === 'Tab') {
    e.preventDefault();
    if ($('screen-game').classList.contains('active')) toggleMap();
    return;
  }
  if (e.key === 'Escape') {
    toggleMap(false);
    return;
  }
  C.keys.add(e.key.toLowerCase());
  if (e.key === 'e' || e.key === ' ') { e.preventDefault(); $('btnUse').click(); }
  if (e.key === 'q') $('btnKill').click();
  if (e.key === 'f') $('btnAbility').click();
  if (e.key === 'r') $('btnReport').click();
  if (e.key === 'f') $('btnSabotage').click();
  if (e.key === 'm') $('btnMute').click();
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
  if (!me) return;
  if (!me.alive && st.state !== 'tasks') return;

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
  if (me.alive && now - C.lastFootstep > 340) {
    C.lastFootstep = now;
    sfx.footstep();
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
      if (C.special) {
        if (C.special === 'Security') drawCameras();
        else if (now - (C.specialAt || 0) > 400) { C.specialAt = now; renderSpecial(); }
      }
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

  // fantasma
  $('ghostBanner').hidden = !(st.state === 'tasks' && !st.you.alive);

  // revelação de papel (uma vez por partida)
  maybeRoleReveal(st);

  // alarme do barulhento (som + aviso)
  const alarms = st.noiseAlarms || [];
  const lastAlarm = alarms[alarms.length - 1];
  if (lastAlarm && C.lastAlarmAt !== lastAlarm.at) {
    C.lastAlarmAt = lastAlarm.at;
    sfx.startAlarm?.();
    setTimeout(() => sfx.stopAlarm?.(), 1400);
    toast(`Alarme do Barulhento: ${lastAlarm.name}`);
  }

  // papel
  const roleCard = $('roleCard');
  const roleName = $('roleName');
  const roleDesc = $('roleDesc');
  if (st.state === 'tasks') {
    roleCard.hidden = false;
    const info = ROLE_INFO[st.you.roleType];
    const imp = st.you.role === 'impostor';
    roleName.classList.toggle('impostor', imp && st.you.alive);
    if (!st.you.alive) {
      roleName.textContent = imp ? 'IMPOSTOR MORTO' : 'TRIPULANTE MORTO';
      roleName.classList.remove('impostor');
      roleDesc.textContent = 'Fantasma: termine suas tarefas e observe';
    } else {
      roleName.textContent = (info?.name || (imp ? 'Impostor' : 'Tripulante')).toUpperCase();
      const hint = info?.hint ? ` · ${info.hint}` : '';
      roleDesc.textContent = (info?.desc || (imp ? 'Mate a tripulação e sabote.' : 'Complete suas tarefas.')) + hint;
    }
    roleCard.dataset.team = st.you.role;
    roleCard.dataset.role = st.you.roleType || '';
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
    buildDoorGrid(st);
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

function buildDoorGrid(st) {
  const grid = $('doorGrid');
  if (!st.you || st.you.role !== 'impostor' || !st.you.alive) { grid.innerHTML = ''; return; }
  const rooms = [...new Set((st.ship?.doors || []).map((d) => d.room))];
  const ready = st.doorsReadyAt || {};
  const openCount = rooms.filter((r) => (ready[r] || 0) <= Date.now()).length;
  $('doorsHint').textContent = openCount ? `${openCount} prontas` : 'recarregando';
  const sig = rooms.map((r) => `${r}:${Math.max(0, Math.ceil(((ready[r] || 0) - Date.now()) / 1000))}`).join('|');
  if (grid.dataset.sig === sig) return;
  grid.dataset.sig = sig;
  grid.innerHTML = '';
  for (const roomId of rooms) {
    const room = st.ship.spaces.find((x) => x.id === roomId);
    const left = Math.max(0, Math.ceil(((ready[roomId] || 0) - Date.now()) / 1000));
    const b = el('button', 'door-btn', left ? `${room?.name || roomId} ${left}s` : (room?.name || roomId));
    b.disabled = left > 0;
    b.addEventListener('click', () => {
      socket.emit('doors', { roomId }, (res) => {
        if (res?.error) return toast(res.error);
        sfx.door();
        toast('Portas fechadas!');
      });
    });
    grid.append(b);
  }
}

/* ================================================================
   Salas especiais: Admin, Vitais e Câmeras
   ================================================================ */
const SPECIAL_INFO = {
  Admin: { title: 'ADMINISTRAÇÃO', label: 'Admin', hint: 'Mostra quantos jogadores vivos há em cada sala.' },
  MedBay: { title: 'VITAIS', label: 'Vitais', hint: 'Batimento de cada tripulante: verde vivo, vermelho morto.' },
  Security: { title: 'CÂMERAS', label: 'Câmeras', hint: 'A luz vermelha no canto pisca enquanto as câmeras estão ligadas.' },
};
const CAMERA_ROOMS = ['Cafeteria', 'Weapons', 'Nav', 'Storage'];

function roomAtPoint(st, x, y) {
  for (const room of st.ship?.spaces || []) {
    if (pointInRoom(room, x, y)) return room;
  }
  return null;
}

function currentSpecial(st) {
  const room = roomAtPoint(st, C.local.x, C.local.y);
  return room && SPECIAL_INFO[room.id] ? room.id : null;
}

function openSpecial(kind) {
  if (!kind || !SPECIAL_INFO[kind]) return;
  C.special = kind;
  $('specialPanel').hidden = false;
  $('specialTitle').textContent = SPECIAL_INFO[kind].title;
  $('specialHint').textContent = SPECIAL_INFO[kind].hint;
  if (kind === 'Security') buildCameras();
  renderSpecial();
  sfx.click();
}

function closeSpecial() {
  C.special = null;
  $('specialPanel').hidden = true;
  $('specialBody').innerHTML = '';
}

function buildCameras() {
  const body = $('specialBody');
  body.innerHTML = '<div class="cam-grid"></div>';
  const grid = body.querySelector('.cam-grid');
  for (const id of CAMERA_ROOMS) {
    const room = C.state?.ship?.spaces.find((r) => r.id === id);
    const tile = el('div', 'cam-tile');
    tile.innerHTML = `<canvas></canvas><span class="cam-label">${escapeHtml(room?.name || id)}</span><span class="cam-rec"></span>`;
    grid.append(tile);
  }
}

function renderSpecial() {
  const st = C.state;
  if (!C.special || !st) return;
  const body = $('specialBody');
  if (C.special === 'Admin') {
    const spaces = (st.ship?.spaces || []).filter((r) => r.id !== 'Admin');
    body.innerHTML = '<div class="admin-grid"></div>';
    const grid = body.querySelector('.admin-grid');
    for (const room of spaces) {
      const count = st.players.filter((p) => p.alive && pointInRoom(room, p.x, p.y)).length;
      const cell = el('div', 'admin-cell' + (count ? '' : ' zero'));
      cell.innerHTML = `<b>${count}</b><span>${escapeHtml(room.name)}</span>`;
      grid.append(cell);
    }
  } else if (C.special === 'MedBay') {
    body.innerHTML = '<div class="vitals-list"></div>';
    const list = body.querySelector('.vitals-list');
    for (const p of [...st.players].sort((a, b) => Number(b.alive) - Number(a.alive))) {
      const color = C.colors.find((c) => c.id === p.color)?.hex || '#888';
      const row = el('div', 'vital-row');
      row.innerHTML = `<span class="vital-dot${p.alive ? '' : ' dead'}"></span>
        <span class="vital-bean">${miniBean(color)}</span>
        <span class="vital-name">${escapeHtml(p.name)}${p.id === st.you.id ? ' (você)' : ''}</span>
        <span class="vital-state">${p.alive ? 'VIVO' : 'MORTO'}</span>`;
      list.append(row);
    }
  } else if (C.special === 'Security') {
    drawCameras();
  }
}

function drawCameras() {
  const st = C.state;
  if (!st) return;
  const canvases = $('specialBody').querySelectorAll('.cam-tile canvas');
  const now = Date.now();
  canvases.forEach((canvas, i) => {
    const id = CAMERA_ROOMS[i];
    const room = st.ship.spaces.find((r) => r.id === id);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || 260;
    const h = canvas.clientHeight || 150;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0a141f';
    ctx.fillRect(0, 0, w, h);
    if (!room) return;
    const [x1, y1, x2, y2] = room.bounds;
    const pad = 18;
    const z = Math.min((w - pad * 2) / (x2 - x1), (h - pad * 2) / (y2 - y1));
    const ox = (w - (x2 - x1) * z) / 2;
    const oy = (h - (y2 - y1) * z) / 2;
    const toS = (x, y) => [ox + (x - x1) * z, oy + (y2 - y) * z];

    ctx.beginPath();
    for (const shape of room.shapes || []) {
      (shape.points || []).forEach(([px, py], k) => {
        const [sx, sy] = toS(px, py);
        k ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy);
      });
      ctx.closePath();
    }
    ctx.fillStyle = 'rgba(126, 152, 186, 0.35)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(180, 220, 255, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // ruído de vídeo
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#8effc9';
    for (let n = 0; n < 40; n++) ctx.fillRect(Math.random() * w, Math.random() * h, 2, 1);
    ctx.globalAlpha = 1;

    for (const p of st.players) {
      if (!p.alive) continue;
      if (!pointInRoom(room, p.x, p.y)) continue;
      const [sx, sy] = toS(p.x, p.y);
      const color = C.colors.find((c) => c.id === p.color)?.hex || '#c51111';
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(sx, sy, 5, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#a8e0ef';
      ctx.beginPath();
      ctx.ellipse(sx + 1.6, sy - 2, 2.4, 1.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const b of st.bodies || []) {
      if (!pointInRoom(room, b.x, b.y)) continue;
      const [sx, sy] = toS(b.x, b.y);
      ctx.fillStyle = 'rgba(190, 30, 45, 0.85)';
      ctx.beginPath();
      ctx.arc(sx, sy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // timestamp tipo CCTV
    ctx.fillStyle = 'rgba(180, 255, 220, 0.55)';
    ctx.font = '9px monospace';
    const t = new Date(now);
    ctx.fillText(`${t.toLocaleTimeString('pt-BR')} CAM ${i + 1}`, w - 92, h - 8);
  });
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
  const specialBtn = $('btnSpecial');

  const alive = me.alive;
  // DUTO: perto de um duto e impostor
  const nearVent = st.ship.vents.find((v) => Math.hypot(v.x - C.local.x, v.y - C.local.y) < 1.5);
  const engineer = st.you.roleType === 'Engineer';
  const showVent = (st.you.role === 'impostor' || engineer) && alive;
  ventBtn.hidden = !showVent;
  if (showVent) ventBtn.disabled = (!nearVent && !st.you.inVent) || (engineer && Date.now() < (st.you.abilityReadyAt || 0));

  // HABILIDADE DO PAPEL (metamorfo, fantasma, víbora, rastreador, anjo, cientista)
  const abilityBtn = $('btnAbility');
  const ability = ABILITY_UI[st.you.roleType];
  const canAbility = !!ability && (alive || st.you.roleType === 'Guardian Angel');
  abilityBtn.hidden = !canAbility || st.you.inVent;
  if (canAbility) {
    abilityBtn.querySelector('.action-label').textContent = ability.label;
    abilityBtn.querySelector('.action-ico').textContent = ability.ico;
    abilityBtn.disabled = Date.now() < (st.you.abilityReadyAt || 0);
    abilityBtn.classList.toggle('pulse', !abilityBtn.disabled);
  }

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
  const canTask = alive || (st.you.role === 'crew' && st.settings.ghostsDoTasks);
  useBtn.hidden = !(taskHere && canTask) && !(st.sabotage && st.you.role === 'crew' && alive);
  if (taskHere && canTask) {
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

  // SALAS ESPECIAIS (admin, vitais, câmeras)
  const special = currentSpecial(st);
  specialBtn.hidden = !special;
  if (special) {
    specialBtn.querySelector('.action-label').textContent = SPECIAL_INFO[special].label;
    specialBtn.classList.add('pulse');
    specialBtn.dataset.kind = special;
    if (C.special && C.special !== special) closeSpecial();
  } else if (C.special && !(C.special === 'MedBay' && st.you.roleType === 'Scientist')) {
    closeSpecial();
  }

  // UI do duto
  const ventUi = $('ventUi');
  ventUi.hidden = !st.you.inVent;
}

/* ---------------- revelação de papel ---------------- */
function hideRoleReveal() {
  clearTimeout(C.revealTimer);
  const box = $('roleReveal');
  if (box.hidden) return;
  box.classList.remove('in');
  setTimeout(() => { box.hidden = true; }, 260);
}

function maybeRoleReveal(st) {
  if (st.state !== 'tasks' || !st.you) return;
  const key = st.startedAt || 0;
  if (!key || C.revealKey === key) return;
  C.revealKey = key;

  const info = ROLE_INFO[st.you.roleType] || {};
  const imp = st.you.role === 'impostor';
  const team = $('rrTeam');
  team.textContent = st.you.alive ? (imp ? 'IMPOSTOR' : 'TRIPULANTE') : 'FANTASMA';
  team.className = 'rr-team' + (imp ? ' imp' : ' crew');
  $('rrName').textContent = info.name || (imp ? 'Impostor' : 'Tripulante');
  $('rrName').className = 'rr-name' + (imp ? ' imp' : '');
  $('rrDesc').textContent = info.desc || (imp ? 'Mate a tripulação e sabote a nave.' : 'Complete suas tarefas.');
  $('rrHint').textContent = info.hint || '';
  $('rrHint').hidden = !info.hint;

  const mates = st.you.impostorTeammates || [];
  const box = $('rrMates');
  box.innerHTML = '';
  if (imp && mates.length) {
    box.hidden = false;
    box.innerHTML = `<span class="rr-mates-label">Seus cúmplices</span>${mates
      .map((m) => {
        const hex = C.colors.find((c) => c.id === m.color)?.hex || '#ddd';
        return `<span class="rr-mate"><i style="background:${hex}"></i>${escapeHtml(m.name)}</span>`;
      })
      .join('')}`;
  } else {
    box.hidden = true;
  }

  const overlay = $('roleReveal');
  overlay.hidden = false;
  requestAnimationFrame(() => overlay.classList.add('in'));
  if (imp) sfx.kill?.(); else sfx.click?.();
  clearTimeout(C.revealTimer);
  C.revealTimer = setTimeout(hideRoleReveal, 7000);
  void $('rrOk');
}
$('rrOk').addEventListener('click', hideRoleReveal);
$('roleReveal').addEventListener('click', (e) => {
  if (e.target === $('roleReveal')) hideRoleReveal();
});

function updateCooldowns() {
  const st = C.state;
  if (!st || !st.you) return;
  const total = st.you.killCooldownMs || 25000;
  const left = Math.max(0, (st.you.killReadyAt || 0) - Date.now());
  const cd = $('killCd');
  cd.hidden = left <= 0;
  cd.textContent = left > 0 ? Math.ceil(left / 1000) : '';
  const btn = $('btnKill');
  const pct = Math.max(0, Math.min(100, (left / total) * 100));
  btn.style.setProperty('--cd', pct.toFixed(1));
  btn.style.setProperty('--cd-on', left > 0 ? '1' : '0');

  // recarga da habilidade
  const aBtn = $('btnAbility');
  const abilityCd = $('abilityCd');
  if (!aBtn.hidden) {
    const totalA = (ABILITY_UI[st.you.roleType] && st.you.abilityCooldownMs) || 0;
    const leftA = Math.max(0, (st.you.abilityReadyAt || 0) - Date.now());
    abilityCd.hidden = leftA <= 0;
    abilityCd.textContent = leftA > 0 ? Math.ceil(leftA / 1000) : '';
    const pctA = totalA ? Math.max(0, Math.min(100, (leftA / totalA) * 100)) : 0;
    aBtn.style.setProperty('--cd', pctA.toFixed(1));
    aBtn.style.setProperty('--cd-on', leftA > 0 ? '1' : '0');
  }

  // estado de efeitos (invisível, transformado, escudo, bateria)
  const rs = $('roleState');
  const chips = [];
  if (left <= 0 && st.you.role === 'impostor' && st.you.alive) chips.push('Matar pronto');
  if ((st.you.phantomUntil || 0) > Date.now()) chips.push(`Invisível ${Math.ceil((st.you.phantomUntil - Date.now()) / 1000)}s`);
  if ((st.you.shiftUntil || 0) > Date.now()) chips.push(`Transformado ${Math.ceil((st.you.shiftUntil - Date.now()) / 1000)}s`);
  if ((st.you.shieldUntil || 0) > Date.now()) chips.push(`Escudo ${Math.ceil((st.you.shieldUntil - Date.now()) / 1000)}s`);
  if (st.you.roleType === 'Scientist') chips.push(`Bateria ${st.you.battery ?? 100}%`);
  if (st.you.roleType === 'Tracker' && st.you.alive) chips.push(`Marcações ${st.you.trackerUses ?? 0}`);
  const ventLeft = st.you.inVent && st.you.roleType === 'Engineer'
    ? Math.max(0, 5 - (Date.now() - (st.you.ventEnteredAt || Date.now())) / 1000)
    : null;
  if (ventLeft !== null) chips.push(`Duto ${ventLeft.toFixed(1)}s`);
  rs.hidden = !chips.length;
  rs.innerHTML = chips.map((c) => `<span class="rs-chip">${escapeHtml(c)}</span>`).join('');
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
  socket.emit('report', { bodyId: best.id }, (res) => {
    if (res?.error) return toast(res.error);
    flashScreen('red', 260);
    renderer.shake(14, 420);
    sfx.report();
  });
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
  socket.emit('vent', { ventId: best.id }, (res) => {
    if (res?.error) return toast(res.error);
    sfx.vent();
  });
});

$('btnSabotage').addEventListener('click', () => {
  const list = $('sabList');
  list.innerHTML = '';
  for (const type of MAP_SABOTAGES[C.state.settings.map] || []) {
    const info = SABOTAGE_INFO[type];
    const b = el('button', 'sab-option');
    b.innerHTML = `<span class="sab-ico">${type === 'lights' ? '💡' : type === 'reactor' ? '☢' : type === 'o2' ? '🫧' : '📡'}</span>
      <span><b>${info.name}</b><small>${info.desc}</small></span>`;
    b.addEventListener('click', () => {
      $('sabotageModal').setAttribute('hidden', '');
      socket.emit('sabotage', { type }, (res) => {
        if (res?.error) return toast(res.error);
        sfx.sabotage();
      });
    });
    list.append(b);
  }
  $('sabotageModal').removeAttribute('hidden');
});
$('sabClose').addEventListener('click', () => $('sabotageModal').setAttribute('hidden', ''));

$('btnEmergency').addEventListener('click', () => {
  socket.emit('emergency', (res) => {
    if (res?.error) return toast(res.error);
    flashScreen('red', 320);
    renderer.shake(10, 380);
    sfx.meeting();
  });
});

$('btnSpecial').addEventListener('click', () => {
  const kind = $('btnSpecial').dataset.kind;
  if (kind) openSpecial(kind);
});

/* ---------------- habilidades de papel ---------------- */
function emitAbility(targetId) {
  const you = C.state?.you;
  if (!you) return;
  socket.emit('ability', { type: you.roleType, targetId: targetId || null }, (res) => {
    if (res?.error) return toast(res.error);
    if (you.roleType === 'Scientist') openSpecial('MedBay');
    else if (you.roleType === 'Viper') toast('Veneno aplicado — a vítima cai em instantes.');
    else if (you.roleType === 'Phantom') toast('Você ficou invisível.');
    else if (you.roleType === 'Shapeshifter') toast('Transformação ativa.');
    sfx.click();
  });
}

function openAbilityModal() {
  const st = C.state;
  if (!st?.you) return;
  const ui = ABILITY_UI[st.you.roleType];
  if (!ui) return;
  $('abilityTitle').textContent = ui.label;
  $('abilityHint').textContent = ui.hint || '';
  const grid = $('abilityGrid');
  grid.innerHTML = '';
  const targets = st.players.filter((p) => p.alive && p.id !== st.you.id);
  if (!targets.length) {
    grid.innerHTML = '<div class="ability-empty">Nenhum alvo disponível.</div>';
  }
  for (const p of targets) {
    const hex = C.colors.find((c) => c.id === p.color)?.hex || '#888';
    const b = el('button', 'ability-target');
    b.innerHTML = `<span class="at-dot" style="background:${hex}"></span><span class="at-name">${escapeHtml(p.name)}</span>`;
    b.addEventListener('click', () => {
      $('abilityModal').setAttribute('hidden', '');
      emitAbility(p.id);
    });
    grid.append(b);
  }
  $('abilityModal').removeAttribute('hidden');
}

$('btnAbility').addEventListener('click', () => {
  const ui = ABILITY_UI[C.state?.you?.roleType];
  if (!ui) return;
  if (ui.target) openAbilityModal();
  else emitAbility(null);
});
$('abilityClose').addEventListener('click', () => $('abilityModal').setAttribute('hidden', ''));
$('abilityModal').addEventListener('click', (e) => {
  if (e.target === $('abilityModal')) $('abilityModal').setAttribute('hidden', '');
});
$('specialClose').addEventListener('click', closeSpecial);

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
        sfx.taskDone();
        flashScreen('', 120);
        taskDoneBurst();
        closeTask();
      } else if (task.totalSteps > 1) {
        toast(`Passo ${res.step}/${res.totalSteps}`);
        sfx.taskStep();
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

function taskDoneBurst() {
  const burst = el('div', 'task-done-burst', '✓');
  document.body.append(burst);
  setTimeout(() => burst.remove(), 780);
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
  const aliveCount = st.players.filter((p) => p.alive).length;
  const votedCount = Object.keys(st.votes || {}).length;

  // mesa de reunião: cada jogador sentado ao redor (como no jogo)
  const sig = `${m.startedAt}:${st.myVote}:${isVoting}:${votedCount}:${JSON.stringify(st.votes)}`;
  if (grid.dataset.sig === sig) {
    renderChat(st);
    return;
  }
  grid.dataset.sig = sig;
  grid.className = 'vote-table';
  grid.innerHTML = '<div class="vote-oval"></div><div class="vote-center"><span>THE SKELD</span><b>QUEM É O IMPOSTOR?</b><small>' +
    `${votedCount}/${aliveCount} votaram</small></div>`;

  const players = st.players;
  const n = players.length;
  const radX = n > 8 ? 39 : 34;
  const radY = n > 8 ? 35 : 30;
  players.forEach((p, i) => {
    const ang = (-90 + (i * 360) / n) * (Math.PI / 180);
    const card = el('div', 'vote-card' + (p.alive ? '' : ' dead') + (st.myVote === p.id ? ' my-vote' : ''));
    card.dataset.id = p.id;
    card.style.left = `${50 + radX * Math.cos(ang)}%`;
    card.style.top = `${47 + radY * Math.sin(ang)}%`;
    const color = C.colors.find((c) => c.id === p.color)?.hex || '#888';
    const bean = el('div', 'vote-avatar');
    bean.innerHTML = miniBean(color);
    const name = el('div', 'vote-name', escapeHtml(p.name));
    card.append(bean, name);
    if (p.id === me.id) card.classList.add('me');
    const votesFor = Object.values(st.votes || {}).filter((v) => v === p.id).length;
    if (votesFor > 0) card.append(el('span', 'vote-votes', String(votesFor)));
    if (me.alive && !me.voted && isVoting && p.alive && p.id !== me.id) {
      card.addEventListener('click', () => socket.emit('vote', { targetId: p.id }, (res) => {
        if (res?.error) return toast(res.error);
        sfx.vote();
      }));
    }
    grid.append(card);
  });

  // pular voto
  const skipVotes = Object.values(st.votes || {}).filter((v) => v === 'skip').length;
  const skip = el('div', 'vote-skip' + (st.myVote === 'skip' ? ' my-vote' : ''));
  skip.innerHTML = `<span>Pular voto</span>${skipVotes ? `<b>${skipVotes}</b>` : ''}`;
  if (me.alive && !me.voted && isVoting) {
    skip.addEventListener('click', () => socket.emit('vote', { targetId: 'skip' }, (res) => {
      if (res?.error) return toast(res.error);
      sfx.vote();
    }));
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
const VISUAL_TASKS = [
  { match: /scan/i, kind: 'scan', task: 'SubmitScan' },
  { match: /astero/i, kind: 'asteroids', task: 'ClearAsteroids' },
  { match: /escudo/i, kind: 'shields', task: 'PrimeShields' },
];

function triggerVisualTask(text, st) {
  if (!st?.settings?.visualTasks) return;
  for (const v of VISUAL_TASKS) {
    if (!v.match.test(text)) continue;
    const console_ = (st.ship?.consoles || []).find((c) => c.task === v.task);
    if (console_) renderer.visualTask(v.kind, console_.x, console_.y);
    return;
  }
}

function updateFeed(st) {
  const feed = $('feed');
  for (const entry of st.log || []) {
    const sig = `${entry.type}:${entry.text}`;
    if (entry.type === 'chat' || C.feedSeen.has(sig)) continue;
    C.feedSeen.add(sig);
    if (entry.type === 'task') { triggerVisualTask(entry.text, st); continue; }
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
   Chat do lobby
   ================================================================ */
function renderLobbyChat(state) {
  const log = $('lobbyChatLog');
  const lines = (state.log || []).filter((l) => l.type === 'chat');
  const sig = lines.map((l) => `${l.fromId || l.from}:${l.text}`).join('|');
  if (log.dataset.sig === sig) return;
  log.dataset.sig = sig;
  log.innerHTML = '';
  for (const line of lines) {
    const color = C.colors.find((c) => c.id === line.color)?.hex || '#fff';
    const div = el('div', 'chat-line');
    div.innerHTML = `<span class="chat-who" style="color:${color}">${escapeHtml(line.from)}:</span><span class="chat-text">${escapeHtml(line.text)}</span>`;
    log.append(div);
  }
  log.scrollTop = log.scrollHeight;
}

$('lobbyChatSend').addEventListener('click', sendLobbyChat);
$('lobbyChatInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendLobbyChat(); });
function sendLobbyChat() {
  const input = $('lobbyChatInput');
  const text = input.value.trim();
  if (!text) return;
  socket.emit('chat', { text }, (res) => { if (res?.error) toast(res.error); });
  input.value = '';
}

/* ================================================================
   Mapa (Tab)
   ================================================================ */
function toggleMap(force) {
  if (force === undefined && !C.mapOpen && C.state?.state !== 'tasks') return;
  const open = force !== undefined ? force : !C.mapOpen;
  C.mapOpen = open;
  $('mapOverlay').hidden = !open;
  if (open) {
    sfx.click();
    drawMapFrame();
  }
}

function drawMapFrame() {
  if (!C.mapOpen) return;
  const st = C.state;
  if (st?.you) renderer.drawMinimap($('mapCanvas'), st, st.you, C.colors);
  requestAnimationFrame(drawMapFrame);
}

$('btnMap').addEventListener('click', () => toggleMap());
$('mapClose').addEventListener('click', () => toggleMap(false));

/* ================================================================
   Som / tela
   ================================================================ */
$('btnMute').addEventListener('click', () => {
  C.muted = !C.muted;
  sfx.init();
  sfx.setMuted(C.muted);
  $('btnMute').classList.toggle('off', C.muted);
  $('btnMute').textContent = C.muted ? 'MUDO' : 'SOM';
  savePlayer();
  if (!C.muted) sfx.click();
});
$('btnMute').classList.toggle('off', C.muted);
$('btnMute').textContent = C.muted ? 'MUDO' : 'SOM';

function flashScreen(kind = '', ms = 180) {
  const f = $('screenFlash');
  f.classList.toggle('red', kind === 'red');
  f.classList.add('on');
  setTimeout(() => f.classList.remove('on'), ms);
}

/* ================================================================
   Cinemática de ejeção
   ================================================================ */
function showEject(meeting) {
  if (!meeting || C.lastEjectAt === meeting.doneAt) return;
  C.lastEjectAt = meeting.doneAt;
  const overlay = $('ejectOverlay');
  const crew = $('ejectCrew');
  const ejected = C.state?.players.find((p) => p.id === meeting.ejectedId);
  const color = ejected ? (C.colors.find((c) => c.id === ejected.color)?.hex || '#c51111') : '#7f8ea3';
  crew.style.color = color;
  crew.style.animation = 'none';
  void crew.offsetWidth;
  crew.style.animation = '';
  overlay.hidden = false;
  sfx.eject();
  const text = $('ejectText');
  const sub = $('ejectSub');
  sub.className = 'eject-sub';
  if (meeting.tie) {
    text.textContent = 'Empate!';
    sub.textContent = 'Ninguém foi ejetado.';
    sub.classList.add('crew');
  } else if (!meeting.ejectedId) {
    text.textContent = 'Ninguém foi ejetado.';
    sub.textContent = 'A tripulação pulou o voto.';
    sub.classList.add('crew');
  } else {
    text.textContent = `${meeting.ejectedName || '???'} foi ejetado.`;
    if (meeting.ejectedRole === 'impostor') {
      sub.textContent = 'ERA O IMPOSTOR!';
      sub.classList.add('crew');
    } else if (meeting.ejectedRole === 'crew') {
      sub.textContent = 'Não era o impostor.';
    } else {
      sub.textContent = 'Papel desconhecido.';
    }
  }
  clearTimeout(C.ejectTimer);
  C.ejectTimer = setTimeout(() => { overlay.hidden = true; }, 3600);
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

/* ================================================================
   Conexão, reconexão e expulsão
   ================================================================ */
function setNet(text, ok = false, sticky = false) {
  const pill = $('netPill');
  pill.textContent = text;
  pill.classList.add('show');
  pill.classList.toggle('ok', ok);
  clearTimeout(setNet._t);
  if (!sticky) setNet._t = setTimeout(() => pill.classList.remove('show'), 1800);
}

socket.on('connect', () => {
  setNet('conectado', true);
  // tenta retomar a sessão (queda de rede / recarregar a página)
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem('impostor:session') || 'null'); } catch { /* nada */ }
  if (!C.session && saved && Date.now() - saved.at < 3 * 60 * 60 * 1000) {
    socket.emit('resume', { code: saved.code, session: saved.session }, (res) => {
      if (res?.error) {
        localStorage.removeItem('impostor:session');
        return;
      }
      C.session = res.session;
      C.code = res.code;
      C.me.color = res.color ?? C.me.color;
      if (res.state === 'lobby') {
        $('lobbyCode').textContent = res.code;
      }
      setNet('partida retomada', true);
    });
    return;
  }
  if (!C.state) refreshGames();
});

socket.on('disconnect', (reason) => {
  setNet(reason === 'io client disconnect' ? 'desconectado' : 'reconectando…', false, true);
  sfx.stopAlarm();
});

socket.on('kicked', ({ by } = {}) => {
  C.state = null;
  C.code = null;
  C.session = null;
  localStorage.removeItem('impostor:session');
  $('lobbyCode').textContent = '----';
  showScreen('home');
  toast(`Você foi removido da sala por ${by || 'host'}.`);
});
