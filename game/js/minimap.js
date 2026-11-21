// VELA BAY — top-down canvas minimap: street grid, beach and water, traffic,
// flashing police dots, mission markers and the player arrow. North is up.
import { CFG, BLOCKS, ROADS } from './config.js';
import { S, starsOf } from './state.js';

const SIZE = 176;
const RANGE = 150; // meters shown from center to edge
let ctx = null;

export function initMinimap(canvas) {
  ctx = canvas.getContext('2d');
}

export function drawMinimap() {
  if (!ctx) return;
  const p = S.player;
  const cx = p.inCar ? p.inCar.group.position.x : p.x;
  const cz = p.inCar ? p.inCar.group.position.z : p.z;
  const s = SIZE / (RANGE * 2);
  const X = (wx) => (wx - cx) * s + SIZE / 2;
  const Y = (wz) => (wz - cz) * s + SIZE / 2;

  ctx.fillStyle = '#0c1219';
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Water and beach to the south.
  const shoreY = Y(CFG.BEACH_END);
  if (shoreY < SIZE) {
    ctx.fillStyle = '#123c50';
    ctx.fillRect(0, Math.max(0, shoreY), SIZE, SIZE);
    ctx.fillStyle = '#b8985f';
    ctx.fillRect(0, Math.max(0, Y(CFG.EDGE)), SIZE, Math.max(0, Math.min(SIZE, shoreY) - Math.max(0, Y(CFG.EDGE))));
  }

  // Blocks then roads.
  ctx.fillStyle = '#1c2733';
  for (const bx of BLOCKS) for (const bz of BLOCKS) {
    ctx.fillRect(X(bx - CFG.BLOCK / 2), Y(bz - CFG.BLOCK / 2), CFG.BLOCK * s, CFG.BLOCK * s);
  }
  ctx.strokeStyle = '#38455a';
  ctx.lineWidth = CFG.ROAD * s;
  ctx.beginPath();
  for (const r of ROADS) {
    ctx.moveTo(X(r), Y(-CFG.EDGE)); ctx.lineTo(X(r), Y(CFG.EDGE));
    ctx.moveTo(X(-CFG.EDGE), Y(r)); ctx.lineTo(X(CFG.EDGE), Y(r));
  }
  ctx.stroke();

  // Traffic.
  ctx.fillStyle = '#7a8494';
  for (const v of S.vehicles) {
    if (v.kind === 'police' || v.kind === 'player' || v.dead) continue;
    ctx.fillRect(X(v.group.position.x) - 1.2, Y(v.group.position.z) - 1.2, 2.4, 2.4);
  }

  // Police: flashing red.
  const flash = Math.sin(S.time * 8) > 0;
  ctx.fillStyle = flash ? '#ff3b4a' : '#8a1520';
  for (const v of S.vehicles) {
    if (v.kind !== 'police' || v.dead) continue;
    ctx.beginPath();
    ctx.arc(X(v.group.position.x), Y(v.group.position.z), 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Mission markers: pulsing gold (cyan for race).
  for (const mk of S.markers) {
    const mx = Math.max(8, Math.min(SIZE - 8, X(mk.x)));
    const my = Math.max(8, Math.min(SIZE - 8, Y(mk.z)));
    const pulse = 3.4 + Math.sin(S.time * 4) * 1.2;
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(mx, my, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,209,102,0.7)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(mx, my, pulse + 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Player arrow.
  const yaw = p.inCar ? p.inCar.heading : p.yaw;
  ctx.save();
  ctx.translate(SIZE / 2, SIZE / 2);
  ctx.rotate(Math.atan2(Math.sin(yaw), -Math.cos(yaw)));
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(4.4, 5);
  ctx.lineTo(-4.4, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Wanted tint around the rim.
  if (starsOf() > 0) {
    ctx.strokeStyle = flash ? 'rgba(255,59,74,0.85)' : 'rgba(255,59,74,0.35)';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, SIZE - 3, SIZE - 3);
  }
}
// build marker: minimap.js