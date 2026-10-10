// Builds the course finder and scholarship finder from data.
//
//   node scripts/build-finders.mjs                      (Cloudflare Pages build: published rows from Supabase)
//   node scripts/build-finders.mjs --source research --site <copy-of-site>   (local preview from data/research)
//
// Writes, inside the site folder:
//   data/courses.json, data/scholarships.json      what the two finder pages load
//   courses/<slug>/index.html                      one indexable page per published course
//   scholarships/<slug>/index.html                 one indexable page per published scholarship
//   sitemap.xml                                    the base sitemap plus every generated page
//
// The research source exists only for local previews. It refuses to write into the repo's own
// site folder, so unreviewed data can never be deployed.

import { readFile, writeFile, mkdir, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
  return acc;
}, []));
const SOURCE = args.source || 'supabase';
const SITE = path.resolve(args.site || path.join(repo, 'site'));
const ORIGIN = 'https://saglobal.org';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kdndxzqxzgnusgvgcqsv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_9xEt1H5eRtN4GSZGkxY5sQ_YHa7Nkm4';
const TODAY = new Date().toISOString().slice(0, 10);

if (SOURCE === 'research' && SITE === path.join(repo, 'site')) {
  console.error('Refusing to build research (unreviewed) data into the deployable site folder. Pass --site <copy>.');
  process.exit(1);
}

// ---------------------------------------------------------------------------------------------
// Loading

async function rest(table, query) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
      headers: { apikey: SUPABASE_KEY, Range: `${from}-${from + 999}` }
    });
    if (!res.ok) throw new Error(`${table}: HTTP ${res.status} ${await res.text()}`);
    const page = await res.json();
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

async function loadSupabase() {
  // Row-level security already limits the public key to published rows; the filters repeat it.
  const [fields, destinations, universities, courses, scholarships, equivalences] = await Promise.all([
    rest('fields', 'select=*&order=sort_order'),
    rest('destinations', 'select=*&order=sort_order'),
    rest('universities', 'select=*&is_published=eq.true&order=name'),
    rest('courses', 'select=*&is_published=eq.true&order=title'),
    rest('scholarships', 'select=*&is_published=eq.true&order=name'),
    rest('grade_equivalences', 'select=*&is_published=eq.true')
  ]);
  return { fields, destinations, universities, courses, scholarships, equivalences };
}

