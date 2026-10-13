// Loads verified research files (data/research/*.json) into Supabase as unpublished drafts.
//
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/import-drafts.mjs [slug-or-file ...]
//
// Runs from GitHub Actions ("Import research drafts"), never in the browser.
// - Every course and scholarship goes in with is_published = false.
// - A row a reviewer has already published is never overwritten; it is listed as skipped instead.
// - The verifier's corrections are applied only where they are clean values for the column;
//   everything else, with the verifier's verdict and issues, goes into review_notes.
// - Awards in data/research/_exclusions.json are skipped; its overrides are recorded.
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(repo, 'data', 'research');
const URL_ = process.env.SUPABASE_URL || 'https://kdndxzqxzgnusgvgcqsv.supabase.co';
const DRY = process.env.DRY === '1';
// Preferred: OPS_TOKEN, the GitHub Actions OpenID Connect token, sent to the "ops" Edge Function
// (no secret in GitHub). Fallback: a service role key, for running by hand.
const OPS_TOKEN = process.env.OPS_TOKEN || '';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || (DRY || OPS_TOKEN ? 'unused' : '');
if (!KEY) { console.error('Set OPS_TOKEN (GitHub Actions) or SUPABASE_SERVICE_ROLE_KEY.'); process.exit(1); }
const headers = { apikey: KEY, 'Content-Type': 'application/json', ...(KEY.startsWith('eyJ') ? { Authorization: `Bearer ${KEY}` } : {}) };

const COURSE = ['slug', 'title', 'award', 'level', 'field_slug', 'mode', 'duration_text', 'duration_months', 'tuition_amount',
  'tuition_currency', 'tuition_basis', 'tuition_academic_year', 'fees_source_url', 'overview', 'highlights', 'academic_requirements',
  'english_requirements', 'experience_requirements', 'pakistan_entry_note', 'pakistan_source_url', 'career_notes', 'min_ielts_overall',
  'min_ielts_band', 'min_pte', 'min_toefl', 'min_duolingo', 'pk_route', 'pk_min_percent', 'pk_min_cgpa', 'uk_min_alevels',
  'uk_min_degree_class', 'official_url', 'intake_labels', 'application_deadline_note', 'featured', 'source_url', 'verified_on', 'confidence'];
const AWARD = ['slug', 'name', 'provider_type', 'provider_name', 'destination_codes', 'levels', 'field_slugs', 'eligible_countries',
  'value_type', 'value_amount', 'value_percent', 'value_currency', 'value_basis', 'value_text', 'summary', 'criteria_text',
  'min_pk_percent', 'min_pk_cgpa', 'min_ielts_overall', 'min_uk_degree_class', 'need_based', 'has_extra_conditions',
  'application_route', 'requires_offer', 'opens_on', 'deadline_on', 'deadline_note', 'intake_label', 'official_url', 'source_url',
  'verified_on', 'confidence', 'featured'];
const UNI = ['name', 'city', 'region', 'website_url', 'international_admissions_url', 'scholarships_url', 'summary', 'is_russell_group',
  'russell_group_source_url', 'eligibility_note', 'eligibility_source_url', 'source_url', 'verified_on'];
const NUMS = new Set(['duration_months', 'tuition_amount', 'min_ielts_overall', 'min_ielts_band', 'min_pte', 'min_toefl', 'min_duolingo',
  'pk_min_percent', 'pk_min_cgpa', 'value_amount', 'value_percent', 'min_pk_percent', 'min_pk_cgpa']);
const BOOLS = new Set(['featured', 'need_based', 'requires_offer', 'is_russell_group', 'has_extra_conditions']);
const DATES = new Set(['verified_on', 'opens_on', 'deadline_on']);
const ARRAYS = new Set(['highlights', 'intake_labels', 'destination_codes', 'levels', 'field_slugs', 'eligible_countries']);
const PROSE = new Set(['title', 'name', 'overview', 'summary', 'criteria_text', 'value_text', 'academic_requirements', 'english_requirements',
  'experience_requirements', 'pakistan_entry_note', 'career_notes', 'deadline_note', 'application_deadline_note', 'duration_text',
  'eligibility_note', 'intake_label']);
const CODES = new Set(['level', 'field_slug', 'mode', 'tuition_basis', 'tuition_currency', 'pk_route', 'uk_min_degree_class', 'value_type',
  'value_currency', 'value_basis', 'application_route', 'provider_type', 'confidence', 'min_uk_degree_class']);
const URLS = new Set(['official_url', 'source_url', 'fees_source_url', 'pakistan_source_url', 'website_url', 'international_admissions_url',
  'scholarships_url', 'russell_group_source_url', 'eligibility_source_url']);
const DASH = /[–—]/g;
const DRYROWS = [];

