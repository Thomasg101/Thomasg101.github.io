/* Thomas Gao — portfolio homepage controller.
 *
 * Plain ES module: no framework. The previous build ran this same logic through
 * React + @babel/standalone compiled in the browser, which cost ~3 MB of blocking
 * download to provide React.createRef and nothing else — there was never a single
 * setState call. Everything here is direct DOM work, which is what it always was.
 */

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.prototype.slice.call(document.querySelectorAll(sel));

/* The four canned ProjectSearch queries the panel demo can run, each with the
   records the real index returns for them. The full version lives on the case page. */
const PS_IMG = './assets/projects/projectsearch-';
const PS_DEMO = [
  { q: 'blue waterproofing membrane at the north parapet', hits: [
    { img: 'north-parapet', w: 600, h: 400, alt: 'Blue liquid-applied waterproofing turned up a concrete parapet upstand', loc: 'Main roof · N parapet', pct: '96%', text: 'Blue liquid-applied waterproofing turned up the north parapet upstand, terminating on concrete.' },
    { img: 'flashing-adhesion', w: 600, h: 400, alt: 'EPDM base flashing with a debonded lap lifting away from the substrate', loc: 'Main roof · NE corner', pct: '61%', text: 'Base flashing lap — adhesion loss, severity estimated moderate.' }
  ] },
  { q: 'rooftop unit nameplate RTU-3', hits: [
    { img: 'rtu3-nameplate', w: 600, h: 320, alt: 'Stainless nameplate reading RTU-3 on a grey mechanical unit casing', loc: 'Level 03 · Mechanical room', pct: '98%', text: 'Stainless nameplate reading RTU-3 on a grey rooftop unit casing. Verbatim text: “RTU-3”.' }
  ] },
  { q: 'base flashing lap lifting — adhesion loss', hits: [
    { img: 'flashing-adhesion', w: 600, h: 400, alt: 'EPDM base flashing with a debonded lap lifting away from the substrate', loc: 'Main roof · NE corner', pct: '95%', text: 'EPDM base flashing with a debonded lap lifting away from the substrate. Severity estimated moderate.' },
    { img: 'epdm-hatch-curb', w: 600, h: 400, alt: 'EPDM membrane wrapped up a galvanized roof-hatch curb with a termination bar', loc: 'Main roof · Roof hatch', pct: '44%', text: 'Membrane terminated on the hatch curb — surface chalking, severity estimated low.' }
  ] },
  { q: 'roof hatch curb termination bar', hits: [
    { img: 'epdm-hatch-curb', w: 600, h: 400, alt: 'EPDM membrane wrapped up a galvanized roof-hatch curb with a termination bar', loc: 'Main roof · Roof hatch', pct: '97%', text: 'EPDM membrane wrapped up a galvanized roof-hatch curb, secured with a fastened termination bar.' },
    { img: 'north-parapet', w: 600, h: 400, alt: 'Blue liquid-applied waterproofing turned up a concrete parapet upstand', loc: 'Main roof · N parapet', pct: '38%', text: 'Waterproofing turned up the parapet upstand — same roof level, different termination.' }
  ] }
];

const MILES = [
  { id:'edu',         hash:'education',     p:0.11, y:2.4,  side: 1, num:'01', name:'Education',      el:'0.0',  build:'Driving piles — pouring the raft foundation…' },
  { id:'flagship',    hash:'projectsearch', p:0.29, y:10.2, side:-1, num:'02', name:'ProjectSearch',  el:'10.2', build:'Erecting L01–03 structural steel…' },
  { id:'work',        hash:'experience',    p:0.53, y:23.8, side: 1, num:'03', name:'Experience',     el:'23.8', build:'Framing L04–07 — decking and pours…' },
  { id:'projects',    hash:'projects',      p:0.72, y:34.0, side:-1, num:'04', name:'Projects',       el:'34.0', build:'Jumping the core — L08–10 steel…' },
  { id:'photography', hash:'photography',   p:0.84, y:37.4, side: 1, num:'05', name:'Photography',    el:'37.4', build:'Glazing L10–11 — framing the view…' },
  { id:'skills',      hash:'skills',        p:0.93, y:40.8, side:-1, num:'06', name:'Skills & tools', el:'40.8', build:'Setting the roof level — commissioning tools…' }
];

const SCENE_TIMEOUT_MS = 6000;

/* Leaving for a case study is a real navigation, so Back re-runs init() with
   nothing but `#education` in the URL — and a bare hash is indistinguishable
   from a link someone shared, which is why the tower used to come back topped
   out. This snapshot is what lets the two be told apart.

   sessionStorage, not localStorage, is the whole point: it lives exactly as
   long as the tab. A reader returning tomorrow should still break ground. */
const STATE_KEY = 'tg.portfolio.v1';

