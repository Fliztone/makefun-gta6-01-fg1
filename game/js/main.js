// VELA BAY — entry point: boots every system, owns the game loop and the
// menu / play / pause / dead state machine, wires the UI and exposes a small
// window.VB hook used for automated play-testing.
import { CFG, CAR_TYPES } from './config.js';
import { S } from './state.js';
import { clamp, makeRng, pick } from './utils.js';
import { initWorld, updateWorld, resizeWorld, renderer, scene } from './world.js';
import { buildCity, updateCity, city } from './city.js';
import { initEffects, updateEffects, skidAt } from './effects.js';
import { initVehicles, spawnVehicle, updateVehicles, nearestVehicle, removeVehicle } from './vehicles.js';
import { initPlayer, updatePlayer, enterCar, exitCar, respawn } from './player.js';
import { initPedestrians, updatePedestrians, spawnPed } from './pedestrians.js';
import { initTraffic, updateTraffic } from './traffic.js';
import { updatePolice } from './police.js';
import { updateWanted } from './wanted.js';
import { updateWeapons } from './weapons.js';
import { initMissions, resetMissions, startMission, updateMissions, debugCompleteStage, clearDialogs, MISSIONS } from './missions.js';
import { initCamera, updateCamera, resizeCamera, camera } from './camera.js';
import { initMinimap } from './minimap.js';
import { initHud, updateHud } from './hud.js';
import { initInput, requestLock, isLocked, isDown, wasPressed, anyKey, endFrame, mouse } from './input.js';
import { initAudio, updateAudio, sfx } from './audio.js';
import { saveGame, loadGame, hasSave } from './save.js';

const inputAdapter = { isDown, wasPressed, anyKey, mouse, skidAt };
const rng = makeRng(31337);
let canvas = null;

function setMode(mode) {
  S.mode = mode;
  if (mode !== 'play' && document.pointerLockElement) document.exitPointerLock?.();
}

function pauseGame() {
  if (S.mode === 'play') setMode('pause');
}

function resumeGame() {
  if (S.mode === 'pause') {
    S.mode = 'play';
    requestLock(canvas);
  }
}

function resetWorldForNewGame() {
  const p = S.player;
  if (p.inCar) { p.inCar.kind = 'parked'; p.inCar = null; }
  p.mesh.visible = true;
  p.x = -180; p.z = -144; p.y = 0; p.vy = 0; p.yaw = 0; p.speed = 0;
  S.cam.yaw = 0; S.cam.pitch = 0.22;
  S.cash = 0; S.health = 100; S.heat = 0; S.ammo = 12; S.reloading = 0;
  S.storyDone = false; S.freeRoam = false;
  S.stats = { crimes: 0, jobs: 0, distance: 0, shots: 0 };
  S.banner = null; S.dialog = null; S.interactTarget = null;
  for (let i = S.vehicles.length - 1; i >= 0; i--) {
    const v = S.vehicles[i];
    if (v.kind === 'mission' || v.kind === 'police') removeVehicle(v);
  }
  resetMissions();
}

function newGame() {
  initAudio();
  resetWorldForNewGame();
  S.mode = 'play';
  requestLock(canvas);
  startMission(0);
  sfx.click();
}

function applySave(d) {
  resetWorldForNewGame();
  S.cash = d.cash || 0;
  S.health = clamp(d.health ?? 100, 20, 100);
  S.stats = d.stats || S.stats;
  S.storyDone = !!d.storyDone;
  S.player.x = clamp(d.x ?? -180, -300, 300);
  S.player.z = clamp(d.z ?? -144, -300, CFG.BEACH_END - 4);
  if (S.storyDone) {
    S.freeRoam = true;
    S.banner = { text: 'WELCOME BACK', sub: 'FREE ROAM — VELA BAY', until: S.time + 3 };
  } else {
    startMission(clamp(d.missionIndex ?? 0, 0, MISSIONS.length - 1));
  }
}

function continueGame() {
  const d = loadGame();
  if (!d) { newGame(); return; }
  initAudio();
  applySave(d);
  S.mode = 'play';
  requestLock(canvas);
  sfx.click();
}

function wireUI() {
  document.getElementById('btnNew').addEventListener('click', newGame);
  const btnContinue = document.getElementById('btnContinue');
  btnContinue.classList.toggle('hidden', !hasSave());
  btnContinue.addEventListener('click', continueGame);
  document.getElementById('btnResume').addEventListener('click', resumeGame);
  document.getElementById('btnSave').addEventListener('click', () => {
    if (saveGame()) S.banner = { text: 'SAVED', sub: 'PROGRESS STORED IN THIS BROWSER', until: S.time + 1.8 };
    sfx.click();
  });
  document.getElementById('btnLoad').addEventListener('click', () => {
    const d = loadGame();
    if (d) { applySave(d); S.mode = 'play'; requestLock(canvas); }
    sfx.click();
  });
  document.getElementById('btnQuit').addEventListener('click', () => { setMode('menu'); sfx.click(); });
  document.getElementById('btnRespawn').addEventListener('click', () => {
    respawn();
    requestLock(canvas);
    sfx.click();
  });
  canvas.addEventListener('click', () => {
    if (S.mode === 'play' && !isLocked()) requestLock(canvas);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseGame();
  });
  window.addEventListener('resize', () => { resizeWorld(); resizeCamera(); });
}

