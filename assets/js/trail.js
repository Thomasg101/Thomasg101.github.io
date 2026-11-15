/* A mouse trail, drawn four ways.

   The pointer leaves marks on one full-window canvas: a fine survey line, a
   heat bloom, a drifting point cloud, or a soft ink stroke. The page tells the
   module which style to use by handing it a mode callback; the module knows
   nothing about the page. */

const CAP = 600;
const LIFETIME = { line: 520, ink: 300, node: 900, blob: 950 };
const SPACING = { line: 5, ink: 5, heat: 9, points: 11 };
const HEAT_STOPS = [
  [0, 255, 230, 115], [0.3, 250, 140, 41], [0.55, 219, 56, 115],
  [0.8, 107, 26, 143], [1, 18, 13, 71],
];

function heat(a) {
  let i = 0;
  while (i < HEAT_STOPS.length - 1 && a > HEAT_STOPS[i + 1][0]) i++;
  const s0 = HEAT_STOPS[i], s1 = HEAT_STOPS[Math.min(i + 1, HEAT_STOPS.length - 1)];
  const span = s1[0] - s0[0] || 1;
  const f = Math.min(Math.max((a - s0[0]) / span, 0), 1);
  const r = Math.round(s0[1] + (s1[1] - s0[1]) * f);
  const g = Math.round(s0[2] + (s1[2] - s0[2]) * f);
  const b = Math.round(s0[3] + (s1[3] - s0[3]) * f);
  return `rgb(${r} ${g} ${b})`;
}

function normMode(s) {
  if (s === 'line' || s === 'heat' || s === 'points' || s === 'none') return s;
  return 'ink';
}

