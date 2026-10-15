// Ant Lion Attack 3D — isometric action game.
// Everything (models, sounds, terrain) is generated in code; the only dependency is three.js (vendored).
import * as THREE from './vendor/three.module.min.js';

// ============================================================
// Helpers
// ============================================================
const $ = (id) => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
function smoothstep(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
function angleLerp(a, b, t) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU;
  return a + d * t;
}
function dist(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }
function weighted(table) {
  let sum = 0; for (const k in table) sum += table[k];
  let r = Math.random() * sum;
  for (const k in table) { r -= table[k]; if (r <= 0) return k; }
  return Object.keys(table)[0];
}

// ============================================================
// Game data
// ============================================================
const WORLD = 60;                 // playable half-size
const STAGES = [
  { name: 'Larv',          score: 0,    scale: 1.00, hp: 100, dmg: 1.0, pit: 3.0, speed: 5.0 },
  { name: 'Ung grävare',   score: 300,  scale: 1.15, hp: 120, dmg: 1.3, pit: 3.6, speed: 5.3 },
  { name: 'Sandjägare',    score: 800,  scale: 1.30, hp: 145, dmg: 1.7, pit: 4.2, speed: 5.6 },
  { name: 'Gropmästare',   score: 1600, scale: 1.45, hp: 170, dmg: 2.2, pit: 4.9, speed: 5.9 },
  { name: 'Rovdjur',       score: 3000, scale: 1.60, hp: 200, dmg: 2.8, pit: 5.6, speed: 6.2 },
  { name: 'Jättemyrlejon', score: 5000, scale: 1.80, hp: 240, dmg: 3.5, pit: 6.5, speed: 6.5 },
];

// resist: how well it climbs out of a pit (compared to pit power = depth*4)
const TYPES = {
  ant:     { name: 'Myra',        hp: 1,  speed: 2.4, radius: 0.35, resist: 0.8, points: 10,  energy: 12, scale: 1.0 },
  soldier: { name: 'Soldatmyra',  hp: 3,  speed: 3.2, radius: 0.5,  resist: 2.0, points: 25,  energy: 15, scale: 1.5, hostile: true, dmg: 6,  range: 1.2, cd: 1.2, sight: 9,  windup: 0.35 },
  beetle:  { name: 'Skalbagge',   hp: 10, speed: 1.7, radius: 0.75, resist: 4.6, points: 45,  energy: 25, scale: 1.2, hostile: true, dmg: 10, range: 1.5, cd: 1.8, sight: 7,  windup: 0.5, armor: 0.5 },
  spider:  { name: 'Vargspindel', hp: 7,  speed: 5.2, radius: 0.65, resist: 5.4, points: 70,  energy: 25, scale: 1.1, hostile: true, dmg: 12, range: 1.3, cd: 1.4, sight: 13, windup: 0.25 },
  wasp:    { name: 'Stekel',      hp: 4,  speed: 6.0, radius: 0.5,  resist: 99,  points: 90,  energy: 20, scale: 1.4, hostile: true, dmg: 15, range: 1.4, cd: 3.0, sight: 14, flying: true },
  mantis:  { name: 'Bönsyrsa',    hp: 45, speed: 2.6, radius: 1.1,  resist: 99,  points: 500, energy: 60, scale: 1.6, hostile: true, dmg: 24, range: 3.0, cd: 2.4, sight: 16, windup: 0.8, boss: true },
};
const DROP_CHANCE = { ant: 0, soldier: 0.08, beetle: 0.25, spider: 0.25, wasp: 0.3, mantis: 1 };

const POWERUPS = {
  honey:  { name: 'Honungsdroppe', emoji: '🍯', color: '#ffb300', desc: '+40 hälsa', w: 3 },
  sugar:  { name: 'Sockerbit',     emoji: '🍬', color: '#ff7ad9', desc: '+50 energi', w: 3 },
  speed:  { name: 'Snabbfot',      emoji: '⚡', color: '#4fc3ff', dur: 12, desc: 'Snabbare i 12 s', w: 2 },
  jaws:   { name: 'Stålkäkar',     emoji: '🦷', color: '#e8e8e8', dur: 15, desc: 'Dubbel skada i 15 s', w: 2 },
  deep:   { name: 'Djupgrop',      emoji: '🕳️', color: '#c08a4a', dur: 20, desc: 'Större grop i 20 s', w: 2 },
  shield: { name: 'Pansar',        emoji: '🛡️', color: '#7cff8a', dur: 15, desc: 'Tål mer i 15 s', w: 2 },
  lure:   { name: 'Feromon',       emoji: '🌸', color: '#ff5fa2', dur: 15, desc: 'Lockar myror i 15 s', w: 2 },
};
const QUAKE_COST = 400;

// ============================================================
// Renderer, scene, camera, lights
// ============================================================
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
const SKY = 0xe6cf9e;
scene.background = new THREE.Color(SKY);

const CAM_DIR = new THREE.Vector3(1, 1.25, 1).normalize();
const CAM_DIST = 80;
scene.fog = new THREE.Fog(SKY, CAM_DIST + 15, CAM_DIST + 70);
const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 1, 300);
let zoom = 1;
const camTarget = new THREE.Vector3();
let shake = 0;

const hemi = new THREE.HemisphereLight(0xfff2d6, 0x7a5a30, 1.2);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d0, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
{
  const c = sun.shadow.camera;
  c.left = -30; c.right = 30; c.top = 30; c.bottom = -30; c.near = 1; c.far = 140;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.04;
}
scene.add(sun, sun.target);
const SUN_OFFSET = new THREE.Vector3(-18, 40, 12);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  const aspect = w / h;
  const viewH = Math.max(18, 13 / aspect) / zoom;
  camera.left = -viewH * aspect / 2; camera.right = viewH * aspect / 2;
  camera.top = viewH / 2; camera.bottom = -viewH / 2;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ============================================================
// Terrain (heightfield with dynamic pits)
// ============================================================
const GRID_SIZE = WORLD * 2 + 50;
const GRID_N = 230;
const CELL = GRID_SIZE / GRID_N;
const HALF = GRID_SIZE / 2;
const VN = GRID_N + 1;

function baseHeight(x, z) {
  let h = 0.35 * Math.sin(x * 0.11) * Math.cos(z * 0.09)
        + 0.25 * Math.sin(x * 0.23 + z * 0.17)
        + 0.10 * Math.sin(x * 0.5 - z * 0.41)
        + 0.05 * Math.sin(x * 1.3 + z * 0.9);
  const e = Math.max(Math.abs(x), Math.abs(z));
  h += smoothstep(WORLD - 6, WORLD + 18, e) * 7 * (0.8 + 0.2 * Math.sin(x * 0.2 + z * 0.3));
  return h;
}
function hash2(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }

const pits = []; // {x, z, r, depth, owned, drawnR, drawnD}

const terrain = (() => {
  const V = VN * VN;
  const base = new Float32Array(V);
  const h = new Float32Array(V);
  const pos = new Float32Array(V * 3);
  const nor = new Float32Array(V * 3);
  const col = new Float32Array(V * 3);
  const baseCol = new Float32Array(V * 3);
  const cA = new THREE.Color(0xc9a062), cB = new THREE.Color(0xe8cc92), cDark = new THREE.Color(0xa87d45), tmp = new THREE.Color();
  for (let iz = 0; iz < VN; iz++) {
    for (let ix = 0; ix < VN; ix++) {
      const i = iz * VN + ix;
      const x = -HALF + ix * CELL, z = -HALF + iz * CELL;
      const bh = baseHeight(x, z);
      base[i] = h[i] = bh;
      pos[i * 3] = x; pos[i * 3 + 1] = bh; pos[i * 3 + 2] = z;
      const n = 0.5 + 0.5 * Math.sin(x * 0.07 + Math.sin(z * 0.05) * 2) * Math.cos(z * 0.06);
      tmp.copy(cA).lerp(cB, n * 0.8 + hash2(ix, iz) * 0.2);
      if (hash2(ix * 3.1, iz * 1.7) > 0.93) tmp.lerp(cDark, 0.35);
      baseCol[i * 3] = col[i * 3] = tmp.r;
      baseCol[i * 3 + 1] = col[i * 3 + 1] = tmp.g;
      baseCol[i * 3 + 2] = col[i * 3 + 2] = tmp.b;
    }
  }
  const idx = new Uint32Array(GRID_N * GRID_N * 6);
  let k = 0;
  for (let iz = 0; iz < GRID_N; iz++) {
    for (let ix = 0; ix < GRID_N; ix++) {
      const a = iz * VN + ix, b = (iz + 1) * VN + ix, c = iz * VN + ix + 1, d = (iz + 1) * VN + ix + 1;
      idx[k++] = a; idx[k++] = b; idx[k++] = c;
      idx[k++] = b; idx[k++] = d; idx[k++] = c;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);

  function normalsRange(x0, z0, x1, z1) {
    for (let iz = z0; iz <= z1; iz++) {
      for (let ix = x0; ix <= x1; ix++) {
        const i = iz * VN + ix;
        const hl = h[iz * VN + Math.max(0, ix - 1)], hr = h[iz * VN + Math.min(GRID_N, ix + 1)];
        const hu = h[Math.max(0, iz - 1) * VN + ix], hd = h[Math.min(GRID_N, iz + 1) * VN + ix];
        let nx = hl - hr, ny = 2 * CELL, nz = hu - hd;
        const l = Math.hypot(nx, ny, nz);
        nor[i * 3] = nx / l; nor[i * 3 + 1] = ny / l; nor[i * 3 + 2] = nz / l;
      }
    }
  }
  normalsRange(0, 0, GRID_N, GRID_N);

  function pitDelta(p, d) {
    const u = d / p.r;
    if (u >= 1.35) return 0;
    let v = 0;
    if (u < 1) v -= p.depth * Math.pow(1 - u, 1.25);
    if (u > 0.8) v += p.depth * 0.16 * Math.sin(Math.PI * (u - 0.8) / 0.55);
    return v;
  }

  function recompute(wx0, wz0, wx1, wz1) {
    const x0 = clamp(Math.floor((wx0 + HALF) / CELL), 0, GRID_N), x1 = clamp(Math.ceil((wx1 + HALF) / CELL), 0, GRID_N);
    const z0 = clamp(Math.floor((wz0 + HALF) / CELL), 0, GRID_N), z1 = clamp(Math.ceil((wz1 + HALF) / CELL), 0, GRID_N);
    for (let iz = z0; iz <= z1; iz++) {
      for (let ix = x0; ix <= x1; ix++) {
        const i = iz * VN + ix;
        const x = -HALF + ix * CELL, z = -HALF + iz * CELL;
        let dh = 0;
        for (const p of pits) dh += pitDelta(p, Math.hypot(x - p.x, z - p.z));
        h[i] = base[i] + dh;
        pos[i * 3 + 1] = h[i];
        const darken = clamp(-dh / 1.1, 0, 0.5), lighten = clamp(dh * 0.8, 0, 0.12);
        col[i * 3] = baseCol[i * 3] * (1 - darken) + lighten;
        col[i * 3 + 1] = baseCol[i * 3 + 1] * (1 - darken * 1.1) + lighten;
        col[i * 3 + 2] = baseCol[i * 3 + 2] * (1 - darken * 1.25) + lighten * 0.8;
      }
    }
    normalsRange(Math.max(0, x0 - 1), Math.max(0, z0 - 1), Math.min(GRID_N, x1 + 1), Math.min(GRID_N, z1 + 1));
    geo.attributes.position.needsUpdate = true;
    geo.attributes.normal.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  }

  function heightAt(x, z) {
    const fx = clamp((x + HALF) / CELL, 0, GRID_N - 0.001), fz = clamp((z + HALF) / CELL, 0, GRID_N - 0.001);
    const ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz;
    const a = h[iz * VN + ix], b = h[iz * VN + ix + 1], c = h[(iz + 1) * VN + ix], d = h[(iz + 1) * VN + ix + 1];
    return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
  }

  return { mesh, heightAt, recompute };
})();
const heightAt = terrain.heightAt;

function updatePits(dt) {
  const p = player;
  for (let i = pits.length - 1; i >= 0; i--) {
    const pit = pits[i];
    if (pit.owned && p.burrowed) {
      const deep = p.buffs.deep > 0;
      const targetR = STAGES[p.stage].pit * (deep ? 1.4 : 1);
      pit.r = Math.min(targetR, pit.r + (deep ? 2.0 : 1.0) * dt);
      pit.depth = lerp(pit.depth, pit.r * 0.34, Math.min(1, dt * 2));
    } else {
      pit.owned = false;
      pit.depth -= 0.12 * dt;
    }
    const dead = pit.depth <= 0.03;
    if (dead || Math.abs(pit.r - pit.drawnR) > 0.02 || Math.abs(pit.depth - pit.drawnD) > 0.015) {
      const R = Math.max(pit.r, pit.drawnR) * 1.4 + CELL * 2;
      if (dead) pits.splice(i, 1);
      pit.drawnR = pit.r; pit.drawnD = pit.depth;
      terrain.recompute(pit.x - R, pit.z - R, pit.x + R, pit.z + R);
    }
  }
}

// ============================================================
// Shared geometry & model helpers
// ============================================================
const UP = new THREE.Vector3(0, 1, 0);
const G = {
  sphere: new THREE.SphereGeometry(1, 16, 12),
  sphereLo: new THREE.SphereGeometry(1, 9, 6),
  cyl: (() => { const g = new THREE.CylinderGeometry(1, 0.75, 1, 6); g.translate(0, 0.5, 0); return g; })(),
  cone: (() => { const g = new THREE.ConeGeometry(1, 1, 8); g.translate(0, 0.5, 0); return g; })(),
  half: new THREE.SphereGeometry(1, 18, 10, 0, TAU, 0, Math.PI / 2),
  rock: new THREE.DodecahedronGeometry(1, 0),
};
function mat(color, rough = 0.7, metal = 0) { return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }); }
function ell(rx, ry, rz, m, geo = G.sphere, shadow = true) {
  const mesh = new THREE.Mesh(geo, m);
  mesh.scale.set(rx, ry, rz);
  mesh.castShadow = shadow;
  return mesh;
}
const _v = new THREE.Vector3();
function seg(a, b, r, m, shadow = false) {
  const mesh = new THREE.Mesh(G.cyl, m);
  _v.subVectors(b, a);
  const len = _v.length();
  mesh.position.copy(a);
  mesh.scale.set(r, len, r);
  mesh.quaternion.setFromUnitVectors(UP, _v.normalize());
  mesh.castShadow = shadow;
  return mesh;
}
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
function at(mesh, x, y, z) { mesh.position.set(x, y, z); return mesh; }

