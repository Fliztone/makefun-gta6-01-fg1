// VELA BAY — small math helpers and a seeded RNG so the city builds the same every run.

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));

export function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export const angleLerp = (a, b, t) => a + angleDelta(a, b) * t;

export const dist2 = (ax, az, bx, bz) => {
  const dx = ax - bx, dz = az - bz;
  return dx * dx + dz * dz;
};

// mulberry32: deterministic city layout.
export function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
export const range = (rng, a, b) => a + rng() * (b - a);

// Forward vector for a yaw where 0 faces +z (matches our car meshes).
export const forwardOf = (yaw) => ({ x: Math.sin(yaw), z: Math.cos(yaw) });

export function fmtCash(n) {
  return '$' + Math.max(0, Math.round(n)).toLocaleString('en-US');
}
// build marker: utils.js