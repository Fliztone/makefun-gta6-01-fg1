// VELA BAY — procedural city: street grid, pastel towers with window facades,
// neon signage, instanced palms / streetlights / lane dashes, beach props, marina.
import { CFG, PALETTE, BLOCKS, ROADS, NEON_SIGNS } from './config.js';
import { makeRng, pick, range } from './utils.js';

export const city = {
  colliders: [],       // {x1, z1, x2, z2, h} AABBs for physics and bullets
  buildingMeshes: [],
  parkedSpots: [],     // {x, z, yaw}
  neon: [],            // flickering sign materials
  boats: [],
};

function facadeTexture(rng) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 256, 256);
  const cols = 6, rows = 8;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = rng() < 0.28;
      g.fillStyle = lit ? '#ffd98a' : '#26303e';
      g.fillRect(14 + x * 40, 12 + y * 30, 24, 17);
      if (lit) {
        g.fillStyle = 'rgba(255,240,200,0.55)';
        g.fillRect(14 + x * 40, 12 + y * 30, 24, 6);
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function neonTexture(text, color) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 128);
  const hex = '#' + new THREE.Color(color).getHexString();
  g.strokeStyle = hex;
  g.lineWidth = 5;
  g.shadowColor = hex;
  g.shadowBlur = 22;
  g.strokeRect(10, 10, 492, 108);
  g.font = 'bold 52px Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = hex;
  g.fillText(text, 256, 66);
  g.shadowBlur = 0;
  g.fillStyle = '#fff6ee';
  g.font = 'bold 48px Arial, sans-serif';
  g.fillText(text, 256, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function addBuilding(rng, x, z, w, d, h, color, facades) {
  const tex = pick(rng, facades).clone();
  tex.needsUpdate = true;
  tex.repeat.set(Math.max(1, Math.round(w / 11)), Math.max(1, Math.round(h / 11)));
  const side = new THREE.MeshLambertMaterial({ color, map: tex });
  const roof = new THREE.MeshLambertMaterial({ color: new THREE.Color(color).multiplyScalar(0.55) });
  // Reorder box faces (sides first, then top/bottom) so each tower is 2 draw calls.
  const geo = new THREE.BoxGeometry(w, h, d);
  const idx = geo.index.array;
  const reordered = new Uint16Array(36);
  [0, 1, 4, 5, 2, 3].forEach((f, i) => {
    for (let k = 0; k < 6; k++) reordered[i * 6 + k] = idx[f * 6 + k];
  });
  geo.setIndex(new THREE.BufferAttribute(reordered, 1));
  geo.clearGroups();
  geo.addGroup(0, 24, 0);
  geo.addGroup(24, 12, 1);
  const mesh = new THREE.Mesh(geo, [side, roof]);
  mesh.position.set(x, h / 2 + 0.16, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  city.buildingMeshes.push(mesh);
  city.colliders.push({ x1: x - w / 2 - 0.25, z1: z - d / 2 - 0.25, x2: x + w / 2 + 0.25, z2: z + d / 2 + 0.25, h });
  return mesh;
}

function addNeon(rng, b, text) {
  const color = pick(rng, PALETTE.neon);
  const mat = new THREE.MeshBasicMaterial({ map: neonTexture(text, color), transparent: true, toneMapped: false });
  const w = Math.min(b.w * 0.86, text.length * 1.05 + 3);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.25), mat);
  const y = b.h * range(rng, 0.55, 0.8);
  // Face the street: outward from the block center on the dominant axis.
  if (Math.abs(b.ox) > Math.abs(b.oz)) {
    const s = Math.sign(b.ox) || 1;
    sign.position.set(b.x + s * (b.w / 2 + 0.2), y, b.z);
    sign.rotation.y = s * Math.PI / 2;
  } else {
    const s = Math.sign(b.oz) || 1;
    sign.position.set(b.x, y, b.z + s * (b.d / 2 + 0.2));
    sign.rotation.y = s > 0 ? 0 : Math.PI;
  }
  city.neon.push({ mat, phase: rng() * 10, speed: range(rng, 0.5, 3), base: 1, x: sign.position.x, y, z: sign.position.z, yaw: sign.rotation.y });
  return sign;
}

