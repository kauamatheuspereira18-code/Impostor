/**
 * Gera play/shared/mapdata.js a partir dos dados oficiais do jogo que vivem em
 * src/Impostor.Api/Innersloth/Data (versão do jogo: ver Data/info.json).
 *
 * Uso: node tools/extract-mapdata.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', '..', 'src', 'Impostor.Api', 'Innersloth', 'Data');
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

const info = readJson(path.join(dataDir, 'info.json'));
const colorTypes = readJson(path.join(dataDir, 'enums', 'ColorType.json'));
const systemTypes = readJson(path.join(dataDir, 'enums', 'SystemTypes.json'));
const taskTypes = readJson(path.join(dataDir, 'enums', 'TaskTypes.json'));

// Cores oficiais (ordem = índice do ColorType). Valores da paleta do jogo.
const PALETTE = [
  '#C51111', '#132ED1', '#117F2D', '#ED54BA', '#EF7D0D', '#F5F557',
  '#3F474E', '#D6E0F0', '#783DD2', '#71491E', '#38FEDC', '#50EF39',
  '#6B2FBB', '#EC54BB', '#FFE55C', '#8394BF', '#928776', '#EC7578',
];
const VISOR = [
  '#7A0838', '#0A2B7C', '#0A4A22', '#A9227F', '#A04E06', '#B4B424',
  '#171C22', '#8FA0B8', '#4B1F8C', '#4A2E10', '#1FA995', '#2EA31F',
  '#3E1A6E', '#8F2F73', '#9C8A2A', '#4A5570', '#554E45', '#8F3F42',
];
const PT_NAMES = [
  'Vermelho', 'Azul', 'Verde', 'Rosa', 'Laranja', 'Amarelo', 'Preto', 'Branco',
  'Roxo', 'Marrom', 'Ciano', 'Lima', 'Vinho', 'Rosé', 'Banana', 'Cinza', 'Bege', 'Coral',
];

const colors = Object.entries(colorTypes)
  .filter(([name]) => !['Fortegreen', 'CrewmateBlue'].includes(name))
  .map(([name, id]) => ({
    id: id,
    key: name.toLowerCase(),
    name: PT_NAMES[id] || name,
    hex: PALETTE[id] || '#C51111',
    visor: VISOR[id] || '#7A0838',
  }));

// Nome em português das salas (SystemTypes oficiais do Skeld)
const ROOM_PT = {
  Hallway: 'Corredor', Storage: 'Almoxarifado', Cafeteria: 'Cafeteria', Reactor: 'Reator',
  UpperEngine: 'Motor Superior', Nav: 'Navegação', Admin: 'Admin', Electrical: 'Elétrica',
  LifeSupp: 'Suporte Vital', Shields: 'Escudos', MedBay: 'Enfermaria', Security: 'Segurança',
  Weapons: 'Armas', LowerEngine: 'Motor Inferior', Comms: 'Comunicação', ShipTasks: 'Tarefas',
  Doors: 'Portas', Sabotage: 'Sabotagem', Decontamination: 'Descontaminação',
  Launchpad: 'Plataforma', LockerRoom: 'Vestiário', Laboratory: 'Laboratório', Balcony: 'Varanda',
  Office: 'Escritório', Greenhouse: 'Estufa', Dropship: 'Nave', Outside: 'Exterior',
  Specimens: 'Espécimes', BoilerRoom: 'Caldeira', VaultRoom: 'Cofre', Cockpit: 'Cabine',
  Armory: 'Arsenal', Kitchen: 'Cozinha', ViewingDeck: 'Deque', HallOfPortraits: 'Galeria',
  CargoBay: 'Cargueiro', Ventilation: 'Ventilação', Showers: 'Chuveiros', Engine: 'Motor',
  Brig: 'Cela', MeetingRoom: 'Sala de Reunião', Records: 'Arquivos', Lounge: 'Salão',
  GapRoom: 'Vão', MainHall: 'Salão Principal', Medical: 'Médico', Zipline: 'Tirolesa',
  MiningPit: 'Mina', FishingDock: 'Píer', RecRoom: 'Recreação', Lookout: 'Mirante',
  Beach: 'Praia', Highlands: 'Planalto', Jungle: 'Selva', SleepingQuarters: 'Dormitórios',
};

// Tarefas oficiais do Skeld (nome PT, console, tipo de minigame)
const TASK_META = {
  FixWiring: { name: 'Consertar Fiação', game: 'wires' },
  SwipeCard: { name: 'Passar o Cartão', game: 'swipecard' },
  UploadData: { name: 'Enviar Dados', game: 'upload' },
  CalibrateDistributor: { name: 'Calibrar Distribuidor', game: 'calibrate' },
  DivertPower: { name: 'Desviar Energia', game: 'divert' },
  CleanO2Filter: { name: 'Limpar Filtro de O2', game: 'o2filter' },
  StabilizeSteering: { name: 'Estabilizar Direção', game: 'steering' },
  PrimeShields: { name: 'Ativar Escudos', game: 'multistep' },
  StartReactor: { name: 'Iniciar Reator', game: 'reactor' },
  UnlockManifolds: { name: 'Destravar Manifolds', game: 'manifolds' },
  SubmitScan: { name: 'Enviar Scan', game: 'scan' },
  InspectSample: { name: 'Inspecionar Amostra', game: 'sample' },
  ClearAsteroids: { name: 'Destruir Asteroides', game: 'asteroids' },
  AlignEngineOutput: { name: 'Alinhar Motor', game: 'alignengine' },
  FuelEngines: { name: 'Abastecer Motores', game: 'fuel' },
  EmptyChute: { name: 'Esvaziar Lixo (Chute)', game: 'garbage' },
  EmptyGarbage: { name: 'Esvaziar Lixo', game: 'garbage' },
  ChartCourse: { name: 'Traçar Curso', game: 'chart' },
};

// Consoles das tarefas multi-parte que o JSON do dump não traz
const EXTRA_CONSOLES = {
  FuelEngines: [
    { id: 900, room: 'Storage', x: -2.0, y: -9.6, usableDistance: 1 },
    { id: 901, room: 'UpperEngine', x: -19.2, y: -1.2, usableDistance: 1 },
    { id: 902, room: 'LowerEngine', x: -19.2, y: -11.6, usableDistance: 1 },
  ],
  EmptyChute: [{ id: 910, room: 'Storage', x: -3.4, y: -11.6, usableDistance: 1 }],
  EmptyGarbage: [{ id: 911, room: 'Storage', x: 1.4, y: -12.2, usableDistance: 1 }],
  ChartCourse: [{ id: 912, room: 'Nav', x: 16.0, y: -2.2, usableDistance: 1 }],
};

function loadMap(folder) {
  const tasks = readJson(path.join(dataDir, 'maps', folder, 'tasks.json'));
  const vents = readJson(path.join(dataDir, 'maps', folder, 'vents.json'));
  const doors = readJson(path.join(dataDir, 'maps', folder, 'doors.json'));
  const spawn = readJson(path.join(dataDir, 'maps', folder, 'spawn.json'));
  const systems = readJson(path.join(dataDir, 'maps', folder, 'systems.json'));

  const taskList = [];
  const seenTask = new Set();
  for (const [id, t] of Object.entries(tasks)) {
    const meta = TASK_META[t.taskType];
    if (!meta) continue;
    let consoles = t.consoles.map((c) => ({
      id: c.id, room: c.room, x: c.position.x, y: c.position.y, usableDistance: c.usableDistance,
    }));
    if (!consoles.length && EXTRA_CONSOLES[t.taskType]) consoles = EXTRA_CONSOLES[t.taskType];
    if (!consoles.length) continue;
    // evita duplicar a mesma tarefa varias vezes (UploadData/DivertPower tem copias por sala)
    const sig = t.taskType + ':' + consoles.map((c) => c.room).join(',');
    if (seenTask.has(sig)) continue;
    seenTask.add(sig);
    taskList.push({
      id: Number(id),
      taskType: t.taskType,
      name: meta.name,
      game: meta.game,
      length: t.length,
      consoles,
    });
  }

  const ventList = Object.entries(vents).map(([id, v]) => ({
    id: Number(id),
    name: v.name,
    x: v.position.x,
    y: v.position.y,
    links: [v.left, v.center, v.right].filter((n) => n !== null && n !== undefined),
  }));

  const doorList = Object.entries(doors).map(([id, d]) => ({
    id: Number(id), room: d.room, x: d.position.x, y: d.position.y,
  }));

  const roomSet = new Set();
  for (const t of taskList) for (const c of t.consoles) roomSet.add(c.room);
  for (const d of doorList) roomSet.add(d.room);

  return {
    folder,
    spawn: {
      initial: spawn.initialSpawnCenter,
      meeting: spawn.meetingSpawnCenter,
      meeting2: spawn.meetingSpawnCenter2,
      radius: spawn.spawnRadius,
    },
    systems,
    rooms: [...roomSet].sort(),
    tasks: taskList,
    vents: ventList,
    doors: doorList,
  };
}

const maps = {};
for (const folder of ['Skeld', 'Mira', 'Polus', 'Airship', 'Fungle']) {
  maps[folder.toLowerCase()] = loadMap(folder);
}

const out = `/* GERADO por tools/extract-mapdata.mjs — não edite à mão.
 * Fonte: src/Impostor.Api/Innersloth/Data (jogo ${info.gameVersion})
 * Inclui tarefas com posições reais, dutos, portas e spawns oficiais.
 */
export const GAME_DATA_VERSION = ${JSON.stringify(info.gameVersion)};

export const COLORS = ${JSON.stringify(colors)};

export const ROOM_NAMES_PT = ${JSON.stringify(ROOM_PT)};

export const SYSTEM_TYPES = ${JSON.stringify(systemTypes)};

export const TASK_TYPES = ${JSON.stringify(taskTypes)};

export const MAPS = ${JSON.stringify(maps)};

export const DEFAULT_MAP = 'skeld';
`;

writeFileSync(path.join(__dirname, '..', 'shared', 'mapdata.js'), out);
const total = Object.values(maps).reduce((a, m) => a + m.tasks.length, 0);
console.log(`mapdata.js gerado — jogo ${info.gameVersion}, ${Object.keys(maps).length} mapas, ${total} tarefas`);
for (const [k, m] of Object.entries(maps)) {
  console.log(`  ${k}: ${m.tasks.length} tarefas, ${m.vents.length} dutos, ${m.doors.length} portas, ${m.rooms.length} salas`);
}