// Leg: hip group (swings around Y), femur up-out to the knee, tibia down to the ground.
function addLeg(model, parent, m, side, hip, len, hipY, thick, yaw, phase, kneeUp = 0.3) {
  const g = new THREE.Group();
  g.position.copy(hip);
  const knee = V3(side * len * 0.45, len * kneeUp, 0);
  const foot = V3(side * len, -hipY, 0);
  g.add(seg(V3(0, 0, 0), knee, thick, m));
  g.add(seg(knee, foot, thick * 0.8, m));
  g.rotation.y = -side * yaw;
  parent.add(g);
  model.legs.push({ g, side, yaw: -side * yaw, phase });
}
function addLegSet(model, parent, m, opt) {
  // opt: zs[], yaws[], hipX, hipY, len, thick, kneeUp
  for (let i = 0; i < opt.zs.length; i++) {
    for (const side of [1, -1]) {
      const phase = ((i % 2 === 0) === (side === 1)) ? 0 : Math.PI;
      addLeg(model, parent, m, side, V3(side * opt.hipX, 0, opt.zs[i]), opt.len, opt.hipY, opt.thick, opt.yaws[i], phase, opt.kneeUp);
    }
  }
}
function animateLegs(model, phase, amp, lift, flail = 0) {
  for (const L of model.legs) {
    const s = Math.sin(phase + L.phase);
    L.g.rotation.y = L.yaw + s * amp + (flail ? Math.sin(phase * 3 + L.phase * 2 + L.side) * flail : 0);
    L.g.rotation.z = L.side * (Math.max(0, Math.cos(phase + L.phase)) * lift + (flail ? Math.abs(Math.sin(phase * 2.3 + L.phase)) * flail : 0));
  }
}
function newModel() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  return { root, body, legs: [], mats: [], parts: {} };
}
function track(model, ...ms) { model.mats.push(...ms); return ms[0]; }

// ---------------- Antlion (player) ----------------
function buildAntlion() {
  const M = newModel();
  const shell = track(M, mat(0x80664a, 0.85));
  const dark = track(M, mat(0x4a3826, 0.8));
  const head = track(M, mat(0x5e4a35, 0.6));
  const jaw = track(M, mat(0x3a2414, 0.35, 0.1));
  const tip = mat(0x8a2a10, 0.3);
  const B = M.body;
  B.position.y = 0.32;
  const abd = ell(0.52, 0.36, 0.64, shell); abd.position.set(0, 0.04, -0.38); B.add(abd);
  for (let i = 0; i < 4; i++) {
    const ring = ell(0.5 - i * 0.07, 0.06, 0.08, dark); ring.position.set(0, 0.22 - i * 0.02, -0.12 - i * 0.2); ring.rotation.x = 0.25; B.add(ring);
  }
  for (let i = 0; i < 6; i++) {
    const spot = ell(0.07, 0.03, 0.09, dark, G.sphereLo, false);
    spot.position.set((i % 2 ? 1 : -1) * 0.22, 0.33 - (i >> 1) * 0.03, -0.25 - (i >> 1) * 0.2); B.add(spot);
  }
  for (let i = 0; i < 10; i++) {
    const side = i % 2 ? 1 : -1;
    const b = new THREE.Mesh(G.cone, dark);
    b.scale.set(0.025, 0.18, 0.025);
    b.position.set(side * 0.46, 0.05, -0.15 - (i >> 1) * 0.14);
    b.rotation.z = -side * 1.1; B.add(b);
  }
  const thx = ell(0.3, 0.22, 0.26, shell); thx.position.set(0, 0.04, 0.2); B.add(thx);
  const hd = ell(0.27, 0.13, 0.23, head); hd.position.set(0, 0.06, 0.48); B.add(hd);
  const eyeM = mat(0x111111, 0.2);
  for (const s of [1, -1]) { const e = ell(0.045, 0.045, 0.045, eyeM, G.sphereLo, false); e.position.set(s * 0.2, 0.13, 0.55); B.add(e); }
  const jaws = [];
  for (const side of [1, -1]) {
    const piv = new THREE.Group();
    piv.position.set(side * 0.13, 0.06, 0.62);
    const p0 = V3(0, 0, 0), p1 = V3(side * 0.07, 0.03, 0.26), p2 = V3(side * 0.02, 0.04, 0.48), p3 = V3(-side * 0.1, 0.04, 0.58);
    piv.add(seg(p0, p1, 0.045, jaw, true), seg(p1, p2, 0.035, jaw, true), seg(p2, p3, 0.022, tip, true));
    for (let t = 0; t < 3; t++) {
      const tooth = new THREE.Mesh(G.cone, jaw);
      tooth.scale.set(0.015, 0.07, 0.015);
      tooth.position.set(side * 0.03 - side * t * 0.012, 0.03, 0.18 + t * 0.1);
      tooth.rotation.z = side * 1.5; piv.add(tooth);
    }
    B.add(piv);
    jaws.push({ piv, side });
  }
  M.parts.jaws = jaws;
  addLegSet(M, B, dark, { zs: [0.3, 0.2, 0.08], yaws: [0.7, 0.1, -0.6], hipX: 0.2, hipY: 0.3, len: 0.5, thick: 0.035, kneeUp: 0.35 });
  return M;
}

// ---------------- Ant / soldier ----------------
function buildAnt(color, soldier = false) {
  const M = newModel();
  const m = track(M, mat(color, 0.45, 0.05));
  const legM = track(M, mat(new THREE.Color(color).multiplyScalar(0.7), 0.6));
  const B = M.body;
  B.position.y = 0.22;
  const gaster = ell(0.17, 0.14, 0.24, m); gaster.position.set(0, 0.04, -0.3); gaster.rotation.x = -0.2; B.add(gaster);
  B.add(at(ell(0.05, 0.05, 0.06, m, G.sphereLo, false), 0, 0.02, -0.1));
  const thx = ell(0.085, 0.08, 0.17, m); thx.position.set(0, 0.03, 0.03); B.add(thx);
  const hs = soldier ? 1.35 : 1;
  const hd = ell(0.12 * hs, 0.1 * hs, 0.12 * hs, m); hd.position.set(0, 0.06, 0.24 + (hs - 1) * 0.08); B.add(hd);
  for (const s of [1, -1]) {
    const a = V3(s * 0.05, 0.12, 0.3), b = V3(s * 0.13, 0.26, 0.42), c = V3(s * 0.18, 0.2, 0.58);
    B.add(seg(a, b, 0.012, legM), seg(b, c, 0.01, legM));
    if (soldier) {
      const piv = new THREE.Group(); piv.position.set(s * 0.06, 0.03, 0.38);
      piv.add(seg(V3(0, 0, 0), V3(s * 0.02, 0, 0.12), 0.025, legM), seg(V3(s * 0.02, 0, 0.12), V3(-s * 0.06, 0, 0.18), 0.018, legM));
      B.add(piv);
    }
  }
  addLegSet(M, B, legM, { zs: [0.1, 0.03, -0.05], yaws: [0.7, 0.1, -0.65], hipX: 0.05, hipY: 0.22, len: 0.34, thick: 0.016 });
  return M;
}

// ---------------- Beetle ----------------
function buildBeetle() {
  const M = newModel();
  const shell = track(M, mat(0x1f5a44, 0.28, 0.55));
  const dark = track(M, mat(0x14231c, 0.5, 0.2));
  const B = M.body;
  B.position.y = 0.3;
  const sh = ell(0.55, 0.45, 0.7, shell, G.half); sh.position.set(0, 0, -0.1); B.add(sh);
  const under = ell(0.5, 0.12, 0.65, dark); under.position.set(0, 0.02, -0.1); B.add(under);
  const line = ell(0.015, 0.44, 0.68, dark, G.half, false); line.position.set(0, 0.005, -0.1); B.add(line);
  const pro = ell(0.38, 0.22, 0.24, shell); pro.position.set(0, 0.08, 0.5); B.add(pro);
  const hd = ell(0.22, 0.14, 0.17, dark); hd.position.set(0, 0.06, 0.72); B.add(hd);
  const horn = new THREE.Mesh(G.cone, dark); horn.scale.set(0.05, 0.35, 0.05); horn.position.set(0, 0.12, 0.8); horn.rotation.x = 0.9; horn.castShadow = true; B.add(horn);
  addLegSet(M, B, dark, { zs: [0.45, 0.2, -0.1], yaws: [0.6, 0.0, -0.6], hipX: 0.25, hipY: 0.3, len: 0.6, thick: 0.045, kneeUp: 0.35 });
  return M;
}

// ---------------- Spider ----------------
function buildSpider() {
  const M = newModel();
  const fur = track(M, mat(0x5a4128, 1.0));
  const dark = track(M, mat(0x2e2014, 1.0));
  const eye = mat(0x050505, 0.1, 0.3);
  const B = M.body;
  B.position.y = 0.45;
  const abd = ell(0.38, 0.32, 0.46, fur); abd.position.set(0, 0.08, -0.48); B.add(abd);
  for (let i = 0; i < 3; i++) {
    const c = ell(0.18 - i * 0.04, 0.03, 0.05, dark, G.sphereLo, false);
    c.position.set(0, 0.38 - i * 0.04, -0.36 - i * 0.16); B.add(c);
  }
  const ceph = ell(0.3, 0.2, 0.34, fur); ceph.position.set(0, 0.04, 0.1); B.add(ceph);
  const stripe = ell(0.08, 0.205, 0.3, dark, G.sphereLo, false); stripe.position.set(0, 0.045, 0.1); B.add(stripe);
  const eyes = [[0.07, 0.2, 0.36, 0.05], [-0.07, 0.2, 0.36, 0.05], [0.13, 0.16, 0.38, 0.03], [-0.13, 0.16, 0.38, 0.03], [0.05, 0.12, 0.43, 0.025], [-0.05, 0.12, 0.43, 0.025]];
  for (const [x, y, z, r] of eyes) { const e = ell(r, r, r, eye, G.sphereLo, false); e.position.set(x, y, z); B.add(e); }
  for (const s of [1, -1]) {
    B.add(seg(V3(s * 0.06, 0, 0.4), V3(s * 0.05, -0.15, 0.5), 0.035, dark));
  }
  addLegSet(M, B, fur, { zs: [0.25, 0.15, 0.05, -0.05], yaws: [1.0, 0.35, -0.25, -0.9], hipX: 0.15, hipY: 0.45, len: 1.15, thick: 0.045, kneeUp: 0.45 });
  return M;
}

// ---------------- Wasp ----------------
function buildWasp() {
  const M = newModel();
  const yel = track(M, mat(0xf2c418, 0.4, 0.1));
  const blk = track(M, mat(0x1a1a1a, 0.4, 0.1));
  const wingM = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, roughness: 0.1, side: THREE.DoubleSide, depthWrite: false });
  const B = M.body;
  B.position.y = 0;
  const thx = ell(0.17, 0.16, 0.2, blk); thx.position.set(0, 0, 0.05); B.add(thx);
  const hd = ell(0.14, 0.13, 0.12, yel); hd.position.set(0, 0.02, 0.3); B.add(hd);
  for (const s of [1, -1]) { const e = ell(0.06, 0.08, 0.06, blk, G.sphereLo, false); e.position.set(s * 0.1, 0.04, 0.32); B.add(e); }
  B.add(at(ell(0.05, 0.05, 0.08, blk, G.sphereLo, false), 0, -0.02, -0.15));
  for (let i = 0; i < 5; i++) {
    const r = 0.19 - Math.abs(i - 1.5) * 0.035;
    const s = ell(r, r * 0.95, 0.1, i % 2 ? blk : yel);
    s.position.set(0, -0.04 - i * 0.02, -0.28 - i * 0.12); B.add(s);
  }
  const sting = new THREE.Mesh(G.cone, blk); sting.scale.set(0.03, 0.18, 0.03); sting.position.set(0, -0.14, -0.84); sting.rotation.x = -1.8; B.add(sting);
  const wings = [];
  for (const s of [1, -1]) {
    const piv = new THREE.Group(); piv.position.set(s * 0.08, 0.14, 0.05);
    const w = new THREE.Mesh(G.sphereLo, wingM); w.scale.set(0.42, 0.01, 0.14); w.position.set(s * 0.4, 0, -0.08);
    piv.add(w); B.add(piv); wings.push({ piv, s });
  }
  M.parts.wings = wings;
  for (let i = 0; i < 3; i++) for (const s of [1, -1]) {
    B.add(seg(V3(s * 0.06, -0.1, 0.1 - i * 0.08), V3(s * 0.18, -0.35, 0.05 - i * 0.12), 0.012, blk));
  }
  return M;
}

