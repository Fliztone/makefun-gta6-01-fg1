// VELA BAY — Kai Moreno on foot: camera-relative WASD, sprint, jump, building
// collision, enter/exit/carjack any vehicle, health, damage and respawn.
import { CFG } from './config.js';
import { S } from './state.js';
import { clamp, damp, angleLerp, forwardOf } from './utils.js';
import { city } from './city.js';
import { nearestVehicle, spawnVehicle } from './vehicles.js';
import { addHeat } from './wanted.js';
import { spawnPed } from './pedestrians.js';
import { sfx } from './audio.js';

const CLINIC = { x: -180, z: -144 };
let parts = null;

function limb(w, h, d, mat, px, py, pz, oy) {
  const wrap = new THREE.Group();
  wrap.position.set(px, py, pz);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.y = oy;
  m.castShadow = true;
  wrap.add(m);
  return wrap;
}

export function initPlayer(scene) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: 0xf2784f });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2f3a52 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a06b });
  const hair = new THREE.MeshLambertMaterial({ color: 0x241a12 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.5, 0.22), shirt);
  torso.position.y = 0.88;
  torso.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.145, 10, 8), skin);
  head.position.y = 1.28;
  head.castShadow = true;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
  cap.position.y = 1.3;
  const shades = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.05), new THREE.MeshLambertMaterial({ color: 0x101216 }));
  shades.position.set(0, 1.29, 0.13);
  const legL = limb(0.14, 0.56, 0.14, jeans, -0.1, 0.62, 0, -0.28);
  const legR = limb(0.14, 0.56, 0.14, jeans, 0.1, 0.62, 0, -0.28);
  const armL = limb(0.1, 0.46, 0.1, skin, -0.25, 1.08, 0, -0.2);
  const armR = limb(0.1, 0.46, 0.1, skin, 0.25, 1.08, 0, -0.2);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.24), new THREE.MeshLambertMaterial({ color: 0x181a1e }));
  gun.position.set(0, -0.42, 0.1);
  armR.add(gun);
  g.add(torso, head, cap, shades, legL, legR, armL, armR);
  g.scale.setScalar(1.12);
  scene.add(g);
  parts = { legL, legR, armL, armR, torso };
  S.player.mesh = g;
}

export function enterCar(v) {
  const p = S.player;
  if (v.kind === 'traffic' || v.kind === 'police') {
    // Carjacking: the driver bails and the heat goes up.
    const f = forwardOf(v.heading);
    spawnPed(v.group.position.x - f.z * 1.6, v.group.position.z + f.x * 1.6, true);
    addHeat(v.kind === 'police' ? 24 : 16, v.kind === 'police' ? 'stole a police unit' : 'carjacking');
  }
  v.kind = 'player';
  v.ai = null;
  v.throttle = v.brake = v.steer = 0;
  p.inCar = v;
  p.mesh.visible = false;
  sfx.enter();
}

export function exitCar() {
  const p = S.player;
  const v = p.inCar;
  if (!v) return;
  const f = forwardOf(v.heading);
  p.x = v.group.position.x - f.z * 2.3;
  p.z = v.group.position.z + f.x * 2.3;
  p.y = 0;
  p.vy = 0;
  p.inCar = null;
  v.kind = v.type.kind === 'police' ? 'police' : 'parked';
  v.throttle = 0;
  v.brake = 1;
  p.mesh.visible = true;
  sfx.enter();
}

export function damagePlayer(n) {
  if (S.mode !== 'play') return;
  S.health -= n;
  S.lastHurt = S.time;
  S.hurtFlash = 1;
  S.shake = Math.min(1, S.shake + n * 0.02);
  sfx.hurt();
  if (S.health <= 0) {
    S.health = 0;
    if (S.player.inCar) exitCar();
    S.mode = 'dead';
    document.exitPointerLock?.();
  }
}

export function respawn() {
  const p = S.player;
  p.x = CLINIC.x; p.z = CLINIC.z; p.y = 0; p.vy = 0;
  p.inCar = null;
  p.mesh.visible = true;
  S.health = 100;
  S.heat = 0;
  S.cash = Math.max(0, S.cash - 100);
  S.mode = 'play';
}

