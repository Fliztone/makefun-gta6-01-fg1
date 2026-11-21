// VELA BAY — save/load through localStorage: cash, story progress, position, stats.
import { CFG } from './config.js';
import { S } from './state.js';

export function hasSave() {
  try { return localStorage.getItem(CFG.SAVE_KEY) !== null; } catch { return false; }
}

export function saveGame() {
  const p = S.player;
  const data = {
    v: 1,
    cash: S.cash,
    health: S.health,
    missionIndex: S.mission.stage === -1 ? S.mission.index + 1 : Math.max(0, S.mission.index),
    storyDone: S.storyDone,
    x: p.inCar ? p.inCar.group.position.x : p.x,
    z: p.inCar ? p.inCar.group.position.z : p.z,
    stats: S.stats,
    at: Date.now(),
  };
  try {
    localStorage.setItem(CFG.SAVE_KEY, JSON.stringify(data));
    return true;
  } catch { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(CFG.SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || d.v !== 1) return null;
    return d;
  } catch { return null; }
}

export function clearSave() {
  try { localStorage.removeItem(CFG.SAVE_KEY); } catch { /* private mode */ }
}
// build marker: save.js