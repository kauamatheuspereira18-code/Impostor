/* Regras e números do Among Us, como no jogo original. */

export const GAME_CONSTANTS = {
  // Velocidade base: 1 unidade de mundo por segundo * PlayerSpeedMod
  BASE_SPEED: 2.9,
  // Distância de kill (curta/média/longa) em unidades
  KILL_DISTANCES: [1.0, 1.8, 2.5],
  // Alcance de uso de tarefas
  TASK_USE_DISTANCE: 1.3,
  // Alcance de report
  REPORT_DISTANCE: 2.2,
  // Tempo de sabotagem (segundos) — valores do jogo
  SABOTAGE_TIME: { lights: 30, reactor: 30, comms: 30, o2: 30 },
  // Cooldown de sabotagem
  SABOTAGE_COOLDOWN: 30,
  // Ventilação: tempo que o impostor pode ficar no duto sem penalidade
  VENT_TIME: 10,
  // Velocidade dentro do duto
  VENT_SPEED: 3.2,
  // Reunião
  VOTE_TIME: 120,
  DISCUSSION_STEP: 5,
  // Portas: tempo de fechamento
  DOOR_TIME: 10,
  DOOR_COOLDOWN: 30,
  // Distância que o jogador pode andar por tick (anti-cheat)
  MAX_STEP_PER_TICK: 0.55,
  TICK_HZ: 20,
};

/* Configurações padrão do lobby (iguais ao jogo, aba "Game"). */
export const DEFAULT_SETTINGS = {
  map: 'skeld',
  maxPlayers: 10,
  numImpostors: 2,
  confirmImpostor: true,      // Confirm Ejects
  emergencyMeetings: 1,       // Num Emergency Meetings
  anonymousVotes: true,
  taskBarMode: 0,             // 0 = sempre, 1 = reuniões, 2 = nunca
  visualTasks: true,
  killCooldown: 25,           // segundos
  killDistance: 1,            // índice em KILL_DISTANCES (1 = média)
  discussionTime: 15,         // segundos
  votingTime: 120,            // segundos
  playerSpeed: 1.0,
  crewVision: 1.0,
  impostorVision: 1.75,
  numCommonTasks: 1,
  numLongTasks: 1,
  numShortTasks: 2,
  emergencyCooldown: 15,
  ghostsDoTasks: true,
  rolePreset: 0,              // 0 = clássico, 1 = com papéis
  roles: {
    scientist: 0, engineer: 0, guardianAngel: 0, shapeshifter: 0,
    noisemaker: 0, phantom: 0, tracker: 0,
  },
  ability: {
    shiftDuration: 10, shiftCooldown: 25,
    phantomDuration: 5, phantomCooldown: 30,
    ventTime: 5, ventCooldown: 30,
    vitalsDrain: 12, vitalsRecharge: 6,
    trackUses: 3, trackDuration: 20, trackCooldown: 25,
    shieldDuration: 10, shieldCooldown: 60,
  },
};

/* ------------------------------------------------------------------
   Papéis do Among Us (2024) e o que cada um faz.
   team: crew | impostor. ghost: só funciona depois de morto.
   ------------------------------------------------------------------ */
export const ROLE_INFO = {
  Crewmate: {
    team: 'crew', name: 'Tripulante', key: 'crewmate',
    desc: 'Complete as tarefas ou descubra o impostor.',
  },
  Engineer: {
    team: 'crew', name: 'Engenheiro', key: 'engineer', ability: 'vent',
    desc: 'Pode entrar nos dutos por 5s. Recarga de 30s.',
    hint: 'Use o duto para escapar sem ser visto.',
  },
  Scientist: {
    team: 'crew', name: 'Cientista', key: 'scientist', ability: 'vitals',
    desc: 'Vê os vitais de todos em qualquer lugar, gastando bateria.',
    hint: 'A bateria recarrega com o tempo e ao completar tarefas.',
  },
  Noisemaker: {
    team: 'crew', name: 'Barulhento', key: 'noisemaker', passive: true,
    desc: 'Ao ser morto, dispara um alarme que todos veem e ouvem.',
    hint: 'Sua morte não passa em branco.',
  },
  Tracker: {
    team: 'crew', name: 'Rastreador', key: 'tracker', ability: 'track',
    desc: 'Marca até 3 jogadores e vê a posição deles no mapa.',
    hint: 'Marcações duram 20s e aparecem no mapa.',
  },
  'Guardian Angel': {
    team: 'crew', name: 'Anjo da Guarda', key: 'guardianAngel', ability: 'shield', ghost: true,
    desc: 'Depois de morrer, protege um vivo por 10s.',
    hint: 'Um escudo impede o próximo abate.',
  },
  Shapeshifter: {
    team: 'impostor', name: 'Metamorfo', key: 'shapeshifter', ability: 'shift',
    desc: 'Assume a aparência de outro jogador por 10s.',
    hint: 'Use para incriminar alguém. Recarga de 25s.',
  },
  Phantom: {
    team: 'impostor', name: 'Fantasma', key: 'phantom', ability: 'phantom',
    desc: 'Fica invisível por 5s (não pode matar enquanto invisível).',
    hint: 'Desapareça para escapar de testemunhas.',
  },
};

/* Números das habilidades (como no jogo). */
export const ABILITY = {
  Engineer: { ventTime: 5, cooldown: 30 },
  Scientist: { drain: 12, recharge: 6 },
  Tracker: { uses: 3, duration: 20, cooldown: 25 },
  'Guardian Angel': { shield: 10, cooldown: 60 },
  Shapeshifter: { shift: 10, cooldown: 25 },
  Phantom: { invisibility: 5, cooldown: 30 },
};