export function buildCity(scene) {
  const rng = makeRng(20261121);
  const facades = [facadeTexture(rng), facadeTexture(rng), facadeTexture(rng), facadeTexture(rng)];
  const group = new THREE.Group();
  scene.add(group);

  // --- blocks: sidewalk slab + buildings (or plaza) ---
  const sidewalkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  const slabGeo = new THREE.BoxGeometry(CFG.BLOCK, 0.18, CFG.BLOCK);
  const buildings = [];
  for (const bx of BLOCKS) {
    for (const bz of BLOCKS) {
      const slab = new THREE.Mesh(slabGeo, sidewalkMat);
      slab.position.set(bx, 0.09, bz);
      slab.receiveShadow = true;
      group.add(slab);

      const downtown = Math.abs(bx) <= 72 && Math.abs(bz) <= 72;
      const beachRow = bz === 216;
      const plaza = (bx === 0 && bz === 0) || (!downtown && rng() < 0.14);
      if (plaza) {
        if (bx === 0 && bz === 0) {
          // Cruz Plaza fountain: the heart of downtown.
          const rim = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.6, 1, 20), new THREE.MeshLambertMaterial({ color: 0xcfc4b2 }));
          rim.position.set(0, 0.6, 0);
          rim.castShadow = true;
          group.add(rim);
          const pool = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.4, 0.3, 20), new THREE.MeshLambertMaterial({ color: 0x3fa8c9 }));
          pool.position.set(0, 1.05, 0);
          group.add(pool);
          city.colliders.push({ x1: -5.6, z1: -5.6, x2: 5.6, z2: 5.6, h: 1.2 });
        }
        continue;
      }

      const n = downtown ? (rng() < 0.5 ? 1 : 2) : 2 + Math.floor(rng() * 2);
      const placed = [];
      for (let i = 0; i < n; i++) {
        let w = range(rng, 12, downtown ? 20 : 17);
        let d = range(rng, 12, downtown ? 20 : 17);
        let h = downtown ? range(rng, 22, 46) : beachRow ? range(rng, 9, 17) : range(rng, 8, 22);
        if (downtown && rng() < 0.3) { w = 24; d = 24; h = range(rng, 34, 52); }
        let x = 0, z = 0, ok = false;
        for (let t = 0; t < 14 && !ok; t++) {
          x = range(rng, -22 + w / 2, 22 - w / 2);
          z = range(rng, -22 + d / 2, 22 - d / 2);
          ok = placed.every((p) => Math.abs(p.x - x) > (p.w + w) / 2 + 2 || Math.abs(p.z - z) > (p.d + d) / 2 + 2);
        }
        if (!ok) continue;
        placed.push({ x, z, w, d });
        const color = pick(rng, PALETTE.buildings);
        group.add(addBuilding(rng, bx + x, bz + z, w, d, h, color, facades));
        buildings.push({ x: bx + x, z: bz + z, ox: x, oz: z, w, d, h });
      }
    }
  }

  // --- neon signage on street-facing facades ---
  const signTexts = [...NEON_SIGNS];
  for (const b of buildings) {
    if (rng() < 0.3 && signTexts.length) {
      const idx = Math.floor(rng() * signTexts.length);
      const text = signTexts.splice(idx, 1)[0];
      group.add(addNeon(rng, b, text));
      if (!signTexts.length) signTexts.push(...NEON_SIGNS);
    }
  }

  // --- palms: instanced trunks + drooping fronds ---
  const palmSpots = [];
  for (const bx of BLOCKS) for (const bz of BLOCKS) {
    if (rng() < 0.75) {
      const cx = pick(rng, [-1, 1]) * 25, cz = pick(rng, [-1, 1]) * 25;
      palmSpots.push({ x: bx + cx, z: bz + cz });
    }
  }
  for (let i = 0; i < 14; i++) palmSpots.push({ x: range(rng, -240, 240), z: range(rng, 284, 318) });
  for (let x = -230; x <= 230; x += 18) palmSpots.push({ x: x + range(rng, -3, 3), z: range(rng, 320, 324) });
  palmSpots.push({ x: 146, z: 329 }, { x: 158, z: 329.5 });
  for (let x = -220; x <= 220; x += 62) palmSpots.push({ x: x + range(rng, -6, 6), z: 265 });

  const trunkGeo = new THREE.CylinderGeometry(0.13, 0.24, 1, 6);
  trunkGeo.translate(0, 0.5, 0);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6242 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmSpots.length);
  trunks.castShadow = true;

  const frondGeo = new THREE.PlaneGeometry(0.62, 3.0, 1, 4);
  frondGeo.translate(0, 1.5, 0);
  const fp = frondGeo.attributes.position;
  for (let i = 0; i < fp.count; i++) {
    const t = fp.getY(i) / 3;
    fp.setX(i, fp.getX(i) * (1 - t * 0.75));
    fp.setZ(i, -t * t * 1.5);
  }
  frondGeo.computeVertexNormals();
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x4a9a52, side: THREE.DoubleSide });
  const fronds = new THREE.InstancedMesh(frondGeo, frondMat, palmSpots.length * 7);
  fronds.castShadow = true;

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  let fi = 0;
  palmSpots.forEach((p, i) => {
    const h = range(rng, 4.6, 6.8);
    const lean = range(rng, -0.08, 0.08);
    e.set(lean, rng() * Math.PI * 2, lean * 0.7);
    q.setFromEuler(e);
    m.compose(v.set(p.x, 0.15, p.z), q, sc.set(1, h, 1));
    trunks.setMatrixAt(i, m);
    for (let k = 0; k < 7; k++) {
      e.set(-range(rng, 0.5, 0.95), k * (Math.PI * 2 / 7) + rng() * 0.4, 0, 'YXZ');
      q.setFromEuler(e);
      m.compose(v.set(p.x + lean * h, h + 0.1, p.z), q, sc.set(1, range(rng, 0.85, 1.15), 1));
      fronds.setMatrixAt(fi++, m);
    }
  });
  group.add(trunks, fronds);

  // --- streetlights: instanced poles + warm glowing heads ---
  const lampSpots = [];
  for (const bx of BLOCKS) for (const bz of BLOCKS) {
    lampSpots.push({ x: bx - 26.5, z: bz - 26.5 }, { x: bx + 26.5, z: bz + 26.5 });
  }
  const poleGeo = new THREE.CylinderGeometry(0.06, 0.09, 5.4, 5);
  poleGeo.translate(0, 2.7, 0);
  const poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshLambertMaterial({ color: 0x2f3640 }), lampSpots.length);
  const headGeo = new THREE.SphereGeometry(0.17, 8, 6);
  const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false }), lampSpots.length);
  lampSpots.forEach((p, i) => {
    m.compose(v.set(p.x, 0.18, p.z), q.identity(), sc.set(1, 1, 1));
    poles.setMatrixAt(i, m);
    m.compose(v.set(p.x, 5.55, p.z), q, sc);
    heads.setMatrixAt(i, m);
  });
  group.add(poles, heads);

  // --- lane dashes: instanced, skipping intersections ---
  const dashV = [], dashH = [];
  for (const r of ROADS) {
    for (let t = -CFG.EDGE + 6; t < CFG.EDGE - 4; t += 9) {
      if (ROADS.some((r2) => Math.abs(t - r2) < 13)) continue;
      dashV.push({ x: r, z: t });
      dashH.push({ x: t, z: r });
    }
  }
  const dashMat = new THREE.MeshBasicMaterial({ color: PALETTE.lane });
  const dv = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.34, 2.4), dashMat, dashV.length);
  const dh = new THREE.InstancedMesh(new THREE.PlaneGeometry(2.4, 0.34), dashMat, dashH.length);
  e.set(-Math.PI / 2, 0, 0); q.setFromEuler(e);
  dashV.forEach((p, i) => { m.compose(v.set(p.x, 0.03, p.z), q, sc.set(1, 1, 1)); dv.setMatrixAt(i, m); });
  dashH.forEach((p, i) => { m.compose(v.set(p.x, 0.03, p.z), q, sc); dh.setMatrixAt(i, m); });
  group.add(dv, dh);

  // --- curb parking spots for stealable cars ---
  for (let i = 0; i < 40 && city.parkedSpots.length < 16; i++) {
    const vertical = rng() < 0.5;
    const r = pick(rng, ROADS);
    const t = range(rng, -235, 235);
    if (ROADS.some((r2) => Math.abs(t - r2) < 16)) continue;
    const side = pick(rng, [-1, 1]);
    const p = vertical
      ? { x: r + side * CFG.PARK, z: t, yaw: side > 0 ? 0 : Math.PI }
      : { x: t, z: r + side * CFG.PARK, yaw: side > 0 ? Math.PI / 2 : -Math.PI / 2 };
    if (city.parkedSpots.some((o) => (o.x - p.x) ** 2 + (o.z - p.z) ** 2 < 130)) continue;
    city.parkedSpots.push(p);
  }

  // --- marina pier + boats at the beachfront ---
  const pier = new THREE.Mesh(new THREE.BoxGeometry(7, 0.5, 54), new THREE.MeshLambertMaterial({ color: 0x9a7248 }));
  pier.position.set(180, 0.1, 296);
  pier.castShadow = true;
  pier.receiveShadow = true;
  group.add(pier);
  [[128, 352, 0xd94f4f], [172, 348, 0x3f7fd9]].forEach(([x, z, col], i) => {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.8, 7), new THREE.MeshLambertMaterial({ color: 0xf2ede2 }));
    hull.position.y = 0.2;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.25, 7.1), new THREE.MeshLambertMaterial({ color: col }));
    stripe.position.y = 0.45;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 2.2), new THREE.MeshLambertMaterial({ color: 0xe8e2d4 }));
    cab.position.set(0, 0.95, -0.6);
    boat.add(hull, stripe, cab);
    boat.position.set(x, -0.15, z);
    boat.rotation.y = 0.15 * (i ? -1 : 1);
    group.add(boat);
    city.boats.push({ mesh: boat, phase: i * 2.1 });
  });

  // --- beach umbrellas + towels ---
  const umbSpots = [];
  for (let i = 0; i < 11; i++) umbSpots.push({ x: range(rng, -235, 235), z: range(rng, 286, 316) });
  for (let i = 0; i < 5; i++) umbSpots.push({ x: range(rng, -235, 235), z: range(rng, 318, 324) });
  umbSpots.push({ x: 145, z: 329 }, { x: 156, z: 329.5 });
  const umbGeo = new THREE.ConeGeometry(1.7, 0.85, 8);
  const umbMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const umbs = new THREE.InstancedMesh(umbGeo, umbMat, umbSpots.length);
  const upoleGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.9, 5);
  const upoles = new THREE.InstancedMesh(upoleGeo, new THREE.MeshLambertMaterial({ color: 0xd8d2c4 }), umbSpots.length);
  const towelGeo = new THREE.PlaneGeometry(1.1, 2.1);
  const towels = new THREE.InstancedMesh(towelGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), umbSpots.length);
  const umbColors = [0xff5f7a, 0x37c9ff, 0xffc04d, 0x7dff9e, 0xc78aff];
  const col = new THREE.Color();
  umbSpots.forEach((p, i) => {
    m.compose(v.set(p.x, 2.1, p.z), q.identity(), sc.set(1, 1, 1));
    umbs.setMatrixAt(i, m);
    umbs.setColorAt(i, col.setHex(pick(rng, umbColors)));
    m.compose(v.set(p.x, 1.0, p.z), q, sc);
    upoles.setMatrixAt(i, m);
    e.set(-Math.PI / 2, 0, rng() * Math.PI); q.setFromEuler(e);
    m.compose(v.set(p.x + range(rng, 1.5, 2.6), 0.04, p.z + range(rng, -1, 1)), q, sc);
    towels.setMatrixAt(i, m);
    towels.setColorAt(i, col.setHex(pick(rng, umbColors)));
  });
  group.add(umbs, upoles, towels);

  return city;
}

export function updateCity(dt, time) {
  for (const n of city.neon) {
    const flick = Math.sin(time * n.speed + n.phase) > -0.92 ? 1 : 0.35;
    n.mat.opacity = flick;
  }
  for (const b of city.boats) {
    b.mesh.position.y = -0.15 + Math.sin(time * 0.7 + b.phase) * 0.09;
    b.mesh.rotation.z = Math.sin(time * 0.5 + b.phase) * 0.03;
  }
}
// build marker: city.js