export function startTrail(options = {}) {
  const mode = options.mode || (() => 'ink');
  const reducedMotion = options.reducedMotion !== undefined
    ? options.reducedMotion
    : matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) return null;
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return null;

  const canvas = document.createElement('canvas');
  canvas.className = 'trail';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:20;pointer-events:none';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const pts = [], nodes = [], blobs = [], dots = [];
  let last = null, lastKind = null, carry = 0, nodeAccum = 0;
  let running = false, rafId = 0, stopped = false;

  function count() {
    return pts.length + nodes.length + blobs.length + dots.length;
  }

  function size() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function enforceCap() {
    while (count() > CAP) {
      let arr = pts, len = pts.length;
      if (nodes.length > len) { arr = nodes; len = nodes.length; }
      if (blobs.length > len) { arr = blobs; len = blobs.length; }
      if (dots.length > len) { arr = dots; len = dots.length; }
      arr.shift();
    }
  }

  function layMark(mx, my, kind, now, brk) {
    if (kind === 'line' || kind === 'ink') {
      pts.push({ x: mx, y: my, t: now, kind, brk });
      if (kind === 'line') {
        nodeAccum += 5;
        if (nodeAccum >= 64) {
          nodeAccum -= 64;
          nodes.push({ x: mx, y: my, t: now });
        }
      }
    } else if (kind === 'heat') {
      blobs.push({ x: mx, y: my, t: now });
    } else if (kind === 'points') {
      dots.push({
        x: mx, y: my,
        vx: (Math.random() - 0.5) * 28,
        vy: (Math.random() - 0.5) * 28,
        t: now,
        life: 700 + Math.random() * 600,
        size: 0.9 + Math.random() * 1.5,
        hot: Math.random() < 0.07,
        brk,
      });
    }
  }

  function onPointerMove(e) {
    if (stopped) return;
    if (e.pointerType !== undefined && e.pointerType !== 'mouse') return;
    const now = performance.now();
    const x = e.clientX, y = e.clientY;
    const kind = normMode(mode(x, y));
    if (kind === 'none') {
      last = null;
      lastKind = null;
      carry = 0;
      nodeAccum = 0;
      return;
    }
    let brk = false;
    if (last === null || kind !== lastKind) {
      brk = true;
      carry = 0;
      nodeAccum = 0;
    } else if (Math.hypot(x - last.x, y - last.y) > 140) {
      /* A jump that long is the pointer re-entering the window, not a stroke. */
      brk = true;
      carry = 0;
      nodeAccum = 0;
    }
    if (brk) {
      layMark(x, y, kind, now, true);
    } else {
      const spacing = SPACING[kind];
      const dx = x - last.x, dy = y - last.y;
      const total = Math.hypot(dx, dy);
      let remaining = carry + total;
      while (remaining >= spacing) {
        remaining -= spacing;
        const frac = (total - remaining) / total;
        const mx = last.x + dx * frac;
        const my = last.y + dy * frac;
        layMark(mx, my, kind, now, false);
      }
      carry = remaining;
    }
    last = { x, y };
    lastKind = kind;
    enforceCap();
    if (!running) {
      running = true;
      rafId = requestAnimationFrame(frame);
    }
  }

  function onResize() {
    size();
  }

  function onVisibilityChange() {
    if (document.hidden) {
      pts.length = 0;
      nodes.length = 0;
      blobs.length = 0;
      dots.length = 0;
      last = null;
      lastKind = null;
      carry = 0;
      nodeAccum = 0;
      if (running) {
        cancelAnimationFrame(rafId);
        running = false;
      }
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    }
  }

  function frame(now) {
    if (stopped) return;
    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i];
      const life = LIFETIME[p.kind];
      if (now - p.t >= life) pts.splice(i, 1);
    }
    for (let i = nodes.length - 1; i >= 0; i--) {
      if (now - nodes[i].t >= LIFETIME.node) nodes.splice(i, 1);
    }
    for (let i = blobs.length - 1; i >= 0; i--) {
      if (now - blobs[i].t >= LIFETIME.blob) blobs.splice(i, 1);
    }
    for (let i = dots.length - 1; i >= 0; i--) {
      if (now - dots[i].t >= dots[i].life) dots.splice(i, 1);
    }

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    if (count() === 0) {
      running = false;
      return;
    }

    ctx.lineCap = 'round';
    for (let i = 1; i < pts.length; i++) {
      const p1 = pts[i], p0 = pts[i - 1];
      if (p1.brk || p0.kind !== p1.kind) continue;
      const a = Math.min(Math.max((now - p1.t) / LIFETIME[p1.kind], 0), 1);
      const fade = 1 - a;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      if (p1.kind === 'line') {
        ctx.strokeStyle = 'rgb(168 54 31)';
        ctx.lineWidth = 0.6 + 2.2 * fade;
        ctx.globalAlpha = 0.85 * fade;
      } else {
        ctx.strokeStyle = 'rgb(18 21 24)';
        ctx.lineWidth = 0.5 + 1.1 * fade;
        ctx.globalAlpha = 0.34 * fade;
      }
      ctx.stroke();
    }

    for (const n of nodes) {
      const a = Math.min(Math.max((now - n.t) / LIFETIME.node, 0), 1);
      const fade = 1 - a;
      ctx.globalAlpha = fade;
      ctx.fillStyle = 'rgb(168 54 31)';
      ctx.fillRect(n.x - 2.5, n.y - 2.5, 5, 5);
      ctx.fillStyle = 'rgb(227 229 226)';
      ctx.fillRect(n.x - 1, n.y - 1, 2, 2);
    }

    ctx.globalCompositeOperation = 'lighter';
    for (const b of blobs) {
      const a = Math.min(Math.max((now - b.t) / LIFETIME.blob, 0), 1);
      const fade = 1 - a;
      const r = 12 + 14 * a;
      const colour = heat(a);
      ctx.globalAlpha = 0.8 * fade * fade;
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
      g.addColorStop(0, colour);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    for (const d of dots) {
      const age = now - d.t;
      const a = Math.min(Math.max(age / d.life, 0), 1);
      const fade = 1 - a;
      const px = d.x + d.vx * age / 1000;
      const py = d.y + d.vy * age / 1000;
      ctx.globalAlpha = fade * (0.65 + 0.35 * Math.sin(now * 0.012 + d.x));
      ctx.fillStyle = d.hot ? 'rgb(255 200 97)' : 'rgb(169 228 255)';
      ctx.beginPath();
      ctx.arc(px, py, d.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = 'rgb(169 228 255)';
    ctx.lineWidth = 0.6;
    for (let i = 1; i < dots.length; i++) {
      const d1 = dots[i], d0 = dots[i - 1];
      if (d1.brk) continue;
      const age0 = now - d0.t;
      const age1 = now - d1.t;
      const fade0 = 1 - Math.min(Math.max(age0 / d0.life, 0), 1);
      const fade1 = 1 - Math.min(Math.max(age1 / d1.life, 0), 1);
      const px0 = d0.x + d0.vx * age0 / 1000;
      const py0 = d0.y + d0.vy * age0 / 1000;
      const px1 = d1.x + d1.vx * age1 / 1000;
      const py1 = d1.y + d1.vy * age1 / 1000;
      ctx.globalAlpha = 0.22 * Math.min(fade0, fade1);
      ctx.beginPath();
      ctx.moveTo(px0, py0);
      ctx.lineTo(px1, py1);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    rafId = requestAnimationFrame(frame);
  }

  size();
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', onVisibilityChange);

  function stop() {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(rafId);
    running = false;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    canvas.remove();
    pts.length = 0;
    nodes.length = 0;
    blobs.length = 0;
    dots.length = 0;
  }

  return { stop, count };
}
