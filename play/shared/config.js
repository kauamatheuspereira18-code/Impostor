// Tipos de tarefa, mapas e cores usados no servidor e no cliente.

export const COLORS = [
  { id: 'red', name: 'Vermelho', hex: '#C51111', visor: '#7A0838' },
  { id: 'blue', name: 'Azul', hex: '#132ED1', visor: '#0A2B7C' },
  { id: 'green', name: 'Verde', hex: '#117F2D', visor: '#0A4A22' },
  { id: 'pink', name: 'Rosa', hex: '#ED54BA', visor: '#A9227F' },
  { id: 'orange', name: 'Laranja', hex: '#EF7D0D', visor: '#A04E06' },
  { id: 'yellow', name: 'Amarelo', hex: '#F5F557', visor: '#B4B424' },
  { id: 'black', name: 'Preto', hex: '#3F474E', visor: '#171C22' },
  { id: 'white', name: 'Branco', hex: '#D6E0F0', visor: '#8FA0B8' },
  { id: 'purple', name: 'Roxo', hex: '#783DD2', visor: '#4B1F8C' },
  { id: 'brown', name: 'Marrom', hex: '#71491E', visor: '#4A2E10' },
  { id: 'cyan', name: 'Ciano', hex: '#38FEDC', visor: '#1FA995' },
  { id: 'lime', name: 'Lima', hex: '#50EF39', visor: '#2EA31F' },
];

export const COLOR_BY_ID = Object.fromEntries(COLORS.map((c) => [c.id, c]));

// Mini-mapa "The Skeld" usado no jogo: retângulos chamados "salas".
// Coordenadas em unidades de mundo (o cliente escala para o canvas).
export const MAP = {
  width: 900,
  height: 460,
  rooms: [
    { id: 'cafeteria', name: 'Cafeteria', x: 380, y: 60, w: 230, h: 160 },
    { id: 'weapons', name: 'Armas', x: 100, y: 55, w: 160, h: 95 },
    { id: 'navigation', name: 'Navegação', x: 700, y: 40, w: 150, h: 110 },
    { id: 'admin', name: 'Admin', x: 630, y: 200, w: 150, h: 100 },
    { id: 'storage', name: 'Almoxarifado', x: 655, y: 300, w: 200, h: 130 },
    { id: 'electrical', name: 'Elétrica', x: 400, y: 300, w: 150, h: 100 },
    { id: 'lowerEngine', name: 'Motor Inferior', x: 130, y: 345, w: 170, h: 110 },
    { id: 'upperEngine', name: 'Motor Superior', x: 130, y: 170, w: 170, h: 110 },
    { id: 'security', name: 'Segurança', x: 340, y: 228, w: 105, h: 74 },
    { id: 'reactor', name: 'Reator', x: 20, y: 246, w: 110, h: 82 },
    { id: 'medbay', name: 'Enfermaria', x: 320, y: 320, w: 150, h: 70 },
  ],
  // corredores ligando salas (apenas estéticos + usados para spawn)
  corridors: [
    { from: 'cafeteria', to: 'weapons' },
    { from: 'cafeteria', to: 'navigation' },
    { from: 'cafeteria', to: 'upperEngine' },
    { from: 'cafeteria', to: 'admin' },
    { from: 'navigation', to: 'admin' },
    { from: 'admin', to: 'storage' },
    { from: 'upperEngine', to: 'security' },
    { from: 'lowerEngine', to: 'security' },
    { from: 'security', to: 'electrical' },
    { from: 'electrical', to: 'storage' },
    { from: 'reactor', to: 'upperEngine' },
    { from: 'reactor', to: 'lowerEngine' },
    { from: 'security', to: 'medbay' },
  ],
};

export const ROOM_BY_ID = Object.fromEntries(MAP.rooms.map((r) => [r.id, r]));

// Tarefas: cada uma tem um tipo de minigame e uma sala.
export const TASKS = {
  wires: { name: 'Consertar fiação', room: 'electrical', type: 'wires' },
  card: { name: 'Ler cartão', room: 'admin', type: 'card' },
  trash: { name: 'Tirar o lixo', room: 'storage', type: 'multistep' },
  download: { name: 'Baixar dados', room: 'navigation', type: 'progress' },
  upload: { name: 'Enviar dados', room: 'weapons', type: 'progress' },
  scan: { name: 'Examinar corpo', room: 'medbay', type: 'scan' },
  inspect: { name: 'Inspecionar amostras', room: 'medbay', type: 'multistep' },
  calibrate: { name: 'Calibrar distribuidor', room: 'electrical', type: 'wires' },
  chart: { name: 'Traçar rota', room: 'navigation', type: 'card' },
  secure: { name: 'Reiniciar câmeras', room: 'security', type: 'progress' },
  coffee: { name: 'Esvaziar o lixo', room: 'cafeteria', type: 'multistep' },
  fuelUpper: { name: 'Abastecer motor superior', room: 'upperEngine', type: 'multistep' },
  fuel: { name: 'Abastecer motores', room: 'lowerEngine', type: 'multistep' },
  asteroids: { name: 'Destruir asteroides', room: 'weapons', type: 'asteroids' },
  shields: { name: 'Ativar escudos', room: 'reactor', type: 'multistep' },
};

// Sabotagens disponíveis para o impostor.
export const SABOTAGES = {
  lights: { name: 'Luzes', duration: 25, fixRoom: 'electrical' },
  reactor: { name: 'Reator', duration: 45, fixRooms: ['reactor'], steps: 2 },
  comms: { name: 'Comunicação', duration: 35, fixRoom: 'admin' },
};
