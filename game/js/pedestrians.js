// VELA BAY — sidewalk pedestrians: loop around block sidewalks, flee speeding
// cars and gunfire, get knocked down (and raise the wanted level when the
// player is behind the wheel).
import { BLOCKS, PED_SHIRTS, PED_SKINS } from './config.js';
import { S, starsOf } from './state.js';
import { makeRng, pick, range, clamp } from './utils.js';
import { addHeat } from './wanted.js';
import { sparksAt } from './effects.js';

const rng = makeRng(4242);
let sceneRef = null;
const SIDE = 52; // sidewalk loop half-perimeter per side (inset 26)
const pantsColors = [0x2f3a52, 0x3a3a42, 0x5a4a3a, 0x26303e, 0x4a3a5a];

function buildPedMesh() {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: pick(rng, PED_SHIRTS) });
  const skin = new THREE.MeshLambertMaterial({ color: pick(rng, PED_SKINS) });
  const pants = new THREE.MeshLambertMaterial({ color: pick(rng, pantsColors) });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.44, 0.18), shirt);
  torso.position.y = 0.82;
  torso.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), skin);
  head.position.y = 1.17;
  head.castShadow = true;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.125, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.5), new THREE.MeshLambertMaterial({ color: pick(rng, [0x241a12, 0x4a3020, 0x101014, 0x6a4a2a]) }));
  hair.position.y = 1.19;
  const mkLeg = (sx) => {
    const w = new THREE.Group();
    w.position.set(sx, 0.58, 0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.52, 0.11), pants);
    m.position.y = -0.26;
    m.castShadow = true;
    w.add(m);
    return w;
  };
  const legL = mkLeg(-0.08), legR = mkLeg(0.08);
  const mkArm = (sx) => {
    const w = new THREE.Group();
    w.position.set(sx, 1.0, 0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.08), skin);
    m.position.y = -0.18;
    w.add(m);
    return w;
  };
  const armL = mkArm(-0.2), armR = mkArm(0.2);
  g.add(torso, head, hair, legL, legR, armL, armR);
  return { group: g, legL, legR, armL, armR };
}

export function spawnPed(x, z, fleeing = false, snap = false) {
  const parts = buildPedMesh();
  const bx = pick(rng, BLOCKS), bz = pick(rng, BLOCKS);
  const ped = {
    ...parts,
    bx, bz,
    s: rng() * SIDE * 4,
    dir: rng() < 0.5 ? 1 : -1,
    speed: range(rng, 1.1, 2.1),
    phase: rng() * 6,
    dead: false, deadTime: 0, fall: 0,
    flee: fleeing ? 2 : 0,
    fx: fleeing ? Math.sin(rng() * Math.PI * 2) : 0,
    fz: fleeing ? Math.cos(rng() * Math.PI * 2) : 0,
    x, z,
    forced: x !== undefined && !snap,
  };
  if (x !== undefined && snap) {
    // Place on the nearest block's sidewalk loop, walking normally.
    let nbx = BLOCKS[0], nbz = BLOCKS[0];
    for (const q of BLOCKS) { if (Math.abs(q - x) < Math.abs(nbx - x)) nbx = q; if (Math.abs(q - z) < Math.abs(nbz - z)) nbz = q; }
    ped.bx = nbx; ped.bz = nbz;
    const dx = x - nbx, dz = z - nbz;
    const h = SIDE / 2;
    if (Math.abs(dx) > Math.abs(dz)) {
      if (dx > 0) { ped.s = SIDE + clamp(dz + h, 0, SIDE); }
      else { ped.s = SIDE * 3 + clamp(h - dz, 0, SIDE); }
    } else {
      if (dz < 0) { ped.s = clamp(dx + h, 0, SIDE); }
      else { ped.s = SIDE * 2 + clamp(h - dx, 0, SIDE); }
    }
    const pos = loopPos(ped);
    ped.x = pos.x; ped.z = pos.z;
  } else if (x === undefined) {
    const pos = loopPos(ped);
    ped.x = pos.x; ped.z = pos.z;
  }
  ped.group.position.set(ped.x, 0.18, ped.z);
  S.peds.push(ped);
  sceneRef?.add(ped.group);
  return ped;
}

export function initPedestrians(scene) {
  sceneRef = scene;
  for (let i = 0; i < 22; i++) spawnPed();
}

