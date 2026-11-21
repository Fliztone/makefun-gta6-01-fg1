// VELA BAY — vehicle factory (6 original body styles + police interceptor) and
// arcade driving physics: throttle/steer/handbrake, AABB and car-car collisions.
import { CFG, CAR_TYPES, PALETTE } from './config.js';
import { S } from './state.js';
import { clamp, damp, forwardOf, pick, makeRng } from './utils.js';
import { city } from './city.js';
import { addHeat } from './wanted.js';
import { sparksAt, smokeAt } from './effects.js';
import { sfx } from './audio.js';

const rng = makeRng(777);
let sceneRef = null;
const glassMat = new THREE.MeshLambertMaterial({ color: 0x22384a });
const darkMat = new THREE.MeshLambertMaterial({ color: 0x1c1f24 });
const tireMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2cc, toneMapped: false });
const tailMat = new THREE.MeshBasicMaterial({ color: 0xff3b30, toneMapped: false });

export function typeById(id) {
  return CAR_TYPES.find((t) => t.id === id) || CAR_TYPES[0];
}

export function initVehicles(scene) {
  sceneRef = scene;
}

function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// Builds a car group facing +z. Returns refs for wheels and police lightbar.
export function buildCarMesh(type, color) {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const { len, wid, hgt, kind } = type;
  const wheels = [], frontWheels = [];

  const bodyH = kind === 'van' ? 1.7 : kind === 'sport' ? 0.46 : 0.58;
  const bodyY = kind === 'sport' ? 0.5 : 0.62;
  g.add(box(wid, bodyH, len, paint, 0, bodyY, 0));
  if (kind === 'van') {
    g.add(box(wid * 0.96, 0.5, len * 0.28, paint, 0, 1.0, len * 0.36));
    g.add(box(wid * 0.9, 0.5, len * 0.62, glassMat, 0, 1.62, -len * 0.08));
  } else {
    const cabLen = kind === 'sport' ? len * 0.34 : kind === 'muscle' ? len * 0.36 : len * 0.44;
    const cabZ = kind === 'muscle' ? -len * 0.12 : -len * 0.05;
    g.add(box(wid * 0.82, kind === 'sport' ? 0.4 : 0.52, cabLen, glassMat, 0, bodyY + bodyH / 2 + 0.24, cabZ));
    g.add(box(wid * 0.86, 0.1, cabLen * 0.9, paint, 0, bodyY + bodyH / 2 + 0.5, cabZ));
  }
  if (kind === 'sport') g.add(box(wid * 0.9, 0.08, 0.5, darkMat, 0, 1.0, -len / 2 + 0.3)); // spoiler
  if (kind === 'muscle') g.add(box(wid * 0.5, 0.14, len * 0.3, darkMat, 0, bodyY + bodyH / 2 + 0.05, len * 0.24));
  g.add(box(wid + 0.1, 0.22, 0.3, darkMat, 0, 0.42, len / 2));   // front bumper
  g.add(box(wid + 0.1, 0.22, 0.3, darkMat, 0, 0.42, -len / 2));  // rear bumper
  g.add(box(0.34, 0.16, 0.08, headMat, wid / 2 - 0.3, bodyY + 0.1, len / 2 + 0.02));
  g.add(box(0.34, 0.16, 0.08, headMat, -wid / 2 + 0.3, bodyY + 0.1, len / 2 + 0.02));
  g.add(box(0.34, 0.14, 0.08, tailMat, wid / 2 - 0.3, bodyY + 0.1, -len / 2 - 0.02));
  g.add(box(0.34, 0.14, 0.08, tailMat, -wid / 2 + 0.3, bodyY + 0.1, -len / 2 - 0.02));

  if (kind === 'taxi') {
    g.add(box(0.8, 0.26, 0.34, new THREE.MeshBasicMaterial({ color: 0xffd166, toneMapped: false }), 0, bodyY + bodyH / 2 + 0.62, -len * 0.05));
  }

  let lightbar = null;
  if (kind === 'police') {
    g.add(box(wid * 0.98, 0.3, len * 0.3, darkMat, 0, bodyY + 0.02, len * 0.18)); // black hood panel
    const bar = box(1.3, 0.16, 0.4, darkMat, 0, bodyY + bodyH / 2 + 0.62, -len * 0.05);
    const red = new THREE.MeshBasicMaterial({ color: 0xff2030, toneMapped: false });
    const blue = new THREE.MeshBasicMaterial({ color: 0x2050ff, toneMapped: false });
    bar.add(box(0.5, 0.18, 0.36, red, -0.36, 0.1, 0));
    bar.add(box(0.5, 0.18, 0.36, blue, 0.36, 0.1, 0));
    g.add(bar);
    lightbar = { red, blue };
  }

  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const [sx, sz, front] of [[1, 1, true], [-1, 1, true], [1, -1, false], [-1, -1, false]]) {
    const wrap = new THREE.Group();
    wrap.position.set(sx * (wid / 2 - 0.05), 0.34, sz * len * 0.32);
    const w = new THREE.Mesh(wheelGeo, tireMat);
    w.castShadow = true;
    wrap.add(w);
    g.add(wrap);
    wheels.push(w);
    if (front) frontWheels.push(wrap);
  }
  return { group: g, wheels, frontWheels, lightbar, paint };
}

