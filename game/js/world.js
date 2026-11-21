// VELA BAY — renderer, sunset sky dome, warm lighting with shadows, and the
// animated shader water with sun glitter along the beachfront.
import { CFG, PALETTE } from './config.js';

export let renderer = null;
export let scene = null;
export const sunDir = { x: -0.32, y: 0.26, z: 0.92 };
let sunLight = null, skyMat = null, waterMat = null;
const len = Math.hypot(sunDir.x, sunDir.y, sunDir.z);
sunDir.x /= len; sunDir.y /= len; sunDir.z /= len;

const SKY_VERT = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SKY_FRAG = `
uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uHorizon; uniform vec3 uSunDir; uniform vec3 uSunColor;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -0.05, 1.0);
  vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.28, h));
  col = mix(col, uTop, smoothstep(0.18, 0.75, h));
  float s = max(dot(d, uSunDir), 0.0);
  col += uSunColor * (pow(s, 420.0) * 1.6 + pow(s, 24.0) * 0.4 + pow(s, 5.0) * 0.14);
  col = mix(col, uHorizon * 0.55, smoothstep(0.0, -0.05, d.y));
  gl_FragColor = vec4(col, 1.0);
}`;

const WATER_VERT = `
uniform float uTime;
varying vec3 vWorld;
varying float vWave;
void main() {
  vec3 p = position;
  float w = sin(p.x * 0.09 + uTime * 0.9) * 0.10
          + sin(p.y * 0.07 - uTime * 0.6) * 0.08
          + sin((p.x + p.y) * 0.045 + uTime * 0.4) * 0.06;
  p.z += w;
  vWave = w;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const WATER_FRAG = `
uniform float uTime; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uSky;
uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uFog; uniform float uShoreZ;
varying vec3 vWorld; varying float vWave;
void main() {
  float shore = clamp((vWorld.z - uShoreZ) / 90.0, 0.0, 1.0);
  vec3 col = mix(uShallow, uDeep, shore);
  vec3 n = normalize(vec3(
    -0.09 * cos(vWorld.x * 0.09 + uTime * 0.9) * 0.10 - 0.045 * cos((vWorld.x + vWorld.z) * 0.045 + uTime * 0.4) * 0.06,
    1.0,
    -0.07 * cos(vWorld.z * 0.07 - uTime * 0.6) * 0.08));
  vec3 view = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(dot(view, n), 0.0), 3.0);
  col = mix(col, uSky, fres * 0.7);
  vec3 refl = reflect(-uSunDir, n);
  float spec = pow(max(dot(refl, view), 0.0), 90.0);
  float sunSlope = uSunDir.x / max(0.2, uSunDir.z);
  float sx = cameraPosition.x + (vWorld.z - cameraPosition.z) * sunSlope;
  float streak = exp(-pow((vWorld.x - sx) * 0.010, 2.0));
  float sparkle = pow(max(sin(vWorld.x * 2.3 + uTime * 2.2) * sin(vWorld.z * 2.9 - uTime * 1.8), 0.0), 6.0);
  col += uSunColor * (spec * 1.4 + sparkle * streak * 1.1 + streak * 0.16);
  float foam = smoothstep(3.0, 0.0, abs(vWorld.z - uShoreZ - 1.5 + sin(vWorld.x * 0.4 + uTime) * 1.2));
  col = mix(col, vec3(0.98, 0.95, 0.88), foam * 0.5);
  float dist = length(cameraPosition - vWorld);
  col = mix(col, uFog, 1.0 - exp(-dist * 0.0023));
  gl_FragColor = vec4(col, 1.0);
}`;

export function initWorld(canvas) {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(PALETTE.fog, 0.0017);

  // Sky dome.
  skyMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color(PALETTE.skyTop) },
      uMid: { value: new THREE.Color(PALETTE.skyMid) },
      uHorizon: { value: new THREE.Color(PALETTE.horizon) },
      uSunDir: { value: new THREE.Vector3(sunDir.x, sunDir.y, sunDir.z) },
      uSunColor: { value: new THREE.Color(PALETTE.sun) },
    },
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1500, 24, 16), skyMat));

  // Warm sunset lighting.
  const hemi = new THREE.HemisphereLight(0xffd9b0, 0x5a6a86, 1.3);
  scene.add(hemi);
  sunLight = new THREE.DirectionalLight(0xffb070, 3.2);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  const sc = sunLight.shadow.camera;
  sc.left = -95; sc.right = 95; sc.top = 95; sc.bottom = -95; sc.near = 20; sc.far = 420;
  sunLight.shadow.bias = -0.0006;
  scene.add(sunLight);
  scene.add(sunLight.target);

  // Base sand plane under everything, city asphalt on top.
  const base = new THREE.Mesh(
    new THREE.PlaneGeometry(3200, 3200),
    new THREE.MeshLambertMaterial({ color: 0xd9b077 }),
  );
  base.rotation.x = -Math.PI / 2;
  base.position.y = -0.6;
  base.receiveShadow = true;
  scene.add(base);

  const asphalt = new THREE.Mesh(
    new THREE.PlaneGeometry(CFG.EDGE * 2, CFG.EDGE * 2),
    new THREE.MeshLambertMaterial({ color: PALETTE.asphalt }),
  );
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.receiveShadow = true;
  scene.add(asphalt);

  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(CFG.EDGE * 2 + 80, CFG.BEACH_END - CFG.EDGE),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, 0.02, (CFG.EDGE + CFG.BEACH_END) / 2);
  beach.receiveShadow = true;
  scene.add(beach);

  // Boardwalk strip along the sand.
  const walk = new THREE.Mesh(
    new THREE.BoxGeometry(CFG.EDGE * 2 + 40, 0.14, 9),
    new THREE.MeshLambertMaterial({ color: 0xb08a5e }),
  );
  walk.position.set(0, 0.07, 272);
  walk.receiveShadow = true;
  scene.add(walk);

  // Ocean with sunset glitter.
  waterMat = new THREE.ShaderMaterial({
    vertexShader: WATER_VERT,
    fragmentShader: WATER_FRAG,
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(PALETTE.waterDeep) },
      uShallow: { value: new THREE.Color(PALETTE.waterShallow) },
      uSky: { value: new THREE.Color(PALETTE.horizon) },
      uSunDir: { value: new THREE.Vector3(sunDir.x, sunDir.y, sunDir.z) },
      uSunColor: { value: new THREE.Color(PALETTE.sun) },
      uFog: { value: new THREE.Color(PALETTE.horizon) },
      uShoreZ: { value: CFG.BEACH_END },
    },
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(2600, 1300, 96, 48), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.05, CFG.BEACH_END + 640);
  scene.add(water);
}

export function updateWorld(dt, focusX, focusZ) {
  if (waterMat) waterMat.uniforms.uTime.value += dt;
  if (sunLight) {
    sunLight.position.set(focusX + sunDir.x * 190, sunDir.y * 190 + 30, focusZ + sunDir.z * 190);
    sunLight.target.position.set(focusX, 0, focusZ);
  }
}

export function resizeWorld() {
  if (!renderer) return;
  renderer.setSize(window.innerWidth, window.innerHeight);
}
// build marker: world.js