function boot() {
  canvas = document.getElementById('game');
  initWorld(canvas);
  buildCity(scene);
  initVehicles(scene);
  initEffects(scene);
  initPlayer(scene);
  initPedestrians(scene);
  initTraffic(scene);
  initMissions(scene);

  // Stealable parked cars along the curbs, plus one right by the start spot.
  const parkedTypes = CAR_TYPES.filter((t) => t.kind !== 'police').map((t) => t.id);
  for (const spot of city.parkedSpots) {
    spawnVehicle(pick(rng, parkedTypes), 'parked', spot.x, spot.z, spot.yaw);
  }
  spawnVehicle('brisa', 'parked', -173.4, -150, 0);

  initCamera();
  initMinimap(document.getElementById('minimap'));
  initHud();
  initInput(canvas, pauseGame);
  wireUI();

  // Play-test / automation hooks (also handy for the screenshot pass).
  window.VB = {
    S,
    city,
    spawnPed(x, z, snap = true) { return spawnPed(x, z, false, snap); },
    teleport(x, z) {
      const p = S.player;
      if (p.inCar) { p.inCar.group.position.set(x, 0, z); p.inCar.speed = 0; }
      else { p.x = x; p.z = z; }
    },
    setWanted(stars) { S.heat = clamp(stars * 20, 0, 100); S.lastCrime = S.time; },
    setCam(yaw, pitch, lock = true) { S.cam.yaw = yaw; S.cam.pitch = pitch; S.lockCam = lock; },
    clearDialogs() { clearDialogs(); S.banner = null; },
    fastSim(on) { S.fastSim = !!on; },
    freeze(on) { S.freeze = !!on; },
    startMission(i) { if (S.mode !== 'play') newGame(); startMission(i); },
    completeStage: debugCompleteStage,
    spawnCop(dx, dz) {
      const p = S.player;
      const px = p.inCar ? p.inCar.group.position.x : p.x;
      const pz = p.inCar ? p.inCar.group.position.z : p.z;
      const v = spawnVehicle('interceptor', 'police', px + dx, pz + dz, Math.atan2(-dx, -dz));
      v.ai = { shoot: 2, stuck: 0, reverse: 0, flash: 0, leaving: false };
      v.speed = 12;
      return v;
    },
    giveCar(id) {
      const p = S.player;
      const px = p.inCar ? p.inCar.group.position.x : p.x;
      const pz = p.inCar ? p.inCar.group.position.z : p.z;
      const v = spawnVehicle(id || 'vulcan', 'parked', px + 3, pz, S.cam.yaw);
      if (!p.inCar) enterCar(v);
      return v;
    },
    enterNearest() {
      const p = S.player;
      const v = nearestVehicle(p.x, p.z, 12, (x) => x.kind !== 'player');
      if (v) enterCar(v);
      return v;
    },
    exitCar,
    save: saveGame,
  };

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(S.fastSim ? 0.12 : 0.05, (now - last) / 1000);
    last = now;
    S.time += dt;
    S.dt = dt;

    if (S.mode === 'play' && !S.freeze) {
      if (wasPressed('Escape')) pauseGame();
      updatePlayer(dt, inputAdapter);
      updateTraffic(dt);
      updatePolice(dt);
      updateVehicles(dt);
      updatePedestrians(dt);
      updateWanted(dt);
      updateWeapons(dt, camera, inputAdapter);
      updateMissions(dt);
    } else if (S.mode === 'menu') {
      // The city keeps living behind the title screen.
      updateTraffic(dt);
      updateVehicles(dt);
      updatePedestrians(dt);
    }

    const p = S.player;
    const fx = p.inCar ? p.inCar.group.position.x : p.x;
    const fz = p.inCar ? p.inCar.group.position.z : p.z;
    updateEffects(dt);
    updateCity(dt, S.time);
    updateWorld(dt, fx, fz);
    updateCamera(dt);
    updateAudio();
    updateHud(dt);
    renderer.render(scene, camera);
    endFrame();
  }
  requestAnimationFrame(frame);
}

try {
  boot();
} catch (err) {
  const note = document.getElementById('booterror');
  if (note) {
    note.textContent = 'VELA BAY could not start WebGL: ' + err.message;
    note.classList.remove('hidden');
  }
}
// build marker: main.js