// VELA BAY — five story jobs for fixer Dahlia Cruz: markers, a heist car,
// an evasion heat check, a checkpoint street race and a final collect-and-run.
// Objectives feed the HUD; completion pays cash and autosaves.
import { S } from './state.js';
import { spawnVehicle, removeVehicle } from './vehicles.js';
import { clearHeat } from './wanted.js';
import { sfx } from './audio.js';
import { saveGame } from './save.js';
import { sparksAt } from './effects.js';

const GOLD = 0xffd166;
const CYAN = 0x37e6ff;
let sceneRef = null;
const dialogQueue = [];

export const MISSIONS = [
  {
    title: 'NEW IN TOWN', reward: 150,
    intro: [
      { who: 'Dahlia Cruz', text: 'Kai. Fresh out of Chino Dunes and already broke. Walk down to the marina — I have work for you.' },
    ],
    stages: [
      { type: 'reach', x: 180, z: 268, r: 5, label: 'Meet Dahlia at the marina pier' },
    ],
    onComplete() { queueDialog([{ who: 'Dahlia Cruz', text: 'Good. First rule of Vela Bay: nothing here is free. Including the cars.' }]); },
  },
  {
    title: 'BORROWED WHEELS', reward: 400,
    intro: [
      { who: 'Dahlia Cruz', text: 'A golden Vulcan GT is parked on Marlin Avenue. Bring it to my garage on the west side. Try not to scratch it.' },
    ],
    stages: [
      { type: 'steal', x: 114.6, z: -60, yaw: 0, label: 'Steal the golden Vulcan GT' },
      { type: 'deliver', x: -216, z: 108, r: 6, car: true, label: 'Deliver the Vulcan to Dahlia\'s garage', heatOnEnter: 40, dialog: { who: 'Dahlia Cruz', text: 'That car has plates the VBPD remembers. You just lit yourself up — drive!' } },
    ],
    onComplete() { clearHeat(); queueDialog([{ who: 'Dahlia Cruz', text: 'Plates swapped, heat gone. You drive like you mean it. I like that.' }]); },
  },
  {
    title: 'HEAT WAVE', reward: 500,
    intro: [
      { who: 'Dahlia Cruz', text: 'Bad news — a patrol spotted you with the Vulcan. Three stars. Shake them before they box you in.' },
    ],
    stages: [
      { type: 'evade', heat: 60, label: 'Lose the VBPD — get out of their sight' },
    ],
    onComplete() { queueDialog([{ who: 'Dahlia Cruz', text: 'Clean getaway. There is a street race tonight on the beachfront. Winner takes the pot.' }]); },
  },
  {
    title: 'SUNSET SPRINT', reward: 600,
    intro: [
      { who: 'Race Host', text: 'Eight checkpoints along the coast and downtown. Beat the clock — any ride you can grab is legal.' },
    ],
    stages: [
      {
        type: 'race', time: 100,
        points: [[216, 252], [108, 252], [0, 252], [-108, 252], [-180, 180], [-180, 72], [-108, 0], [0, 36]],
        label: 'Race through the checkpoints',
      },
    ],
    onComplete() { queueDialog([{ who: 'Dahlia Cruz', text: 'You won the pot. Now the real job: three drops across the city, and the cops want a word.' }]); },
  },
  {
    title: 'THE LAST DROP', reward: 1200,
    intro: [
      { who: 'Dahlia Cruz', text: 'Collect my three packages, then reach the hideout. The VBPD is already rolling. Do not stop.' },
    ],
    stages: [
      { type: 'collect', points: [[-216, -216], [216, -144], [144, 216]], r: 4.5, heat: 40, label: 'Collect the three drops' },
      { type: 'reach', x: -216, z: 216, r: 5, label: 'Reach the hideout' },
    ],
    onComplete() {
      S.storyDone = true;
      S.freeRoam = true;
      queueDialog([{ who: 'Dahlia Cruz', text: 'That is the last of it. Vela Bay is yours now, Kai. Try to keep it in one piece.' }]);
    },
  },
];

function queueDialog(list) {
  for (const d of list) dialogQueue.push(d);
}

export function clearDialogs() {
  dialogQueue.length = 0;
  S.dialog = null;
}

export function initMissions(scene) {
  sceneRef = scene;
}

