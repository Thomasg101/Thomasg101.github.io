/* One building, drawn three ways.

   The model is a nine-storey steel frame on caissons, wrapped in a curtain wall.
   Everything is instanced boxes driven by a single shader, so the three readings
   the page scrolls through are uniforms rather than separate scenes:

     uEnvelope  the cladding flies off (0) or sits on the frame (1)
     uFound     the below-grade work drills down out of the ground
     uThermal   the surface is repainted as an exterior thermogram
     uRetrofit  slab edges, balconies and parapets cool down
     uDissolve  the solid dissolves to a wireframe and a point cloud

   Nothing here knows about the page. main.js decides what the targets are. */

import * as THREE from './vendor/three.module.min.js';

/* Colours are authored as the sRGB values they should appear as and written to
   the framebuffer untouched, so a hex here matches the same hex in the CSS. */
THREE.ColorManagement.enabled = false;

/* ------------------------------------------------------------- geometry -- */

const BAY = 7.2, NX = 4, NZ = 3;
const GROUND_STOREY = 5.0, STOREY = 3.8, STOREYS = 9;
const HX = (NX * BAY) / 2, HZ = (NZ * BAY) / 2;
const level = k => (k === 0 ? 0 : GROUND_STOREY + (k - 1) * STOREY);
const ROOF = level(STOREYS);
const FACADE = 0.5;                       /* curtain wall stands off the grid line */

const KIND = { steel: 0, concrete: 1, below: 2, glass: 3, spandrel: 4, mullion: 5, balcony: 6, roof: 7 };
const GROUP = { frame: 0, envelope: 1, below: 2 };

const C = {
  steel: '#a8361f', slab: '#c9ccc8', core: '#b3b8b4',
  raft: '#a2a7a4', caisson: '#8b918e', pile: '#7a4a36', lagging: '#b89b72',
  glass: '#7c9fb1', spandrel: '#394045', mullion: '#22272b',
  roof: '#aeb3b0', plant: '#4a5257'
};