function cleanCorrection(col, v) {
  if (NUMS.has(col)) return typeof v === 'number';
  if (BOOLS.has(col)) return typeof v === 'boolean';
  if (DATES.has(col)) return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  if (col === 'tuition_academic_year') return typeof v === 'string' && /^\d{4}\/\d{2}$/.test(v);
  if (CODES.has(col)) return typeof v === 'string' && /^([a-z0-9_:-]{1,40}|[A-Z]{3})$/.test(v);
  if (URLS.has(col)) return typeof v === 'string' && v.startsWith('https://');
  if (ARRAYS.has(col)) return Array.isArray(v) && v.every(x => typeof x === 'string');
  if (PROSE.has(col)) return typeof v === 'string' && v.length > 0 && v.length <= 600;
  return false;
}
function tidy(v) {
  if (typeof v === 'string') return v.replace(DASH, ',');
  if (Array.isArray(v)) return v.map(tidy);
  return v;
}
function applyCorrections(row, v) {
  const out = { ...row };
  for (const [k, c] of Object.entries((v && v.corrections) || {})) if (cleanCorrection(k, c)) out[k] = c;
  return out;
}
function notes(row, v, override) {
  const parts = [];
  if (v) {
    parts.push(`Verifier: ${String(v.verdict || 'unknown').toUpperCase()}.`);
    for (const i of v.issues || []) parts.push(String(i));
    const byHand = Object.fromEntries(Object.entries(v.corrections || {}).filter(([k, c]) => !cleanCorrection(k, c)));
    if (Object.keys(byHand).length) parts.push('Corrections to apply by hand: ' + JSON.stringify(byHand));
  } else parts.push('Verifier: NOT CHECKED.');
  if (override) parts.push('Override: ' + override);
  if (row.notes) parts.push('Researcher note: ' + row.notes);
  return parts.join(' | ').slice(0, 4000);
}
function pick(row, cols) {
  // Every row carries every column (null when absent): the API rejects batches whose rows differ.
  const o = {};
  for (const c of cols) o[c] = row[c] === undefined ? (ARRAYS.has(c) ? [] : null) : tidy(row[c]);
  if ('featured' in o && o.featured === null) o.featured = false;
  return o;
}

