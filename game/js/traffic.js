// VELA BAY — AI traffic: cars follow right-hand lanes along the avenue grid,
// pick turns at intersections, brake for obstacles, and wrap at the city edge.
import { CFG, ROADS } from './config.js';
import { S } from './state.js';
import { makeRng, pick, range, clamp, angleDelta } from './utils.js';
import { spawnVehicle } from './vehicles.js';

const rng = makeRng(9001);
const TRAFFIC_COUNT = 17;
const cruiseTypes = ['pelicano', 'brisa', 'coquina', 'camello', 'marlin', 'pelicano', 'brisa', 'vulcan'];

// Lane offset for a direction of travel (right-hand traffic).
function laneOffset(axis, dir) {
  if (axis === 'z') return dir < 0 ? CFG.LANE : -CFG.LANE; // northbound keeps east
  return dir > 0 ? CFG.LANE : -CFG.LANE;                  // eastbound keeps south
}
function axisYaw(axis, dir) {
  if (axis === 'z') return dir < 0 ? Math.PI : 0;
  return dir > 0 ? Math.PI / 2 : -Math.PI / 2;
}

function randomLanePoint() {
  const axis = rng() < 0.5 ? 'x' : 'z';
  const r = pick(rng, ROADS);
  const dir = rng() < 0.5 ? 1 : -1;
  const t = range(rng, -230, 230);
  const off = laneOffset(axis, dir);
  return axis === 'z'
    ? { x: r + off, z: t, axis, dir, road: r }
    : { x: t, z: r + off, axis, dir, road: r };
}

export function initTraffic(scene) {
  for (let i = 0; i < TRAFFIC_COUNT; i++) {
    const p = randomLanePoint();
    const v = spawnVehicle(pick(rng, cruiseTypes), 'traffic', p.x, p.z, axisYaw(p.axis, p.dir));
    v.ai = {
      axis: p.axis, dir: p.dir, road: p.road,
      cruise: range(rng, 9, 13.5),
      decided: false,
      wp: null,
      stuck: 0, reverse: 0,
    };
    v.speed = v.ai.cruise * 0.6;
    setStraightWaypoint(v);
  }
}

function setStraightWaypoint(v) {
  const a = v.ai;
  const p = v.group.position;
  const off = laneOffset(a.axis, a.dir);
  if (a.axis === 'z') a.wp = { x: a.road + off, z: p.z + a.dir * 20 };
  else a.wp = { x: p.x + a.dir * 20, z: a.road + off };
}

// At an intersection choose straight / left / right, staying inside the grid.
function decideTurn(v) {
  const a = v.ai;
  const p = v.group.position;
  const travelCoord = a.axis === 'z' ? p.z : p.x;
  let cross = ROADS[0];
  for (const r of ROADS) if (Math.abs(r - travelCoord) < Math.abs(cross - travelCoord)) cross = r;
  const otherCoord = a.axis === 'z' ? p.x : p.z;
  const straight = { axis: a.axis, dir: a.dir };
  const left = a.axis === 'z' ? { axis: 'x', dir: a.dir < 0 ? -1 : 1 } : { axis: 'z', dir: a.dir > 0 ? -1 : 1 };
  const right = a.axis === 'z' ? { axis: 'x', dir: a.dir < 0 ? 1 : -1 } : { axis: 'z', dir: a.dir > 0 ? 1 : -1 };
  const options = [];
  for (const [opt, w] of [[straight, 0.5], [left, 0.25], [right, 0.25]]) {
    const alongStart = opt.axis === a.axis ? travelCoord : otherCoord;
    if (Math.abs(alongStart + opt.dir * 45) < 256) options.push([opt, w]);
  }
  if (!options.length) options.push([left, 1]);
  const total = options.reduce((s, o) => s + o[1], 0);
  let roll = rng() * total;
  let chosen = options[0][0];
  for (const [opt, w] of options) { roll -= w; if (roll <= 0) { chosen = opt; break; } }
  a.axis = chosen.axis;
  a.dir = chosen.dir;
  a.road = cross;
  const off = laneOffset(a.axis, a.dir);
  if (a.axis === 'z') a.wp = { x: cross + off, z: p.z + a.dir * 14 };
  else a.wp = { x: p.x + a.dir * 14, z: cross + off };
  a.decided = true;
}

export function updateTraffic(dt) {
  for (const v of S.vehicles) {
    if (v.kind !== 'traffic' || v.dead || !v.ai) continue;
    const a = v.ai;
    const p = v.group.position;

    // Unstick: reversing out when blocked against a wall.
    if (a.reverse > 0) {
      a.reverse -= dt;
      v.throttle = -1; v.steer = 0.4; v.brake = 0;
      continue;
    }
    if (Math.abs(v.speed) < 0.6 && v.throttle > 0.5) {
      a.stuck += dt;
      if (a.stuck > 1.6) { a.reverse = 0.9; a.stuck = 0; }
    } else a.stuck = 0;

    // Intersection decision when approaching the crossing road.
    const travelCoord = a.axis === 'z' ? p.z : p.x;
    let nextCross = null;
    for (const r of ROADS) {
      const ahead = (r - travelCoord) * a.dir;
      if (ahead > -2 && ahead < 30 && (nextCross === null || ahead < (nextCross - travelCoord) * a.dir)) nextCross = r;
    }
    if (nextCross !== null) {
      const dToCross = (nextCross - travelCoord) * a.dir;
      if (dToCross < 7 && !a.decided) decideTurn(v);
      if (dToCross < -8) a.decided = false;
    } else a.decided = false;

    if (!a.wp) setStraightWaypoint(v);
    const dx = a.wp.x - p.x, dz = a.wp.z - p.z;
    const dWp = Math.hypot(dx, dz);
    if (dWp < 4) setStraightWaypoint(v);

    const desired = Math.atan2(a.wp.x - p.x, a.wp.z - p.z);
    const err = angleDelta(v.heading, desired);
    v.steer = clamp(err * 2.4, -1, 1);

    // Slow for turns, brake for cars and pedestrians ahead.
    let target = a.cruise * (Math.abs(err) > 0.45 ? 0.42 : 1);
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    for (const o of S.vehicles) {
      if (o === v) continue;
      const ox = o.group.position.x - p.x, oz = o.group.position.z - p.z;
      const d2 = ox * ox + oz * oz;
      if (d2 < 100 && ox * fx + oz * fz > 0.5) { target = Math.min(target, Math.max(0, Math.sqrt(d2) - 5)); }
    }
    if (!S.player.inCar) {
      const ox = S.player.x - p.x, oz = S.player.z - p.z;
      if (ox * ox + oz * oz < 64 && ox * fx + oz * fz > 0.5) target = 0;
    }
    v.throttle = v.speed < target ? 1 : 0;
    v.brake = v.speed > target + 2 ? 1 : 0;
    v.handbrake = false;
  }
}
// build marker: traffic.js