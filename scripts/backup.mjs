// Exports the catalogue tables from Supabase to backups/<table>.json.
// Runs in GitHub Actions through the "ops" Edge Function (no secret in GitHub), or by hand with a service role key.
import { mkdir, writeFile } from 'node:fs/promises';

const url = process.env.SUPABASE_URL || 'https://kdndxzqxzgnusgvgcqsv.supabase.co';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const opsToken = process.env.OPS_TOKEN;   // GitHub Actions OpenID Connect token for the "ops" Edge Function
if (!key && !opsToken) { console.error('Set OPS_TOKEN (GitHub Actions) or SUPABASE_SERVICE_ROLE_KEY.'); process.exit(1); }

const tables = {
  fields: 'slug', destinations: 'code', universities: 'slug',
  courses: 'slug', scholarships: 'slug', grade_equivalences: 'id'
};
const PAGE = 1000;

await mkdir('backups', { recursive: true });
for (const [table, order] of Object.entries(tables)) {
  if (opsToken) {
    const res = await fetch(`${url}/functions/v1/ops`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opsToken}` },
      body: JSON.stringify({ op: 'export', table })
    });
    if (!res.ok) { console.error(`${table}: HTTP ${res.status} ${await res.text()}`); process.exit(1); }
    const { rows } = await res.json();
    await writeFile(`backups/${table}.json`, JSON.stringify(rows, null, 2) + '\n');
    console.log(`${table}: ${rows.length} rows`);
    continue;
  }
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const headers = { apikey: key, Range: `${from}-${from + PAGE - 1}` };
    // Legacy service_role keys are JWTs and also go in Authorization; new sb_secret_ keys go in apikey only.
    if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
    const res = await fetch(`${url}/rest/v1/${table}?select=*&order=${order}.asc`, { headers });
    if (!res.ok) { console.error(`${table}: HTTP ${res.status} ${await res.text()}`); process.exit(1); }
    const page = await res.json();
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  await writeFile(`backups/${table}.json`, JSON.stringify(rows, null, 2) + '\n');
  console.log(`${table}: ${rows.length} rows`);
}
