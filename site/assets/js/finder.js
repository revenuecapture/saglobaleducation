/* SA Global Education: course finder and scholarship finder.
 *
 * One script runs both pages (main[data-finder="courses" | "scholarships"]). The data is a
 * static JSON file written at build time from approved rows only, so search, filters and the
 * likely-eligible check all run in the browser. A student's answers stay in this browser
 * (localStorage) unless they send an enquiry, and the two finders share them so a student who
 * answered one check finds the other filled in. Nothing here ever says "eligible": only
 * "likely eligible", based on what the university or scheme publishes.
 */
(function () {
  'use strict';
  var main = document.querySelector('[data-finder]');
  if (!main) return;

  var KIND = main.getAttribute('data-finder');
  var IS_C = KIND === 'courses';
  var TODAY = new Date().toISOString().slice(0, 10);
  var PAGE = 12;
  var LEAD_URL = 'https://kdndxzqxzgnusgvgcqsv.supabase.co/functions/v1/submit-lead';
  var PUBLIC_KEY = 'sb_publishable_9xEt1H5eRtN4GSZGkxY5sQ_YHa7Nkm4';
  var CONSENT_VERSION = '2026-10-10';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ------------------------------------------------------------------------------------------
  // Vocabulary

  var LEVELS = [['foundation_pathway', 'Foundation & Pathway'], ['undergraduate', 'Undergraduate'],
                ['postgraduate', 'Postgraduate'], ['pg_diploma', 'Postgraduate Diploma'], ['doctoral', 'Doctoral / PhD']];
  var LEVEL = toMap(LEVELS);
  var QUALS = [['intermediate', 'Intermediate (HSSC: FSc, FA, ICS, ICom)'], ['alevels', 'A levels'],
               ['bachelor_14', "Two-year bachelor's (14 years of education)"],
               ['bachelor_16', "Four-year bachelor's (16 years of education)"],
               ['uk_degree', "UK bachelor's degree"], ['master', "Master's degree"]];
  var PK_QUAL = { intermediate: 1, bachelor_14: 1, bachelor_16: 1, master: 1 };
  var CLASSES = [['first', 'First class'], ['2:1', 'Upper second (2:1)'], ['2:2', 'Lower second (2:2)'], ['third', 'Third class']];
  var RANK = { first: 4, '2:1': 3, '2:2': 2, third: 1, pass: 0 };
  var TESTS = [['ielts', 'IELTS Academic'], ['pte', 'PTE Academic'], ['toefl', 'TOEFL iBT (0 to 120 scale)'], ['duolingo', 'Duolingo English Test'], ['none', 'Not taken yet']];
  var FROM = [['PK', 'Pakistan'], ['GB', 'United Kingdom'], ['OTHER', 'Another country']];
  var CURRENCIES = ['GBP', 'USD', 'CAD', 'AUD', 'NZD', 'EUR'];
  var ROUTE = { automatic: 'Automatic, no separate application', separate_application: 'Separate application', nomination: 'By nomination' };
  var TYPE = { university: 'University award', government: 'Government scheme', foundation: 'Foundation or trust' };
  var FULL = { full_funding: 1, full_tuition: 1 };
  var MODE = { full_time: 'Full time', part_time: 'Part time', online: 'Online', blended: 'Blended' };
  var ICON = {
    arrow: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M13.2 4.6 11.8 6l5 5H3v2h13.8l-5 5 1.4 1.4L21 12l-7.8-7.4Z"/></svg>',
    save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><path d="M6 3h12v18l-6-4-6 4z"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    tick: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true" focusable="false"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
    cross: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true" focusable="false"><path d="M7 7l10 10M17 7 7 17"/></svg>',
    dot: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="3.5"/></svg>',
    ext: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>'
  };

  function toMap(pairs) { var m = {}; pairs.forEach(function (p) { m[p[0]] = p[1]; }); return m; }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function money(n, cur) { return n == null ? '' : cur + ' ' + Number(n).toLocaleString('en-GB', { maximumFractionDigits: 0 }); }
  function longDate(d) {
    if (!d) return '';
    return new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  }
  function load(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function track(name, params) { try { if (typeof window.gtag === 'function') window.gtag('event', name, params || {}); } catch (e) {} }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9+#]+/g, ' ').trim(); }
  function q(sel, root) { return (root || main).querySelector(sel); }

  // ------------------------------------------------------------------------------------------
  // State

  var data = null, byUni = {}, fieldLabel = {}, destOf = {};
  var profile = load('sag-profile', null);
  var SHORT_KEY = 'sag-shortlist-' + KIND;
  var shortlist = load(SHORT_KEY, []);
  var state = { dest: '', q: '', field: '', level: '', uni: '', type: '', funding: '', sort: IS_C ? 'featured' : 'deadline', likely: false, shown: PAGE };
  var KEYS = IS_C ? ['dest', 'q', 'field', 'level', 'uni', 'sort', 'likely'] : ['dest', 'q', 'level', 'type', 'funding', 'uni', 'sort', 'likely'];
  var PARAM = { dest: 'destination' };

  function readURL() {
    var p = new URLSearchParams(location.search);
    KEYS.forEach(function (k) {
      var v = p.get(PARAM[k] || k);
      if (v === null) return;
      state[k] = k === 'likely' ? v === '1' : v;
    });
    return p;
  }
  var typingTimer = null;
  function writeURL(push) {
    var p = new URLSearchParams();
    KEYS.forEach(function (k) {
      var v = state[k];
      if (k === 'sort' && v === (IS_C ? 'featured' : 'deadline')) return;
      if (k === 'likely') { if (v) p.set('likely', '1'); return; }
      if (v) p.set(PARAM[k] || k, v);
    });
    var url = location.pathname + (p.toString() ? '?' + p.toString() : '');
    try { history[push ? 'pushState' : 'replaceState'](null, '', url); } catch (e) {}
  }

  // ------------------------------------------------------------------------------------------
  // Likely-eligible checks. Each returns a list of checks; the item is "likely" only when every
  // check passes and the academic check had real data to compare against.

  var GRADE = { 'A*': 56, A: 48, B: 40, C: 32, D: 24, E: 16 };
  function alevelPoints(s) {
    var g = String(s || '').toUpperCase().replace(/[^A-E*]/g, '').match(/A\*|[A-E]/g) || [];
    if (g.length < 3) return null;
    return g.map(function (x) { return GRADE[x]; }).sort(function (a, b) { return b - a; }).slice(0, 3).reduce(function (a, b) { return a + b; }, 0);
  }
  function routeOK(route, qual) {
    var order = { intermediate: 1, bachelor_14: 2, bachelor_16: 3, master: 4 };
    if (route === 'intermediate_plus_foundation') return qual !== 'intermediate';
    return (order[qual] || 0) >= (order[route] || 0);
  }
  function levelOK(itemLevels, want) {
    if (!want) return null;
    return itemLevels.some(function (l) {
      return l === want || (want === 'undergraduate' && l === 'foundation_pathway') || (want === 'postgraduate' && l === 'pg_diploma');
    });
  }
  function grades(p) {
    var bits = [];
    if (p.qual === 'alevels' && p.alevels) bits.push(p.alevels.toUpperCase());
    else if (p.qual === 'uk_degree' && p.ukclass) bits.push((CLASSES.find(function (c) { return c[0] === p.ukclass; }) || [0, ''])[1]);
    else { if (p.cgpa) bits.push('CGPA ' + p.cgpa); if (p.pct) bits.push(p.pct + '%'); }
    return bits.join(', ');
  }

  function equivalence(ukD) {
    var rows = (data.equivalences || []).filter(function (e) { return e.ukD === ukD; });
    return rows[0] || null;
  }

  function academicCourse(c, p) {
    var r = c.req || {};
    if (!p.qual) return { ok: null, note: 'Add your qualification' };
    if (PK_QUAL[p.qual]) {
      if (r.pkRoute) {
        if (!routeOK(r.pkRoute, p.qual)) {
          return { ok: false, note: r.pkRoute === 'intermediate_plus_foundation' ? 'The university asks Intermediate students to take a foundation year first' : 'The university asks for a higher qualification from Pakistan' };
        }
        if (r.pkCgpa != null && p.cgpa) return { ok: +p.cgpa >= r.pkCgpa, note: 'Published minimum CGPA ' + r.pkCgpa + ' out of 4' };
        if (r.pkPct != null && p.pct) return { ok: +p.pct >= r.pkPct, note: 'Published minimum ' + r.pkPct + '%' };
        if (r.pkCgpa == null && r.pkPct == null) return { ok: true, note: 'Your qualification route is accepted' };
        return { ok: null, note: 'The university states its minimum as ' + (r.pkCgpa != null ? 'a CGPA' : 'a percentage') + '; add yours to compare' };
      }
      if (r.ukD) {
        var eq = equivalence(r.ukD);
        if (eq && ((eq.cgpa != null && p.cgpa) || (eq.pct != null && p.pct))) {
          var pass = eq.cgpa != null && p.cgpa ? +p.cgpa >= eq.cgpa : +p.pct >= eq.pct;
          return { ok: pass, general: true, note: 'General guidance: SA Global treats a UK ' + r.ukD + ' as ' + (eq.cgpa != null && p.cgpa ? 'CGPA ' + eq.cgpa : eq.pct + '%') + ' or above' };
        }
      }
      return { ok: null, note: 'No Pakistan-specific requirement published; a counsellor can check' };
    }
    if (p.qual === 'alevels') {
      if (!r.ukA) return { ok: null, note: 'No A level requirement published for this course' };
      var mine = alevelPoints(p.alevels), need = alevelPoints(r.ukA);
      if (mine == null || need == null) return { ok: null, note: 'Published requirement: ' + r.ukA };
      return { ok: mine >= need, note: 'Published requirement: ' + r.ukA };
    }
    if (p.qual === 'uk_degree') {
      if (!r.ukD) return { ok: null, note: 'No degree class requirement published' };
      if (!p.ukclass) return { ok: null, note: 'Add your degree class' };
      return { ok: RANK[p.ukclass] >= RANK[r.ukD], note: 'Published requirement: ' + (CLASSES.find(function (x) { return x[0] === r.ukD; }) || [0, r.ukD])[1] };
    }
    return { ok: null, note: '' };
  }

  function englishCheck(min, band, p, label) {
    if (!p.test) return { ok: null, note: 'Add your English test' };
    if (p.test === 'none') return { ok: true, pending: true, note: 'Subject to an English test' };
    if (p.test === 'toefl' && p.score && +p.score <= 6) return { ok: null, note: 'TOEFL scores on the new 1 to 6 scale are not compared yet; a counsellor can check yours' };
    if (min == null) return { ok: null, note: 'No ' + label + ' minimum published for your test' };
    var ok = +p.score >= min;
    if (ok && p.test === 'ielts' && band != null && p.band) ok = +p.band >= band;
    return { ok: p.score ? ok : null, note: 'Published minimum ' + min + (p.test === 'ielts' && band != null ? ', ' + band + ' in each band' : '') };
  }

  function checkCourse(c, p) {
    var out = [];
    var lv = levelOK([c.level], p.level);
    out.push({ label: 'Level', ok: lv, note: lv === false ? 'This is ' + (LEVEL[c.level] || '').toLowerCase() + ' study' : '' });
    var a = academicCourse(c, p);
    out.push({ label: 'Academic', ok: a.ok, note: a.note, general: a.general });
    var r = c.req || {};
    var min = { ielts: r.ielts, pte: r.pte, toefl: r.toefl, duolingo: r.duo }[p.test];
    var e = englishCheck(min, r.band, p, (TESTS.find(function (t) { return t[0] === p.test; }) || [0, ''])[1]);
    out.push({ label: 'English', ok: e.ok, note: e.note, pending: e.pending });
    if (p.budget && p.budgetCur && c.fee != null && c.cur === p.budgetCur && c.basis === 'per_year') {
      out.push({ label: 'Budget', ok: c.fee <= +p.budget, note: money(c.fee, c.cur) + ' a year against your ' + money(p.budget, p.budgetCur) });
    }
    return out;
  }

  function checkAward(a, p) {
    var out = [];
    var from = p.from;
    var home = a.dests.length && a.dests.every(function (d) { return d === from; });
    var cOK = !from ? null : a.countries.indexOf(from) > -1 || (a.countries.indexOf('INTL') > -1 && !home);
    out.push({ label: 'Who can apply', ok: cOK, note: cOK === false ? (home ? 'For international students, not home applicants' : 'Not open to applicants from your country') : '' });
    out.push({ label: 'Level', ok: levelOK(a.levels, p.level), note: '' });
    if (a.fields.length) out.push({ label: 'Subject', ok: p.field ? a.fields.indexOf(p.field) > -1 : null, note: p.field ? '' : 'Add your subject' });
    var acad = { ok: true, note: 'No minimum grade published' };
    if (a.minCgpa != null || a.minPct != null) {
      if (PK_QUAL[p.qual] && a.minCgpa != null && p.cgpa) acad = { ok: +p.cgpa >= a.minCgpa, note: 'Minimum CGPA ' + a.minCgpa };
      else if (PK_QUAL[p.qual] && a.minPct != null && p.pct) acad = { ok: +p.pct >= a.minPct, note: 'Minimum ' + a.minPct + '%' };
      else acad = { ok: null, note: 'Minimum published as ' + (a.minCgpa != null ? 'CGPA ' + a.minCgpa : a.minPct + '%') };
    } else if (a.minUkD) {
      if (p.qual === 'uk_degree' && p.ukclass) acad = { ok: RANK[p.ukclass] >= RANK[a.minUkD], note: 'Requires a UK ' + a.minUkD + ' or equivalent' };
      else acad = { ok: null, note: 'Requires the equivalent of a UK ' + a.minUkD + '; a counsellor can check yours' };
    }
    if (a.gradeTerms && acad.ok === true) acad = { ok: null, note: 'The award terms set a grade requirement; a counsellor can check yours' };
    out.push({ label: 'Academic', ok: acad.ok, note: acad.note });
    if (a.cond) out.push({ label: 'Other conditions', ok: null, note: 'This award has conditions, such as being a former student or a family member of one, that a counsellor needs to confirm' });
    if (a.minIelts != null) out.push(Object.assign({ label: 'English' }, englishCheck(p.test === 'ielts' ? a.minIelts : null, null, p, 'IELTS')));
    out.push({ label: 'Deadline', ok: !a.deadline || a.deadline >= TODAY, note: a.deadline ? 'Closes ' + longDate(a.deadline) : (a.deadlineNote || 'No fixed deadline published') });
    return out;
  }

  function verdict(item) {
    if (!profile) return { status: 'none', checks: [] };
    var checks = IS_C ? checkCourse(item, profile) : checkAward(item, profile);
    var anyNo = checks.some(function (c) { return c.ok === false; });
    var unknown = checks.some(function (c) { return c.ok === null; });
    var general = checks.some(function (c) { return c.general; });
    return { status: anyNo ? 'no' : unknown ? 'unknown' : general ? 'general' : 'likely', checks: checks };
  }

  // ------------------------------------------------------------------------------------------
  // Filtering, search and sorting

  function haystack(it) {
    if (IS_C) {
      var u = byUni[it.uni] || {};
      return { t: norm(it.name), u: norm(u.name + ' ' + (u.city || '')), f: norm(fieldLabel[it.field] + ' ' + (it.hi || []).join(' ')) };
    }
    return { t: norm(it.name), u: norm(it.provider + ' ' + ((byUni[it.uni] || {}).name || '')), f: norm((it.summary || '') + ' ' + (it.criteria || '')) };
  }
  function score(it, tokens) {
    if (!tokens.length) return 1;
    var h = it._h, s = 0;
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (h.t.indexOf(t) > -1) s += 3; else if (h.u.indexOf(t) > -1) s += 2; else if (h.f.indexOf(t) > -1) s += 1; else return 0;
    }
    return s;
  }
  function itemDests(it) { return IS_C ? [it.dest] : it.dests; }
  function passes(it, skip) {
    if (skip !== 'dest' && state.dest && itemDests(it).indexOf(state.dest) < 0) return false;
    if (state.level && (IS_C ? it.level !== state.level : it.levels.indexOf(state.level) < 0)) return false;
    if (IS_C && state.field && it.field !== state.field) return false;
    if (state.uni && it.uni !== state.uni) return false;
    if (!IS_C && state.type && it.type !== state.type) return false;
    if (!IS_C && state.funding && (state.funding === 'full') !== !!FULL[it.valueType]) return false;
    if (state.likely && profile) { var v = it._v.status; if (v !== 'likely' && v !== 'general') return false; }
    return true;
  }
  function results() {
    var tokens = norm(state.q).split(' ').filter(Boolean);
    var list = data.items.filter(function (it) { it._s = score(it, tokens); return it._s > 0 && passes(it); });
    var name = function (it) { return IS_C ? it.title : it.name; };
    list.sort(function (a, b) {
      if (tokens.length && b._s !== a._s) return b._s - a._s;
      if (state.sort === 'name') return name(a).localeCompare(name(b));
      if (state.sort === 'uni') return ((byUni[a.uni] || {}).name || '').localeCompare((byUni[b.uni] || {}).name || '') || name(a).localeCompare(name(b));
      if (state.sort === 'fee') return (a.fee == null ? 1e12 : a.fee) - (b.fee == null ? 1e12 : b.fee);
      if (state.sort === 'deadline') return (a.deadline || '9999') .localeCompare(b.deadline || '9999') || name(a).localeCompare(name(b));
      var la = { likely: 0, general: 1 }[a._v.status], lb = { likely: 0, general: 1 }[b._v.status];
      la = la == null ? 2 : la; lb = lb == null ? 2 : lb;
      return (la - lb) || (b.featured === true) - (a.featured === true) || name(a).localeCompare(name(b));
    });
    return list;
  }

  // ------------------------------------------------------------------------------------------
  // Rendering

  function tabLabel(code) { var d = data.destinations.find(function (x) { return x.code === code; }); return d ? d.tab : code; }
  function badge(v) {
    if (v.status === 'likely') return '<span class="badge badge-likely">' + ICON.tick + 'Likely eligible</span>';
    if (v.status === 'general') return '<span class="badge badge-likely badge-general">' + ICON.tick + 'Likely eligible, general guidance</span>';
    return '';
  }
  function shortDur(it) {
    if (it.months) return it.months % 12 === 0 && it.months >= 12 ? (it.months / 12) + (it.months === 12 ? ' year' : ' years') : it.months + ' months';
    return (it.dur || '').split(/[;(]/)[0].trim();
  }
  function saveBtn(it) {
    var on = shortlist.indexOf(it.slug) > -1;
    var name = IS_C ? it.name : it.name;
    return '<button type="button" class="fc-save" data-save="' + esc(it.slug) + '" aria-pressed="' + on + '" aria-label="' + (on ? 'Remove ' : 'Save ') + esc(name) + (on ? ' from' : ' to') + ' your shortlist">' + ICON.save + '</button>';
  }
  function logoImg(u, cls) {
    return u && u.logo ? '<img class="' + cls + '" src="' + esc(u.logo) + '" alt="' + esc(u.name) + ' logo" width="200" height="56" loading="lazy" decoding="async">' : '';
  }
  function courseCard(it) {
    var u = byUni[it.uni] || {};
    var fee = it.fee != null ? '<dd>' + money(it.fee, it.cur) + ' ' + (it.basis === 'total' ? 'in total' : 'a year') + '<small>Estimated international tuition, ' + esc(it.feeYear || '') + '</small></dd>' : '<dd>Ask a counsellor</dd>';
    var sch = it.sch && it.sch.length ? '<a class="tag tag-sch" href="/scholarships/?' + (it.uni ? 'uni=' + esc(it.uni) : 'destination=' + esc(it.dest)) + '&amp;level=' + esc(it.level === 'pg_diploma' ? 'postgraduate' : it.level) + '">Scholarships available</a>' : '';
    return '<article class="fc">' +
      '<div class="fc-top"><span class="tag tag-dest">' + esc(tabLabel(it.dest)) + '</span><span class="tag">' + esc(LEVEL[it.level] || '') + '</span>' + saveBtn(it) + '</div>' +
      logoImg(u, 'fc-logo') +
      '<p class="fc-field">' + esc(fieldLabel[it.field] || '') + '</p>' +
      '<h3 class="fc-title"><a href="' + esc(it.page) + '">' + esc(it.name) + '</a></h3>' +
      '<p class="fc-uni">' + esc(u.name || '') + (u.city ? ', ' + esc(u.city) : '') + '</p>' +
      '<dl class="fc-facts"><div><dt>Duration</dt><dd>' + esc(shortDur(it) || 'See course page') + '</dd></div><div><dt>Tuition</dt>' + fee + '</div></dl>' +
      (it.hi && it.hi.length ? '<ul class="fc-hi">' + it.hi.slice(0, 2).map(function (h) { return '<li>' + esc(h) + '</li>'; }).join('') + '</ul>' : '') +
      '<div class="fc-flags">' + badge(it._v) + sch + '</div>' +
      '<div class="fc-actions"><button type="button" class="fc-btn" data-view="' + esc(it.slug) + '">View details</button>' +
      '<button type="button" class="fc-btn fc-btn-alt" data-enquire="' + esc(it.slug) + '">Enquire</button></div>' +
      '</article>';
  }
  function awardCard(it) {
    var deadline = it.deadline ? 'Closes ' + longDate(it.deadline) : (it.route === 'automatic' ? 'Considered automatically' : (it.deadlineNote || 'See the official page'));
    return '<article class="fc fc-award' + (FULL[it.valueType] ? ' fc-full' : '') + '">' +
      '<div class="fc-top">' + it.dests.slice(0, 2).map(function (d) { return '<span class="tag tag-dest">' + esc(tabLabel(d)) + '</span>'; }).join('') +
      (it.dests.length > 2 ? '<span class="tag tag-dest">+' + (it.dests.length - 2) + '</span>' : '') + saveBtn(it) + '</div>' +
      logoImg(byUni[it.uni], 'fc-logo') +
      '<p class="fc-field">' + esc(TYPE[it.type] || '') + '</p>' +
      '<h3 class="fc-title"><a href="' + esc(it.page) + '">' + esc(it.name) + '</a></h3>' +
      '<p class="fc-uni">' + esc(it.provider) + '</p>' +
      '<p class="fc-value">' + esc(it.valueText) + '</p>' +
      '<dl class="fc-facts"><div><dt>Level</dt><dd>' + esc(it.levels.map(function (l) { return LEVEL[l]; }).join(', ')) + '</dd></div>' +
      '<div><dt>Deadline</dt><dd>' + esc(deadline) + '</dd></div></dl>' +
      '<div class="fc-flags">' + badge(it._v) + '</div>' +
      '<div class="fc-actions"><button type="button" class="fc-btn" data-view="' + esc(it.slug) + '">View details</button>' +
      '<button type="button" class="fc-btn fc-btn-alt" data-enquire="' + esc(it.slug) + '">Enquire</button></div>' +
      '</article>';
  }

  function renderTabs() {
    var base = data.items.filter(function (it) { return passes(it, 'dest'); });
    var html = '<button type="button" role="tab" data-tab="" aria-selected="' + !state.dest + '">All destinations <b>' + base.length + '</b></button>';
    data.destinations.forEach(function (d) {
      var n = base.filter(function (it) { return itemDests(it).indexOf(d.code) > -1; }).length;
      var total = data.items.filter(function (it) { return itemDests(it).indexOf(d.code) > -1; }).length;
      if (!total) return;
      html += '<button type="button" role="tab" data-tab="' + d.code + '" aria-selected="' + (state.dest === d.code) + '">' + esc(d.tab) + ' <b>' + n + '</b></button>';
    });
    q('[data-tabs]').innerHTML = html;
  }

  function option(v, label, cur) { return '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(label) + '</option>'; }
  function renderSelects() {
    var html = '';
    function sel(name, label, opts) {
      html += '<label class="fb"><span>' + label + '</span><select name="' + name + '">' + opts + '</select></label>';
    }
    var unis = data.universities.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
    var uniOpts = option('', 'All universities', state.uni) + data.destinations.map(function (d) {
      var list = unis.filter(function (u) { return u.dest === d.code; });
      if (!list.length) return '';
      return '<optgroup label="' + esc(d.tab) + '">' + list.map(function (u) { return option(u.slug, u.name, state.uni); }).join('') + '</optgroup>';
    }).join('');
    var levelsPresent = LEVELS.filter(function (l) {
      return data.items.some(function (it) { return IS_C ? it.level === l[0] : it.levels.indexOf(l[0]) > -1; });
    });
    if (IS_C) {
      sel('field', 'Subject', option('', 'All subjects', state.field) + data.fields.filter(function (f) {
        return data.items.some(function (it) { return it.field === f.slug; });
      }).map(function (f) { return option(f.slug, f.label, state.field); }).join(''));
      sel('level', 'Level', option('', 'All levels', state.level) + levelsPresent.map(function (l) { return option(l[0], l[1], state.level); }).join(''));
      sel('uni', 'University', uniOpts);
      sel('sort', 'Sort', option('featured', 'Recommended', state.sort) + option('name', 'Name, A to Z', state.sort) +
        option('uni', 'University', state.sort) + (state.dest ? option('fee', 'Tuition, low to high', state.sort) : ''));
    } else {
      sel('level', 'Level', option('', 'All levels', state.level) + levelsPresent.map(function (l) { return option(l[0], l[1], state.level); }).join(''));
      sel('type', 'Provider', option('', 'All providers', state.type) + Object.keys(TYPE).filter(function (t) {
        return data.items.some(function (it) { return it.type === t; });
      }).map(function (t) { return option(t, TYPE[t], state.type); }).join(''));
      sel('funding', 'Funding', option('', 'Any funding', state.funding) + option('full', 'Full funding or full tuition', state.funding) + option('partial', 'Partial funding or fee reduction', state.funding));
      sel('sort', 'Sort', option('deadline', 'Closing soonest', state.sort) + option('featured', 'Recommended', state.sort) + option('name', 'Name, A to Z', state.sort));
    }
    q('[data-selects]').innerHTML = html;
    q('[data-filters] input[name="q"]').value = state.q;
    q('[data-likely]').checked = !!state.likely;
  }

  function renderChips() {
    var chips = [];
    if (state.q) chips.push(['q', '"' + state.q + '"']);
    if (state.dest) chips.push(['dest', tabLabel(state.dest)]);
    if (state.field) chips.push(['field', fieldLabel[state.field]]);
    if (state.level) chips.push(['level', LEVEL[state.level]]);
    if (state.uni) chips.push(['uni', (byUni[state.uni] || {}).name || state.uni]);
    if (state.type) chips.push(['type', TYPE[state.type]]);
    if (state.funding) chips.push(['funding', state.funding === 'full' ? 'Full funding' : 'Partial funding']);
    if (state.likely && profile) chips.push(['likely', 'Likely eligible only']);
    q('[data-chips]').innerHTML = chips.map(function (c) {
      return '<button type="button" class="chip" data-chip="' + c[0] + '" aria-label="Remove filter: ' + esc(c[1]) + '">' + esc(c[1]) + ICON.close + '</button>';
    }).join('') + (chips.length ? '<button type="button" class="chip-reset" data-reset>Reset all filters</button>' : '');
  }

  function renderElig() {
    var box = q('[data-elig]');
    if (!profile) {
      box.className = 'elig elig-empty';
      box.innerHTML = '<div class="elig-copy"><h2 class="elig-h">' + (IS_C ? 'Which courses are you likely eligible for?' : 'Which scholarships are you likely eligible for?') + '</h2>' +
        '<p>Answer ' + (IS_C ? 'five' : 'five') + ' quick questions. We compare your answers with what each ' + (IS_C ? 'university' : 'university or scheme') + ' publishes. Your answers stay on this device.</p></div>' +
        '<button type="button" class="btn btn-primary" data-elig-open><span>Check my eligibility</span>' + ICON.arrow + '</button>';
      return;
    }
    var bits = [FROM.find(function (f) { return f[0] === profile.from; }), LEVELS.find(function (l) { return l[0] === profile.level; })]
      .filter(Boolean).map(function (x) { return x[1]; });
    if (grades(profile)) bits.push(grades(profile));
    if (profile.test && profile.test !== 'none' && profile.score) bits.push((TESTS.find(function (t) { return t[0] === profile.test; }) || [0, ''])[1].split(' ')[0] + ' ' + profile.score);
    if (profile.test === 'none') bits.push('English test not taken yet');
    if (!IS_C && profile.field) bits.push(fieldLabel[profile.field]);
    var n = data.items.filter(function (it) { return it._v.status === 'likely' || it._v.status === 'general'; }).length;
    var homeNote = IS_C && profile.from === 'GB' ? '<p class="elig-note">UK residents usually pay home fees at UK universities. The fees shown here are international fees, so yours may be lower.</p>' : '';
    box.className = 'elig elig-set';
    box.innerHTML = '<div class="elig-copy"><h2 class="elig-h">' + n + ' ' + (IS_C ? (n === 1 ? 'course' : 'courses') : (n === 1 ? 'scholarship' : 'scholarships')) + ' you are likely eligible for</h2>' +
      '<p class="elig-profile">' + bits.map(esc).join('<span aria-hidden="true"> · </span>') + '</p>' + homeNote + '</div>' +
      '<div class="elig-actions"><button type="button" class="btn btn-ghost" data-elig-open><span>Edit answers</span></button>' +
      '<button type="button" class="link-quiet" data-elig-clear>Clear</button></div>';
  }

  function render(push) {
    data.items.forEach(function (it) { it._v = verdict(it); });
    renderTabs(); renderSelects(); renderChips(); renderElig();
    var list = results();
    var grid = q('[data-results]'), empty = q('[data-empty]'), more = q('[data-more]');
    grid.innerHTML = list.slice(0, state.shown).map(IS_C ? courseCard : awardCard).join('');
    var noun = IS_C ? (list.length === 1 ? 'programme' : 'programmes') : (list.length === 1 ? 'scholarship' : 'scholarships');
    q('[data-showing]').textContent = list.length ? 'Showing ' + Math.min(state.shown, list.length) + ' of ' + list.length + ' ' + noun : '';
    empty.hidden = list.length > 0 || !data.items.length;
    if (!list.length && data.items.length) {
      empty.innerHTML = '<p class="finder-empty-h">No ' + (IS_C ? 'programmes' : 'scholarships') + ' match these filters.</p>' +
        '<div class="btn-row"><button type="button" class="btn btn-ghost" data-reset><span>Reset filters</span></button>' +
        '<a class="btn btn-primary" href="/contact/?topic=' + KIND + '"><span>Ask a counsellor</span>' + ICON.arrow + '</a></div>';
    }
    more.hidden = list.length <= state.shown;
    writeURL(push);
  }

  function renderCount() {
    var unis = {}; data.items.forEach(function (it) { if (it.uni) unis[it.uni] = 1; });
    var dests = {}; data.items.forEach(function (it) { itemDests(it).forEach(function (d) { dests[d] = 1; }); });
    var nu = Object.keys(unis).length, nd = Object.keys(dests).length;
    q('[data-count]').innerHTML = IS_C
      ? '<b>' + data.items.length + '</b> programmes<br><b>' + nu + '</b> ' + (nu === 1 ? 'university' : 'universities') + ' in <b>' + nd + '</b> ' + (nd === 1 ? 'destination' : 'destinations')
      : '<b>' + data.items.length + '</b> open scholarships<br>across <b>' + nd + '</b> ' + (nd === 1 ? 'destination' : 'destinations');
  }

  // ------------------------------------------------------------------------------------------
  // Dialogs

  function dialog(cls, html) {
    var d = document.createElement('dialog');
    d.className = 'fd ' + cls;
    d.innerHTML = '<div class="fd-inner">' + html + '</div>';
    document.body.appendChild(d);
    d.addEventListener('close', function () { setTimeout(function () { d.remove(); }, 0); });
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); });   // click on the backdrop
    d.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', function () { d.close(); }); });
    d.showModal();
    return d;
  }
  function closeBtn() { return '<button type="button" class="fd-close" data-close aria-label="Close">' + ICON.close + '</button>'; }

  function checksHtml(v) {
    if (!profile) return '<div class="qv-check qv-check-empty"><p>See whether you are likely eligible, based on what is published.</p>' +
      '<button type="button" class="btn btn-ghost" data-elig-open><span>Check my eligibility</span></button></div>';
    var head = { likely: 'You are likely eligible', general: 'You are likely eligible (general guidance)', no: 'You may not meet every requirement', unknown: 'A counsellor will need to check some of this' }[v.status];
    return '<div class="qv-check qv-' + v.status + '"><p class="qv-check-h">' + head + '</p><ul>' + v.checks.map(function (c) {
      var ic = c.ok === true ? ICON.tick : c.ok === false ? ICON.cross : ICON.dot;
      var st = c.ok === true ? 'ok' : c.ok === false ? 'no' : 'na';
      return '<li class="ck ck-' + st + '">' + ic + '<span><b>' + esc(c.label) + '</b>' + (c.note ? ' ' + esc(c.note) : '') + '</span></li>';
    }).join('') + '</ul><p class="qv-small">Based on published requirements. The university makes the final decision. <button type="button" class="link-quiet" data-elig-open>Edit answers</button></p></div>';
  }

  function factList(rows) {
    return '<dl class="qv-facts">' + rows.filter(function (r) { return r[1]; }).map(function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd>' + r[1] + '</dd></div>'; }).join('') + '</dl>';
  }

  function openView(slug, push) {
    var it = data.items.find(function (x) { return x.slug === slug; });
    if (!it) return;
    var html;
    if (IS_C) {
      var u = byUni[it.uni] || {}, d = data.destinations.find(function (x) { return x.code === it.dest; }) || {};
      var awards = (it.sch || []).map(function (s) { return (data.awards || []).find(function (a) { return a.slug === s; }); }).filter(Boolean);
      html = closeBtn() + '<p class="qv-tags"><span class="tag tag-dest">' + esc(d.tab) + '</span><span class="tag">' + esc(LEVEL[it.level]) + '</span><span class="tag tag-quiet">' + esc(fieldLabel[it.field] || '') + '</span></p>' +
        logoImg(u, 'qv-logo') +
        '<h2 class="qv-title" id="qvTitle">' + esc(it.name) + '</h2>' +
        '<p class="qv-uni">' + esc(u.name || '') + (u.city ? ', ' + esc(u.city) : '') + '</p>' +
        factList([['Duration', esc(it.dur)], ['Study mode', esc(MODE[it.mode])],
          ['Tuition', it.fee != null ? money(it.fee, it.cur) + ' ' + (it.basis === 'total' ? 'in total' : 'a year') + '<small>Estimated international tuition, ' + esc(it.feeYear) + '</small>' : null],
          ['Intakes', esc((it.intakes || []).join(', '))]]) +
        checksHtml(it._v) +
        (it.overview ? '<p class="qv-overview">' + esc(it.overview) + '</p>' : '') +
        '<h3 class="qv-h">Entry requirements</h3>' +
        factList([['Academic', esc(it.acad)], ['English language', esc(it.eng)], ['Experience or portfolio', esc(it.exp)], ['From Pakistan', esc(it.pkNote)]]) +
        (d.psw ? '<h3 class="qv-h">Working after you graduate</h3><p>' + esc(d.psw) + ' <span class="qv-small">Checked on ' + longDate(d.pswDate) + '.</span></p>' : '') +
        (awards.length ? '<h3 class="qv-h">Scholarships for this course</h3><ul class="qv-awards">' + awards.map(function (a) { return '<li><a href="' + esc(a.page) + '">' + esc(a.name) + '</a><span>' + esc(a.valueText) + '</span></li>'; }).join('') + '</ul>' : '') +
        '<p class="qv-small">Fees and requirements are published by the university and can change. Checked on ' + longDate(it.verified) + '. Please confirm with an adviser before applying.</p>' +
        '<div class="qv-actions"><button type="button" class="btn btn-primary" data-enquire="' + esc(it.slug) + '"><span>Request course counselling</span>' + ICON.arrow + '</button>' +
        '<a class="btn btn-ghost" href="' + esc(it.page) + '"><span>Full course page</span></a>' +
        '<a class="link-arrow" href="' + esc(it.url) + '" target="_blank" rel="noopener">Official course page ' + ICON.ext + '</a></div>';
    } else {
      var who = it.countries.map(function (c) { return c === 'INTL' ? 'International applicants' : c === 'PK' ? 'Applicants from Pakistan' : c === 'GB' ? 'UK applicants' : c; }).join(', ');
      var qs = it.uni ? 'uni=' + it.uni : (it.dests.length === 1 ? 'destination=' + it.dests[0] : '');
      if (it.levels.length === 1) qs += (qs ? '&' : '') + 'level=' + it.levels[0];
      html = closeBtn() + '<p class="qv-tags">' + it.dests.map(function (d) { return '<span class="tag tag-dest">' + esc(tabLabel(d)) + '</span>'; }).join('') + '<span class="tag tag-quiet">' + esc(TYPE[it.type] || '') + '</span></p>' +
        logoImg(byUni[it.uni], 'qv-logo') +
        '<h2 class="qv-title" id="qvTitle">' + esc(it.name) + '</h2><p class="qv-uni">' + esc(it.provider) + '</p>' +
        '<p class="qv-value">' + esc(it.valueText) + '</p>' +
        factList([['Level', esc(it.levels.map(function (l) { return LEVEL[l]; }).join(', '))], ['Open to', esc(who)],
          ['How to apply', esc(ROUTE[it.route] || '')], ['Needs an offer first', it.offer === true ? 'Yes' : it.offer === false ? 'No' : null],
          ['Deadline', it.deadline ? esc(longDate(it.deadline)) : esc(it.deadlineNote)], ['Intake', esc(it.intake)]]) +
        checksHtml(it._v) +
        (it.summary ? '<p class="qv-overview">' + esc(it.summary) + '</p>' : '') +
        (it.criteria ? '<h3 class="qv-h">Who can apply</h3><p>' + esc(it.criteria) + '</p>' : '') +
        '<p class="qv-small">Award terms are set by the provider and can change. Checked on ' + longDate(it.verified) + '. Please confirm with an adviser before applying.</p>' +
        '<div class="qv-actions"><button type="button" class="btn btn-primary" data-enquire="' + esc(it.slug) + '"><span>Ask about this scholarship</span>' + ICON.arrow + '</button>' +
        '<a class="btn btn-ghost" href="/courses/' + (qs ? '?' + esc(qs) : '') + '"><span>Courses you could use this for</span></a>' +
        '<a class="link-arrow" href="' + esc(it.url) + '" target="_blank" rel="noopener">Official page ' + ICON.ext + '</a></div>';
    }
    var d = dialog('fd-view', html);
    d.setAttribute('aria-labelledby', 'qvTitle');
    bindInside(d);
    var key = IS_C ? 'course' : 'award';
    try { var p = new URLSearchParams(location.search); p.set(key, slug); history.replaceState(null, '', location.pathname + '?' + p.toString()); } catch (e) {}
    d.addEventListener('close', function () { writeURL(false); });
    track(IS_C ? 'course_view' : 'scholarship_view', { item: slug });
  }

  function bindInside(root) {
    root.querySelectorAll('[data-enquire]').forEach(function (b) {
      b.addEventListener('click', function () { var s = b.getAttribute('data-enquire'); closeAll(); openEnquiry([s]); });
    });
    root.querySelectorAll('[data-elig-open]').forEach(function (b) {
      b.addEventListener('click', function () { closeAll(); openElig(); });
    });
  }
  function closeAll() { document.querySelectorAll('dialog.fd[open]').forEach(function (d) { d.close(); }); }

  // Eligibility form ---------------------------------------------------------------------------
  function openElig() {
    var p = profile || {};
    function radios(name, opts, cur) {
      return opts.map(function (o) { return '<label class="pill"><input type="radio" name="' + name + '" value="' + o[0] + '"' + (o[0] === cur ? ' checked' : '') + '><span>' + esc(o[1]) + '</span></label>'; }).join('');
    }
    var fieldOpts = option('', 'Choose a subject', p.field || '') + data.fields.map(function (f) { return option(f.slug, f.label, p.field || ''); }).join('');
    var html = closeBtn() + '<h2 class="fd-title" id="eligTitle">' + (IS_C ? 'Check which courses you are likely eligible for' : 'Check which scholarships you are likely eligible for') + '</h2>' +
      '<p class="fd-lead">We compare your answers with what each ' + (IS_C ? 'university' : 'provider') + ' publishes. Your answers stay on this device and are only shared if you send us an enquiry.</p>' +
      '<form class="ef" novalidate>' +
      '<fieldset><legend>1. Where are you applying from?</legend><div class="pills">' + radios('from', FROM, p.from) + '</div></fieldset>' +
      '<fieldset><legend>2. What do you want to study?</legend><div class="pills">' + radios('level', LEVELS.filter(function (l) { return l[0] !== 'pg_diploma'; }), p.level) + '</div>' +
      (IS_C ? '' : '<label class="ef-field"><span>Subject</span><select name="field">' + fieldOpts + '</select></label>') + '</fieldset>' +
      '<fieldset><legend>3. Your highest qualification and result</legend>' +
      '<label class="ef-field"><span>Qualification</span><select name="qual">' + option('', 'Choose your qualification', p.qual || '') + QUALS.map(function (x) { return option(x[0], x[1], p.qual || ''); }).join('') + '</select></label>' +
      '<div class="ef-row" data-res="pk"><label class="ef-field"><span>Percentage</span><input type="number" name="pct" min="0" max="100" step="0.1" inputmode="decimal" value="' + esc(p.pct || '') + '" placeholder="e.g. 72"></label>' +
      '<label class="ef-field" data-cgpa><span>Or CGPA out of 4</span><input type="number" name="cgpa" min="0" max="4" step="0.01" inputmode="decimal" value="' + esc(p.cgpa || '') + '" placeholder="e.g. 3.2"></label></div>' +
      '<div class="ef-row" data-res="alevels"><label class="ef-field"><span>A level grades</span><input type="text" name="alevels" maxlength="12" value="' + esc(p.alevels || '') + '" placeholder="e.g. AAB"></label></div>' +
      '<div class="ef-row" data-res="uk"><label class="ef-field"><span>Degree class</span><select name="ukclass">' + option('', 'Choose', p.ukclass || '') + CLASSES.map(function (c) { return option(c[0], c[1], p.ukclass || ''); }).join('') + '</select></label></div>' +
      '</fieldset>' +
      '<fieldset><legend>4. English test</legend>' +
      '<div class="ef-row"><label class="ef-field"><span>Test</span><select name="test">' + option('', 'Choose', p.test || '') + TESTS.map(function (t) { return option(t[0], t[1], p.test || ''); }).join('') + '</select></label>' +
      '<label class="ef-field" data-score><span>Overall score</span><input type="number" name="score" min="0" max="160" step="0.5" inputmode="decimal" value="' + esc(p.score || '') + '"></label>' +
      '<label class="ef-field" data-band><span>Lowest band</span><input type="number" name="band" min="0" max="9" step="0.5" inputmode="decimal" value="' + esc(p.band || '') + '"></label></div>' +
      '</fieldset>' +
      (IS_C ? '<fieldset><legend>5. Yearly tuition budget <span class="ef-opt">(optional)</span></legend><div class="ef-row">' +
        '<label class="ef-field"><span>Amount</span><input type="number" name="budget" min="0" step="500" inputmode="numeric" value="' + esc(p.budget || '') + '"></label>' +
        '<label class="ef-field"><span>Currency</span><select name="budgetCur">' + CURRENCIES.map(function (c) { return option(c, c, p.budgetCur || 'GBP'); }).join('') + '</select></label></div>' +
        '<p class="ef-help">Fees are compared only with courses priced in the same currency.</p></fieldset>'
        : '<fieldset><legend>5. That is it</legend><p class="ef-help">Most awards also ask for an offer from the university first. A counsellor can help with both.</p></fieldset>') +
      '<div class="ef-actions"><button type="submit" class="btn btn-primary"><span>Show my results</span>' + ICON.arrow + '</button></div>' +
      '</form>';
    var d = dialog('fd-elig', html);
    d.setAttribute('aria-labelledby', 'eligTitle');
    var f = d.querySelector('form');
    function sync() {
      var qual = f.qual.value, test = f.test.value;
      d.querySelector('[data-res="pk"]').hidden = !PK_QUAL[qual];
      d.querySelector('[data-cgpa]').hidden = qual === 'intermediate';
      d.querySelector('[data-res="alevels"]').hidden = qual !== 'alevels';
      d.querySelector('[data-res="uk"]').hidden = qual !== 'uk_degree';
      d.querySelector('[data-score]').hidden = !test || test === 'none';
      d.querySelector('[data-band]').hidden = test !== 'ielts';
      var sc = f.score;
      sc.max = { ielts: 9, pte: 90, toefl: 120, duolingo: 160 }[test] || 160;
      sc.step = test === 'ielts' ? 0.5 : 1;
    }
    f.addEventListener('change', sync); sync();
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var g = function (n) { var el = f.elements[n]; if (!el) return ''; if (el.length && el[0] && el[0].type === 'radio') { var c = f.querySelector('input[name="' + n + '"]:checked'); return c ? c.value : ''; } return String(el.value || '').trim(); };
      var next = Object.assign({}, profile || {}, {
        from: g('from'), level: g('level'), qual: g('qual'), pct: g('pct'), cgpa: g('cgpa'), alevels: g('alevels'), ukclass: g('ukclass'),
        test: g('test'), score: g('score'), band: g('band')
      });
      if (IS_C) { next.budget = g('budget'); next.budgetCur = g('budgetCur'); } else { next.field = g('field'); }
      if (next.qual === 'intermediate') next.cgpa = '';
      profile = next; save('sag-profile', profile);
      track('eligibility_check', { finder: KIND, level: profile.level || '', from: profile.from || '' });
      d.close();
      state.shown = PAGE;
      render(true);
      q('[data-elig]').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    });
  }

  // Shortlist ----------------------------------------------------------------------------------
  function toggleSave(slug) {
    var i = shortlist.indexOf(slug);
    if (i > -1) shortlist.splice(i, 1); else { shortlist.push(slug); track('shortlist_add', { finder: KIND, item: slug }); }
    save(SHORT_KEY, shortlist);
    q('[data-shortlist-count]').textContent = shortlist.length;
    main.querySelectorAll('[data-save="' + slug + '"]').forEach(function (b) {
      var on = shortlist.indexOf(slug) > -1;
      b.setAttribute('aria-pressed', on);
      b.setAttribute('aria-label', b.getAttribute('aria-label').replace(/^(Save|Remove)/, on ? 'Remove' : 'Save').replace(/ (to|from) your/, on ? ' from your' : ' to your'));
    });
  }
  function openShortlist() {
    var items = shortlist.map(function (s) { return data.items.find(function (x) { return x.slug === s; }); }).filter(Boolean);
    var html = closeBtn() + '<h2 class="fd-title" id="slTitle">Your shortlist</h2>' + (items.length
      ? '<ul class="sl">' + items.map(function (it) {
          var name = IS_C ? it.name : it.name;
          var sub = IS_C ? (byUni[it.uni] || {}).name : it.valueText;
          return '<li><a href="' + esc(it.page) + '">' + esc(name) + '</a><span>' + esc(sub || '') + '</span><button type="button" class="link-quiet" data-unsave="' + esc(it.slug) + '">Remove</button></li>';
        }).join('') + '</ul><div class="qv-actions"><button type="button" class="btn btn-primary" data-enquire-all><span>Enquire about my shortlist</span>' + ICON.arrow + '</button></div>'
      : '<p class="fd-lead">Nothing saved yet. Use the bookmark on any ' + (IS_C ? 'course' : 'scholarship') + ' to keep it here.</p>');
    var d = dialog('fd-short', html);
    d.setAttribute('aria-labelledby', 'slTitle');
    d.querySelectorAll('[data-unsave]').forEach(function (b) {
      b.addEventListener('click', function () { toggleSave(b.getAttribute('data-unsave')); b.closest('li').remove(); });
    });
    var all = d.querySelector('[data-enquire-all]');
    if (all) all.addEventListener('click', function () { d.close(); openEnquiry(shortlist.slice()); });
  }

  // Enquiry ------------------------------------------------------------------------------------
  function utm() {
    var p = new URLSearchParams(location.search), o = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'].forEach(function (k) { if (p.get(k)) o[k] = p.get(k).slice(0, 200); });
    try { var first = JSON.parse(sessionStorage.getItem('sag-utm') || 'null'); if (first) Object.keys(first).forEach(function (k) { if (!o[k]) o[k] = first[k]; }); } catch (e) {}
    return o;
  }
  function openEnquiry(slugs) {
    var items = slugs.map(function (s) { return data.items.find(function (x) { return x.slug === s; }); }).filter(Boolean);
    var p = profile || {};
    var about = items.map(function (it) { return IS_C ? it.name + ', ' + ((byUni[it.uni] || {}).name || '') : it.name; });
    var started = Date.now();
    var html = closeBtn() + '<h2 class="fd-title" id="enqTitle">' + (IS_C ? 'Request course counselling' : 'Ask about a scholarship') + '</h2>' +
      (about.length ? '<p class="fd-lead">About: ' + about.map(esc).join('; ') + '</p>' : '') +
      '<form class="ef" novalidate>' +
      '<div class="ef-row"><label class="ef-field"><span>Full name</span><input name="full_name" required maxlength="120" autocomplete="name"></label></div>' +
      '<div class="ef-row"><label class="ef-field"><span>WhatsApp number</span><input name="whatsapp" type="tel" maxlength="30" autocomplete="tel" placeholder="+92 300 1234567"></label>' +
      '<label class="ef-field"><span>Email</span><input name="email" type="email" maxlength="160" autocomplete="email"></label></div>' +
      '<p class="ef-help">Give at least one of WhatsApp or email.</p>' +
      '<div class="ef-row"><label class="ef-field"><span>Country of residence</span><select name="country_of_residence">' +
        option('', 'Choose', '') + option('Pakistan', 'Pakistan', p.from === 'PK' ? 'Pakistan' : '') + option('United Kingdom', 'United Kingdom', p.from === 'GB' ? 'United Kingdom' : '') + option('Other', 'Another country', p.from === 'OTHER' ? 'Other' : '') + '</select></label>' +
      '<label class="ef-field"><span>Intended intake</span><select name="intended_intake">' + option('', 'Choose', '') +
        ['January 2027', 'September 2027', 'January 2028', 'Later', 'Not sure yet'].map(function (x) { return option(x, x, ''); }).join('') + '</select></label></div>' +
      '<div class="ef-row"><label class="ef-field"><span>English language</span><select name="english_status">' + option('', 'Choose', '') +
        [['not_taken', 'Not taken yet'], ['booked', 'Test booked'], ['result', 'IELTS, PTE or Duolingo result available'], ['exempt', 'Exempt or studied in English']].map(function (x) {
          return option(x[0], x[1], p.test === 'none' ? 'not_taken' : (p.score ? 'result' : ''));
        }).join('') + '</select></label></div>' +
      '<label class="ef-field"><span>Message <span class="ef-opt">(optional)</span></span><textarea name="message" rows="3" maxlength="1500"></textarea></label>' +
      '<label class="ef-hp" aria-hidden="true">Leave this empty<input name="website" tabindex="-1" autocomplete="off"></label>' +
      '<label class="ef-check"><input type="checkbox" name="consent_privacy" required><span>I have read the <a href="/privacy-policy/" target="_blank">Privacy Policy</a> and agree that SA Global Education may contact me about my enquiry.</span></label>' +
      '<label class="ef-check"><input type="checkbox" name="consent_marketing"><span>Send me occasional updates about scholarships and intakes (optional).</span></label>' +
      (profile ? '<p class="ef-help">Your eligibility answers will be shared with your counsellor so they can advise you faster.</p>' : '') +
      '<p class="ef-error" data-error role="alert" hidden></p>' +
      '<div class="ef-actions"><button type="submit" class="btn btn-primary"><span>Send enquiry</span>' + ICON.arrow + '</button></div>' +
      '</form>';
    var d = dialog('fd-enq', html);
    d.setAttribute('aria-labelledby', 'enqTitle');
    track('enquire_open', { finder: KIND, items: slugs.length });
    var f = d.querySelector('form'), err = d.querySelector('[data-error]');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      err.hidden = true;
      var v = function (n) { return String(f.elements[n].value || '').trim(); };
      if (!v('full_name')) return fail('Please add your name.');
      if (!v('whatsapp') && !v('email')) return fail('Please add a WhatsApp number or an email address.');
      if (v('email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v('email'))) return fail('Please check your email address.');
      if (!f.elements.consent_privacy.checked) return fail('Please agree to the Privacy Policy so we can reply.');
      var body = {
        source_finder: IS_C ? 'course' : 'scholarship',
        full_name: v('full_name'), whatsapp: v('whatsapp') || null, email: v('email') || null,
        country_of_residence: v('country_of_residence') || null, intended_intake: v('intended_intake') || null,
        english_status: v('english_status') || null, message: v('message') || null,
        level_of_study: p.level || null,
        budget_range: p.budget && p.budgetCur ? p.budgetCur + ' ' + p.budget : null,
        course_ids: IS_C ? items.map(function (i) { return i.id; }) : [],
        scholarship_ids: IS_C ? [] : items.map(function (i) { return i.id; }),
        item_names: about,
        eligibility_profile: profile || null,
        source_page: location.pathname,
        utm: utm(),
        consent_privacy: true, consent_text_version: CONSENT_VERSION,
        consent_marketing: !!f.elements.consent_marketing.checked,
        website: v('website'), elapsed_ms: Date.now() - started
      };
      var btn = f.querySelector('button[type="submit"]');
      btn.disabled = true; btn.querySelector('span').textContent = 'Sending';
      fetch(LEAD_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: PUBLIC_KEY }, body: JSON.stringify(body) })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function () {
          track('generate_lead', { finder: KIND, items: slugs.length });
          try { if (typeof window.fbq === 'function') window.fbq('track', 'Lead'); } catch (e2) {}
          d.querySelector('.fd-inner').innerHTML = closeBtn() + '<h2 class="fd-title">Thank you.</h2><p class="fd-lead">Your enquiry has been received. A member of our team will contact you shortly.</p>' +
            '<div class="qv-actions"><button type="button" class="btn btn-ghost" data-close><span>Back to the ' + (IS_C ? 'course' : 'scholarship') + ' finder</span></button></div>';
          d.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', function () { d.close(); }); });
        })
        .catch(function () {
          btn.disabled = false; btn.querySelector('span').textContent = 'Send enquiry';
          var text = encodeURIComponent('Hello SA Global, I would like help with: ' + (about.join('; ') || (IS_C ? 'finding a course' : 'scholarships')));
          fail('We could not send your enquiry just now. Please try again, or contact us on WhatsApp at +92 332 4111224 or by email at info@saglobal.org.', 'mailto:info@saglobal.org?subject=' + encodeURIComponent('Enquiry from the ' + KIND + ' finder') + '&body=' + text);
        });
      function fail(msg, mail) { err.innerHTML = esc(msg) + (mail ? ' <a href="' + mail + '">Write an email</a>' : ''); err.hidden = false; return false; }
    });
  }

  // ------------------------------------------------------------------------------------------
  // Events

  function bind() {
    var form = q('[data-filters]');
    form.addEventListener('input', function (e) {
      if (e.target.name !== 'q') return;
      clearTimeout(typingTimer);
      typingTimer = setTimeout(function () {
        state.q = e.target.value.trim(); state.shown = PAGE; render(false);
        if (state.q.length > 2) track(IS_C ? 'course_search' : 'scholarship_search', { q: state.q.slice(0, 60) });
      }, 150);
    });
    form.addEventListener('change', function (e) {
      var n = e.target.name;
      if (!n || n === 'q') return;
      state[n] = e.target.value; state.shown = PAGE;
      if (n !== 'sort') track(IS_C ? 'course_filter' : 'scholarship_filter', { filter: n, value: e.target.value });
      render(true);
    });
    q('[data-likely]').addEventListener('change', function (e) {
      if (e.target.checked && !profile) { e.target.checked = false; openElig(); return; }
      state.likely = e.target.checked; state.shown = PAGE; render(true);
    });
    main.addEventListener('click', function (e) {
      var t = e.target.closest('button, a');
      if (!t || !main.contains(t)) return;
      if (t.hasAttribute('data-tab')) {
        state.dest = t.getAttribute('data-tab'); state.shown = PAGE;
        if (state.sort === 'fee' && !state.dest) state.sort = IS_C ? 'featured' : 'deadline';
        if (state.uni && byUni[state.uni] && state.dest && byUni[state.uni].dest !== state.dest) state.uni = '';
        render(true); return;
      }
      if (t.hasAttribute('data-chip')) {
        var k = t.getAttribute('data-chip'); state[k] = k === 'likely' ? false : ''; state.shown = PAGE; render(true); return;
      }
      if (t.hasAttribute('data-reset')) {
        KEYS.forEach(function (k) { if (k !== 'sort') state[k] = k === 'likely' ? false : ''; });
        state.shown = PAGE; render(true); return;
      }
      if (t.hasAttribute('data-more')) { state.shown += PAGE; render(false); return; }
      if (t.hasAttribute('data-save')) { toggleSave(t.getAttribute('data-save')); return; }
      if (t.hasAttribute('data-view')) { openView(t.getAttribute('data-view')); return; }
      if (t.hasAttribute('data-enquire')) { openEnquiry([t.getAttribute('data-enquire')]); return; }
      if (t.hasAttribute('data-elig-open')) { openElig(); return; }
      if (t.hasAttribute('data-elig-clear')) { profile = null; try { localStorage.removeItem('sag-profile'); } catch (e2) {} state.likely = false; render(true); return; }
      if (t.hasAttribute('data-shortlist-open')) { openShortlist(); return; }
    });
    // Tabs: arrow keys move between destinations.
    q('[data-tabs]').addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var tabs = [].slice.call(q('[data-tabs]').querySelectorAll('[role="tab"]'));
      var i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      e.preventDefault();
      var next = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
      next.focus(); next.click();
      var again = q('[data-tabs] [data-tab="' + next.getAttribute('data-tab') + '"]'); if (again) again.focus();
    });
    window.addEventListener('popstate', function () {
      KEYS.forEach(function (k) { state[k] = k === 'likely' ? false : (k === 'sort' ? (IS_C ? 'featured' : 'deadline') : ''); });
      readURL(); render(false);
    });
  }

  // ------------------------------------------------------------------------------------------
  // Start

  function unavailable(empty) {
    q('[data-count]').textContent = '';
    q('[data-elig]').hidden = true;
    q('[data-filters]').hidden = true;
    main.querySelector('.finder-meta').hidden = true;
    var box = q('[data-empty]');
    box.hidden = false;
    box.innerHTML = '<p class="finder-empty-h">' + (empty
      ? (IS_C ? 'Course listings are being added.' : 'Scholarship listings are being added.')
      : (IS_C ? 'The course list could not be loaded just now.' : 'The scholarship list could not be loaded just now.')) + '</p>' +
      '<p>' + (IS_C ? 'Send us your grades, budget and preferred subject, and a counsellor will reply with a shortlist of courses that suit you.'
                    : 'Tell us where and what you would like to study, and a counsellor will let you know which awards you are likely to qualify for.') + '</p>' +
      '<div class="btn-row"><a class="btn btn-primary" href="/contact/?topic=' + KIND + '"><span>' + (IS_C ? 'Request a course shortlist' : 'Ask about scholarships') + '</span>' + ICON.arrow + '</a></div>';
  }

  function init(d) {
    data = d;
    if (!data.items || !data.items.length) { unavailable(true); return; }
    data.universities.forEach(function (u) { byUni[u.slug] = u; });
    data.fields.forEach(function (f) { fieldLabel[f.slug] = f.label; });
    data.items.forEach(function (it) { it._h = haystack(it); });
    var p = readURL();
    if (state.dest && !data.destinations.some(function (x) { return x.code === state.dest; })) state.dest = '';
    q('[data-shortlist-count]').textContent = shortlist.filter(function (s) { return data.items.some(function (x) { return x.slug === s; }); }).length;
    renderCount();
    bind();
    render(false);
    var target = p.get(IS_C ? 'course' : 'award');
    if (target) {
      if (p.get('enquire') === '1') openEnquiry([target]);
      else if (p.get('check') === '1' && !profile) openElig();
      else openView(target);
    } else if (p.get('check') === '1') openElig();
  }

  // Remember where a visitor came from, for the enquiry (first touch in this visit).
  try {
    var first = new URLSearchParams(location.search), keep = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'].forEach(function (k) { if (first.get(k)) keep[k] = first.get(k).slice(0, 200); });
    if (Object.keys(keep).length && !sessionStorage.getItem('sag-utm')) sessionStorage.setItem('sag-utm', JSON.stringify(keep));
  } catch (e) {}

  fetch('/data/' + KIND + '.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(init)
    .catch(function () { unavailable(false); });
})();
