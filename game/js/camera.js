// VELA BAY — smooth third-person camera: mouse orbit on foot, speed-stretched
// chase cam that recenters behind the car, aim zoom, damage shake, menu flyover.
import { S } from './state.js';
import { clamp, damp, angleLerp } from './utils.js';
import { consumeMouse } from './input.js';

export let camera = null;
let lastMouseTime = -99;
let fovCurrent = 60;

export function initCamera() {
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2200);
  camera.position.set(0, 120, 260);
}

export function resizeCamera() {
  if (!camera) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

export function updateCamera(dt) {
  const p = S.player;
  const m = consumeMouse();

  if (S.mode === 'menu') {
    const t = S.time * 0.05;
    camera.position.set(Math.cos(t) * 250, 130, Math.sin(t) * 250 + 40);
    camera.lookAt(0, 22, 40);
    if (Math.abs(fovCurrent - 55) > 0.1) { fovCurrent = 55; camera.fov = 55; camera.updateProjectionMatrix(); }
    return;
  }

  if (S.mode === 'play' && (m.dx !== 0 || m.dy !== 0)) {
    lastMouseTime = S.time;
    S.cam.yaw -= m.dx * 0.0023;
    S.cam.pitch = clamp(S.cam.pitch + m.dy * 0.0018, -0.15, 0.85);
  }

  const car = p.inCar;
  const tx = car ? car.group.position.x : p.x;
  const tz = car ? car.group.position.z : p.z;
  const ty = (car ? 1.7 : 1.5) + (car ? 0 : p.y);

  // Chase cam drifts back behind the car when the mouse rests.
  if (car && !S.lockCam && S.time - lastMouseTime > 1.3) {
    S.cam.yaw = angleLerp(S.cam.yaw, car.heading, 1 - Math.exp(-2.4 * dt));
    S.cam.pitch = damp(S.cam.pitch, 0.24, 1.6, dt);
  }

  const dist = car ? 8.6 + Math.abs(car.speed) * 0.075 : S.aiming ? 4.3 : 5.4;
  const cy = S.cam.yaw, cp = S.cam.pitch;
  const fx = Math.sin(cy) * Math.cos(cp);
  const fy = Math.sin(cp);
  const fz = Math.cos(cy) * Math.cos(cp);
  let dx = tx - fx * dist, dy = ty - fy * dist + 0.4, dz = tz - fz * dist;
  if (S.aiming && !car) { dx += -Math.cos(cy) * 0.85; dz += Math.sin(cy) * 0.85; }
  dy = Math.max(0.55, dy);

  const rate = S.mode === 'dead' ? 3 : 13;
  camera.position.x = damp(camera.position.x, dx, rate, dt);
  camera.position.y = damp(camera.position.y, dy, rate, dt);
  camera.position.z = damp(camera.position.z, dz, rate, dt);

  if (S.shake > 0.001) {
    camera.position.x += (Math.random() - 0.5) * S.shake * 0.3;
    camera.position.y += (Math.random() - 0.5) * S.shake * 0.22;
    S.shake *= Math.exp(-5.5 * dt);
  }

  const lookAhead = car ? 3.2 : 2.2;
  const lx = tx + Math.sin(car ? car.heading : cy) * lookAhead;
  const lz = tz + Math.cos(car ? car.heading : cy) * lookAhead;
  camera.lookAt(lx, ty + 0.35, lz);

  const fovTarget = car ? clamp(62 + Math.abs(car.speed) * 0.34, 62, 77) : S.aiming ? 46 : 60;
  fovCurrent = damp(fovCurrent, fovTarget, 6, dt);
  if (Math.abs(camera.fov - fovCurrent) > 0.05) {
    camera.fov = fovCurrent;
    camera.updateProjectionMatrix();
  }
}
// build marker: camera.js