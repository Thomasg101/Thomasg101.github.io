/* Page controller.

   The page is an ordinary scrolling document. This file only decides what the
   model behind it should look like for the current scroll position, and wires
   the three controls (drift slider, retrofit switch, search queries) to it.
   Nothing is gated: every word is readable without the model, and scrolling is
   never taken over. */

import { BuildingScene } from './scene.js';
import { startTrail } from './trail.js';

const root = document.documentElement;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const wide = matchMedia('(min-width: 900px)');

const clamp01 = v => Math.min(1, Math.max(0, v));
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

/* ------------------------------------------------------- scene presets -- */

/* What the model looks like while each section is on screen. Angles are in
   degrees, distances in metres; `dark` picks the ground colour. */
const PRESETS = {
  hero:      { envelope: 1, found: 0, thermal: 0, dissolve: 0, groundAlpha: 1,    shadow: 0.2,  az: 38,  el: 9,  dist: 112, ty: 17, dark: 0 },
  structure: { envelope: 0, found: 1, thermal: 0, dissolve: 0, groundAlpha: 0.2,  shadow: 0.08, az: -30, el: 7,  dist: 120, ty: 10, dark: 0 },
  envelope:  { envelope: 1, found: 0, thermal: 1, dissolve: 0, groundAlpha: 1,    shadow: 0,    az: 30,  el: 10, dist: 102, ty: 18, dark: 1 },
  code:      { envelope: 1, found: 0, thermal: 0, dissolve: 1, groundAlpha: 1,    shadow: 0,    az: 62,  el: 26, dist: 108, ty: 18, dark: 1 },
  cover:     { envelope: 1, found: 0, thermal: 0, dissolve: 1, groundAlpha: 1,    shadow: 0,    az: 62,  el: 26, dist: 108, ty: 18, dark: 1 },
  contact:   { envelope: 1, found: 0, thermal: 0, dissolve: 0, groundAlpha: 1,    shadow: 0.2,  az: 34,  el: 5,  dist: 112, ty: 16, dark: 0 }
};

/* Not everything changes at the same moment between two sections. The ground
   colour flips in a narrow band in the middle, when no text is on screen; the
   cladding leads and the thermal sweep follows it. */
const WINDOW = {
  dark: [0.37, 0.63], envelope: [0, 0.78], thermal: [0.3, 1], dissolve: [0.12, 0.9],
  found: [0.1, 0.95], groundAlpha: [0.1, 0.8]
};

const LIGHT = { bg: [0.89, 0.898, 0.886], line: [0.62, 0.64, 0.63] };
const DARK = { bg: [0.043, 0.051, 0.11], line: [0.2, 0.23, 0.4] };

const QUERIES = [
  { q: 'blue waterproofing membrane at the north parapet', img: 'north-parapet', loc: 'Main roof, north parapet', pct: 96,
    alt: 'Blue liquid-applied waterproofing turned up a concrete parapet upstand',
    text: 'Blue liquid-applied waterproofing turned up the north parapet upstand, terminating on concrete.' },
  { q: 'rooftop unit nameplate RTU-3', img: 'rtu3-nameplate', loc: 'Level 03, mechanical room', pct: 98,
    alt: 'Stainless nameplate reading RTU-3 on a grey mechanical unit casing',
    text: 'Stainless nameplate on a grey rooftop unit casing. Text read from the photo: “RTU-3”.' },
  { q: 'base flashing lap lifting, adhesion loss', img: 'flashing-adhesion', loc: 'Main roof, north-east corner', pct: 95,
    alt: 'EPDM base flashing with a debonded lap lifting away from the substrate',
    text: 'EPDM base flashing with a debonded lap lifting away from the substrate. Severity estimated moderate.' },
  { q: 'roof hatch curb termination bar', img: 'epdm-hatch-curb', loc: 'Main roof, roof hatch', pct: 97,
    alt: 'EPDM membrane wrapped up a galvanized roof-hatch curb with a termination bar',
    text: 'EPDM membrane wrapped up a galvanized roof-hatch curb, secured with a fastened termination bar.' }
];

const RETROFIT_NOTE = [
  'As built: slab edges, balconies and parapets run straight through the insulation, so that is where the heat leaves.',
  'Retrofit: thermal breaks at the balconies and continuous insulation over the slab edges and parapets cut the loss at each junction.'
];

