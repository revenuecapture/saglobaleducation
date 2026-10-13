// Publishes the rows listed in approvals files (data/approvals/*.json) through the "ops" Edge Function.
//
//   OPS_TOKEN=... node scripts/publish-approved.mjs [file ...]   (default: every approvals file)
//
// An approvals file records what passed the independent check and was approved, and by whom:
//   { "approved_by": "...", "date": "YYYY-MM-DD", "basis": "...",
//     "universities": ["slug"], "courses": ["slug"], "scholarships": ["slug"] }
// Publishing is idempotent, so re-running a file changes nothing.
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(repo, 'data', 'approvals');
const URL_ = process.env.SUPABASE_URL || 'https://kdndxzqxzgnusgvgcqsv.supabase.co';
const OPS_TOKEN = process.env.OPS_TOKEN;
if (!OPS_TOKEN) { console.error('Set OPS_TOKEN (GitHub Actions identity token).'); process.exit(1); }

async function ops(payload) {
  const res = await fetch(`${URL_}/functions/v1/ops`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPS_TOKEN}` }, body: JSON.stringify(payload)
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`ops ${payload.op}: HTTP ${res.status} ${JSON.stringify(out)}`);
  return out;
}

async function main() {
  const wanted = process.argv.slice(2).filter(Boolean).map(f => path.basename(f));
  const files = (await readdir(dir)).filter(f => f.endsWith('.json')).filter(f => !wanted.length || wanted.includes(f)).sort();
  let total = 0;
  for (const f of files) {
    const a = JSON.parse(await readFile(path.join(dir, f), 'utf8'));
    for (const table of ['universities', 'courses', 'scholarships']) {
      const slugs = a[table] || [];
      for (let i = 0; i < slugs.length; i += 400) {
        const r = await ops({ op: 'publish', table, slugs: slugs.slice(i, i + 400) });
        total += r.published || 0;
        if (r.missing && r.missing.length) console.log(`${f} ${table}: not found ${r.missing.join(', ')}`);
      }
      console.log(`${f}: ${slugs.length} ${table} listed`);
    }
  }
  console.log(`published ${total} rows`);
}
main().catch(e => { console.error(e.message || e); process.exit(1); });
