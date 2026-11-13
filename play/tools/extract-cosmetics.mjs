/* Gera shared/cosmetics.js a partir dos dados oficiais do Impostor:
   src/Impostor.Api/Innersloth/Data/Cosmetics.json
   Cada item guarda o id oficial e um "art" (índice do desenho procedural).
   Os itens marcados abaixo têm desenho dedicado; o resto usa um desenho
   determinístico derivado do id, para continuar distinto e estável. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const dataPath = path.join(root, 'src/Impostor.Api/Innersloth/Data/Cosmetics.json');
const outPath = path.resolve(here, '../shared/cosmetics.js');
const all = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const hash = (str) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
};

/* desenhos dedicados: id oficial -> { art, name } */
const HAT_ART = {
  hat_NoHat: [0, 'Sem chapéu'],
  hat_pk01_BaseballCap: [1, 'Boné'],
  hat_pk04_Beanie: [2, 'Gorro'],
  hat_tophat: [3, 'Cartola'],
  hat_pk02_Crown: [4, 'Coroa'],
  hat_pk02_HaloHat: [5, 'Auréola'],
  hat_cosmic_alienAntenna: [6, 'Antena alienígena'],
  hat_partyhat: [7, 'Chapéu de festa'],
  hat_fungleFlower: [8, 'Flor'],
  hat_pkHW01_Pirate: [9, 'Pirata'],
  hat_pk05_Helmet: [10, 'Capacete'],
  hat_pkHW01_Horns: [11, 'Chifres'],
};
const SKIN_ART = {
  skin_None: [0, 'Sem traje'],
  skin_Astro: [1, 'Astronauta'],
  skin_Capt: [2, 'Capitão'],
  skin_Mech: [3, 'Mecânico'],
  skin_Military: [4, 'Militar'],
  skin_Police: [5, 'Policial'],
  skin_Science: [6, 'Cientista'],
  skin_SuitB: [7, 'Terno preto'],
  skin_SuitW: [8, 'Terno branco'],
  skin_Wall: [9, 'Parede de tijolos'],
};
const VISOR_ART = {
  visor_EmptyVisor: [0, 'Padrão'],
  visor_pk01_AngeryVisor: [1, 'Zangado'],
  visor_pk01_PaperMaskVisor: [2, 'Máscara de papel'],
  visor_pk01_DumStickerVisor: [3, 'Adesivo bobo'],
  visor_cosmic_sunglasses: [4, 'Óculos escuros'],
  visor_cosmic_threeEyes: [5, 'Três olhos'],
  visor_racing_goggles: [6, 'Óculos de corrida'],
  visor_kamurocho_eyepatch: [7, 'Tapa-olho'],
  visor_bsb2_heartGlassesRed: [8, 'Óculos de coração'],
  visor_cosmic_alien: [9, 'Visor alienígena'],
};
const PET_ART = {
  pet_EmptyPet: [0, 'Sem pet'],
  pet_cosmic_cat: [1, 'Gato cósmico'],
  pet_Pate: [2, 'Pate'],
  pet_Mister: [3, 'Mister'],
  pet_Claws_spaceCat: [3, 'Gato espacial'],
};
const PLATE_ART = {
  nameplate_NoPlate: [0, 'Sem placa'],
  nameplate_cosmic_nebula: [1, 'Nebulosa'],
  nameplate_cosmic_rings: [2, 'Anéis'],
  nameplate_parasite_Impostor: [3, 'Parasita'],
  nameplate_hanami_viewing: [4, 'Hanami'],
  nameplate_stardew_night: [5, 'Noite estrelada'],
  nameplate_racing_beanCar: [6, 'Carro de corrida'],
  nameplate_kamurocho_neon: [7, 'Neon'],
  nameplate_paws_fur: [8, 'Pelo'],
};

const PALETTES = [
  ['#e0533d', '#f6c945'], ['#2f6fd0', '#9fdcea'], ['#3aa15a', '#d6f5b0'],
  ['#8b5cf6', '#e0d4ff'], ['#f08a3c', '#ffe3a8'], ['#1d2430', '#8e2c3f'],
  ['#0f766e', '#99f6e4'], ['#b91c1c', '#fecaca'], ['#475569', '#cbd5e1'],
  ['#a16207', '#fde68a'],
];

const build = (type, curated, arts) => {
  const items = all.filter((x) => x.type === type);
  const rows = items.map((item) => {
    const c = curated[item.name];
    // itens sem desenho dedicado nunca caem no art 0 (que é "sem nada")
    const art = c ? c[0] : 1 + (hash(item.name) % Math.max(1, arts - 1));
    // visores de destaque usam o azul clássico da viseira
    const pal = (type === 'Visor' && c) ? ['#7fd0e6', '#cdf3ff'] : PALETTES[hash(item.name) % PALETTES.length];
    return {
      id: item.name,
      name: c ? c[1] : item.name.replace(/^(hat|skin|visor|pet|nameplate)_/, '').replace(/[_-]+/g, ' '),
      art,
      pal,
      curated: !!c,
    };
  });
  // "sem nada" primeiro, depois os destaques, depois o resto em ordem alfabética
  rows.sort((a, b) => (a.art === 0 ? -1 : 0) - (b.art === 0 ? -1 : 0)
    || Number(b.curated) - Number(a.curated)
    || a.name.localeCompare(b.name, 'pt-BR'));
  return rows;
};

const HATS = build('Hat', HAT_ART, 12);
const SKINS = build('Skin', SKIN_ART, 10);
const VISORS = build('Visor', VISOR_ART, 10);
const PETS = build('Pet', PET_ART, 5);
const PLATES = build('Nameplate', PLATE_ART, 9);

const header = `/* GERADO por tools/extract-cosmetics.mjs a partir de
   src/Impostor.Api/Innersloth/Data/Cosmetics.json — não editar à mão.
   Cada item: { id oficial, name, art (desenho), pal (cores), curated }. */
`;

const body = [
  `export const HATS = ${JSON.stringify(HATS)};`,
  `export const SKINS = ${JSON.stringify(SKINS)};`,
  `export const VISORS = ${JSON.stringify(VISORS)};`,
  `export const PETS = ${JSON.stringify(PETS)};`,
  `export const PLATES = ${JSON.stringify(PLATES)};`,
  '',
  'export const COSMETIC_LISTS = { hat: HATS, skin: SKINS, visor: VISORS, pet: PETS, plate: PLATES };',
  'export const COSMETIC_TOTALS = {',
  ...[...new Set(all.map((x) => x.type))].map((t) => `  ${t.toLowerCase()}: ${all.filter((x) => x.type === t).length},`),
  '};',
  '',
  '/** Item pelo índice, com fallback seguro. */',
  'export const cosmeticAt = (list, i) => list[Math.max(0, Math.min(list.length - 1, Number(i) || 0))] || list[0];',
  '',
].join('\n');

fs.writeFileSync(outPath, header + body);
console.log(
  `cosmetics.js: ${HATS.length} chapéus, ${SKINS.length} trajes, ${VISORS.length} visores, ` +
  `${PETS.length} pets, ${PLATES.length} placas`,
);
