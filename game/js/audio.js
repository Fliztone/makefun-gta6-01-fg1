// VELA BAY — fully procedural WebAudio: engine hum, two-tone siren, gunshots,
// skids, crashes, pickup arpeggios and a warm ambient sunset pad. No audio files.
import { S } from './state.js';
import { clamp } from './utils.js';

let ctx = null, master = null, noiseBuf = null;
let engine = null, siren = null, skid = null, pad = null;

function makeNoise() {
  const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function noiseSource() {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  return src;
}

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch { return; }
  master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
  noiseBuf = makeNoise();

  // Engine: saw + sub-octave through a lowpass, pitch follows road speed.
  const eo = ctx.createOscillator(); eo.type = 'sawtooth'; eo.frequency.value = 55;
  const sub = ctx.createOscillator(); sub.type = 'square'; sub.frequency.value = 27;
  const ef = ctx.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 420;
  const eg = ctx.createGain(); eg.gain.value = 0;
  eo.connect(ef); sub.connect(ef); ef.connect(eg); eg.connect(master);
  eo.start(); sub.start();
  engine = { osc: eo, sub, filter: ef, gain: eg };

  // Siren: triangle wobbled by a square LFO between two tones.
  const so = ctx.createOscillator(); so.type = 'triangle'; so.frequency.value = 720;
  const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 1.3;
  const lfoG = ctx.createGain(); lfoG.gain.value = 115;
  lfo.connect(lfoG); lfoG.connect(so.frequency);
  const sg = ctx.createGain(); sg.gain.value = 0;
  so.connect(sg); sg.connect(master);
  so.start(); lfo.start();
  siren = { gain: sg };

  // Skid: bandpassed noise, gain follows drift.
  const sn = noiseSource();
  const sf = ctx.createBiquadFilter(); sf.type = 'bandpass'; sf.frequency.value = 900; sf.Q.value = 1.2;
  const skg = ctx.createGain(); skg.gain.value = 0;
  sn.connect(sf); sf.connect(skg); skg.connect(master);
  sn.start();
  skid = { gain: skg };

  // Ambient pad: warm A-major chord, slow filter breathing + soft surf noise.
  const pg = ctx.createGain(); pg.gain.value = 0.045;
  const pf = ctx.createBiquadFilter(); pf.type = 'lowpass'; pf.frequency.value = 700;
  pf.connect(pg); pg.connect(master);
  [110, 164.81, 220, 277.18].forEach((f, i) => {
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
    o.detune.value = i * 4 - 6;
    const g = ctx.createGain(); g.gain.value = 0.25;
    o.connect(g); g.connect(pf); o.start();
  });
  const plfo = ctx.createOscillator(); plfo.frequency.value = 0.07;
  const plg = ctx.createGain(); plg.gain.value = 260;
  plfo.connect(plg); plg.connect(pf.frequency); plfo.start();
  const surf = noiseSource();
  const surfF = ctx.createBiquadFilter(); surfF.type = 'lowpass'; surfF.frequency.value = 320;
  const surfG = ctx.createGain(); surfG.gain.value = 0.02;
  surf.connect(surfF); surfF.connect(surfG); surfG.connect(master);
  surf.start();
  pad = { gain: pg };
}

function blip(freq, dur, type = 'sine', vol = 0.2, when = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

function burst(dur, freq, vol, type = 'lowpass') {
  if (!ctx) return;
  const t = ctx.currentTime;
  const src = noiseSource();
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t); src.stop(t + dur + 0.02);
}

export const sfx = {
  shot() { burst(0.14, 1800, 0.5); blip(160, 0.08, 'square', 0.25); },
  dry() { blip(900, 0.04, 'square', 0.1); },
  reload() { blip(500, 0.05, 'square', 0.12); blip(760, 0.06, 'square', 0.12, 0.12); },
  pickup() { blip(660, 0.1, 'sine', 0.22); blip(880, 0.12, 'sine', 0.22, 0.08); blip(1320, 0.18, 'sine', 0.18, 0.16); },
  cash() { blip(988, 0.09, 'triangle', 0.2); blip(1319, 0.16, 'triangle', 0.2, 0.07); },
  crash(v) { burst(0.25, 300, clamp(v, 0.1, 0.6)); blip(70, 0.18, 'sine', 0.3); },
  hurt() { burst(0.12, 500, 0.3); blip(120, 0.15, 'sawtooth', 0.15); },
  jingle() { [523, 659, 784, 1047].forEach((f, i) => blip(f, 0.22, 'triangle', 0.22, i * 0.11)); },
  fail() { blip(330, 0.25, 'sawtooth', 0.18); blip(220, 0.4, 'sawtooth', 0.18, 0.18); },
  click() { blip(1200, 0.03, 'square', 0.08); },
  checkpoint() { blip(1046, 0.1, 'sine', 0.2); blip(1568, 0.14, 'sine', 0.16, 0.06); },
  enter() { blip(300, 0.08, 'square', 0.12); blip(420, 0.08, 'square', 0.12, 0.07); },
};

// Per-frame mix: engine pitch, siren proximity, skid intensity.
export function updateAudio() {
  if (!ctx) return;
  const p = S.player;
  const car = p.inCar;
  const t = ctx.currentTime;
  if (engine) {
    const sp = car ? Math.abs(car.speed) : 0;
    const target = car && S.mode === 'play' ? 0.11 + sp * 0.004 : 0;
    engine.gain.gain.setTargetAtTime(target, t, 0.1);
    engine.osc.frequency.setTargetAtTime(50 + sp * 4.2 + (car && car.throttle > 0 ? 18 : 0), t, 0.08);
    engine.sub.frequency.setTargetAtTime(25 + sp * 2.1, t, 0.08);
    engine.filter.frequency.setTargetAtTime(320 + sp * 26, t, 0.1);
  }
  if (siren) {
    const near = S.nearestCopDist;
    const g = S.mode === 'play' && near < 90 ? clamp(0.16 * (1 - near / 90), 0, 0.16) : 0;
    siren.gain.gain.setTargetAtTime(g, t, 0.25);
  }
  if (skid) {
    const g = car && car.drifting && S.mode === 'play' ? 0.12 : 0;
    skid.gain.gain.setTargetAtTime(g, t, 0.06);
  }
  if (pad) pad.gain.gain.setTargetAtTime(S.mode === 'play' ? 0.05 : 0.03, t, 0.5);
}
// build marker: audio.js