/* Small deterministic generator: the model must look the same on every load. */
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildModel() {
  const rnd = mulberry(20261112);
  const items = [];
  const add = o => {
    items.push(Object.assign({
      r: null, kind: KIND.steel, group: GROUP.frame, dB: 0, dE: 0,
      ex: [0, 0, 0], h0: 0.2, h1: 0.2, glass: false, cyl: false, rand: rnd()
    }, o));
  };
  const rise = y => Math.min(1, Math.max(0, y / ROOF));

  /* -- Frame ------------------------------------------------------------- */
  for (let k = 0; k < STOREYS; k++) {
    const y0 = level(k), y1 = level(k + 1), h = y1 - y0;
    for (let i = 0; i <= NX; i++) {
      for (let j = 0; j <= NZ; j++) {
        const x = -HX + i * BAY, z = -HZ + j * BAY;
        if (x === 0 && Math.abs(z) < BAY) continue;          /* these land in the core walls */
        add({ p: [x, y0 + h / 2, z], s: [0.5, h, 0.5], c: C.steel, dB: rise(y0) });
      }
    }
    /* Chevron-free X bracing in the middle bay of both end frames. */
    for (const x of [-HX, HX]) {
      const len = Math.hypot(BAY, h), ang = Math.atan2(h, BAY);
      for (const sgn of [-1, 1]) {
        add({ p: [x, y0 + h / 2, 0], s: [0.2, 0.2, len], r: [sgn * ang, 0, 0], c: C.steel, dB: rise(y0) + 0.03 });
      }
    }
  }
  for (let k = 1; k <= STOREYS; k++) {
    const y = level(k), dB = rise(y - 1.5);
    const yBeam = y - 0.22 - 0.275;
    for (let j = 0; j <= NZ; j++) {
      for (let i = 0; i < NX; i++) {
        add({ p: [-HX + (i + 0.5) * BAY, yBeam, -HZ + j * BAY], s: [BAY - 0.5, 0.55, 0.28], c: C.steel, dB });
      }
    }
    for (let i = 0; i <= NX; i++) {
      for (let j = 0; j < NZ; j++) {
        const x = -HX + i * BAY;
        if (x === 0 && j === 1) continue;
        add({ p: [x, yBeam, -HZ + (j + 0.5) * BAY], s: [0.28, 0.55, BAY - 0.5], c: C.steel, dB });
      }
    }
    add({ p: [0, y - 0.11, 0], s: [2 * HX + 0.6, 0.22, 2 * HZ + 0.6], c: C.slab, kind: KIND.concrete, dB: dB + 0.02 });

    /* Cantilevered balcony slabs on the front: the same concrete as the floor,
       carried straight through the wall. That continuity is the thermal bridge. */
    if (k >= 2 && k <= STOREYS - 1) {
      add({ p: [0, y - 0.11, HZ + 1.3], s: [2 * BAY, 0.22, 2.0], c: C.slab, kind: KIND.balcony, dB: dB + 0.04, h0: 0.97, h1: 0.36 });
      /* A top rail only: a solid guard would hide the slab it stands on. */
      add({
        p: [0, y + 1.05, HZ + 2.26], s: [2 * BAY, 0.07, 0.07], c: C.mullion, kind: KIND.mullion, group: GROUP.envelope,
        dE: 0.25 + 0.6 * rise(y), ex: [0, 1.5, 9], h0: 0.24, h1: 0.2
      });
    }
  }
  /* Concrete core, basement to roof overrun. */
  const coreH = ROOF + 0.3 + 4;
  for (const sgn of [-1, 1]) {
    add({ p: [sgn * 3.6, coreH / 2 - 4, 0], s: [0.4, coreH, BAY + 0.4], c: C.core, kind: KIND.concrete, dB: 0.05 });
    add({ p: [0, coreH / 2 - 4, sgn * 3.6], s: [BAY - 0.4, coreH, 0.4], c: C.core, kind: KIND.concrete, dB: 0.05 });
  }

  /* -- Below grade -------------------------------------------------------- */
  add({ p: [0, -4.25, 0], s: [2 * HX + 1.4, 0.5, 2 * HZ + 1.4], c: C.raft, kind: KIND.below, group: GROUP.below, dB: 0.1, h0: 0.08, h1: 0.08 });
  let n = 0;
  for (let i = 0; i <= NX; i++) {
    for (let j = 0; j <= NZ; j++) {
      const x = -HX + i * BAY, z = -HZ + j * BAY, d = (n++) / 20;
      add({ p: [x, -2, z], s: [0.6, 4, 0.6], c: C.raft, kind: KIND.below, group: GROUP.below, dB: 0.05 + 0.25 * d, h0: 0.08, h1: 0.08 });
      add({ p: [x, -5.0, z], s: [2.4, 1.0, 2.4], c: C.raft, kind: KIND.below, group: GROUP.below, dB: 0.2 + 0.3 * d, h0: 0.08, h1: 0.08 });
      add({ p: [x, -11.8, z], s: [1.1, 12.6, 1.1], c: C.caisson, kind: KIND.below, group: GROUP.below, cyl: true, dB: 0.35 + 0.6 * d, h0: 0.08, h1: 0.08 });
    }
  }
  /* Support of excavation: soldier piles and timber lagging around the pit. */
  const SX = HX + 3, SZ = HZ + 3;
  const sides = [
    { a: [-SX, SZ], b: [SX, SZ], nrm: [0, 1] }, { a: [SX, SZ], b: [SX, -SZ], nrm: [1, 0] },
    { a: [SX, -SZ], b: [-SX, -SZ], nrm: [0, -1] }, { a: [-SX, -SZ], b: [-SX, SZ], nrm: [-1, 0] }
  ];
  sides.forEach((side, si) => {
    const len = Math.hypot(side.b[0] - side.a[0], side.b[1] - side.a[1]);
    const count = Math.round(len / 2.4), step = len / count;
    const alongX = side.nrm[0] === 0;
    for (let i = 0; i < count; i++) {
      const t0 = i / count, tm = (i + 0.5) / count;
      const px = side.a[0] + (side.b[0] - side.a[0]) * t0, pz = side.a[1] + (side.b[1] - side.a[1]) * t0;
      const mx = side.a[0] + (side.b[0] - side.a[0]) * tm, mz = side.a[1] + (side.b[1] - side.a[1]) * tm;
      const d = (si + t0) / 4;
      add({ p: [px, -4.6, pz], s: [0.32, 10, 0.32], c: C.pile, kind: KIND.below, group: GROUP.below, dB: 0.45 * d, h0: 0.08, h1: 0.08 });
      add({
        p: [mx, -2.3, mz], s: alongX ? [step - 0.32, 4.4, 0.1] : [0.1, 4.4, step - 0.32],
        c: C.lagging, kind: KIND.below, group: GROUP.below, dB: 0.3 + 0.45 * d, h0: 0.08, h1: 0.08
      });
    }
    const cx = (side.a[0] + side.b[0]) / 2 - side.nrm[0] * 0.3, cz = (side.a[1] + side.b[1]) / 2 - side.nrm[1] * 0.3;
    add({
      p: [cx, -1.6, cz], s: alongX ? [len, 0.3, 0.3] : [0.3, 0.3, len],
      c: C.pile, kind: KIND.below, group: GROUP.below, dB: 0.75, h0: 0.08, h1: 0.08
    });
  });

  /* -- Envelope ----------------------------------------------------------- */
  const faces = [
    { nrm: [0, 0, 1], units: NX * 3, along: 'x', half: HX, off: HZ + FACADE },
    { nrm: [0, 0, -1], units: NX * 3, along: 'x', half: HX, off: -(HZ + FACADE) },
    { nrm: [1, 0, 0], units: NZ * 3, along: 'z', half: HZ, off: HX + FACADE },
    { nrm: [-1, 0, 0], units: NZ * 3, along: 'z', half: HZ, off: -(HX + FACADE) }
  ];
  const UNIT = BAY / 3;
  faces.forEach((f, fi) => {
    const place = (u, y, depth) => (f.along === 'x'
      ? [-f.half + u, y, f.off + Math.sign(f.off) * depth]
      : [f.off + Math.sign(f.off) * depth, y, -f.half + u]);
    const size = (w, h, t) => (f.along === 'x' ? [w, h, t] : [t, h, w]);
    const burst = () => {
      const d = 10 + 9 * rnd();
      return [f.nrm[0] * d, 1 + 4 * rnd(), f.nrm[2] * d];
    };
    for (let k = 0; k < STOREYS; k++) {
      const y0 = level(k), y1 = level(k + 1);
      const gBot = k === 0 ? 0.15 : y0 + 0.35, gTop = y1 - 0.75;
      for (let i = 0; i < f.units; i++) {
        const u = (i + 0.5) * UNIT;
        const dE = 0.08 * fi + 0.62 * (k / STOREYS) + 0.22 * (i / f.units) + 0.06 * rnd();
        add({
          p: place(u, (gBot + gTop) / 2, 0), s: size(UNIT - 0.09, gTop - gBot, 0.07), c: C.glass,
          kind: KIND.glass, group: GROUP.envelope, glass: true, dE, ex: burst(),
          h0: k === 0 ? 0.62 : 0.54, h1: 0.4
        });
        add({
          p: place(u, y1 - 0.2, 0.01), s: size(UNIT - 0.09, 1.1, 0.12), c: C.spandrel,
          kind: KIND.spandrel, group: GROUP.envelope, dE: dE + 0.03, ex: burst(), h0: 0.86, h1: 0.3
        });
      }
    }
    for (let i = 0; i <= f.units; i++) {
      add({
        p: place(i * UNIT, (ROOF + 0.35) / 2, 0.05), s: size(0.09, ROOF + 0.35, 0.2), c: C.mullion,
        kind: KIND.mullion, group: GROUP.envelope, dE: 0.1 * fi + 0.5 * (i / f.units), ex: burst(), h0: 0.7, h1: 0.5
      });
    }
    /* Parapet on top of the wall. */
    const run = 2 * f.half + 2 * FACADE + 0.3;
    add({
      p: place(f.half, ROOF + 0.9, 0), s: size(run, 1.1, 0.3), c: C.spandrel,
      kind: KIND.roof, group: GROUP.envelope, dE: 0.9, ex: [f.nrm[0] * 8, 7, f.nrm[2] * 8], h0: 0.88, h1: 0.3
    });
  });
  /* Corner posts close the gap where two wall planes meet. */
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      add({
        p: [sx * (HX + FACADE - 0.06), (ROOF + 0.35) / 2, sz * (HZ + FACADE - 0.06)], s: [0.5, ROOF + 0.35, 0.5],
        c: C.mullion, kind: KIND.mullion, group: GROUP.envelope, dE: 0.5, ex: [sx * 9, 3, sz * 9], h0: 0.72, h1: 0.5
      });
    }
  }
  add({
    p: [0, ROOF + 0.2, 0], s: [2 * HX + 0.9, 0.3, 2 * HZ + 0.9], c: C.roof, kind: KIND.roof,
    group: GROUP.envelope, dE: 0.84, ex: [0, 12, 0], h0: 0.42, h1: 0.2
  });
  add({
    p: [0, ROOF + 0.35 + 1.7, 0], s: [10, 3.4, 9], c: C.plant, kind: KIND.roof,
    group: GROUP.envelope, dE: 0.95, ex: [0, 16, 0], h0: 0.5, h1: 0.34
  });
  for (const z of [-5.2, -1.6]) {
    add({
      p: [-9.6, ROOF + 0.35 + 0.8, z], s: [2.6, 1.6, 1.8], c: C.roof, kind: KIND.roof,
      group: GROUP.envelope, dE: 0.97, ex: [0, 14, 0], h0: 0.66, h1: 0.6
    });
  }
  return items;
}

