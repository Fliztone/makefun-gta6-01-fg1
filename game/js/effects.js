// VELA BAY — GPU point particles (sparks / smoke), fading skid marks, bullet
// tracers and the pistol muzzle flash. Pooled, no per-frame allocation churn.
import { S } from './state.js';

const SPARK_MAX = 420;
const SMOKE_MAX = 160;
const SKID_MAX = 160;
const TRACER_MAX = 14;

let sparkPts = null, smokePts = null;
let sparks = [], smokes = [];
let skids = [], skidIdx = 0;
let tracers = [], tracerIdx = 0;
let muzzleSprite = null, muzzleLight = null;

const PART_VERT = `
attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
varying vec3 vColor; varying float vAlpha;
void main() {
  vColor = aColor; vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (260.0 / max(1.0, -mv.z));
  gl_Position = projectionMatrix * mv;
}`;

const PART_FRAG = `
varying vec3 vColor; varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - vec2(0.5));
  float a = smoothstep(0.5, 0.12, d) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor, a);
}`;

function makeSystem(max, blending) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 3), 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(max * 3), 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(max), 1));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(max), 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader: PART_VERT,
    fragmentShader: PART_FRAG,
    transparent: true,
    depthWrite: false,
    blending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  gr.addColorStop(0, 'rgba(255,240,210,1)');
  gr.addColorStop(0.4, 'rgba(255,190,110,0.6)');
  gr.addColorStop(1, 'rgba(255,150,60,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function initEffects(scene) {
  sparkPts = makeSystem(SPARK_MAX, THREE.AdditiveBlending);
  smokePts = makeSystem(SMOKE_MAX, THREE.NormalBlending);
  scene.add(sparkPts, smokePts);
  sparks = Array.from({ length: SPARK_MAX }, () => ({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 1, g: 1, b: 1, size: 0.3, grav: 9 }));
  smokes = Array.from({ length: SMOKE_MAX }, () => ({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 1.4 }));

  const skidGeo = new THREE.PlaneGeometry(0.3, 0.95);
  const skidMat = new THREE.MeshBasicMaterial({ color: 0x14161a, transparent: true, opacity: 0, depthWrite: false });
  for (let i = 0; i < SKID_MAX; i++) {
    const m = new THREE.Mesh(skidGeo, skidMat.clone());
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.02;
    m.visible = false;
    scene.add(m);
    skids.push({ mesh: m, life: 0 });
  }

  for (let i = 0; i < TRACER_MAX; i++) {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0 }));
    line.frustumCulled = false;
    scene.add(line);
    tracers.push({ line, life: 0 });
  }

  muzzleSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  muzzleSprite.scale.set(1.4, 1.4, 1);
  muzzleSprite.visible = false;
  scene.add(muzzleSprite);
  muzzleLight = new THREE.PointLight(0xffc070, 0, 14);
  scene.add(muzzleLight);
}

let sparkIdx = 0, smokeIdx = 0;

export function sparksAt(x, y, z, n, tint) {
  for (let i = 0; i < n; i++) {
    const p = sparks[sparkIdx];
    sparkIdx = (sparkIdx + 1) % SPARK_MAX;
    p.life = p.max = 0.3 + Math.random() * 0.35;
    p.x = x; p.y = y; p.z = z;
    const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 7;
    p.vx = Math.cos(a) * s; p.vz = Math.sin(a) * s; p.vy = 2 + Math.random() * 5;
    p.size = 0.22 + Math.random() * 0.3;
    if (tint === 'cash') { p.r = 0.4; p.g = 1; p.b = 0.5; }
    else { p.r = 1; p.g = 0.6 + Math.random() * 0.35; p.b = 0.2; }
  }
}

export function smokeAt(x, y, z) {
  const p = smokes[smokeIdx];
  smokeIdx = (smokeIdx + 1) % SMOKE_MAX;
  p.life = p.max = 1.6 + Math.random() * 1.2;
  p.x = x + (Math.random() - 0.5) * 0.8; p.y = y; p.z = z + (Math.random() - 0.5) * 0.8;
  p.vx = (Math.random() - 0.5) * 0.6; p.vz = (Math.random() - 0.5) * 0.6;
  p.vy = 1.2 + Math.random();
  p.size = 1.1 + Math.random() * 1.3;
}

export function skidAt(x, z, yaw) {
  const s = skids[skidIdx];
  skidIdx = (skidIdx + 1) % SKID_MAX;
  s.life = 8;
  s.mesh.visible = true;
  s.mesh.position.set(x, 0.02, z);
  s.mesh.rotation.z = -yaw;
  s.mesh.material.opacity = 0.5;
}

export function tracer(from, to) {
  const t = tracers[tracerIdx];
  tracerIdx = (tracerIdx + 1) % TRACER_MAX;
  t.life = 0.11;
  const pos = t.line.geometry.attributes.position;
  pos.setXYZ(0, from.x, from.y, from.z);
  pos.setXYZ(1, to.x, to.y, to.z);
  pos.needsUpdate = true;
  t.line.material.opacity = 0.9;
}

export function muzzleFlash(x, y, z) {
  muzzleSprite.visible = true;
  muzzleSprite.position.set(x, y, z);
  muzzleSprite.material.rotation = Math.random() * Math.PI;
  muzzleLight.position.set(x, y, z);
  muzzleLight.intensity = 26;
}

export function updateEffects(dt) {
  const sp = sparkPts.geometry.attributes;
  for (let i = 0; i < SPARK_MAX; i++) {
    const p = sparks[i];
    if (p.life > 0) {
      p.life -= dt;
      p.vy -= p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.03) { p.y = 0.03; p.vy *= -0.3; }
      const f = Math.max(0, p.life / p.max);
      sp.position.setXYZ(i, p.x, p.y, p.z);
      sp.aColor.setXYZ(i, p.r * f, p.g * f, p.b * f);
      sp.aSize.setX(i, p.size);
      sp.aAlpha.setX(i, f);
    } else sp.aAlpha.setX(i, 0);
  }
  sp.position.needsUpdate = sp.aColor.needsUpdate = sp.aSize.needsUpdate = sp.aAlpha.needsUpdate = true;

  const sm = smokePts.geometry.attributes;
  for (let i = 0; i < SMOKE_MAX; i++) {
    const p = smokes[i];
    if (p.life > 0) {
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const f = Math.max(0, p.life / p.max);
      sm.position.setXYZ(i, p.x, p.y, p.z);
      sm.aColor.setXYZ(i, 0.22, 0.22, 0.24);
      sm.aSize.setX(i, p.size * (1.6 - f * 0.6));
      sm.aAlpha.setX(i, f * 0.34);
    } else sm.aAlpha.setX(i, 0);
  }
  sm.position.needsUpdate = sm.aColor.needsUpdate = sm.aSize.needsUpdate = sm.aAlpha.needsUpdate = true;

  for (const s of skids) {
    if (s.life > 0) {
      s.life -= dt;
      s.mesh.material.opacity = Math.min(0.5, s.life * 0.12);
      if (s.life <= 0) s.mesh.visible = false;
    }
  }
  for (const t of tracers) {
    if (t.life > 0) {
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.11) * 0.9;
    }
  }
  if (muzzleLight.intensity > 0) {
    muzzleLight.intensity *= Math.exp(-dt * 26);
    if (muzzleLight.intensity < 0.4) { muzzleLight.intensity = 0; muzzleSprite.visible = false; }
  }
}
// build marker: effects.js