// ---------------- Mantis (boss) ----------------
function buildMantis() {
  const M = newModel();
  const g = track(M, mat(0x6fae3a, 0.55));
  const gd = track(M, mat(0x4a7d22, 0.6));
  const eyeM = mat(0xd8e86a, 0.2);
  const B = M.body;
  B.position.y = 0.7;
  const abd = ell(0.2, 0.17, 0.65, g); abd.position.set(0, 0.05, -0.65); abd.rotation.x = 0.1; B.add(abd);
  for (let i = 0; i < 4; i++) { const r = ell(0.205, 0.02, 0.04, gd, G.sphereLo, false); r.position.set(0, 0.12, -0.35 - i * 0.18); B.add(r); }
  const thx = ell(0.09, 0.09, 0.5, g); thx.position.set(0, 0.3, 0.15); thx.rotation.x = -0.7; B.add(thx);
  const hd = ell(0.22, 0.14, 0.12, g); hd.position.set(0, 0.68, 0.48); B.add(hd);
  for (const s of [1, -1]) {
    const e = ell(0.09, 0.1, 0.09, eyeM, G.sphereLo, false); e.position.set(s * 0.19, 0.72, 0.5); B.add(e);
    B.add(seg(V3(s * 0.05, 0.78, 0.52), V3(s * 0.25, 1.1, 0.7), 0.01, gd));
  }
  const arms = [];
  for (const s of [1, -1]) {
    const piv = new THREE.Group(); piv.position.set(s * 0.1, 0.5, 0.4);
    const elbow = V3(s * 0.05, -0.1, 0.45), wrist = V3(s * 0.05, 0.25, 0.3);
    piv.add(seg(V3(0, 0, 0), elbow, 0.05, gd, true), seg(elbow, wrist, 0.035, g, true));
    for (let i = 0; i < 3; i++) {
      const sp = new THREE.Mesh(G.cone, gd); sp.scale.set(0.015, 0.08, 0.015);
      sp.position.lerpVectors(elbow, wrist, 0.2 + i * 0.25); sp.rotation.x = -2.2; piv.add(sp);
    }
    B.add(piv); arms.push(piv);
  }
  M.parts.arms = arms;
  addLegSet(M, B, gd, { zs: [0.0, -0.3], yaws: [0.4, -0.7], hipX: 0.08, hipY: 0.7, len: 1.25, thick: 0.03, kneeUp: 0.4 });
  return M;
}

// ---------------- Bird (hazard) ----------------
function buildBird() {
  const M = newModel();
  const f = mat(0x6b5a48, 0.9), fd = mat(0x3e3226, 0.9), beak = mat(0xe0a020, 0.5);
  const B = M.body;
  B.add(ell(0.5, 0.45, 1.1, f));
  B.add(at(ell(0.35, 0.35, 0.38, fd), 0, 0.2, 1.05));
  const bk = new THREE.Mesh(G.cone, beak); bk.scale.set(0.1, 0.4, 0.1); bk.position.set(0, 0.15, 1.35); bk.rotation.x = 1.6; B.add(bk);
  const tail = ell(0.35, 0.05, 0.5, fd); tail.position.set(0, 0.1, -1.2); B.add(tail);
  const wings = [];
  for (const s of [1, -1]) {
    const piv = new THREE.Group(); piv.position.set(s * 0.35, 0.2, 0.1);
    const w = ell(1.7, 0.06, 0.6, f); w.position.set(s * 1.6, 0, 0); piv.add(w);
    const w2 = ell(0.7, 0.05, 0.4, fd); w2.position.set(s * 2.9, 0, -0.15); piv.add(w2);
    B.add(piv); wings.push({ piv, s });
  }
  M.parts.wings = wings;
  M.root.scale.setScalar(1.6);
  return M;
}

// ============================================================
// Decor: rocks, grass, pebbles, twigs, anthills
// ============================================================
const rocks = [];   // {x, z, r}
const anthills = [];
(function buildDecor() {
  const far = (x, z) => Math.hypot(x, z) > 7;
  const rockMats = [mat(0x8d7f6e, 0.95), mat(0x7a6b5a, 0.95), mat(0x9a8a72, 0.95)];
  rockMats.forEach((m) => { m.flatShading = true; });
  for (let i = 0; i < 46; i++) {
    let x, z; do { x = rand(-WORLD + 3, WORLD - 3); z = rand(-WORLD + 3, WORLD - 3); } while (!far(x, z));
    const s = rand(0.6, 2.2);
    const m = new THREE.Mesh(G.rock, rockMats[i % 3]);
    m.scale.set(s * rand(0.9, 1.4), s * rand(0.5, 0.9), s * rand(0.9, 1.3));
    m.rotation.set(rand(0, 1), rand(0, TAU), rand(0, 1));
    m.position.set(x, heightAt(x, z) + s * 0.15, z);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
    rocks.push({ x, z, r: s * 1.05 });
    // small rubble around
    for (let j = 0; j < 3; j++) {
      const r = new THREE.Mesh(G.rock, rockMats[(i + j) % 3]);
      const a = rand(0, TAU), d = s * rand(1.2, 1.8), rs = rand(0.12, 0.3);
      r.scale.setScalar(rs); r.position.set(x + Math.cos(a) * d, heightAt(x + Math.cos(a) * d, z + Math.sin(a) * d) + rs * 0.3, z + Math.sin(a) * d);
      r.rotation.set(rand(0, 3), rand(0, 3), 0); r.castShadow = true; scene.add(r);
    }
  }
  // Grass tufts (instanced blades)
  const bladeGeo = new THREE.ConeGeometry(0.05, 0.8, 3); bladeGeo.translate(0, 0.4, 0);
  const grassMat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
  const BLADES = 2600;
  const grass = new THREE.InstancedMesh(bladeGeo, grassMat, BLADES);
  const dummy = new THREE.Object3D(), c = new THREE.Color();
  let n = 0;
  while (n < BLADES) {
    const cx = rand(-WORLD, WORLD), cz = rand(-WORLD, WORLD);
    if (!far(cx, cz)) continue;
    const count = Math.floor(rand(6, 16));
    const hue = rand(0.17, 0.27);
    for (let k = 0; k < count && n < BLADES; k++, n++) {
      const x = cx + rand(-0.4, 0.4), z = cz + rand(-0.4, 0.4);
      dummy.position.set(x, heightAt(x, z) - 0.05, z);
      dummy.rotation.set(rand(-0.5, 0.5), rand(0, TAU), rand(-0.5, 0.5));
      const s = rand(0.6, 1.5); dummy.scale.set(s, s * rand(0.8, 1.4), s);
      dummy.updateMatrix(); grass.setMatrixAt(n, dummy.matrix);
      grass.setColorAt(n, c.setHSL(hue + rand(-0.03, 0.03), rand(0.35, 0.55), rand(0.28, 0.45)));
    }
  }
  grass.castShadow = true; scene.add(grass);
  // Pebbles
  const PEB = 900;
  const peb = new THREE.InstancedMesh(G.rock, new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), PEB);
  for (let i = 0; i < PEB; i++) {
    const x = rand(-WORLD - 10, WORLD + 10), z = rand(-WORLD - 10, WORLD + 10);
    const s = rand(0.05, 0.16);
    dummy.position.set(x, heightAt(x, z), z); dummy.rotation.set(rand(0, 3), rand(0, 3), 0); dummy.scale.set(s, s * 0.6, s);
    dummy.updateMatrix(); peb.setMatrixAt(i, dummy.matrix);
    peb.setColorAt(i, c.setHSL(rand(0.06, 0.1), rand(0.1, 0.3), rand(0.35, 0.6)));
  }
  peb.receiveShadow = true; scene.add(peb);
  // Twigs & leaves
  const twigM = mat(0x5a3d22, 0.9);
  for (let i = 0; i < 50; i++) {
    const x = rand(-WORLD, WORLD), z = rand(-WORLD, WORLD);
    if (!far(x, z)) continue;
    const l = rand(1, 3), a = rand(0, TAU), y = heightAt(x, z) + 0.05;
    const t = seg(V3(x, y, z), V3(x + Math.cos(a) * l, heightAt(x + Math.cos(a) * l, z + Math.sin(a) * l) + 0.05, z + Math.sin(a) * l), rand(0.04, 0.08), twigM, true);
    scene.add(t);
  }
  const leafMats = [mat(0x8a6a2a, 0.9), mat(0x6a7a2a, 0.9), mat(0xa0562a, 0.9)];
  leafMats.forEach((m) => { m.side = THREE.DoubleSide; });
  for (let i = 0; i < 70; i++) {
    const x = rand(-WORLD, WORLD), z = rand(-WORLD, WORLD);
    const leaf = new THREE.Mesh(G.sphereLo, leafMats[i % 3]);
    leaf.scale.set(rand(0.25, 0.45), 0.02, rand(0.5, 0.8));
    leaf.position.set(x, heightAt(x, z) + 0.04, z); leaf.rotation.set(rand(-0.15, 0.15), rand(0, TAU), rand(-0.15, 0.15));
    leaf.receiveShadow = true; scene.add(leaf);
  }
  // Anthills
  const moundM = mat(0x9c7444, 1), holeM = new THREE.MeshBasicMaterial({ color: 0x1a0f06 });
  const spots = [[-28, -22], [30, -30], [34, 26], [-30, 32], [0, 44], [-46, 0], [46, 2]];
  for (const [x, z] of spots) {
    const g = new THREE.Group();
    const mound = new THREE.Mesh(G.cone, moundM); mound.scale.set(2.2, 1.2, 2.2); mound.castShadow = mound.receiveShadow = true;
    const top = new THREE.Mesh(G.sphereLo, moundM); top.scale.set(0.8, 0.35, 0.8); top.position.y = 0.95;
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.3, 12), holeM); hole.rotation.x = -Math.PI / 2; hole.position.y = 1.31;
    g.add(mound, top, hole);
    for (let i = 0; i < 14; i++) {
      const a = rand(0, TAU), d = rand(1.8, 3), s = rand(0.06, 0.12);
      const crumb = new THREE.Mesh(G.rock, moundM); crumb.scale.setScalar(s); crumb.position.set(Math.cos(a) * d, 0.02, Math.sin(a) * d); g.add(crumb);
    }
    g.position.set(x, heightAt(x, z) - 0.2, z);
    scene.add(g);
    anthills.push({ x, z });
    rocks.push({ x, z, r: 1.8, soft: true });
  }
})();

function collideRocks(o, radius) {
  for (const r of rocks) {
    const dx = o.x - r.x, dz = o.z - r.z, d = Math.hypot(dx, dz), min = r.r + radius;
    if (d < min && d > 0.0001) { o.x = r.x + dx / d * min; o.z = r.z + dz / d * min; }
  }
  o.x = clamp(o.x, -WORLD + 1, WORLD - 1);
  o.z = clamp(o.z, -WORLD + 1, WORLD - 1);
}

// ============================================================
// Particles (instanced)
// ============================================================
const particles = (() => {
  const MAX = 400;
  const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ roughness: 0.9 }), MAX);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  const list = [];
  const dummy = new THREE.Object3D(), col = new THREE.Color();
  for (let i = 0; i < MAX; i++) { dummy.scale.setScalar(0); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); mesh.setColorAt(i, col.set(0xffffff)); }
  scene.add(mesh);
  let cursor = 0;
  function emit(x, y, z, n, color, opts = {}) {
    const spd = opts.speed ?? 3, up = opts.up ?? 3, size = opts.size ?? 0.08, life = opts.life ?? 0.8, grav = opts.grav ?? 9;
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(0.3, 1) * spd;
      const p = { i: cursor, x, y, z, vx: Math.cos(a) * s, vy: rand(0.4, 1) * up, vz: Math.sin(a) * s, life: life * rand(0.6, 1.2), max: 0, size: size * rand(0.6, 1.4), grav };
      p.max = p.life;
      mesh.setColorAt(cursor, col.set(color).offsetHSL(0, 0, rand(-0.06, 0.06)));
      list.push(p);
      cursor = (cursor + 1) % MAX;
    }
    if (list.length > MAX) list.splice(0, list.length - MAX);
    mesh.instanceColor.needsUpdate = true;
  }
  function update(dt) {
    for (let k = list.length - 1; k >= 0; k--) {
      const p = list[k];
      p.life -= dt;
      p.vy -= p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const g = heightAt(p.x, p.z);
      if (p.y < g) { p.y = g; p.vx *= 0.5; p.vz *= 0.5; p.vy = 0; }
      const s = p.life > 0 ? p.size * Math.min(1, p.life / p.max * 2) : 0;
      dummy.position.set(p.x, p.y, p.z); dummy.scale.setScalar(s); dummy.rotation.set(p.x, p.z, 0); dummy.updateMatrix();
      mesh.setMatrixAt(p.i, dummy.matrix);
      if (p.life <= 0) list.splice(k, 1);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
  return { emit, update };
})();
const SAND = 0xd9b77a, GOO = 0xb8d040, SPARK = 0xfff2a0;

// ============================================================
// Decals (shadows, telegraphs, rings)
// ============================================================
function decal(geo, color, opacity) {
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 2;
  return m;
}
const CIRCLE = new THREE.CircleGeometry(1, 28);
// Selection ring under the targeted enemy & click marker
const targetRing = decal(new THREE.RingGeometry(0.85, 1, 32), 0xff4a2a, 0.8);
targetRing.visible = false; scene.add(targetRing);
const clickMark = decal(new THREE.RingGeometry(0.2, 0.3, 24), 0xffe08a, 0.9);
clickMark.visible = false; scene.add(clickMark);
let clickMarkT = 0;

// ============================================================
// Audio (synthesised)
// ============================================================
let actx = null, muted = false, noiseBuf = null;
try { muted = localStorage.getItem('antlion3d.muted') === '1'; } catch (e) { /* ignore */ }
function ac() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
function tone(freq, dur, type = 'sine', vol = 0.12, delay = 0, slide = null) {
  const a = ac(); if (!a || muted) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol = 0.1, freq = 1200, delay = 0, q = 0.8) {
  const a = ac(); if (!a || muted) return;
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = a.currentTime + delay;
  const s = a.createBufferSource(); s.buffer = noiseBuf;
  const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = a.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(a.destination); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}
