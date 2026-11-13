/* Plantas das salas do Skeld.
 *
 * Cada sala tem uma planta própria (não é uma caixa): o jogador anda dentro
 * do contorno e as paredes são desenhadas a partir do mesmo polígono.
 *
 * Âncoras: todos os consoles, dutos e portas vêm dos dados oficiais em
 * shared/mapdata.js (src/Impostor.Api/Innersloth/Data) e cada polígono foi
 * construído para conter as âncoras da sua sala. A ferramenta
 * tools/validate-map.mjs garante que nada ficou fora.
 *
 * Coordenadas = unidades de mundo do jogo. +x direita, +y cima.
 */

/* Atalhos para deixar as plantas legíveis. */
const rect = (x1, y1, x2, y2) => ({ type: 'poly', points: [[x1, y1], [x2, y1], [x2, y2], [x1, y2]] });
const poly = (...points) => ({ type: 'poly', points });

/* ------------------------------------------------------------------ */
/* Salas                                                              */
/* ------------------------------------------------------------------ */
export const ROOM_PLANS = [
  {
    id: 'Cafeteria',
    name: 'Cafeteria',
    // grande, octogonal, com a mesa de reunião no meio e o botão de emergência
    shapes: [
      poly([-7.6, -1.2], [-6.2, -2.6], [4.8, -2.6], [6.2, -1.2], [6.2, 5.6], [4.8, 7.2], [-6.2, 7.2], [-7.6, 5.6]),
    ],
    anchors: { emergency: true, consoleRoom: true },
  },
  {
    id: 'Weapons',
    name: 'Armas',
    // sala de armas: retângulo com o canto nordeste cortado
    shapes: [poly([7.6, -0.6], [11.6, -0.6], [11.6, 2.6], [10.2, 4.2], [7.6, 4.2])],
    anchors: { consoleRoom: true, vents: ['WeaponsVent'] },
  },
  {
    id: 'LifeSupp',
    name: 'Suporte Vital',
    shapes: [poly([4.9, -4.7], [8.5, -4.7], [8.5, -1.4], [7.2, -0.5], [4.9, -0.5])],
    anchors: { consoleRoom: true },
  },
  {
    id: 'Nav',
    name: 'Navegação',
    // ponta da nave: formato de "bico"
    shapes: [poly([13.8, -7.4], [17.4, -7.4], [19.9, -4.6], [17.4, -1.6], [13.8, -1.6])],
    anchors: { consoleRoom: true, vents: ['NavVentNorth', 'NavVentSouth'] },
  },
  {
    id: 'Shields',
    name: 'Escudos',
    shapes: [poly([8.4, -18.4], [14.2, -18.4], [14.2, -13.2], [8.4, -13.2])],
    anchors: { consoleRoom: true, vents: ['ShieldsVent'] },
  },
  {
    id: 'Comms',
    name: 'Comunicações',
    shapes: [poly([2.6, -18.2], [7.4, -18.2], [7.4, -13.4], [2.6, -13.4])],
    anchors: {},
  },
  {
    id: 'Admin',
    name: 'Administração',
    // sala em L, com o mapa da nave na parede
    shapes: [poly([1.9, -11.0], [6.6, -11.0], [6.6, -5.4], [1.9, -5.4])],
    anchors: { consoleRoom: true, vents: ['AdminVent'] },
  },
  {
    id: 'Storage',
    name: 'Armazém',
    shapes: [poly([-5.4, -15.0], [1.6, -15.0], [1.6, -6.8], [-5.4, -6.8])],
    anchors: { consoleRoom: true },
  },
  {
    id: 'Electrical',
    name: 'Elétrica',
    shapes: [poly([-10.6, -9.4], [-4.6, -9.4], [-4.6, -6.6], [-10.6, -6.6])],
    anchors: { consoleRoom: true, vents: ['ElecVent'] },
  },
  {
    id: 'MedBay',
    name: 'Enfermaria',
    shapes: [poly([-11.6, -5.0], [-5.0, -5.0], [-5.0, -2.6], [-11.6, -2.6])],
    anchors: { consoleRoom: true, vents: ['MedVent'] },
  },
  {
    id: 'Security',
    name: 'Segurança',
    shapes: [poly([-16.4, -8.2], [-11.4, -8.2], [-11.4, -3.6], [-16.4, -3.6])],
    anchors: { consoleRoom: true, vents: ['SecurityVent'] },
  },
  {
    id: 'UpperEngine',
    name: 'Motor Superior',
    shapes: [poly([-21.4, -2.6], [-14.6, -2.6], [-14.6, 3.6], [-21.4, 3.6])],
    anchors: { consoleRoom: true, vents: ['LEngineVent'] },
  },
  {
    id: 'LowerEngine',
    name: 'Motor Inferior',
    shapes: [poly([-21.4, -15.0], [-14.6, -15.0], [-14.6, -10.0], [-21.4, -10.0])],
    anchors: { consoleRoom: true, vents: ['REngineVent'] },
  },
  {
    id: 'Reactor',
    name: 'Reator',
    // sala do reator: dois módulos ligados
    shapes: [
      poly([-23.6, -8.2], [-18.2, -8.2], [-18.2, -1.6], [-23.6, -1.6]),
    ],
    anchors: { consoleRoom: true, vents: ['ReactorVent', 'UpperReactorVent'] },
  },
];

