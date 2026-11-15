/* Smoke test for assets/js/trail.js. Plain Node, stub DOM, fake clock:

     node tools/test-trail.mjs

   It checks the contract the page relies on: the trail only starts for a real
   mouse with motion allowed, every style draws and then fades to nothing, the
   animation loop stops when there is nothing left, and the item count is capped. */

import assert from 'node:assert/strict';

let clock = 0;
let fine = true, reduce = false;
let canvasMade = 0, canvasRemoved = 0;
const rafQueue = [];
const listeners = { window: {}, document: {} };
const calls = { draw: 0 };
const DRAWS = new Set(['stroke', 'fill', 'fillRect', 'strokeRect', 'arc', 'lineTo', 'rect']);

/* A 2D context that accepts any call, counts the ones that put pixels down,
   and hands back something gradient-shaped. */
const ctx = new Proxy({}, {
  get(target, prop) {
    if (prop in target) return target[prop];
    return () => { if (DRAWS.has(prop)) calls.draw++; return { addColorStop() {} }; };
  },
  set(target, prop, value) { target[prop] = value; return true; }
});
const canvas = {
  style: {}, width: 0, height: 0, className: '', dataset: {},
  setAttribute() {}, getContext: () => ctx, remove() { canvasRemoved++; }
};

const on = t => (type, fn) => { (listeners[t][type] ||= []).push(fn); };
const off = t => (type, fn) => {
  const a = listeners[t][type] || [], i = a.indexOf(fn);
  if (i >= 0) a.splice(i, 1);
};

globalThis.window = globalThis;
globalThis.innerWidth = 1280;
globalThis.innerHeight = 800;
globalThis.devicePixelRatio = 2;
globalThis.addEventListener = on('window');
globalThis.removeEventListener = off('window');
globalThis.matchMedia = q => ({
  matches: q.includes('reduce') ? reduce : fine, addEventListener() {}, removeEventListener() {}
});
globalThis.requestAnimationFrame = fn => { rafQueue.push(fn); return rafQueue.length; };
globalThis.cancelAnimationFrame = () => { rafQueue.length = 0; };
Object.defineProperty(globalThis, 'performance', { value: { now: () => clock }, configurable: true });
globalThis.document = {
  hidden: false, visibilityState: 'visible',
  createElement(tag) { assert.equal(tag, 'canvas'); canvasMade++; return canvas; },
  body: { appendChild() {}, append() {} },
  documentElement: { appendChild() {}, append() {} },
  addEventListener: on('document'), removeEventListener: off('document')
};

const fire = (type, e) => {
  for (const t of ['window', 'document']) (listeners[t][type] || []).slice().forEach(fn => fn(e));
};
const move = (x, y, pointerType = 'mouse') => fire('pointermove', { clientX: x, clientY: y, pointerType });
const frame = () => { rafQueue.splice(0).forEach(fn => fn(clock)); };
/* Let time pass with the pointer still. */
const run = (ms, step = 16) => { for (let t = 0; t < ms; t += step) { clock += step; frame(); } };
/* One continuous mouse stroke: n moves, 16 ms and 6 px apart. */
const sweep = (n, x0 = 100, y0 = 300) => {
  for (let i = 0; i < n; i++) { clock += 16; move(x0 + i * 6, y0 + Math.sin(i / 5) * 40); frame(); }
};
const listening = () =>
  (listeners.window.pointermove || []).length + (listeners.document.pointermove || []).length;

const { startTrail } = await import('../assets/js/trail.js');

/* 1. Guards: no trail for reduced motion or a coarse pointer, and no canvas made. */
reduce = true;
assert.equal(startTrail(), null, 'reduced motion: no trail');
reduce = false; fine = false;
assert.equal(startTrail(), null, 'coarse pointer: no trail');
fine = true;
assert.equal(startTrail({ reducedMotion: true }), null, 'reducedMotion option: no trail');
assert.equal(canvasMade, 0, 'guards must not create a canvas');

/* 2. Every style draws while the mouse moves, then fades out and goes idle. */
for (const m of ['line', 'heat', 'points', 'ink']) {
  const trail = startTrail({ mode: () => m });
  assert.ok(trail && typeof trail.stop === 'function' && typeof trail.count === 'function',
    `${m}: startTrail returns { stop, count }`);
  calls.draw = 0;
  sweep(120);
  assert.ok(trail.count() > 0, `${m}: has live items while moving`);
  assert.ok(calls.draw > 0, `${m}: drew something`);
  run(4000);
  assert.equal(trail.count(), 0, `${m}: everything fades out within 4 s`);
  assert.equal(rafQueue.length, 0, `${m}: loop stops when idle`);
  trail.stop();
}

/* 3. The mode callback is given the pointer position. */
{
  let seen = null;
  const trail = startTrail({ mode: (x, y) => { seen = [x, y]; return 'ink'; } });
  move(321, 123);
  assert.deepEqual(seen, [321, 123], 'mode(x, y) receives clientX, clientY');
  trail.stop();
}

/* 4. Touch and pen input leave no trail. */
{
  const trail = startTrail({ mode: () => 'points' });
  for (let i = 0; i < 50; i++) { clock += 16; move(10 + i * 9, 50, 'touch'); move(10 + i * 9, 90, 'pen'); }
  assert.equal(trail.count(), 0, 'touch and pen are ignored');
  trail.stop();
}

/* 5. Hard cap on live items, however fast the pointer moves. */
{
  const trail = startTrail({ mode: () => 'points' });
  for (let i = 0; i < 6000; i++) { clock += 1; move((i * 37) % 1200, (i * 91) % 700); }
  assert.ok(trail.count() <= 600, `cap: ${trail.count()} <= 600`);
  trail.stop();
}

/* 6. 'none' leaves no marks; an unknown mode falls back to ink. */
{
  const trail = startTrail({ mode: () => 'none' });
  sweep(40);
  assert.equal(trail.count(), 0, "'none' draws nothing");
  trail.stop();
}
{
  const trail = startTrail({ mode: () => 'bogus' });
  sweep(40);
  assert.ok(trail.count() > 0, 'unknown mode falls back to ink');
  trail.stop();
}

/* 7. stop() removes the canvas and listeners and schedules nothing more. */
{
  const before = canvasRemoved;
  const trail = startTrail();
  sweep(20);
  trail.stop();
  assert.equal(canvasRemoved, before + 1, 'stop removes the canvas');
  assert.equal(listening(), 0, 'stop removes the pointermove listener');
  rafQueue.length = 0;
  move(5, 5);
  assert.equal(rafQueue.length, 0, 'no frames requested after stop');
}

/* 8. A hidden tab clears the trail. */
{
  const trail = startTrail({ mode: () => 'heat' });
  sweep(60);
  document.hidden = true; document.visibilityState = 'hidden';
  fire('visibilitychange', {});
  assert.equal(trail.count(), 0, 'hidden tab clears the trail');
  document.hidden = false; document.visibilityState = 'visible';
  trail.stop();
}

console.log('trail.js: all checks passed');