/* --------------------------------------------------------------- page -- */

const stage = $('#stage');
const canvas = $('#scene');
const nav = $('#nav');
const cover = $('#cover');
const sections = $$('main [data-scene]');
const beats = $$('.beat');
const tags = $$('.tag');
const navLinks = $$('.nav-links a');
const progress = $('#progress');

/* The mouse trail is drawn in the material of the reading it is over. */
const TRAIL = { hero: 'line', structure: 'line', contact: 'line', envelope: 'heat', code: 'points', cover: 'ink' };
let trailScene = 'line', coverTop = Infinity, coverBottom = -Infinity;

let scene = null;
try {
  scene = new BuildingScene(canvas, { reducedMotion: reduced });
} catch (err) {
  root.classList.add('no-gl');       /* the page is complete without it */
}

/* Section and text positions, measured once per layout rather than per frame. */
let metrics = [], beatMetrics = [], vh = innerHeight, stageH = innerHeight, docH = 1;
function measure() {
  vh = innerHeight;
  stageH = stage.clientHeight || vh;
  docH = Math.max(1, root.scrollHeight - vh);
  const y = scrollY;
  metrics = sections.map(el => {
    const r = el.getBoundingClientRect();
    return { el, name: el.dataset.scene, top: r.top + y, bottom: r.bottom + y };
  });
  beatMetrics = beats.map(el => {
    const r = el.getBoundingClientRect();
    return { el, top: r.top + y, bottom: r.bottom + y, o: -1 };
  });
  if (scene) {
    scene.resize(stage.clientWidth, stageH, Math.min(devicePixelRatio || 1, 2));
  }
}

/* Which two sections the reader is between, and how far. On wide screens the
   reference line is the middle of the window; on narrow ones it is the bottom
   edge of the pinned model, where a new section first slides under it. */
function locate() {
  const isWide = wide.matches;
  const line = scrollY + (isWide ? vh * 0.5 : stageH + vh * 0.08);
  const zone = vh * (isWide ? 0.38 : 0.3);
  let i = metrics.findIndex(m => line < m.bottom);
  if (i < 0) i = metrics.length - 1;
  const m = metrics[i];
  if (i < metrics.length - 1 && line > m.bottom - zone) {
    return { a: i, b: i + 1, t: (line - (m.bottom - zone)) / (2 * zone) };
  }
  if (i > 0 && line < m.top + zone) {
    return { a: i - 1, b: i, t: (line - (m.top - zone)) / (2 * zone) };
  }
  return { a: i, b: i, t: 0 };
}

function blend(where) {
  const A = PRESETS[metrics[where.a].name], B = PRESETS[metrics[where.b].name];
  const out = {};
  for (const k in A) {
    const w = WINDOW[k] || [0, 1];
    out[k] = A[k] + (B[k] - A[k]) * smooth(w[0], w[1], where.t);
  }
  return out;
}

let drag = 0, parallax = 0, tilt = 0;
function steer(where) {
  const s = blend(where);
  const d = s.dark;
  const isWide = wide.matches;
  /* Wide: the model sits right of the text column. Narrow: it has its own
     window, and only needs to clear the navigation bar. */
  const shiftX = isWide ? 0.22 : 0;
  scene.fit = isWide ? 1.62 : 1.06;
  scene.set({
    envelope: s.envelope, found: s.found, thermal: s.thermal, dissolve: s.dissolve,
    groundAlpha: s.groundAlpha, shadow: s.shadow,
    az: s.az, el: s.el, dist: s.dist * (isWide ? 1 : 1.04), ty: s.ty,
    shiftX, shiftY: isWide ? 0 : 0.035,
    pAz: parallax + drag, pEl: tilt,
    /* The lean belongs to the Structure chapter alone: it fades with the
       chapter's weight, so no other reading ever inherits a racked frame. */
    sway: swayPos * SWAY_MAX * smooth(0.25, 0.75, weight(where, 'structure')),
    bgR: LIGHT.bg[0] + (DARK.bg[0] - LIGHT.bg[0]) * d,
    bgG: LIGHT.bg[1] + (DARK.bg[1] - LIGHT.bg[1]) * d,
    bgB: LIGHT.bg[2] + (DARK.bg[2] - LIGHT.bg[2]) * d,
    lnR: LIGHT.line[0] + (DARK.line[0] - LIGHT.line[0]) * d,
    lnG: LIGHT.line[1] + (DARK.line[1] - LIGHT.line[1]) * d,
    lnB: LIGHT.line[2] + (DARK.line[2] - LIGHT.line[2]) * d
  });
}

