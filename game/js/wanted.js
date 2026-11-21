// VELA BAY — wanted level: crimes build heat (0..100 -> 1..5 stars), police
// proximity holds it up, distance and quiet let it evaporate.
import { S, starsOf } from './state.js';
import { clamp } from './utils.js';

export function addHeat(n, reason) {
  if (S.mode !== 'play') return;
  const before = starsOf();
  S.heat = clamp(S.heat + n, 0, 100);
  S.lastCrime = S.time;
  S.crimeFlash = 1;
  S.crimeMsg = reason;
  S.stats.crimes++;
  if (starsOf() > before) S.starFlash = 1;
}

export function clearHeat() {
  S.heat = 0;
  S.crimeFlash = 0;
}

export function updateWanted(dt) {
  // Nearest active police unit drives both the siren mix and the cooldown.
  let nearest = 999;
  const p = S.player;
  const px = p.inCar ? p.inCar.group.position.x : p.x;
  const pz = p.inCar ? p.inCar.group.position.z : p.z;
  for (const v of S.vehicles) {
    if (v.kind !== 'police' || v.dead) continue;
    const d = Math.hypot(v.group.position.x - px, v.group.position.z - pz);
    if (d < nearest) nearest = d;
  }
  S.nearestCopDist = nearest;

  if (S.heat > 0) {
    const hidden = nearest > 55 && S.time - S.lastCrime > 4;
    if (hidden) S.heat = Math.max(0, S.heat - 8.5 * dt);
    else if (nearest > 30) S.heat = Math.max(0, S.heat - 1.2 * dt);
  }
  if (S.crimeFlash > 0) S.crimeFlash = Math.max(0, S.crimeFlash - dt * 1.4);
  if (S.starFlash > 0) S.starFlash = Math.max(0, S.starFlash - dt * 1.2);
}
// build marker: wanted.js