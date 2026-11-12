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
    parts: [[-8.6, -2.4, 7.4, 8]],
    props: [
      { type: 'table', x: -0.72, y: 0.62, r: 1.85 },
      { type: 'console', x: -5.3, y: 5.2, w: 1.3, h: 0.7, label: 'wiring' },
      { type: 'plant', x: -7.6, y: 7.2 },
      { type: 'plant', x: 6.4, y: 7.2 },
      { type: 'trash', x: 6.6, y: -1.4 },
      { type: 'bench', x: -6.8, y: -1.2, w: 2.4, h: 0.9 },
      { type: 'bench', x: 5.6, y: 5.6, w: 2.4, h: 0.9 },
    ],
  },
  {
    id: 'Weapons',
    name: 'Armas',
    radius: 1.2,
    parts: [[8.4, 0.2, 12.8, 5]],
    props: [
      { type: 'console', x: 9.1, y: 1.8, w: 1.5, h: 1, label: 'asteroids' },
      { type: 'crate', x: 11.6, y: 4.2, w: 1.6, h: 1.2 },
      { type: 'crate', x: 11.8, y: 0.9, w: 1.2, h: 1 },
    ],
  },
  {
    id: 'Nav',
    name: 'Navegação',
    radius: 1.2,
    parts: [[11.8, -7.8, 20.4, -0.6]],
    props: [
      { type: 'console', x: 14.5, y: -3.8, w: 1.2, h: 0.8, label: 'wiring' },
      { type: 'console', x: 16.0, y: -2.2, w: 1.6, h: 0.9, label: 'chart' },
      { type: 'console', x: 18.7, y: -4.7, w: 1.4, h: 0.9, label: 'steering' },
      { type: 'window', x: 20.0, y: -4.2, w: 0.7, h: 5.2 },
      { type: 'plant', x: 12.6, y: -1.4 },
    ],
  },
  {
    id: 'Admin',
    name: 'Admin',
    radius: 0.9,
    parts: [
      [1.0, -8.6, 7.6, -5.4],
      [2.6, -9.9, 7.6, -8.4],
    ],
    props: [
      { type: 'table', x: 4.4, y: -7.0, r: 1.25 },
      { type: 'console', x: 5.6, y: -8.6, w: 1.3, h: 0.8, label: 'swipecard' },
      { type: 'console', x: 2.5, y: -6.3, w: 1.4, h: 0.8, label: 'upload' },
      { type: 'console', x: 1.4, y: -6.4, w: 1.1, h: 0.7, label: 'wiring' },
      { type: 'plant', x: 6.9, y: -5.9 },
    ],
  },
  {
    id: 'Storage',
    name: 'Almoxarifado',
    radius: 1.5,
    parts: [[-5.4, -14.9, 2.4, -8.6]],
    props: [
      { type: 'console', x: -1.9, y: -8.7, w: 1.3, h: 0.7, label: 'wiring' },
      { type: 'console', x: -2.0, y: -9.6, w: 1.5, h: 0.9, label: 'fuel' },
      { type: 'console', x: -3.4, y: -11.6, w: 1.4, h: 1, label: 'chute' },
      { type: 'console', x: 1.4, y: -12.2, w: 1.5, h: 1, label: 'garbage' },
      { type: 'crate', x: -4.4, y: -13.9, w: 1.4, h: 1.2 },
      { type: 'crate', x: 1.2, y: -14.2, w: 1.5, h: 1 },
      { type: 'crate', x: -4.2, y: -9.9, w: 1.2, h: 1 },
    ],
  },
  {
    id: 'Electrical',
    name: 'Elétrica',
    radius: 1.1,
    parts: [[-11.6, -9.9, -5.6, -6.9]],
    props: [
      { type: 'console', x: -7.7, y: -7.7, w: 1.4, h: 0.8, label: 'wiring' },
      { type: 'console', x: -5.9, y: -7.5, w: 1.2, h: 0.8, label: 'calibrate' },
      { type: 'console', x: -9.0, y: -7.3, w: 1.5, h: 0.8, label: 'divert' },
      { type: 'panel', x: -9.6, y: -9.4, w: 2.2, h: 0.6 },
      { type: 'panel', x: -6.4, y: -9.4, w: 2.2, h: 0.6 },
    ],
  },
  {
    id: 'MedBay',
    name: 'Enfermaria',
    radius: 1.4,
    parts: [[-11.4, -6.6, -4.2, -2.6]],
    props: [
      { type: 'console', x: -7.3, y: -5.2, w: 1.6, h: 1, label: 'scan' },
      { type: 'console', x: -6.1, y: -4.3, w: 1.4, h: 1, label: 'sample' },
      { type: 'bed', x: -10.2, y: -5.6, w: 1.2, h: 2.2 },
      { type: 'bed', x: -10.2, y: -3.4, w: 1.2, h: 1.6 },
      { type: 'plant', x: -4.8, y: -6.1 },
    ],
  },
  {
    id: 'Security',
    name: 'Segurança',
    radius: 1,
    parts: [[-17.8, -8.0, -12.0, -3.4]],
    props: [
      { type: 'console', x: -15.6, y: -4.6, w: 1.4, h: 0.9, label: 'wiring' },
      { type: 'cameras', x: -17.2, y: -7.4, w: 1.6, h: 0.6 },
      { type: 'chair', x: -15.4, y: -6.4 },
    ],
  },
  {
    id: 'Reactor',
    name: 'Reator',
    radius: 1.4,
    parts: [[-25.2, -10.0, -19.6, -1.2]],
    props: [
      { type: 'console', x: -21.8, y: -5.6, w: 1.8, h: 1.2, label: 'reactor' },
      { type: 'console', x: -22.5, y: -2.5, w: 1.4, h: 1, label: 'manifolds' },
      { type: 'reactorCore', x: -24.0, y: -6.4, r: 1.5 },
      { type: 'reactorCore', x: -24.0, y: -2.6, r: 1.5 },
    ],
  },
  {
    id: 'UpperEngine',
    name: 'Motor Superior',
    radius: 1.4,
    parts: [[-19.6, -4.0, -15.0, 3.8]],
    props: [
      { type: 'console', x: -19.2, y: -0.4, w: 1.6, h: 1.2, label: 'engine' },
      { type: 'turbine', x: -17.2, y: 2.6, r: 1.6 },
      { type: 'crate', x: -16.2, y: -3.2, w: 1.2, h: 1 },
    ],
  },
  {
    id: 'LowerEngine',
    name: 'Motor Inferior',
    radius: 1.4,
    parts: [[-21.0, -15.6, -15.0, -10.0]],
    props: [
      { type: 'console', x: -19.2, y: -12.6, w: 1.6, h: 1.2, label: 'engine' },
      { type: 'turbine', x: -17.2, y: -13.6, r: 1.6 },
      { type: 'crate', x: -16.0, y: -10.8, w: 1.2, h: 1 },
    ],
  },
  {
    id: 'Shields',
    name: 'Escudos',
    radius: 1.4,
    parts: [[4.4, -16.4, 11.6, -11.6]],
    props: [
      { type: 'console', x: 7.5, y: -14.0, w: 1.6, h: 1.2, label: 'shields' },
      { type: 'shieldGen', x: 10.4, y: -15.2, r: 1.5 },
      { type: 'crate', x: 5.4, y: -15.6, w: 1.2, h: 1.2 },
    ],
  },
  {
    id: 'LifeSupp',
    name: 'Suporte Vital',
    radius: 1,
    parts: [[5.0, -5.0, 8.8, -2.6]],
    props: [
      { type: 'console', x: 5.7, y: -3.0, w: 1.4, h: 1, label: 'o2' },
      { type: 'panel', x: 7.9, y: -4.4, w: 1.4, h: 0.5 },
    ],
  },
];

