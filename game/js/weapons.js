// VELA BAY — pistol combat: hip fire and over-shoulder aiming, hitscan against
// pedestrians, cars and buildings, tracers, muzzle flash, reloads.
import { S } from './state.js';
import { clamp } from './utils.js';
import { city } from './city.js';
import { damageVehicle } from './vehicles.js';
import { killPed } from './pedestrians.js';
import { addHeat } from './wanted.js';
import { tracer, muzzleFlash, sparksAt } from './effects.js';
import { sfx } from './audio.js';

let cooldown = 0;

function rayAABB(ox, oy, oz, dx, dy, dz, c) {
  let tmin = 0, tmax = 1e9;
  const lo = [c.x1, 0, c.z1], hi = [c.x2, c.h + 0.16, c.z2];
  const o = [ox, oy, oz], d = [dx, dy, dz];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-8) {
      if (o[i] < lo[i] || o[i] > hi[i]) return -1;
    } else {
      let t1 = (lo[i] - o[i]) / d[i], t2 = (hi[i] - o[i]) / d[i];
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return -1;
    }
  }
  return tmin;
}

function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const ex = ox - cx, ey = oy - cy, ez = oz - cz;
  const b = ex * dx + ey * dy + ez * dz;
  const c = ex * ex + ey * ey + ez * ez - r * r;
  const disc = b * b - c;
  if (disc < 0) return -1;
  const t = -b - Math.sqrt(disc);
  return t > 0 ? t : -1;
}

export function updateWeapons(dt, camera, input) {
  const p = S.player;
  if (cooldown > 0) cooldown -= dt;
  if (S.reloading > 0) {
    S.reloading -= dt;
    if (S.reloading <= 0) { S.ammo = 12; S.reloading = 0; }
  }
  S.aiming = input.mouse.right && !p.inCar && S.mode === 'play';

  if (input.wasPressed('KeyR') && S.ammo < 12 && S.reloading <= 0 && !p.inCar) {
    S.reloading = 1.1;
    sfx.reload();
  }

  if (!input.mouse.leftPressed || p.inCar || S.mode !== 'play') return;
  if (S.reloading > 0) return;
  if (S.ammo <= 0) {
    sfx.dry();
    S.reloading = 1.1;
    sfx.reload();
    return;
  }
  if (cooldown > 0) return;

  cooldown = 0.19;
  S.ammo--;
  S.stats.shots++;
  S.lastShotTime = S.time;
  sfx.shot();
  addHeat(7, 'gunfire');
  S.shake = Math.min(1, (S.shake || 0) + 0.12);

  // Ray from the camera through the crosshair.
  const yaw = S.cam.yaw, pitch = S.cam.pitch;
  const dx = Math.sin(yaw) * Math.cos(pitch);
  const dy = Math.sin(pitch);
  const dz = Math.cos(yaw) * Math.cos(pitch);
  const ox = camera.position.x, oy = camera.position.y, oz = camera.position.z;

  let bestT = 80, hit = null;
  for (const c of city.colliders) {
    const t = rayAABB(ox, oy, oz, dx, dy, dz, c);
    if (t > 0 && t < bestT) { bestT = t; hit = { kind: 'wall' }; }
  }
  for (const ped of S.peds) {
    if (ped.dead) continue;
    const t = raySphere(ox, oy, oz, dx, dy, dz, ped.x, 0.85, ped.z, 0.55);
    if (t > 0 && t < bestT) { bestT = t; hit = { kind: 'ped', ped }; }
  }
  for (const v of S.vehicles) {
    if (v === p.inCar || v.dead) continue;
    const vp = v.group.position;
    const t = raySphere(ox, oy, oz, dx, dy, dz, vp.x, 0.8, vp.z, 2.1);
    if (t > 0 && t < bestT) { bestT = t; hit = { kind: 'car', v }; }
  }
  if (dy < -0.001) {
    const t = -oy / dy;
    if (t > 0 && t < bestT) { bestT = t; hit = { kind: 'ground' }; }
  }

  const hx = ox + dx * bestT, hy = oy + dy * bestT, hz = oz + dz * bestT;
  const f = { x: Math.sin(p.yaw), z: Math.cos(p.yaw) };
  const mx = p.x + f.x * 0.55, mz = p.z + f.z * 0.55;
  muzzleFlash(mx, 1.3, mz);
  tracer({ x: mx, y: 1.3, z: mz }, { x: hx, y: hy, z: hz });

  if (hit?.kind === 'ped') {
    killPed(hit.ped, true);
    S.hitFlash = 1;
  } else if (hit?.kind === 'car') {
    damageVehicle(hit.v, 14);
    sparksAt(hx, hy, hz, 7);
    if (hit.v.kind === 'police') S.hitFlash = 1;
  } else if (hit) {
    sparksAt(hx, hy, hz, 5);
  }
}
// build marker: weapons.js