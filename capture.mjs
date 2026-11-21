// VELA BAY — automated play-test + screenshot pass.
// Serves game/ over loopback, drives the real game in headless Edge (playwright-core),
// asserts the core systems work with ZERO console errors / external requests, and
// captures the four submission screenshots from real renders.
import { createServer } from 'node:http';
import { createReadStream, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('D:/Project X/makefun/tools-shots/node_modules/playwright-core');

const here = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(join(here, 'game'));
const PORT = 8123;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

const server = createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400).end(); return; }
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = resolve(join(root, normalize(pathname)));
  if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
  try {
    const st = statSync(file);
    if (!st.isFile()) throw new Error('no');
    res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream', 'content-length': st.size });
    createReadStream(file).pipe(res);
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const consoleErrors = [];
const pageErrors = [];
const externalRequests = [];
const allRequests = [];

const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--no-sandbox', '--disable-gpu-sandbox', '--hide-scrollbars', '--mute-audio'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => pageErrors.push(String(e)));
page.on('request', (r) => {
  allRequests.push(r.url());
  if (!r.url().startsWith(`http://127.0.0.1:${PORT}`) && !r.url().startsWith('data:')) externalRequests.push(r.url());
});

const log = (...a) => console.log('[shots]', ...a);
const sim = (sec) => page.evaluate(`new Promise(res => { const t0 = VB.S.time; const iv = setInterval(() => { if (VB.S.time > t0 + ${sec}) { clearInterval(iv); res(); } }, 60); })`);
const ev = (fn, arg) => page.evaluate(fn, arg);

async function shot(name, maxTries = 4) {
  let q = 86;
  for (let i = 0; i < maxTries; i++) {
    const buf = await page.screenshot({ type: 'jpeg', quality: q });
    if (buf.length <= 250 * 1024) {
      writeFileSync(join(here, 'screenshots', name), buf);
      log(name, `${buf.length} bytes (q${q})`);
      return;
    }
    q -= 8;
  }
  throw new Error(`${name}: could not fit under 250KiB`);
}

try {
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' });
  await page.waitForFunction('window.VB && VB.S && VB.S.time > 0.4', null, { timeout: 60000 });
  log('booted, sim time flowing');
  await ev(() => VB.fastSim(true));
  await sim(1.5);

  // ---- start screen -> play ----
  await page.click('#btnNew');
  await page.waitForFunction('VB.S.mode === "play"', null, { timeout: 15000 });
  log('PASS: play mode entered');

  // ---- on-foot movement ----
  const before = await ev(() => ({ x: VB.S.player.x, z: VB.S.player.z }));
  await page.keyboard.down('KeyW');
  await page.waitForFunction(`Math.hypot(VB.S.player.x - ${before.x}, VB.S.player.z - ${before.z}) > 3`, null, { timeout: 20000 });
  await page.keyboard.up('KeyW');
  log('PASS: walked');

  // ---- driving ----
  await ev(() => VB.giveCar('vulcan'));
  await page.waitForFunction('VB.S.player.inCar !== null', null, { timeout: 10000 });
  await page.keyboard.down('KeyW');
  await page.waitForFunction('VB.S.player.inCar && VB.S.player.inCar.speed > 15', null, { timeout: 25000 });
  await page.keyboard.up('KeyW');
  log('PASS: driving at speed', await ev(() => Math.round(VB.S.player.inCar.speed * 3.6)));

  // ---- shooting ----
  await ev(() => VB.exitCar());
  await page.waitForFunction('VB.S.player.inCar === null', null, { timeout: 10000 });
  await page.mouse.click(640, 300);
  await page.waitForFunction('VB.S.ammo < 12', null, { timeout: 10000 });
  log('PASS: pistol fired, ammo', await ev(() => VB.S.ammo));

  // ---- wanted + police ----
  await ev(() => VB.setWanted(2));
  await page.waitForFunction('VB.S.vehicles.some(v => v.kind === "police")', null, { timeout: 20000 });
  log('PASS: police spawned at 2 stars');

  // ---- mission ----
  await ev(() => VB.startMission(1));
  await page.waitForFunction('VB.S.mission.index === 1 && VB.S.markers.length > 0', null, { timeout: 10000 });
  log('PASS: mission 2 active with marker');

  // ---- save ----
  await ev(() => VB.save());
  const saved = await ev(() => localStorage.getItem('vela-bay-save-v1') !== null);
  if (!saved) throw new Error('save failed');
  log('PASS: localStorage save');

  // ================= SCREENSHOT 1 — cover: police chase =================
  await ev(() => {
    VB.clearDialogs();
    VB.S.heat = 0;
    VB.startMission(2);                       // HEAT WAVE: evade objective, 3 stars
    VB.giveCar('vulcan');
    VB.teleport(-60, 39.6);                   // eastbound lane of the z=36 avenue
    const car = VB.S.player.inCar;
    car.heading = Math.PI / 2;
    car.speed = 24;
    VB.setWanted(3);
    const cops = [VB.spawnCop(-13, 3.6), VB.spawnCop(-21, -3.6), VB.spawnCop(-29, 0)];
    for (const c of cops) { c.heading = Math.PI / 2; c.speed = 24; }
    VB.setCam(-0.9, 0.14);
  });
  await sim(0.25);                            // dialog pops, pursuit closes a little
  await ev(() => VB.freeze(true));            // hold the composed chase frame
  await sim(0.4);                             // let the camera settle
  await shot('01-cover-chase.jpg');
  await ev(() => VB.freeze(false));
  log('shot 1: chase, stars =', await ev(() => Math.ceil(VB.S.heat / 20)), 'cop dist =', await ev(() => Math.round(VB.S.nearestCopDist)));

  // ================= SCREENSHOT 2 — neon downtown on foot =================
  const sign = await ev(() => {
    const cands = VB.city.neon.filter((n) => n.y >= 6 && n.y <= 16);
    const pool = cands.length ? cands : VB.city.neon;
    const sorted = [...pool].sort((a, b) => (Math.abs(a.x) + Math.abs(a.z)) - (Math.abs(b.x) + Math.abs(b.z)));
    const n = sorted[0];
    return { x: n.x, y: n.y, z: n.z, yaw: n.yaw };
  });
  await ev((s) => {
    VB.exitCar();
    VB.clearDialogs();
    VB.S.heat = 0;
    VB.S.lockCam = false;
    VB.startMission(0);
    const nx = Math.sin(s.yaw), nz = Math.cos(s.yaw);
    // Look ALONG the street so neon facades line the frame, not a blank wall.
    let tx = nz, tz = -nx;
    if (tx * s.x + tz * s.z > 0) { tx = -tx; tz = -tz; }
    const viewYaw = Math.atan2(tx, tz);
    const blocks = [-216, -144, -72, 0, 72, 144, 216];
    let bx = blocks[0], bz = blocks[0];
    for (const q of blocks) {
      if (Math.abs(q - s.x) < Math.abs(bx - s.x)) bx = q;
      if (Math.abs(q - s.z) < Math.abs(bz - s.z)) bz = q;
    }
    const px = bx + nx * 26 + tx * 6, pz = bz + nz * 26 + tz * 6;
    VB.teleport(px, pz);
    VB.S.player.yaw = viewYaw;
    VB.setCam(viewYaw, 0.12);
    VB.spawnPed(px + tx * 9, pz + tz * 9);
    VB.spawnPed(px + tx * 14, pz + tz * 14);
    VB.spawnPed(bx + nx * 26 - tx * 8, bz + nz * 26 - tz * 8);
    // Two slow traffic cars in the avenue ahead, one per direction.
    const roads = [-252, -180, -108, -36, 36, 108, 180, 252];
    const alongX = Math.abs(tx) > Math.abs(tz);
    const rc = alongX ? bz + nz * 36 : bx + nx * 36;
    let r = roads[0];
    for (const q of roads) if (Math.abs(q - rc) < Math.abs(r - rc)) r = q;
    const ts = VB.S.vehicles.filter((v) => v.kind === 'traffic');
    const place = (v, ahead, side, yaw, dir) => {
      if (!v) return;
      const x = alongX ? px + tx * ahead : r + side * 3.6;
      const z = alongX ? r + side * 3.6 : pz + tz * ahead;
      v.group.position.set(x, 0, z);
      v.heading = yaw;
      v.ai.axis = alongX ? 'x' : 'z';
      v.ai.dir = dir;
      v.ai.road = r;
      v.ai.wp = null;
      v.ai.cruise = 3;
      v.speed = 3;
    };
    place(ts[0], 16, 1, viewYaw + Math.PI, alongX ? -Math.sign(tx) : -Math.sign(tz));
    place(ts[1], 24, -1, viewYaw, alongX ? Math.sign(tx) : Math.sign(tz));
  }, sign);
  await page.mouse.move(640, 360);
  await page.mouse.down({ button: 'right' });   // aim pose: crosshair + shoulder cam
  await sim(2.2);
  await shot('02-downtown-neon.jpg');
  await page.mouse.up({ button: 'right' });
  log('shot 2: downtown at', await ev(() => [Math.round(VB.S.player.x), Math.round(VB.S.player.z)]));

  // ================= SCREENSHOT 3 — mission: steal the Vulcan =================
  await ev(() => {
    VB.clearDialogs();
    VB.S.heat = 0;
    VB.startMission(1);
    VB.teleport(122, -46);
    const dir = Math.atan2(114.6 - 122, -60 + 46);
    VB.S.player.yaw = dir;
    VB.setCam(dir + 0.5, 0.15);
    VB.spawnPed(108, -52);
    VB.spawnPed(124, -66);
  });
  await sim(3.6);
  await shot('03-mission-steal.jpg');
  log('shot 3: mission marker active =', await ev(() => VB.S.markers.length));

  // ================= SCREENSHOT 4 — beachfront sunset =================
  await ev(() => {
    VB.clearDialogs();
    VB.S.heat = 0;
    VB.S.mission.index = -1;
    VB.S.storyDone = true;
    VB.S.freeRoam = true;
    VB.teleport(150, 328);
    VB.S.player.yaw = -0.348;
    VB.setCam(-0.348, 0.06);
    VB.spawnPed(139, 321, false);
    VB.spawnPed(162, 322, false);
  });
  await sim(1.2);
  await shot('04-beach-sunset.jpg');
  log('shot 4: beachfront');

  // ---- final assertions ----
  await sim(0.5);
  log('console errors:', consoleErrors.length, consoleErrors.slice(0, 5));
  log('page errors:', pageErrors.length, pageErrors.slice(0, 5));
  log('external requests:', externalRequests.length, externalRequests.slice(0, 5));
  log('total requests:', allRequests.length);
  if (consoleErrors.length || pageErrors.length || externalRequests.length) {
    throw new Error('clean-run assertion failed');
  }
  log('ALL CHECKS PASSED');
} finally {
  await browser.close();
  server.close();
}
// build marker: capture.mjs