/* -------------------------------------------------------------- shaders -- */

const VERT = /* glsl */`
attribute vec3 aColor;
attribute vec4 aAnim;      /* build delay, envelope delay, group, random */
attribute vec3 aExplode;
attribute vec3 aHeat;      /* as-built heat, retrofit heat, kind */

uniform float uBuild, uEnvelope, uFound, uSway, uHeight;

varying vec3 vColor, vNormal, vWorld, vLocal, vMin, vMax, vHeat;
varying float vRand;

float easeOut(float t) { float u = 1.0 - t; return 1.0 - u * u * u; }

void main() {
  float group = aAnim.z;
  vec3 p = position;
  vec3 offset = vec3(0.0);
  vec3 sc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
  vec3 lo = -0.5 * sc, hi = 0.5 * sc;

  if (group < 0.5) {
    float b = smoothstep(aAnim.x * 0.72, aAnim.x * 0.72 + 0.28, uBuild);
    offset.y = (1.0 - easeOut(b)) * 6.0;
    p *= b; lo *= b; hi *= b;
  } else if (group < 1.5) {
    float e = smoothstep(aAnim.y * 0.55, aAnim.y * 0.55 + 0.45, uEnvelope);
    offset = aExplode * (1.0 - easeOut(e));
    float s = smoothstep(0.0, 0.45, e);
    p *= s; lo *= s; hi *= s;
  } else {
    /* Below-grade work grows downward from its own top edge. */
    float f = smoothstep(aAnim.x * 0.6, aAnim.x * 0.6 + 0.4, uFound);
    float w = smoothstep(0.0, 0.06, f);
    p.y = (p.y - 0.5) * f + 0.5;
    p.xz *= w;
    lo = vec3(-0.5 * w * sc.x, (0.5 - f) * sc.y, -0.5 * w * sc.z);
    hi = vec3(0.5 * w * sc.x, 0.5 * sc.y, 0.5 * w * sc.z);
  }

  vec4 world = modelMatrix * instanceMatrix * vec4(p, 1.0);
  world.xyz += offset;
  /* Lateral drift: zero at grade, growing faster than linearly with height. */
  world.x += uSway * pow(clamp(world.y / uHeight, 0.0, 1.3), 1.6);

  vWorld = world.xyz;
  vLocal = p * sc; vMin = lo; vMax = hi;
  vNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  vColor = aColor; vHeat = aHeat; vRand = aAnim.w;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

const FRAG = /* glsl */`
uniform vec3 uLight, uBg, uSky, uData;
uniform float uThermal, uRetrofit, uDissolve, uHeight, uFogNear, uFogFar;