function loopPos(ped) {
  const s = ((ped.s % (SIDE * 4)) + SIDE * 4) % (SIDE * 4);
  const side = Math.floor(s / SIDE);
  const u = s % SIDE;
  const h = SIDE / 2;
  if (side === 0) return { x: ped.bx - h + u, z: ped.bz - h, yaw: Math.PI / 2 };
  if (side === 1) return { x: ped.bx + h, z: ped.bz - h + u, yaw: 0 };
  if (side === 2) return { x: ped.bx + h - u, z: ped.bz + h, yaw: -Math.PI / 2 };
  return { x: ped.bx - h, z: ped.bz + h - u, yaw: Math.PI };
}

export function killPed(ped, byPlayer) {
  if (ped.dead) return;
  ped.dead = true;
  ped.deadTime = S.time;
  sparksAt(ped.x, 0.8, ped.z, 6);
  if (byPlayer) addHeat(20, 'hit a pedestrian');
}

export function updatePedestrians(dt) {
  const p = S.player;
  const px = p.inCar ? p.inCar.group.position.x : p.x;
  const pz = p.inCar ? p.inCar.group.position.z : p.z;
  const playerSpeed = p.inCar ? Math.abs(p.inCar.speed) : 0;
  const stars = starsOf();

  for (let i = S.peds.length - 1; i >= 0; i--) {
    const ped = S.peds[i];
    if (ped.dead) {
      ped.fall = Math.min(1, ped.fall + dt * 4);
      ped.group.rotation.x = -ped.fall * Math.PI / 2;
      ped.group.position.y = 0.18 - ped.fall * 0.06;
      if (S.time - ped.deadTime > 14) {
        ped.group.parent?.remove(ped.group);
        S.peds.splice(i, 1);
        spawnPed();
      }
      continue;
    }

    // Flee: speeding car close by, gunfire, or a wanted player nearby.
    const dCar = Math.hypot(ped.x - px, ped.z - pz);
    if ((p.inCar && playerSpeed > 6 && dCar < 8) || (stars >= 2 && dCar < 14) || (S.time - (S.lastShotTime || -99) < 1.2 && dCar < 18)) {
      if (ped.flee <= 0) {
        const a = Math.atan2(ped.x - px, ped.z - pz);
        ped.fx = Math.sin(a); ped.fz = Math.cos(a);
      }
      ped.flee = 1.4;
    }

    let yaw;
    if (ped.flee > 0) {
      ped.flee -= dt;
      ped.x += ped.fx * 4.4 * dt;
      ped.z += ped.fz * 4.4 * dt;
      ped.x = clamp(ped.x, -256, 256);
      ped.z = clamp(ped.z, -256, 268);
      yaw = Math.atan2(ped.fx, ped.fz);
      ped.phase += dt * 11;
    } else if (ped.forced) {
      // A bailed driver keeps running away from the road, then rejoins a loop.
      ped.flee -= dt;
      ped.x += ped.fx * 3.5 * dt;
      ped.z += ped.fz * 3.5 * dt;
      yaw = Math.atan2(ped.fx, ped.fz);
      ped.phase += dt * 9;
      if (ped.flee <= -2) { ped.forced = false; ped.bx = pick(rng, BLOCKS); ped.bz = pick(rng, BLOCKS); ped.s = rng() * SIDE * 4; }
    } else {
      ped.s += ped.speed * ped.dir * dt;
      const pos = loopPos(ped);
      ped.x = pos.x; ped.z = pos.z;
      yaw = pos.yaw + (ped.dir < 0 ? Math.PI : 0);
      ped.phase += ped.speed * dt * 3.4;
    }

    // Knocked down by any moving car.
    for (const v of S.vehicles) {
      if (Math.abs(v.speed) < 3) continue;
      const vp = v.group.position;
      if ((vp.x - ped.x) ** 2 + (vp.z - ped.z) ** 2 < 2.1 * 2.1) {
        killPed(ped, v.kind === 'player');
        break;
      }
    }
    if (ped.dead) continue;

    const sw = Math.sin(ped.phase) * 0.55;
    ped.legL.rotation.x = sw;
    ped.legR.rotation.x = -sw;
    ped.armL.rotation.x = -sw * 0.7;
    ped.armR.rotation.x = sw * 0.7;
    ped.group.position.set(ped.x, 0.18, ped.z);
    ped.group.rotation.y = yaw;
  }
}
// build marker: pedestrians.js