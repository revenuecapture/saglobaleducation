/* SA Global Education - site behaviour */
(function () {
  'use strict';


  /* Cookie consent ------------------------------------------------------- */
  var STORE = 'sag-consent';
  var bar = document.getElementById('cookieBar');
  var cfg = window.SAG_CONSENT || {};
  var loaded = false;

  function loadTrackers() {
    if (loaded) return;
    loaded = true;
    if (cfg.ga4) {
      var g = document.createElement('script');
      g.async = true;
      g.src = 'https://www.googletagmanager.com/gtag/js?id=' + cfg.ga4;
      document.head.appendChild(g);
      gtag('js', new Date());
      gtag('config', cfg.ga4, { anonymize_ip: true });
    }
    if (cfg.metaPixelId) {
      !function (f, b, e, v, n, t, s) {
        if (f.fbq) return; n = f.fbq = function () {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        };
        if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
        n.queue = []; t = b.createElement(e); t.async = !0; t.src = v;
        s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
      }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
      window.fbq('init', cfg.metaPixelId);
      window.fbq('track', 'PageView');
    }
  }

  function grant() {
    gtag('consent', 'update', {
      ad_storage: 'granted', ad_user_data: 'granted',
      ad_personalization: 'granted', analytics_storage: 'granted'
    });
    loadTrackers();
  }

  function setConsent(value) {
    try { localStorage.setItem(STORE, value); } catch (e) {}
    if (bar) bar.hidden = true;
    if (value === 'granted') grant();
  }

  function currentConsent() {
    try { return localStorage.getItem(STORE); } catch (e) { return null; }
  }

  if (bar) {
    var saved = currentConsent();
    if (saved === 'granted') { grant(); }
    else if (saved !== 'denied') { bar.hidden = false; }

    var accept = document.getElementById('cookieAccept');
    var decline = document.getElementById('cookieDecline');
    if (accept) accept.addEventListener('click', function () { setConsent('granted'); });
    if (decline) decline.addEventListener('click', function () { setConsent('denied'); });

    var settings = document.getElementById('cookieSettings');
    if (settings) settings.addEventListener('click', function (e) {
      e.preventDefault();
      try { localStorage.removeItem(STORE); } catch (err) {}
      bar.hidden = false;
      bar.scrollIntoView({ block: 'center' });
    });
  }

  /* Mobile navigation ---------------------------------------------------- */
  var toggle = document.getElementById('navToggle');
  var nav = document.getElementById('nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });
  }

  /* Glass navigation --------------------------------------------------
     Past the first few pixels of scroll the header condenses into a pane
     of glass (CSS does the drawing). Chromium also gets a faint refraction
     through an SVG displacement filter; other browsers keep the frosted
     glass. The header checks what is under it and turns smoky over dark
     sections so the links stay readable. ------------------------------ */
  (function () {
    var header = document.querySelector('.site-header');
    if (!header) return;
    var root = document.documentElement;
    var brands = (navigator.userAgentData && navigator.userAgentData.brands) || [];
    var chromium = brands.some(function (b) { return /Chromium/.test(b.brand); });
    if (chromium && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      var ns = 'http://www.w3.org/2000/svg';
      var svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.setAttribute('aria-hidden', 'true');
      svg.style.position = 'absolute';
      svg.innerHTML = '<filter id="glass-refract" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">' +
        '<feTurbulence type="fractalNoise" baseFrequency="0.004 0.018" numOctaves="2" seed="11" result="n"/>' +
        '<feGaussianBlur in="n" stdDeviation="2.5" result="nb"/>' +
        '<feDisplacementMap in="SourceGraphic" in2="nb" scale="26" xChannelSelector="R" yChannelSelector="G"/></filter>';
      document.body.appendChild(svg);
      root.classList.add('glass-refract');
    }
    var dark = '.band-chocolate, .band-azure-deep, .band-azure, .site-footer, .tl-fill.is-full';
    var queued = false;
    function check() {
      queued = false;
      var glass = window.scrollY > 24;
      root.classList.toggle('nav-glass', glass);
      if (!glass) { root.classList.remove('nav-dark'); return; }
      var r = header.getBoundingClientRect();
      var under = document.elementsFromPoint(window.innerWidth / 2, r.top + r.height / 2);
      var isDark = under.some(function (el) { return !header.contains(el) && el.closest && el.closest(dark); });
      root.classList.toggle('nav-dark', isDark);
    }
    window.addEventListener('scroll', function () { if (!queued) { queued = true; requestAnimationFrame(check); } }, { passive: true });
    window.addEventListener('resize', check);
    check();
  })();

  /* Scroll reveal -------------------------------------------------------- */
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var targets = document.querySelectorAll('.reveal');
  if (reduced || !('IntersectionObserver' in window)) {
    targets.forEach(function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry, i) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        el.style.transitionDelay = Math.min(i * 70, 280) + 'ms';
        el.classList.add('in');
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    targets.forEach(function (el) { io.observe(el); });
  }

  /* Hero rotator --------------------------------------------------------- */
  var hero = document.getElementById('hero');
  if (hero) {
    var slides = hero.querySelectorAll('.hero-slide');
    var dots = hero.querySelectorAll('.hero-dots button');
    var idx = 0, timer = null;

    function show(n) {
      idx = (n + slides.length) % slides.length;
      slides.forEach(function (s, i) { s.classList.toggle('is-active', i === idx); });
      dots.forEach(function (d, i) { d.setAttribute('aria-selected', String(i === idx)); });
    }
    function start() {
      if (reduced || slides.length < 2) return;
      stop();
      timer = setInterval(function () { show(idx + 1); }, 7000);
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    dots.forEach(function (d) {
      d.addEventListener('click', function () {
        show(parseInt(d.dataset.dot, 10));
        start();
      });
    });
    hero.addEventListener('mouseenter', stop);
    hero.addEventListener('mouseleave', start);
    document.addEventListener('visibilitychange', function () {
      document.hidden ? stop() : start();
    });
    start();
  }

  /* Open the country accordion matching the URL hash --------------------- */
  if (location.hash) {
    try {
      var el = document.querySelector('details.country' + location.hash);
      if (el) { el.open = true; setTimeout(function () { el.scrollIntoView({ block: 'start' }); }, 60); }
    } catch (e) { /* invalid selector, ignore */ }
  }

  /* Horizontal scroll sections (pattern from hokaido.webflow.io) -----------
     Each [data-hs] section pins a 100vh "camera" while vertical scroll
     drives the track sideways 1:1. The position eases toward its target
     each frame (hokaido uses Webflow smoothing 80, about 20% per frame).
     Elements marked .hs-par drift relative to their panel's distance from
     the viewport centre, which gives the layered depth. Without JS, under
     reduced motion, or on narrow/short screens the track stays a native
     swipeable row and only the progress counter is wired up. ------------ */
  (function () {
    var sections = [].slice.call(document.querySelectorAll('[data-hs]'));
    if (!sections.length) return;
    var header = document.querySelector('.site-header');
    var EASE = 0.16;
    var items = sections.map(function (sec) {
      var track = sec.querySelector('.hs-track');
      var panels = [].slice.call(track.querySelectorAll('.hs-panel'));
      return {
        sec: sec, track: track, panels: panels,
        pars: [].slice.call(track.querySelectorAll('.hs-par')),
        bar: sec.querySelector('.hs-bar'), count: sec.querySelector('.hs-count b'),
        dist: 0, top: 0, cur: 0, target: 0, pinned: false, lastIdx: -1,
        // Optional finale: after the track stops, the last panel grows to fill the camera.
        fill: sec.hasAttribute('data-hs-grow') ? sec.querySelector('.tl-fill') : null,
        grow: 0, from: null
      };
    });

    function canPin() {
      return !reduced && window.innerWidth >= 900 && window.innerHeight >= 600;
    }
    function headerH() { return header ? header.getBoundingClientRect().height : 0; }

    function setProgress(it, p) {
      if (it.bar) it.bar.style.setProperty('--p', p.toFixed(4));
      if (!it.count) return;
      var idx = Math.min(it.panels.length - 1, Math.round(p * (it.panels.length - 1)));
      if (idx !== it.lastIdx) { it.count.textContent = String(idx + 1).padStart(2, '0'); it.lastIdx = idx; }
    }

    function layout() {
      var pin = canPin();
      var hh = headerH();
      document.documentElement.style.setProperty('--header-h', hh + 'px');
      items.forEach(function (it) {
        it.sec.classList.toggle('is-pinned', pin);
        it.pinned = pin;
        it.track.style.transform = '';
        it.pars.forEach(function (el) { el.style.transform = ''; });
        if (!pin) { it.sec.style.height = ''; return; }
        // Distance the track must travel so the last panel ends on the wrap's right edge.
        // Measured from the panels themselves: browsers leave a flex track's end
        // padding out of scrollWidth, which made the last panel overshoot to the
        // viewport edge. Transforms were cleared above, so these rects are at rest.
        var tr = it.track.getBoundingClientRect();
        var first = it.panels[0].getBoundingClientRect();
        var last = it.panels[it.panels.length - 1].getBoundingClientRect();
        it.dist = Math.max(0, Math.round(last.right + (first.left - tr.left) - tr.right));
        it.grow = it.fill ? Math.round(window.innerHeight * 0.9) : 0;
        it.sec.style.height = (window.innerHeight - hh + it.dist + it.grow) + 'px';
        it.top = it.sec.getBoundingClientRect().top + window.scrollY;
        if (it.fill) {
          // Where the last panel will sit (relative to the camera) once the track has finished.
          var cam = it.sec.querySelector('.hs-camera').getBoundingClientRect();
          var lr = last;
          it.from = { t: lr.top - cam.top, l: lr.left - it.dist - cam.left,
                      r: cam.right - (lr.right - it.dist), b: cam.bottom - lr.bottom,
                      rad: parseFloat(getComputedStyle(it.panels[it.panels.length - 1]).borderTopRightRadius) || 0 };
          // The camera is sticky but may not be stuck yet while measuring, so use its own box.
        }
      });
      update(true);
    }

    function update(snap) {
      var hh = headerH();
      var vwMid = window.innerWidth / 2;
      items.forEach(function (it) {
        if (!it.pinned) return;
        // target/cur are scroll offsets into the section: 0..dist moves the track, dist..dist+grow grows the finale.
        it.target = Math.max(0, Math.min(it.dist + it.grow, window.scrollY + hh - it.top));
        it.cur = snap ? it.target : it.cur + (it.target - it.cur) * EASE;
        if (Math.abs(it.target - it.cur) < 0.3) it.cur = it.target;
        var x = -Math.min(it.cur, it.dist);
        it.track.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,0)';
        setProgress(it, it.dist ? -x / it.dist : 0);
        if (it.fill && it.from) {
          var g = it.grow ? Math.max(0, Math.min(1, (it.cur - it.dist) / it.grow)) : 0;
          var e = g < 0.5 ? 2 * g * g : 1 - Math.pow(-2 * g + 2, 2) / 2;
          var f = it.from, k = 1 - e, st = it.fill.style;
          st.setProperty('--ft', (f.t * k).toFixed(1) + 'px');
          st.setProperty('--fr', (f.r * k).toFixed(1) + 'px');
          st.setProperty('--fb', (f.b * k).toFixed(1) + 'px');
          st.setProperty('--fl', (f.l * k).toFixed(1) + 'px');
          st.setProperty('--frad', (f.rad * k).toFixed(1) + 'px');
          st.setProperty('--fo', Math.max(0, (g - 0.45) / 0.55).toFixed(3));
          it.fill.classList.toggle('is-on', g > 0.001);
          it.fill.classList.toggle('is-full', g > 0.98);
        }
        // Parallax: each layer moves by (panel offset from viewport centre) x its factor.
        it.pars.forEach(function (el) {
          var panel = el.closest('.hs-panel');
          var r = panel.getBoundingClientRect();
          var off = (r.left + r.width / 2 - vwMid) / window.innerWidth;
          el.style.transform = 'translate3d(' + (off * parseFloat(el.dataset.par || 0) * window.innerWidth).toFixed(2) + 'px,0,0)';
        });
      });
    }

    var raf = null;
    function loop() {
      update(false);
      var moving = items.some(function (it) { return it.pinned && Math.abs(it.target - it.cur) > 0.3; });
      raf = moving ? requestAnimationFrame(loop) : null;
    }
    function kick() { if (!raf) raf = requestAnimationFrame(loop); }
    window.addEventListener('scroll', kick, { passive: true });

    var rt;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(layout, 150); });
    window.addEventListener('load', layout);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);

    // Native (unpinned) mode: drive the counter from the track's own scroll.
    items.forEach(function (it) {
      it.track.addEventListener('scroll', function () {
        if (it.pinned) return;
        var max = it.track.scrollWidth - it.track.clientWidth;
        setProgress(it, max > 0 ? it.track.scrollLeft / max : 0);
      }, { passive: true });
      // Keyboard users: tabbing to an off-screen panel scrolls the page to reveal it.
      it.track.addEventListener('focusin', function (e) {
        if (!it.pinned) return;
        var panel = e.target.closest('.hs-panel');
        if (!panel || !it.dist) return;
        var edge = it.panels[0].offsetLeft;
        var p = Math.max(0, Math.min(1, (panel.offsetLeft - edge) / it.dist));
        window.scrollTo({ top: it.top - headerH() + p * it.dist, behavior: reduced ? 'auto' : 'smooth' });
      });
    });

    layout();
  })();

  /* Logomark intro and breakdown (pattern from lokalapps.com) ------------
     Lokal opens on a curtain of brand-colour columns with its mark in the
     centre; the columns lift, the mark settles into the page, and on
     scroll the mark's four pieces fly into the next section (GSAP Flip).
     Same idea, no library. Each piece is positioned from real layout
     boxes: the intro spot (centre of the screen), the hero slot (the
     headline's full stop) and its landing slot on an at-a-glance column,
     so it always lands exactly on its marker. Pieces are drawn at their
     largest size and only ever scaled down, so they stay sharp. The intro
     runs once per visit; narrow screens and reduced motion get the
     static logo and markers in place. --------------------------------- */
  (function () {
    var root = document.documentElement;
    var starts = [].slice.call(document.querySelectorAll('.fly-slot[data-fly]'));
    var ends = [].slice.call(document.querySelectorAll('.fly-slot[data-fly-end]'));
    var markBox = document.querySelector('.hero3-mark');
    if (starts.length !== 4 || ends.length !== 4 || !markBox) { root.classList.remove('intro-pending'); return; }
    var layer = document.createElement('div');
    layer.className = 'fly-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);
    var pieces = starts.map(function (s) {
      var el = document.createElement('div');
      el.className = 'fly-piece';
      el.innerHTML = s.innerHTML;
      layer.appendChild(el);
      // Each piece spins clockwise on the way down: one full turn, plus a quarter
      // for the bottom-left piece, the only one drawn at a different angle, so all
      // four land facing the same way.
      return { el: el, start: s, end: ends[+s.dataset.fly], a: null, b: null, ys: 0, ye: 1, t: 0, p: 0,
               spin: s.dataset.fly === '2' ? 450 : 360 };
    });
    var active = false, R = null, K = 1;
    var I = 0;               // intro amount: 1 = at the centre of the screen, 0 = in the page
    var introRunning = false;

    function pageRect(el) {
      var r = el.getBoundingClientRect();
      return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width };
    }
    function ease(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
    function introSize() { return Math.min(window.innerWidth * 0.34, window.innerHeight * 0.46); }

    function measure() {
      active = !reduced && window.innerWidth >= 900 && window.innerHeight >= 600;
      root.classList.toggle('fly-on', active);
      layer.style.display = active ? '' : 'none';
      if (!active) { finishIntro(); return; }
      var vh = window.innerHeight;
      R = pageRect(markBox);
      K = Math.max(1, introSize() / R.w);        // largest scale any piece reaches
      pieces.forEach(function (pc, i) {
        pc.el.style.transform = '';
        pc.a = pageRect(pc.start);
        pc.b = pageRect(pc.end);
        pc.el.style.width = pc.el.style.height = (pc.a.w * K) + 'px';
        pc.ys = i * 40;                                              // staggered departures
        pc.ye = Math.max(pc.ys + 120, pc.b.y - vh * 0.6 + i * 40);   // lands as its column reaches 60% down the screen
      });
      update(true);
    }

    function update(snap) {
      var y = window.scrollY, moving = false;
      var M = introSize(), k = M / R.w;
      var cx = window.scrollX + (window.innerWidth - M) / 2, cy = y + (window.innerHeight - M) / 2;
      pieces.forEach(function (pc) {
        pc.t = Math.max(0, Math.min(1, (y - pc.ys) / (pc.ye - pc.ys)));
        pc.p = snap ? pc.t : pc.p + (pc.t - pc.p) * 0.18;
        if (Math.abs(pc.t - pc.p) < 0.0005) pc.p = pc.t; else moving = true;
        var e = ease(pc.p);
        var x = pc.a.x + (pc.b.x - pc.a.x) * e;
        var yy = pc.a.y + (pc.b.y - pc.a.y) * e;
        var s = 1 + (pc.b.w / pc.a.w - 1) * e;
        var rot = pc.spin * e;
        if (I > 0) {                               // blend towards the intro spot
          x += (cx + (pc.a.x - R.x) * k - x) * I;
          yy += (cy + (pc.a.y - R.y) * k - yy) * I;
          s += (k - s) * I;
        }
        var half = pc.a.w * K / 2;
        pc.el.style.transform = 'translate3d(' + x.toFixed(2) + 'px,' + yy.toFixed(2) + 'px,0) scale(' + (s / K).toFixed(4) + ')' +
          ' translate(' + half + 'px,' + half + 'px) rotate(' + rot.toFixed(2) + 'deg) translate(' + (-half) + 'px,' + (-half) + 'px)';
        pc.el.classList.toggle('is-blue', e > 0.45);
        var landed = pc.p >= 0.999 && I === 0;
        pc.el.classList.toggle('is-landed', landed);
        pc.end.classList.toggle('is-shown', landed);
      });
      return moving;
    }

    var raf = null;
    function loop() { raf = update(false) ? requestAnimationFrame(loop) : null; }
    window.addEventListener('scroll', function () { if (active && !raf && !introRunning) raf = requestAnimationFrame(loop); }, { passive: true });
    var rt;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(measure, 150); });
    window.addEventListener('load', measure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

    // Intro ------------------------------------------------------------------
    var curtain = null;
    function finishIntro() {
      introRunning = false; I = 0;
      root.classList.remove('intro-pending', 'intro-on', 'intro-white');
      if (curtain) { curtain.remove(); curtain = null; }
      if (active && R) update(true);
    }
    function runIntro() {
      try { sessionStorage.setItem('sag-intro', '1'); } catch (e) {}
      curtain = document.createElement('div');
      curtain.className = 'intro';
      curtain.setAttribute('aria-hidden', 'true');
      curtain.innerHTML = '<span></span><span></span><span></span><span></span><span></span><span></span>';
      document.body.appendChild(curtain);
      root.classList.add('intro-on', 'intro-white');
      root.classList.remove('intro-pending');
      introRunning = true; I = 1;
      update(true);
      var t0 = performance.now(), MOVE_AT = 420, MOVE_FOR = 1050, LIFT_AT = 260, END = 1750;
      setTimeout(function () { if (curtain) curtain.classList.add('is-lifting'); }, LIFT_AT);
      (function tick() {
        if (!introRunning) return;
        var el = performance.now() - t0;
        var q = Math.max(0, Math.min(1, (el - MOVE_AT) / MOVE_FOR));
        I = 1 - ease(q);
        if (q > 0.3) root.classList.remove('intro-white');   // pieces take their brand colours mid-flight
        update(true);
        if (el < END) requestAnimationFrame(tick); else finishIntro();
      })();
    }

    measure();
    var wantIntro = root.classList.contains('intro-pending');
    if (wantIntro && active && window.scrollY < window.innerHeight * 0.5) runIntro();
    else finishIntro();
  })();

  /* At a glance: tapping a card on a touch screen turns it over (hover and
     keyboard focus do the same on desktop, in CSS). */
  (function () {
    var cards = [].slice.call(document.querySelectorAll('.usp-card'));
    cards.forEach(function (card) {
      card.addEventListener('click', function (e) {
        if (e.target.closest('a')) return;
        if (window.matchMedia('(hover: hover)').matches) return;
        var on = !card.classList.contains('is-flipped');
        cards.forEach(function (c) { c.classList.remove('is-flipped'); });
        card.classList.toggle('is-flipped', on);
      });
    });
  })();

  /* Contact form: pre-fill the message when arriving from a funnel page. */
  (function () {
    var q = document.getElementById('query');
    if (!q || q.value) return;
    var topic = new URLSearchParams(window.location.search).get('topic');
    var msg = { courses: 'I would like help finding a course.',
                scholarships: 'I would like to know which scholarships I may be eligible for.' }[topic];
    if (msg) q.value = msg;
  })();

  /* Services: hover card and zoom -----------------------------------------
     Each service row is a <details> element, so without JavaScript the list
     simply opens and closes. Here, on a desktop pointer, hovering a row shows
     a brand-coloured card beside it; clicking the row or the card grows the
     card to fill the screen (a clip-path from the card's box to the whole
     viewport) with the service in full. On touch screens the row itself
     grows. Escape, the close button or the browser's Back button reverse it,
     and /services/#<service> opens straight into that service. ---------- */
  (function () {
    var rows = [].slice.call(document.querySelectorAll('details.svc'));
    var layout = document.querySelector('.svc-layout');
    if (!rows.length || !layout) return;
    var root = document.documentElement;
    var list = layout.querySelector('.svc-list');
    var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var hoverMq = window.matchMedia('(hover: hover) and (min-width: 1000px)');
    root.classList.add('svc-enhanced');
    function syncHover() { root.classList.toggle('svc-hover', hoverMq.matches); }
    syncHover();
    if (hoverMq.addEventListener) hoverMq.addEventListener('change', syncHover);
    var ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

    // Hover card --------------------------------------------------------------
    var aside = document.createElement('aside');
    aside.className = 'svc-preview';
    aside.setAttribute('aria-hidden', 'true');
    aside.innerHTML = '<div class="svc-card"><span class="svc-card-mark"><svg viewBox=\"0 0 172.769 172.027\" fill=\"currentColor\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M82.9502 54.5508C82.9502 67.6276 67.6296 82.9489 54.5527 82.9492H41.4756V0H82.9502V54.5508ZM41.4746 82.9482H0V28.3975C7.89621e-05 15.3207 15.3206 0.000375479 28.3975 0H41.4746V82.9482ZM172.769 54.5508C172.769 67.6276 157.448 82.9489 144.371 82.9492H131.294V41.4746H131.293V82.9482H89.8184V28.3975C89.8184 15.3207 105.139 0.000352465 118.216 0H172.768L172.769 41.4746C172.769 41.4866 172.769 41.8758 172.769 54.5508ZM82.9502 172.027H41.4756V130.553H82.9502V172.027ZM41.4746 172.026C41.4673 172.026 41.1621 172.026 28.3975 172.026C15.3206 172.026 0 156.706 0 143.629V130.552H41.4746V172.026ZM54.5527 89.0732C67.6296 89.0735 82.9502 104.394 82.9502 117.471V130.548H0.000976562V89.0732H54.5527ZM131.293 172.027H89.8184V130.553H131.293V172.027ZM172.769 143.629C172.769 156.706 157.448 172.026 144.371 172.026H131.294V130.552H172.769C172.769 130.552 172.769 130.552 172.769 143.629ZM172.768 130.548H89.8184C89.8184 130.548 89.8184 130.548 89.8184 117.471C89.8184 104.394 105.139 89.0735 118.216 89.0732H172.768V130.548Z\"/></svg></span>' +
      '<span class="svc-card-n"></span><span class="svc-card-t"></span><span class="svc-card-l"></span>' +
      '<span class="svc-card-go">View details ' + ARROW + '</span></div>';
    layout.appendChild(aside);
    var card = aside.firstChild, current = null, swapT;
    function parts(row) {
      return { n: row.querySelector('.svc-n').textContent, t: row.querySelector('.svc-t').textContent,
               l: row.querySelector('.svc-lead').textContent, tone: row.getAttribute('data-tone') || '1' };
    }
    function place(row) {
      var y = row.offsetTop + row.offsetHeight / 2 - card.offsetHeight / 2;
      y = Math.max(0, Math.min(list.offsetHeight - card.offsetHeight, y));
      card.style.setProperty('--y', y + 'px');
    }
    function show(row) {
      if (!hoverMq.matches || current === row) return;
      var d = parts(row), first = !card.classList.contains('is-on');
      current = row;
      function fill() {
        card.querySelector('.svc-card-n').textContent = d.n;
        card.querySelector('.svc-card-t').textContent = d.t;
        card.querySelector('.svc-card-l').textContent = d.l;
        card.className = 'svc-card is-on tone-' + d.tone;
        place(row);
      }
      clearTimeout(swapT);
      if (first) { fill(); return; }
      card.classList.add('is-swapping');          // words fade out, colour and position glide
      card.className = 'svc-card is-on is-swapping tone-' + d.tone;
      place(row);
      swapT = setTimeout(function () { fill(); }, 160);
    }
    function hide() { current = null; card.classList.remove('is-on'); }
    rows.forEach(function (row) { row.addEventListener('mouseenter', function () { show(row); }); });
    layout.addEventListener('mouseleave', hide);
    card.addEventListener('click', function () { if (current) open(current, card); });

    // Zoom ----------------------------------------------------------------------
    var zoom = document.createElement('div');
    zoom.className = 'svc-zoom';
    zoom.hidden = true;
    zoom.setAttribute('role', 'dialog');
    zoom.setAttribute('aria-modal', 'true');
    zoom.setAttribute('aria-labelledby', 'svcZoomTitle');
    zoom.innerHTML = '<button class="svc-zoom-close" type="button" aria-label="Close">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18"/></svg></button>' +
      '<div class="wrap svc-zoom-inner"><div class="svc-zoom-head"><span class="svc-zoom-n"></span>' +
      '<h2 class="svc-zoom-t" id="svcZoomTitle"></h2></div><div class="svc-zoom-body"></div></div>';
    document.body.appendChild(zoom);
    var closeBtn = zoom.querySelector('.svc-zoom-close');
    var openRow = null, pushed = false, endT;

    function boxOf(el) {
      var r = el.getBoundingClientRect(), vw = document.documentElement.clientWidth, vh = window.innerHeight;
      var round = el === card ? ' round 0px 36px 0px 36px' : ' round 0px 0px 0px 0px';
      return 'inset(' + Math.max(0, r.top) + 'px ' + Math.max(0, vw - r.right) + 'px ' +
             Math.max(0, vh - r.bottom) + 'px ' + Math.max(0, r.left) + 'px' + round + ')';
    }
    function originFor(row) {
      return (hoverMq.matches && current === row && card.classList.contains('is-on')) ? card : row.querySelector('summary');
    }
    function open(row, fromHash) {
      if (openRow) return;
      openRow = row;
      var d = parts(row);
      zoom.className = 'svc-zoom tone-' + d.tone;
      zoom.querySelector('.svc-zoom-n').textContent = d.n;
      zoom.querySelector('.svc-zoom-t').textContent = d.t;
      zoom.querySelector('.svc-zoom-body').innerHTML = row.querySelector('.svc-body').innerHTML;
      var from = originFor(row);
      zoom.style.transition = 'none';
      zoom.style.clipPath = still ? '' : boxOf(from);
      zoom.hidden = false;
      void zoom.offsetWidth;
      zoom.style.transition = '';
      root.classList.add('svc-zoom-open');
      requestAnimationFrame(function () {
        zoom.classList.add('is-open');
        if (!still) zoom.style.clipPath = 'inset(0px 0px 0px 0px round 0px 0px 0px 0px)';
      });
      closeBtn.focus({ preventScroll: true });
      if (fromHash === true) { pushed = false; }
      else { try { history.pushState({ svc: row.id }, '', '#' + row.id); pushed = true; } catch (e) { pushed = false; } }
    }
    function finishClose() {
      clearTimeout(endT);
      zoom.hidden = true;
      zoom.classList.remove('is-open');
      root.classList.remove('svc-zoom-open');
      var row = openRow; openRow = null;
      if (row) row.querySelector('summary').focus({ preventScroll: true });
    }
    function close() {
      if (!openRow) return;
      if (hoverMq.matches) show(openRow);           // bring the card back so the view shrinks into it
      zoom.classList.remove('is-open');
      if (still) { finishClose(); return; }
      zoom.style.clipPath = boxOf(originFor(openRow));
      endT = setTimeout(finishClose, 800);
    }
    function requestClose() {
      if (!openRow) return;
      if (pushed) { history.back(); }               // popstate below does the closing
      else { close(); try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {} }
    }
    window.addEventListener('popstate', function () { if (openRow) { pushed = false; close(); } });
    closeBtn.addEventListener('click', requestClose);
    zoom.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); requestClose(); return; }
      if (e.key !== 'Tab') return;                  // keep focus inside the open view
      var f = [].slice.call(zoom.querySelectorAll('a[href], button'));
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    rows.forEach(function (row) {
      row.querySelector('summary').addEventListener('click', function (e) { e.preventDefault(); open(row); });
    });
    function openFromHash() {
      var id = decodeURIComponent(location.hash.slice(1));
      var row = id && document.getElementById(id);
      if (row && row.tagName === 'DETAILS' && !openRow) {
        row.scrollIntoView({ block: 'center' });
        setTimeout(function () { open(row, true); }, 250);
      }
    }
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
  })();

  /* Enquiry form --------------------------------------------------------- */
  var form = document.getElementById('enquiry');
  if (!form) return;

  var CONFIG = { key: 'J6sCZb4-rkfiZHR04', service: 'service_6iaqh1h', template: 'template_wgpnprz' };
  var ok = document.getElementById('formOk');
  var bad = document.getElementById('formBad');
  var submitBtn = document.getElementById('submitBtn');
  var label = submitBtn.querySelector('span');

  function ready() { return window.emailjs && typeof window.emailjs.send === 'function'; }
  function initEmail() { if (ready()) { try { window.emailjs.init({ publicKey: CONFIG.key }); } catch (e) {} } }
  window.addEventListener('load', initEmail);

  function fieldError(el, message) {
    var wrap = el.closest('.field');
    if (!wrap) return;
    var note = wrap.querySelector('.err');
    if (message) {
      if (!note) { note = document.createElement('span'); note.className = 'err'; wrap.appendChild(note); }
      note.textContent = message;
      el.setAttribute('aria-invalid', 'true');
    } else {
      if (note) note.remove();
      el.removeAttribute('aria-invalid');
    }
  }

  function validate() {
    var valid = true, firstBad = null;
    form.querySelectorAll('[required]').forEach(function (el) {
      if (el.type === 'radio') {
        var group = form.querySelectorAll('[name="' + el.name + '"]');
        var chosen = Array.prototype.some.call(group, function (r) { return r.checked; });
        if (!chosen) { valid = false; firstBad = firstBad || el; }
        return;
      }
      var v = (el.value || '').trim();
      if (!v) { fieldError(el, 'This field is required.'); valid = false; firstBad = firstBad || el; }
      else if (el.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) {
        fieldError(el, 'Enter a valid email address.'); valid = false; firstBad = firstBad || el;
      } else { fieldError(el, null); }
    });
    if (firstBad) firstBad.focus();
    return valid;
  }

  form.addEventListener('input', function (e) {
    if (e.target.hasAttribute('aria-invalid')) fieldError(e.target, null);
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    ok.classList.remove('show');
    bad.classList.remove('show');
    if (!validate()) return;

    var data = {};
    new FormData(form).forEach(function (v, k) { data[k] = v; });
    data.page_url = location.href;

    submitBtn.disabled = true;
    label.textContent = 'Sending…';
    initEmail();

    if (!ready()) {
      bad.classList.add('show');
      bad.scrollIntoView({ block: 'center', behavior: 'smooth' });
      submitBtn.disabled = false;
      label.textContent = 'Send enquiry';
      return;
    }

    window.emailjs.send(CONFIG.service, CONFIG.template, data)
      .then(function () {
        form.reset();
        ok.classList.add('show');
        ok.scrollIntoView({ block: 'center', behavior: 'smooth' });
        if (window.gtag) window.gtag('event', 'generate_lead', { form: 'enquiry' });
        if (window.fbq) window.fbq('track', 'Lead');
      })
      .catch(function () {
        bad.classList.add('show');
        bad.scrollIntoView({ block: 'center', behavior: 'smooth' });
      })
      .then(function () {
        submitBtn.disabled = false;
        label.textContent = 'Send enquiry';
      });
  });
})();