/* How much of a named section is "on": 1 while it is the only one in play. */
const weight = (where, name) =>
  (metrics[where.a].name === name ? 1 - where.t : 0) + (metrics[where.b].name === name ? where.t : 0);

let lastGround = '', lastStageGround = '', lastNavGround = '', lastOver = '', lastCurrent = '', lastProgress = -1;
function paintChrome(where) {
  const p = Math.round(1000 * clamp01(scrollY / docH)) / 1000;
  if (p !== lastProgress) { progress.style.transform = `scaleX(${p})`; lastProgress = p; }

  const c = scene ? scene.cur : null;
  const lum = c ? 0.3 * c.bgR + 0.59 * c.bgG + 0.11 * c.bgB : 1;
  if (c) {
    const css = `rgb(${Math.round(c.bgR * 255)} ${Math.round(c.bgG * 255)} ${Math.round(c.bgB * 255)})`;
    if (css !== lastGround) { root.style.setProperty('--live-ground', css); lastGround = css; }
  }
  const stageGround = lum < 0.45 ? 'dark' : 'light';
  if (stageGround !== lastStageGround) { stage.dataset.ground = stageGround; lastStageGround = stageGround; }

  /* The bar takes its colours from whatever is directly under it. */
  const cr = cover.getBoundingClientRect();
  const over = cr.top <= 40 && cr.bottom > 40 ? 'cover' : 'scene';
  const navGround = over === 'cover' ? 'light' : stageGround;
  if (over !== lastOver) { nav.dataset.over = over; lastOver = over; }
  if (navGround !== lastNavGround) { nav.dataset.ground = navGround; lastNavGround = navGround; }

  const dominant = metrics[where.t > 0.5 ? where.b : where.a];
  trailScene = TRAIL[dominant.name] || 'ink';
  coverTop = cr.top; coverBottom = cr.bottom;
  const current = dominant.name === 'cover' ? 'projects' : dominant.el.id;
  if (current !== lastCurrent) {
    navLinks.forEach(a => a.setAttribute('aria-current', String(a.hash === '#' + current)));
    lastCurrent = current;
  }
  return cr;
}

/* Wide screens only: text fades as it nears the top and bottom of the window,
   so the ground can change colour between sections with nothing on it. */
function fadeBeats() {
  const isWide = wide.matches, y = scrollY;
  for (const b of beatMetrics) {
    const o = isWide
      ? Math.round(100 * smooth(0.3, 0.5, (b.bottom - y) / vh) * (1 - smooth(0.5, 0.7, (b.top - y) / vh))) / 100
      : 1;
    if (o !== b.o) { b.el.style.setProperty('--o', o); b.o = o; }
  }
}

