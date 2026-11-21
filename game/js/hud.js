// VELA BAY — DOM HUD: wanted stars, cash, health, mission objective, interact
// prompt, dialogs, job banners, speedometer, ammo, crosshair and damage vignette.
import { S, starsOf } from './state.js';
import { fmtCash } from './utils.js';
import { currentObjective } from './missions.js';
import { drawMinimap } from './minimap.js';

const el = {};
const IDS = [
  'hud', 'stars', 'cash', 'healthfill', 'objtitle', 'objtext', 'objective',
  'prompt', 'dialog', 'dialogwho', 'dialogtext', 'speedo', 'speedval', 'carname',
  'ammo', 'crosshair', 'hitmarker', 'vignette', 'banner', 'bannertext', 'bannersub',
  'crimetoast', 'menu', 'pause', 'dead',
];

export function initHud() {
  for (const id of IDS) el[id] = document.getElementById(id);
  el.starSpans = el.stars.querySelectorAll('span');
}

function show(node, on) {
  node.classList.toggle('hidden', !on);
}

export function updateHud(dt) {
  const mode = S.mode;
  show(el.menu, mode === 'menu');
  show(el.pause, mode === 'pause');
  show(el.dead, mode === 'dead');
  show(el.hud, mode !== 'menu');
  if (mode === 'menu') return;

  // Wanted stars.
  const stars = starsOf();
  const cooling = S.heat > 0 && S.nearestCopDist > 55;
  el.starSpans.forEach((sp, i) => {
    sp.classList.toggle('lit', i < stars);
    sp.classList.toggle('cool', cooling && i < stars);
  });
  el.cash.textContent = fmtCash(S.cash);
  el.healthfill.style.width = Math.max(0, S.health) + '%';
  el.healthfill.classList.toggle('low', S.health < 30);

  // Mission objective.
  const obj = currentObjective();
  el.objtitle.textContent = obj.title;
  el.objtext.textContent = obj.text;

  // Interact prompt.
  const p = S.player;
  if (p.inCar) {
    el.prompt.textContent = 'E — exit vehicle';
    show(el.prompt, true);
  } else if (S.interactTarget) {
    const t = S.interactTarget;
    const verb = t.kind === 'traffic' || t.kind === 'police' ? 'carjack' : 'enter';
    el.prompt.textContent = `E — ${verb} ${t.type.name}`;
    show(el.prompt, true);
  } else show(el.prompt, false);

  // Speedometer / ammo.
  if (p.inCar) {
    show(el.speedo, true);
    el.speedval.textContent = Math.round(Math.abs(p.inCar.speed) * 3.6);
    el.carname.textContent = p.inCar.type.name.toUpperCase();
    show(el.ammo, false);
  } else {
    show(el.speedo, false);
    show(el.ammo, true);
    el.ammo.textContent = S.reloading > 0 ? 'RELOADING…' : `${S.ammo} / ∞`;
    el.ammo.classList.toggle('low', S.ammo <= 3);
  }

  // Crosshair + hitmarker + damage vignette.
  show(el.crosshair, S.aiming);
  if (S.hitFlash > 0) S.hitFlash = Math.max(0, S.hitFlash - dt * 4);
  el.hitmarker.style.opacity = S.hitFlash || 0;
  show(el.hitmarker, (S.hitFlash || 0) > 0.02);
  if (S.hurtFlash > 0) S.hurtFlash = Math.max(0, S.hurtFlash - dt * 1.6);
  el.vignette.style.opacity = (S.hurtFlash || 0) * 0.9;

  // Dialog subtitle.
  if (S.dialog) {
    el.dialogwho.textContent = S.dialog.who;
    el.dialogtext.textContent = S.dialog.text;
    show(el.dialog, true);
  } else show(el.dialog, false);

  // Job banner.
  if (S.banner && S.time < S.banner.until) {
    el.bannertext.textContent = S.banner.text;
    el.bannersub.textContent = S.banner.sub;
    show(el.banner, true);
  } else show(el.banner, false);

  // Crime toast under the stars.
  if ((S.crimeFlash || 0) > 0 && S.crimeMsg) {
    el.crimetoast.textContent = S.crimeMsg.toUpperCase();
    el.crimetoast.style.opacity = Math.min(1, S.crimeFlash * 1.5);
  } else el.crimetoast.style.opacity = 0;

  drawMinimap();
}
// build marker: hud.js