export function spawnVehicle(typeId, kind, x, z, yaw, color) {
  const type = typeById(typeId);
  const col = color ?? (type.kind === 'police' ? 0xf2f4f6 : type.kind === 'taxi' ? 0xf5c542 : pick(rng, PALETTE.cars));
  const parts = buildCarMesh(type, col);
  parts.group.position.set(x, 0, z);
  parts.group.rotation.y = yaw;
  const v = {
    ...parts, type, kind, color: col,
    heading: yaw, speed: 0, steer: 0, steerAngle: 0,
    throttle: 0, brake: 0, handbrake: false, drifting: false,
    hp: type.hp, dead: false, deadTime: 0, smokeTimer: 0,
    ai: null, flash: 0,
  };
  S.vehicles.push(v);
  sceneRef?.add(parts.group);
  return v;
}

export function removeVehicle(v) {
  const i = S.vehicles.indexOf(v);
  if (i >= 0) S.vehicles.splice(i, 1);
  if (S.player.inCar === v) S.player.inCar = null;
  sceneRef?.remove(v.group);
}

export function nearestVehicle(x, z, maxDist, filter) {
  let best = null, bd = maxDist * maxDist;
  for (const v of S.vehicles) {
    if (v.dead || (filter && !filter(v))) continue;
    const p = v.group.position;
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < bd) { bd = d; best = v; }
  }
  return best;
}

// Integrate one car's arcade physics from its controls.
export function driveVehicle(v, dt) {
  const t = v.type;
  if (v.dead) { v.speed = damp(v.speed, 0, 4, dt); v.throttle = 0; }
  if (v.throttle > 0) v.speed += v.throttle * t.accel * dt;
  else if (v.throttle < 0) {
    if (v.speed > 0.5) v.speed -= 16 * dt;           // braking
    else v.speed = Math.max(v.speed - 5 * dt, -6);   // reversing
  }
  if (v.brake > 0) v.speed = damp(v.speed, 0, v.brake * 3.2, dt);
  v.speed -= v.speed * 0.32 * dt;                    // drag
  if (Math.abs(v.speed) < 0.25 && v.throttle === 0) v.speed = 0;
  v.speed = clamp(v.speed, -6, t.speed);

  v.steerAngle = damp(v.steerAngle, v.steer * 0.5, 9, dt);
  const speedFactor = clamp(v.speed / 8, -1, 1);
  v.heading += v.steerAngle * t.grip * speedFactor * dt * (v.handbrake ? 1.55 : 1);
  v.drifting = (v.handbrake && Math.abs(v.speed) > 7) || (Math.abs(v.steerAngle) > 0.34 && Math.abs(v.speed) > 19);

  const f = forwardOf(v.heading);
  const p = v.group.position;
  p.x += f.x * v.speed * dt;
  p.z += f.z * v.speed * dt;
  v.group.rotation.y = v.heading;
  v.group.rotation.z = -v.steerAngle * clamp(Math.abs(v.speed) / 22, 0, 1) * 0.07;

  for (const w of v.wheels) w.rotation.x += v.speed * dt / 0.34;
  for (const fw of v.frontWheels) fw.rotation.y = v.steerAngle * 0.85;
}

