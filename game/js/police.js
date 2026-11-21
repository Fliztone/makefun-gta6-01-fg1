// VELA BAY — the VBPD response: interceptors spawn near the player as stars
// rise, chase and ram, fire at 3+ stars, flash lightbars, and leave when the
// heat dies. Sirens are mixed in audio.js from the nearest unit.
import { ROADS } from './config.js';
import { S, starsOf } from './state.js';
import { clamp, angleDelta, makeRng } from './utils.js';
import { spawnVehicle, removeVehicle } from './vehicles.js';
import { damagePlayer } from './player.js';
import { tracer, muzzleFlash, sparksAt } from './effects.js';
import { sfx } from './audio.js';

const rng = makeRng(5150);

function spawnCopNear(px, pz) {
  for (let tries = 0; tries < 24; tries++) {
    const vertical = rng() < 0.5;
    const r = ROADS[Math.floor(rng() * ROADS.length)];
    const t = -240 + rng() * 480;
    const x = vertical ? r : t;
    const z = vertical ? t : r;
    const d = Math.hypot(x - px, z - pz);
    if (d < 60 || d > 130) continue;
    const yaw = Math.atan2(px - x, pz - z);
    const v = spawnVehicle('interceptor', 'police', x, z, yaw);
    v.ai = { shoot: 1.5 + rng() * 2, stuck: 0, reverse: 0, flash: rng() * 6, leaving: false };
    v.speed = 10;
    return v;
  }
  return null;
}

export function updatePolice(dt) {
  const stars = starsOf();
  const p = S.player;
  const px = p.inCar ? p.inCar.group.position.x : p.x;
  const pz = p.inCar ? p.inCar.group.position.z : p.z;
  const desired = stars >= 1 ? Math.min(6, stars + (stars >= 4 ? 1 : 0)) : 0;

  const cops = S.vehicles.filter((v) => v.kind === 'police');
  const active = cops.filter((v) => !v.dead && !v.ai?.leaving);
  if (active.length < desired) spawnCopNear(px, pz);

  for (const v of cops) {
    const a = v.ai;
    if (!a) continue;
    const vp = v.group.position;
    const dist = Math.hypot(vp.x - px, vp.z - pz);

    // Lightbar flash.
    if (v.lightbar && !v.dead) {
      a.flash += dt * 7;
      const on = Math.sin(a.flash) > 0;
      v.lightbar.red.color.setHex(on ? 0xff2030 : 0x40080c);
      v.lightbar.blue.color.setHex(on ? 0x0c1040 : 0x2050ff);
    }

    if (v.dead) { v.throttle = 0; v.brake = 1; continue; }

    if (stars === 0 && !a.leaving) a.leaving = true;
    if (a.leaving) {
      const away = Math.atan2(vp.x - px, vp.z - pz);
      v.steer = clamp(angleDelta(v.heading, away) * 2, -1, 1);
      v.throttle = 1;
      v.brake = 0;
      if (dist > 150) removeVehicle(v);
      continue;
    }

    // Pursue: aim at where the player is heading.
    let tx = px, tz = pz;
    if (p.inCar) {
      tx += Math.sin(p.inCar.heading) * p.inCar.speed * 0.45;
      tz += Math.cos(p.inCar.heading) * p.inCar.speed * 0.45;
    }
    if (a.reverse > 0) {
      a.reverse -= dt;
      v.throttle = -1;
      v.steer = -0.5;
    } else {
      const want = Math.atan2(tx - vp.x, tz - vp.z);
      v.steer = clamp(angleDelta(v.heading, want) * 2.4, -1, 1);
      v.throttle = dist < 5 ? 0.55 : 1;
      v.brake = 0;
      if (Math.abs(v.speed) < 0.8 && v.throttle > 0.5) {
        a.stuck += dt;
        if (a.stuck > 1.4) { a.reverse = 0.8; a.stuck = 0; }
      } else a.stuck = 0;
    }
    v.handbrake = false;

    // Units open fire at 3+ stars when close.
    if (stars >= 3 && dist < 30 && dist > 5) {
      a.shoot -= dt;
      if (a.shoot <= 0) {
        a.shoot = 1.5 + rng() * 1.8;
        const my = 1.1;
        muzzleFlash(vp.x, my, vp.z);
        sfx.shot();
        const hit = rng() < 0.45;
        const jy = p.inCar ? 1 : 0.9;
        const jx = px + (rng() - 0.5) * (hit ? 0.3 : 2.4);
        const jz = pz + (rng() - 0.5) * (hit ? 0.3 : 2.4);
        tracer({ x: vp.x, y: my, z: vp.z }, { x: jx, y: jy, z: jz });
        if (hit) {
          damagePlayer(p.inCar ? 3 : 6);
          sparksAt(px, 0.9, pz, 4);
        }
      }
    }
  }
}
// build marker: police.js