/* Campos de tempo das habilidades que o host ajusta no lobby. */
export const ABILITY_FIELDS = [
  { key: 'shiftDuration', role: 'Shapeshifter', label: 'Duração do disfarce', min: 5, max: 30, step: 1, unit: 's' },
  { key: 'shiftCooldown', role: 'Shapeshifter', label: 'Recarga do disfarce', min: 10, max: 60, step: 1, unit: 's' },
  { key: 'phantomDuration', role: 'Phantom', label: 'Tempo invisível', min: 3, max: 15, step: 1, unit: 's' },
  { key: 'phantomCooldown', role: 'Phantom', label: 'Recarga da invisibilidade', min: 10, max: 60, step: 1, unit: 's' },
  { key: 'ventTime', role: 'Engineer', label: 'Tempo no duto', min: 2, max: 15, step: 1, unit: 's' },
  { key: 'ventCooldown', role: 'Engineer', label: 'Recarga do duto', min: 10, max: 60, step: 1, unit: 's' },
  { key: 'vitalsDrain', role: 'Scientist', label: 'Consumo de bateria', min: 4, max: 30, step: 1, unit: '%/s' },
  { key: 'vitalsRecharge', role: 'Scientist', label: 'Recarga de bateria', min: 2, max: 20, step: 1, unit: '%/s' },
  { key: 'trackUses', role: 'Tracker', label: 'Marcações', min: 1, max: 5, step: 1, unit: '' },
  { key: 'trackDuration', role: 'Tracker', label: 'Duração da marca', min: 5, max: 60, step: 5, unit: 's' },
  { key: 'trackCooldown', role: 'Tracker', label: 'Recarga da marcação', min: 10, max: 60, step: 1, unit: 's' },
  { key: 'shieldDuration', role: 'Guardian Angel', label: 'Duração do escudo', min: 5, max: 30, step: 1, unit: 's' },
  { key: 'shieldCooldown', role: 'Guardian Angel', label: 'Recarga do escudo', min: 20, max: 120, step: 5, unit: 's' },
];

/* Presets de regras do jogo original (RulesPresets.json). */
export const RULE_PRESETS = {
  classic: {
    label: 'Clássico',
    values: { numImpostors: 2, discussionTime: 15, votingTime: 120, killCooldown: 25, playerSpeed: 0.75, crewVision: 1.0, impostorVision: 1.75, numCommonTasks: 1, numLongTasks: 1, numShortTasks: 2, emergencyMeetings: 1 },
  },
  casual: {
    label: 'Casual',
    values: { numImpostors: 2, discussionTime: 15, votingTime: 120, killCooldown: 30, playerSpeed: 1.0, crewVision: 1.0, impostorVision: 1.75, numCommonTasks: 1, numLongTasks: 1, numShortTasks: 2, emergencyMeetings: 2 },
  },
  expert: {
    label: 'Especialista',
    values: { numImpostors: 2, discussionTime: 30, votingTime: 60, killCooldown: 20, playerSpeed: 0.75, crewVision: 0.6, impostorVision: 1.8, numCommonTasks: 1, numLongTasks: 2, numShortTasks: 3, emergencyMeetings: 1 },
  },
  roles: {
    label: 'Com papéis',
    values: {
      numImpostors: 2, discussionTime: 15, votingTime: 120, killCooldown: 25,
      playerSpeed: 0.85, crewVision: 1.0, impostorVision: 1.75,
      numCommonTasks: 1, numLongTasks: 1, numShortTasks: 2, emergencyMeetings: 1,
      roles: { scientist: 1, engineer: 1, guardianAngel: 1, shapeshifter: 1, noisemaker: 1, phantom: 0, tracker: 1 },
    },
  },
  chaos: {
    label: 'Caos',
    values: { numImpostors: 3, discussionTime: 0, votingTime: 45, killCooldown: 10, playerSpeed: 1.25, crewVision: 1.0, impostorVision: 2.0, numCommonTasks: 2, numLongTasks: 3, numShortTasks: 4, emergencyMeetings: 3 },
  },
};

/* Sabotagens por mapa (usa os sistemas oficiais de cada mapa). */
export const MAP_SABOTAGES = {
  skeld: ['lights', 'reactor', 'comms', 'o2'],
  mira: ['lights', 'reactor', 'comms', 'o2'],
  polus: ['lights', 'reactor', 'comms', 'o2'],
  airship: ['lights', 'reactor', 'comms'],
  fungle: ['reactor', 'comms'],
};

export const SABOTAGE_INFO = {
  lights: {
    name: 'Luzes',
    room: 'Electrical',
    time: 30,
    desc: 'Tripulantes só enxergam um pequeno círculo. Conserte na Elétrica.',
    fatal: false,
  },
  reactor: {
    name: 'Reator',
    room: 'Reactor',
    time: 30,
    desc: 'O reator vai explodir. Dois tripulantes precisam segurar as alavancas.',
    fatal: true,
  },
  o2: {
    name: 'Oxigênio',
    room: 'LifeSupp',
    time: 30,
    desc: 'O oxigênio acabou. Dois tripulantes precisam consertar os filtros.',
    fatal: true,
  },
  comms: {
    name: 'Comunicação',
    room: 'Comms',
    time: 30,
    desc: 'O mapa e as tarefas são desativados. Conserte na Comunicação.',
    fatal: false,
  },
};