function impact(v, strength, x, z) {
  if (strength > 6) {
    sparksAt(x, 0.6, z, Math.min(14, strength));
    sfx.crash(strength / 22);
    damageVehicle(v, (strength - 6) * 1.4);
    if (v.kind === 'player') S.lastHurt = S.time;
  }
}

// Buildings, world edges and other cars.
export function collideVehicle(v, dt) {
  const p = v.group.position;
  const r = CFG.CAR_RADIUS;
  for (const c of city.colliders) {
    if (p.x < c.x1 - r || p.x > c.x2 + r || p.z < c.z1 - r || p.z > c.z2 + r) continue;
    const cx = clamp(p.x, c.x1, c.x2), cz = clamp(p.z, c.z1, c.z2);
    let dx = p.x - cx, dz = p.z - cz;
    let d = Math.hypot(dx, dz);
    if (d >= r) continue;
    if (d < 0.001) { dx = 1; dz = 0; d = 1; }
    const push = (r - d);
    p.x += (dx / d) * push;
    p.z += (dz / d) * push;
    impact(v, Math.abs(v.speed), cx, cz);
    v.speed *= 0.3;
  }
  // World edges: surf stops cars at the shoreline.
  const lim = 312;
  if (p.x < -lim || p.x > lim || p.z < -lim || p.z > CFG.BEACH_END - 8) {
    p.x = clamp(p.x, -lim, lim);
    p.z = clamp(p.z, -lim, CFG.BEACH_END - 8);
    impact(v, Math.abs(v.speed), p.x, p.z);
    v.speed *= 0.3;
  }
  // Car-car bumps.
  for (const o of S.vehicles) {
    if (o === v) continue;
    const op = o.group.position;
    const dx = p.x - op.x, dz = p.z - op.z;
    const d2 = dx * dx + dz * dz;
    const rr = r * 2;
    if (d2 > rr * rr || d2 < 0.0001) continue;
    const d = Math.sqrt(d2);
    const push = (rr - d) / 2;
    p.x += (dx / d) * push; p.z += (dz / d) * push;
    op.x -= (dx / d) * push; op.z -= (dz / d) * push;
    const rel = Math.abs(v.speed - o.speed);
    if (rel > 7) {
      sparksAt((p.x + op.x) / 2, 0.6, (p.z + op.z) / 2, 8);
      sfx.crash(rel / 26);
      damageVehicle(v, rel * 0.5);
      damageVehicle(o, rel * 0.5);
      if ((v.kind === 'player' && o.kind === 'police') || (o.kind === 'player' && v.kind === 'police')) {
        addHeat(14, 'rammed a unit');
      }
    }
    v.speed *= 0.72;
    o.speed *= 0.72;
  }
}

export function damageVehicle(v, dmg) {
  if (v.dead) return;
  v.hp -= dmg;
  v.flash = 0.12;
  if (v.hp <= 0) {
    v.dead = true;
    v.deadTime = S.time;
    sparksAt(v.group.position.x, 1, v.group.position.z, 26);
    sfx.crash(0.6);
    if (v.kind === 'player') {
      // The player is thrown clear of the wreck.
      S.health -= 25;
      S.lastHurt = S.time;
    }
    if (v.kind === 'police') addHeat(22, 'disabled a unit');
  }
}

export function updateVehicles(dt) {
  for (let i = S.vehicles.length - 1; i >= 0; i--) {
    const v = S.vehicles[i];
    driveVehicle(v, dt);
    collideVehicle(v, dt);
    if (v.flash > 0) {
      v.flash -= dt;
      v.paint.emissive.setHex(v.flash > 0 ? 0x552211 : 0x000000);
    }
    if (v.dead) {
      v.smokeTimer -= dt;
      if (v.smokeTimer <= 0) {
        v.smokeTimer = 0.14;
        smokeAt(v.group.position.x, 1.2, v.group.position.z);
      }
      if (S.time - v.deadTime > 26 && v.kind !== 'mission' && v.kind !== 'player') {
        removeVehicle(v);
      }
    }
  }
}
// build marker: vehicles.js