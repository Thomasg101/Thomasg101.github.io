import * as THREE from './vendor/three.module.min.js';

const FLOORS = 12, FH = 3.4, BAY = 6, NX = 4, NZ = 2;
const W = NX * BAY, D = NZ * BAY;
const c01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;
const easeIO = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const rnd = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(20260811);

/* ---------------- geometry helpers ---------------- */

function box(w, h, d, anchorBottom) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (anchorBottom) g.translate(0, h / 2, 0);
  return g;
}
function cyl(rt, rb, h, seg, anchorBottom) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg || 10);
  if (anchorBottom) g.translate(0, h / 2, 0);
  return g;
}

const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
function place(geo, x, y, z, rx, ry, rz, col) {
  const m = new THREE.Matrix4();
  _e.set(rx || 0, ry || 0, rz || 0);
  _q.setFromEuler(_e); _p.set(x || 0, y || 0, z || 0); _s.set(1, 1, 1);
  m.compose(_p, _q, _s);
  return { geo, matrix: m, col };
}

const _c = new THREE.Color();
function mergeGeos(entries) {
  let n = 0;
  const gs = entries.map(en => {
    let g = en.geo.index ? en.geo.toNonIndexed() : en.geo.clone();
    if (en.matrix) g.applyMatrix4(en.matrix);
    if (!g.attributes.normal) g.computeVertexNormals();
    n += g.attributes.position.count;
    return { g, col: en.col, keep: en.col === undefined && !!g.attributes.color };
  });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3);
  let o = 0;
  gs.forEach(({ g, col: cHex, keep }) => {
    const cnt = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    if (keep) { col.set(g.attributes.color.array, o * 3); o += cnt; g.dispose(); return; }
    _c.set(cHex === undefined ? 0xffffff : cHex).convertSRGBToLinear();
    for (let i = 0; i < cnt; i++) { col[(o + i) * 3] = _c.r; col[(o + i) * 3 + 1] = _c.g; col[(o + i) * 3 + 2] = _c.b; }
    o += cnt;
    g.dispose();
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}

// rolled steel section, extruded along +Y with its base at y=0
function iBeam(len, h, flange, tw, tf) {
  const s = new THREE.Shape();
  const hw = flange / 2, hh = h / 2, w2 = tw / 2;
  s.moveTo(-hw, -hh); s.lineTo(hw, -hh); s.lineTo(hw, -hh + tf); s.lineTo(w2, -hh + tf);
  s.lineTo(w2, hh - tf); s.lineTo(hw, hh - tf); s.lineTo(hw, hh); s.lineTo(-hw, hh);
  s.lineTo(-hw, hh - tf); s.lineTo(-w2, hh - tf); s.lineTo(-w2, -hh + tf); s.lineTo(-hw, -hh + tf);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false, curveSegments: 1 });
  g.rotateX(-Math.PI / 2);
  g.rotateY(Math.PI / 2);
  return g; // extrudes along +Y, section in X/Z, base at y=0
}
function iBeamH(len, h, flange, tw, tf) { // horizontal, along X, centred
  const g = iBeam(len, h, flange, tw, tf);
  g.rotateZ(Math.PI / 2);
  g.translate(len / 2, 0, 0);
  return g;
}

// square lattice section (crane mast, boom bays)
function latticeY(size, h, r) {
  const parts = [], hs = size / 2;
  const chord = box(r, h, r, true);
  [[-hs, -hs], [hs, -hs], [hs, hs], [-hs, hs]].forEach(([x, z]) => parts.push(place(chord, x, 0, z)));
  const hx = box(size, r * 0.7, r * 0.7, false), hz = box(r * 0.7, r * 0.7, size, false);
  [0.02, h - 0.02].forEach(y => {
    parts.push(place(hx, 0, y, -hs)); parts.push(place(hx, 0, y, hs));
    parts.push(place(hz, -hs, y, 0)); parts.push(place(hz, hs, y, 0));
  });
  const dl = Math.hypot(size, h), a = Math.atan2(h, size);
  const dx = box(dl, r * 0.6, r * 0.6, false), dz = box(r * 0.6, r * 0.6, dl, false);
  parts.push(place(dx, 0, h / 2, -hs, 0, 0, a));
  parts.push(place(dx, 0, h / 2, hs, 0, 0, -a));
  parts.push(place(dz, -hs, h / 2, 0, a, 0, 0));
  parts.push(place(dz, hs, h / 2, 0, -a, 0, 0));
  return mergeGeos(parts);
}
// lattice truss bay running along +X
function latticeX(size, len, r) {
  const parts = [], hs = size / 2;
  const chord = box(len, r, r, false);
  [[-hs, -hs], [hs, -hs], [hs, hs], [-hs, hs]].forEach(([y, z]) => parts.push(place(chord, len / 2, y, z)));
  const vy = box(r * 0.7, size, r * 0.7, false), vz = box(r * 0.7, r * 0.7, size, false);
  [0.02, len - 0.02].forEach(x => {
    parts.push(place(vy, x, 0, -hs)); parts.push(place(vy, x, 0, hs));
    parts.push(place(vz, x, -hs, 0)); parts.push(place(vz, x, hs, 0));
  });
  const dl = Math.hypot(size, len), a = Math.atan2(size, len);
  const d = box(dl, r * 0.6, r * 0.6, false);
  parts.push(place(d, len / 2, 0, -hs, 0, 0, a));
  parts.push(place(d, len / 2, 0, hs, 0, 0, -a));
  parts.push(place(d, len / 2, -hs, 0, 0, -a, 0));
  parts.push(place(d, len / 2, hs, 0, 0, a, 0));
  return mergeGeos(parts);
}

/* ---------------- canvas textures ---------------- */

function tex(draw, size, rep, srgb) {
  const c = document.createElement('canvas');
  c.width = c.height = size || 128;
  draw(c.getContext('2d'), c.width);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (rep) t.repeat.set(rep[0], rep[1]);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const noise = (x, s, base, amt, dots) => {
  x.fillStyle = base; x.fillRect(0, 0, s, s);
  for (let i = 0; i < dots; i++) {
    const v = Math.floor(rnd() * amt * 2 - amt);
    x.fillStyle = 'rgba(' + (128 + v) + ',' + (128 + v) + ',' + (126 + v) + ',.5)';
    const r = 0.6 + rnd() * 2.4;
    x.fillRect(rnd() * s, rnd() * s, r, r);
  }
};
const concreteTex = () => tex((x, s) => {
  noise(x, s, '#b9b4a8', 26, 2600);
  x.globalAlpha = 0.13;
  for (let i = 0; i < 26; i++) {
    x.fillStyle = rnd() > 0.5 ? '#8f8a7e' : '#d6d1c4';
    x.beginPath(); x.ellipse(rnd() * s, rnd() * s, 4 + rnd() * 22, 3 + rnd() * 16, rnd() * 3, 0, 6.3); x.fill();
  }
  x.globalAlpha = 1;
}, 256, [1, 1], true);
const gravelTex = () => tex((x, s) => {
  noise(x, s, '#a89e88', 34, 5200);
  x.strokeStyle = 'rgba(90,80,64,.35)'; x.lineWidth = 3;
  for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(0, rnd() * s); x.bezierCurveTo(s * .3, rnd() * s, s * .7, rnd() * s, s, rnd() * s); x.stroke(); }
}, 256, [7, 7], true);
const soilTex = () => tex((x, s) => noise(x, s, '#9fa07f', 22, 3200), 128, [22, 22], true);
const asphaltTex = () => tex((x, s) => {
  noise(x, s, '#4e4d4c', 18, 4200);
}, 128, [1, 14], true);
const corrTex = () => tex((x, s) => {
  const g = x.createLinearGradient(0, 0, s, 0);
  for (let i = 0; i <= 16; i++) g.addColorStop(i / 16, i % 2 ? '#ffffff' : '#9c9c9c');
  x.fillStyle = g; x.fillRect(0, 0, s, s);
}, 64, [1, 1], true);
const meshTex = () => tex((x, s) => {
  x.clearRect(0, 0, s, s);
  x.strokeStyle = '#fff'; x.lineWidth = 1.4;
  for (let i = 0; i <= 8; i++) {
    const v = (i / 8) * s;
    x.beginPath(); x.moveTo(v, 0); x.lineTo(v, s); x.moveTo(0, v); x.lineTo(s, v); x.stroke();
  }
}, 64, [26, 7]);
const cloudTex = () => tex((x, s) => {
  x.clearRect(0, 0, s, s);
  for (let i = 0; i < 26; i++) {
    const cx = s * (0.2 + rnd() * 0.6), cy = s * (0.35 + rnd() * 0.3), r = s * (0.06 + rnd() * 0.14);
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, 'rgba(255,255,255,.62)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, 6.3); x.fill();
  }
}, 256);
const dustTex = () => tex((x, s) => {
  const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, s, s);
}, 64);
const facadeTex = () => tex((x, s) => { // faint floor plate / blind lines behind the glass
  x.fillStyle = '#0d1b33'; x.fillRect(0, 0, s, s);
  x.fillStyle = 'rgba(255,255,255,.10)';
  for (let i = 0; i < s; i += 8) x.fillRect(0, i, s, 3);
}, 64, [4, 1], true);

/* ---------------- sky ---------------- */

const SKY_VS = 'varying vec3 vW; void main(){ vW = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';
const SKY_FS = [
  'uniform vec3 top; uniform vec3 bot; uniform vec3 sunCol; uniform vec3 sunDir; varying vec3 vW;',
  'void main(){',
  ' float h = clamp(vW.y * 0.5 + 0.5, 0.0, 1.0);',
  ' vec3 c = mix(bot, top, pow(h, 0.9));',
  ' float sd = max(dot(normalize(vW), normalize(sunDir)), 0.0);',
  ' c += sunCol * pow(sd, 6.0) * 0.42 + sunCol * pow(sd, 320.0) * 3.0;',
  ' gl_FragColor = vec4(c, 1.0);',
  '}'
].join('\n');

class BuildingScene extends HTMLElement {
  connectedCallback() {
    if (this._on) return;
    this._on = true;
    this.style.cssText = 'display:block;width:100%;height:100%;overflow:hidden';
    this.p = 0;
    this.t0 = performance.now();
    this._first = true;
    this._fov = 38;
    this.guided = false; this.intro = false;
    this.focusY = null; this.shiftT = 0; this._shift = 0;
    this._theta = Math.PI / 2; this._cine = 0; this.tw = null;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this._build();
    this._resize();
    this.setTheme();
    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(this);
    this._tick = this._tick.bind(this);
    this._raf = requestAnimationFrame(this._tick);
  }

  disconnectedCallback() {
    cancelAnimationFrame(this._raf);
    if (this._ro) this._ro.disconnect();
    if (this.renderer) this.renderer.dispose();
    this._on = false;
  }

  setProgress(p) { this.p = c01(p); }

  /* ---- guided (click-through) mode API ---- */
  enterGuided() { this.guided = true; this.intro = true; }
  startBuild() { this.intro = false; }
  // clear the site back to the cinematic empty-lot view so the build can run again
  resetBuild() {
    this.tw = null;
    this.p = 0;
    this.intro = true;
    this.stakeN = 0;
    if (this.stakes) this.stakes.forEach(s => { s.visible = false; });
  }
  buildTo(p, dur) {
    p = c01(p);
    if (this.reduced) { this.p = p; this.tw = null; setTimeout(() => this.dispatchEvent(new CustomEvent('built')), 80); return; }
    this._spinFrom = this._theta;
    this.tw = { from: this.p, to: p, t0: performance.now(), dur: Math.max(300, (dur || 6) * 1000) };
  }
  focusLevel(y, shift) { this.focusY = (y == null ? null : y); this.shiftT = shift || 0; }
  project(x, y, z) {
    if (!this.cam) return null;
    if (!this._v3) this._v3 = new THREE.Vector3();
    const v = this._v3.set(x, y, z).project(this.cam);
    return { x: (v.x * 0.5 + 0.5) * this.clientWidth, y: (-v.y * 0.5 + 0.5) * this.clientHeight, front: v.z < 1 };
  }
  isBuilding() { return !!this.tw; }

