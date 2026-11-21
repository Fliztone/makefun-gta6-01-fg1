// VELA BAY — the shared game state. Every system reads and writes this one object,
// which keeps the modules free of circular imports.

export const S = {
  mode: 'menu',           // menu | play | pause | dead
  time: 0,
  dt: 0,
  cash: 0,
  health: 100,
  lastHurt: -99,
  heat: 0,                // 0..100 -> wanted stars = ceil(heat/20)
  lastCrime: -99,
  crimeFlash: 0,
  ammo: 12,
  reloading: 0,
  aiming: false,
  storyDone: false,
  freeRoam: false,

  player: {
    x: -180, y: 0, z: -144,
    yaw: 0, vy: 0, grounded: true,
    speed: 0, walkPhase: 0,
    inCar: null,
    mesh: null,
  },

  cam: { yaw: 0, pitch: 0.22, dist: 6 },
  lockCam: false,         // dev/screenshot hook: disables chase-cam recentering
  fastSim: false,         // dev hook: larger max timestep for automated tests
  freeze: false,          // dev hook: hold the simulation for a composed frame

  vehicles: [],           // every car: traffic, parked, police, mission, player-driven
  peds: [],
  markers: [],            // mission markers {mesh, x, z, kind}
  mission: { index: -1, stage: 0, data: null, timer: 0, nextIn: 0 },
  dialog: null,

  stats: { crimes: 0, jobs: 0, distance: 0, shots: 0 },
  nearestCopDist: 999,
  interactTarget: null,
  race: null,
};

export const starsOf = () => Math.min(5, Math.ceil(S.heat / 20));
// build marker: state.js