/* Corredores: ligam salas e definem o labirinto. */
export const CORRIDORS = [
  { id: 'hallWest', parts: [[-15.2, 0.3, -8.6, 2.4]] },
  { id: 'hallWeapons', parts: [[7.4, 0.4, 8.4, 2.4]] },
  { id: 'hallCentral', parts: [[-1.8, -8.6, 0.4, -2.4]] },
  { id: 'hallAdmin', parts: [[2.2, -5.4, 4.2, -2.4]] },
  { id: 'hallEast', parts: [[7.6, -7.6, 11.8, -5.6]] },
  { id: 'hallNav', parts: [[10.4, -11.6, 13.2, -7.8]] },
  { id: 'hallShieldsStorage', parts: [[2.4, -13.0, 4.4, -11.0]] },
  { id: 'hallLifeSupp', parts: [[6.0, -5.6, 7.8, -5.0]] },
  { id: 'hallStorageEngine', parts: [[-15.0, -13.4, -5.4, -11.4]] },
  { id: 'hallElec', parts: [
    [-9.6, -13.6, -5.4, -11.4],
    [-9.6, -11.4, -7.6, -9.9],
  ] },
  { id: 'hallReactorUpper', parts: [[-19.6, -3.2, -18.2, 0.6]] },
  { id: 'hallReactorLower', parts: [[-19.6, -12.4, -18.4, -10.0]] },
  { id: 'hallSecurity', parts: [[-16.6, -3.4, -14.4, 0.3]] },
  { id: 'hallSecurityLow', parts: [[-17.6, -10.0, -12.6, -8.0]] },
  { id: 'hallMedbay', parts: [
    [-4.2, -4.6, -2.6, -3.4],
  ] },
  { id: 'hallWestToMed', parts: [
    [-11.4, -3.4, -9.4, -1.2],
  ] },
  { id: 'hallCafeToMed', parts: [[-10.4, -2.4, -8.6, 0.3]] },
];

export const EMERGENCY = { x: -0.72, y: 0.62, radius: 2.6 };

export const VIEW = { x1: -27, y1: -18.5, x2: 22.5, y2: 10.5 };
