# SA Global Education website

saglobal.org: the static website, plus the course finder and scholarship finder data.
Everything runs on free plans.

| Folder | What it holds |
| --- | --- |
| `site/` | The published website (Cloudflare Pages serves this folder) |
| `supabase/migrations/` | Database schema, access rules and seed data, in the order they were applied |
| `scripts/` | `build-finders.mjs` (runs in the Cloudflare build), `import-drafts.mjs` and `backup.mjs` (run by GitHub Actions) |
| `data/research/` | Verified research files for the course and scholarship finders, with the checker's reports |
| `supabase/functions/` | `submit-lead`, which saves finder enquiries |
| `backups/` | Weekly export of the catalogue tables (no enquiries or personal data) |
| `.github/workflows/` | Daily Supabase keep-alive, weekly backup, research import, site rebuild |

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
   Project name `saglobaleducation`, production branch `main`, framework preset None,
   build command `node scripts/build-finders.mjs`, build output directory `site`.
   The build reads only published rows, using the public key built into the script.
   Then Settings > Builds > Deploy hooks > Add (name it "rebuild"), and save the URL as a
   GitHub secret named `CF_DEPLOY_HOOK`.
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

## Course and scholarship finders

1. Research for each institution lands in `data/research/<slug>.json`, with an independent
   check in `<slug>.verify.json`.
2. Actions > **Import research drafts** > Run workflow loads them into Supabase as unpublished
   drafts. The checker's verdict and issues are in each row's `review_notes`.
3. The reviewer opens Supabase > Table Editor > `courses` / `scholarships`, filters
   `is_published = false`, reads `review_notes`, fixes anything flagged, and ticks
   `is_published` for approved rows (and for the row's university in `universities`).
4. Actions > **Rebuild site** > Run workflow. The finders and their pages update within minutes.

Matching is "likely eligible" only, computed in the visitor's browser from the published
requirements. Answers stay in the visitor's browser unless they send an enquiry.