/* ------------------------------------------------------------------ */
/* Corredores: cada um é uma faixa (ou conjunto de faixas) de chão.    */
/* ------------------------------------------------------------------ */
export const CORRIDOR_PLANS = [
  { id: 'hallWest', shapes: [rect(-18.6, 0.9, -7.6, 2.7)] },
  { id: 'hallWestToMed', shapes: [rect(-12.0, -3.0, -8.6, 0.0)] },
  { id: 'hallCafeToMed', shapes: [rect(-9.2, -2.6, -7.0, 0.0)] },
  { id: 'hallSecurity', shapes: [rect(-14.6, -4.6, -11.4, -2.6)] },
  { id: 'hallReactorUpper', shapes: [rect(-20.4, -1.6, -18.2, 2.6)] },
  { id: 'hallReactorLower', shapes: [rect(-20.4, -11.4, -18.2, -6.2)] },
  { id: 'hallSecurityLow', shapes: [rect(-17.2, -10.0, -11.0, -8.4)] },
  { id: 'hallCentral', shapes: [rect(-1.4, -7.4, 0.6, -2.4)] },
  { id: 'hallAdmin', shapes: [rect(4.6, -5.6, 6.0, -2.4)] },
  { id: 'hallAdminStorage', shapes: [rect(1.1, -7.4, 2.7, -5.6)] },
  { id: 'hallElec', shapes: [rect(-7.9, -6.7, -5.9, -4.4), rect(-7.0, -10.9, -4.4, -8.8), rect(-5.2, -8.8, -4.4, -6.4)] },
  { id: 'hallCafeToLife', shapes: [rect(5.4, -1.4, 7.4, -0.6)] },
  { id: 'hallWeapons', shapes: [rect(6.2, 1.0, 8.6, 2.8)] },
  { id: 'hallEast', shapes: [rect(8.4, -6.8, 13.8, -4.2)] },
  { id: 'hallNav', shapes: [rect(12.6, -4.2, 15.0, -2.2)] },
  { id: 'hallLifeSupp', shapes: [rect(7.4, -4.6, 8.4, -1.4)] },
  { id: 'hallStorageEngine', shapes: [rect(-15.4, -14.0, -4.6, -12.2)] },
  { id: 'hallStorageSouth', shapes: [rect(-2.6, -11.0, 0.4, -8.6)] },
  // Armazém -> Comunicações (saída lateral direita do armazém)
  { id: 'hallStorageComms', shapes: [rect(1.2, -16.2, 2.9, -14.2)] },
  // Comunicações -> Escudos
  { id: 'hallCommsShields', shapes: [rect(7.2, -16.2, 8.6, -14.2)] },
  // Escudos -> corredor leste -> Navegação
  { id: 'hallShieldsNav', shapes: [rect(9.0, -13.5, 10.8, -8.2), rect(9.0, -8.2, 14.2, -6.4)] },
  // Administração -> Comunicações (descida até a porta de Comms)
  { id: 'hallCommsAdmin', shapes: [rect(4.6, -13.7, 6.2, -10.9)] },
];