const SFX = {
  bite: () => { noise(0.08, 0.25, 2500, 0, 2); tone(180, 0.08, 'square', 0.06); },
  whiff: () => noise(0.12, 0.08, 900, 0, 0.6),
  hit: () => { noise(0.1, 0.2, 1600); tone(140, 0.1, 'sawtooth', 0.06, 0, 70); },
  catch: () => { tone(520, 0.08, 'triangle', 0.12); tone(780, 0.1, 'triangle', 0.12, 0.07); noise(0.1, 0.15, 2200, 0, 2); },
  kill: () => { tone(400, 0.1, 'square', 0.07); tone(600, 0.15, 'square', 0.07, 0.08); },
  hurt: () => { tone(220, 0.25, 'sawtooth', 0.12, 0, 90); noise(0.15, 0.15, 500); },
  dig: () => { noise(0.45, 0.18, 500, 0, 0.5); noise(0.3, 0.1, 900, 0.15); },
  emerge: () => { noise(0.25, 0.2, 700, 0, 0.5); tone(160, 0.15, 'triangle', 0.08, 0, 320); },
  power: () => [0, 4, 7, 12].forEach((s, i) => tone(440 * Math.pow(2, s / 12), 0.15, 'triangle', 0.1, i * 0.07)),
  level: () => [0, 4, 7, 12, 16].forEach((s, i) => tone(330 * Math.pow(2, s / 12), 0.2, 'square', 0.06, i * 0.09)),
  grow: () => [0, 7, 12, 19].forEach((s, i) => tone(262 * Math.pow(2, s / 12), 0.3, 'triangle', 0.1, i * 0.12)),
  bird: () => { tone(1800, 0.35, 'sawtooth', 0.06, 0, 900); tone(1600, 0.4, 'sawtooth', 0.05, 0.3, 700); },
  quake: () => { noise(1.2, 0.35, 120, 0, 0.4); tone(55, 1.0, 'sawtooth', 0.15, 0, 30); },
  buzz: () => tone(210, 0.5, 'sawtooth', 0.05, 0, 330),
  boss: () => { tone(110, 0.6, 'sawtooth', 0.1, 0, 80); tone(82, 0.8, 'sawtooth', 0.1, 0.4, 60); },
  over: () => [0, -3, -7, -12].forEach((s, i) => tone(330 * Math.pow(2, s / 12), 0.35, 'triangle', 0.12, i * 0.25)),
};

// ============================================================
// UI helpers: floating text, enemy bars, messages
// ============================================================
const floatersEl = $('floaters');
const floaters = [];
const _p = new THREE.Vector3();
function toScreen(x, y, z) {
  _p.set(x, y, z).project(camera);
  return { x: (_p.x * 0.5 + 0.5) * window.innerWidth, y: (-_p.y * 0.5 + 0.5) * window.innerHeight };
}
function floatText(text, x, y, z, color = '#fff', size = 18) {
  const el = document.createElement('div');
  el.className = 'ft'; el.textContent = text; el.style.color = color; el.style.fontSize = size + 'px';
  floatersEl.appendChild(el);
  floaters.push({ el, x, y, z, t: 0, life: 1.1 });
  if (floaters.length > 40) { floaters[0].el.remove(); floaters.shift(); }
}
function updateFloaters(dt) {
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.t += dt;
    if (f.t >= f.life) { f.el.remove(); floaters.splice(i, 1); continue; }
    const s = toScreen(f.x, f.y + f.t * 1.5, f.z);
    f.el.style.left = s.x + 'px'; f.el.style.top = s.y + 'px';
    f.el.style.opacity = String(1 - Math.max(0, (f.t - f.life * 0.6) / (f.life * 0.4)));
  }
}
let msgT = 0;
function showMsg(main, sub = '', dur = 2.5) {
  $('msgMain').textContent = main; $('msgSub').textContent = sub;
  $('msg').style.opacity = '1'; msgT = dur;
}

// ============================================================
// Player
// ============================================================
const playerModel = buildAntlion();
scene.add(playerModel.root);
const player = {
  x: 0, z: 0, heading: 0, model: playerModel,
  stage: 0, scale: 1, hp: 100, maxHp: 100, energy: 100,
  burrowed: false, action: null, actionT: 0, sink: 0, pit: null,
  attackCd: 0, snapT: 0, revealT: 0, invuln: 0,
  moveTarget: null, target: null, holding: null,
  score: 0, combo: 0, comboT: 0, power: 0,
  buffs: { speed: 0, jaws: 0, deep: 0, shield: 0, lure: 0 },
  walkPhase: 0, moving: 0,
  stats: { ants: 0, enemies: 0, time: 0 },
};
function reachTo(e) { return 1.25 * player.scale + (e ? e.t.radius : 0) + 0.25; }

// ============================================================
// Entities
// ============================================================
const entities = [];
function spawnEntity(type, x, z) {
  const t = TYPES[type];
  let model;
  switch (type) {
    case 'ant': model = buildAnt(Math.random() < 0.25 ? 0x4a1e10 : 0x1c1410); break;
    case 'soldier': model = buildAnt(0x8a2a14, true); break;
    case 'beetle': model = buildBeetle(); break;
    case 'spider': model = buildSpider(); break;
    case 'wasp': model = buildWasp(); break;
    case 'mantis': model = buildMantis(); break;
  }
  const sc = t.scale * (type === 'ant' ? rand(0.85, 1.15) : 1);
  model.root.scale.setScalar(sc);
  scene.add(model.root);
  const e = {
    type, t, model, x, z, alt: t.flying ? 3.5 : 0, heading: rand(0, TAU),
    hp: t.hp, maxHp: t.hp, sc,
    state: t.flying ? 'patrol' : null, stT: 0, cdT: rand(0.5, 1.5), leapCd: 0,
    aggro: false, lostT: 0, last: null, goal: null, wanderT: 0,
    trapped: false, held: false, stun: 0, dead: false, deathT: 0,
    phase: rand(0, TAU), moveSpeed: 0, flashT: 0, flashColor: 0xff0000,
    home: { x, z }, ang: rand(0, TAU), bar: null, carrying: Math.random() < 0.3,
  };
  if (e.carrying) {
    const crumb = new THREE.Mesh(G.rock, mat(0xf0e0b0, 0.8));
    crumb.scale.setScalar(0.09); crumb.position.set(0, 0.08, 0.42); model.body.add(crumb);
  }
  if (t.flying) {
    e.shadow = decal(CIRCLE, 0x000000, 0.3); e.shadow.scale.setScalar(0.5); scene.add(e.shadow);
  }
  if (type === 'mantis') {
    const tele = decal(new THREE.CircleGeometry(t.range / sc, 24, -Math.PI / 2 - 0.75, 1.5), 0xff2a1a, 0);
    tele.position.y = 0.12; model.root.add(tele);
    e.tele = tele;
  }
  entities.push(e);
  return e;
}
function removeEntity(e) {
  scene.remove(e.model.root);
  if (e.shadow) scene.remove(e.shadow);
  if (e.bar) e.bar.remove();
  e.model.root.traverse((o) => { if (o.material && o.material.dispose && !o.material.shared) o.material.dispose(); });
  const i = entities.indexOf(e); if (i >= 0) entities.splice(i, 1);
  if (player.target === e) player.target = null;
  if (player.holding === e) player.holding = null;
}
function flash(e, color, t = 0.15) { e.flashT = t; e.flashColor = color; }
function hittable(e) { return !e.dead && (!e.t.flying || e.alt < 1.7); }

function playerVisibleTo(e, d) {
  if (state !== 'playing') return false;
  const p = player;
  if (!p.burrowed) return true;
  if (p.revealT > 0) return true;
  if (e.type === 'mantis' && d < 5) return true;
  return false;
}

function moveToward(e, tx, tz, speed, dt) {
  const dx = tx - e.x, dz = tz - e.z, d = Math.hypot(dx, dz);
  if (d < 0.05) return d;
  const step = Math.min(d, speed * dt);
  e.x += dx / d * step; e.z += dz / d * step;
  e.heading = angleLerp(e.heading, Math.atan2(dx, dz), Math.min(1, dt * 8));
  return d;
}
function faceToward(e, tx, tz, dt, rate = 10) {
  e.heading = angleLerp(e.heading, Math.atan2(tx - e.x, tz - e.z), Math.min(1, dt * rate));
}
function wander(e, dt, mul = 0.45) {
  e.wanderT -= dt;
  if (e.wanderT <= 0 || !e.goal) {
    e.goal = { x: clamp(e.x + rand(-10, 10), -WORLD + 3, WORLD - 3), z: clamp(e.z + rand(-10, 10), -WORLD + 3, WORLD - 3) };
    e.wanderT = rand(3, 7);
  }
  const d = moveToward(e, e.goal.x, e.goal.z, e.t.speed * mul, dt);
  if (d < 0.3) e.wanderT = Math.min(e.wanderT, rand(0.3, 1.5));
}

// Pit physics: returns true if the entity is busy being trapped (skip normal AI).
function pitInfluence(e, dt) {
  const p = player;
  const pit = p.burrowed ? p.pit : null;
  if (!pit || e.t.flying || e.dead || e.leap) { e.trapped = false; return false; }
  const dx = pit.x - e.x, dz = pit.z - e.z, d = Math.hypot(dx, dz);
  if (d > pit.r) { e.trapped = false; return false; }
  const power = pit.depth * 4 * (p.buffs.deep > 0 ? 1.3 : 1) * (0.7 + 0.3 * (1 - d / pit.r));
  const net = power - e.t.resist;
  if (!e.trapped) { e.trapped = true; if (net > 0 && e.type !== 'ant') floatText('Fast!', e.x, 1.2, e.z, '#ffd27a', 14); }
  if (net > 0) {
    const s = Math.min(d, Math.min(net, 5) * dt);
    if (d > 0.001) { e.x += dx / d * s; e.z += dz / d * s; }
    e.heading = angleLerp(e.heading, Math.atan2(-dx, -dz), dt * 4); // tries to face out
    if (Math.random() < dt * 8) particles.emit(e.x, heightAt(e.x, e.z) + 0.1, e.z, 1, SAND, { speed: 0.8, up: 1, size: 0.06, life: 0.5 });
    const catchR = 0.5 * p.scale + e.t.radius * 0.6;
    if (d < catchR && p.action === null && !p.holding) {
      grab(e);
    }
  } else {
    // climbing out
    const s = (-net * 0.5 + 0.6) * dt;
    if (d > 0.001) { e.x -= dx / d * s; e.z -= dz / d * s; }
    e.heading = angleLerp(e.heading, Math.atan2(-dx, -dz), dt * 6);
  }
  return true;
}

function grab(e) {
  const p = player;
  if (e.type === 'ant' || e.hp <= p.dmgNow() * 0.5) {
    p.snapT = 0.25; faceToward(p, e.x, e.z, 1, 1);
    killEntity(e, 'pit');
    return;
  }
  e.held = true; p.holding = e;
  floatText('Fångad!', e.x, 1.4, e.z, '#ffb347', 16);
  SFX.bite();
}

function damageEntity(e, amount, src) {
  if (e.dead) return;
  if (e.t.armor && src !== 'ambush' && src !== 'quake' && src !== 'grip') amount *= e.t.armor;
  e.hp -= amount;
  flash(e, 0xffffff, 0.12);
  e.aggro = true; e.lostT = 3;
  const y = heightAt(e.x, e.z) + e.alt + 0.6 * e.sc;
  if (src !== 'grip') {
    const big = src === 'ambush';
    floatText((big ? 'Bakhåll! ' : '') + Math.max(1, Math.round(amount * 10)), e.x, y + 0.3, e.z, big ? '#ffb347' : '#ffffff', big ? 22 : 18);
    particles.emit(e.x, y, e.z, 6, GOO, { speed: 2.5, up: 2.5, size: 0.06 });
  }
  if (e.hp <= 0) killEntity(e, src);
}

function killEntity(e, src) {
  if (e.dead) return;
  const p = player;
  e.dead = true; e.deathT = 0; e.held = false; e.trapped = false;
  if (p.holding === e) p.holding = null;
  if (p.target === e) p.target = null;
  if (e.bar) { e.bar.remove(); e.bar = null; }
  const pitBonus = src === 'pit' || src === 'grip' ? 1.5 : 1;
  p.combo = p.comboT > 0 ? p.combo + 1 : 1;
  p.comboT = 4;
  const mult = 1 + Math.min(p.combo - 1, 8) * 0.25;
  const pts = Math.round(e.t.points * pitBonus * mult);
  addScore(pts);
  p.energy = Math.min(100, p.energy + e.t.energy);
  if (e.t.hostile) p.stats.enemies++; else p.stats.ants++;
  const y = heightAt(e.x, e.z) + e.alt + 0.5;
  floatText('+' + pts, e.x, y + 0.5, e.z, '#ffd27a', e.t.boss ? 30 : 20);
  particles.emit(e.x, y, e.z, e.t.boss ? 40 : 12, GOO, { speed: 3, up: 3.5, size: 0.08 });
  if (src === 'pit' || src === 'grip') { SFX.catch(); p.snapT = 0.25; } else SFX.kill();
  if (Math.random() < DROP_CHANCE[e.type]) {
    spawnPowerup(null, e.x, e.z);
    if (e.t.boss) { spawnPowerup(null, e.x + 1.5, e.z); spawnPowerup('honey', e.x - 1.5, e.z); }
  }
  if (e.t.boss) {
    $('bossbar').classList.add('hidden');
    showMsg('Bönsyrsan besegrad!', '+' + pts + ' poäng', 3);
    shake = 0.6;
  }
}