varying vec3 vColor, vNormal, vWorld, vLocal, vMin, vMax, vHeat;
varying float vRand;

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

/* The palette of an infrared camera: indigo for cold, through magenta, to yellow. */
vec3 ironbow(float t) {
  t = clamp(t, 0.0, 1.0);
  vec3 c0 = vec3(0.070, 0.050, 0.280), c1 = vec3(0.420, 0.100, 0.560), c2 = vec3(0.860, 0.220, 0.450);
  vec3 c3 = vec3(0.980, 0.550, 0.160), c4 = vec3(1.000, 0.900, 0.450);
  if (t < 0.25) return mix(c0, c1, t * 4.0);
  if (t < 0.5) return mix(c1, c2, (t - 0.25) * 4.0);
  if (t < 0.75) return mix(c2, c3, (t - 0.5) * 4.0);
  return mix(c3, c4, (t - 0.75) * 4.0);
}

void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(cameraPosition - vWorld);
  float kind = vHeat.z;

  float key = max(dot(n, uLight), 0.0);
  float shade = 0.5 + 0.42 * key + 0.16 * (n.y * 0.5 + 0.5);
  shade *= mix(0.86, 1.0, smoothstep(0.0, 7.0, vWorld.y));
  vec3 col = vColor * shade;
  float alpha = 1.0;

  #ifdef GLASS
    float fres = pow(1.0 - abs(dot(n, v)), 2.5);
    col = mix(vColor * 0.92, uSky, 0.22 + 0.62 * fres);
    alpha = mix(0.4, 0.92, fres);
  #endif

  /* Outline every box: distance to the nearest edge of the face being shaded. */
  float edge = 0.0;
  #ifndef NO_EDGE
    vec3 d3 = min(vLocal - vMin, vMax - vLocal);
    float e2 = max(min(d3.x, d3.y), min(max(d3.x, d3.y), d3.z));
    float fw = fwidth(e2);
    float lw = max(0.03, fw * 0.7);
    edge = 1.0 - smoothstep(lw, lw + fw * 1.3, e2);
  #endif
  col = mix(col, col * 0.52, edge * 0.85);
  #ifdef GLASS
    alpha = max(alpha, edge * 0.9);
  #endif

  /* Thermogram, swept up the building from grade. */
  if (uThermal > 0.001) {
    float heat = mix(vHeat.x, vHeat.y, uRetrofit);
    if (kind > 5.5 && kind < 6.5) {
      float t = clamp((vLocal.z - vMin.z) / max(vMax.z - vMin.z, 0.001), 0.0, 1.0);
      heat *= mix(1.0, 0.5, t);                       /* hot at the wall, cooler at the tip */
    }
    if (kind > 3.5 && kind < 4.5) {
      float t = abs(vLocal.y) / max(vMax.y, 0.001);
      heat -= 0.2 * t * t;                            /* the slab line itself is the hot spot */
    }
    heat += (vRand - 0.5) * 0.07 + 0.035 * (vWorld.y / uHeight);
    vec3 tcol = ironbow(heat) * (0.84 + 0.16 * shade);
    tcol = mix(tcol, tcol * 0.7, edge * 0.55);
    float front = mix(-26.0, uHeight + 16.0, uThermal);
    float tm = smoothstep(0.0, 3.5, front - vWorld.y);
    float sweep = exp(-abs(vWorld.y - front) * 1.1) * step(uThermal, 0.995);
    col = mix(col, tcol, tm) + vec3(1.0, 0.82, 0.55) * sweep * 0.55;
    alpha = mix(alpha, 1.0, tm);
  }

  /* Dissolve to data: the fill breaks up cell by cell, the outlines stay. */
  if (uDissolve > 0.001) {
    float cell = hash13(floor(vWorld * 1.6) + vRand * 23.0);
    float gone = step(cell, uDissolve * 1.04);
    float wire = edge * step(vRand, mix(1.0, 0.58, uDissolve));
    float keep = max(wire, 1.0 - gone);
    col = mix(col, uData * (0.42 + 0.58 * wire), uDissolve * mix(0.55, 1.0, wire));
    alpha = mix(alpha, 1.0, uDissolve) * keep;
  }
  if (alpha < 0.02) discard;

  float fog = smoothstep(uFogNear, uFogFar, length(cameraPosition - vWorld));
  col = mix(col, uBg, fog * 0.6);
  gl_FragColor = vec4(col, alpha);
}`;

const GROUND_VERT = /* glsl */`
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const GROUND_FRAG = /* glsl */`
uniform vec3 uBg, uLine;
uniform float uAlpha, uShadow, uBay;
uniform vec2 uFoot;
varying vec3 vWorld;
void main() {
  vec2 p = vWorld.xz;
  float fade = 1.0 - smoothstep(55.0, 150.0, length(p));
  vec2 q = abs(p - vec2(-2.5, -1.5)) - uFoot;
  float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
  float shadow = exp(-max(sd, 0.0) / 6.0) * uShadow;
  vec2 g = p / uBay - 0.5;
  vec2 gd = abs(fract(g) - 0.5) / fwidth(g);
  float line = (1.0 - min(min(gd.x, gd.y), 1.0)) * fade;
  vec3 col = mix(uBg * (1.0 - shadow), uLine, line * 0.55);
  float a = mix(max(uAlpha, line * 0.6), 1.0, 1.0 - fade);
  gl_FragColor = vec4(col, a);
}`;