/* ------------------------------------------------------------------ */
/* Props: só o que é decoração; consoles e dutos vêm dos dados.       */
/* ------------------------------------------------------------------ */
export const ROOM_PROPS = {
  Cafeteria: [
    { type: 'table', x: -0.72, y: 1.35, r: 1.0 },
    { type: 'chair', x: -2.05, y: 0.55 }, { type: 'chair', x: 0.65, y: 0.55 },
    { type: 'chair', x: -2.05, y: 2.35 }, { type: 'chair', x: 0.65, y: 2.35 },
    { type: 'window', x: -7.5, y: 2.2, w: 0.4, h: 4.6 },
    { type: 'window', x: 6.1, y: 2.2, w: 0.4, h: 4.6 },
    { type: 'plant', x: -6.6, y: 6.4 }, { type: 'plant', x: 5.4, y: 6.4 },
    { type: 'bench', x: -5.4, y: -1.4, w: 2.2, h: 0.7 },
    { type: 'bench', x: 4.4, y: -1.4, w: 2.2, h: 0.7 },
  ],
  Weapons: [
    { type: 'window', x: 9.6, y: 4.0, w: 3.4, h: 0.35 },
    { type: 'crate', x: 10.9, y: 0.2, w: 1.0, h: 1.0 },
  ],
  LifeSupp: [
    { type: 'panel', x: 7.9, y: -4.1, w: 1.1, h: 0.45 },
    { type: 'bench', x: 5.7, y: -1.0, w: 1.6, h: 0.55 },
  ],
  Nav: [
    { type: 'window', x: 19.4, y: -4.6, w: 0.3, h: 2.0 },
    { type: 'bench', x: 14.6, y: -6.8, w: 1.6, h: 0.6 },
  ],
  Shields: [
    { type: 'shieldGen', x: 11.4, y: -15.2, r: 1.2 },
    { type: 'crate', x: 13.4, y: -13.9, w: 0.9, h: 0.9 },
    { type: 'window', x: 13.2, y: -14.2, w: 0.35, h: 3.2 },
  ],
  Comms: [
    { type: 'panel', x: 6.9, y: -15.8, w: 0.7, h: 1.6 },
    { type: 'chair', x: 5.4, y: -14.9 },
  ],
  Admin: [
    { type: 'table', x: 2.3, y: -10.4, r: 0.8 },
    { type: 'chair', x: 3.3, y: -10.4 },
    { type: 'panel', x: 1.3, y: -8.0, w: 1.4, h: 0.45 },
  ],
  Storage: [
    { type: 'window', x: -5.3, y: -11.0, w: 0.35, h: 5.0 },
    { type: 'crate', x: -3.6, y: -13.6, w: 1.2, h: 1.2 },
    { type: 'crate', x: -2.0, y: -14.0, w: 1.0, h: 1.0 },
    { type: 'crate', x: 0.9, y: -13.1, w: 1.1, h: 1.1 },
    { type: 'crate', x: 0.6, y: -10.2, w: 0.9, h: 0.9 },
    { type: 'crate', x: -3.9, y: -8.4, w: 1.0, h: 1.0 },
  ],
  Electrical: [
    { type: 'panel', x: -7.0, y: -6.9, w: 1.1, h: 0.4 },
    { type: 'crate', x: -5.2, y: -8.9, w: 0.9, h: 0.9 },
  ],
  MedBay: [
    { type: 'bed', x: -9.6, y: -3.2, w: 1.5, h: 0.9 },
    { type: 'bed', x: -7.2, y: -3.2, w: 1.5, h: 0.9 },
    { type: 'panel', x: -10.9, y: -4.7, w: 1.0, h: 0.4 },
  ],
  Security: [
    { type: 'table', x: -14.2, y: -5.8, r: 0.8 },
    { type: 'chair', x: -14.2, y: -6.8 },
    { type: 'panel', x: -15.9, y: -7.6, w: 1.3, h: 0.45 },
  ],
  UpperEngine: [
    { type: 'engine', x: -19.6, y: 1.9, r: 1.6 },
    { type: 'window', x: -21.1, y: 0.6, w: 0.35, h: 4.2 },
  ],
  LowerEngine: [
    { type: 'engine', x: -19.6, y: -12.2, r: 1.6 },
    { type: 'window', x: -21.1, y: -12.4, w: 0.35, h: 4.2 },
  ],
  Reactor: [
    { type: 'reactor', x: -21.0, y: -4.6, r: 1.7 },
    { type: 'panel', x: -23.2, y: -4.8, w: 0.4, h: 3.2 },
  ],
};
