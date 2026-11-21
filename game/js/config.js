// VELA BAY — tuning constants, palette and original names. Everything here is
// world data: the street grid, the vehicle roster, the neon signs, the story cast.

export const CFG = {
  GRID: 7,            // blocks per side
  CELL: 72,           // block + road pitch
  BLOCK: 56,          // buildable block width
  ROAD: 16,           // asphalt width
  LANE: 3.6,          // lane offset from road centerline
  PARK: 6.6,          // curb parking offset
  HALF: 252,          // city half-extent (GRID*CELL/2)
  EDGE: 260,          // outer asphalt edge
  BEACH_END: 330,     // sand ends, water begins
  WALK_SPEED: 5.2,
  SPRINT_SPEED: 8.2,
  GRAVITY: 22,
  JUMP_VEL: 7.5,
  PLAYER_RADIUS: 0.55,
  CAR_RADIUS: 2.05,
  MAX_WANTED: 5,
  SAVE_KEY: 'vela-bay-save-v1',
};

// Road centerlines: 8 north-south and 8 east-west avenues.
export const ROADS = [];
for (let i = 0; i <= CFG.GRID; i++) ROADS.push((i - CFG.GRID / 2) * CFG.CELL);
// Block centers: 7 per axis.
export const BLOCKS = [];
for (let i = 0; i < CFG.GRID; i++) BLOCKS.push((i - (CFG.GRID - 1) / 2) * CFG.CELL);

export const PALETTE = {
  skyTop: 0x2b1a4e,
  skyMid: 0xd95f8a,
  horizon: 0xffb377,
  fog: 0xf5a97f,
  sun: 0xffc07a,
  asphalt: 0x565b68,
  sidewalk: 0xb3aca2,
  sand: 0xe8c78e,
  waterDeep: 0x14607a,
  waterShallow: 0x35a8bc,
  lane: 0xd8d2c4,
  buildings: [0xf2a07b, 0x7fd1c1, 0xf5d9a8, 0xe88fa2, 0xa8c8e8, 0xc9b6e4, 0xf2b880, 0x8fd1a8],
  neon: [0xff4f9a, 0x37e6ff, 0xffb02e, 0x8f5fff, 0x4dff88, 0xff6a3d],
  cars: [0xd94f4f, 0x3f7fd9, 0xe8b23f, 0x4fb8a8, 0xe8e4da, 0x8a5fd9, 0xf2784f, 0x5a6a7a],
};

// Original vehicle roster. speed in m/s, accel m/s^2, grip = turn rate.
export const CAR_TYPES = [
  { id: 'pelicano', name: 'Pelicano Sedan', kind: 'sedan', len: 4.5, wid: 1.9, hgt: 1.35, speed: 24, accel: 9, grip: 2.1, hp: 100 },
  { id: 'vulcan', name: 'Vulcan GT', kind: 'sport', len: 4.3, wid: 1.95, hgt: 1.05, speed: 31, accel: 14, grip: 2.5, hp: 90 },
  { id: 'marlin', name: 'Marlin V8', kind: 'muscle', len: 4.8, wid: 2.0, hgt: 1.25, speed: 28, accel: 12, grip: 2.0, hp: 110 },
  { id: 'brisa', name: 'Brisa Compact', kind: 'compact', len: 3.7, wid: 1.75, hgt: 1.4, speed: 20, accel: 7.5, grip: 2.3, hp: 80 },
  { id: 'camello', name: 'Camello Van', kind: 'van', len: 5.1, wid: 2.1, hgt: 2.1, speed: 19, accel: 6.5, grip: 1.7, hp: 140 },
  { id: 'coquina', name: 'Coquina Taxi', kind: 'taxi', len: 4.5, wid: 1.9, hgt: 1.4, speed: 23, accel: 8.5, grip: 2.1, hp: 100 },
  { id: 'interceptor', name: 'VBPD Interceptor', kind: 'police', len: 4.7, wid: 1.95, hgt: 1.35, speed: 27, accel: 11.5, grip: 2.35, hp: 130 },
];

export const NEON_SIGNS = [
  'HOTEL LUNA', 'SOL BAR', 'CASA MAR', 'DISCO NEON', 'TACOS DEL MAR',
  '24/7 MARKET', 'MIRADOR CLUB', 'PLAYA MOTEL', 'CAFE COQUINA', 'VELA ARCADE',
];

export const PED_SHIRTS = [0xff6a8a, 0x4fd1ff, 0xffd166, 0x8affc1, 0xc792ea, 0xff9e64, 0xf5f0e8, 0x6a8aff];
export const PED_SKINS = [0xe8b48c, 0xc98d5e, 0x8c5a3c, 0xf0c8a0, 0x6b4226];

export const STORY = {
  city: 'Vela Bay',
  hero: 'Kai Moreno',
  fixer: 'Dahlia Cruz',
  intro: 'Fresh out of Chino Dunes prison, Kai Moreno just wanted a quiet life in Vela Bay. ' +
    'But fixer Dahlia Cruz has other plans — and the Vela Bay PD never forgets a face.',
};
// build marker: config.js