const POINT_VERT = /* glsl */`
attribute vec2 aSeed;      /* random, tint */
uniform float uDissolve, uTime, uSize, uPixel;
varying float vAlpha, vTint;
void main() {
  float appear = smoothstep(aSeed.x * 0.65, aSeed.x * 0.65 + 0.35, uDissolve);
  vec4 mv = viewMatrix * modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float twinkle = 0.62 + 0.38 * sin(uTime * 1.7 + aSeed.x * 41.0);
  gl_PointSize = uSize * uPixel * (0.6 + 0.9 * aSeed.x) * appear * 90.0 / -mv.z;
  vAlpha = appear * twinkle;
  vTint = aSeed.y;
}`;

const POINT_FRAG = /* glsl */`
uniform vec3 uData, uSignal;
varying float vAlpha, vTint;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = smoothstep(0.5, 0.12, d) * vAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(mix(uData, uSignal, step(0.93, vTint)), a);
}`;

const PIN_VERT = /* glsl */`
attribute float aIndex;
uniform float uDissolve, uActive, uSize, uPixel;
varying float vOn;
void main() {
  vec4 mv = viewMatrix * modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  vOn = 1.0 - step(0.5, abs(aIndex - uActive));
  gl_PointSize = uSize * uPixel * mix(1.0, 3.4, vOn) * uDissolve * 90.0 / -mv.z;
}`;

const PIN_FRAG = /* glsl */`
uniform vec3 uData, uSignal;
uniform float uTime, uDissolve;
varying float vOn;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  float dot_ = smoothstep(mix(0.5, 0.26, vOn), mix(0.36, 0.18, vOn), d);
  float ring = smoothstep(0.08, 0.0, abs(d - mix(0.82, 0.5, vOn)));
  float pulse = fract(uTime * 0.55);
  float wave = smoothstep(0.07, 0.0, abs(d - mix(0.3, 0.98, pulse))) * (1.0 - pulse) * vOn;
  float a = (dot_ + ring * mix(0.55, 0.9, vOn) + wave) * uDissolve;
  if (a < 0.01) discard;
  gl_FragColor = vec4(mix(uData, uSignal, vOn), a);
}`;

