# SA Global Education website

saglobal.org: the static website, plus the course finder and scholarship finder data.
Everything runs on free plans.

| Folder | What it holds |
| --- | --- |
| `site/` | The published website (Cloudflare Pages serves this folder) |
| `supabase/migrations/` | Database schema, access rules and seed data, in the order they were applied |
| `scripts/` | Maintenance scripts run by GitHub Actions |
| `backups/` | Weekly export of the catalogue tables (no enquiries or personal data) |
| `.github/workflows/` | Daily Supabase keep-alive and weekly backup |

## Services

| Service | Plan | Used for |
| --- | --- | --- |
| Supabase project `sa-global` (London) | Free | Courses, scholarships, universities and enquiries |
| Cloudflare Pages | Free | Hosting saglobal.org |
| GitHub (this private repo) | Free | Source, deploys, keep-alive and backups |

## One-time setup

1. **GitHub secret.** Settings > Secrets and variables > Actions > New repository secret.
   Name `SUPABASE_SERVICE_ROLE_KEY`, value from Supabase > Project Settings > API Keys
   (the secret key). Never paste this key anywhere else.
2. **Run both workflows once** from the Actions tab (Run workflow) to confirm they pass.
3. **Cloudflare Pages.** Workers & Pages > Create > Pages > Connect to Git > this repo.
   Production branch `main`, framework preset None, build command empty,
   build output directory `site`.
4. **Domain.** Add saglobal.org to Cloudflare (free plan). Before switching nameservers,
   check that every existing DNS record was imported, especially the email
   records (MX, SPF, DKIM, DMARC). Then add saglobal.org and www.saglobal.org as
   custom domains on the Pages project.

## Keeping it free

- Supabase pauses free projects after a week without database activity. The keep-alive
  workflow reads one row every day. If it fails, GitHub emails the repo owner: open the
  Supabase dashboard and restore the project (free).
- Never add a payment card to the Supabase organisation or upgrade the project.
- If Supabase is ever paused, the website and both finders keep working because they
  are static pages. Only enquiries are affected, and those fall back to the Google Sheet.
- Free Supabase projects have no backups; the backup workflow covers the catalogue.