function placeTags(where) {
  for (const tag of tags) {
    const w = smooth(0.62, 0.95, weight(where, tag.dataset.scene));
    if (w <= 0.01) { if (tag.style.opacity !== '0') tag.style.opacity = '0'; continue; }
    const point = tag.dataset.anchor === 'pin' ? scene.pins[scene.activePin] : scene.anchors[tag.dataset.anchor];
    const p = scene.project(point);
    /* Labels read away from the nearer edge, and stay clear of the bar. */
    const flip = p.x > stage.clientWidth * 0.6;
    const clear = wide.matches || p.y > 76;
    tag.classList.toggle('is-flipped', flip);
    tag.style.opacity = p.visible && clear ? String(w) : '0';
    tag.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)${flip ? ' translateX(-100%)' : ''}`;
  }
}

/* --------------------------------------------------------------- loop -- */

let last = performance.now(), covered = false, nudged = false, touched = false;
function frame(now) {
  const gap = (now - last) / 1000;
  const dt = Math.min(0.05, gap);
  last = now;
  const where = locate();
  const cr = paintChrome(where);
  fadeBeats();

  if (scene) {
    /* Nothing to draw while the resume covers the model. */
    const isCovered = cr.top <= 0 && cr.bottom >= (wide.matches ? vh : stageH);
    stepSway(dt, now, weight(where, 'structure') > 0.25);
    steer(where);
    if (!isCovered) {
      /* Coming back from behind the resume, or from a background tab, land on
         the target rather than replaying the catch-up. */
      if (covered || reduced || gap > 0.2) scene.settle();
      scene.frame(dt);
      placeTags(where);
    }
    covered = isCovered;

    if (!nudged && !touched && !reduced && weight(where, 'structure') > 0.97) {
      nudged = true;
      nudge();
    }
  }
  requestAnimationFrame(frame);
}

/* ----------------------------------------------------------- controls -- */

/* The slider says how far the frame is pushed. The frame itself is a damped
   spring: hold the thumb and it stays put, let go and it rings back to plumb
   the way a real frame does when a lateral load comes off. */
const sway = $('#sway');
const SWAY_MAX = 4.6;                    /* metres of drift at the roof, slider at 100 */
const SPRING_W = 2 * Math.PI * 1.5;      /* natural frequency of the ring-down, rad/s */
const SPRING_Z = 0.22;                   /* damping ratio: two or three visible swings */
let swayPos = 0, swayVel = 0;            /* 0..1 while held; passes through zero ringing down */
let swayHeld = false, swayKeysUntil = 0, nudging = false;

const moveThumb = () => { sway.value = Math.round(Math.max(0, swayPos) * 100); };

function stepSway(dt, now, inChapter) {
  if (!inChapter) {
    /* Scrolled away mid-push: start plumb next time, thumb back at zero. */
    if (swayPos || swayVel || sway.value !== '0') {
      swayPos = swayVel = 0; swayHeld = nudging = false; swayKeysUntil = 0; sway.value = 0;
    }
    return;
  }
  if (nudging) return;
  if (swayHeld || now < swayKeysUntil) { swayPos = sway.value / 100; swayVel = 0; return; }
  if (!swayPos && !swayVel) return;
  if (reduced) { swayPos = swayVel = 0; moveThumb(); return; }
  swayVel += (-SPRING_W * SPRING_W * swayPos - 2 * SPRING_Z * SPRING_W * swayVel) * dt;
  swayPos += swayVel * dt;
  if (Math.abs(swayPos) < 0.003 && Math.abs(swayVel) < 0.02) swayPos = swayVel = 0;
  moveThumb();
}

sway.addEventListener('pointerdown', () => { touched = true; nudging = false; swayHeld = true; });
sway.addEventListener('input', () => {
  touched = true; nudging = false;
  /* Arrow keys have no "release": hold the pose briefly, then let it go. */
  if (!swayHeld) swayKeysUntil = performance.now() + 2500;
});
sway.addEventListener('blur', () => { swayKeysUntil = 0; });
const letGo = () => { swayHeld = false; };
addEventListener('pointerup', letGo);
addEventListener('pointercancel', letGo);

/* Show once that the slider does something: push, then let it spring back. */
function nudge() {
  const start = performance.now();
  nudging = true;
  const step = now => {
    if (!nudging) return;
    const t = (now - start) / 650;
    if (t >= 1) { nudging = false; return; }
    swayPos = 0.62 * (1 - (1 - t) ** 3);
    moveThumb();
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const retrofitNote = $('#retrofit-note');
$$('input[name="retrofit"]').forEach(input => {
  input.addEventListener('change', () => {
    const v = Number(input.value);
    if (scene) scene.set({ retrofit: v });
    retrofitNote.textContent = RETROFIT_NOTE[v];
  });
});

const queryButtons = $$('[data-query]');
const pinTag = $('#pin-tag');
function runQuery(i) {
  const d = QUERIES[i];
  $('#query').textContent = d.q;
  const img = $('#hit-img');
  img.src = `./assets/projects/projectsearch-${d.img}-600.jpg`;
  img.alt = d.alt;
  $('#hit-loc').textContent = d.loc;
  $('#hit-pct').textContent = `${d.pct}% match`;
  $('#hit-text').textContent = d.text;
  pinTag.textContent = d.loc;
  queryButtons.forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.query) === i)));
  if (scene) scene.setActivePin(i);
}
queryButtons.forEach(b => b.addEventListener('click', () => runQuery(Number(b.dataset.query))));

const filterButtons = $$('[data-filter]');
const cards = $$('.card');
const tagged = (card, f) => f === 'all' || card.dataset.tags.split(' ').includes(f);
/* Each filter says how many case studies it holds before it is pressed. */
filterButtons.forEach(b => {
  const n = document.createElement('span');
  n.className = 'chip-n';
  n.textContent = cards.filter(card => tagged(card, b.dataset.filter)).length;
  b.append(n);
});
cards.forEach((card, i) => { card.style.viewTransitionName = `card-${i}`; });
function setFilter(f, animate) {
  const apply = () => {
    filterButtons.forEach(o => o.setAttribute('aria-pressed', String(o.dataset.filter === f)));
    cards.forEach(card => { card.hidden = !tagged(card, f); });
    measure();
  };
  /* Where the browser can, cards that stay slide to their new place. */
  if (animate && document.startViewTransition && !reduced) document.startViewTransition(apply);
  else apply();
}
filterButtons.forEach(b => b.addEventListener('click', () => {
  const f = b.dataset.filter;
  setFilter(f, true);
  /* The filter lives in the address, so a filtered view can be sent to someone. */
  history.replaceState(null, '', f === 'all' ? `${location.pathname}#projects` : `?work=${f}#projects`);
}));
const wanted = new URLSearchParams(location.search).get('work');
if (wanted && wanted !== 'all' && filterButtons.some(b => b.dataset.filter === wanted)) setFilter(wanted, false);