function collideFoot(px, pz) {
  const r = CFG.PLAYER_RADIUS;
  for (const c of city.colliders) {
    if (px < c.x1 - r || px > c.x2 + r || pz < c.z1 - r || pz > c.z2 + r) continue;
    const cx = clamp(px, c.x1, c.x2), cz = clamp(pz, c.z1, c.z2);
    let dx = px - cx, dz = pz - cz;
    let d = Math.hypot(dx, dz);
    if (d >= r) continue;
    if (d < 0.001) { dx = 1; dz = 0; d = 1; }
    px += (dx / d) * (r - d);
    pz += (dz / d) * (r - d);
  }
  // Parked cars are solid; you can still reach the door.
  for (const v of S.vehicles) {
    const vp = v.group.position;
    const dx = px - vp.x, dz = pz - vp.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < 1.5 * 1.5 && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      px += (dx / d) * (1.5 - d);
      pz += (dz / d) * (1.5 - d);
    }
  }
  px = clamp(px, -310, 310);
  pz = clamp(pz, -310, CFG.BEACH_END - 2);
  return { x: px, z: pz };
}

export function updatePlayer(dt, input) {
  const p = S.player;

  if (p.inCar) {
    const v = p.inCar;
    if (v.dead) { exitCar(); damagePlayer(0.01); }
    else {
      v.throttle = (input.anyKey('KeyW', 'ArrowUp') ? 1 : 0) - (input.anyKey('KeyS', 'ArrowDown') ? 1 : 0);
      v.steer = (input.anyKey('KeyA', 'ArrowLeft') ? 1 : 0) - (input.anyKey('KeyD', 'ArrowRight') ? 1 : 0);
      v.handbrake = input.isDown('Space');
      v.brake = 0;
      if (v.drifting && Math.abs(v.speed) > 8) {
        const f = forwardOf(v.heading);
        const rx = v.group.position.x - f.x * v.type.len * 0.32;
        const rz = v.group.position.z - f.z * v.type.len * 0.32;
        input.skidTick = (input.skidTick || 0) + dt;
        if (input.skidTick > 0.03) {
          input.skidTick = 0;
          input.skidAt(rx - f.z * 0.8, rz + f.x * 0.8, v.heading);
          input.skidAt(rx + f.z * 0.8, rz - f.x * 0.8, v.heading);
        }
      }
      S.stats.distance += Math.abs(v.speed) * dt;
      if (input.wasPressed('KeyE') || input.wasPressed('KeyF')) exitCar();
    }
    return;
  }

  // On foot.
  const ix = (input.anyKey('KeyD', 'ArrowRight') ? 1 : 0) - (input.anyKey('KeyA', 'ArrowLeft') ? 1 : 0);
  const iz = (input.anyKey('KeyW', 'ArrowUp') ? 1 : 0) - (input.anyKey('KeyS', 'ArrowDown') ? 1 : 0);
  const sprint = input.anyKey('ShiftLeft', 'ShiftRight');
  const maxSp = (sprint ? CFG.SPRINT_SPEED : CFG.WALK_SPEED) * (S.aiming ? 0.45 : 1);
  const cy = S.cam.yaw;
  const fx = Math.sin(cy), fz = Math.cos(cy);
  const rx = -fz, rz = fx;
  let mx = fx * iz + rx * ix, mz = fz * iz + rz * ix;
  const ml = Math.hypot(mx, mz);
  if (ml > 0.01) { mx /= ml; mz /= ml; }
  p.speed = damp(p.speed, ml > 0.01 ? maxSp : 0, 12, dt);
  if (ml > 0.01) p.yaw = angleLerp(p.yaw, Math.atan2(mx, mz), 1 - Math.exp(-14 * dt));
  if (S.aiming) p.yaw = cy;

  if (input.wasPressed('Space') && p.grounded) { p.vy = CFG.JUMP_VEL; p.grounded = false; }
  p.vy -= CFG.GRAVITY * dt;
  p.y += p.vy * dt;
  if (p.y <= 0) { p.y = 0; p.vy = 0; p.grounded = true; }

  const moved = collideFoot(p.x + mx * p.speed * dt, p.z + mz * p.speed * dt);
  p.x = moved.x; p.z = moved.z;
  S.stats.distance += p.speed * dt;

  p.walkPhase += p.speed * dt * 2.4;
  const sw = Math.sin(p.walkPhase) * clamp(p.speed / CFG.WALK_SPEED, 0, 1.3) * 0.6;
  parts.legL.rotation.x = sw;
  parts.legR.rotation.x = -sw;
  parts.armL.rotation.x = -sw * 0.8;
  parts.armR.rotation.x = S.aiming ? -1.35 : sw * 0.8;
  p.mesh.position.set(p.x, p.y, p.z);
  p.mesh.rotation.y = p.yaw;

  // Enter / carjack the nearest ride.
  const near = nearestVehicle(p.x, p.z, 3.4, (v) => v.kind !== 'player');
  S.interactTarget = near;
  if (near && (input.wasPressed('KeyE') || input.wasPressed('KeyF'))) enterCar(near);

  // Slow recovery after staying out of trouble.
  if (S.time - S.lastHurt > 8 && S.health < 100) S.health = Math.min(100, S.health + 3 * dt);
}
// build marker: player.js