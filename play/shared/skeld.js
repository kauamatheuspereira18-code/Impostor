/* Geometria jogável do mapa Skeld ("The Skeld").
 *
 * Todas as âncoras (consoles de tarefa, dutos, portas, spawn) vêm dos dados
 * oficiais em shared/mapdata.js, extraídos de src/Impostor.Api/Innersloth/Data.
 * Os retângulos abaixo foram posicionados para conter essas âncoras, mantendo o
 * formato reconhecível do navio.
 *
 * Unidades = unidades de mundo do jogo. +x direita, +y cima.
 * Cada retângulo é { x1, y1, x2, y2 } e a área caminhável é a UNIÃO deles.
 */

export const ROOMS = [
  {
    id: 'Cafeteria',
    name: 'Cafeteria',
    radius: 1.9,
    parts: [[-7.6, -2.6, 6.2, 7.2]],
    props: [
      { type: 'table', x: -0.72, y: 1.4, r: 0.95 },
      { type: 'chair', x: -2.0, y: 0.6 }, { type: 'chair', x: 0.6, y: 0.6 },
      { type: 'chair', x: -2.0, y: 2.4 }, { type: 'chair', x: 0.6, y: 2.4 },
      { type: 'plant', x: -6.9, y: 6.5 },
      { type: 'plant', x: 5.5, y: 6.5 },
      { type: 'trash', x: 4.3, y: -0.3 },
      { type: 'bench', x: -5.6, y: -1.2, w: 2.0, h: 0.7 },
      { type: 'bench', x: 4.4, y: 4.6, w: 2.0, h: 0.7 },
    ],
  },
  {
    id: 'Weapons',
    name: 'Armas',
    radius: 1.3,
    parts: [[7.6, -0.6, 11.6, 4.2]],
    props: [
      { type: 'crate', x: 10.9, y: 0.3, w: 1.1, h: 1.1 },
    ],
  },
  {
    id: 'Nav',
    name: 'Navegação',
    radius: 1.4,
    parts: [[13.8, -7.4, 19.8, -1.6]],
    props: [
    ],
  },
  {
    id: 'Shields',
    name: 'Escudos',
    radius: 1.3,
    parts: [[7.6, -16.6, 13.4, -11.8]],
    props: [
      { type: 'shieldGen', x: 11.6, y: -15.2, r: 1.3 },
      { type: 'crate', x: 12.6, y: -12.6, w: 1.0, h: 1.0 },
    ],
  },
  {
    id: 'Comms',
    name: 'Comunicações',
    radius: 1.3,
    parts: [[3.6, -15.6, 7.6, -10.8]],
    props: [
      { type: 'panel', x: 7.1, y: -12.2, w: 1.2, h: 0.5 },
    ],
  },
  {
    id: 'Admin',
    name: 'Administração',
    radius: 1.4,
    parts: [[0.6, -11.2, 6.4, -5.6]],
    props: [
      { type: 'table', x: 3.5, y: -8.3, r: 0.95 },
    ],
  },
  {
    id: 'Storage',
    name: 'Armazém',
    radius: 1.7,
    parts: [[-4.6, -14.8, 3.2, -7.2]],
    props: [
      { type: 'crate', x: -3.6, y: -13.2, w: 1.2, h: 1.2 },
      { type: 'crate', x: -2.2, y: -13.8, w: 1.0, h: 1.0 },
      { type: 'crate', x: 1.6, y: -13.4, w: 1.2, h: 1.2 },
      { type: 'fuel', x: -4.0, y: -9.4, w: 1.1, h: 1.1 },
    ],
  },
  {
    id: 'Electrical',
    name: 'Elétrica',
    radius: 1.5,
    parts: [[-10.6, -9.4, -4.6, -5.4]],
    props: [
      { type: 'panel', x: -8.6, y: -5.9, w: 1.3, h: 0.5 },
    ],
  },
  {
    id: 'MedBay',
    name: 'Enfermaria',
    radius: 1.4,
    parts: [[-11.6, -6.4, -5.0, -2.6]],
    props: [
      { type: 'bed', x: -9.4, y: -3.3, w: 1.6, h: 1.0 },
      { type: 'bed', x: -7.4, y: -3.3, w: 1.6, h: 1.0 },
    ],
  },
  {
    id: 'Security',
    name: 'Segurança',
    radius: 1.2,
    parts: [[-16.4, -8.2, -11.4, -3.6]],
    props: [
      { type: 'table', x: -14.2, y: -6.0, r: 0.85 },
    ],
  },
  {
    id: 'UpperEngine',
    name: 'Motor Superior',
    radius: 1.4,
    parts: [[-21.4, -2.6, -14.6, 3.6]],
    props: [
      { type: 'engine', x: -19.4, y: 1.6, r: 1.7 },
    ],
  },
  {
    id: 'LowerEngine',
    name: 'Motor Inferior',
    radius: 1.4,
    parts: [[-21.4, -15.0, -14.6, -10.0]],
    props: [
      { type: 'engine', x: -19.4, y: -12.6, r: 1.7 },
    ],
  },
  {
    id: 'Reactor',
    name: 'Reator',
    radius: 1.5,
    parts: [[-23.6, -8.2, -18.2, -1.6]],
    props: [
      { type: 'reactor', x: -21.0, y: -4.6, r: 1.6 },
    ],
  },
  {
    id: 'LifeSupp',
    name: 'Suporte Vital',
    radius: 1.2,
    parts: [[4.9, -4.6, 8.4, -0.6]],
    props: [
      { type: 'panel', x: 7.9, y: -3.9, w: 1.2, h: 0.5 },
    ],
  },
];