function addScore(n) {
  const p = player;
  p.score += n;
  p.power = Math.min(QUAKE_COST, p.power + n);
  let st = p.stage;
  while (st + 1 < STAGES.length && p.score >= STAGES[st + 1].score) st++;
  if (st !== p.stage) {
    p.stage = st;
    const S = STAGES[st];
    const ratio = p.hp / p.maxHp;
    p.maxHp = S.hp; p.hp = Math.min(S.hp, S.hp * ratio + 30);
    showMsg('Du växer!', 'Nu är du ' + S.name, 3);
    SFX.grow();
    particles.emit(p.x, heightAt(p.x, p.z) + 0.5, p.z, 30, SPARK, { speed: 4, up: 5, size: 0.08, life: 1.2 });
  }
}

function hurtPlayer(amount, srcName) {
  const p = player;
  if (p.invuln > 0 || state !== 'playing') return;
  if (p.buffs.shield > 0) amount *= 0.35;
  if (p.burrowed) amount *= 0.6;
  p.hp -= amount;
  p.invuln = 0.3;
  shake = Math.max(shake, 0.35);
  $('vignette').style.opacity = '1';
  setTimeout(() => { $('vignette').style.opacity = '0'; }, 180);
  floatText('-' + Math.round(amount), p.x, heightAt(p.x, p.z) + 1.6, p.z, '#ff5a4a', 22);
  particles.emit(p.x, heightAt(p.x, p.z) + 0.6, p.z, 8, 0xa04020, { speed: 2.5, up: 2.5, size: 0.07 });
  SFX.hurt();
  for (const m of p.model.mats) { m.emissive.setHex(0xff2200); }
  p.hurtFlash = 0.15;
  if (p.hp <= 0) { p.hp = 0; gameOver(srcName); }
}

// ---------------- AI ----------------
function updateAnt(e, dt) {
  const p = player, d = dist(e, p);
  const vis = playerVisibleTo(e, d);
  if (p.buffs.lure > 0 && d < 24) {
    moveToward(e, p.x, p.z, e.t.speed * 1.1, dt);
  } else if (vis && d < 5.5) {
    const ax = e.x - p.x, az = e.z - p.z;
    moveToward(e, e.x + ax, e.z + az, e.t.speed * 1.35, dt);
    e.goal = null;
  } else {
    e.wanderT -= dt;
    if (!e.goal || e.wanderT <= 0) {
      if (Math.random() < 0.35) { const h = anthills[Math.floor(Math.random() * anthills.length)]; e.goal = { x: h.x, z: h.z }; }
      else e.goal = { x: clamp(p.x + rand(-22, 22), -WORLD + 3, WORLD - 3), z: clamp(p.z + rand(-22, 22), -WORLD + 3, WORLD - 3) };
      e.wanderT = rand(6, 14);
    }
    const dd = moveToward(e, e.goal.x, e.goal.z, e.t.speed * 0.8, dt);
    e.heading += Math.sin(e.phase * 0.7) * dt * 1.2; // wobble
    if (dd < 1) e.goal = null;
  }
}

function updateGroundHostile(e, dt) {
  const p = player, d = dist(e, p), t = e.t;
  const vis = playerVisibleTo(e, d);
  e.cdT -= dt; e.leapCd -= dt;
  if (vis && d < t.sight) { e.aggro = true; e.lostT = 2.5; e.last = { x: p.x, z: p.z }; }
  else if (e.aggro && !vis) { e.lostT -= dt; if (e.lostT <= 0) e.aggro = false; }
  if (e.stun > 0) { e.stun -= dt; return; }

  if (e.leap) {
    const L = e.leap;
    L.t += dt;
    const u = Math.min(1, L.t / L.dur);
    e.x = lerp(L.sx, L.tx, u); e.z = lerp(L.sz, L.tz, u);
    e.alt = Math.sin(Math.PI * u) * 1.4;
    if (u >= 1) {
      e.leap = null; e.alt = 0; e.cdT = 0.8; e.leapCd = 3.2;
      particles.emit(e.x, heightAt(e.x, e.z), e.z, 8, SAND, { speed: 2, up: 1.5 });
      if (dist(e, p) < 1.4 + p.scale * 0.3 && playerVisibleTo(e, 0)) hurtPlayer(t.dmg, t.name);
    }
    return;
  }
  if (e.state === 'windup') {
    e.stT -= dt;
    faceToward(e, p.x, p.z, dt, e.t.boss ? 2.5 : 8);
    if (e.tele) e.tele.material.opacity = 0.15 + 0.35 * (1 - e.stT / t.windup);
    if (e.stT <= 0) {
      e.state = null; e.cdT = t.cd; e.strikeT = 0.3;
      if (e.tele) e.tele.material.opacity = 0;
      const dd = dist(e, p);
      let hit = dd < t.range + p.scale * 0.4 && playerVisibleTo(e, dd);
      if (hit && e.t.boss) {
        const ang = Math.atan2(p.x - e.x, p.z - e.z);
        let diff = Math.abs(((ang - e.heading) % TAU + TAU + Math.PI) % TAU - Math.PI);
        hit = diff < 0.8;
      }
      if (hit) hurtPlayer(t.dmg, t.name);
      else if (e.t.boss) SFX.whiff();
      if (e.t.boss) particles.emit(e.x + Math.sin(e.heading) * 2, heightAt(e.x, e.z) + 0.2, e.z + Math.cos(e.heading) * 2, 14, SAND, { speed: 3, up: 2 });
    }
    return;
  }
  if (e.aggro) {
    const tx = vis ? p.x : e.last.x, tz = vis ? p.z : e.last.z;
    if (vis && d <= t.range) {
      faceToward(e, p.x, p.z, dt);
      if (e.cdT <= 0) {
        e.state = 'windup'; e.stT = t.windup;
        flash(e, 0xff3000, t.windup);
        if (e.t.boss) SFX.boss();
      }
    } else if (e.type === 'spider' && vis && d > 2.5 && d < 7 && e.leapCd <= 0) {
      e.leap = { sx: e.x, sz: e.z, tx: p.x + (p.x - e.x) / d * 0.3, tz: p.z + (p.z - e.z) / d * 0.3, t: 0, dur: 0.5 };
      faceToward(e, p.x, p.z, 1, 1);
      flash(e, 0xff3000, 0.5);
    } else {
      const dd = moveToward(e, tx, tz, t.speed * (vis ? 1 : 0.6), dt);
      if (!vis && dd < 0.5) e.aggro = false;
    }
  } else {
    wander(e, dt, 0.4);
  }
}

function updateWasp(e, dt) {
  const p = player, d = dist(e, p), t = e.t;
  const vis = playerVisibleTo(e, d);
  e.cdT -= dt;
  if (e.stun > 0 && e.state !== 'grounded') { e.state = 'grounded'; e.stT = e.stun; e.stun = 0; }
  switch (e.state) {
    case 'patrol': {
      e.home.x = lerp(e.home.x, p.x, dt * 0.05); e.home.z = lerp(e.home.z, p.z, dt * 0.05);
      e.ang += dt * 0.8;
      moveToward(e, e.home.x + Math.cos(e.ang) * 6, e.home.z + Math.sin(e.ang) * 6, t.speed * 0.6, dt);
      e.alt = lerp(e.alt, 3.5, dt * 2);
      if (vis && d < t.sight && e.cdT <= 0) { e.state = 'track'; e.stT = 1.6; }
      break;
    }
    case 'track': {
      moveToward(e, p.x, p.z, t.speed, dt);
      e.alt = lerp(e.alt, 3.8, dt * 3);
      e.stT -= dt;
      if (!vis) { e.state = 'patrol'; e.cdT = 1; break; }
      if (e.stT <= 0 && d < 3) { e.state = 'aim'; e.stT = 0.45; e.dive = { x: p.x, z: p.z }; flash(e, 0xff3000, 0.45); SFX.buzz(); }
      break;
    }
    case 'aim': {
      e.stT -= dt;
      e.x += Math.sin(e.phase * 13) * dt; // shiver
      faceToward(e, e.dive.x, e.dive.z, dt);
      if (e.stT <= 0) e.state = 'dive';
      break;
    }
    case 'dive': {
      const dd = moveToward(e, e.dive.x, e.dive.z, 14, dt);
      e.alt = Math.max(0.6, e.alt - 14 * dt);
      if (dd < 0.15 && e.alt <= 0.61) {
        if (Math.hypot(p.x - e.dive.x, p.z - e.dive.z) < t.range + p.scale * 0.3 && playerVisibleTo(e, 0)) hurtPlayer(t.dmg, t.name);
        particles.emit(e.x, heightAt(e.x, e.z), e.z, 8, SAND, { speed: 2, up: 1.5 });
        e.state = 'grounded'; e.stT = 1.4;
      }
      break;
    }
    case 'grounded': {
      e.stT -= dt;
      e.alt = lerp(e.alt, 0.6, dt * 6);
      if (e.stT <= 0) { e.state = 'rise'; e.stT = 0.8; }
      break;
    }
    case 'rise': {
      e.alt = lerp(e.alt, 3.5, dt * 3);
      e.stT -= dt;
      if (e.stT <= 0) { e.state = 'patrol'; e.cdT = t.cd; }
      break;
    }
  }
}

function updateEntities(dt) {
  const p = player;
  for (let i = entities.length - 1; i >= 0; i--) {
    const e = entities[i];
    e.phase += dt;
    if (e.dead) {
      e.deathT += dt;
      const u = e.deathT / 1.0;
      e.model.root.rotation.z = Math.min(Math.PI, u * 8);
      e.model.root.position.y = heightAt(e.x, e.z) + (e.t.flying ? Math.max(0, e.alt * (1 - u * 3)) : 0) - u * 0.6;
      e.model.root.scale.setScalar(e.sc * Math.max(0.01, 1 - u));
      if (e.shadow) e.shadow.visible = false;
      if (u >= 1) removeEntity(e);
      continue;
    }
    const ox = e.x, oz = e.z;
    if (e.held) {
      if (!p.burrowed || p.holding !== e) { e.held = false; }
      else {
        const hx = p.x + Math.sin(p.heading) * (0.9 * p.scale), hz = p.z + Math.cos(p.heading) * (0.9 * p.scale);
        e.x = lerp(e.x, hx, Math.min(1, dt * 10)); e.z = lerp(e.z, hz, Math.min(1, dt * 10));
        faceToward(p, e.x, e.z, dt, 6);
        p.snapT = Math.max(p.snapT, 0.1);
        damageEntity(e, p.dmgNow() * 2.2 * dt, 'grip');
        if (Math.random() < dt * 6) particles.emit(e.x, heightAt(e.x, e.z) + 0.3, e.z, 2, GOO, { speed: 1.5, up: 2, size: 0.05 });
      }
    } else if (!pitInfluence(e, dt)) {
      if (e.type === 'ant') updateAnt(e, dt);
      else if (e.type === 'wasp') updateWasp(e, dt);
      else updateGroundHostile(e, dt);
    }
    if (e.dead) continue;
    // separation
    if (!e.t.flying && !e.held) {
      for (const o of entities) {
        if (o === e || o.dead || o.t.flying || o.held) continue;
        const dx = e.x - o.x, dz = e.z - o.z, dd = dx * dx + dz * dz, min = (e.t.radius + o.t.radius) * 0.8;
        if (dd < min * min && dd > 1e-6) { const l = Math.sqrt(dd), push = (min - l) * 0.5; e.x += dx / l * push; e.z += dz / l * push; }
      }
      if (!p.burrowed && !e.leap) {
        const dx = e.x - p.x, dz = e.z - p.z, l = Math.hypot(dx, dz), min = e.t.radius * 0.8 + 0.5 * p.scale;
        if (l < min && l > 1e-4) { e.x = p.x + dx / l * min; e.z = p.z + dz / l * min; }
      }
      collideRocks(e, e.t.radius * 0.6);
    } else {
      e.x = clamp(e.x, -WORLD + 1, WORLD - 1); e.z = clamp(e.z, -WORLD + 1, WORLD - 1);
    }
    // despawn far-away ants
    if (e.type === 'ant' && dist(e, p) > 46) { removeEntity(e); continue; }

    e.moveSpeed = lerp(e.moveSpeed, Math.hypot(e.x - ox, e.z - oz) / Math.max(dt, 1e-4), Math.min(1, dt * 10));
    poseEntity(e, dt);
  }
}

