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
  numImpostors: 1,
  confirmImpostor: true,      // Confirm Ejects
  emergencyMeetings: 1,       // Num Emergency Meetings
  anonymousVotes: true,
  taskBarMode: 1,             // 0 = sempre, 1 = reuniões, 2 = nunca
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
};

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
  chaos: {
    label: 'Caos',
    values: { numImpostors: 3, discussionTime: 0, votingTime: 45, killCooldown: 10, playerSpeed: 1.25, crewVision: 1.0, impostorVision: 2.0, numCommonTasks: 2, numLongTasks: 3, numShortTasks: 4, emergencyMeetings: 3 },
  },
};

/* Sabotagens por mapa (usa os sistemas oficiais de cada mapa). */
export const MAP_SABOTAGES = {
  skeld: ['lights', 'reactor', 'comms'],
  mira: ['lights', 'reactor', 'comms'],
  polus: ['lights', 'reactor', 'comms'],
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
  comms: {
    name: 'Comunicação',
    room: 'Comms',
    time: 30,
    desc: 'O mapa e as tarefas são desativados. Conserte na Comunicação.',
    fatal: false,
  },
};