  setTheme() {
    if (!this.scene) return;
    const cs = getComputedStyle(document.documentElement);
    const g = n => (cs.getPropertyValue(n) || '').trim();
    const bgc = new THREE.Color(g('--bg') || '#f4f2ed');
    const accent = g('--accent') || '#1544c8';
    const dark = bgc.getHSL({ h: 0, s: 0, l: 0 }).l < 0.5;
    this.dark = dark;

    const top = dark ? new THREE.Color('#0a1120') : bgc.clone().lerp(new THREE.Color('#8fb4e2'), 0.62);
    const bot = dark ? new THREE.Color('#1a2536') : bgc.clone().lerp(new THREE.Color('#ffffff'), 0.34);
    this.sky.material.uniforms.top.value.copy(top);
    this.sky.material.uniforms.bot.value.copy(bot);
    this.scene.fog = new THREE.Fog(bot, 130, 620);

    const m = this.m;
    m.soil.color.set(dark ? '#232a24' : '#7e8467');
    m.gravel.color.set(dark ? '#3a3a34' : '#b4ab95');
    m.road.color.set(dark ? '#23262b' : '#6d6d6c');
    m.concrete.color.set(dark ? '#5d6167' : '#c3bdb0');
    m.steel.color.set(dark ? '#5c646d' : '#98a0a8');
    m.galv.color.set(dark ? '#6a7079' : '#aeb4ba');
    m.glass.color.set(accent);
    m.glass.opacity = dark ? 0.5 : 0.34;
    m.glass.emissive.set(dark ? '#ffd9a0' : '#000000');
    m.glass.emissiveIntensity = dark ? 0.34 : 0;
    m.city.color.set(dark ? '#161c26' : '#b9b6ad');
    m.cityWin.emissiveIntensity = dark ? 1.1 : 0.05;
    m.lamp.emissiveIntensity = dark ? 2.4 : 0.15;
    m.clouds.forEach(c => { c.opacity = dark ? 0.18 : 0.5; });
    this.lampLights.forEach(l => { l.intensity = dark ? 7 : 0; });
    this.sky.material.uniforms.sunCol.value.set(dark ? '#5a6b8c' : '#ffe6bd');
    this._genEnv();
  }

  _genEnv() {
    if (!this.pmrem) this.pmrem = new THREE.PMREMGenerator(this.renderer);
    if (this._env) this._env.dispose();
    const s = new THREE.Scene();
    const sky = this.sky.clone();
    sky.material = this.sky.material;
    s.add(sky);
    this._env = this.pmrem.fromScene(s, 0, 1, 900).texture;
    this.scene.environment = this._env;
  }

  /* ============================ BUILD ============================ */