/* Corredores: ligam as salas e definem o labirinto (topologia do Skeld). */
export const CORRIDORS = [
  // oeste: Reator/Motores <-> Cafeteria
  { id: 'hallWest', parts: [[-15.4, 0.6, -7.6, 2.6], [-18.6, 0.6, -15.4, 2.6]] },
  { id: 'hallWestToMed', parts: [[-12.0, -3.0, -8.6, -0.2]] },
  { id: 'hallCafeToMed', parts: [[-9.2, -2.6, -7.0, -1.2]] },
  { id: 'hallSecurity', parts: [[-14.6, -4.6, -11.4, -2.6]] },
  { id: 'hallReactorUpper', parts: [[-20.4, -1.6, -18.2, 2.6]] },
  { id: 'hallReactorLower', parts: [[-20.4, -11.6, -18.2, -6.0]] },
  { id: 'hallSecurityLow', parts: [[-17.2, -10.2, -11.0, -8.2]] },
  // central: Cafeteria <-> Admin/Elétrica/Almoxarifado
  { id: 'hallCentral', parts: [[-1.8, -7.2, 1.2, -2.6]] },
  { id: 'hallAdmin', parts: [[4.4, -5.6, 6.0, -2.6]] },
  { id: 'hallElec', parts: [[-8.0, -6.4, -6.0, -4.6], [-7.2, -10.6, -5.4, -8.6]] },
  { id: 'hallCafeToLife', parts: [[5.4, -1.4, 7.4, -0.6]] },
  // leste
  { id: 'hallWeapons', parts: [[6.2, 1.0, 8.6, 2.8]] },
  { id: 'hallEast', parts: [[8.4, -6.2, 13.8, -4.2]] },
  { id: 'hallNav', parts: [[12.6, -4.2, 15.0, -2.2]] },
  { id: 'hallLifeSupp', parts: [[7.4, -4.6, 8.4, -1.4]] },
  // sul
  { id: 'hallStorageEngine', parts: [[-15.4, -14.6, -4.6, -11.0]] },
  { id: 'hallStorageSouth', parts: [[-2.6, -11.0, 0.4, -8.6]] },
  { id: 'hallStorageComms', parts: [[-1.2, -12.4, 3.9, -10.6]] },
  { id: 'hallShieldsStorage', parts: [[3.2, -13.6, 6.4, -11.8]] },
  { id: 'hallShields', parts: [[7.4, -15.0, 9.2, -11.8]] },
  { id: 'hallCommsAdmin', parts: [[4.6, -11.4, 6.2, -10.4]] },
];

export const EMERGENCY = { x: -0.72, y: 0.62, radius: 2.6 };

export const VIEW = { x1: -27, y1: -18.5, x2: 22.5, y2: 10.5 };