/* The resume content arrives once as it scrolls into view. The hiding is
   switched on from here, so if this script never runs nothing stays hidden. */
if (!reduced && 'IntersectionObserver' in window) {
  const targets = $$('.block-head, .card, .role, .photos li, .block--split > div');
  targets.forEach(el => el.classList.add('reveal'));
  root.classList.add('reveal-ready');
  const io = new IntersectionObserver(entries => {
    let i = 0;
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.style.setProperty('--d', `${Math.min(i++, 5) * 55}ms`);
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -8% 0px' });
  targets.forEach(el => io.observe(el));
}

/* A mouse leaves a trail: a drafting line in daylight, a heat trace on the
   thermogram, survey points on the data, plain ink over the resume. */
startTrail({
  reducedMotion: reduced,
  mode: (x, y) => (y >= coverTop && y <= coverBottom ? 'ink' : trailScene)
});

/* ------------------------------------------------------------ pointer -- */

if (scene) {
  /* A fine pointer leans the camera a few degrees toward the cursor. */
  if (!reduced && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    addEventListener('pointermove', e => {
      parallax = (e.clientX / innerWidth - 0.5) * -7;
      tilt = (e.clientY / innerHeight - 0.5) * 3;
    }, { passive: true });
    /* The pointer left the window: let the camera settle back to centre. */
    document.documentElement.addEventListener('pointerleave', () => { parallax = 0; tilt = 0; });
  }

  /* Dragging the model turns it; it eases back once released. */
  let dragging = false, startX = 0, startDrag = 0, release = 0;
  stage.addEventListener('pointerdown', e => {
    dragging = true; startX = e.clientX; startDrag = drag;
    clearTimeout(release);
    scene.rate.pAz = 16;
    stage.classList.add('is-dragging');
  });
  addEventListener('pointermove', e => {
    if (dragging) drag = startDrag + (e.clientX - startX) * 0.35;
  }, { passive: true });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    stage.classList.remove('is-dragging');
    release = setTimeout(() => { scene.rate.pAz = 2; drag = 0; }, 2200);
  };
  addEventListener('pointerup', end);
  addEventListener('pointercancel', end);
}

/* --------------------------------------------------------------- boot -- */

measure();
addEventListener('resize', measure);
wide.addEventListener('change', measure);
if ('ResizeObserver' in window) new ResizeObserver(measure).observe($('main'));
if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

if (scene) {
  steer(locate());
  /* Arriving part-way down (a link to #projects, a reload) skips the opening. */
  if (scrollY > innerHeight * 0.5) scene.build = 1;
  const keepEnvelope = scene.cur.envelope;
  scene.settle();
  if (scene.build < 1) scene.cur.envelope = keepEnvelope;
}
requestAnimationFrame(frame);