export function resetMissions() {
  dialogQueue.length = 0;
  S.dialog = null;
  if (sceneRef) clearMarkers();
  S.mission.index = -1;
  S.mission.stage = 0;
  S.mission.data = {};
  S.mission.nextIn = 0;
}

function makeMarker(x, z, color) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.6, 0.14, 8, 32),
    new THREE.MeshBasicMaterial({ color, toneMapped: false }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.35;
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(2.4, 2.4, 16, 20, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
  );
  beam.position.y = 8;
  g.add(ring, beam);
  g.position.set(x, 0, z);
  sceneRef.add(g);
  const marker = { group: g, ring, beam, x, z, follow: null };
  S.markers.push(marker);
  return marker;
}

function clearMarkers() {
  for (const m of S.markers) sceneRef.remove(m.group);
  S.markers.length = 0;
}

function playerPos() {
  const p = S.player;
  return p.inCar ? { x: p.inCar.group.position.x, z: p.inCar.group.position.z } : { x: p.x, z: p.z };
}

function enterStage(m, idx) {
  const st = m.stages[idx];
  const d = S.mission.data;
  clearMarkers();
  if (st.dialog) queueDialog([st.dialog]);
  if (st.heatOnEnter) { S.heat = Math.max(S.heat, st.heatOnEnter); S.lastCrime = S.time; }
  if (st.type === 'reach' || st.type === 'deliver') {
    d.marker = makeMarker(st.x, st.z, GOLD);
  } else if (st.type === 'steal') {
    d.car = spawnVehicle('vulcan', 'mission', st.x, st.z, st.yaw, 0xe8b23f);
    d.marker = makeMarker(st.x, st.z, GOLD);
    d.marker.follow = d.car;
  } else if (st.type === 'evade') {
    S.heat = Math.max(S.heat, st.heat);
    S.lastCrime = S.time;
  } else if (st.type === 'race') {
    d.raceIdx = 0;
    S.mission.timer = st.time;
    d.marker = makeMarker(st.points[0][0], st.points[0][1], CYAN);
    if (!S.player.inCar) queueDialog([{ who: 'Race Host', text: 'You will need wheels for this one. Grab anything with an engine.' }]);
  } else if (st.type === 'collect') {
    d.collected = 0;
    d.dropMarkers = st.points.map(([x, z]) => makeMarker(x, z, GOLD));
    if (st.heat) { S.heat = Math.max(S.heat, st.heat); S.lastCrime = S.time; }
  }
}

export function startMission(i) {
  if (i >= MISSIONS.length) return;
  clearMarkers();
  for (let k = S.vehicles.length - 1; k >= 0; k--) {
    if (S.vehicles[k].kind === 'mission') removeVehicle(S.vehicles[k]);
  }
  S.mission.index = i;
  S.mission.stage = 0;
  S.mission.data = {};
  S.mission.nextIn = 0;
  const m = MISSIONS[i];
  S.banner = { text: m.title, sub: `JOB ${i + 1} OF ${MISSIONS.length}`, until: S.time + 3.2 };
  queueDialog(m.intro);
  enterStage(m, 0);
}

function completeStage() {
  const m = MISSIONS[S.mission.index];
  S.mission.stage++;
  if (S.mission.stage >= m.stages.length) {
    S.cash += m.reward;
    S.stats.jobs++;
    sfx.jingle();
    S.banner = { text: 'JOB COMPLETE', sub: `+$${m.reward}`, until: S.time + 3.4 };
    const pp = playerPos();
    sparksAt(pp.x, 1.4, pp.z, 24, 'cash');
    m.onComplete?.();
    clearMarkers();
    saveGame();
    if (S.mission.index === MISSIONS.length - 1) {
      S.mission.stage = -1;
      S.mission.index = -1;
      S.banner = { text: 'STORY COMPLETE', sub: 'VELA BAY IS YOURS — FREE ROAM', until: S.time + 5 };
    } else {
      S.mission.stage = -1;
      S.mission.nextIn = 5;
    }
  } else {
    enterStage(m, S.mission.stage);
  }
}

