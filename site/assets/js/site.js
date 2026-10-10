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
      // Each piece spins clockwise on the way down and lands in the orientation of the
      // logo's bottom-left quarter (rounded top right and bottom left). That piece makes
      // one full turn; the other three, drawn a quarter turn apart, make one and a quarter.
      return { el: el, start: s, end: ends[+s.dataset.fly], a: null, b: null, ys: 0, ye: 1, t: 0, p: 0,
               spin: s.dataset.fly === '2' ? 360 : 450 };
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
    var qs = new URLSearchParams(window.location.search), topic = qs.get('topic'), about = qs.get('about');
    var msg = { courses: 'I would like help finding a course.',
                scholarships: 'I would like to know which scholarships I may be eligible for.',
                'ivy-league': 'I would like help applying to Ivy League universities.',
                'russell-group': 'I would like help applying to Russell Group universities.' }[topic];
    if (about) msg = 'I would like to know more about ' + about.slice(0, 120) + '.';
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
      '<span class="svc-card-go">Click to view details ' + ARROW + '</span></div>';
    document.body.appendChild(aside);              // fixed to the viewport, so no ancestor transform can shift it
    var card = aside.firstChild, current = null, swapT;
    function parts(row) {
      return { n: row.querySelector('.svc-n').textContent, t: row.querySelector('.svc-t').textContent,
               l: row.querySelector('.svc-lead').textContent, tone: row.getAttribute('data-tone') || '1' };
    }

    // The card trails the cursor: it sits beside the pointer, eases after it, and flips to the
    // left of the pointer near the right edge of the screen.
    var GAP = 28, mx = 0, my = 0, x = null, y = null, raf = 0, flipped = false;
    function target() {
      var w = aside.offsetWidth, h = card.offsetHeight || aside.offsetHeight, vw = document.documentElement.clientWidth, vh = window.innerHeight;
      var flip = mx + GAP + w > vw - 16;
      if (flip !== flipped) { flipped = flip; card.classList.toggle('is-left', flip); }
      var tx = flip ? mx - GAP - w : mx + GAP;
      var ty = Math.max(16, Math.min(vh - h - 16, my - h / 2));
      return [Math.max(16, tx), ty];
    }
    function paint() { aside.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)'; }
    function tick() {
      var t = target();
      if (x === null || still) { x = t[0]; y = t[1]; }
      else { x += (t[0] - x) * .2; y += (t[1] - y) * .2; }
      paint();
      raf = (Math.abs(t[0] - x) > .4 || Math.abs(t[1] - y) > .4) ? requestAnimationFrame(tick) : 0;
    }
    function follow(e) {
      mx = e.clientX; my = e.clientY;
      if (!current && !openRow) {                   // pointer already over a row (after closing, or a scroll)
        var row = e.target && e.target.closest ? e.target.closest('details.svc') : null;
        if (row) show(row);
      }
      if (!raf) raf = requestAnimationFrame(tick);
    }
    function show(row) {
      if (!hoverMq.matches || current === row) return;
      var d = parts(row), first = !card.classList.contains('is-on');
      current = row;
      function fill() {
        card.querySelector('.svc-card-n').textContent = d.n;
        card.querySelector('.svc-card-t').textContent = d.t;
        card.querySelector('.svc-card-l').textContent = d.l;
        card.className = 'svc-card is-on tone-' + d.tone + (flipped ? ' is-left' : '');
      }
      clearTimeout(swapT);
      if (first) { cancelAnimationFrame(raf); raf = 0; x = null; fill(); tick(); return; }  // appear at the cursor, no glide in
      card.className = 'svc-card is-on is-swapping tone-' + d.tone + (flipped ? ' is-left' : '');  // words fade, colour glides
      swapT = setTimeout(fill, 140);
    }
    function hide() { current = null; card.classList.remove('is-on'); }
    list.addEventListener('mousemove', follow);
    rows.forEach(function (row) {
      row.addEventListener('mouseenter', function (e) { follow(e); show(row); });
    });
    list.addEventListener('mouseleave', function () { if (!openRow) hide(); });

    // Never leave the card on screen when the pointer is not over a service. mouseleave alone
    // misses two cases: the page scrolling under a still pointer, and the full-screen view
    // closing (it brings the card back to shrink into) while the pointer is elsewhere.
    function rowAtPointer() {
      var el = document.elementFromPoint(mx, my);
      var row = el && el.closest ? el.closest('details.svc') : null;
      return row && list.contains(row) ? row : null;
    }
    function recheck() {
      if (openRow || !card.classList.contains('is-on')) return;
      var row = rowAtPointer();
      if (!row) hide(); else if (row !== current) show(row);
    }
    var scrollT;
    window.addEventListener('scroll', function () {
      if (!card.classList.contains('is-on')) return;
      clearTimeout(scrollT); scrollT = setTimeout(recheck, 60);
    }, { passive: true });
    document.addEventListener('mousemove', function (e) {
      if (openRow || !card.classList.contains('is-on')) return;
      mx = e.clientX; my = e.clientY;
      var r = list.getBoundingClientRect();
      if (mx < r.left || mx > r.right || my < r.top || my > r.bottom) hide();
    }, { passive: true });
    document.documentElement.addEventListener('mouseleave', function () { if (!openRow) hide(); });
    window.addEventListener('blur', function () { if (!openRow) hide(); });
    document.addEventListener('visibilitychange', function () { if (document.hidden && !openRow) hide(); });

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
      hide();                                        // it returns on the next pointer move over a service
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

  /* Universities we recommend: as each card slides over the one before, the covered card
     eases back a touch, so the stack reads as layered cards rather than a list. -------- */
  (function () {
    var cards = [].slice.call(document.querySelectorAll('.uni-card'));
    if (cards.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var raf = 0;
    function update() {
      raf = 0;
      for (var i = 0; i < cards.length - 1; i++) {
        var a = cards[i].getBoundingClientRect(), b = cards[i + 1].getBoundingClientRect();
        var h = cards[i].offsetHeight, p = Math.max(0, Math.min(1, (a.top + h - b.top) / Math.max(1, h)));
        cards[i].style.transform = p ? 'scale(' + (1 - .05 * p).toFixed(4) + ')' : '';
        cards[i].style.filter = p ? 'brightness(' + (1 - .06 * p).toFixed(4) + ')' : '';
      }
    }
    function queue() { if (!raf) raf = requestAnimationFrame(update); }
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    update();
  })();

  /* Universities page: search across every country's logo grid. -------------------------- */
  (function () {
    var countries = [].slice.call(document.querySelectorAll('section.country'));
    if (!countries.length || !document.querySelector('.uni-grid')) return;
    var box = document.createElement('div');
    box.className = 'uni-search';
    box.innerHTML = '<label class="fb fb-search"><span>Search universities</span>' +
      '<input type="search" placeholder="Type a university, college or city" autocomplete="off">' +
      '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M10 2a8 8 0 0 1 6.3 12.9l5.4 5.4-1.4 1.4-5.4-5.4A8 8 0 1 1 10 2Zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12Z"/></svg></label>' +
      '<p class="uni-search-n" aria-live="polite"></p>';
    var jumpBar = document.querySelector('.country-jump');
    (jumpBar || countries[0]).parentNode.insertBefore(box, jumpBar || countries[0]);
    var input = box.querySelector('input'), note = box.querySelector('.uni-search-n');
    var norm = function (t) { return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' '); };
    var t;
    input.addEventListener('input', function () {
      clearTimeout(t);
      t = setTimeout(function () {
        var q = norm(input.value).trim(), total = 0;
        countries.forEach(function (d, i) {
          var n = 0;
          d.querySelectorAll('.uni-tile').forEach(function (li) {
            var hit = !q || norm(li.textContent).indexOf(q) > -1;
            li.hidden = !hit; if (hit) n++;
          });
          d.querySelectorAll('.list-head').forEach(function (h) {
            var g = h.nextElementSibling; if (!g || !g.classList.contains('uni-grid')) return;
            var any = [].some.call(g.children, function (li) { return !li.hidden; });
            h.hidden = !any; g.hidden = !any;
          });
          d.hidden = q && !n;
          total += n;
        });
        note.textContent = q ? (total ? total + (total === 1 ? ' match' : ' matches') : 'No matches. Try a shorter name, or ask a counsellor.') : '';
      }, 120);
    });
  })();

  /* Documents checklist: ticks saved on this device, progress, print. ------------------- */
  (function () {
    var all = [].slice.call(document.querySelectorAll('input[data-dc]'));
    if (!all.length) return;
    var boxes = all;
    var KEY = 'sag-doc-checklist', saved = {};
    var LKEY = 'sag-doc-level', level = 'ug';
    try { level = localStorage.getItem(LKEY) === 'pg' ? 'pg' : 'ug'; } catch (e) {}
    var totalEl = document.querySelector('[data-dc-total]');
    function setLevel(l) {
      level = l;
      document.querySelectorAll('.dc-group[data-level]').forEach(function (g) {
        var v = g.getAttribute('data-level'); g.hidden = v !== 'all' && v !== l;
      });
      document.querySelectorAll('[data-dc-level]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-dc-level') === l ? 'true' : 'false'); });
      boxes = all.filter(function (b) { return !b.closest('.dc-group').hidden; });
      try { localStorage.setItem(LKEY, l); } catch (e) {}
    }
    document.querySelectorAll('[data-dc-level]').forEach(function (b) {
      b.addEventListener('click', function () { setLevel(b.getAttribute('data-dc-level')); update(); });
    });
    setLevel(level);
    try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { saved = {}; }
    var done = document.querySelector('[data-dc-done]'), meter = document.querySelector('[data-dc-meter]');
    function update() {
      var n = 0, by = {};
      boxes.forEach(function (b) {
        var g = b.getAttribute('data-dc').replace(/-\d+$/, '');
        by[g] = by[g] || [0, 0]; by[g][1]++;
        if (b.checked) { n++; by[g][0]++; }
        b.closest('.dc-item').classList.toggle('is-done', b.checked);
      });
      if (done) done.textContent = n;
      if (totalEl) totalEl.textContent = boxes.length;
      if (meter) meter.style.width = (100 * n / boxes.length).toFixed(1) + '%';
      Object.keys(by).forEach(function (g) {
        var el = document.querySelector('[data-dc-count="' + g + '"]');
        if (el) el.textContent = by[g][0] + ' of ' + by[g][1];
      });
    }
    all.forEach(function (b) {
      b.checked = !!saved[b.getAttribute('data-dc')];
      b.addEventListener('change', function () {
        saved[b.getAttribute('data-dc')] = b.checked;
        try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) {}
        update();
      });
    });
    var printBtn = document.querySelector('[data-dc-print]'), reset = document.querySelector('[data-dc-reset]');
    if (printBtn) printBtn.addEventListener('click', function () { window.print(); });
    if (reset) reset.addEventListener('click', function () {
      saved = {}; all.forEach(function (b) { b.checked = false; });
      try { localStorage.removeItem(KEY); } catch (e) {}
      update();
    });
    update();
  })();

  /* Floating contact button: WhatsApp (UK and Pakistan), call, or book an appointment. ---- */
  (function () {
    if (document.querySelector('.contact-fab')) return;
    var IC = {
      chat: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M12 3C6.9 3 3 6.6 3 11c0 2.3 1.1 4.4 2.9 5.9L5 21l4.3-2.1c.9.2 1.8.3 2.7.3 5.1 0 9-3.6 9-8.2S17.1 3 12 3Zm-4 9.3a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6Zm4 0a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6Zm4 0a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6Z"/></svg>',
      phone: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1l-2.3 2.2Z"/></svg>',
      cal: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M7 2h2v2h6V2h2v2h3a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3V2Zm12 8H5v9h14v-9ZM7 12h4v4H7v-4Z"/></svg>',
      doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M15 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7l-4-4Z"/><path d="m8.5 13.5 2.2 2.2 4.8-4.8"/></svg>',
      close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18"/></svg>'
    };
    var wrap = document.createElement('div');
    wrap.className = 'contact-fab';
    wrap.innerHTML =
      '<div class="cf-panel" id="cfPanel" hidden>' +
        '<p class="cf-h">Talk to a counsellor</p>' +
        '<a class="cf-item" href="https://wa.me/447444761202" target="_blank" rel="noopener">' + IC.chat + '<span>WhatsApp, United Kingdom<small>+44 7444 761202</small></span></a>' +
        '<a class="cf-item" href="https://wa.me/923324111224" target="_blank" rel="noopener">' + IC.chat + '<span>WhatsApp, Pakistan<small>+92 332 4111224</small></span></a>' +
        '<a class="cf-item" href="tel:+447444761202">' + IC.phone + '<span>Call the UK office<small>+44 7444 761202</small></span></a>' +
        '<a class="cf-item" href="tel:+923324111224">' + IC.phone + '<span>Call the Pakistan office<small>+92 332 4111224</small></span></a>' +
        '<a class="cf-item" href="/contact/?form=research#enquiry">' + IC.doc + '<span>Research proposal writing<small>For PhD, MPhil and research degrees</small></span></a>' +
        (location.pathname.indexOf('/documents-checklist') === 0 ? '' : '<a class="cf-item" href="/documents-checklist/">' + IC.doc + '<span>Documents checklist<small>What to prepare before you apply</small></span></a>') +
        '<a class="cf-item cf-book" href="/contact/#enquiry">' + IC.cal + '<span>Book an appointment<small>Free first consultation</small></span></a>' +
      '</div>' +
      '<button type="button" class="cf-btn" aria-expanded="false" aria-controls="cfPanel" aria-label="Contact a counsellor">' +
        '<span class="cf-ico cf-ico-open">' + IC.chat + '</span><span class="cf-ico cf-ico-close">' + IC.close + '</span></button>';
    document.body.appendChild(wrap);
    var btn = wrap.querySelector('.cf-btn'), panel = wrap.querySelector('.cf-panel');
    function set(open) {
      panel.hidden = !open; btn.setAttribute('aria-expanded', String(open)); wrap.classList.toggle('is-open', open);
      if (open) { var first = panel.querySelector('a'); if (first) first.focus({ preventScroll: true }); }
    }
    btn.addEventListener('click', function () { set(panel.hidden); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) { set(false); btn.focus(); } });
    document.addEventListener('click', function (e) { if (!panel.hidden && !wrap.contains(e.target)) set(false); });
    panel.addEventListener('click', function (e) {
      var a = e.target.closest('a'); if (!a) return;
      try { if (window.gtag) window.gtag('event', 'contact_fab', { link: a.getAttribute('href').split('?')[0] }); } catch (err) {}
      if (a.classList.contains('cf-book') && location.pathname.indexOf('/contact') === 0) set(false);
    });
    // Sit above the cookie banner while it is showing.
    var bar = document.getElementById('cookieBar');
    function lift() { wrap.style.setProperty('--cf-lift', bar && !bar.hidden ? bar.offsetHeight + 'px' : '0px'); }
    lift();
    if (bar && window.MutationObserver) new MutationObserver(lift).observe(bar, { attributes: true, attributeFilter: ['hidden'] });
    window.addEventListener('resize', lift);
  })();

  /* Paper plane that trails the pointer, banks with scrolling and takes a colour that reads on
     whatever it is flying over. Fine pointers only; off for reduced motion. ------------------- */
  (function () {
    if (!window.matchMedia || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var el = document.createElement('div');
    el.className = 'plane-cursor';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<svg viewBox="0 0 24 24" focusable="false"><path d="M2.6 10.9 21 3.2c.6-.2 1.1.3.9.9l-7.7 18.4c-.3.6-1.1.6-1.4 0l-2.6-6.2-6.2-2.6c-.6-.3-.6-1.1 0-1.4Z" fill="currentColor"/><path d="m10.2 13.8 5.3-5.3" stroke="rgba(0,0,0,.18)" stroke-width="1.4" stroke-linecap="round" fill="none"/></svg>';
    document.body.appendChild(el);
    var PAL = { azure: [48, 127, 226], mint: [0, 193, 159], choc: [62, 31, 11], cream: [248, 247, 244] };
    function lum(c) { return c.map(function (v) { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); })
                              .reduce(function (a, v, i) { return a + v * [.2126, .7152, .0722][i]; }, 0); }
    function ratio(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
    function bgAt(x, y) {
      var stack = document.elementsFromPoint(x, y);
      for (var i = 0; i < stack.length; i++) {
        var n = stack[i];
        if (n === el || el.contains(n)) continue;
        if (n.tagName === 'IMG' || n.tagName === 'VIDEO' || n.tagName === 'PICTURE') return null;
        var m = /rgba?\(([^)]+)\)/.exec(getComputedStyle(n).backgroundColor);
        if (!m) continue;
        var v = m[1].split(',').map(parseFloat);
        if (v.length === 4 && v[3] < .5) continue;
        return v.slice(0, 3);
      }
      return PAL.cream;
    }
    function pick(bg) {
      var a = ratio(PAL.azure, bg), m = ratio(PAL.mint, bg);
      if (Math.max(a, m) >= 2.6) return a >= m ? 'azure' : 'mint';
      return ratio(PAL.choc, bg) >= ratio(PAL.cream, bg) ? 'choc' : 'cream';
    }
    var mx = -100, my = -100, x = -100, y = -100, ang = 0, tilt = 0, shown = false, last = 0, tone = '';
    var sy = window.scrollY, sv = 0;
    addEventListener('pointermove', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      mx = e.clientX; my = e.clientY;
      if (!shown) { x = mx; y = my; shown = true; el.classList.add('is-on'); }
    }, { passive: true });
    document.addEventListener('pointerleave', function () { shown = false; el.classList.remove('is-on'); });
    addEventListener('blur', function () { shown = false; el.classList.remove('is-on'); });
    addEventListener('scroll', function () { var n = window.scrollY; sv += n - sy; sy = n; }, { passive: true });
    function frame(t) {
      requestAnimationFrame(frame);
      if (!shown) return;
      var tx = mx + 18, ty = my + 20, dx = tx - x, dy = ty - y;
      x += dx * .14; y += dy * .14;
      var speed = Math.hypot(dx, dy);
      if (speed > 1.5) {
        var target = Math.atan2(dy, dx) * 180 / Math.PI;   /* the drawn plane points to -45deg */
        var diff = ((target + 45 - ang) % 360 + 540) % 360 - 180;
        ang += diff * .12;
      }
      sv *= .86;                                            /* scroll gives a short bank and lift */
      tilt += (Math.max(-28, Math.min(28, sv * .6)) - tilt) * .2;
      el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + (y - Math.abs(tilt) * .25).toFixed(1) + 'px,0) rotate(' + (ang + tilt).toFixed(1) + 'deg)';
      if (t - last > 140) {
        last = t;
        var bg = bgAt(Math.round(x), Math.round(y));
        if (bg) { var nt = pick(bg); if (nt !== tone) { el.classList.remove('pc-' + tone); el.classList.add('pc-' + nt); tone = nt; } }
      }
    }
    requestAnimationFrame(frame);
  })();

  /* Ask about a university or network: WhatsApp first, enquiry form second. ------------------ */
  (function () {
    var sel = '.uni-tile, .net-card, .league-card, [data-ask]';
    if (!document.querySelector(sel)) return;
    var WA = { pk: '923324111224', uk: '447444761202' };
    var dlg = null;
    function nameOf(el) {
      var n = el.getAttribute('data-ask') || ((el.querySelector('.uni-tile-name, .net-name, h3') || {}).textContent || '');
      return n.replace(/\s+/g, ' ').trim();
    }
    function open(el) {
      var name = nameOf(el); if (!name) return;
      var isNet = el.classList.contains('net-card');
      var subject = isNet ? 'universities through ' + name : name;
      var text = encodeURIComponent('Hello SA Global, I would like to know more about ' + subject + '.');
      var img = el.querySelector('img');
      if (!dlg) { dlg = document.createElement('dialog'); dlg.className = 'ask'; document.body.appendChild(dlg);
        dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); }); }
      dlg.innerHTML = '<div class="ask-card"><button type="button" class="ask-x" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>' +
        (img && img.getAttribute('src') ? '<div class="ask-logo' + (isNet ? ' ask-logo--plate' : '') + '"' + (isNet ? ' style="background:' + (getComputedStyle(el).getPropertyValue('--b') || '#1b1b1b').trim() + '"' : '') + '><img src="' + img.getAttribute('src') + '" alt=""></div>' : '') +
        '<h2 class="ask-h" id="askH">Ask about ' + name.replace(/[<>&"]/g, '') + '</h2>' +
        '<p class="ask-p">Chat to a counsellor on WhatsApp, or send us your details and we will reply within one working day.</p>' +
        '<div class="ask-actions"><a class="btn btn-primary" data-wa="pk" href="https://wa.me/' + WA.pk + '?text=' + text + '" target="_blank" rel="noopener"><span>WhatsApp Pakistan</span><small>+92 332 4111224</small></a>' +
        '<a class="btn btn-ghost" data-wa="uk" href="https://wa.me/' + WA.uk + '?text=' + text + '" target="_blank" rel="noopener"><span>WhatsApp United Kingdom</span><small>+44 7444 761202</small></a></div>' +
        '<a class="link-arrow ask-form" href="/contact/?about=' + encodeURIComponent(subject) + '#enquiry">Send an enquiry instead <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.2 4.6 11.8 6l5 5H3v2h13.8l-5 5 1.4 1.4L21 12l-7.8-7.4Z"/></svg></a></div>';
      dlg.setAttribute('aria-labelledby', 'askH');
      dlg.querySelector('.ask-x').addEventListener('click', function () { dlg.close(); });
      dlg.querySelectorAll('[data-wa]').forEach(function (a) { a.addEventListener('click', function () {
        try { if (typeof window.gtag === 'function') window.gtag('event', 'whatsapp_click', { item: name, line: a.getAttribute('data-wa') }); } catch (e2) {}
      }); });
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    }
    document.addEventListener('click', function (e) {
      var el = e.target.closest(sel);
      if (!el || e.target.closest('.ask')) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault(); open(el);
    });
    document.querySelectorAll('.uni-tile, .league-card').forEach(function (el) {
      el.setAttribute('tabindex', '0'); el.setAttribute('role', 'button');
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(el); } });
    });
  })();

  /* Contact page: enquiry tabs and the research proposal request form. ------------------------- */
  (function () {
    var tG = document.getElementById('tabGeneral'), tR = document.getElementById('tabResearch');
    if (!tG || !tR) return;
    var pG = document.getElementById('generalPane'), pR = document.getElementById('researchPane');
    function show(research, focus) {
      tG.setAttribute('aria-selected', research ? 'false' : 'true'); tR.setAttribute('aria-selected', research ? 'true' : 'false');
      tG.tabIndex = research ? -1 : 0; tR.tabIndex = research ? 0 : -1;
      pG.hidden = research; pR.hidden = !research;
      if (focus) (research ? tR : tG).focus();
    }
    tG.addEventListener('click', function () { show(false); });
    tR.addEventListener('click', function () { show(true); });
    [tG, tR].forEach(function (t) { t.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); show(t === tG, true); }
    }); });
    if (new URLSearchParams(location.search).get('form') === 'research') {
      show(true);
      setTimeout(function () { tR.closest('div').scrollIntoView({ block: 'start' }); }, 80);
    }

    var form = document.getElementById('rpForm'), list = document.getElementById('rpList');
    var count = document.getElementById('rpCount'), total = document.getElementById('rpTotal'), note = document.getElementById('rpTotalNote');
    var PRICE = { '1000': 30, '1500': 40 };
    var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    function block(i, v) {
      v = v || {};
      return '<fieldset class="rp-item" data-i="' + i + '"><legend>Proposal ' + (i + 1) + '</legend>' +
        '<div class="field"><label for="rpCourse' + i + '">Name of the course *</label><input id="rpCourse' + i + '" data-k="course" type="text" required value="' + esc(v.course || '') + '" placeholder="e.g. PhD in Computer Science"></div>' +
        '<div class="field"><label for="rpWords' + i + '">Required word count *</label><select id="rpWords' + i + '" data-k="words" required>' +
          ['1000|1,000 words', '1500|1,500 words', 'other|Other word count'].map(function (o) { var a = o.split('|'); return '<option value="' + a[0] + '"' + ((v.words || '1000') === a[0] ? ' selected' : '') + '>' + a[1] + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="field full"><label for="rpTopic' + i + '">Research topic or proposed title *</label><input id="rpTopic' + i + '" data-k="topic" type="text" required value="' + esc(v.topic || '') + '"></div>' +
        '<div class="field rp-other"' + ((v.words || '1000') === 'other' ? '' : ' hidden') + '><label for="rpOther' + i + '">How many words? *</label><input id="rpOther' + i + '" data-k="other" type="number" min="300" max="20000" step="50" inputmode="numeric" value="' + esc(v.other || '') + '"></div>' +
        '</fieldset>';
    }
    function read() {
      return [].map.call(list.querySelectorAll('.rp-item'), function (f) {
        var o = {}; f.querySelectorAll('[data-k]').forEach(function (el) { o[el.getAttribute('data-k')] = el.value.trim(); }); return o;
      });
    }
    function render() {
      var keep = read(), n = parseInt(count.value, 10) || 1, h = '';
      for (var i = 0; i < n; i++) h += block(i, keep[i]);
      list.innerHTML = h; price();
    }
    function price() {
      var items = read(), sum = 0, quote = 0;
      items.forEach(function (it, i) {
        var f = list.querySelector('.rp-item[data-i="' + i + '"]'), other = f.querySelector('.rp-other');
        other.hidden = it.words !== 'other'; other.querySelector('input').required = it.words === 'other';
        if (PRICE[it.words]) sum += PRICE[it.words]; else quote++;
      });
      if (total) total.textContent = sum ? '£' + sum : 'On quote';
    }
    count.addEventListener('change', render);
    list.addEventListener('change', price);
    render();

    var ok = document.getElementById('rpOk'), bad = document.getElementById('rpBad'), btn = document.getElementById('rpSubmit'), lab = btn.querySelector('span');
    function err(el, m) {
      var w = el.closest('.field'); if (!w) return; var n = w.querySelector('.err');
      if (m) { if (!n) { n = document.createElement('span'); n.className = 'err'; w.appendChild(n); } n.textContent = m; el.setAttribute('aria-invalid', 'true'); }
      else { if (n) n.remove(); el.removeAttribute('aria-invalid'); }
    }
    form.addEventListener('input', function (e) { if (e.target.hasAttribute('aria-invalid')) err(e.target, null); });
    form.addEventListener('submit', function (e) {
      e.preventDefault(); ok.classList.remove('show'); bad.classList.remove('show');
      var first = null;
      form.querySelectorAll('[required]').forEach(function (el) {
        var v = (el.value || '').trim(), m = null;
        if (!v) m = 'This field is required.';
        else if (el.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) m = 'Enter a valid email address.';
        err(el, m); if (m && !first) first = el;
      });
      if (first) { first.focus(); return; }
      var items = read(), lines = items.map(function (it, i) {
        var wc = it.words === 'other' ? (it.other || '?') + ' words' : (it.words === '1000' ? '1,000 words' : '1,500 words');
        return 'Proposal ' + (i + 1) + ': ' + it.course + ' | Topic: ' + it.topic + ' | ' + wc;
      });
      var extra = document.getElementById('rpExtra').value.trim();
      var data = {
        enquiry_type: 'Research proposal writing',
        name: document.getElementById('rpName').value.trim(), email: document.getElementById('rpEmail').value.trim(),
        phoneNumber: document.getElementById('rpPhone').value.trim(),
        dob: 'Not asked', city: 'Not asked', nationality: 'Not asked', qualification: 'Not asked', gradeCgpaPercentage: 'Not asked', englishLanguageTest: 'Not asked',
        countryPreference: 'Research proposal writing', preferredCourse: items.map(function (it) { return it.course; }).join('; '),
        query: 'RESEARCH PROPOSAL WRITING REQUEST\n' + items.length + ' proposal(s)\n\n' + lines.join('\n') + (extra ? '\n\nAdditional requirements: ' + extra : ''),
        page_url: location.href
      };
      var CFG = { key: 'J6sCZb4-rkfiZHR04', service: 'service_6iaqh1h', template: 'template_wgpnprz' };
      if (!(window.emailjs && typeof window.emailjs.send === 'function')) { bad.classList.add('show'); return; }
      try { window.emailjs.init({ publicKey: CFG.key }); } catch (e1) {}
      btn.disabled = true; lab.textContent = 'Sending…';
      window.emailjs.send(CFG.service, CFG.template, data).then(function () {
        form.reset(); render(); ok.classList.add('show'); ok.scrollIntoView({ block: 'center', behavior: 'smooth' });
        if (window.gtag) window.gtag('event', 'generate_lead', { form: 'research_proposal', proposals: items.length });
        if (window.fbq) window.fbq('track', 'Lead');
      }).catch(function () { bad.classList.add('show'); bad.scrollIntoView({ block: 'center', behavior: 'smooth' }); })
        .then(function () { btn.disabled = false; lab.textContent = 'Submit enquiry'; });
    });
  })();

  /* Offer letters: open the full, blurred letter in a viewer. ------------------------------- */
  (function () {
    var btns = document.querySelectorAll('[data-offer]');
    if (!btns.length) return;
    var d = document.createElement('dialog'); d.className = 'offer-view';
    d.innerHTML = '<button type="button" class="ask-x" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button><img alt="">';
    document.body.appendChild(d);
    var img = d.querySelector('img');
    d.querySelector('.ask-x').addEventListener('click', function () { d.close(); });
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
    btns.forEach(function (b) { b.addEventListener('click', function () {
      img.src = b.getAttribute('data-offer'); img.alt = b.getAttribute('aria-label').replace(/^View the /, '') + ', with personal details blurred';
      if (d.showModal) d.showModal(); else d.setAttribute('open', '');
    }); });
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