/* ---------------------------------------------------------------- scene -- */

const DEG = Math.PI / 180;

/* The drawing buffer has an alpha channel whether it is asked for or not, and
   the browser composites it. Blended passes leave that channel alone so the
   canvas stays opaque. */
const OVER = {
  transparent: true, blending: THREE.CustomBlending,
  blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor
};
const ADD = Object.assign({}, OVER, { blendDst: THREE.OneFactor });

export class BuildingScene {
  constructor(canvas, { reducedMotion = false } = {}) {
    this.canvas = canvas;
    this.reducedMotion = reducedMotion;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 1, 600);
    this.width = 1; this.height = 1;

    /* Everything the page can steer. cur chases tgt; see frame(). */
    this.cur = {
      envelope: 0, found: 0, thermal: 0, retrofit: 0, dissolve: 0, sway: 0, groundAlpha: 1, shadow: 0.2,
      az: 38, el: 9, dist: 92, ty: 16, shiftX: 0, shiftY: 0, pAz: 0, pEl: 0,
      bgR: 0.89, bgG: 0.898, bgB: 0.886, lnR: 0.6, lnG: 0.62, lnB: 0.61
    };
    this.tgt = Object.assign({}, this.cur, { envelope: 1 });
    this.rate = { retrofit: 5, sway: 14, pAz: 3, pEl: 3 };
    this.build = reducedMotion ? 1 : 0;
    this.clock = 0;
    this.activePin = 0;
    this.fit = 1.06;        /* stage aspect below which the camera backs off */

    const shared = {
      uBuild: { value: this.build }, uEnvelope: { value: 0 }, uFound: { value: 0 }, uSway: { value: 0 },
      uThermal: { value: 0 }, uRetrofit: { value: 0 }, uDissolve: { value: 0 },
      uHeight: { value: ROOF }, uTime: { value: 0 },
      uLight: { value: new THREE.Vector3(0.8, 0.6, 0.25).normalize() },
      uBg: { value: new THREE.Color('#e3e5e2') }, uSky: { value: new THREE.Color('#f2f5f6') },
      uData: { value: new THREE.Color('#a9e4ff') }, uSignal: { value: new THREE.Color('#ffc861') },
      uLine: { value: new THREE.Color('#9aa09d') },
      uFogNear: { value: 70 }, uFogFar: { value: 260 },
      uPixel: { value: 1 }
    };
    this.uniforms = shared;

    const items = buildModel();
    const solid = new THREE.ShaderMaterial({ uniforms: shared, vertexShader: VERT, fragmentShader: FRAG, alphaToCoverage: true });
    const round = new THREE.ShaderMaterial({ uniforms: shared, vertexShader: VERT, fragmentShader: FRAG, defines: { NO_EDGE: 1 } });
    const glass = new THREE.ShaderMaterial(Object.assign({
      uniforms: shared, vertexShader: VERT, fragmentShader: FRAG, defines: { GLASS: 1 }
    }, OVER));

    const boxes = items.filter(i => !i.glass && !i.cyl);
    const panes = items.filter(i => i.glass);
    const piles = items.filter(i => i.cyl);
    this.scene.add(this.instances(boxes, new THREE.BoxGeometry(1, 1, 1), solid, 0));
    this.scene.add(this.instances(piles, new THREE.CylinderGeometry(0.5, 0.5, 1, 20), round, 0));
    this.scene.add(this.ground());
    this.scene.add(this.instances(panes, new THREE.BoxGeometry(1, 1, 1), glass, 2));
    this.scene.add(this.cloud(items));
    this.scene.add(this.pinLayer());