function poseEntity(e, dt) {
  const M = e.model, R = M.root;
  const gy = heightAt(e.x, e.z);
  R.position.set(e.x, gy + e.alt, e.z);
  R.rotation.y = e.heading;
  const struggling = e.trapped || e.held;
  const speed = struggling ? 8 : e.moveSpeed;
  e.walk = (e.walk || 0) + dt * (2 + speed * (e.t.flying ? 0 : 5.5 / e.sc));
  if (M.legs.length) animateLegs(M, e.walk, Math.min(0.5, speed * 0.25), Math.min(0.35, speed * 0.15), struggling ? 0.5 : 0);
  M.body.position.x = struggling ? Math.sin(e.phase * 40) * 0.03 : 0;
  if (e.type === 'wasp') {
    for (const w of M.parts.wings) w.piv.rotation.z = w.s * Math.sin(e.phase * 60) * 0.7;
    M.body.position.y = Math.sin(e.phase * 4) * 0.08;
    M.body.rotation.x = e.state === 'dive' ? 0.6 : e.state === 'aim' ? -0.3 : 0.1;
    if (e.shadow) {
      e.shadow.visible = true;
      e.shadow.position.set(e.x, gy + 0.05, e.z);
      const danger = e.state === 'aim' || e.state === 'dive';
      e.shadow.material.color.setHex(danger ? 0xff2000 : 0x000000);
      e.shadow.material.opacity = danger ? 0.45 : 0.25;
      e.shadow.scale.setScalar(danger ? 1.3 : 0.5 + 0.1 * (4 - e.alt));
    }
  }
  if (e.type === 'mantis') {
    const raise = e.state === 'windup' ? -1.1 : (e.strikeT > 0 ? 0.9 : -0.2 + Math.sin(e.phase * 2) * 0.08);
    if (e.strikeT > 0) e.strikeT -= dt;
    for (const a of M.parts.arms) a.rotation.x = lerp(a.rotation.x, raise, Math.min(1, dt * (e.strikeT > 0 ? 30 : 6)));
  }
  if (e.state === 'windup' && !e.t.boss) M.body.rotation.x = -0.35; // rear up
  else if (e.type !== 'wasp') M.body.rotation.x = lerp(M.body.rotation.x, 0, Math.min(1, dt * 8));
  if (e.leap) M.body.rotation.x = -0.3;
  // flash
  if (e.flashT > 0) {
    e.flashT -= dt;
    const k = e.flashT > 0 ? 0.6 : 0;
    for (const m of M.mats) { m.emissive.setHex(e.flashColor); m.emissiveIntensity = k; }
  }
  // HP bars
  if (e.t.hostile && !e.t.boss && e.hp < e.maxHp) {
    if (!e.bar) { e.bar = document.createElement('div'); e.bar.className = 'ebar'; e.bar.innerHTML = '<i></i>'; floatersEl.appendChild(e.bar); }
    const s = toScreen(e.x, gy + e.alt + 1.2 * e.sc, e.z);
    e.bar.style.left = s.x + 'px'; e.bar.style.top = s.y + 'px';
    e.bar.firstChild.style.width = Math.max(0, e.hp / e.maxHp * 100) + '%';
  }
  if (e.t.boss) $('bossFill').style.width = Math.max(0, e.hp / e.maxHp * 100) + '%';
}

// ============================================================
// Power-ups
// ============================================================
const powerups = [];
const iconTex = {};
function getIconTex(kind) {
  if (iconTex[kind]) return iconTex[kind];
  const P = POWERUPS[kind];
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 8, 64, 64, 62);
  grd.addColorStop(0, 'rgba(255,255,255,0.95)'); grd.addColorStop(0.5, P.color); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.beginPath(); g.arc(64, 64, 62, 0, TAU); g.fill();
  g.font = '64px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(P.emoji, 64, 70);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return (iconTex[kind] = tex);
}
function spawnPowerup(kind, x, z) {
  if (!kind) { const w = {}; for (const k in POWERUPS) w[k] = POWERUPS[k].w; kind = weighted(w); }
  const o = { x, z };
  collideRocks(o, 0.6);
  const g = new THREE.Group();
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: getIconTex(kind), depthWrite: false }));
  spr.scale.setScalar(1.3); spr.position.y = 1;
  const ring = decal(new THREE.RingGeometry(0.55, 0.75, 28), new THREE.Color(POWERUPS[kind].color).getHex(), 0.7);
  ring.position.y = 0.06;
  g.add(spr, ring);
  g.position.set(o.x, heightAt(o.x, o.z), o.z);
  scene.add(g);
  powerups.push({ kind, x: o.x, z: o.z, t: 0, life: 35, g, spr, ring });
}
function updatePowerups(dt) {
  const p = player;
  for (let i = powerups.length - 1; i >= 0; i--) {
    const u = powerups[i];
    u.t += dt;
    u.g.position.y = heightAt(u.x, u.z);
    u.spr.position.y = 1 + Math.sin(u.t * 3) * 0.15;
    u.ring.rotation.z += dt;
    const fading = u.life - u.t < 5;
    u.spr.material.opacity = fading ? 0.5 + 0.5 * Math.sin(u.t * 12) : 1;
    if (!p.burrowed && Math.hypot(p.x - u.x, p.z - u.z) < 1.1 + p.scale * 0.3) {
      applyPowerup(u.kind);
      scene.remove(u.g); powerups.splice(i, 1); continue;
    }
    if (u.t > u.life) { scene.remove(u.g); powerups.splice(i, 1); }
  }
}
function applyPowerup(kind) {
  const p = player, P = POWERUPS[kind];
  if (kind === 'honey') p.hp = Math.min(p.maxHp, p.hp + 40);
  else if (kind === 'sugar') p.energy = Math.min(100, p.energy + 50);
  else p.buffs[kind] = P.dur;
  floatText(P.emoji + ' ' + P.name, p.x, heightAt(p.x, p.z) + 1.8, p.z, P.color, 20);
  showMsg(P.emoji + ' ' + P.name, P.desc, 1.6);
  particles.emit(p.x, heightAt(p.x, p.z) + 0.8, p.z, 18, new THREE.Color(P.color).getHex(), { speed: 3, up: 4, size: 0.07 });
  SFX.power();
}

// ============================================================
// Bird hazard
// ============================================================
const bird = { state: 'idle', t: 0, x: 0, z: 0, nextT: 0, model: buildBird(), shadow: decal(CIRCLE, 0x000000, 0) };
bird.model.root.visible = false;
scene.add(bird.model.root, bird.shadow);
const BIRD_R = 2.4;
function startBird() {
  const p = player, a = rand(0, TAU);
  bird.state = 'track'; bird.t = 3.4;
  bird.x = p.x + Math.cos(a) * 14; bird.z = p.z + Math.sin(a) * 14;
  showMsg('⚠ En fågel cirklar ovanför!', 'Gräv ner dig innan den slår till!', 2.5);
  SFX.bird();
}
function updateBird(dt) {
  const p = player, b = bird;
  const sh = b.shadow;
  if (b.state === 'idle') { sh.visible = false; return; }
  sh.visible = b.state !== 'leave';
  if (b.state === 'track') {
    b.t -= dt;
    const dx = p.x - b.x, dz = p.z - b.z, d = Math.hypot(dx, dz);
    const spd = 7.2;
    if (d > 0.01) { b.x += dx / d * Math.min(d, spd * dt); b.z += dz / d * Math.min(d, spd * dt); }
    sh.material.opacity = Math.min(0.45, sh.material.opacity + dt * 0.3);
    sh.scale.setScalar(BIRD_R * (1.4 + Math.sin(b.t * 6) * 0.1));
    if (b.t <= 0) { b.state = 'lock'; b.t = 0.8; SFX.bird(); }
  } else if (b.state === 'lock') {
    b.t -= dt;
    sh.material.opacity = 0.6;
    sh.material.color.setHex(0x400000);
    sh.scale.setScalar(BIRD_R * (1 + b.t * 0.4));
    if (b.t <= 0) {
      b.state = 'strike'; b.t = 0;
      b.model.root.visible = true;
    }
  } else if (b.state === 'strike') {
    b.t += dt;
    const u = Math.min(1, b.t / 0.45);
    const gy = heightAt(b.x, b.z);
    b.model.root.position.set(b.x + (1 - u) * 16, gy + 0.8 + (1 - u) * 20, b.z + (1 - u) * 16);
    b.model.root.rotation.set(0.6 * (1 - u), Math.atan2(-1, -1), 0);
    for (const w of b.model.parts.wings) w.piv.rotation.z = w.s * (0.9 - u * 0.6);
    if (u >= 1) {
      const d = Math.hypot(p.x - b.x, p.z - b.z);
      shake = 0.5;
      particles.emit(b.x, gy, b.z, 30, SAND, { speed: 5, up: 4, size: 0.1 });
      noise(0.4, 0.3, 300);
      if (d < BIRD_R + 0.3 * p.scale) {
        if (p.burrowed) { floatText('Undvek fågeln! +40', p.x, gy + 1.8, p.z, '#7cff8a', 20); addScore(40); }
        else hurtPlayer(30, 'Fågel');
      }
      for (const e of entities) if (!e.dead && !e.t.boss && Math.hypot(e.x - b.x, e.z - b.z) < BIRD_R) { e.dead = true; e.deathT = 0; if (e.bar) { e.bar.remove(); e.bar = null; } }
      b.state = 'leave'; b.t = 0;
      sh.material.color.setHex(0x000000); sh.material.opacity = 0;
    }
  } else if (b.state === 'leave') {
    b.t += dt;
    const gy = heightAt(b.x, b.z);
    b.model.root.position.set(b.x - b.t * 14, gy + 0.8 + b.t * b.t * 14, b.z - b.t * 14);
    b.model.root.rotation.x = -0.5;
    for (const w of b.model.parts.wings) w.piv.rotation.z = w.s * Math.sin(b.t * 18) * 0.8;
    if (b.t > 1.5) { b.state = 'idle'; b.model.root.visible = false; b.nextT = rand(35, 60); }
  }
  sh.position.set(b.x, heightAt(b.x, b.z) + 0.06, b.z);
}

// ============================================================
// Player update & actions
// ============================================================
player.dmgNow = function () { return STAGES[this.stage].dmg * (this.buffs.jaws > 0 ? 2 : 1); };

function findBiteTarget() {
  const p = player;
  let best = null, bestScore = Infinity;
  for (const e of entities) {
    if (!hittable(e)) continue;
    const d = dist(e, p);
    if (d > reachTo(e) * (p.burrowed ? 1.25 : 1)) continue;
    const ang = Math.atan2(e.x - p.x, e.z - p.z);
    const diff = Math.abs(((ang - p.heading) % TAU + TAU + Math.PI) % TAU - Math.PI);
    const s = d + diff * 0.8 - (e.t.hostile ? 0.5 : 0);
    if (s < bestScore) { bestScore = s; best = e; }
  }
  return best;
}
function playerBite(forced) {
  const p = player;
  if (p.attackCd > 0 || p.action || state !== 'playing') return;
  if (p.holding) return;
  let tgt = forced && hittable(forced) && dist(forced, p) <= reachTo(forced) * (p.burrowed ? 1.25 : 1) ? forced : findBiteTarget();
  p.attackCd = 0.5; p.snapT = 0.25;
  if (!tgt) { SFX.whiff(); return; }
  p.heading = Math.atan2(tgt.x - p.x, tgt.z - p.z);
  let mult = 1, src = 'bite';
  if (p.burrowed) { mult = 2.2; src = 'ambush'; p.revealT = 2; particles.emit(p.x, heightAt(p.x, p.z) + 0.2, p.z, 10, SAND, { speed: 3, up: 3 }); }
  SFX.bite();
  damageEntity(tgt, p.dmgNow() * mult, src);
}
function toggleBurrow() {
  const p = player;
  if (p.action || state !== 'playing') return;
  if (!p.burrowed) {
    p.action = 'sinking'; p.actionT = 0.45; p.moveTarget = null; p.target = null;
    SFX.dig();
  } else emerge();
}
function emerge() {
  const p = player;
  if (!p.burrowed || p.action) return;
  p.burrowed = false;
  p.action = 'emerging'; p.actionT = 0.3;
  if (p.holding) { p.holding.held = false; p.holding = null; }
  if (p.pit) { p.pit.owned = false; p.pit = null; }
  SFX.emerge();
  particles.emit(p.x, heightAt(p.x, p.z) + 0.2, p.z, 16, SAND, { speed: 3.5, up: 4 });
  // Ambush: strike the closest hostile in reach
  let best = null, bd = Infinity;
  for (const e of entities) {
    if (!hittable(e) || !e.t.hostile) continue;
    const d = dist(e, p);
    if (d < reachTo(e) * 1.6 && d < bd) { bd = d; best = e; }
  }
  if (best) {
    p.heading = Math.atan2(best.x - p.x, best.z - p.z);
    p.snapT = 0.25;
    SFX.bite();
    damageEntity(best, p.dmgNow() * 3, 'ambush');
    if (!best.dead) best.stun = 0.8;
  }
}
function quake() {
  const p = player;
  if (p.power < QUAKE_COST || state !== 'playing' || p.action) return;
  p.power = 0;
  SFX.quake(); shake = 1;
  showMsg('🌋 Sandskalv!', '', 1.2);
  const gy = heightAt(p.x, p.z);
  for (let i = 0; i < 6; i++) particles.emit(p.x + rand(-6, 6), gy, p.z + rand(-6, 6), 10, SAND, { speed: 4, up: 5, size: 0.12 });
  for (const e of entities) {
    if (e.dead) continue;
    const d = dist(e, p);
    if (d > 11) continue;
    if (!e.t.boss && !e.t.flying) {
      const pull = Math.min(d - 1, 5);
      if (d > 0.01) { e.x -= (e.x - p.x) / d * pull; e.z -= (e.z - p.z) / d * pull; }
    }
    e.stun = 2.2; e.leap = null; e.state = e.t.flying ? e.state : null;
    if (e.t.hostile) damageEntity(e, p.dmgNow() * 2, 'quake');
    else if (!p.burrowed) killEntity(e, 'quake');
  }
}