async function api(method, pathQs, body, prefer) {
  if (OPS_TOKEN && !DRY) return viaOps(method, pathQs, body);
  if (DRY) {                         // offline check of the mapping: pretend every row exists unpublished
    if (method === 'PATCH' && pathQs.startsWith('universities')) return [{ id: '00000000-0000-4000-8000-000000000000' }];
    if (method === 'GET') return [];
    if (method === 'POST') { const keys = JSON.stringify(Object.keys(body[0]).sort()); for (const r of body) { if (JSON.stringify(Object.keys(r).sort()) !== keys) throw new Error('rows differ in ' + pathQs); } DRYROWS.push(...body); }
    return null;
  }
  const res = await fetch(`${URL_}/rest/v1/${pathQs}`, {
    method, headers: { ...headers, ...(prefer ? { Prefer: prefer } : {}) }, body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(`${method} ${pathQs}: HTTP ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

async function ops(payload) {
  const res = await fetch(`${URL_}/functions/v1/ops`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPS_TOKEN}` }, body: JSON.stringify(payload)
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`ops ${payload.op}: HTTP ${res.status} ${JSON.stringify(out)}`);
  return out;
}
// Translates the importer's four kinds of database call into the ops function's operations.
async function viaOps(method, pathQs, body) {
  let m;
  if (method === 'PATCH' && (m = pathQs.match(/^universities\?slug=eq\.(.+)$/))) {
    const r = await ops({ op: 'patch_university', slug: decodeURIComponent(m[1]), values: body });
    return r.id ? [{ id: r.id }] : [];
  }
  if (method === 'PATCH' && (m = pathQs.match(/^destinations\?code=eq\.([A-Z]{2})$/))) return ops({ op: 'patch_destination', code: m[1], values: body });
  if (method === 'GET' && (m = pathQs.match(/^(courses|scholarships)\?select=slug,is_published&slug=in\.\((.*)\)$/))) {
    const slugs = m[2].split(',').map(x => x.replace(/^"|"$/g, ''));
    const r = await ops({ op: 'published', table: m[1], slugs });
    return r.published.map(slug => ({ slug, is_published: true }));
  }
  if (method === 'POST' && (m = pathQs.match(/^(courses|scholarships)\?on_conflict=slug$/))) {
    for (let i = 0; i < body.length; i += 100) await ops({ op: 'upsert_drafts', table: m[1], rows: body.slice(i, i + 100) });
    return null;
  }
  throw new Error('No ops route for ' + method + ' ' + pathQs);
}

async function importFile(file, excl) {
  const data = JSON.parse(await readFile(file, 'utf8'));
  const vf = file.replace(/\.json$/, '.verify.json');
  const ver = existsSync(vf) ? JSON.parse(await readFile(vf, 'utf8')) : {};
  const find = (list, slug) => (ver[list] || []).find(x => x.slug === slug) || null;
  const report = { file: path.basename(file), courses: 0, scholarships: 0, skipped: [] };

  let uniId = null;
  if (data.university && OPS_TOKEN && !DRY) {
    // New institutions are created first (unpublished), using the target list for logo and tier.
    const t = TARGETS[data.university.slug] || {};
    await ops({ op: 'ensure_university', row: {
      slug: data.university.slug, name: t.name || data.university.name, presentation_name: t.presentation_name || data.university.name,
      destination_code: data.university.destination_code || t.destination_code, city: data.university.city || null,
      region: data.university.region || null, website_url: data.university.website_url || null,
      logo_path: t.logo_path || null, tier: t.tier || 2, research_batch: t.batch || null } });
  }
  if (data.university) {
    const uv = ver.university && typeof ver.university === 'object' ? ver.university : null;
    const u = applyCorrections(data.university, uv);
    const rows = await api('PATCH', `universities?slug=eq.${encodeURIComponent(data.university.slug)}`,
      { ...pick(u, UNI), review_notes: notes(data.university, uv) }, 'return=representation');
    if (!rows.length) throw new Error(`No university row for ${data.university.slug}; seed it first.`);
    uniId = rows[0].id;
  }

  async function upsert(table, cols, items, verifyList, extra) {
    if (!items.length) return 0;
    const slugs = items.map(x => x.slug);
    const existing = await api('GET', `${table}?select=slug,is_published&slug=in.(${slugs.map(s => `"${s}"`).join(',')})`);
    const published = new Set(existing.filter(r => r.is_published).map(r => r.slug));
    const rows = [];
    for (const it of items) {
      if (excl.scholarships[it.slug]) { report.skipped.push(`${it.slug} (excluded: ${excl.scholarships[it.slug]})`); continue; }
      if (published.has(it.slug)) { report.skipped.push(`${it.slug} (already published, left unchanged)`); continue; }
      const v = find(verifyList, it.slug);
      const row = applyCorrections(it, v);
      if (!['high', 'medium', 'low'].includes(row.confidence)) row.confidence = 'low';
      rows.push({ ...pick(row, cols), ...extra(row), review_notes: notes(it, v, excl.overrides[it.slug]), is_published: false });
    }
    if (rows.length) await api('POST', `${table}?on_conflict=slug`, rows, 'resolution=merge-duplicates,return=minimal');
    return rows.length;
  }

  report.courses = await upsert('courses', COURSE, data.courses || [], 'courses', () => ({ university_id: uniId }));
  report.scholarships = await upsert('scholarships', AWARD, data.scholarships || [], 'scholarships',
    r => ({ university_id: r.provider_type === 'university' ? uniId : null }));
  return report;
}

async function importDestinations() {
  const f = path.join(dir, '_destinations.json');
  if (!existsSync(f)) return;
  const d = JSON.parse(await readFile(f, 'utf8'));
  for (const r of d.destinations || []) {
    await api('PATCH', `destinations?code=eq.${r.code}`, pick(r, ['post_study_work_summary', 'post_study_work_source_url', 'post_study_work_verified_on']));
  }
  console.log(`destinations: ${(d.destinations || []).length} post-study work summaries updated`);
}

let TARGETS = {};
async function main() {
  try { for (const t of JSON.parse(await readFile(path.join(dir, '_targets.json'), 'utf8'))) TARGETS[t.slug] = t; } catch {}
  const excl = { scholarships: {}, overrides: {} };
  try { Object.assign(excl, JSON.parse(await readFile(path.join(dir, '_exclusions.json'), 'utf8'))); } catch {}
  const wanted = process.argv.slice(2).filter(Boolean);
  const files = (await readdir(dir))
    .filter(f => f.endsWith('.json') && !f.endsWith('.verify.json') && !['_exclusions.json', '_destinations.json', '_targets.json'].includes(f))
    .filter(f => !wanted.length || wanted.some(w => f === w || f === `${w}.json` || f.startsWith(w)))
    .sort();
  for (const f of files) {
    const r = await importFile(path.join(dir, f), excl);
    console.log(`${r.file}: ${r.courses} courses, ${r.scholarships} scholarships as drafts` + (r.skipped.length ? `; skipped ${r.skipped.join('; ')}` : ''));
  }
  if (!wanted.length) await importDestinations();
  if (DRY) console.log(`dry run: ${DRYROWS.length} rows prepared, ${DRYROWS.filter(r => r.is_published !== false).length} not marked unpublished, ${DRYROWS.filter(r => /[\u2013\u2014]/.test(JSON.stringify(r))).length} with dashes`);
  console.log('Nothing was published here. Rows listed in data/approvals are published by scripts/publish-approved.mjs.');
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