export function updateMissions(dt) {
  // Dialog queue.
  if (!S.dialog && dialogQueue.length) {
    const d = dialogQueue.shift();
    S.dialog = { ...d, until: S.time + 4.6 };
  }
  if (S.dialog && S.time > S.dialog.until) S.dialog = null;

  // Marker animation.
  for (const m of S.markers) {
    if (m.follow && !m.follow.dead) {
      m.x = m.follow.group.position.x;
      m.z = m.follow.group.position.z;
      m.group.position.set(m.x, 0, m.z);
    }
    const pulse = 1 + Math.sin(S.time * 3.2) * 0.07;
    m.ring.scale.set(pulse, pulse, 1);
    m.ring.rotation.z = S.time * 0.8;
    m.beam.material.opacity = 0.11 + Math.sin(S.time * 2.4) * 0.04;
  }

  const mi = S.mission;
  if (mi.index < 0) return;
  if (mi.stage === -1) {
    mi.nextIn -= dt;
    if (mi.nextIn <= 0) startMission(mi.index + 1);
    return;
  }
  const m = MISSIONS[mi.index];
  const st = m.stages[mi.stage];
  const d = mi.data;
  const pp = playerPos();
  const dist = (x, z) => Math.hypot(pp.x - x, pp.z - z);

  if (st.type === 'reach') {
    if (dist(st.x, st.z) < st.r) completeStage();
  } else if (st.type === 'steal') {
    if (S.player.inCar === d.car) completeStage();
  } else if (st.type === 'deliver') {
    if (S.player.inCar && (!st.car || S.player.inCar === d.car) && dist(st.x, st.z) < st.r) completeStage();
  } else if (st.type === 'evade') {
    if (S.heat <= 0) completeStage();
  } else if (st.type === 'race') {
    mi.timer -= dt;
    if (mi.timer <= 0) {
      sfx.fail();
      S.banner = { text: 'TIME UP', sub: 'RUN IT BACK', until: S.time + 2.4 };
      d.raceIdx = 0;
      mi.timer = st.time;
      d.marker.x = st.points[0][0]; d.marker.z = st.points[0][1];
      d.marker.group.position.set(d.marker.x, 0, d.marker.z);
    } else if (S.player.inCar && d.raceIdx < st.points.length) {
      const [cx, cz] = st.points[d.raceIdx];
      if (dist(cx, cz) < 7) {
        d.raceIdx++;
        sfx.checkpoint();
        if (d.raceIdx >= st.points.length) completeStage();
        else {
          const [nx, nz] = st.points[d.raceIdx];
          d.marker.x = nx; d.marker.z = nz;
          d.marker.group.position.set(nx, 0, nz);
        }
      }
    }
  } else if (st.type === 'collect') {
    for (let i = d.dropMarkers.length - 1; i >= 0; i--) {
      const mk = d.dropMarkers[i];
      if (dist(mk.x, mk.z) < st.r) {
        sceneRef.remove(mk.group);
        S.markers.splice(S.markers.indexOf(mk), 1);
        d.dropMarkers.splice(i, 1);
        d.collected++;
        sfx.pickup();
        sparksAt(mk.x, 1.2, mk.z, 16, 'cash');
      }
    }
    if (d.collected >= st.points.length) completeStage();
  }
}

export function currentObjective() {
  const mi = S.mission;
  if (mi.index < 0) {
    return S.freeRoam
      ? { title: 'FREE ROAM', text: 'Vela Bay is yours. Cars, cash and chaos await.' }
      : { title: 'VELA BAY', text: 'Press PLAY to start the story.' };
  }
  const m = MISSIONS[mi.index];
  if (mi.stage === -1) return { title: m.title, text: 'Job complete — next call incoming...' };
  const st = m.stages[mi.stage];
  const d = mi.data;
  let text = st.label;
  if (st.type === 'race') text = `Checkpoint ${Math.min(d.raceIdx + 1, st.points.length)}/${st.points.length} — ${Math.ceil(mi.timer)}s left`;
  if (st.type === 'collect') text = `Drops collected: ${d.collected}/${st.points.length}`;
  if (st.type === 'evade') text = S.nearestCopDist < 55 ? 'They still see you — break line of sight!' : 'Keep hidden — the heat is fading...';
  return { title: m.title, text };
}

// Test/dev helper: skip the current stage.
export function debugCompleteStage() {
  if (S.mission.index >= 0 && S.mission.stage >= 0) completeStage();
}
// build marker: missions.js