const loadSnapshot = () => {
  try {
    const raw = sessionStorage.getItem(STATE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return (s && s.v === 1 && s.started) ? s : null;
  } catch (e) { return null; }   /* private mode, disabled storage, bad JSON */
};

class Portfolio {
  constructor() {
    this.hero      = $('#hero');
    this.heroBody  = $('.hero-body');
    this.topbar    = $('#topbar');
    this.rail      = $('#rail');
    this.panel     = $('#panel');
    this.panelBody = $('#panel-body');
    this.panelFoot = $('#panel-foot');
    this.kicker    = $('#panel-kicker');
    this.closeBtn  = $('#panel-close');
    this.contBtn   = $('#panel-continue');
    this.prevBtn   = $('#panel-prev');
    this.nextBtn   = $('#panel-next');
    this.finale    = $('#finale');
    this.finaleLinks = $('#finale-links');
    this.finaleTitle = $('#finale-title');
    this.status    = $('#status');
    this.buildLine = $('#build-line');
    this.lvl       = $('#lvl');
    this.progress  = $('#progress');
    this.crossV    = $('#crosshair-v');
    this.crossH    = $('#crosshair-h');
    this.trailHost = $('#crosshair-trail');
    this.demoQuery = $('#demo-query');
    this.demoRes   = $('#demo-results');

    this.markers = $$('[data-marker]').filter(el => el.classList.contains('marker'));
    this.rings   = this.markers.map(m => m.querySelector('.marker-ring'));
    this.rails   = $$('[data-rail]');
    this.chapters = $$('[data-chapter]');

    this.ptr = { x: 0, y: 0, has: false };
    this.stage = 'intro';
    this.unlocked = -1;
    this.cur = -1;
    this.pending = -1;
    this.read = Array(MILES.length).fill(false);
    this.panelOpen = false;
    this.started = false;
    this.epoch = 0;
    this.open = null;
    this.pside = 'right';
    this.sc = null;
    this._routing = false;
    this.demo = 0;
    this.snapshot = loadSnapshot();
    this._resuming = false;
    this._restoreScroll = 0;

    this.markers.forEach(m => { m.tabIndex = -1; });
  }

  get reduced() {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* ---------------------------------------------------------------- boot -- */

  init() {
    this.bindEvents();
    this.hashTarget = this.hashIndex();

    /* Take the title card down now rather than when the scene resolves —
       whenDefined can be hundreds of milliseconds, and a reader pressing Back
       should not watch the hero flash past on the way to where they were. */
    if (this.snapshot) {
      this._resuming = true;
      this.started = true;
      this.hideHero(true);
      this.setStatus('Restoring the site where you left it…');
    }

    this.syncRail();

    /* The title card is opaque and covers the viewport, so not one pixel of the
       model is on screen until someone breaks ground. three.js is 670 KB, which
       used to be spent before the reader had decided whether they wanted it. */
    if (this.snapshot || this.hashTarget >= 0) this.loadScene();
    else this.warmScene();

    this.loop = this.loop.bind(this);
    this._raf = requestAnimationFrame(this.loop);
  }

  /* Fetched once the browser is idle, so the module is parsed and the element
     upgraded well before the title card has been read — the deferral costs the
     reader nothing. Skipped where the reader has asked to save data or is on a
     slow connection; there it loads only if they actually ask for the build. */
  warmScene() {
    const c = navigator.connection || {};
    if (c.saveData || /(^|-)2g$/.test(c.effectiveType || '')) return;
    const idle = window.requestIdleCallback || (fn => setTimeout(fn, 1500));
    idle(() => this.loadScene(), { timeout: 4000 });
  }

  /* customElements.whenDefined replaces the old 120 ms setInterval poll. The
     poll had no exit path when three.js failed to load, so it ran forever on
     exactly the devices already struggling. */
  loadScene() {
    if (this._sceneAsked) return;
    this._sceneAsked = true;

    let settled = false;
    const fail = () => {
      if (settled) return;
      settled = true;
      this.enableFallback(this.hashTarget);
    };
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('scene timeout')), SCENE_TIMEOUT_MS));

    import('./building-scene.js').catch(fail);

    Promise.race([customElements.whenDefined('building-scene'), timeout])
      .then(() => {
        if (settled) return;
        settled = true;
        this.attachScene();
      })
      .catch(fail);
  }

  attachScene() {
    const sc = document.querySelector('building-scene');
    if (!sc || !sc.enterGuided) { this.enableFallback(this.hashTarget); return; }
    this.sc = sc;
    sc.enterGuided();
    sc.addEventListener('built', () => this.onBuilt());

    const snap = this.snapshot;
    this.snapshot = null;
    if (this._resuming && snap && this.restore(snap)) return;
    this._resuming = false;

    if (this.stage === 'done' && this.started) { sc.startBuild(); sc.setProgress(1); }
    else if (this.hashTarget >= 0) this.openHash(this.hashTarget);
    else if (this._wantStart) this._begin();
  }

  onBuilt() {
    if (this.stage !== 'building') return;
    if (this.pending < MILES.length) {
      this.unlocked = this.pending;
      this.stage = 'ready';
      this.setStatus('Marker ' + MILES[this.unlocked].num + ' set — click it to review ' + MILES[this.unlocked].name);
    } else {
      this.stage = 'done';
      this.unlocked = MILES.length - 1;
      this.showFinale(true);
      this.setStatus('Topped out · EL +40.8 m — revisit any level');
    }
    this.syncRail();
    this.persist();
  }

  /* ------------------------------------------------------- session state -- */

  /* Called at the end of every transition, and once more on the way out so the
     live camera height and panel scroll are caught even mid-lift. */
  persist() {
    if (!this.started && this.stage === 'intro') { this.forget(); return; }
    try {
      sessionStorage.setItem(STATE_KEY, JSON.stringify({
        v: 1,
        started: this.started,
        stage: this.stage,
        unlocked: this.unlocked,
        pending: this.pending,
        cur: this.panelOpen ? this.cur : -1,
        read: this.read,
        demo: this.demo,
        scroll: (this.panelOpen && this.panelBody) ? Math.round(this.panelBody.scrollTop) : 0,
        p: this.sc ? this.sc.p : 0
      }));
    } catch (e) { /* storage unavailable — the site just loses its memory */ }
  }

  forget() {
    try { sessionStorage.removeItem(STATE_KEY); } catch (e) {}
  }

  /* Put the tower back at the elevation it was left at, reopen whatever chapter
     was open, and return the panel to the paragraph it was scrolled to.
     Returns false if the snapshot cannot be trusted, in which case the caller
     falls through to the normal first-visit path. */
  restore(snap) {
    const last = MILES.length - 1;
    let stage = snap.stage;
    let unlocked = snap.unlocked | 0;

    /* A lift still in flight when the reader left counts as finished. Replaying
       a camera move they already sat through would be the worse of the two. */
    if (stage === 'building') {
      const pending = Math.max(0, snap.pending | 0);
      stage = pending > last ? 'done' : 'ready';
      unlocked = Math.min(pending, last);
    }
    if (stage === 'done') unlocked = last;
    if ((stage !== 'done' && stage !== 'ready') || unlocked < 0 || unlocked > last) return false;

    this.started = true;
    this.stage = stage;
    this.unlocked = unlocked;
    this.pending = unlocked;
    if (Array.isArray(snap.read) && snap.read.length === MILES.length) this.read = snap.read.map(Boolean);
    this.hideHero(true);
    this.sc.startBuild();
    this.sc.setProgress(stage === 'done' ? 1 : MILES[unlocked].p);
    if (snap.demo > 0 && snap.demo < PS_DEMO.length) this.runDemo(snap.demo | 0);

    /* The URL wins where it can. Back restores the hash the reader left on, so
       that hash *is* the memory. But a case study's "All projects" link can ask
       for a chapter the build has not reached yet — that is a deliberate jump,
       not a resume, and it still tops the tower out the way it always did. */
    const wanted = this.hashIndex();
    let openAt = -1;
    if (wanted > unlocked) {
      this.stage = 'done';
      this.unlocked = this.pending = last;
      this.sc.setProgress(1);
      openAt = wanted;
    } else if (wanted >= 0) {
      openAt = wanted;
    } else if (snap.cur >= 0 && snap.cur <= unlocked) {
      openAt = snap.cur;
    }

    this.syncRail();
    if (openAt >= 0) {
      this.showFinale(false);
      if (openAt === snap.cur) this._restoreScroll = Math.max(0, snap.scroll | 0);
      /* Opened synchronously, unlike the deep-link path: a tab restored in the
         background never gets a frame, and the chapter has to be there waiting
         when the reader switches to it. */
      this.openBub(openAt);
    } else {
      this.showFinale(this.stage === 'done');
      this.setStatus(this.stage === 'done'
        ? 'Topped out · EL +40.8 m — revisit any level'
        : 'Marker ' + MILES[this.unlocked].num + ' ready — click it to continue');
      this.persist();
    }
    return true;
  }

  /* -------------------------------------------------------------- events -- */

  bindEvents() {
    $('[data-start]').addEventListener('click', () => this.start());
    $('[data-skip]').addEventListener('click', () => this.skipToEnd());
    $$('[data-home]').forEach(b => b.addEventListener('click', () => this.goHome()));
    this.closeBtn.addEventListener('click', () => this.closePanel());
    this.contBtn.addEventListener('click', () => this.advance());
    this.prevBtn.addEventListener('click', () => this.stepChapter(-1));
    this.nextBtn.addEventListener('click', () => this.stepChapter(1));

    $$('[data-marker]').forEach(btn => {
      btn.addEventListener('click', () => this.openBub(+btn.getAttribute('data-marker')));
    });
    this.rails.forEach(btn => {
      btn.addEventListener('click', () => {
        const i = +btn.getAttribute('data-rail');
        if (i < MILES.length) this.openBub(i);
        else if (this.stage === 'done') this.closePanel();
      });
    });
    $$('[data-demo]').forEach(btn => {
      btn.addEventListener('click', () => this.runDemo(+btn.getAttribute('data-demo')));
    });

    /* Launch gestures. The old build started the build on ANY downward wheel or
       26 px swipe, so on a phone — where the title card always overflows — the
       first scroll to read the intro destroyed it. Now the hero has to be
       scrolled to its end first. */
    addEventListener('wheel', e => {
      if (this.started || e.deltaY < 8) return;
      if (e.target && e.target.closest && e.target.closest('a,button')) return;
      if (!this.heroAtEnd()) return;
      this.start();
    }, { passive: true });

    addEventListener('touchstart', e => { this._ty = e.touches[0].clientY; }, { passive: true });
    addEventListener('touchmove', e => {
      if (this.started || this._ty == null) return;
      if (this._ty - e.touches[0].clientY <= 40) return;
      if (!this.heroAtEnd()) return;
      this.start();
    }, { passive: true });

    addEventListener('keydown', e => this.onKey(e));

    addEventListener('resize', () => {
      this.syncRail();
      if (!this.panelOpen || this.cur < 0) return;
      this.pside = innerWidth < 760 ? 'bottom' : (this.cur % 2 === 0 ? 'right' : 'left');
      this.applyPanel();
    }, { passive: true });

    /* Back/forward now moves between chapters instead of leaving the site. */
    addEventListener('popstate', () => this.onRoute());
    addEventListener('hashchange', () => this.onRoute());

    /* The last write before the document goes away, which is the one that
       matters: clicking through to a case study is a navigation, and only here
       are the live build progress and panel scroll still readable.
       visibilitychange backs it up on mobile, where pagehide is less reliable. */
    addEventListener('pagehide', () => this.persist());
    addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.persist();
    });

    if (typeof matchMedia === 'function' && matchMedia('(pointer:fine)').matches) {
      document.addEventListener('pointerleave', () => { this.ptr.has = false; this.cursor(); });
      document.addEventListener('pointermove', e => {
        this.ptr.x = e.clientX; this.ptr.y = e.clientY; this.ptr.has = true;
        if (this.praf) return;
        this.praf = requestAnimationFrame(() => { this.praf = 0; this.cursor(); });
      }, { passive: true });
    }

    document.addEventListener('pointerdown', e => {
      if (e.button !== 0 || this.stage === 'intro') return;
      if (e.target && e.target.closest && e.target.closest('a,button,nav,aside,input,textarea,select')) return;
      const sc = this.sc;
      if (!sc || !sc.plantStake) return;
      sc.plantStake((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    });
  }

  /* True when the title card has nothing further to scroll. */
  heroAtEnd() {
    const b = this.heroBody;
    if (!b) return true;
    const max = b.scrollHeight - b.clientHeight;
    return max <= 2 || b.scrollTop >= max - 2;
  }

  onKey(e) {
    if (e.key === 'Escape' && this.panelOpen) { e.preventDefault(); this.closePanel(); return; }
    if (this.panelOpen && this.stage === 'done' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      if (e.target && e.target.closest && e.target.closest('input,textarea,select')) return;
      e.preventDefault();
      this.stepChapter(e.key === 'ArrowRight' ? 1 : -1);
      return;
    }
    if (this.started) return;
    if (e.target && e.target.closest && e.target.closest('a,button,input,textarea')) return;
    if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
      if (!this.heroAtEnd()) return;
      this.start();
    }
  }

  /* --------------------------------------------------------------- start -- */

  start() {
    if (this.started) return;
    this.started = true;
    this.loadScene();
    this.hideHero(false);
    /* Someone who asked for reduced motion should not be given a 40-second
       camera fly-through; hand them the finished tower instead. */
    if (this.reduced) { this.jumpToEnd(); return; }
    this._begin();
  }

  skipToEnd() {
    this.loadScene();
    if (!this.started) { this.started = true; this.hideHero(true); }
    this.jumpToEnd();
  }

  jumpToEnd() {
    this.stage = 'done';
    this.unlocked = MILES.length - 1;
    if (this.sc) { this.sc.startBuild(); this.sc.setProgress(1); }
    this.showFinale(true);
    this.syncRail();
    this.setStatus('Topped out · EL +40.8 m — every chapter is open');
    this.persist();
  }

  _begin() {
    if (!this.sc) {
      this._wantStart = true;
      this.setStatus('Loading the construction model…');
      return;
    }
    this.sc.startBuild();
    this._wantStart = false;
    this.stage = 'building';
    this.pending = 0;
    this.showFinale(false);
    this.setStatus(MILES[0].build);
    this.sc.buildTo(MILES[0].p, this.dur(0));
    this.syncRail();
    this.persist();
  }

  dur(i) {
    const from = i === 0 ? 0 : MILES[i - 1].p;
    const to = i >= MILES.length ? 1 : MILES[i].p;
    return Math.max(6, Math.min(10, (to - from) * 38));
  }

  /* No tower, so there is no elevation to return to — but which chapter the
     reader was reading still survives the trip to a case study and back. */
  enableFallback(i) {
    if (this.sc) return;
    document.documentElement.classList.add('no-scene');
    const snap = this.snapshot;
    this.snapshot = null;
    this._resuming = false;
    this.started = true;
    this.hideHero(true);
    this.stage = 'done';
    this.unlocked = MILES.length - 1;
    if (snap && Array.isArray(snap.read) && snap.read.length === MILES.length) this.read = snap.read.map(Boolean);
    this.syncRail();
    this.showFinale(true);
    this.setStatus('Portfolio chapters ready · 3D view unavailable');

    const open = i >= 0 ? i : (snap && snap.cur >= 0 ? snap.cur : -1);
    if (open >= 0) {
      if (snap && open === snap.cur) this._restoreScroll = Math.max(0, snap.scroll | 0);
      this.openBub(open);
    } else {
      this.persist();
    }
  }

  /* ------------------------------------------------------------- routing -- */

  hashIndex() {
    const hash = (location.hash || '').slice(1).toLowerCase();
    return MILES.findIndex(m => m.hash === hash || m.id === hash);
  }

  setHash(hash, push) {
    const url = hash ? '#' + hash : location.pathname + location.search;
    if (hash && location.hash === '#' + hash) return;
    this._routing = true;
    if (push) history.pushState(null, '', url);
    else history.replaceState(null, '', url);
    this._routing = false;
  }

  onRoute() {
    if (this._routing) return;
    const i = this.hashIndex();
    if (i < 0) { if (this.panelOpen) this.closePanel(); return; }
    if (this.panelOpen && this.cur === i) return;
    if (!this.sc && this.stage === 'intro') { this.hashTarget = i; return; }
    if (this.stage === 'intro') this.openHash(i);
    else this.openBub(i);
  }

  openHash(i) {
    if (i < 0 || i >= MILES.length) return;
    if (!this.sc) { this.hashTarget = i; this.loadScene(); return; }
    this.started = true;
    this.hideHero(true);
    this.sc.startBuild();
    this.sc.setProgress(1);
    this.stage = 'done';
    this.unlocked = MILES.length - 1;
    this.syncRail();
    this.showFinale(false);
    /* Synchronous for the same reason as restore(): a link opened in a
       background tab gets no frame, and would land on a chapterless tower. */
    this.openBub(i);
  }

  /* --------------------------------------------------------------- panel -- */

  openBub(i) {
    if (i < 0 || i > this.unlocked || this.stage === 'building' || this.stage === 'intro') return;
    const ep = ++this.epoch;
    if (this.panelOpen) {
      if (this.cur === i) return;
      this.hidePanel(true);
      setTimeout(() => { if (this.epoch === ep) this._open(i, ep); }, 360);
    } else {
      this._open(i, ep);
    }
  }

  /* Single source of truth for the panel: geometry and transform are reasserted
     from this.open every frame, so they can never diverge from logical state. */
  applyPanel() {
    const panel = this.panel;
    if (!panel) return;
    const side = this.pside || 'right';
    const geo = side === 'bottom'
      ? { left: '10px', right: '10px', top: 'auto', bottom: '10px', width: 'auto', height: '62svh' }
      : side === 'right'
        ? { right: '22px', left: 'auto', top: '76px', bottom: '20px', width: 'min(620px,46vw)', height: 'auto' }
        : { left: '22px', right: 'auto', top: '76px', bottom: '20px', width: 'min(620px,46vw)', height: 'auto' };
    for (const k in geo) if (panel.style[k] !== geo[k]) panel.style[k] = geo[k];

    const hid = side === 'bottom' ? 'translateY(116%)'
      : side === 'right' ? 'translateX(calc(100% + 60px))' : 'translateX(calc(-100% - 60px))';
    const want = this.open == null ? hid : 'translate(0px, 0px)';
    if (panel.style.transform !== want) panel.style.transform = want;
    panel.setAttribute('aria-hidden', this.open == null ? 'true' : 'false');
    panel.inert = this.open == null;
  }

  _open(i, ep) {
    const m = MILES[i], panel = this.panel;
    if (!panel || (ep !== undefined && ep !== this.epoch)) return;

    const mobile = innerWidth < 760;
    const pside = mobile ? 'bottom' : (i % 2 === 0 ? 'right' : 'left');
    if (this.pside !== pside) {
      this.pside = pside;
      this.open = null;
      panel.style.transition = 'none';
      this.applyPanel();
      void panel.offsetWidth;
      panel.style.transition = 'transform .8s cubic-bezier(.16,1,.3,1)';
    }

    let activeChapter = null;
    this.chapters.forEach(el => {
      const isActive = el.getAttribute('data-chapter') === m.id;
      el.classList.toggle('is-active', isActive);
      if (isActive) activeChapter = el;
    });

    /* These images start inside display:none chapters and are later revealed
       inside the panel's own scroll container. Native lazy loading can keep the
       lower cards source-less until after they enter the window viewport,
       leaving blank previews while the panel is being scrolled. Keep the fast
       title-card load, then fetch the active chapter's images as soon as the
       reader opens it. */
    if (activeChapter) {
      activeChapter.querySelectorAll('img[loading="lazy"]').forEach(img => {
        img.loading = 'eager';
      });
    }
    this.kicker.textContent = m.num + ' / ' + m.name + ' · EL +' + m.el + ' m';
    this.syncFoot(i);

    /* Normally the panel opens at the top. The exception is a restore: someone
       who clicked the seventh project card should come back to the seventh
       project card, not to the top of the chapter. Writing scrollTop flushes
       layout, so the first assignment usually lands; it is re-asserted next
       frame in case the chapter's images had not been sized yet and the offset
       clamped short. */
    const scroll = this._restoreScroll;
    this._restoreScroll = 0;
    this.panelBody.scrollTop = scroll;
    if (scroll > 0) requestAnimationFrame(() => { this.panelBody.scrollTop = scroll; });

    panel.style.transition = 'transform .8s cubic-bezier(.16,1,.3,1)';

    const active = document.activeElement;
    if (!this.returnFocus || !panel.contains(active)) this.returnFocus = active;

    const first = this.cur < 0;
    this.open = i; this.panelOpen = true; this.cur = i; this.read[i] = true;
    this.applyPanel();

    if (this.sc) this.sc.focusLevel(Math.max(3.2, m.y - 2.4), mobile ? 0 : (pside === 'right' ? 0.85 : -0.85));
    this.showFinale(false);
    this.setStatus('Reviewing ' + m.num + ' — ' + m.name);
    this.setHash(m.hash, !first);
    this.syncRail();
    this.persist();
    requestAnimationFrame(() => this.closeBtn.focus({ preventScroll: true }));
  }

  /* During the build the footer carries the build forward; once topped out the
     same strip becomes chapter paging, so a reader never has to close the panel. */
  syncFoot(i) {
    const building = this.stage !== 'done';
    const showCont = building && i === this.unlocked;
    this.panelFoot.style.display = (showCont || !building) ? 'flex' : 'none';
    this.contBtn.hidden = !showCont;
    this.contBtn.textContent = i === MILES.length - 1 ? 'Top out the tower →' : 'Continue construction →';

    const prev = (i - 1 + MILES.length) % MILES.length;
    const next = (i + 1) % MILES.length;
    this.prevBtn.hidden = building;
    this.nextBtn.hidden = building;
    if (!building) {
      this.prevBtn.textContent = '← ' + MILES[prev].name;
      this.nextBtn.textContent = MILES[next].name + ' →';
    }
  }

  stepChapter(dir) {
    if (!this.panelOpen || this.stage !== 'done') return;
    this.openBub((this.cur + dir + MILES.length) % MILES.length);
  }

  hidePanel(keepEpoch) {
    if (!keepEpoch) this.epoch = (this.epoch || 0) + 1;
    this.open = null; this.panelOpen = false; this.cur = -1;
    this.applyPanel();
    if (!keepEpoch && this.returnFocus && this.returnFocus.focus) {
      const target = this.returnFocus;
      this.returnFocus = null;
      requestAnimationFrame(() => target.focus({ preventScroll: true }));
    }
  }

  closePanel() {
    if (!this.panelOpen) return;
    this.hidePanel();
    this.cur = -1;
    if (this.sc) this.sc.focusLevel(null, 0);
    this.setHash('', false);
    if (this.stage === 'done') {
      this.showFinale(true);
      this.setStatus('Topped out · EL +40.8 m — revisit any level');
    } else if (this.stage === 'ready') {
      this.setStatus('Marker ' + MILES[this.unlocked].num + ' ready — click it to continue');
    }
    this.syncRail();
    this.persist();
  }

  advance() {
    if (this.stage !== 'ready' || this.cur !== this.unlocked) return;
    this.hidePanel();
    this.cur = -1;
    if (this.sc) this.sc.focusLevel(null, 0);
    const nxt = this.unlocked + 1;
    this.stage = 'building';
    this.pending = nxt;
    if (nxt < MILES.length) {
      this.setStatus(MILES[nxt].build);
      this.sc.buildTo(MILES[nxt].p, this.dur(nxt));
    } else {
      this.setStatus('Topping out — lifting roof plant, setting the flag…');
      this.sc.buildTo(1, this.dur(nxt));
    }
    this.syncRail();
    this.persist();
  }

  /* ---------------------------------------------------------------- home -- */

  goHome() {
    if (this.panelOpen) this.hidePanel();
    this.epoch = (this.epoch || 0) + 1;
    this.stage = 'intro';
    this.started = false;
    this._wantStart = false;
    this.unlocked = -1; this.cur = -1; this.pending = -1;
    this.read = Array(MILES.length).fill(false);
    this.returnFocus = null;
    this.hashTarget = -1;
    this._resuming = false;
    this.snapshot = null;
    this.demo = 0;
    this.showFinale(false);
    this.showHero();
    if (this.sc) { this.sc.resetBuild(); this.sc.focusLevel(null, 0); }
    this.setHash('', false);
    this.setStatus('Back at the title card — scroll to break ground again');
    this.syncRail();
    /* Asking to start over is also asking to be forgotten. */
    this.persist();
  }

  hideHero(immediate) {
    const h = this.hero;
    if (!h) return;
    this.topbar.inert = false;
    this.topbar.setAttribute('aria-hidden', 'false');
    h.style.pointerEvents = 'none';
    if (this._heroTimer) { clearTimeout(this._heroTimer); this._heroTimer = null; }
    if (immediate || this.reduced) {
      h.style.transition = 'none';
      h.style.display = 'none';
      h.style.transform = 'translateY(-100%)';
    } else {
      h.style.transform = 'translateY(-100%)';
      this._heroTimer = setTimeout(() => { h.style.display = 'none'; this._heroTimer = null; }, 1250);
    }
  }

  showHero() {
    const h = this.hero;
    if (!h) return;
    this.topbar.inert = true;
    this.topbar.setAttribute('aria-hidden', 'true');
    if (this._heroTimer) { clearTimeout(this._heroTimer); this._heroTimer = null; }
    h.style.display = 'flex';
    h.style.transition = 'none';
    h.style.transform = 'translateY(-100%)';
    void h.offsetWidth; // commit the off-screen start so the slide back down animates
    h.style.transition = 'transform 1.15s cubic-bezier(.76,0,.24,1)';
    h.style.transform = 'translateY(0)';
    h.style.pointerEvents = 'auto';
    if (this.heroBody) this.heroBody.scrollTop = 0;
  }

  showFinale(on) {
    const f = this.finale;
    if (f) {
      f.style.opacity = on ? '1' : '0';
      f.setAttribute('aria-hidden', on ? 'false' : 'true');
      f.inert = !on;
    }
    if (this.finaleLinks) this.finaleLinks.style.pointerEvents = on ? 'auto' : 'none';
  }

  /* ---------------------------------------------------------------- demo -- */

  runDemo(i) {
    const d = PS_DEMO[i];
    if (!d || !this.demoQuery || !this.demoRes) return;
    this.demo = i;
    this.demoQuery.textContent = d.q;
    this.demoRes.textContent = '';

    d.hits.forEach(hit => {
      const row = document.createElement('div');
      row.className = 'demo-hit';

      const pic = document.createElement('picture');
      const source = document.createElement('source');
      source.type = 'image/avif';
      source.srcset = PS_IMG + hit.img + '-600.avif';
      const img = document.createElement('img');
      img.src = PS_IMG + hit.img + '-600.jpg';
      img.width = hit.w; img.height = hit.h;
      img.alt = hit.alt;
      img.loading = 'lazy';
      img.decoding = 'async';
      pic.append(source, img);

      const body = document.createElement('div');
      const head = document.createElement('div');
      head.className = 'demo-hit-head';
      const loc = document.createElement('span'); loc.textContent = hit.loc;
      const pct = document.createElement('span'); pct.textContent = hit.pct;
      head.append(loc, pct);
      const p = document.createElement('p'); p.textContent = hit.text;
      body.append(head, p);

      row.append(pic, body);
      this.demoRes.appendChild(row);
    });

    $$('[data-demo]').forEach(b => {
      b.setAttribute('aria-pressed', String(+b.getAttribute('data-demo') === i));
    });
    this.persist();
  }

  /* ---------------------------------------------------------------- rail -- */

  syncRail() {
    if (this.rail) {
      this.rail.style.display = (this.stage !== 'intro' && innerWidth >= 760) ? 'flex' : 'none';
    }
    this.rails.forEach((el, i) => {
      const unlocked = i < MILES.length
        ? (i <= this.unlocked && this.stage !== 'building' && this.stage !== 'intro')
        : this.stage === 'done';
      const current = (i === this.cur && this.panelOpen)
        || (i === MILES.length && this.stage === 'done' && !this.panelOpen);

      /* Locked entries are genuinely disabled now. Previously they were only
         pointer-events:none, so a keyboard user could tab to a locked chapter
         and press Enter to no effect. */
      el.disabled = !unlocked && !current;
      el.classList.toggle('is-unlocked', unlocked && !current);
      el.classList.toggle('is-current', current);
      /* The rail is the site's table of contents; colour alone was telling
         sighted readers which chapter they were in and nobody else. */
      if (current) el.setAttribute('aria-current', 'true');
      else el.removeAttribute('aria-current');
    });
  }

  /* One message, two destinations: the sr-only live region announces it, and
     the topbar shows it. The visible copy is aria-hidden so it is not read a
     second time, and it stays collapsed on the title card. */
  setStatus(s) {
    if (this.status && this.status.textContent !== s) this.status.textContent = s;
    const line = this.buildLine;
    if (!line) return;
    if (line.textContent !== s) line.textContent = s;
    line.classList.toggle('is-live', this.stage !== 'intro');
  }

  /* ---------------------------------------------------------------- loop -- */

  loop() {
    this._raf = requestAnimationFrame(this.loop);
    const sc = this.sc;
    if (!sc || !sc.project) return;

    const p = sc.p || 0;
    const f = Math.max(0, Math.min(12, clamp01((p - 0.10) / 0.80) * 12));
    const lvl = String(Math.floor(f)).padStart(2, '0');
    if (this.lvl && this.lvl.textContent !== lvl) this.lvl.textContent = lvl;
    if (this.progress) {
      const t = 'scaleX(' + p.toFixed(3) + ')';
      if (this.progress.style.transform !== t) this.progress.style.transform = t;
    }
    this.applyPanel();
    this.layoutTags();
  }

  /* Every tag stays pinned to the elevation it labels, on the screen side its
     chapter owns, through any camera move. Desired y comes straight from the
     projection; the spread pass then guarantees clear air between neighbours. */
  layoutTags() {
    const sc = this.sc;
    const rect = el => (el ? el.getBoundingClientRect() : null);
    const navR = rect(this.topbar);
    let safeTop = navR ? navR.bottom + 14 : 14;
    let safeBot = innerHeight - 20;
    let safeLeft = 14;

    const railR = this.rail && getComputedStyle(this.rail).display !== 'none' ? rect(this.rail) : null;
    if (railR) safeLeft = railR.right + 16;

    let titleR = null;
    if (this.stage === 'done' && !this.panelOpen) {
      titleR = rect(this.finaleTitle);
      const lR = rect(this.finaleLinks);
      if (lR) safeBot = Math.min(safeBot, lR.top - 16);
    }

    const cols = { '1': [], '-1': [] };
    for (let i = 0; i < this.markers.length; i++) {
      const b = this.markers[i], m = MILES[i];
      const off = this.panelOpen || i > this.unlocked || this.stage === 'intro';
      const a = off ? null : sc.project(14.6, m.y, 0);
      const bb = off ? null : sc.project(-14.6, m.y, 0);
      if (off || !a || !bb || !(a.front || bb.front)) {
        b.style.opacity = '0';
        b.style.pointerEvents = 'none';
        b.tabIndex = -1;
        continue;
      }
      const right = m.side > 0;
      const pr = right ? (a.x >= bb.x ? a : bb) : (a.x <= bb.x ? a : bb);
      const w = b.offsetWidth || 250, h = b.offsetHeight || 45;
      const x = right
        ? Math.min(Math.max(pr.x + 8, safeLeft), innerWidth - w - 14)
        : Math.min(Math.max(pr.x - 8, safeLeft + w), innerWidth - 14);
      cols[right ? '1' : '-1'].push({ i, b, right, x, y: pr.y, w, h });
    }

    for (const key in cols) {
      const col = cols[key];
      if (!col.length) continue;
      let top = safeTop;
      if (titleR) {
        let l = Infinity, r = -Infinity;
        for (const c of col) {
          l = Math.min(l, c.right ? c.x : c.x - c.w);
          r = Math.max(r, c.right ? c.x + c.w : c.x);
        }
        if (l < titleR.right + 12 && r > titleR.left - 12) top = Math.max(top, titleR.bottom + 16);
      }
      this.spread(col, top, safeBot, 18);
      for (const c of col) {
        c.b.style.flexDirection = c.right ? 'row' : 'row-reverse';
        c.b.style.transform = 'translate(' + c.x.toFixed(1) + 'px,' + c.y.toFixed(1) + 'px) translate('
          + (c.right ? '0' : '-100%') + ',-50%)';
        c.b.style.opacity = this.read[c.i] ? '.74' : '1';
        c.b.style.pointerEvents = 'auto';
        c.b.tabIndex = 0;
        const ring = this.rings[c.i];
        if (ring) ring.style.display = (c.i === this.unlocked && !this.read[c.i]) ? 'block' : 'none';
      }
    }
  }

  /* Two-pass label spreading: push neighbours apart downward, then pull the
     column back up off the bottom, so a crowded side stays ordered. */
  spread(col, top, bot, gap) {
    col.sort((a, b) => a.y - b.y);
    for (let pass = 0; pass < 2; pass++) {
      let prev = null;
      for (const c of col) {
        const min = prev ? prev.y + prev.h / 2 + gap + c.h / 2 : top + c.h / 2;
        if (c.y < min) c.y = min;
        prev = c;
      }
      prev = null;
      for (let k = col.length - 1; k >= 0; k--) {
        const c = col[k];
        const max = prev ? prev.y - prev.h / 2 - gap - c.h / 2 : bot - c.h / 2;
        if (c.y > max) c.y = max;
        prev = c;
      }
    }
    for (const c of col) c.y = Math.max(top + c.h / 2, Math.min(c.y, bot - c.h / 2));
  }

  /* ------------------------------------------------------------- pointer -- */

  cursor() {
    const on = this.ptr.has && !this.reduced;
    if (this.crossV) {
      this.crossV.style.opacity = on ? '.3' : '0';
      this.crossV.style.transform = 'translateX(' + this.ptr.x + 'px)';
    }
    if (this.crossH) {
      this.crossH.style.opacity = on ? '.3' : '0';
      this.crossH.style.transform = 'translateY(' + this.ptr.y + 'px)';
    }
    const sc = this.sc;
    if (!on || !sc || !sc.setPointer) return;
    sc.setPointer((this.ptr.x / innerWidth) * 2 - 1, -(this.ptr.y / innerHeight) * 2 + 1);
    this.trail();
  }

  trail() {
    const host = this.trailHost;
    if (!host || this.reduced) return;
    if (!this.dots) {
      this.dots = [];
      for (let i = 0; i < 18; i++) {
        const d = document.createElement('div');
        d.style.cssText = 'position:absolute;top:0;left:0;width:4px;height:4px;margin:-2px 0 0 -2px;'
          + 'background:var(--accent);opacity:0;'
          + 'transition:opacity .9s ease-out, transform .9s cubic-bezier(.2,.7,.2,1)';
        host.appendChild(d);
        this.dots.push(d);
      }
      this.di = 0;
    }
    const dx = this.ptr.x - (this.lx || 0), dy = this.ptr.y - (this.ly || 0);
    if (dx * dx + dy * dy < 90) return;
    this.lx = this.ptr.x; this.ly = this.ptr.y;
    const d = this.dots[this.di++ % this.dots.length];
    d.style.transition = 'none';
    d.style.opacity = '.55';
    d.style.transform = 'translate(' + this.ptr.x + 'px,' + this.ptr.y + 'px) scale(1)';
    void d.offsetWidth;
    d.style.transition = 'opacity .9s ease-out, transform .9s cubic-bezier(.2,.7,.2,1)';
    d.style.opacity = '0';
    d.style.transform = 'translate(' + (this.ptr.x - dx * 0.9) + 'px,'
      + (this.ptr.y - dy * 0.9 + 10) + 'px) scale(.3)';
  }
}

const app = new Portfolio();
app.init();