  _build() {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%';
    this.appendChild(canvas);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    this.renderer = renderer;

    const scene = new THREE.Scene();
    this.scene = scene;
    this.cam = new THREE.PerspectiveCamera(38, 1, 0.5, 1600);
    this.camPos = new THREE.Vector3(70, 12, 40);
    this.camAim = new THREE.Vector3(0, 4, 0);

    // ---------- sky + light ----------
    const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
      uniforms: {
        top: { value: new THREE.Color('#8fb4e2') }, bot: { value: new THREE.Color('#f2eee6') },
        sunCol: { value: new THREE.Color('#ffe6bd') }, sunDir: { value: new THREE.Vector3(0, 1, 0) }
      },
      vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false
    }));
    scene.add(sky);
    this.sky = sky;

    const hemi = new THREE.HemisphereLight(0xdcecff, 0x8a8270, 0.5);
    scene.add(hemi);
    this.hemi = hemi;

    const sun = new THREE.DirectionalLight(0xfff1de, 2.1);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1536, 1536);
    sun.shadow.bias = -0.0009;
    sun.shadow.normalBias = 0.035;
    const sc = sun.shadow.camera;
    sc.left = -70; sc.right = 70; sc.top = 84; sc.bottom = -40; sc.near = 20; sc.far = 300;
    scene.add(sun, sun.target);
    this.sun = sun;

    const fill = new THREE.DirectionalLight(0xbcd0ea, 0.25);
    fill.position.set(-60, 34, -46);
    scene.add(fill);

    /* ---------------- materials ---------------- */
    const S = (o) => new THREE.MeshStandardMaterial(o);
    const corr = corrTex();
    const conc = concreteTex();
    const m = this.m = {
      soil: S({ color: 0x9aa07d, map: soilTex(), roughness: 1 }),      gravel: S({ color: 0xb4ab95, map: gravelTex(), bumpMap: gravelTex(), bumpScale: 0.4, roughness: 1 }),
      road: S({ color: 0x6d6d6c, map: asphaltTex(), roughness: 0.95 }),
      concrete: S({ color: 0xc3bdb0, map: conc, bumpMap: conc, bumpScale: 0.12, roughness: 0.92 }),
      steel: S({ color: 0x98a0a8, roughness: 0.44, metalness: 0.82 }),
      galv: S({ color: 0xaeb4ba, roughness: 0.55, metalness: 0.7 }),
      deckPan: S({ color: 0x9ba3aa, map: corr, bumpMap: corr, bumpScale: 0.5, roughness: 0.5, metalness: 0.75 }),
      hoard: S({ color: 0xd8d4cb, map: corr, bumpMap: corr, bumpScale: 0.35, roughness: 0.75, metalness: 0.25, side: THREE.DoubleSide }),
      crane: S({ color: 0xcf6320, roughness: 0.52, metalness: 0.45 }),
      glass: S({ color: 0x1544c8, transparent: true, opacity: 0.34, roughness: 0.06, metalness: 0.1, envMapIntensity: 1.5, emissive: 0x000000, side: THREE.DoubleSide, depthWrite: false }),
      facade: S({ color: 0x27364e, map: facadeTex(), roughness: 0.8 }),
      props: S({ vertexColors: true, roughness: 0.72, metalness: 0.12 }),
      propsMetal: S({ vertexColors: true, roughness: 0.42, metalness: 0.78 }),
      crew: S({ vertexColors: true, roughness: 0.75 }),
      city: S({ color: 0xb9b6ad, roughness: 0.85, vertexColors: true }),
      cityWin: S({ color: 0x2a2f38, emissive: 0xffcf8a, emissiveIntensity: 0.05, roughness: 0.35, metalness: 0.4 }),
      lamp: S({ color: 0xfff3d8, emissive: 0xffe0a0, emissiveIntensity: 0.15, roughness: 0.4 }),
      net: S({ color: 0xd07a2a, transparent: true, opacity: 0.32, alphaMap: meshTex(), alphaTest: 0.03, side: THREE.DoubleSide, depthWrite: false, roughness: 0.9 }),
      rebar: S({ color: 0x8a7f6c, roughness: 0.85, metalness: 0.4 }),
      tarp: S({ color: 0x3d6cc0, roughness: 0.85, side: THREE.DoubleSide }),
      rubber: S({ color: 0x1d2024, roughness: 0.95 }),
      clouds: []
    };

    const mt = new THREE.Matrix4(), qq = new THREE.Quaternion(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
    this._mt = mt; this._q = qq; this._sv = sv; this._pv = pv;
    const YAX = new THREE.Vector3(0, 1, 0);
    const inst = (geo, mat, list, shadow) => {
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach(([x, y, z, ry, s], i) => {
        pv.set(x, y, z); qq.setFromAxisAngle(YAX, ry || 0); sv.setScalar(s || 1);
        mt.compose(pv, qq, sv); im.setMatrixAt(i, mt);
      });
      im.instanceMatrix.needsUpdate = true;
      if (shadow) { im.castShadow = true; im.receiveShadow = true; }
      scene.add(im);
      return im;
    };

    /* ---------------- terrain ---------------- */
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), m.soil);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const pad = new THREE.Mesh(box(W + 30, 0.3, D + 28, true), m.gravel);
    pad.position.y = 0.02; pad.receiveShadow = true;
    scene.add(pad);

    const road = new THREE.Mesh(box(11, 0.34, 260, true), m.road);
    road.position.set(W / 2 + 23, 0.03, 0); road.receiveShadow = true;
    scene.add(road);
    const kerb = new THREE.Mesh(box(0.5, 0.5, 260, true), m.concrete);
    kerb.position.set(W / 2 + 17.6, 0.03, 0); kerb.receiveShadow = true;
    scene.add(kerb);
    const centre = [];
    for (let z = -120; z < 120; z += 9) centre.push(place(box(0.22, 0.02, 4.4, false), W / 2 + 23, 0.38, z, 0, 0, 0, 0xe8dfae));
    const marks = new THREE.Mesh(mergeGeos(centre), m.props);
    scene.add(marks);

    // distant skyline
    const cityParts = [], winParts = [];
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2 + 0.3, r = 210 + (i % 5) * 40;
      const h = 16 + ((i * 37) % 62), bw = 12 + (i % 4) * 6, bd = 12 + (i % 3) * 7;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const tint = [0xb2afa6, 0xa39f95, 0xbbb7ac, 0x97948c][i % 4];
      cityParts.push(place(box(bw, h, bd, true), x, 0, z, 0, a, 0, tint));
      cityParts.push(place(box(bw * 0.5, 3, bd * 0.5, true), x, h, z, 0, a, 0, tint));
      winParts.push(place(box(bw * 0.94, h * 0.8, bd * 0.94, true), x, h * 0.08, z, 0, a));
    }
    const city = new THREE.Mesh(mergeGeos(cityParts), m.city);
    city.renderOrder = -1;
    scene.add(city);
    const cityWin = new THREE.Mesh(mergeGeos(winParts), m.cityWin);
    scene.add(cityWin);

    // clouds
    const ct = cloudTex();
    this.clouds = [];
    for (let i = 0; i < 7; i++) {
      const mat = new THREE.MeshBasicMaterial({ map: ct, transparent: true, opacity: 0.5, depthWrite: false, fog: false });
      m.clouds.push(mat);
      const cl = new THREE.Mesh(new THREE.PlaneGeometry(200 + rnd() * 160, 70 + rnd() * 50), mat);
      const a = rnd() * 6.28, r = 260 + rnd() * 260;
      cl.position.set(Math.cos(a) * r, 130 + rnd() * 90, Math.sin(a) * r);
      cl.renderOrder = -2;
      scene.add(cl);
      this.clouds.push(cl);
    }

    /* ---------------- hoarding + gate ---------------- */
    const fx = W / 2 + 13, fz = D / 2 + 12;
    const hoardParts = [], postParts = [];
    const panel = box(3.2, 2.4, 0.05, true), post = box(0.14, 2.7, 0.14, true), rail = box(3.2, 0.1, 0.12, false);
    const run = (a, b, step, fn) => { for (let v = a; v <= b + 0.01; v += step) fn(v); };
    run(-fx, fx, 3.2, x => {
      if (Math.abs(x - (fx - 6.4)) < 0.1) return; // gate opening
      [-fz, fz].forEach(z => {
        hoardParts.push(place(panel, x, 0.16, z));
        postParts.push(place(post, x - 1.6, 0, z, 0, 0, 0, 0x8d9298));
        postParts.push(place(rail, x, 2.5, z, 0, 0, 0, 0x8d9298));
      });
    });
    run(-fz, fz, 3.2, z => {
      [-fx, fx].forEach(x => {
        hoardParts.push(place(panel, x, 0.16, z, 0, Math.PI / 2));
        postParts.push(place(post, x, 0, z - 1.6, 0, 0, 0, 0x8d9298));
        postParts.push(place(rail, x, 2.5, z, 0, Math.PI / 2, 0, 0x8d9298));
      });
    });
    const hoarding = new THREE.Mesh(mergeGeos(hoardParts), m.hoard);
    hoarding.castShadow = true; hoarding.receiveShadow = true;
    scene.add(hoarding);
    const hoardPosts = new THREE.Mesh(mergeGeos(postParts), m.propsMetal);
    scene.add(hoardPosts);
    this.hoardPosts = hoardPosts;

    // site signage board on the hoarding
    const sign = new THREE.Mesh(mergeGeos([
      place(box(4.4, 2.1, 0.08, true), 0, 0, 0, 0, 0, 0, 0xf2efe6),
      place(box(3.9, 0.34, 0.03, true), 0, 1.5, 0.06, 0, 0, 0, 0x1544c8),
      place(box(3.9, 0.16, 0.03, true), 0, 1.05, 0.06, 0, 0, 0, 0x8d8b84),
      place(box(2.6, 0.16, 0.03, true), -0.6, 0.72, 0.06, 0, 0, 0, 0x8d8b84),
      place(box(3.2, 0.16, 0.03, true), -0.3, 0.39, 0.06, 0, 0, 0, 0x8d8b84)
    ]), m.props);
    sign.position.set(-4, 0.35, fz + 0.06);
    sign.castShadow = true;
    scene.add(sign);

    /* ---------------- site facilities + laydown (one merged prop mesh) ---------------- */
    const props = [], metalProps = [];
    // stacked site offices
    const officeAt = (x, z, ry, y, col) => {
      const c = [];
      c.push(place(box(9, 2.9, 3.2, true), 0, 0, 0, 0, 0, 0, col));
      c.push(place(box(9.2, 0.14, 3.4, true), 0, 2.9, 0, 0, 0, 0, 0xd8d5cd));
      for (let i = -3.2; i <= 3.2; i += 1.6) c.push(place(box(1.05, 0.9, 0.06, true), i, 1.3, 1.63, 0, 0, 0, 0x2e3946));
      c.push(place(box(0.9, 2.1, 0.08, true), 3.9, 0.1, 1.62, 0, 0, 0, 0x6f7681));
      const g = mergeGeos(c);
      props.push(place(g, x, y, z, 0, ry));
    };
    officeAt(-fx + 8, -fz + 6, 0.12, 0.2, 0xdedad0);
    officeAt(-fx + 8, -fz + 6, 0.12, 3.24, 0xc9d3d8);
    officeAt(-fx + 8, -fz + 12.4, -0.06, 0.2, 0xd2cfc4);
    // stair to upper office
    for (let i = 0; i < 9; i++) metalProps.push(place(box(1.1, 0.08, 0.34, true), -fx + 13.2, 0.4 + i * 0.34, -fz + 6.2 - i * 0.34, 0, 0, 0, 0x8b9299));
    // portable toilets
    [[-fx + 18.5, -fz + 5.6], [-fx + 20.2, -fz + 5.6]].forEach(([x, z]) => {
      props.push(place(box(1.2, 2.3, 1.2, true), x, 0.2, z, 0, 0, 0, 0x2f6b46));
      props.push(place(box(1.3, 0.12, 1.3, true), x, 2.5, z, 0, 0, 0, 0x244f35));
    });
    // skip bins
    [[fx - 6, -fz + 6, 0x9c4e2c], [fx - 6, -fz + 10, 0x7d6a33]].forEach(([x, z, col]) => {
      props.push(place(box(5.4, 1.7, 2.4, true), x, 0.2, z, 0, 0.1, 0, col));
      props.push(place(box(5.6, 0.16, 2.6, true), x, 1.9, z, 0, 0.1, 0, col));
    });
    // steel bundles on dunnage
    for (let s = 0; s < 6; s++) {
      const y = 0.4 + Math.floor(s / 3) * 0.62, x = fx - 11 + (s % 3) * 0.1;
      metalProps.push(place(iBeamH(11, 0.5, 0.32, 0.05, 0.06), x, y, fz - 8 - (s % 3) * 0.9, 0, 0, 0, 0x9aa2aa));
    }
    props.push(place(box(12, 0.3, 4.4, true), fx - 11, 0.2, fz - 8.9, 0, 0, 0, 0x6b5c46));
    // rebar coils + bundles
    for (let i = 0; i < 4; i++) {
      metalProps.push(place(cyl(0.9, 0.9, 0.5, 12, true), fx - 20 + i * 2.2, 0.2, fz - 9, 0, 0, 0, 0x8a7f6c));
    }
    for (let i = 0; i < 5; i++) metalProps.push(place(cyl(0.09, 0.09, 12, 6, false), fx - 24, 0.5 + i * 0.2, fz - 6 + (i % 2) * 0.22, Math.PI / 2, 0, 0, 0x8f8472));
    // glazing crates (A-frames, tarped)
    for (let i = 0; i < 3; i++) {
      const x = -fx + 7 + i * 4.4, z = fz - 7;
      metalProps.push(place(box(3.8, 0.3, 1.6, true), x, 0.2, z, 0, 0, 0, 0x6e767e));
      props.push(place(box(3.6, 2.4, 0.18, true), x, 0.45, z - 0.3, 0.14, 0, 0, 0x2b5fae));
      props.push(place(box(3.6, 2.4, 0.18, true), x, 0.45, z + 0.3, -0.14, 0, 0, 0x2b5fae));
    }
    // block pallets
    for (let i = 0; i < 5; i++) {
      const x = -fx + 6 + (i % 3) * 2.4, z = fz - 13 - Math.floor(i / 3) * 2.4;
      props.push(place(box(1.9, 0.16, 1.9, true), x, 0.2, z, 0, 0, 0, 0x7c6a4e));
      props.push(place(box(1.8, 1.1, 1.8, true), x, 0.36, z, 0, 0, 0, 0xa8a49a));
    }
    // cable spools
    [[-fx + 20, fz - 6], [-fx + 23, fz - 6.6]].forEach(([x, z]) => {
      props.push(place(cyl(1.1, 1.1, 0.12, 14, true), x, 1.3, z, 0, 0, Math.PI / 2, 0x6b5c46));
      props.push(place(cyl(1.1, 1.1, 0.12, 14, true), x, 1.3, z + 1.2, 0, 0, Math.PI / 2, 0x6b5c46));
      props.push(place(cyl(0.75, 0.75, 1.1, 14, true), x, 1.3, z + 0.6, 0, 0, Math.PI / 2, 0x2b2f34));
    });
    // jersey barriers along the gate + cones
    for (let i = 0; i < 7; i++) {
      props.push(place(box(3, 0.9, 0.6, true), fx + 2.4, 0.2, -fz + 4 + i * 3.1, 0, 0, 0, 0xd6d2c6));
    }
    const cone = mergeGeos([place(cyl(0.03, 0.24, 0.7, 8, true), 0, 0, 0, 0, 0, 0, 0xe2601c), place(box(0.5, 0.05, 0.5, true), 0, 0, 0, 0, 0, 0, 0x2a2c30)]);
    for (let i = 0; i < 14; i++) props.push(place(cone, fx - 2 + Math.sin(i * 1.7) * 1.4, 0.2, -fz + 3 + i * 2.3));
    // welfare: water butt + gas bottles
    props.push(place(cyl(0.9, 0.9, 2.2, 12, true), -fx + 24, 0.2, -fz + 6, 0, 0, 0, 0x2f4f8a));
    for (let i = 0; i < 4; i++) props.push(place(cyl(0.24, 0.24, 1.3, 10, true), -fx + 22 + i * 0.6, 0.2, -fz + 8, 0, 0, 0, i % 2 ? 0xb9451f : 0x2c3a4a));

    const propMesh = new THREE.Mesh(mergeGeos(props), m.props);
    propMesh.castShadow = true; propMesh.receiveShadow = true;
    scene.add(propMesh);
    const pm = new THREE.Mesh(mergeGeos(metalProps), m.propsMetal);
    pm.castShadow = true; pm.receiveShadow = true;
    scene.add(pm);

    // trees + street lights along the road
    const treeParts = [];
    for (let i = 0; i < 9; i++) {
      const z = -100 + i * 25, x = W / 2 + 30 + (i % 2) * 2;
      treeParts.push(place(cyl(0.24, 0.34, 4.4, 7, true), x, 0, z, 0, 0, 0, 0x5b4634));
      treeParts.push(place(new THREE.IcosahedronGeometry(2.6, 0), x, 5.6, z, 0, 0, 0, 0x4e6b3c));
      treeParts.push(place(new THREE.IcosahedronGeometry(1.9, 0), x + 0.8, 7.2, z - 0.6, 0, 0, 0, 0x5f7a48));
    }
    const trees = new THREE.Mesh(mergeGeos(treeParts), m.props);
    trees.castShadow = true;
    scene.add(trees);

    // site flood-light towers (glow at night)
    this.lampLights = [];
    const lampParts = [], headParts = [];
    [[-22, 4], [22, -6]].forEach(([x, z]) => {      lampParts.push(place(box(2.2, 0.4, 1.4, true), x, 0.2, z, 0, 0, 0, 0x8a8f96));
      lampParts.push(place(cyl(0.16, 0.22, 9, 8, true), x, 0.6, z, 0, 0, 0, 0x9aa0a6));
      headParts.push(place(box(0.9, 0.5, 0.3, true), x - 0.6, 9.1, z, 0, 0, 0.2, 0xfff3d8));
      headParts.push(place(box(0.9, 0.5, 0.3, true), x + 0.6, 9.1, z, 0, 0, -0.2, 0xfff3d8));
      const l = new THREE.PointLight(0xffd9a0, 0, 60, 1.5);
      l.position.set(x, 9.4, z);
      scene.add(l);
      this.lampLights.push(l);
    });    scene.add(new THREE.Mesh(mergeGeos(lampParts), m.propsMetal));
    const lampHeads = new THREE.Mesh(mergeGeos(headParts), m.lamp);
    scene.add(lampHeads);

    /* ---------------- vehicles ---------------- */
    const wheel = cyl(0.62, 0.62, 0.46, 12, false);
    const wheelSet = (list) => list.map(([x, y, z]) => place(wheel, x, y, z, 0, 0, Math.PI / 2, 0x1d2024));

    // flatbed delivery truck
    const truck = new THREE.Group();
    truck.add(new THREE.Mesh(mergeGeos([
      place(box(3, 2.1, 2.6, true), 3.2, 0.7, 0, 0, 0, 0, 0xcf6320),
      place(box(2.6, 1, 2.5, true), 3.3, 2.6, 0, 0, 0, 0, 0x2b3340),
      place(box(9.4, 0.4, 2.6, true), -1.6, 0.9, 0, 0, 0, 0, 0x6f7178),
      place(box(0.5, 1.5, 2.6, true), -6.2, 1.3, 0, 0, 0, 0, 0x6f7178),
      place(box(9.6, 0.55, 0.16, true), -1.6, 1.3, 1.3, 0, 0, 0, 0x8b9299),
      place(box(9.6, 0.55, 0.16, true), -1.6, 1.3, -1.3, 0, 0, 0, 0x8b9299),
      ...wheelSet([[3.4, 0.62, 1.35], [3.4, 0.62, -1.35], [-3.2, 0.62, 1.35], [-3.2, 0.62, -1.35], [-4.6, 0.62, 1.35], [-4.6, 0.62, -1.35]])
    ]), m.props));
    // cargo: bundle of columns
    const cargo = new THREE.Mesh(mergeGeos([
      place(iBeamH(8.4, 0.5, 0.3, 0.05, 0.06), -1.4, 1.4, 0.5, 0, 0, 0, 0x9aa2aa),
      place(iBeamH(8.4, 0.5, 0.3, 0.05, 0.06), -1.4, 1.4, -0.5, 0, 0, 0, 0x9aa2aa),
      place(iBeamH(8.4, 0.5, 0.3, 0.05, 0.06), -1.4, 1.95, 0, 0, 0, 0, 0x9aa2aa)
    ]), m.propsMetal);
    truck.add(cargo);
    truck.traverse(o => { o.castShadow = true; });
    truck.position.set(W / 2 + 23, 0.2, 16);
    truck.rotation.y = Math.PI / 2;
    scene.add(truck);
    this.truck = truck;
    this.cargo = cargo;

    // concrete mixer with turning drum
    const mixer = new THREE.Group();
    mixer.add(new THREE.Mesh(mergeGeos([
      place(box(3, 2.2, 2.6, true), 3.4, 0.7, 0, 0, 0, 0, 0xd8d5cd),
      place(box(2.5, 0.9, 2.5, true), 3.4, 2.7, 0, 0, 0, 0, 0x2b3340),
      place(box(9, 0.5, 2.5, true), -1.5, 0.9, 0, 0, 0, 0, 0x5f636a),
      place(box(1.6, 2.6, 0.3, true), -5.6, 1.2, 0, 0, 0, 0.35, 0x7c8189),
      ...wheelSet([[3.5, 0.62, 1.3], [3.5, 0.62, -1.3], [-2.6, 0.62, 1.3], [-2.6, 0.62, -1.3], [-4, 0.62, 1.3], [-4, 0.62, -1.3]])
    ]), m.props));
    const drum = new THREE.Mesh(mergeGeos([
      place(cyl(1.05, 1.55, 3, 14, false), 0, 0, 0, 0, 0, Math.PI / 2, 0xcfd3d8),
      place(cyl(1.55, 1.15, 2.4, 14, false), -2.6, 0, 0, 0, 0, Math.PI / 2, 0xcfd3d8),
      place(cyl(0.4, 0.4, 0.6, 10, false), 2.1, 0, 0, 0, 0, Math.PI / 2, 0x8b9299),
      place(box(3.2, 0.14, 0.5, false), 0, 0.9, 0.9, 0.5, 0, 0, 0x9aa0a6),
      place(box(3.2, 0.14, 0.5, false), 0, -0.9, -0.9, 0.5, 0, 0, 0x9aa0a6)
    ]), m.props);
    const drumTilt = new THREE.Group();
    drumTilt.position.set(-1.2, 2.4, 0);
    drumTilt.rotation.z = 0.18;
    drum.castShadow = true;
    drumTilt.add(drum);
    mixer.add(drumTilt);
    mixer.traverse(o => { o.castShadow = true; });
    mixer.position.set(0, 0.2, -15.5);
    mixer.rotation.y = 0.08;
    scene.add(mixer);
    this.mixer = mixer; this.drum = drum;

    // concrete pump with folded boom
    const pump = new THREE.Group();
    pump.add(new THREE.Mesh(mergeGeos([
      place(box(10, 1.2, 2.7, true), 0, 0.5, 0, 0, 0, 0, 0xb8442a),
      place(box(2.8, 2, 2.6, true), 4.4, 1.7, 0, 0, 0, 0, 0xb8442a),
      place(box(1.6, 1.4, 2.4, true), -3.6, 1.7, 0, 0, 0, 0, 0x53585f),
      place(box(0.4, 0.5, 5.4, true), -1, 0.4, 0, 0, 0, 0, 0x8b9299),
      place(box(0.4, 0.5, 5.4, true), 2.6, 0.4, 0, 0, 0, 0, 0x8b9299),
      ...wheelSet([[4.2, 0.62, 1.35], [4.2, 0.62, -1.35], [-3, 0.62, 1.35], [-3, 0.62, -1.35]])
    ]), m.props));
    const boomA = new THREE.Group();
    boomA.position.set(-1.4, 2.6, 0);
    boomA.add(new THREE.Mesh(box(9, 0.5, 0.6, false).translate(4.5, 0, 0), m.crane));
    const boomB = new THREE.Group();
    boomB.position.set(9, 0, 0);
    boomB.add(new THREE.Mesh(box(8, 0.4, 0.5, false).translate(4, 0, 0), m.crane));
    const boomC = new THREE.Group();
    boomC.position.set(8, 0, 0);
    boomC.add(new THREE.Mesh(box(6, 0.32, 0.42, false).translate(3, 0, 0), m.crane));
    boomC.add(new THREE.Mesh(cyl(0.18, 0.18, 2.4, 8, false), m.props).translateX(6).translateY(-1.2));
    boomB.add(boomC); boomA.add(boomB); pump.add(boomA);
    pump.traverse(o => { o.castShadow = true; });
    pump.position.set(12, 0.2, -13);
    pump.rotation.y = -2.51;
    scene.add(pump);
    this.pump = pump; this.boomA = boomA; this.boomB = boomB; this.boomC = boomC;

    // excavator (early phase)
    const exc = new THREE.Group();
    exc.add(new THREE.Mesh(mergeGeos([
      place(box(4.6, 0.7, 1, true), 0, 0.25, 1.35, 0, 0, 0, 0x24272b),
      place(box(4.6, 0.7, 1, true), 0, 0.25, -1.35, 0, 0, 0, 0x24272b),
      place(box(4.2, 0.5, 3, true), 0, 0.6, 0, 0, 0, 0, 0x3a3f45)
    ]), m.props));
    const house = new THREE.Group();
    house.position.y = 1.1;
    house.add(new THREE.Mesh(mergeGeos([
      place(box(3.4, 1.5, 2.6, true), -0.4, 0, 0, 0, 0, 0, 0xd8a01e),
      place(box(1.5, 1.7, 1.5, true), 0.6, 1.5, 0.5, 0, 0, 0, 0x2b3340),
      place(box(1, 1.2, 2.4, true), -2.1, 0.2, 0, 0, 0, 0, 0x3a3f45)
    ]), m.props));
    const eBoom = new THREE.Group();
    eBoom.position.set(1.2, 0.7, 0);
    eBoom.rotation.z = 0.75;
    eBoom.add(new THREE.Mesh(box(6, 0.6, 0.7, false).translate(3, 0, 0), m.props));
    const eStick = new THREE.Group();
    eStick.position.set(6, 0, 0);
    eStick.rotation.z = -1.9;
    eStick.add(new THREE.Mesh(box(4, 0.45, 0.5, false).translate(2, 0, 0), m.props));
    const bucket = new THREE.Mesh(mergeGeos([
      place(box(1.1, 1, 1.4, false), 0.3, -0.4, 0, 0, 0, 0, 0x53585f),
      place(box(1.3, 0.16, 1.4, false), 0.6, -0.85, 0, 0, 0, 0.4, 0x53585f)
    ]), m.props);
    bucket.position.set(4, 0, 0);
    eStick.add(bucket); eBoom.add(eStick); house.add(eBoom); exc.add(house);
    exc.traverse(o => { o.castShadow = true; });
    exc.position.set(-2, 0.2, D / 2 + 6);
    scene.add(exc);
    this.exc = exc; this.excHouse = house; this.excBoom = eBoom; this.excStick = eStick;

    /* ---------------- foundation, piles, core ---------------- */
    const piles = [];
    for (let a = 0; a <= NX; a++) for (let b = 0; b <= NZ; b++) {
      piles.push(place(cyl(0.55, 0.55, 2.2, 10, true), -W / 2 + a * BAY, 0, -D / 2 + b * BAY));
      piles.push(place(box(1.9, 0.9, 1.9, true), -W / 2 + a * BAY, 2.1, -D / 2 + b * BAY));
    }
    const pileCaps = new THREE.Mesh(mergeGeos(piles), m.concrete);
    pileCaps.castShadow = true; pileCaps.receiveShadow = true;
    pileCaps.position.y = -1.9;
    scene.add(pileCaps);
    this.piles = pileCaps;

    const found = new THREE.Mesh(box(W + 3, 0.9, D + 3, true), m.concrete);
    found.castShadow = true; found.receiveShadow = true;
    scene.add(found);
    this.found = found;

    const coreX = -W / 2 + BAY, coreW = BAY * 0.94, coreD = BAY * 0.8, wt = 0.35;
    const coreGeo = mergeGeos([
      place(box(coreW, 1, wt, true), 0, 0, -coreD / 2),
      place(box(coreW * 0.32, 1, wt, true), -coreW * 0.34, 0, coreD / 2),
      place(box(coreW * 0.32, 1, wt, true), coreW * 0.34, 0, coreD / 2),
      place(box(wt, 1, coreD, true), -coreW / 2, 0, 0),
      place(box(wt, 1, coreD, true), coreW / 2, 0, 0)
    ]);
    const core = new THREE.Mesh(coreGeo, m.concrete);
    core.position.set(coreX, 0.9, 0);
    core.castShadow = true; core.receiveShadow = true;
    scene.add(core);
    this.core = core;

    // jump-form rig around the core
    const formPanels = [];
    [-1, 1].forEach(sgn => {
      [-1, 1].forEach(half => {
        formPanels.push(place(box(coreW / 2 + 0.4, 2.4, 0.12, true), half * (coreW / 4 + 0.3), 0, sgn * (coreD / 2 + 0.5), 0, 0, 0, 0xe08a3a));
        formPanels.push(place(box(0.12, 2.4, coreD / 2 + 0.35, true), sgn * (coreW / 2 + 0.5), 0, half * (coreD / 4 + 0.28), 0, 0, 0, 0xe08a3a));
      });
    });
    const form = new THREE.Mesh(mergeGeos([
      ...formPanels,
      place(box(coreW + 1.4, 0.16, 0.2, true), 0, 1.2, -coreD / 2 - 0.62, 0, 0, 0, 0x8b9299),
      place(box(coreW + 1.4, 0.16, 0.2, true), 0, 1.2, coreD / 2 + 0.62, 0, 0, 0, 0x8b9299),
      place(box(coreW + 1.4, 0.16, 0.2, true), 0, 0.2, -coreD / 2 - 0.62, 0, 0, 0, 0x8b9299),
      place(box(coreW + 1.4, 0.16, 0.2, true), 0, 0.2, coreD / 2 + 0.62, 0, 0, 0, 0x8b9299),
      place(box(coreW + 2.6, 0.12, coreD + 2.4, true), 0, -1.2, 0, 0, 0, 0, 0x8b9299),
      place(box(coreW + 2.6, 0.08, 0.08, true), 0, -0.2, coreD / 2 + 1.2, 0, 0, 0, 0xe0b021),
      place(box(coreW + 2.6, 0.08, 0.08, true), 0, -0.2, -coreD / 2 - 1.2, 0, 0, 0, 0xe0b021)
    ]), m.props);
    form.castShadow = true;
    scene.add(form);
    this.form = form;

    // rebar cage above the pour
    const cage = [];
    for (let i = -coreW / 2; i <= coreW / 2; i += 0.5) { cage.push(place(cyl(0.035, 0.035, 2.6, 5, true), i, 0, -coreD / 2)); cage.push(place(cyl(0.035, 0.035, 2.6, 5, true), i, 0, coreD / 2)); }
    for (let i = -coreD / 2; i <= coreD / 2; i += 0.5) { cage.push(place(cyl(0.035, 0.035, 2.6, 5, true), -coreW / 2, 0, i)); cage.push(place(cyl(0.035, 0.035, 2.6, 5, true), coreW / 2, 0, i)); }
    const coreCage = new THREE.Mesh(mergeGeos(cage), m.rebar);
    scene.add(coreCage);
    this.coreCage = coreCage;

    // hoist / mast climber on the east face
    const hoistSec = new THREE.InstancedMesh(latticeY(1.1, 3, 0.11), m.crane, 18);
    hoistSec.castShadow = true;
    for (let i = 0; i < 18; i++) { pv.set(W / 2 + 2.6, i * 3, -D / 2 + 2); qq.identity(); sv.setScalar(1); mt.compose(pv, qq, sv); hoistSec.setMatrixAt(i, mt); }
    hoistSec.instanceMatrix.needsUpdate = true;
    hoistSec.count = 2;
    scene.add(hoistSec);
    this.hoistSec = hoistSec;
    const cage2 = new THREE.Mesh(mergeGeos([
      place(box(1.8, 2.4, 1.6, true), 0, 0, 0, 0, 0, 0, 0xd8d5cd),
      place(box(1.9, 0.12, 1.7, true), 0, 2.4, 0, 0, 0, 0, 0x8b9299),
      place(box(1.9, 0.12, 1.7, true), 0, -0.06, 0, 0, 0, 0, 0x8b9299)
    ]), m.props);
    cage2.castShadow = true;
    cage2.position.set(W / 2 + 3.9, 0.2, -D / 2 + 2);
    scene.add(cage2);
    this.hoistCage = cage2;

    /* ---------------- floors ---------------- */
    const colGeo = iBeam(FH, 0.42, 0.3, 0.05, 0.07);
    const nColX = NX + 1, nColZ = NZ + 1, nCol = nColX * nColZ;
    this.nColX = nColX; this.nColZ = nColZ;

    const frameParts = [];
    for (let a = 0; a <= NX; a++) frameParts.push(place(iBeamH(D + 1.2, 0.62, 0.34, 0.05, 0.07), -W / 2 + a * BAY, 0, 0, 0, Math.PI / 2, 0, 0x98a0a8));
    for (let b = 0; b <= NZ; b++) frameParts.push(place(iBeamH(W + 1.2, 0.62, 0.34, 0.05, 0.07), 0, 0, -D / 2 + b * BAY, 0, 0, 0, 0x98a0a8));
    for (let a = 0; a < NX; a++) for (let j = 1; j < 5; j++) { // secondary joists
      const x = -W / 2 + a * BAY + (j * BAY) / 5;
      frameParts.push(place(iBeamH(D + 1, 0.34, 0.2, 0.04, 0.05), x, -0.1, 0, 0, Math.PI / 2, 0, 0xa6adb4));
    }
    const frameGeo = mergeGeos(frameParts);
    const deckPanGeo = box(W + 1.4, 0.14, D + 1.4, false);
    const slabGeo = box(W + 1.4, 0.24, D + 1.4, false);
    slabGeo.translate((W + 1.4) / 2, 0, 0); // pour sweeps from -X

    // curtain wall: mullion grid + glass, merged per facade orientation
    const mullParts = [], glassParts = [];
    const mullV = box(0.13, FH - 0.5, 0.2, true), mullH = box(1, 0.13, 0.2, false);
    const gz = D / 2 + 0.86, gx = W / 2 + 0.86;
    for (let side = 0; side < 2; side++) {
      const z = side ? gz : -gz;
      for (let x = -W / 2 - 0.7; x <= W / 2 + 0.7; x += 1.5) mullParts.push(place(mullV, x, 0.28, z, 0, 0, 0, 0x9fa6ad));
      mullParts.push(place(box(W + 1.4, 0.16, 0.24, false), 0, 0.28, z, 0, 0, 0, 0x9fa6ad));
      mullParts.push(place(box(W + 1.4, 0.16, 0.24, false), 0, FH - 0.28, z, 0, 0, 0, 0x9fa6ad));
      glassParts.push(place(new THREE.PlaneGeometry(W + 1.4, FH - 0.62), 0, (FH - 0.1) / 2, z));
    }
    for (let side = 0; side < 2; side++) {
      const x = side ? gx : -gx;
      for (let z = -D / 2 - 0.7; z <= D / 2 + 0.7; z += 1.5) mullParts.push(place(mullV, x, 0.28, z, 0, Math.PI / 2, 0, 0x9fa6ad));
      mullParts.push(place(box(D + 1.4, 0.16, 0.24, false), x, 0.28, 0, 0, Math.PI / 2, 0, 0x9fa6ad));
      mullParts.push(place(box(D + 1.4, 0.16, 0.24, false), x, FH - 0.28, 0, 0, Math.PI / 2, 0, 0x9fa6ad));
      glassParts.push(place(new THREE.PlaneGeometry(D + 1.4, FH - 0.62), x, (FH - 0.1) / 2, 0, 0, Math.PI / 2));
    }
    const mullGeo = mergeGeos(mullParts), glassGeo = mergeGeos(glassParts);

    this.floors = [];
    for (let f = 0; f < FLOORS; f++) {
      const grp = new THREE.Group();
      grp.position.y = f * FH;
      scene.add(grp);

      const cols = new THREE.InstancedMesh(colGeo, m.steel, nCol);
      cols.castShadow = true; cols.receiveShadow = true;
      grp.add(cols);

      const frame = new THREE.Mesh(frameGeo, m.propsMetal);
      frame.castShadow = true; frame.receiveShadow = true;
      frame.position.y = FH - 0.35;
      grp.add(frame);

      const pan = new THREE.Mesh(deckPanGeo, m.deckPan);
      pan.castShadow = true; pan.receiveShadow = true;
      pan.position.y = FH - 0.04;
      grp.add(pan);

      const slab = new THREE.Mesh(slabGeo, m.concrete);
      slab.castShadow = true; slab.receiveShadow = true;
      slab.position.set(-(W + 1.4) / 2, FH + 0.11, 0);
      grp.add(slab);

      const mull = new THREE.Mesh(mullGeo, m.propsMetal);
      mull.castShadow = true;
      grp.add(mull);
      const glass = new THREE.Mesh(glassGeo, m.glass);
      grp.add(glass);
      const back = new THREE.Mesh(glassGeo, m.facade);
      back.scale.setScalar(0.985);
      back.position.y = 0.02;
      grp.add(back);

      this.floors.push({ grp, cols, frame, pan, slab, mull, glass, back, t: -1 });
    }

    // roof plant + parapet
    const plant = new THREE.Group();
    plant.add(new THREE.Mesh(mergeGeos([
      place(box(9, 3, 6, true), 1, 0, 0, 0, 0, 0, 0xc2beb2),
      place(box(9.4, 0.2, 6.4, true), 1, 3, 0, 0, 0, 0, 0x9fa6ad),
      place(box(2.4, 1.4, 2.4, true), -7, 0, 2, 0, 0, 0, 0x9aa0a6),
      place(box(2.4, 1.4, 2.4, true), -7, 0, -2, 0, 0, 0, 0x9aa0a6),
      place(box(W + 1.9, 1.15, 0.28, true), 0, 0, D / 2 + 0.85, 0, 0, 0, 0xc2beb2),
      place(box(W + 1.9, 1.15, 0.28, true), 0, 0, -D / 2 - 0.85, 0, 0, 0, 0xc2beb2),
      place(box(0.28, 1.15, D + 1.9, true), W / 2 + 0.85, 0, 0, 0, 0, 0, 0xc2beb2),
      place(box(0.28, 1.15, D + 1.9, true), -W / 2 - 0.85, 0, 0, 0, 0, 0, 0xc2beb2)
    ]), m.props));
    const stack = new THREE.Mesh(cyl(0.55, 0.55, 2.6, 10, true), m.galv);
    stack.position.set(-3.5, 0, 1.4);
    plant.add(stack);
    plant.traverse(o => { o.castShadow = true; });
    plant.visible = false;
    scene.add(plant);
    this.plant = plant;

    // netting + edge protection on active decks
    this.nets = [];
    for (let i = 0; i < 8; i++) {
      const n = new THREE.Mesh(i < 4 ? new THREE.PlaneGeometry(W + 2, FH) : new THREE.PlaneGeometry(D + 2, FH), m.net);
      n.visible = false;
      scene.add(n);
      this.nets.push(n);
    }
    const railParts = [];
    [0.55, 1.1].forEach(y => {
      railParts.push(place(box(W + 2.2, 0.07, 0.07, true), 0, y, -D / 2 - 0.95, 0, 0, 0, 0xe0b021));
      railParts.push(place(box(W + 2.2, 0.07, 0.07, true), 0, y, D / 2 + 0.95, 0, 0, 0, 0xe0b021));
      railParts.push(place(box(0.07, 0.07, D + 2.2, true), -W / 2 - 1.05, y, 0, 0, 0, 0, 0xe0b021));
      railParts.push(place(box(0.07, 0.07, D + 2.2, true), W / 2 + 1.05, y, 0, 0, 0, 0, 0xe0b021));
    });
    for (let x = -W / 2 - 1; x <= W / 2 + 1; x += 2.4) {
      railParts.push(place(box(0.08, 1.15, 0.08, true), x, 0, -D / 2 - 0.95, 0, 0, 0, 0xe0b021));
      railParts.push(place(box(0.08, 1.15, 0.08, true), x, 0, D / 2 + 0.95, 0, 0, 0, 0xe0b021));
    }
    const rail2 = new THREE.Mesh(mergeGeos(railParts), m.props);
    rail2.visible = false;
    scene.add(rail2);
    this.rail = rail2;

    // rebar mat on the deck being poured
    const rb = [];
    for (let i = -W / 2; i <= W / 2; i += 0.9) rb.push(place(cyl(0.03, 0.03, D, 5, false), i, 0, 0, Math.PI / 2));
    for (let j = -D / 2; j <= D / 2; j += 0.9) rb.push(place(cyl(0.03, 0.03, W, 5, false), 0, 0.07, j, 0, 0, Math.PI / 2));
    const rebar = new THREE.Mesh(mergeGeos(rb), m.rebar);
    rebar.visible = false;
    scene.add(rebar);
    this.rebar = rebar;

    /* ---------------- tower crane ---------------- */
    const crane = new THREE.Group();
    crane.position.set(W / 2 + 13, 0, -3);
    scene.add(crane);
    this.crane = crane;

    const cbase = new THREE.Mesh(mergeGeos([
      place(box(6, 1.6, 6, true), 0, 0, 0, 0, 0, 0, 0xbdb8ab),
      place(box(2.6, 0.5, 2.6, true), 0, 1.6, 0, 0, 0, 0, 0x9aa0a6)
    ]), m.props);
    cbase.castShadow = true; cbase.receiveShadow = true;
    crane.add(cbase);

    const mastSec = new THREE.InstancedMesh(latticeY(1.9, 3, 0.17), m.crane, 18);
    mastSec.castShadow = true; mastSec.receiveShadow = true;
    for (let i = 0; i < 18; i++) { pv.set(0, 2.1 + i * 3, 0); qq.identity(); sv.setScalar(1); mt.compose(pv, qq, sv); mastSec.setMatrixAt(i, mt); }
    mastSec.instanceMatrix.needsUpdate = true;
    crane.add(mastSec);
    this.mastSec = mastSec;
    this.mastTop = 2.1 + 18 * 3;

    const top = new THREE.Group();
    crane.add(top);
    this.craneTop = top;

    top.add(new THREE.Mesh(mergeGeos([
      place(box(2.6, 1.5, 2.6, true), 0, 0, 0, 0, 0, 0, 0xcf6320),
      place(box(3.2, 0.3, 3.2, true), 0, 1.5, 0, 0, 0, 0, 0x8b9299)
    ]), m.props));

    // jib: instanced lattice bays
    const jibBay = latticeX(1.15, 2.4, 0.12);
    const jib = new THREE.InstancedMesh(jibBay, m.crane, 14);
    jib.castShadow = true;
    for (let i = 0; i < 14; i++) { pv.set(1.4 + i * 2.4, 2.35, 0); qq.identity(); sv.setScalar(1); mt.compose(pv, qq, sv); jib.setMatrixAt(i, mt); }
    jib.instanceMatrix.needsUpdate = true;
    top.add(jib);
    const cjib = new THREE.InstancedMesh(latticeX(1.4, 2.4, 0.13), m.crane, 5);
    cjib.castShadow = true;
    for (let i = 0; i < 5; i++) { pv.set(-1.4 - i * 2.4, 2.35, 0); qq.setFromAxisAngle(YAX, Math.PI); sv.setScalar(1); mt.compose(pv, qq, sv); cjib.setMatrixAt(i, mt); }
    cjib.instanceMatrix.needsUpdate = true;
    top.add(cjib);

    const cwParts = [];
    for (let i = 0; i < 4; i++) cwParts.push(place(box(0.7, 2.6, 3, true), -12.4 + i * 0.75, 1.1, 0, 0, 0, 0, 0xb9b4a8));
    cwParts.push(place(box(3.6, 0.3, 3.2, true), -11.4, 0.8, 0, 0, 0, 0, 0x8b9299));
    const cw = new THREE.Mesh(mergeGeos(cwParts), m.props);
    cw.castShadow = true;
    top.add(cw);

    const cabin = new THREE.Mesh(mergeGeos([
      place(box(2.4, 2.1, 2, true), 0, 0, 0, 0, 0, 0, 0xcf6320),
      place(box(2.1, 1.2, 0.08, true), 0, 0.6, 1.02, 0, 0, 0, 0x2b3340),
      place(box(0.08, 1.2, 1.8, true), 1.22, 0.6, 0, 0, 0, 0, 0x2b3340),
      place(box(2.6, 0.14, 2.2, true), 0, 2.1, 0, 0, 0, 0, 0x9aa0a6)
    ]), m.props);
    cabin.position.set(3, 1.6, 1.5);
    cabin.castShadow = true;
    top.add(cabin);

    const apex = new THREE.Mesh(latticeY(1, 7, 0.11), m.crane);
    apex.position.y = 2.6;
    apex.castShadow = true;
    top.add(apex);

    const pend = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0.4, 9.6, 0.4), new THREE.Vector3(17, 2.9, 0.4),
      new THREE.Vector3(0.4, 9.6, -0.4), new THREE.Vector3(17, 2.9, -0.4),
      new THREE.Vector3(0.4, 9.6, 0.4), new THREE.Vector3(34, 2.9, 0.35),
      new THREE.Vector3(0.4, 9.6, -0.4), new THREE.Vector3(34, 2.9, -0.35),
      new THREE.Vector3(0, 9.6, 0), new THREE.Vector3(-12.6, 2.9, 0)
    ]), new THREE.LineBasicMaterial({ color: 0x8d939b }));
    top.add(pend);

    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshStandardMaterial({ color: 0xff3b1f, emissive: 0xff3b1f, emissiveIntensity: 2 }));
    beacon.position.y = 9.9;
    top.add(beacon);
    this.beacon = beacon;

    const trolley = new THREE.Mesh(mergeGeos([
      place(box(1.7, 0.6, 1.3, true), 0, 0, 0, 0, 0, 0, 0x8b9299),
      place(cyl(0.22, 0.22, 0.16, 8, false), -0.55, 0.68, 0, 0, 0, Math.PI / 2, 0x6f767e),
      place(cyl(0.22, 0.22, 0.16, 8, false), 0.55, 0.68, 0, 0, 0, Math.PI / 2, 0x6f767e)
    ]), m.props);
    trolley.position.set(16, 1.75, 0);
    trolley.castShadow = true;
    top.add(trolley);
    this.trolley = trolley;

    const rope = new THREE.Mesh(cyl(0.045, 0.045, 1, 5, false), m.galv);
    rope.geometry.translate(0, -0.5, 0);
    trolley.add(rope);
    this.rope = rope;

    const swing = new THREE.Group();
    trolley.add(swing);
    this.swing = swing;
    const hook = new THREE.Mesh(mergeGeos([
      place(box(0.7, 0.5, 0.35, true), 0, 0, 0, 0, 0, 0, 0x6f767e),
      place(cyl(0.26, 0.26, 0.12, 10, false), -0.2, 0.28, 0, 0, 0, Math.PI / 2, 0x8b9299),
      place(cyl(0.26, 0.26, 0.12, 10, false), 0.2, 0.28, 0, 0, 0, Math.PI / 2, 0x8b9299),
      place(new THREE.TorusGeometry(0.22, 0.06, 6, 10, 4.4), 0, -0.28, 0, Math.PI / 2, 0, 0, 0x8b9299)
    ]), m.props);
    hook.castShadow = true;
    swing.add(hook);
    const load = new THREE.Mesh(mergeGeos([
      place(iBeamH(7, 0.5, 0.32, 0.05, 0.07), 0, -1.1, 0.28, 0, 0, 0, 0x98a0a8),
      place(iBeamH(7, 0.5, 0.32, 0.05, 0.07), 0, -1.1, -0.28, 0, 0, 0, 0x98a0a8)
    ]), m.propsMetal);
    load.castShadow = true;
    swing.add(load);
    this.load = load;
    const slings = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -0.3, 0), new THREE.Vector3(-2.6, -1.1, 0),
      new THREE.Vector3(0, -0.3, 0), new THREE.Vector3(2.6, -1.1, 0)
    ]), new THREE.LineBasicMaterial({ color: 0x6f767e }));
    swing.add(slings);

    const flag = new THREE.Mesh(mergeGeos([
      place(cyl(0.06, 0.06, 3, 6, true), 0, 0, 0, 0, 0, 0, 0x8d939b),
      place(box(2.2, 1.3, 0.05, true), 1.2, 1.6, 0, 0, 0, 0, 0x2f7d4a),
      place(box(0.7, 1.3, 0.06, true), 0.45, 1.6, 0.01, 0, 0, 0, 0xe8e6e0)
    ]), m.props);
    flag.position.set(33, 2.9, 0);
    flag.visible = false;
    top.add(flag);
    this.flag = flag;

    /* ---------------- crawler crane ---------------- */
    const crawler = new THREE.Group();
    crawler.position.set(-20, 0.2, -2);
    crawler.rotation.y = -0.2;
    scene.add(crawler);
    crawler.add(new THREE.Mesh(mergeGeos([
      place(box(7, 1.1, 1.5, true), 0, 0, 2.1, 0, 0, 0, 0x24272b),
      place(box(7, 1.1, 1.5, true), 0, 0, -2.1, 0, 0, 0, 0x24272b),
      place(box(6, 0.6, 4.4, true), 0, 1.1, 0, 0, 0, 0, 0x3a3f45),
      place(box(4.6, 2.2, 3.6, true), -0.6, 1.7, 0, 0, 0, 0, 0xcf6320),
      place(box(1.6, 1.8, 1.6, true), 1.8, 1.7, 1, 0, 0, 0, 0x2b3340),
      place(box(1.6, 2, 3.4, true), -3, 1.7, 0, 0, 0, 0, 0x53585f)
    ]), m.props));
    const cboom = new THREE.Group();
    cboom.position.set(1.6, 2.6, 0);
    cboom.rotation.z = 1.02;
    const cbSec = new THREE.InstancedMesh(latticeX(1.3, 3, 0.12), m.crane, 9);
    cbSec.castShadow = true;
    for (let i = 0; i < 9; i++) { pv.set(i * 3, 0, 0); qq.identity(); sv.setScalar(1); mt.compose(pv, qq, sv); cbSec.setMatrixAt(i, mt); }
    cbSec.instanceMatrix.needsUpdate = true;
    cboom.add(cbSec);
    cboom.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(27, 0, 0), new THREE.Vector3(27, -6, 0)
    ]), new THREE.LineBasicMaterial({ color: 0x8d939b })));
    const cHook = new THREE.Mesh(box(0.5, 0.8, 0.4, true), m.galv);
    cHook.position.set(27, -6.6, 0);
    cboom.add(cHook);
    crawler.add(cboom);
    crawler.traverse(o => { o.castShadow = true; });
    this.crawler = crawler; this.crawlerBoom = cboom;

    /* ---------------- crew ---------------- */
    const vest = 0xf07a12, tro = 0x2f3a4a, boot = 0x2a2620, skin = 0xc99a72, hat = 0xf0eee7;
    const torsoGeo = mergeGeos([
      place(box(0.46, 0.62, 0.28, true), 0, 0, 0, 0, 0, 0, vest),
      place(box(0.48, 0.1, 0.3, true), 0, 0.16, 0, 0, 0, 0, 0xe8e6e0),
      place(box(0.48, 0.1, 0.3, true), 0, 0.38, 0, 0, 0, 0, 0xe8e6e0),
      place(cyl(0.09, 0.09, 0.12, 6, true), 0, 0.62, 0, 0, 0, 0, skin),
      place(new THREE.SphereGeometry(0.13, 8, 6), 0, 0.86, 0, 0, 0, 0, skin),
      place(new THREE.SphereGeometry(0.17, 10, 6, 0, 6.3, 0, 1.1), 0, 0.88, 0, 0, 0, 0, hat),
      place(cyl(0.19, 0.19, 0.035, 10, false), 0, 0.885, 0.05, 0, 0, 0, hat)
    ]);
    const limbGeo = (side) => mergeGeos([
      place(box(0.15, 0.48, 0.17, false), side * 0.12, -0.24, 0, 0, 0, 0, tro),
      place(box(0.17, 0.1, 0.24, false), side * 0.12, -0.44, 0.04, 0, 0, 0, boot)
    ]);
    const armGeo = (side) => mergeGeos([
      place(box(0.11, 0.44, 0.13, false), side * 0.29, -0.2, 0, 0, 0, 0, vest),
      place(new THREE.SphereGeometry(0.07, 6, 5), side * 0.29, -0.42, 0, 0, 0, 0, skin)
    ]);
    const lLeg = limbGeo(-1), rLeg = limbGeo(1), lArm = armGeo(-1), rArm = armGeo(1);
    this.workers = [];
    for (let i = 0; i < 13; i++) {
      const g = new THREE.Group();
      const torso = new THREE.Mesh(torsoGeo, m.crew);
      torso.position.y = 0.52;
      torso.castShadow = true;
      const l1 = new THREE.Mesh(lLeg, m.crew), l2 = new THREE.Mesh(rLeg, m.crew);
      const a1 = new THREE.Mesh(lArm, m.crew), a2 = new THREE.Mesh(rArm, m.crew);
      l1.position.y = 0.52; l2.position.y = 0.52;
      a1.position.y = 1.12; a2.position.y = 1.12;
      l1.castShadow = l2.castShadow = true;
      g.add(torso, l1, l2, a1, a2);
      scene.add(g);
      this.workers.push({
        g, l1, l2, a1, a2,
        ox: -2.5 + rnd() * 12.5, oz: (rnd() - 0.5) * (D - 3.5),
        tx: -2.5 + rnd() * 12.5, tz: (rnd() - 0.5) * (D - 3.5),
        lag: i % 3, ph: rnd() * 6.28, ground: i >= 9,
        gr: 13 + rnd() * 6, ga: rnd() * 6.28
      });
    }

    /* ---------------- dust ---------------- */
    const dn = 240, dp = new Float32Array(dn * 3);
    this.dustSeed = [];
    for (let i = 0; i < dn; i++) {
      const a = rnd() * 6.28, r = rnd() * 34;
      dp[i * 3] = Math.cos(a) * r; dp[i * 3 + 1] = rnd() * 16; dp[i * 3 + 2] = Math.sin(a) * r;
      this.dustSeed.push(rnd());
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
    const dust = new THREE.Points(dg, new THREE.PointsMaterial({
      map: dustTex(), size: 0.5, transparent: true, opacity: 0.24, depthWrite: false, sizeAttenuation: true, color: 0xd9cfb6
    }));
    scene.add(dust);
    this.dust = dust;

    // welding sparks on the active deck (guided mode, while building)
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(5 * 3), 3));
    const sparks = new THREE.Points(sg, new THREE.PointsMaterial({
      map: dustTex(), size: 1.3, transparent: true, opacity: 0, depthWrite: false, color: 0xffc36a, blending: THREE.AdditiveBlending
    }));
    sparks.visible = false;
    sparks.frustumCulled = false;
    scene.add(sparks);
    this.sparks = sparks;

    /* ---------------- cursor: survey reticle probe + stakes ---------------- */
    this.pointer = new THREE.Vector2(0, 0);
    this.pointerSm = new THREE.Vector2(0, 0);
    this.ray = new THREE.Raycaster();
    this._v2 = new THREE.Vector2();

    ground.userData.label = 'GRADE · NATURAL GROUND';
    pad.userData.label = 'SITE PAD · 20MM GRANULAR';
    road.userData.label = 'ACCESS ROAD';
    hoarding.userData.label = 'PERIMETER HOARDING';
    propMesh.userData.label = 'SITE ESTABLISHMENT';
    pm.userData.label = 'MATERIAL LAYDOWN';
    this.found.userData.label = 'RAFT FOUNDATION';
    this.piles.userData.label = 'PILE CAPS · CFA PILES';
    this.core.userData.label = 'LIFT CORE · C40 CONCRETE';
    // struck once the tower is complete: hoarding, laydown, site establishment, hoist cage, signage
    this.siteKit = [hoarding, hoardPosts, propMesh, pm, sign, this.exc, this.crawler, this.mixer, this.pump, this.truck];
    this.pickList = [ground, pad, road, hoarding, propMesh, pm, this.found, this.piles, this.core];
    this.floors.forEach((fl, i) => {
      const n = String(i + 1).padStart(2, '0');
      fl.slab.userData.label = 'L' + n + ' SLAB · +' + ((i + 1) * FH).toFixed(1) + ' m';
      fl.pan.userData.label = 'L' + n + ' METAL DECK';
      fl.frame.userData.label = 'L' + n + ' PRIMARY STEEL';
      fl.glass.userData.label = 'L' + n + ' CURTAIN WALL';
      this.pickList.push(fl.slab, fl.pan, fl.frame, fl.glass);
    });

    const stakeGeo = mergeGeos([
      place(box(0.07, 1.5, 0.07, true), 0, 0, 0, 0, 0, 0, 0xe8e2d2),
      place(box(0.07, 0.34, 0.07, true), 0, 1.16, 0, 0, 0, 0, 0xd8452a),
      place(box(0.62, 0.34, 0.03, true), 0.34, 1.16, 0, 0, 0, 0, 0xf0efe9),
      place(cyl(0.2, 0.24, 0.05, 10, true), 0, 0, 0, 0, 0, 0, 0xd8452a)
    ]);
    this.stakes = [];
    for (let i = 0; i < 8; i++) {
      const st = new THREE.Mesh(stakeGeo, m.props);
      st.castShadow = true;
      st.visible = false;
      scene.add(st);
      this.stakes.push(st);
    }
    this.stakeN = 0;
  }

  setPointer(nx, ny) {
    if (this.pointer) this.pointer.set(nx, ny);
  }

  probe(nx, ny) {
    if (!this.ray) return null;
    this.ray.setFromCamera(this._v2.set(nx, ny), this.cam);
    const hits = this.ray.intersectObjects(this.pickList, false);
    for (let i = 0; i < hits.length; i++) {
      let o = hits[i].object, vis = true;
      while (o) { if (!o.visible) { vis = false; break; } o = o.parent; }
      if (!vis) continue;
      const pt = hits[i].point;
      return { label: hits[i].object.userData.label || 'STRUCTURE', x: pt.x, y: pt.y, z: pt.z, dist: hits[i].distance };
    }
    return null;
  }

  plantStake(nx, ny) {
    const h = this.probe(nx, ny);
    if (!h || h.dist > 260) return null;
    const st = this.stakes[this.stakeN % this.stakes.length];
    st.position.set(h.x, h.y + 0.01, h.z);
    st.rotation.y = Math.random() * 6.28;
    st.visible = true;
    this.stakeN++;
    return { n: this.stakeN, label: h.label, x: h.x, y: h.y, z: h.z };
  }

  _resize() {
    const w = this.clientWidth || 1, h = this.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.cam.aspect = w / h;
    this.cam.updateProjectionMatrix();
  }

  /* ============================ TICK ============================ */

  _tick(now) {
    this._raf = requestAnimationFrame(this._tick);
    if (document.hidden) return;
    // never let a backwards timestamp through: it flips the smoothing factor negative,
    // and a negative lerp extrapolates the camera away from its target every frame
    const dt = Math.max(0, Math.min(0.1, this._last ? (now - this._last) / 1000 : 0.016));
    this._last = now;
    this._frame = (this._frame || 0) + 1;
    // sustained-slowness test only: ignore stalls, throttled tabs and warm-up
    if (!this._degraded) {
      const raw = (now - (this._prev || now)) / 1000;
      this._prev = now;
      if (raw > 0.028 && raw < 0.2) this._slow = (this._slow || 0) + 1; else this._slow = Math.max(0, (this._slow || 0) - 2);
      if (this._frame > 400 && this._slow > 150) this._degrade();
    }
    if (this.tw) {
      const u = c01((now - this.tw.t0) / this.tw.dur);
      this.twU = easeIO(u);
      this.p = lerp(this.tw.from, this.tw.to, this.twU);
      if (u >= 1) { this.p = this.tw.to; this.tw = null; this.dispatchEvent(new CustomEvent('built')); }
    }
    // timelapse clock: scene time runs a little fast while a build phase is underway
    this._tt = (this._tt === undefined ? now / 1000 : this._tt) + dt * (this.tw ? 1.6 : 1);
    const t = this.reduced ? 0 : this._tt;
    const p = this.p;
    const mt = this._mt, q = this._q, sv = this._sv, pv = this._pv;

    let cine, fin;
    if (this.guided) {
      this._cine += ((this.intro ? 1 : 0) - this._cine) * Math.min(1, dt * 1.4);
      if (this.reduced) this._cine = this.intro ? 1 : 0;
      cine = this._cine;
      fin = easeIO(c01((p - 0.96) / 0.04));
    } else {
      cine = this.reduced ? 0 : easeIO(c01(1 - (now - this.t0) / 5400)) * c01(1 - p / 0.05);
      fin = easeIO(c01((p - 0.84) / 0.16));
    }

    // ---- timelapse sun ----
    const dayPhase = (p * 3 + 0.18) % 1;
    const elev = lerp(Math.max(0.08, Math.sin(dayPhase * Math.PI)), 0.13, Math.max(cine, fin * 0.92));
    const az = -1.1 + dayPhase * 2.9;
    this.sun.position.set(Math.cos(az) * 105, 16 + elev * 100, Math.sin(az) * 70);
    this.sun.intensity = (this.dark ? 0.5 : 2.2) * (0.2 + elev * 0.9);
    const warm = 1 - elev;
    this.sun.color.setRGB(1, 0.95 - warm * 0.2, 0.86 - warm * 0.4);
    this.hemi.intensity = (this.dark ? 0.55 : 0.5) * (0.5 + elev * 0.75);
    this.sky.material.uniforms.sunDir.value.copy(this.sun.position).normalize();

    // ---- structure ----
    const fRaw = ((p - 0.10) / 0.80) * FLOORS;
    const fCont = c01((p - 0.10) / 0.80) * FLOORS;
    const topYc = fCont * FH; // continuous height: no step when a level completes
    let topDeck = -1;

    for (let f = 0; f < FLOORS; f++) {
      const fl = this.floors[f];
      const s = fRaw - f;
      if (s <= 0) { if (fl.grp.visible) fl.grp.visible = false; fl.t = -1; continue; }
      fl.grp.visible = true;

      const ct = c01(s / 0.5);
      if (Math.abs(ct - fl.t) > 0.002 || fl.t < 0) {
        fl.t = ct;
        let i = 0;
        for (let a = 0; a < this.nColX; a++) {
          for (let b = 0; b < this.nColZ; b++) {
            const stagger = c01(ct * 1.4 - (a + b) * 0.07);
            pv.set(-W / 2 + a * BAY, 0, -D / 2 + b * BAY);
            sv.set(1, Math.max(0.001, stagger), 1);
            q.set(0, 0, 0, 1);
            mt.compose(pv, q, sv);
            fl.cols.setMatrixAt(i++, mt);
          }
        }
        fl.cols.instanceMatrix.needsUpdate = true;
      }

      const dt = c01((s - 0.42) / 0.34);
      fl.frame.visible = dt > 0.01;
      fl.frame.scale.set(dt > 0.5 ? 1 : lerp(0.02, 1, dt * 2), 1, 1);
      const pan = c01((s - 0.62) / 0.3);
      fl.pan.visible = pan > 0.01;
      fl.pan.scale.z = Math.max(0.02, pan);
      const pour = c01((s - 0.8) / 0.42);
      fl.slab.visible = pour > 0.01;
      fl.slab.scale.x = Math.max(0.004, pour);
      const gt = c01((s - 1.5) / 0.75);
      fl.mull.visible = gt > 0.01;
      fl.mull.scale.y = Math.max(0.02, gt);
      fl.glass.visible = gt > 0.28;
      fl.glass.scale.y = Math.max(0.02, c01((gt - 0.25) / 0.75));
      fl.back.visible = fl.glass.visible;
      fl.back.scale.y = fl.glass.scale.y * 0.985;

      if (pan > 0.4) topDeck = f;
    }

    const topY = (topDeck + 1) * FH;

    // ---- foundation / piles / core ----
    const fp = c01(p / 0.09);
    this.piles.visible = p > 0.012;
    this.piles.position.y = lerp(-3.2, -1.9, c01(p / 0.05));
    this.found.visible = p > 0.045;
    this.found.scale.set(1, Math.max(0.02, c01((p - 0.045) / 0.05)), 1);

    const coreH = Math.max(1, Math.min(FLOORS * FH + 2.4, ((p - 0.06) / 0.8) * (FLOORS * FH + 2.4)));
    this.core.visible = p > 0.055;
    this.core.scale.y = Math.max(0.02, coreH);
    this.form.visible = p > 0.06 && p < 0.9;
    this.form.position.set(this.core.position.x, 0.9 + coreH + 0.4, 0);
    this.coreCage.visible = this.form.visible;
    this.coreCage.position.set(this.core.position.x, 0.9 + coreH, 0);

    // hoist climbs with the frame
    const hs = Math.max(2, Math.min(18, Math.ceil((topY + 4) / 3)));
    this.hoistSec.count = p > 0.09 ? hs : 0;
    this.hoistCage.visible = p > 0.1;
    const ride = (Math.sin(t * 0.34) * 0.5 + 0.5);
    this.hoistCage.position.y = 0.2 + ride * Math.max(0, topY - 2);

    this.plant.visible = p > 0.93;
    this.plant.position.y = FLOORS * FH + 0.36;

    // netting + guardrail ride the top decks
    for (let i = 0; i < 8; i++) {
      const n = this.nets[i];
      const lvl = topDeck - (i < 4 ? 0 : 1);
      const on = p > 0.14 && p < 0.95 && lvl >= 0;
      n.visible = on;
      if (!on) continue;
      const y = (lvl + 1) * FH + FH / 2 - 0.2;
      const j = i % 4;
      if (i < 4) {
        n.position.set(0, y, j < 2 ? D / 2 + 1.15 : -D / 2 - 1.15);
        n.rotation.set(0, 0, 0);
      } else {
        n.position.set(j < 2 ? W / 2 + 1.15 : -W / 2 - 1.15, y, 0);
        n.rotation.set(0, Math.PI / 2, 0);
      }
    }
    this.rail.visible = p > 0.13 && p < 0.96 && topDeck >= 0;
    this.rail.position.y = topY;

    this.rebar.visible = p > 0.14 && p < 0.93 && topDeck >= 0;
    this.rebar.position.y = topY + 0.16;

    // ---- plant + vehicles ----
    this.exc.visible = p < 0.13;
    if (this.exc.visible) {
      this.excHouse.rotation.y = Math.sin(t * 0.4) * 0.8;
      this.excBoom.rotation.z = 0.75 + Math.sin(t * 0.8) * 0.18;
      this.excStick.rotation.z = -1.9 + Math.sin(t * 0.8 + 1) * 0.3;
    }
    this.drum.rotation.x = t * 1.4;
    this.mixer.visible = p > 0.05 && p < 0.92;
    const pumping = p > 0.06 && p < 0.9;
    this.pump.visible = pumping;
    if (pumping) {
      this.boomA.rotation.z = lerp(0.25, 1.15, c01(topY / (FLOORS * FH)));
      this.boomB.rotation.z = -1.5 + Math.sin(t * 0.25) * 0.08;
      this.boomC.rotation.z = 0.9 + Math.sin(t * 0.3) * 0.1;
    }
    this.truck.position.z = 16 + Math.sin(t * 0.045) * 26;
    this.cargo.visible = Math.sin(t * 0.045) > -0.3;

    // ---- tower crane (erected to final height, so it never steps) ----
    this.craneTop.position.y = this.mastTop;
    const slew = Math.sin(t * 0.13) * 1.5 - 1.9 + p * 1.2;
    this.craneTop.rotation.y = slew;
    const tr = 10 + (Math.sin(t * 0.21) * 0.5 + 0.5) * 16;
    this.trolley.position.x = tr;
    const hoistY = this.craneTop.position.y + 1.75;
    const cycle = (Math.sin(t * 0.26) * 0.5 + 0.5);
    let loadY = lerp(1.5, Math.max(3, topYc + 2.5), cycle);
    // never let the rigged load pass through the structure: when the jib tip is
    // over the footprint, the load floor rises above the top deck
    const tipX = W / 2 + 13 + Math.cos(slew) * tr, tipZ = -3 - Math.sin(slew) * tr;
    const overBld = Math.abs(tipX) < W / 2 + 1.8 && Math.abs(tipZ) < D / 2 + 1.8;
    if (this._loadMin === undefined) this._loadMin = 1.5;
    this._loadMin += ((overBld ? topYc + 2.6 : 1.5) - this._loadMin) * Math.min(1, dt * 2.2);
    loadY = Math.max(loadY, this._loadMin);
    const ropeLen = Math.max(0.6, hoistY - loadY);
    this.rope.scale.y = ropeLen;
    this.swing.position.y = -ropeLen;
    this.swing.rotation.z = Math.sin(t * 0.9) * 0.035;
    this.swing.rotation.x = Math.cos(t * 0.75) * 0.03;
    this.load.visible = cycle > 0.12 && p > 0.1 && p < 0.95;
    this.flag.visible = p > 0.94;
    this.beacon.material.emissiveIntensity = (Math.sin(t * 2.2) > 0.2 ? 2.6 : 0.15) * (this.dark ? 1 : 0.4);

    this.crawlerBoom.rotation.z = 1.02 + Math.sin(t * 0.18) * 0.06;
    this.crawler.rotation.y = -0.2 + Math.sin(t * 0.1) * 0.1;
    this.crawler.visible = p < 0.55;

    // ---- crew ----
    for (let i = 0; i < this.workers.length; i++) {
      const wk = this.workers[i];
      if (this.crewLimit !== undefined && i >= this.crewLimit) { wk.g.visible = false; continue; }
      const stride = Math.sin(t * 3.2 + wk.ph);
      wk.l1.rotation.x = stride * 0.5;
      wk.l2.rotation.x = -stride * 0.5;
      wk.a1.rotation.x = -stride * 0.42;
      wk.a2.rotation.x = stride * 0.42;

      if (wk.ground) {
        wk.g.visible = p > 0.015;
        const spin = (i % 2 ? 1 : -1);
        const a = wk.ga + t * 0.07 * spin;
        wk.g.position.set(Math.cos(a) * wk.gr, 0.2, Math.sin(a) * wk.gr * 0.6);
        wk.g.rotation.y = Math.atan2(-Math.sin(a) * spin, Math.cos(a) * 0.6 * spin);
        continue;
      }
      const d = topDeck - wk.lag;
      if (d < 0 || p < 0.12 || p > 0.96) { wk.g.visible = false; continue; }
      wk.g.visible = true;
      const ph = t * 0.22 + wk.ph;
      const k = (Math.sin(ph) + 1) / 2;
      const x = lerp(wk.ox, wk.tx, k), z = lerp(wk.oz, wk.tz, k);
      wk.g.position.set(x, (d + 1) * FH + 0.24, z);
      wk.g.rotation.y = Math.atan2(wk.tx - wk.ox, wk.tz - wk.oz) + (Math.cos(ph) < 0 ? Math.PI : 0);
    }

    // ---- weld sparks while a build tween runs ----
    if (this.sparks) {
      const act = !!this.tw && topDeck >= 0 && p > 0.12 && p < 0.96;
      const sm2 = this.sparks.material;
      sm2.opacity += ((act ? 0.85 : 0) - sm2.opacity) * Math.min(1, dt * 4);
      this.sparks.visible = sm2.opacity > 0.02;
      if (act && this._frame % 4 === 0) {
        const a = this.sparks.geometry.attributes.position;
        for (let i = 0; i < a.count; i++) {
          a.setXYZ(i,
            -W / 2 + ((i * 2 + (this._frame >> 4)) % 5) * BAY,
            (topDeck + 1) * FH + 0.5 + Math.abs(Math.sin(i * 3.7 + this._frame * 0.5)) * 1.1,
            Math.sin(i * 5.3 + this._frame * 0.21) * (D / 2 - 0.5));
        }
        a.needsUpdate = true;
      }
    }

    // ---- dust + clouds (throttled) ----
    if (!this._degraded && this._frame % 3 === 0) {
      const dpos = this.dust.geometry.attributes.position;
      for (let i = 0; i < dpos.count; i++) {
        let y = dpos.getY(i) + 0.036 + this.dustSeed[i] * 0.06;
        let x = dpos.getX(i) + Math.sin(t * 0.2 + i) * 0.018 + 0.03;
        if (y > 22) y = 0.2;
        if (x > 40) x = -40;
        dpos.setY(i, y); dpos.setX(i, x);
      }
      dpos.needsUpdate = true;
    }
    if (this._frame % 8 === 0) {
      for (let i = 0; i < this.clouds.length; i++) {
        const cl = this.clouds[i];
        cl.position.x += (0.16 + i * 0.03) * (this.tw ? 1.6 : 1);
        if (cl.position.x > 560) cl.position.x = -560;
        cl.lookAt(this.cam.position.x, cl.position.y, this.cam.position.z);
      }
    }

    // ---- demobilisation: strike the site once the tower is topped out ----
    const demob = fin > 0.55;
    if (this._demob !== demob) {
      this._demob = demob;
      if (this.siteKit) this.siteKit.forEach(o => { o.userData._dm = demob; });
      if (this.stakes) this.stakes.forEach(s => { if (demob) s.visible = false; });
    }
    if (demob) {
      if (this.siteKit) this.siteKit.forEach(o => { o.visible = false; });
      this.crane.visible = false;
      this.hoistSec.count = 0;
      this.hoistCage.visible = false;
      this.form.visible = false;
      this.coreCage.visible = false;
      this.rail.visible = false;
      this.rebar.visible = false;
      this.nets.forEach(n => { n.visible = false; });
      this.dust.visible = false;
      if (this.sparks) this.sparks.visible = false;
      this.workers.forEach(wk => { wk.g.visible = false; });
    } else if (this._wasDemob) {
      if (this.siteKit) this.siteKit.forEach(o => { o.visible = true; });
      this.crane.visible = true;
      if (!this._degraded) this.dust.visible = true;
    }
    this._wasDemob = demob;

    // ---- camera ----
    let theta, radius, camY, aimY, fov;
    if (this.guided) {
      const bh = Math.max(2.5, topYc);
      const focused = this.focusY != null;
      // rest on EITHER long facade (the plan is symmetric): normalising to the nearest
      // half-turn lets a phase's 180° spin settle where it lands instead of snapping back
      const thT = Math.PI / 2 + Math.sin(t * 0.028) * 0.12 * (1 - fin) - cine * 0.38;
      if (this.tw) this._theta = (this._spinFrom === undefined ? this._theta : this._spinFrom) + (this.twU || 0) * Math.PI;
      else if (!focused) {
        const tgt = thT + Math.round((this._theta - thT) / Math.PI) * Math.PI;
        this._theta += (tgt - this._theta) * Math.min(1, dt * 0.4);
      } else this._theta += dt * 0.003;
      theta = this._theta;
      if (focused) {
        radius = 45 + Math.sin(t * 0.05) * 0.7;
        camY = this.focusY + 6.5;
        aimY = Math.max(2, this.focusY - 1.6);
        fov = 34;
      } else {
        radius = 47 + bh * 0.92 + Math.sin(t * 0.045) * 0.9;
        camY = 9.5 + bh * 0.8;
        aimY = 2.2 + bh * 0.52;
        fov = 36;
      }
      if (cine > 0.001) { radius = lerp(radius, 205, cine); camY = lerp(camY, 4.6, cine); aimY = lerp(aimY, 9, cine); fov = lerp(fov, 25, cine); }
      // topped out: long-facade elevation, flatter lens, whole tower in frame
      if (!focused && fin > 0.001) { radius = lerp(radius, 168, fin); camY = lerp(camY, 25, fin); aimY = lerp(aimY, 19.5, fin); fov = lerp(fov, 26, fin); }
    } else {
      const e = easeIO(p);
      theta = -0.7 + p * Math.PI * 2.45 + t * 0.012;
      radius = lerp(80, 48, e) + Math.sin(p * Math.PI * 2) * 6;
      camY = lerp(11, topYc + 20, Math.pow(p, 0.82));
      aimY = lerp(3, topYc * 0.58 + 4, e);
      fov = 38;
      if (cine > 0.001) {
        theta -= cine * 0.66;
        radius = lerp(radius, 210, cine);
        camY = lerp(camY, 4.2, cine);
        aimY = lerp(aimY, 8, cine);
        fov = lerp(fov, 25, cine);
      }
      if (fin > 0.001) {
        theta += fin * 0.28;
        radius = lerp(radius, 136, fin);
        camY = lerp(camY, 13, fin);
        aimY = lerp(aimY, topYc * 0.5, fin);
        fov = lerp(fov, 30, fin);
      }
    }
    if (Math.abs(fov - this._fov) > 0.05) { this._fov = fov; this.cam.fov = fov; this.cam.updateProjectionMatrix(); }

    // cursor parallax: the site leans a little toward the pointer
    this.pointerSm.x += (this.pointer.x - this.pointerSm.x) * Math.min(1, dt * 1.5);
    this.pointerSm.y += (this.pointer.y - this.pointerSm.y) * Math.min(1, dt * 1.5);
    theta += this.pointerSm.x * 0.03;
    camY += this.pointerSm.y * 1.6;
    aimY -= this.pointerSm.y * 0.9;

    this.camPos.set(Math.cos(theta) * radius, camY, Math.sin(theta) * radius);
    this.camAim.set(0, aimY, 0);
    if (this.guided) {
      this._shift += (this.shiftT - this._shift) * Math.min(1, dt * 1.3);
      if (Math.abs(this._shift) > 0.002) {
        const amt = this._shift * radius * 0.3;
        this.camAim.x += Math.sin(theta) * amt;
        this.camAim.z += -Math.cos(theta) * amt;
      }
    }
    const k = this.reduced || this._first ? 1 : 1 - Math.exp(-dt * (this.guided ? 1.4 : 3.1));
    this._first = false;
    if (!this._aimSm) this._aimSm = this.camAim.clone();
    this._aimSm.lerp(this.camAim, k);
    this.cam.position.lerp(this.camPos, k);
    this.cam.lookAt(this._aimSm);
    this.sun.target.position.set(0, topYc * 0.4, 0);
    this.sun.target.updateMatrixWorld();

    this.renderer.render(this.scene, this.cam);
  }

  _degrade() {
    this._degraded = true;
    this.renderer.setPixelRatio(1);
    this.sun.shadow.mapSize.set(1024, 1024);
    if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.needsUpdate = true;
    this.dust.visible = false;
    this.clouds.forEach((c, i) => { if (i > 2) c.visible = false; });
    this.crewLimit = 7;
    this._resize();
  }
}

if (!customElements.get('building-scene')) customElements.define('building-scene', BuildingScene);
