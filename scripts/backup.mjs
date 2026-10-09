// Exports the catalogue tables from Supabase to backups/<table>.json.
// Runs in GitHub Actions with the service role key held as a repo secret.
import { mkdir, writeFile } from 'node:fs/promises';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.'); process.exit(1); }

const tables = {
  fields: 'slug', destinations: 'code', universities: 'slug',
  courses: 'slug', scholarships: 'slug', grade_equivalences: 'id'
};
const PAGE = 1000;

await mkdir('backups', { recursive: true });
for (const [table, order] of Object.entries(tables)) {
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