const keys = {};
function updatePlayer(dt) {
  const p = player, S = STAGES[p.stage];
  p.stats.time += dt;
  p.attackCd = Math.max(0, p.attackCd - dt);
  p.snapT = Math.max(0, p.snapT - dt);
  p.revealT = Math.max(0, p.revealT - dt);
  p.invuln = Math.max(0, p.invuln - dt);
  p.comboT -= dt; if (p.comboT <= 0) p.combo = 0;
  for (const k in p.buffs) p.buffs[k] = Math.max(0, p.buffs[k] - dt);

  // scale follows stage
  p.scale = lerp(p.scale, S.scale, Math.min(1, dt * 3));

  // actions (sinking / emerging)
  if (p.action) {
    p.actionT -= dt;
    if (Math.random() < dt * 30) particles.emit(p.x + rand(-0.5, 0.5), heightAt(p.x, p.z) + 0.1, p.z + rand(-0.5, 0.5), 1, SAND, { speed: 2, up: 3, size: 0.07 });
    if (p.actionT <= 0) {
      if (p.action === 'sinking') {
        p.burrowed = true;
        let pit = pits.find((q) => Math.hypot(q.x - p.x, q.z - p.z) < Math.max(1, q.r * 0.4));
        if (pit) { pit.owned = true; p.x = pit.x; p.z = pit.z; }
        else { pit = { x: p.x, z: p.z, r: 0.6, depth: 0.1, owned: true, drawnR: 0, drawnD: 0 }; pits.push(pit); }
        p.pit = pit;
      }
      p.action = null;
    }
  }

  // energy & health
  const level = currentLevel();
  const drain = (p.burrowed ? 0.35 : p.moving > 0.5 ? 1.5 : 0.9) + level * 0.04;
  p.energy = Math.max(0, p.energy - drain * dt);
  if (p.energy <= 0) { p.hp -= 4 * dt; if (p.hp <= 0 && state === 'playing') { p.hp = 0; gameOver('Svält'); } }
  else if (p.energy > 70) p.hp = Math.min(p.maxHp, p.hp + 1.5 * dt);

  // movement intent
  let mx = 0, mz = 0, wantMove = false;
  const kx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  const ky = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  if (kx || ky) {
    mx = (kx - ky) * Math.SQRT1_2; mz = (-kx - ky) * Math.SQRT1_2;
    const l = Math.hypot(mx, mz); mx /= l; mz /= l;
    wantMove = true; p.moveTarget = null; p.target = null;
  } else if (p.target) {
    const e = p.target;
    if (e.dead || !entities.includes(e)) p.target = null;
    else {
      const d = dist(e, p);
      if (d <= reachTo(e) * (p.burrowed ? 1.25 : 1) && hittable(e)) {
        faceToward(p, e.x, e.z, dt, 14);
        if (p.attackCd <= 0) playerBite(e);
      } else if (!(p.burrowed && e.t.flying)) {
        mx = (e.x - p.x) / d; mz = (e.z - p.z) / d; wantMove = d > reachTo(e) * 0.8;
      }
    }
  } else if (p.moveTarget) {
    const dx = p.moveTarget.x - p.x, dz = p.moveTarget.z - p.z, d = Math.hypot(dx, dz);
    if (d < 0.25) p.moveTarget = null;
    else { mx = dx / d; mz = dz / d; wantMove = true; }
  }
  if (wantMove && p.burrowed && !p.action) emerge();

  const ox = p.x, oz = p.z;
  if (wantMove && !p.action && !p.burrowed) {
    const spd = S.speed * (p.buffs.speed > 0 ? 1.6 : 1);
    p.x += mx * spd * dt; p.z += mz * spd * dt;
    p.heading = angleLerp(p.heading, Math.atan2(mx, mz), Math.min(1, dt * 12));
    collideRocks(p, 0.5 * p.scale);
    if (Math.random() < dt * 6) particles.emit(p.x, heightAt(p.x, p.z) + 0.05, p.z, 1, SAND, { speed: 0.6, up: 0.8, size: 0.06, life: 0.5 });
  }
  p.moving = lerp(p.moving, Math.hypot(p.x - ox, p.z - oz) / Math.max(dt, 1e-4), Math.min(1, dt * 10));

  // when buried, face the nearest trapped prey
  if (p.burrowed && !p.holding) {
    let best = null, bd = Infinity;
    for (const e of entities) if (e.trapped && !e.dead) { const d = dist(e, p); if (d < bd) { bd = d; best = e; } }
    if (best) faceToward(p, best.x, best.z, dt, 4);
  }

  // sink amount
  const targetSink = p.burrowed || p.action === 'sinking' ? 1 : 0;
  const rate = p.action === 'sinking' ? 2.6 : p.action === 'emerging' ? 4 : 3;
  p.sink = clamp(p.sink + Math.sign(targetSink - p.sink) * rate * dt, 0, 1);

  posePlayer(dt);
}

function posePlayer(dt) {
  const p = player, M = p.model;
  const gy = heightAt(p.x, p.z);
  M.root.position.set(p.x, gy - p.sink * 0.42 * p.scale, p.z);
  M.root.rotation.y = p.heading;
  M.root.scale.setScalar(p.scale);
  M.body.rotation.x = -0.28 * p.sink;
  p.walkPhase += dt * (2 + p.moving * 3.2);
  animateLegs(M, p.walkPhase, Math.min(0.5, p.moving * 0.12), Math.min(0.3, p.moving * 0.06), p.action ? 0.6 : 0);
  M.body.position.y = 0.32 + (p.moving > 0.5 ? Math.abs(Math.sin(p.walkPhase)) * 0.03 : 0);
  // jaws: snap closed when biting, idle twitch while buried
  let open = 0.35 + Math.sin(performance.now() * 0.003) * 0.05;
  if (p.burrowed) open = 0.6 + Math.sin(performance.now() * 0.008) * 0.08;
  if (p.snapT > 0) open = p.snapT > 0.15 ? 0.85 : -0.15;
  for (const j of M.parts.jaws) j.piv.rotation.y = lerp(j.piv.rotation.y, j.side * open, Math.min(1, dt * 25));
  if (p.hurtFlash > 0) {
    p.hurtFlash -= dt;
    if (p.hurtFlash <= 0) for (const m of M.mats) m.emissive.setHex(0x000000);
  }
  // reveal glow (when buried but revealed)
  for (const m of M.mats) if (p.hurtFlash <= 0 || p.hurtFlash === undefined) {
    if (p.burrowed && p.revealT > 0) { m.emissive.setHex(0x803000); m.emissiveIntensity = 0.3 + 0.3 * Math.sin(performance.now() * 0.02); }
    else { m.emissive.setHex(0x000000); }
  }
}

// ============================================================
// Spawning, levels, game flow
// ============================================================
let state = 'menu';
let elapsed = 0, lastLevel = 1, bossLevels = new Set();
const timers = { ant: 0, enemy: 3, power: 8 };
function currentLevel() { return 1 + Math.floor(elapsed / 45); }
const LEVEL_NOTES = {
  2: 'Skalbaggar dyker upp. De är pansrade, så använd bakhåll!',
  3: 'Vargspindlar jagar snabbt. Akta dig även för fåglar!',
  4: 'Steklar anfaller från luften!',
  5: 'Något stort närmar sig...',
};

function spawnPointNear(minD, maxD) {
  const p = player;
  for (let tries = 0; tries < 20; tries++) {
    const a = rand(0, TAU), d = rand(minD, maxD);
    const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
    if (Math.abs(x) < WORLD - 3 && Math.abs(z) < WORLD - 3) return { x, z };
  }
  return { x: clamp(p.x + rand(-20, 20), -WORLD + 3, WORLD - 3), z: clamp(p.z + rand(-20, 20), -WORLD + 3, WORLD - 3) };
}

function updateSpawns(dt) {
  const level = currentLevel();
  if (level !== lastLevel) {
    lastLevel = level;
    showMsg('Nivå ' + level, LEVEL_NOTES[level] || 'Fienderna blir fler och farligare.', 3);
    SFX.level();
  }
  // ants
  const ants = entities.filter((e) => e.type === 'ant' && !e.dead).length;
  timers.ant -= dt;
  if (ants < 22 + Math.min(level, 8) * 2 && timers.ant <= 0) {
    timers.ant = 0.5;
    let near = null, nd = Infinity;
    for (const h of anthills) { const d = Math.hypot(h.x - player.x, h.z - player.z); if (d < nd) { nd = d; near = h; } }
    const pt = near && nd < 35 && Math.random() < 0.5 ? { x: near.x + rand(-1, 1), z: near.z + rand(-1, 1) } : spawnPointNear(18, 28);
    spawnEntity('ant', pt.x, pt.z);
  }
  // hostiles
  const hostiles = entities.filter((e) => e.t.hostile && !e.dead && !e.t.boss).length;
  timers.enemy -= dt;
  if (timers.enemy <= 0) {
    timers.enemy = Math.max(2.5, 8 - level * 0.5);
    if (hostiles < Math.min(16, 2 + level * 1.3)) {
      const w = { soldier: 6, beetle: level >= 2 ? 3 : 0, spider: level >= 3 ? 3 : 0, wasp: level >= 4 ? 2 + (level - 4) * 0.5 : 0 };
      const type = weighted(w);
      const pt = spawnPointNear(20, 28);
      spawnEntity(type, pt.x, pt.z);
    }
  }
  // boss every 4 levels starting at 5
  if (level >= 5 && (level - 5) % 4 === 0 && !bossLevels.has(level)) {
    bossLevels.add(level);
    const pt = spawnPointNear(18, 22);
    const boss = spawnEntity('mantis', pt.x, pt.z);
    boss.hp = boss.maxHp = TYPES.mantis.hp * (1 + (level - 5) * 0.2);
    boss.aggro = true; boss.lostT = 99; boss.last = { x: player.x, z: player.z };
    $('bossbar').classList.remove('hidden');
    setTimeout(() => showMsg('🦗 En bönsyrsa närmar sig!', 'Den känner vibrationer, så du kan inte gömma dig när den är nära.', 3.5), 1200);
    SFX.boss();
  }
  // power-ups
  timers.power -= dt;
  if (timers.power <= 0) {
    timers.power = rand(14, 22);
    if (powerups.length < 4) { const pt = spawnPointNear(7, 16); spawnPowerup(null, pt.x, pt.z); }
  }
  // birds
  if (level >= 3 && bird.state === 'idle') {
    bird.nextT -= dt;
    if (bird.nextT <= 0) startBird();
  }
}

function clearWorld() {
  while (entities.length) removeEntity(entities[0]);
  while (powerups.length) { scene.remove(powerups[0].g); powerups.shift(); }
  for (const pit of pits) { pit.depth = 0; }
  updatePits(0);
  pits.length = 0;
  terrain.recompute(-HALF, -HALF, HALF, HALF);
  floaters.forEach((f) => f.el.remove()); floaters.length = 0;
  floatersEl.innerHTML = '';
  bird.state = 'idle'; bird.model.root.visible = false; bird.shadow.visible = false;
}

function resetGame() {
  clearWorld();
  const p = player;
  Object.assign(p, {
    x: 0, z: 0, heading: 0, stage: 0, scale: 1, hp: STAGES[0].hp, maxHp: STAGES[0].hp, energy: 100,
    burrowed: false, action: null, actionT: 0, sink: 0, pit: null, attackCd: 0, snapT: 0, revealT: 0, invuln: 0,
    moveTarget: null, target: null, holding: null, score: 0, combo: 0, comboT: 0, power: 0, moving: 0,
  });
  for (const k in p.buffs) p.buffs[k] = 0;
  p.stats = { ants: 0, enemies: 0, time: 0 };
  elapsed = 0; lastLevel = 1; bossLevels = new Set();
  timers.ant = 0; timers.enemy = 4; timers.power = 6;
  bird.nextT = rand(25, 40);
  for (let i = 0; i < 18; i++) { const pt = spawnPointNear(5, 22); spawnEntity('ant', pt.x, pt.z); }
  $('bossbar').classList.add('hidden');
}

function startGame() {
  ac();
  resetGame();
  state = 'playing';
  $('menu').classList.add('hidden'); $('over').classList.add('hidden'); $('pause').classList.add('hidden');
  $('hud').classList.remove('hidden');
  showMsg('Gräv ner dig och vänta på bytet!', 'Space / 🕳️ för att gräva, klicka för att gå', 3.5);
}
function gameOver(reason) {
  if (state !== 'playing') return;
  state = 'over';
  SFX.over();
  const p = player;
  let best = 0;
  try { best = +localStorage.getItem('antlion3d.best') || 0; } catch (e) { /* ignore */ }
  const newBest = p.score > best;
  if (newBest) { best = p.score; try { localStorage.setItem('antlion3d.best', String(best)); } catch (e) { /* ignore */ } }
  const reasons = { 'Svält': 'Du svalt ihjäl. Glöm inte att äta!', 'Fågel': 'En fågel snappade upp dig.' };
  $('overReason').textContent = reasons[reason] || ('Besegrad av: ' + reason);
  const mm = Math.floor(p.stats.time / 60), ss = String(Math.floor(p.stats.time % 60)).padStart(2, '0');
  $('overStats').innerHTML =
    `<b>${p.score}</b> poäng<br>Stadie: <b>${STAGES[p.stage].name}</b> · Nivå <b>${currentLevel()}</b><br>` +
    `Myror: <b>${p.stats.ants}</b> · Fiender: <b>${p.stats.enemies}</b> · Tid: <b>${mm}:${ss}</b>`;
  $('overBest').textContent = newBest ? '🏆 Nytt rekord!' : 'Rekord: ' + best;
  setTimeout(() => { $('over').classList.remove('hidden'); $('hud').classList.add('hidden'); }, 900);
}
function setPaused(on) {
  if (on && state === 'playing') { state = 'paused'; $('pause').classList.remove('hidden'); }
  else if (!on && state === 'paused') { state = 'playing'; $('pause').classList.add('hidden'); }
}
function toMenu() {
  state = 'menu';
  $('pause').classList.add('hidden'); $('over').classList.add('hidden'); $('hud').classList.add('hidden');
  $('menu').classList.remove('hidden');
  showBest();
  resetGame();
}
function showBest() {
  let best = 0; try { best = +localStorage.getItem('antlion3d.best') || 0; } catch (e) { /* ignore */ }
  $('menuBest').textContent = best ? 'Rekord: ' + best + ' poäng' : '';
}

