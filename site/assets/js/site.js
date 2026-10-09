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

  /* Logomark breakdown (pattern from lokalapps.com) ----------------------
     Lokal splits its logo into four SVG pieces and uses GSAP Flip to fly
     each one from the hero into a slot in the next section. Same idea,
     no library: each piece travels between two real layout positions,
     the hero slot and its landing slot on a card, so where it lands is
     always exactly where the card's marker sits. Pieces are staggered
     and eased toward their target each frame, like Lokal's scrub. On
     narrow screens and under reduced motion nothing flies; the static
     logo and the static card markers simply show in place. ----------- */
  (function () {
    var starts = [].slice.call(document.querySelectorAll('.fly-slot[data-fly]'));
    var ends = [].slice.call(document.querySelectorAll('.fly-slot[data-fly-end]'));
    if (starts.length !== 4 || ends.length !== 4) return;
    var layer = document.createElement('div');
    layer.className = 'fly-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);
    var pieces = starts.map(function (s) {
      var el = document.createElement('div');
      el.className = 'fly-piece';
      el.innerHTML = s.innerHTML;
      layer.appendChild(el);
      return { el: el, start: s, end: ends[+s.dataset.fly], a: null, b: null, ys: 0, ye: 1, t: 0, p: 0 };
    });
    var active = false;

    function pageRect(el) {
      var r = el.getBoundingClientRect();
      return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width };
    }
    function ease(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

    function measure() {
      active = !reduced && window.innerWidth >= 900 && window.innerHeight >= 600;
      document.documentElement.classList.toggle('fly-on', active);
      layer.style.display = active ? '' : 'none';
      if (!active) return;
      var vh = window.innerHeight;
      pieces.forEach(function (pc, i) {
        pc.el.style.transform = '';
        pc.a = pageRect(pc.start);
        pc.b = pageRect(pc.end);
        pc.el.style.width = pc.el.style.height = pc.a.w + 'px';
        pc.ys = i * 40;                                          // staggered departures
        pc.ye = Math.max(pc.ys + 120, pc.b.y - vh * 0.6 + i * 40);   // lands as its card reaches 60% down the screen
      });
      update(true);
    }

    function update(snap) {
      var y = window.scrollY, moving = false;
      pieces.forEach(function (pc) {
        pc.t = Math.max(0, Math.min(1, (y - pc.ys) / (pc.ye - pc.ys)));
        pc.p = snap ? pc.t : pc.p + (pc.t - pc.p) * 0.18;
        if (Math.abs(pc.t - pc.p) < 0.0005) pc.p = pc.t; else moving = true;
        var e = ease(pc.p);
        var x = pc.a.x + (pc.b.x - pc.a.x) * e;
        var yy = pc.a.y + (pc.b.y - pc.a.y) * e;
        var s = 1 + (pc.b.w / pc.a.w - 1) * e;
        pc.el.style.transform = 'translate3d(' + x.toFixed(2) + 'px,' + yy.toFixed(2) + 'px,0) scale(' + s.toFixed(4) + ')';
      });
      return moving;
    }

    var raf = null;
    function loop() { raf = update(false) ? requestAnimationFrame(loop) : null; }
    window.addEventListener('scroll', function () { if (active && !raf) raf = requestAnimationFrame(loop); }, { passive: true });
    var rt;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(measure, 150); });
    window.addEventListener('load', measure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    measure();
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

  /* Services list: open the row a link points at (/services/#visa-application-support). svc-hash */
  (function () {
    function openHash() {
      var id = decodeURIComponent(location.hash.slice(1));
      var el = id && document.getElementById(id);
      if (el && el.tagName === 'DETAILS') { el.open = true; el.scrollIntoView({ block: 'start' }); }
    }
    openHash();
    window.addEventListener('hashchange', openHash);
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