    /* Places the page hangs labels on. */
    this.anchors = {
      brace: new THREE.Vector3(-HX, level(6) + 1.9, 0),
      core: new THREE.Vector3(0, ROOF + 0.3, 3.6),
      caisson: new THREE.Vector3(HX, -12, HZ),
      shoring: new THREE.Vector3(-SXZ[0], -2.4, SXZ[1]),
      slab: new THREE.Vector3(HX + FACADE, level(6), 6),
      balcony: new THREE.Vector3(5.5, level(4), HZ + 2.3),
      parapet: new THREE.Vector3(-7, ROOF + 1.4, HZ + FACADE)
    };
    this.tmp = new THREE.Vector3();
  }

  instances(items, geometry, material, order) {
    const n = items.length;
    const mesh = new THREE.InstancedMesh(geometry, material, n);
    const aColor = new Float32Array(n * 3), aAnim = new Float32Array(n * 4);
    const aExplode = new Float32Array(n * 3), aHeat = new Float32Array(n * 3);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    const p = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
    items.forEach((it, i) => {
      p.fromArray(it.p); s.fromArray(it.s);
      if (it.r) q.setFromEuler(e.set(it.r[0], it.r[1], it.r[2])); else q.identity();
      mesh.setMatrixAt(i, m.compose(p, q, s));
      c.set(it.c).toArray(aColor, i * 3);
      aAnim.set([Math.min(1, it.dB), Math.min(1, it.dE), it.group, it.rand], i * 4);
      aExplode.set(it.ex, i * 3);
      aHeat.set([it.h0, it.h1, it.kind], i * 3);
    });
    geometry.setAttribute('aColor', new THREE.InstancedBufferAttribute(aColor, 3));
    geometry.setAttribute('aAnim', new THREE.InstancedBufferAttribute(aAnim, 4));
    geometry.setAttribute('aExplode', new THREE.InstancedBufferAttribute(aExplode, 3));
    geometry.setAttribute('aHeat', new THREE.InstancedBufferAttribute(aHeat, 3));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;       /* the shader moves instances; the CPU bounds are wrong */
    mesh.renderOrder = order;
    return mesh;
  }

  ground() {
    const u = this.uniforms;
    this.groundUniforms = {
      uBg: u.uBg, uLine: u.uLine, uAlpha: { value: 1 }, uShadow: { value: 0.2 },
      uBay: { value: BAY }, uFoot: { value: new THREE.Vector2(HX + 1.5, HZ + 1.5) }
    };
    const mat = new THREE.ShaderMaterial(Object.assign({
      uniforms: this.groundUniforms, vertexShader: GROUND_VERT, fragmentShader: GROUND_FRAG, depthWrite: false
    }, OVER));
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 1;
    return mesh;
  }

  /* A survey of the same building: points scattered through every element, and
     scan rings on the ground around it. */
  cloud(items) {
    const rnd = mulberry(77);
    const pos = [], seed = [];
    const push = (x, y, z) => { pos.push(x, y, z); seed.push(rnd(), rnd()); };
    const density = { [KIND.glass]: 6, [KIND.spandrel]: 4, [KIND.steel]: 5, [KIND.balcony]: 50, [KIND.roof]: 60 };
    const e = new THREE.Euler(), v = new THREE.Vector3();
    for (const it of items) {
      if (it.group === GROUP.below || it.kind === KIND.mullion) continue;
      let n = density[it.kind] || 0;
      if (it.kind === KIND.concrete) n = it.s[1] < 1 ? 340 : 150;
      for (let i = 0; i < n; i++) {
        v.set((rnd() - 0.5) * it.s[0], (rnd() - 0.5) * it.s[1], (rnd() - 0.5) * it.s[2]);
        if (it.r) v.applyEuler(e.set(it.r[0], it.r[1], it.r[2]));
        push(it.p[0] + v.x, it.p[1] + v.y, it.p[2] + v.z);
      }
    }
    for (let r = 24; r <= 78; r += 6) {
      const n = Math.round((2 * Math.PI * r) / 1.5);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rnd() * 0.01;
        push(Math.cos(a) * (r + rnd() * 0.5), 0.05, Math.sin(a) * (r + rnd() * 0.5));
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 2));
    const u = this.uniforms;
    const mat = new THREE.ShaderMaterial(Object.assign({
      uniforms: { uDissolve: u.uDissolve, uTime: u.uTime, uData: u.uData, uSignal: u.uSignal, uPixel: u.uPixel, uSize: { value: 1.5 } },
      vertexShader: POINT_VERT, fragmentShader: POINT_FRAG, depthWrite: false
    }, ADD));
    const pts = new THREE.Points(g, mat);
    pts.frustumCulled = false;
    pts.renderOrder = 3;
    return pts;
  }

  /* Where photographs were taken. The first four are the sample records the
     search demonstration returns; the rest are the unqueried remainder. */
  pinLayer() {
    const rnd = mulberry(5);
    this.pins = [
      new THREE.Vector3(2.4, ROOF + 1.5, -(HZ + FACADE)),          /* north parapet */
      new THREE.Vector3(-9.6, level(2) + 1.6, -3.4),               /* level 03 mechanical room */
      new THREE.Vector3(HX - 0.6, ROOF + 1.5, -(HZ + FACADE)),     /* north-east corner */
      new THREE.Vector3(-8.4, ROOF + 0.6, 5.2)                     /* roof hatch */
    ];
    for (let i = 0; i < 26; i++) {
      const k = 1 + Math.floor(rnd() * (STOREYS - 1));
      const onX = rnd() < 0.5, side = rnd() < 0.5 ? -1 : 1;
      this.pins.push(onX
        ? new THREE.Vector3((rnd() - 0.5) * 2 * HX, level(k) + 1.5, side * (HZ - 1 - rnd() * 4))
        : new THREE.Vector3(side * (HX - 1 - rnd() * 4), level(k) + 1.5, (rnd() - 0.5) * 2 * HZ));
    }
    const pos = [], idx = [];
    this.pins.forEach((p, i) => { pos.push(p.x, p.y, p.z); idx.push(i); });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aIndex', new THREE.Float32BufferAttribute(idx, 1));
    const u = this.uniforms;
    this.pinUniforms = {
      uDissolve: u.uDissolve, uTime: u.uTime, uData: u.uData, uSignal: u.uSignal, uPixel: u.uPixel,
      uActive: { value: 0 }, uSize: { value: 7 }
    };
    const mat = new THREE.ShaderMaterial(Object.assign({
      uniforms: this.pinUniforms, vertexShader: PIN_VERT, fragmentShader: PIN_FRAG, depthWrite: false, depthTest: false
    }, ADD));
    const pts = new THREE.Points(g, mat);
    pts.frustumCulled = false;
    pts.renderOrder = 4;
    return pts;
  }

  /* -- Steering ----------------------------------------------------------- */

  set(values) { Object.assign(this.tgt, values); }

  /* Land on the targets immediately: first frame, and reduced motion. */
  settle() { Object.assign(this.cur, this.tgt); }

  setActivePin(i) { this.activePin = i; this.pinUniforms.uActive.value = i; }

  resize(width, height, pixelRatio) {
    this.width = Math.max(1, width); this.height = Math.max(1, height);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(this.width, this.height, false);
    this.uniforms.uPixel.value = pixelRatio * Math.min(1.25, Math.max(0.7, this.height / 800));
    this.camera.aspect = this.width / this.height;
  }

  /* Screen position of a world point, in CSS pixels of the canvas. */
  project(point) {
    const v = this.tmp.copy(point).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * this.width, y: (-v.y * 0.5 + 0.5) * this.height, visible: v.z < 1 };
  }

  frame(dt) {
    const c = this.cur, t = this.tgt, u = this.uniforms;
    this.clock += dt;

    /* One orchestrated moment on load: the frame goes up, then the cladding. */
    /* Timed against the wall clock, so a slow device gets the same 1.5 seconds. */
    if (this.build < 1) {
      const now = performance.now();
      if (!this.buildStart) this.buildStart = now;
      this.build = Math.min(1, (now - this.buildStart) / 1500);
    }
    const holdEnvelope = this.build < 0.6;

    for (const k in c) {
      if (k === 'envelope' && holdEnvelope) continue;
      const rate = this.rate[k] || 7;
      c[k] += (t[k] - c[k]) * (1 - Math.exp(-dt * rate));
    }

    u.uBuild.value = this.build * this.build * (3 - 2 * this.build);
    u.uEnvelope.value = c.envelope; u.uFound.value = c.found; u.uSway.value = c.sway;
    u.uThermal.value = c.thermal; u.uRetrofit.value = c.retrofit; u.uDissolve.value = c.dissolve;
    u.uTime.value = this.reducedMotion ? 0 : this.clock;
    u.uBg.value.setRGB(c.bgR, c.bgG, c.bgB);
    u.uLine.value.setRGB(c.lnR, c.lnG, c.lnB);
    u.uSky.value.setRGB(Math.min(1, c.bgR + 0.08), Math.min(1, c.bgG + 0.08), Math.min(1, c.bgB + 0.09));
    this.groundUniforms.uAlpha.value = c.groundAlpha;
    this.groundUniforms.uShadow.value = c.shadow;
    this.renderer.setClearColor(u.uBg.value, 1);

    /* A narrow stage needs the camera further back to keep the building whole. */
    const aspect = this.width / this.height;
    const dist = c.dist * Math.max(1, this.fit / aspect);
    const drift = this.reducedMotion ? 0 : Math.sin(this.clock * 0.38) * (2.2 + 7 * c.dissolve);
    const az = (c.az + c.pAz + drift) * DEG, el = (c.el + c.pEl) * DEG;
    const cam = this.camera;
    cam.position.set(
      dist * Math.cos(el) * Math.sin(az),
      c.ty + dist * Math.sin(el),
      dist * Math.cos(el) * Math.cos(az)
    );
    cam.lookAt(0, c.ty, 0);
    cam.setViewOffset(this.width, this.height, -c.shiftX * this.width, -c.shiftY * this.height, this.width, this.height);
    cam.updateMatrixWorld();

    this.renderer.render(this.scene, cam);
  }

  dispose() { this.renderer.dispose(); }
}

const SXZ = [HX + 3, HZ + 3];
export const MODEL = { ROOF, HX, HZ, level };