async function loadResearch() {
  // Local preview only: builds from data/research files, applying the verifier's corrections and
  // leaving out anything the verifier failed.
  const dir = path.join(repo, 'data', 'research');
  const seed = await readFile(path.join(repo, 'supabase', 'migrations', '20261009000003_seed.sql'), 'utf8');
  const fields = [...seed.matchAll(/\('([a-z-]+)', '([^']+)', (\d+)\)/g)].map(m => ({ slug: m[1], label: m[2], sort_order: +m[3] }));
  const destinations = [...seed.matchAll(/\('(GB|US|NZ|AU|CA|DE)', '([^']+)', '([^']+)', '([A-Z]{3})'/g)]
    .map((m, i) => ({ code: m[1], name: m[2], tab_label: m[3], currency: m[4], sort_order: i + 1 }));
  try {
    const d = JSON.parse(await readFile(path.join(dir, '_destinations.json'), 'utf8'));
    for (const r of d.destinations || []) Object.assign(destinations.find(x => x.code === r.code) || {}, r);
  } catch {}
  const universities = [], courses = [], scholarships = [];
  let excluded = {};
  try { excluded = JSON.parse(await readFile(path.join(dir, '_exclusions.json'), 'utf8')).scholarships || {}; } catch {}
  for (const f of (await readdir(dir)).filter(f => f.endsWith('.json') && !f.endsWith('.verify.json') && !f.startsWith('_exclusions')).sort()) {
    const data = JSON.parse(await readFile(path.join(dir, f), 'utf8'));
    let verify = null;
    const vf = path.join(dir, f.replace(/\.json$/, '.verify.json'));
    if (existsSync(vf)) verify = JSON.parse(await readFile(vf, 'utf8'));
    const verdict = (list, slug) => (list || []).find(x => x.slug === slug) || null;
    const apply = (row, v) => { if (v && v.corrections) for (const [k, val] of Object.entries(v.corrections)) if (k in row && typeof val !== 'object') row[k] = val; return row; };
    if (data.university) universities.push({ ...data.university, id: data.university.slug, is_published: true });
    for (const c of data.courses || []) {
      const v = verdict(verify && verify.courses, c.slug);
      if (v && v.verdict === 'fail') continue;
      if (c.confidence === 'low') continue;
      courses.push(apply({ ...c, id: c.slug, university_slug: data.university.slug }, v));
    }
    for (const s of data.scholarships || []) {
      const v = verdict(verify && verify.scholarships, s.slug);
      if (v && v.verdict === 'fail') continue;
      if (s.confidence === 'low' || excluded[s.slug]) continue;
      scholarships.push(apply({ ...s, id: s.slug, university_slug: data.university ? data.university.slug : null }, v));
    }
  }
  return { fields, destinations, universities, courses, scholarships, equivalences: [] };
}

// ---------------------------------------------------------------------------------------------
// Shaping for the browser

function shape(db) {
  const uniById = new Map(db.universities.map(u => [u.id, u]));
  const uniSlug = row => row.university_slug || (uniById.get(row.university_id) || {}).slug || null;
  const dests = db.destinations.map(d => ({
    code: d.code, name: d.name, tab: d.tab_label, currency: d.currency,
    psw: d.post_study_work_summary || null, pswUrl: d.post_study_work_source_url || null, pswDate: d.post_study_work_verified_on || null
  }));
  const universities = db.universities.map(u => ({
    slug: u.slug, name: u.name, city: u.city || null, dest: u.destination_code, web: u.website_url || null,
    russell: u.is_russell_group === true && !!u.russell_group_source_url
  }));
  const awards = db.scholarships
    .filter(s => !s.deadline_on || s.deadline_on >= TODAY)
    .map(s => ({
      id: s.id, slug: s.slug, name: s.name, type: s.provider_type, provider: s.provider_name, uni: uniSlug(s),
      dests: s.destination_codes || [], levels: s.levels || [], fields: s.field_slugs || [], countries: s.eligible_countries || [],
      valueType: s.value_type, amount: num(s.value_amount), pct: num(s.value_percent), cur: s.value_currency || null,
      basis: s.value_basis || null, valueText: s.value_text, summary: s.summary || null, criteria: s.criteria_text || null,
      minPct: num(s.min_pk_percent), minCgpa: num(s.min_pk_cgpa), minIelts: num(s.min_ielts_overall), minUkD: s.min_uk_degree_class || null,
      need: s.need_based, route: s.application_route || null, cond: extraConditions(s), gradeTerms: gradeTerms(s), offer: s.requires_offer, opens: s.opens_on || null,
      deadline: s.deadline_on || null, deadlineNote: s.deadline_note || null, intake: s.intake_label || null,
      url: s.official_url, verified: s.verified_on, page: `/scholarships/${s.slug}/`
    }));
  const awardsFor = (c, dest) => awards.filter(a =>
    (a.levels.includes(c.level) || (c.level === 'pg_diploma' && a.levels.includes('postgraduate'))) &&
    (a.uni ? a.uni === c.uni : a.dests.includes(dest)) &&
    (!a.fields.length || a.fields.includes(c.field))).map(a => a.slug);
  const courses = db.courses.map(c => {
    const u = universities.find(x => x.slug === uniSlug(c)) || {};
    const item = {
      id: c.id, slug: c.slug, title: c.title, award: c.award || null, name: courseName(c), level: c.level, field: c.field_slug,
      uni: u.slug || null, dest: u.dest || null, mode: c.mode, dur: c.duration_text || null, months: c.duration_months || null,
      fee: num(c.tuition_amount), cur: c.tuition_currency || null, basis: c.tuition_basis || null, feeYear: c.tuition_academic_year || null,
      feeUrl: c.fees_source_url || null, hi: (c.highlights || []).filter(h => !CLAIM.test(h)).slice(0, 4), overview: c.overview || null,
      acad: c.academic_requirements || null, eng: c.english_requirements || null, exp: c.experience_requirements || null,
      pkNote: c.pakistan_entry_note || null, pkUrl: c.pakistan_source_url || null, career: c.career_notes || null,
      url: c.official_url, intakes: c.intake_labels || [], deadline: c.application_deadline_note || null,
      featured: !!c.featured, verified: c.verified_on, page: `/courses/${c.slug}/`,
      req: {
        ielts: num(c.min_ielts_overall), band: num(c.min_ielts_band), pte: num(c.min_pte), toefl: num(c.min_toefl),
        duo: num(c.min_duolingo), pkRoute: c.pk_route || null, pkPct: num(c.pk_min_percent), pkCgpa: num(c.pk_min_cgpa),
        ukA: c.uk_min_alevels || null, ukD: c.uk_min_degree_class || null
      }
    };
    item.sch = awardsFor(item, item.dest);
    return item;
  });
  const fields = db.fields.map(f => ({ slug: f.slug, label: f.label }));
  const equivalences = db.equivalences.map(e => ({ ukD: e.uk_equivalent, pct: num(e.pk_min_percent), cgpa: num(e.pk_min_cgpa), q: e.qualification }));
  const usedUnis = new Set([...courses.map(c => c.uni), ...awards.map(a => a.uni)]);
  return {
    courses: { generated: TODAY, destinations: dests, fields, universities: universities.filter(u => usedUnis.has(u.slug)), equivalences,
               awards: awards.map(a => ({ slug: a.slug, name: a.name, valueText: a.valueText, deadline: a.deadline, page: a.page, uni: a.uni })),
               items: courses },
    scholarships: { generated: TODAY, destinations: dests, fields, universities: universities.filter(u => usedUnis.has(u.slug)), equivalences,
                    items: awards }
  };
}
// Highlights are module or topic names; anything that reads as a claim is left out.
const CLAIM = /\d\s?%|\b(top|best|leading|world[- ]class|ranked|ranking|award[- ]winning|number one|no\. ?1|first in)\b/i;
function num(v) { return v === null || v === undefined || v === '' ? null : Number(v); }

// "MSc" + "Management MSc" reads as "MSc Management MSc": only prefix the award when the title
// does not already carry it.
function courseName(c) {
  const t = String(c.title || '').trim(), a = String(c.award || '').trim();
  if (!a) return t;
  if (a.toLowerCase().includes(t.toLowerCase())) return t;                 // award repeats the title
  const core = a.split(/[\s(]/)[0];                                        // "BSc (Hons)" -> "BSc"
  const has = w => new RegExp('(^|[\\s(])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[\\s),])', 'i').test(t);
  return has(a) || has(core) ? t : `${a} ${t}`;
}
// Conditions the finder cannot check from a student's answers.
function extraConditions(s) {
  if (typeof s.has_extra_conditions === 'boolean') return s.has_extra_conditions;
  if (s.need_based === true || s.application_route === 'nomination') return true;
  const text = `${s.name} ${s.criteria_text || ''}`;
  return /\b(alumn\w*|family|loyalty|sibling|relative|sport\w*|athlet\w*|progression|progress from|staff|refugee|care leaver|disab\w*|financial need)\b/i.test(text);
}
// The award's own terms set a grade bar that is not in the structured fields.
function gradeTerms(s) {
  if (s.min_pk_cgpa != null || s.min_pk_percent != null || s.min_uk_degree_class) return false;
  return /(A\*|\bAAA|\bAAB|\bABB|\bfirst[- ]class|\b2:1\b|upper second|\bGPA\b|\bCGPA\b|\d\s?%|percent|high(est)? academic|academic (excellence|merit|achievement)|outstanding)/i.test(`${s.criteria_text || ''} ${s.summary || ''}`);
}

// ---------------------------------------------------------------------------------------------
// Static pages

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const LEVEL = { foundation_pathway: 'Foundation & Pathway', undergraduate: 'Undergraduate', postgraduate: 'Postgraduate',
                pg_diploma: 'Postgraduate Diploma', doctoral: 'Doctoral / PhD' };
const MODE = { full_time: 'Full time', part_time: 'Part time', online: 'Online', blended: 'Blended' };
const ARROW = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M13.2 4.6 11.8 6l5 5H3v2h13.8l-5 5 1.4 1.4L21 12l-7.8-7.4Z"/></svg>';
const money = (amt, cur) => amt == null ? null : `${cur} ${Number(amt).toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;
const longDate = d => d ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '';

function template(html, { title, description, canonical, main, jsonld, crumbs, robots }) {
  let out = html
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*/, `$1${esc(description)}`)
    .replace(/(<meta property="og:title" content=")[^"]*/, `$1${esc(title)}`)
    .replace(/(<meta property="og:description" content=")[^"]*/, `$1${esc(description)}`)
    .replace(/(<meta name="twitter:title" content=")[^"]*/, `$1${esc(title)}`)
    .replace(/(<meta name="twitter:description" content=")[^"]*/, `$1${esc(description)}`)
    .replace(/(<link rel="canonical" href=")[^"]*/, `$1${canonical}`)
    .replace(/(<meta property="og:url" content=")[^"]*/, `$1${canonical}`)
    .replace(/<meta name="robots"[^>]*>\n?/, robots ? `<meta name="robots" content="${robots}">\n` : '')
    .replace(/<main id="main"[\s\S]*<\/main>/, main);
  out = out.replace(/<script type="application\/ld\+json" data-page-ld>[\s\S]*?<\/script>/, '');
  out = out.replace('</head>', `<script type="application/ld+json" data-page-ld>${JSON.stringify(jsonld)}</script>\n</head>`);
  return out;
}
const crumbLd = list => ({ '@type': 'BreadcrumbList', itemListElement: list.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c[0], item: ORIGIN + c[1] })) });
const crumbHtml = list => `<div class="wrap"><nav class="crumbs" aria-label="Breadcrumb">${list.map((c, i) => i < list.length - 1
  ? `<a href="${c[1]}">${esc(c[0])}</a><span aria-hidden="true">/</span>` : `<span aria-current="page">${esc(c[0])}</span>`).join('')}</nav></div>`;

function factRows(rows) {
  return `<dl class="facts">${rows.filter(r => r[1]).map(r => `<div><dt>${esc(r[0])}</dt><dd>${r[1]}</dd></div>`).join('')}</dl>`;
}

function coursePage(c, data, shell) {
  const u = data.universities.find(x => x.slug === c.uni) || {};
  const d = data.destinations.find(x => x.code === c.dest) || {};
  const field = (data.fields.find(f => f.slug === c.field) || {}).label;
  const name = c.name;
  const fee = c.fee != null ? `${money(c.fee, c.cur)} ${c.basis === 'total' ? 'for the whole course' : 'a year'}<span class="facts-sub">Estimated international tuition, ${esc(c.feeYear || '')}${c.feeUrl ? `, <a href="${esc(c.feeUrl)}" rel="noopener" target="_blank">source</a>` : ''}</span>` : null;
  const awards = c.sch.map(s => data.awards.find(a => a.slug === s)).filter(Boolean);
  const crumbs = [['Home', '/'], ['Course finder', '/courses/'], [name, c.page]];
  const req = [
    ['Academic', esc(c.acad)], ['English language', esc(c.eng)], ['Experience or portfolio', esc(c.exp)],
    ['Applicants from Pakistan', c.pkNote ? `${esc(c.pkNote)}${c.pkUrl ? ` <a href="${esc(c.pkUrl)}" rel="noopener" target="_blank">Source</a>` : ''}` : null]
  ];
  const main = `<main id="main" class="detail">
${crumbHtml(crumbs)}
<section class="detail-hero">
 <div class="wrap">
  <p class="detail-tags"><span class="tag tag-dest">${esc(d.tab || '')}</span><span class="tag">${esc(LEVEL[c.level] || '')}</span>${field ? `<span class="tag tag-quiet">${esc(field)}</span>` : ''}</p>
  <h1>${esc(name)}</h1>
  <p class="detail-uni">${esc(u.name || '')}${u.city ? `, ${esc(u.city)}` : ''}</p>
  <div class="btn-row">
   <a class="btn btn-primary" href="/courses/?course=${esc(c.slug)}&amp;check=1"><span>Check if you are likely eligible</span>${ARROW}</a>
   <a class="btn btn-ghost" href="/courses/?course=${esc(c.slug)}&amp;enquire=1"><span>Ask about this course</span>${ARROW}</a>
  </div>
 </div>
</section>
<section class="band detail-body">
 <div class="wrap detail-grid">
  <div class="detail-main">
   ${c.overview ? `<h2>Overview</h2><p>${esc(c.overview)}</p>` : ''}
   ${c.hi.length ? `<h3>Highlights</h3><ul class="ticks">${c.hi.map(h => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}
   <h2>Entry requirements</h2>
   ${factRows(req)}
   ${c.career ? `<h2>Careers</h2><p>${esc(c.career)}</p>` : ''}
   ${d.psw ? `<h2>Working after you graduate</h2><p>${esc(d.psw)}</p><p class="muted small">Checked on ${longDate(d.pswDate)}${d.pswUrl ? `. <a href="${esc(d.pswUrl)}" rel="noopener" target="_blank">Official source</a>` : ''}.</p>` : ''}
   ${awards.length ? `<h2>Scholarships for this course</h2><ul class="detail-awards">${awards.map(a => `<li><a href="${a.page}">${esc(a.name)}</a><span>${esc(a.valueText || '')}</span></li>`).join('')}</ul>` : ''}
  </div>
  <aside class="detail-side">
   ${factRows([['Level', esc(LEVEL[c.level])], ['Duration', esc(c.dur)], ['Study mode', esc(MODE[c.mode])], ['Tuition', fee],
              ['Intakes', esc((c.intakes || []).join(', '))], ['Application deadline', esc(c.deadline)]])}
   <a class="link-arrow" href="${esc(c.url)}" rel="noopener" target="_blank">Official course page ${ARROW}</a>
   <p class="muted small">Fees and requirements are published by the university and can change. Checked on ${longDate(c.verified)}. Please confirm with an adviser before applying.</p>
  </aside>
 </div>
</section>
</main>`;
  const description = `${name} at ${u.name || 'a partner university'}${u.city ? `, ${u.city}` : ''}: entry requirements, tuition and intakes for international students, with help from SA Global Education.`;
  const jsonld = { '@context': 'https://schema.org', '@graph': [crumbLd(crumbs), {
    '@type': 'Course', name, description: c.overview || description, url: ORIGIN + c.page,
    provider: { '@type': 'CollegeOrUniversity', name: u.name, sameAs: u.web || undefined }
  }] };
  return template(shell, { title: `${name}, ${u.name || ''} | SA Global Education`, description, canonical: ORIGIN + c.page, main, jsonld, robots: null });
}

function awardPage(a, data, shell) {
  const u = data.universities.find(x => x.slug === a.uni) || null;
  const destNames = a.dests.map(code => (data.destinations.find(d => d.code === code) || {}).tab).filter(Boolean);
  const crumbs = [['Home', '/'], ['Scholarship finder', '/scholarships/'], [a.name, a.page]];
  const ROUTE = { automatic: 'Automatic, no separate application', separate_application: 'Separate application', nomination: 'By nomination' };
  const who = a.countries.map(c => c === 'INTL' ? 'International applicants' : c === 'PK' ? 'Applicants from Pakistan' : c === 'GB' ? 'UK applicants' : c).join(', ');
  const linkQs = new URLSearchParams();
  if (a.uni) linkQs.set('uni', a.uni); else if (a.dests.length === 1) linkQs.set('destination', a.dests[0]);
  if (a.levels.length === 1) linkQs.set('level', a.levels[0]);
  const main = `<main id="main" class="detail">
${crumbHtml(crumbs)}
<section class="detail-hero">
 <div class="wrap">
  <p class="detail-tags">${destNames.map(n => `<span class="tag tag-dest">${esc(n)}</span>`).join('')}${a.levels.map(l => `<span class="tag">${esc(LEVEL[l] || l)}</span>`).join('')}</p>
  <h1>${esc(a.name)}</h1>
  <p class="detail-uni">${esc(a.provider)}</p>
  <p class="detail-value">${esc(a.valueText)}</p>
  <div class="btn-row">
   <a class="btn btn-primary" href="/scholarships/?award=${esc(a.slug)}&amp;check=1"><span>Check if you are likely eligible</span>${ARROW}</a>
   <a class="btn btn-ghost" href="/courses/?${linkQs.toString().replace(/&/g, '&amp;')}"><span>Courses you could use this for</span>${ARROW}</a>
  </div>
 </div>
</section>
<section class="band detail-body">
 <div class="wrap detail-grid">
  <div class="detail-main">
   ${a.summary ? `<h2>About this award</h2><p>${esc(a.summary)}</p>` : ''}
   ${a.criteria ? `<h2>Who can apply</h2><p>${esc(a.criteria)}</p>` : ''}
   ${u ? `<p><a class="link-arrow" href="/courses/?uni=${esc(u.slug)}">Courses at ${esc(u.name)} ${ARROW}</a></p>` : ''}
  </div>
  <aside class="detail-side">
   ${factRows([['Value', esc(a.valueText)], ['Open to', esc(who)], ['How to apply', esc(ROUTE[a.route] || '')],
              ['Needs an offer first', a.offer === true ? 'Yes' : a.offer === false ? 'No' : null],
              ['Deadline', a.deadline ? esc(longDate(a.deadline)) : esc(a.deadlineNote)], ['Intake', esc(a.intake)]])}
   <a class="link-arrow" href="${esc(a.url)}" rel="noopener" target="_blank">Official scholarship page ${ARROW}</a>
   <p class="muted small">Award terms are set by the provider and can change. Checked on ${longDate(a.verified)}. Please confirm with an adviser before applying.</p>
  </aside>
 </div>
</section>
</main>`;
  const description = `${a.name}: ${a.valueText}. Who can apply, deadlines and how SA Global Education can help.`;
  const jsonld = { '@context': 'https://schema.org', '@graph': [crumbLd(crumbs)] };
  return template(shell, { title: `${a.name} | SA Global Education`, description, canonical: ORIGIN + a.page, main, jsonld, robots: null });
}

// ---------------------------------------------------------------------------------------------

async function writeGenerated(dir, slugs, render) {
  // Remove pages generated by an earlier build that are no longer published.
  const manifest = path.join(SITE, 'data', `.${dir}-pages.json`);
  let old = [];
  try { old = JSON.parse(await readFile(manifest, 'utf8')); } catch {}
  for (const s of old) if (!slugs.includes(s) && /^[a-z0-9-]+$/.test(s)) await rm(path.join(SITE, dir, s), { recursive: true, force: true });
  for (const s of slugs) {
    await mkdir(path.join(SITE, dir, s), { recursive: true });
    await writeFile(path.join(SITE, dir, s, 'index.html'), render(s));
  }
  await writeFile(manifest, JSON.stringify(slugs));
}

async function main() {
  const db = SOURCE === 'research' ? await loadResearch() : await loadSupabase();
  const out = shape(db);
  await mkdir(path.join(SITE, 'data'), { recursive: true });
  await writeFile(path.join(SITE, 'data', 'courses.json'), JSON.stringify(out.courses));
  await writeFile(path.join(SITE, 'data', 'scholarships.json'), JSON.stringify(out.scholarships));

  const courseShell = await readFile(path.join(SITE, 'courses', 'index.html'), 'utf8');
  const awardShell = await readFile(path.join(SITE, 'scholarships', 'index.html'), 'utf8');
  await writeGenerated('courses', out.courses.items.map(c => c.slug),
    s => coursePage(out.courses.items.find(c => c.slug === s), { ...out.courses }, courseShell));
  await writeGenerated('scholarships', out.scholarships.items.map(a => a.slug),
    s => awardPage(out.scholarships.items.find(a => a.slug === s), out.scholarships, awardShell));

  // Finder pages are indexable once they have something to show.
  for (const [dir, n] of [['courses', out.courses.items.length], ['scholarships', out.scholarships.items.length]]) {
    const p = path.join(SITE, dir, 'index.html');
    let html = await readFile(p, 'utf8');
    html = html.replace(/<meta name="robots"[^>]*>\n?/, n ? '' : '<meta name="robots" content="noindex, follow">\n');
    if (!n && !/name="robots"/.test(html)) html = html.replace('</head>', '<meta name="robots" content="noindex, follow">\n</head>');
    await writeFile(p, html);
  }

  // Sitemap: the base entries plus every generated page.
  const smPath = path.join(SITE, 'sitemap.xml');
  let sm = await readFile(smPath, 'utf8');
  sm = sm.replace(/\s*<url><loc>[^<]*\/(courses|scholarships)\/[a-z0-9-]+\/<\/loc>[\s\S]*?<\/url>/g, '');
  const extra = [...out.courses.items.map(c => [c.page, c.verified]), ...out.scholarships.items.map(a => [a.page, a.verified])]
    .map(([p, d]) => `  <url><loc>${ORIGIN}${p}</loc><lastmod>${d || TODAY}</lastmod></url>`).join('\n');
  for (const [p, n] of [['/courses/', out.courses.items.length], ['/scholarships/', out.scholarships.items.length]]) {
    sm = sm.replace(new RegExp(`\\s*<url><loc>${ORIGIN}${p}</loc>[\\s\\S]*?</url>`), '');
    if (n) sm = sm.replace('</urlset>', `  <url><loc>${ORIGIN}${p}</loc><lastmod>${TODAY}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>\n</urlset>`);
  }
  if (extra) sm = sm.replace('</urlset>', `${extra}\n</urlset>`);
  await writeFile(smPath, sm);

  console.log(`Built from ${SOURCE}: ${out.courses.items.length} courses, ${out.scholarships.items.length} open scholarships, ` +
              `${out.courses.universities.length} universities.`);
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