// ============================================================
// Input
// ============================================================
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function groundPoint(cx, cy) {
  ndc.set(cx / window.innerWidth * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const o = raycaster.ray.origin, d = raycaster.ray.direction;
  let y = 0, t = 0;
  for (let i = 0; i < 4; i++) {
    t = (y - o.y) / d.y;
    y = heightAt(o.x + d.x * t, o.z + d.z * t);
  }
  return { x: o.x + d.x * t, z: o.z + d.z * t };
}
function pickEntity(cx, cy) {
  let best = null, bd = Infinity;
  for (const e of entities) {
    if (e.dead) continue;
    const s = toScreen(e.x, heightAt(e.x, e.z) + e.alt + 0.3 * e.sc, e.z);
    const d = Math.hypot(s.x - cx, s.y - cy);
    const pxPerUnit = window.innerHeight / (camera.top - camera.bottom);
    const r = Math.max(22, e.t.radius * pxPerUnit * 1.2);
    if (d < r && d < bd) { bd = d; best = e; }
  }
  return best;
}
let pointerHeld = false;
function pointerAction(cx, cy, first) {
  const p = player;
  if (state !== 'playing') return;
  if (first) {
    const e = pickEntity(cx, cy);
    if (e) { p.target = e; p.moveTarget = null; return; }
  }
  if (p.target && !first) return;
  p.target = null;
  const g = groundPoint(cx, cy);
  p.moveTarget = { x: clamp(g.x, -WORLD + 1, WORLD - 1), z: clamp(g.z, -WORLD + 1, WORLD - 1) };
  if (first) { clickMark.visible = true; clickMarkT = 0.5; clickMark.position.set(g.x, heightAt(g.x, g.z) + 0.07, g.z); }
}
canvas.addEventListener('pointerdown', (ev) => {
  ac();
  if (ev.button === 2) {
    const g = groundPoint(ev.clientX, ev.clientY);
    const p = player;
    if (!p.burrowed) p.heading = Math.atan2(g.x - p.x, g.z - p.z);
    const e = pickEntity(ev.clientX, ev.clientY);
    playerBite(e);
    return;
  }
  pointerHeld = true;
  canvas.setPointerCapture && canvas.setPointerCapture(ev.pointerId);
  pointerAction(ev.clientX, ev.clientY, true);
});
canvas.addEventListener('pointermove', (ev) => { if (pointerHeld) pointerAction(ev.clientX, ev.clientY, false); });
const endPointer = () => { pointerHeld = false; };
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
canvas.addEventListener('wheel', (ev) => {
  ev.preventDefault();
  zoom = clamp(zoom * (ev.deltaY > 0 ? 0.9 : 1.1), 0.6, 1.8);
  resize();
}, { passive: false });

window.addEventListener('keydown', (ev) => {
  if (ev.repeat && (ev.code === 'Space' || ev.code === 'KeyQ')) return;
  keys[ev.code] = true;
  if (ev.code === 'Space') { ev.preventDefault(); if (state === 'menu' || state === 'over') { if (state === 'over' && $('over').classList.contains('hidden')) return; startGame(); } else toggleBurrow(); }
  else if (ev.code === 'KeyF' || ev.code === 'KeyE') playerBite(player.target);
  else if (ev.code === 'KeyQ') quake();
  else if (ev.code === 'KeyP' || ev.code === 'Escape') setPaused(state === 'playing');
  else if (ev.code === 'KeyM') toggleMute();
  if (ev.code.startsWith('Arrow')) ev.preventDefault();
});
window.addEventListener('keyup', (ev) => { keys[ev.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; setPaused(true); });
document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); });

function bindBtn(id, fn) {
  const el = $(id);
  el.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); ev.preventDefault(); ac(); fn(); });
}
bindBtn('btnBite', () => playerBite(player.target));
bindBtn('btnDig', toggleBurrow);
bindBtn('btnQuake', quake);
bindBtn('btnPause', () => setPaused(true));
bindBtn('btnMute', toggleMute);
$('btnStart').addEventListener('click', startGame);
$('btnAgain').addEventListener('click', startGame);
$('btnResume').addEventListener('click', () => setPaused(false));
$('btnQuit').addEventListener('click', toMenu);
function toggleMute() {
  muted = !muted;
  $('btnMute').textContent = muted ? '🔇' : '🔊';
  try { localStorage.setItem('antlion3d.muted', muted ? '1' : '0'); } catch (e) { /* ignore */ }
}
$('btnMute').textContent = muted ? '🔇' : '🔊';

// ============================================================
// HUD & minimap
// ============================================================
const mm = $('minimap'), mmc = mm.getContext('2d');
const MM_RANGE = 32;
function drawMinimap() {
  const W = mm.width, R = W / 2, p = player, k = R / MM_RANGE;
  mmc.clearRect(0, 0, W, W);
  mmc.save();
  mmc.beginPath(); mmc.arc(R, R, R, 0, TAU); mmc.clip();
  mmc.fillStyle = '#b8955a'; mmc.fillRect(0, 0, W, W);
  // rotate so screen-up matches the isometric view (world -x,-z is up)
  mmc.translate(R, R); mmc.rotate(Math.PI / 4);
  const P = (x, z) => [(x - p.x) * k, (z - p.z) * k];
  // world edge
  mmc.strokeStyle = '#5a3a1a'; mmc.lineWidth = 3;
  { const [x0, z0] = P(-WORLD, -WORLD); mmc.strokeRect(x0, z0, WORLD * 2 * k, WORLD * 2 * k); }
  mmc.fillStyle = '#8a7a66';
  for (const r of rocks) { if (r.soft) continue; const [x, z] = P(r.x, r.z); if (Math.abs(x) < R * 1.5 && Math.abs(z) < R * 1.5) { mmc.beginPath(); mmc.arc(x, z, r.r * k, 0, TAU); mmc.fill(); } }
  mmc.fillStyle = '#6b4a24';
  for (const h of anthills) { const [x, z] = P(h.x, h.z); mmc.beginPath(); mmc.arc(x, z, 2 * k, 0, TAU); mmc.fill(); }
  for (const pit of pits) { const [x, z] = P(pit.x, pit.z); mmc.fillStyle = '#7a5530'; mmc.beginPath(); mmc.arc(x, z, pit.r * k, 0, TAU); mmc.fill(); }
  for (const u of powerups) { const [x, z] = P(u.x, u.z); mmc.fillStyle = POWERUPS[u.kind].color; mmc.beginPath(); mmc.arc(x, z, 7, 0, TAU); mmc.fill(); mmc.strokeStyle = '#fff'; mmc.lineWidth = 2; mmc.stroke(); }
  for (const e of entities) {
    if (e.dead) continue;
    const [x, z] = P(e.x, e.z);
    if (e.type === 'ant') { mmc.fillStyle = '#222'; mmc.fillRect(x - 2.5, z - 2.5, 5, 5); }
    else { mmc.fillStyle = e.t.boss ? '#9bff3a' : e.t.flying ? '#ffd21a' : '#e0301a'; mmc.beginPath(); mmc.arc(x, z, e.t.boss ? 10 : 6, 0, TAU); mmc.fill(); }
  }
  if (bird.state === 'track' || bird.state === 'lock') { const [x, z] = P(bird.x, bird.z); mmc.fillStyle = 'rgba(0,0,0,0.5)'; mmc.beginPath(); mmc.arc(x, z, BIRD_R * k, 0, TAU); mmc.fill(); }
  mmc.restore();
  // player arrow (screen space, always centered)
  mmc.save(); mmc.translate(R, R); mmc.rotate(Math.PI / 4 - p.heading + Math.PI);
  mmc.fillStyle = p.burrowed ? '#ffb347' : '#fff'; mmc.strokeStyle = '#000'; mmc.lineWidth = 2;
  mmc.beginPath(); mmc.moveTo(0, -11); mmc.lineTo(8, 9); mmc.lineTo(0, 4); mmc.lineTo(-8, 9); mmc.closePath(); mmc.fill(); mmc.stroke();
  mmc.restore();
}

let hudAcc = 0;
function updateHud(dt) {
  const p = player;
  hudAcc += dt;
  $('hpFill').style.height = (p.hp / p.maxHp * 100) + '%';
  $('enFill').style.height = p.energy + '%';
  $('biteCd').style.height = (p.attackCd / 0.5 * 100) + '%';
  $('quakeFill').style.width = (p.power / QUAKE_COST * 100) + '%';
  $('btnQuake').classList.toggle('ready', p.power >= QUAKE_COST);
  $('btnQuake').classList.toggle('disabled', p.power < QUAKE_COST);
  $('btnDig').classList.toggle('on', p.burrowed);
  $('burrowTint').style.opacity = p.burrowed ? '1' : '0';
  if (hudAcc < 0.1) return;
  hudAcc = 0;
  $('hpText').textContent = Math.ceil(p.hp);
  $('enText').textContent = Math.ceil(p.energy);
  $('score').textContent = p.score;
  $('stage').textContent = STAGES[p.stage].name;
  $('level').textContent = 'Nivå ' + currentLevel();
  const mult = 1 + Math.min(p.combo - 1, 8) * 0.25;
  $('combo').textContent = p.combo > 1 ? 'Kombo x' + mult.toFixed(2).replace(/\.?0+$/, '') : '';
  $('digName').textContent = p.burrowed ? 'Kliv upp' : 'Gräv ner';
  let html = '';
  for (const k in p.buffs) if (p.buffs[k] > 0) html += `<div class="buff">${POWERUPS[k].emoji} ${POWERUPS[k].name} <b>${Math.ceil(p.buffs[k])}</b></div>`;
  $('buffs').innerHTML = html;
  drawMinimap();
}

// ============================================================
// Camera & main loop
// ============================================================
function updateCamera(dt) {
  const p = player;
  const gy = heightAt(p.x, p.z);
  camTarget.x = lerp(camTarget.x, p.x, Math.min(1, dt * 5));
  camTarget.z = lerp(camTarget.z, p.z, Math.min(1, dt * 5));
  camTarget.y = lerp(camTarget.y, gy, Math.min(1, dt * 3));
  shake = Math.max(0, shake - dt * 1.5);
  const sx = (Math.random() - 0.5) * shake * 0.8, sz = (Math.random() - 0.5) * shake * 0.8;
  camera.position.copy(camTarget).addScaledVector(CAM_DIR, CAM_DIST);
  camera.position.x += sx; camera.position.z += sz;
  camera.lookAt(camTarget.x + sx, camTarget.y, camTarget.z + sz);
  sun.position.copy(camTarget).add(SUN_OFFSET);
  sun.target.position.copy(camTarget);
}

function updateMarkers(dt) {
  const p = player;
  if (p.target && !p.target.dead) {
    const e = p.target;
    targetRing.visible = true;
    targetRing.position.set(e.x, heightAt(e.x, e.z) + 0.08, e.z);
    targetRing.scale.setScalar(e.t.radius * 1.3 + 0.2);
  } else targetRing.visible = false;
  if (clickMarkT > 0) {
    clickMarkT -= dt;
    clickMark.scale.setScalar(1 + (0.5 - clickMarkT) * 2);
    clickMark.material.opacity = clickMarkT * 1.8;
    if (clickMarkT <= 0) clickMark.visible = false;
  }
}

function stepGame(dt) {
  elapsed += dt;
  updatePlayer(dt);
  updatePits(dt);
  updateEntities(dt);
  updatePowerups(dt);
  updateBird(dt);
  updateSpawns(dt);
}

let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state === 'playing') {
    stepGame(dt);
    updateHud(dt);
  } else if (state === 'menu') {
    // attract mode: ants wander around an idle antlion
    for (const e of entities) { e.phase += dt; if (e.type === 'ant') { wander(e, dt, 0.5); collideRocks(e, 0.2); e.moveSpeed = e.t.speed * 0.5; poseEntity(e, dt); } }
    player.walkPhase += dt; posePlayer(dt);
    player.heading += dt * 0.3;
  }
  if (state !== 'paused') {
    particles.update(dt);
    updateFloaters(dt);
    updateMarkers(dt);
    if (msgT > 0) { msgT -= dt; if (msgT <= 0) $('msg').style.opacity = '0'; }
  }
  updateCamera(dt);
  renderer.render(scene, camera);
}

// ============================================================
// Installable app (PWA): offline cache, install button, fullscreen, wake lock
// ============================================================
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
const isInstalled = () => window.matchMedia('(display-mode: fullscreen)').matches || window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
let installPrompt = null;
window.addEventListener('beforeinstallprompt', (ev) => {
  ev.preventDefault();
  installPrompt = ev;
  $('btnInstall').classList.remove('hidden');
  $('installHint').classList.add('hidden');
});
window.addEventListener('appinstalled', () => { installPrompt = null; $('btnInstall').classList.add('hidden'); });
$('btnInstall').addEventListener('click', async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  try { await installPrompt.userChoice; } catch (e) { /* ignore */ }
  installPrompt = null;
  $('btnInstall').classList.add('hidden');
});
if (!isInstalled() && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
  $('installHint').textContent = 'Tips: tryck på Dela ⬆️ och välj "Lägg till på hemskärmen" för att spela som app.';
  $('installHint').classList.remove('hidden');
}
function toggleFullscreen() {
  const d = document;
  if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
  else { const el = d.documentElement; const req = el.requestFullscreen || el.webkitRequestFullscreen; if (req) req.call(el).catch?.(() => {}); }
}
if (!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen) || isInstalled()) $('btnFull').classList.add('hidden');
bindBtn('btnFull', toggleFullscreen);
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && !wakeLock && navigator.wakeLock && !document.hidden) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
    else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { wakeLock = null; }
}
setInterval(() => keepAwake(state === 'playing'), 2000);

showBest();
resetGame();
updateCamera(1);
requestAnimationFrame(loop);

// Debug hook for automated tests
window.__antlion = {
  player, entities, pits, powerups, bird, startGame, toggleBurrow, spawnEntity, playerBite, quake, startBird, spawnPowerup,
  get state() { return state; },
  simulate(seconds) { for (let t = 0; t < seconds && state === 'playing'; t += 1 / 60) { stepGame(1 / 60); particles.update(1 / 60); } },
};
