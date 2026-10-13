# Course and scholarship finders: execution plan

Working file for Badr and Claude. It turns the client plan into tasks we can tick off.

- **Client plan (Docs):** https://claude.ai/code/artifact/69952786-1b12-4552-a3e2-c99cf8c2d99b. Sections 1 to 8 below match its sections.
- **Status:** draft, updated 13 October 2026 for the 460-scale finders (client change list item 9). Nothing below gets built until Badr approves this file and the client approves the plan.
- **Who does what:**
  - Claude builds, researches, checks and publishes.
  - Badr approves this file and sends the client's inputs.
  - The client approves the plan once ("yes to the whole plan"). There is no per-batch client review: Claude's independent check (4.3) is the gate, and Badr spot-checks each week.

---

## 0. Where we are today

| Area | Today | Gap |
|---|---|---|
| Data | Supabase `kdndxzqxzgnusgvgcqsv`, free plan. 46 published courses at 6 UK universities. 25 open scholarships, most of them university awards. Eiffel, the DAAD arts scholarships and EPOS are waiting on the SQL in `supabase/manual/2026-10-11-europe-scholarships.sql`. | Coverage is 6 of the 470 institutions on the Countries page |
| Pipeline | `data/research/*.json`, each with a `.verify.json`. The `import-drafts.yml` job loads them through the `ops` edge function (`upsert_drafts`), always unpublished. `build-finders.mjs` builds static JSON and detail pages on Cloudflare Pages. | Publishing needs a database write, and the Supabase approval prompt gets cancelled when Badr isn't watching (twice on 11 Oct). See task 4.4. |
| Rebuild | `rebuild-site.yml`, weekly on Mondays at 02:41 UTC, plus manual runs | A scholarship can stay up to 7 days after its deadline. Task 2.8. |
| Course schema | `courses` already has `duration_months`, `min_ielts_overall`, `min_pte`, `min_toefl`, `min_duolingo`, `pk_route`, `pk_min_percent`, `pk_min_cgpa`, `intake_labels` | No `moi_accepted` or `video_url`. Budget and English filters need these fields filled in consistently, not just present. |
| Enquiries | Finder leads go to `submit-lead`, which stores them in `leads` and posts to `LEAD_WEBHOOK_URL` only if that secret is set. The contact form sends email through EmailJS. | **Check whether `LEAD_WEBHOOK_URL` is set.** If it isn't, nobody is told about finder leads. Task 5.1. |
| Outbound links | Course and award pages show "Official course page" and "Official scholarship page". Cards have Enquire. | The client wants students kept with SA Global (WhatsApp or enquiry). Decision 8.5 keeps a small "Source" link. |
| Reference sites | GoStudyIn: curated courses, but "N/A" for ranking and entry score on every card, no fee, IELTS or intake filters. IDP: 150k results, filters for budget, IELTS, duration and mode, plus a FastLane offer in principle. Uniserve: 45 hand-written programmes with flags and PSW lines, some implausible (Stanford, Columbia) and some wrong (OPT described as "36-month extension"). | Copy IDP's filter set and Uniserve's card density. Avoid both of their data habits. |

## 1. Summary of scope

Coverage in four phases (section 3), the new features in section 2, and the accuracy routine in section 4. Everything stays on free plans (Supabase free, Cloudflare Pages free, GitHub Actions free minutes, EmailJS free tier).

## 2. Features

Each task lists what to change and how we'll know it's done. "Finder" means both finders unless it says otherwise.

- [ ] **2.1 Search from any page.**
  - Add a search icon to the header nav on all pages (desktop and the mobile menu). It opens a small search panel with "Search courses" and "Search scholarships" and submits to `/courses/?q=` or `/scholarships/?q=`.
  - Done when typing "data science" on the About page lands on the course finder with that search applied.
- [ ] **2.2 New filters.**
  - Budget: a per-year tuition band, shown only once a destination is picked, so currencies never mix. Bands come from the data, about 5 per destination.
  - English: "My IELTS / PTE score" input, which keeps courses whose `min_ielts_overall` or `min_pte` is at or below it. Courses with no published minimum show under "check with us", never as a pass.
  - MOI accepted: new `courses.moi_accepted boolean` (null means unknown), sourced from the university page. Only filled where a page states it.
  - Scholarship available: already a tag. Promote it to a toggle.
  - Length: buckets of up to 12 months, 13 to 24, and over 24, from `duration_months`.
  - Done when every filter has a chip, counts update, the URL stores the state, and "Reset all" clears it.
- [ ] **2.3 Compare up to three courses.**
  - Bookmark-style "Compare" toggle on cards and quick view, with a sticky tray ("2 selected, Compare"). The dialog is a table with rows for fee, fee year, length, intakes, deadline, academic entry for Pakistan, English, scholarships and source.
  - "Ask about these" sends the three slugs through the existing enquiry.
  - State is saved in localStorage.
  - Done when it works with keyboard only, and on a 390px phone as stacked cards.
- [ ] **2.4 Cards.**
  - Add the English requirement (for example "IELTS 6.5") and the length.
  - A field with no value is left off the card, never shown as "N/A".
- [ ] **2.5 Course pages.**
  - Add `courses.video_url text` (YouTube or Vimeo only), shown as a click-to-load player so no third-party cookies load before a click.
  - Add a "Documents you will need" link to `/documents-checklist/`.
  - Add the WhatsApp PK and UK buttons.
  - Rename the "Official course page" link to a small "Source" link (decision 8.5).
- [ ] **2.6 WhatsApp in both finders.**
  - Add the WhatsApp choice (the same `dialog.ask` the Countries page uses) to cards, quick view, detail pages and the shortlist.
  - The prefilled text names the course and university, or the award.
  - Track `whatsapp_click` with item and line.
- [ ] **2.7 Scholarships by country.**
  - On `/scholarships/`, keep the UK table and the Germany and France section, and add one section per destination as each phase lands, fed from published scheme rows.
  - Move the UK table into the finder as rows once each award is checked (section 4). The static table then goes.
- [ ] **2.8 Deadlines drop off on the day.**
  - Change `rebuild-site.yml` to run daily.
  - In `finder.js`, hide items whose `deadline < today` at load, in case a build is late.
- [ ] **2.9 Searches that found nothing.**
  - When a search or filter combination returns 0 results, POST `{q, filters}` to a new `search-miss` edge function. No personal data, rate-limited like `submit-lead`. It writes to `search_misses`.
  - It feeds the monthly report (5.3).
- [ ] **2.10 Standards check, before each release.**
  - No "N/A" anywhere. No ranking claims. No "guaranteed".
  - Every number has a source link and a checked-on date.
  - Copy follows the standing rules: no em or en dashes, no eyebrow labels, no "X, not Y" lines, British English.

## 3. Coverage

Target: every institution on the Countries page (470 on 13 Oct 2026), with a small deviation for institutions that publish no fee or entry information we can verify. Promise to the client: more than 450. Phase lists are named in full in the client plan.

| Phase | Dates (Tue to Mon) | Destinations | Institutions | Courses (approx.) | Running total |
|---|---|---|---|---|---|
| Live | | UK | 6 | 46 | 6 / 46 |
| 1 | 20 to 26 Oct | UK part one: Russell Group 18, UK scholarships table 16, priority 8 | 42 | 420 (10 each) | 48 / 466 |
| 2 | 27 Oct to 2 Nov | UK part two | 40 | 240 (6 each) | 88 / 706 |
| 3 | 3 to 9 Nov | US, A to Lewis | 73 | 365 (5 each) | 161 / 1,071 |
| 4 | 10 to 16 Nov | US, Lipscomb to The New School | 72 | 360 | 233 / 1,431 |
| 5 | 17 to 23 Nov | US, Southern Mississippi to Youngstown State | 72 | 360 | 305 / 1,791 |
| 6 | 24 to 30 Nov | Canada | 59 | 295 | 364 / 2,086 |
| 7 | 1 to 7 Dec | Australia 29 (6 each), NZ 19, Ireland 16 | 64 | 350 | 428 / 2,436 |
| 8 | 8 to 14 Dec | Europe 7, UAE 8, Singapore 2, Malaysia 10, Turkey 15 | 42 | 210 | 470 / 2,646 |

Scholarships: the main published international award at each institution where one exists, plus government schemes, about 350 in total (client figure "350+").

**Depth tiers.** Phase 1 universities get about 10 courses each across the six default subjects. Everyone else gets 5 or 6 headline courses (the most-asked subjects that the institution actually teaches). More courses are added later from the monthly "searches that found nothing" report (5.3).

**Realism (Badr only, not in the client plan).**
- The pace is about 60 institutions and 300 to 400 courses a week, roughly 12 institutions a working day. That only works with daily scheduled research runs, the approvals-file publishing (4.4), and the verifier running in the same run.
- Phases 3 to 5 (US, 217 institutions) are the riskiest. Many are pathway partners (Shorelight, INTO, Navitas, Kaplan, Study Group, BPP), which share page structures and speed things up. Fallback if a week slips: drop US tier-two institutions to 3 courses each, and carry what is left into the next week without moving the published dates.
- About 20 institutions may not reach the finder: online or pathway-only providers (American Collegiate Live), schools with no public international fee pages, and a few colleges with no Pakistan entry information. They stay on the Countries page with WhatsApp and enquiry.

- [ ] **3.1** Get the client's priority list and top subjects (client plan, section 7). Until then, the default subjects are business and management, computing and data, engineering, public health, finance and accounting, and law, master's level first.
- [ ] **3.2** For each university, write `data/research/<dest>-<slug>.json` using `data/prompts/research-institution.md`, then the separate check using `data/prompts/verify.md`.
- [ ] **3.3** Destinations: add rows for IE, AE, SG, MY, TR, FR (FR is in the pending SQL). Keep `tab_label` grouping, so Germany and France show as "Europe" (already supported in `finder.js` through `tabCodes`). Fill in post-study work text from official pages.
- [ ] **3.4** Network partners (INTO, Study Group, Shorelight, Navitas, Kaplan, OIEG, BPP): courses are listed under the university, with `route` set to the pathway provider, so the counsellor knows how to apply. Students never see a link out to the provider.
- [ ] **3.5** Pace: about 12 institutions researched and checked per working day, through a daily scheduled run (Tuesday to Monday). Publishing happens through approvals files as each institution passes the check. No client review step.

## 4. Accuracy and publishing

- [ ] **4.1 Required to publish a course.**
  - Title, level, field, length, tuition amount and fee year, `fees_source_url`, academic requirement, `pakistan_entry_note` with source, English requirement, at least one intake, `official_url`, `source_url`, `verified_on`.
  - Anything missing stays a draft.
- [ ] **4.2 Required to publish a scholarship.**
  - Value text, who can apply (Pakistan or international), route, levels, deadline or deadline note, `official_url`, `verified_on`.
  - Expired or not yet open means it isn't published.
- [ ] **4.3 Independent check.**
  - The verifier reopens every source. Any FAIL is fixed or the field is dropped.
  - Confidence `low` is never published without Badr's explicit OK, recorded in `review_notes`.
- [ ] **4.4 Publishing without the Supabase dashboard (needs Badr's OK).**
  - Add an `ops` operation `publish { table, slugs }`, called by a new `publish-approved.yml` workflow.
  - The workflow runs when `data/approvals/<date>.json` changes on main. That file lists the slugs that passed the independent check (4.3).
  - Claude commits the approvals file with the check date, and the workflow publishes and rebuilds. Badr's one-off OK of this workflow (8.2) is the human approval; individual batches need none.
  - This removes the database prompt that kept getting cancelled.
  - The pending Europe SQL can then be replaced by an approvals file.
- [ ] **4.5 Weekly summary for Badr.**
  - A short Monday note: institutions and courses published that week, anything dropped and why, low-confidence rows held back. Badr spot-checks a sample. Nothing goes to the client.
- [ ] **4.6 Re-check schedule.**
  - Fees and requirements: every intake (September and January).
  - Scholarships: monthly from September to March.
  - A scheduled task lists rows with `verified_on` older than the limit.
- [ ] **4.7 Partner material** (posters, the Malaysia fee table, the client's UK scholarship table).
  - Treat it as a lead and check it on the official page. Where we can't, show it as "indicative" or leave it out.
  - Known conflict: the Exeter table says £5,000 to £8,000 and the Exeter poster says up to £10,000. The official page decides.

## 5. Enquiries

- [ ] **5.1** Check whether `LEAD_WEBHOOK_URL` is set. If not, add email delivery to `submit-lead`, sending to info@saglobal.org with the student's details, chosen items and eligibility profile.
  - Option A: the EmailJS REST API from the edge function, with the private key stored as a Supabase secret. It's on the free tier, already used by the contact form, and limited to 200 emails a month.
  - Option B: Brevo's free tier, 300 a day.
  - Start with A and move to B if volume passes 150 a month.
- [ ] **5.2** Confirm the reply promise ("within one working day") matches the client's practice.
- [ ] **5.3** Monthly report, sent to Badr: leads by finder, the top 20 viewed courses, and the top searches that found nothing (2.9). Produced by SQL plus a short note. It can become a scheduled task.
- [ ] **5.4** Later: when HubSpot is active, point `LEAD_WEBHOOK_URL` at a HubSpot form or workflow (see the HubSpot SPF note in the project doc).

## 6. Timeline

| Dates (2026 to 2027) | Work | Gate |
|---|---|---|
| 13 to 19 Oct | 4.4 approvals publishing, 5.1 lead email, 2.1 search, 2.4 cards, 2.5 course pages, 2.6 WhatsApp | Badr checks on the live site |
| 20 Oct to 14 Dec | Phases 1 to 8, one a week, each starting on a Tuesday (section 3) | Independent check (4.3) per institution; Badr spot-checks weekly |
| Phase 2 week | 2.2 filters | |
| Phase 3 week | 2.3 compare | |
| From Phase 4 | 5.3 monthly report, 2.8 daily rebuild | |

Weekly rhythm: research and check every working day, publish as each institution passes, Monday evening summary to Badr with counts and anything dropped.

## 7. Inputs from the client

| Input | Needed by | Status |
|---|---|---|
| UK priority list + top courses | Optional, defaults used | Defaults in place (Russell Group, UK scholarships table, 8 priority) |
| Direct partner or network, per university | Before Phase 1 | Waiting |
| Fee sheets, posters, offer letters | Ongoing | Some received (Malaysia, UK table, Exeter, 6 letters) |
| Videos | When available | Waiting |
| Logo permission | Before Phase 2 | Waiting |
| Missing logos (33 institutions + Manchester Met) | Any time | Badr is collecting them |

## 8. Decisions

Client decisions are in the client plan. Badr's decisions on how we work are below.

- [ ] **8.1** Approve this file.
- [ ] **8.2** Approve publishing through approvals files (4.4), so nobody needs to approve inside Supabase.
- [ ] **8.3** Email delivery for finder leads: EmailJS first (5.1).
- [ ] **8.4** Run the pending Europe scholarships SQL now, or fold it into 4.4.
- [ ] **8.5** Course pages keep a small "Source" link to the university page. The client plan asks the client to confirm this.

**Open flags to raise with the client, already raised once:**
- Research proposal writing: removed from the site on 13 Oct at the client's request. Closed.
- Consent from the six students whose blurred offer letters are shown (now under "Success stories").
- Logo permission.
- The old UK number on printed material.

## Standing rules (apply to every task)

- Facts come only from official pages, with the source link and a checked-on date. Current facts (fees, rules, deadlines) are looked up, never taken from memory.
- No em or en dashes, no eyebrow labels, no "X, not Y" sentences. British English. Brand fonts are Barlow Condensed and Lexend Deca.
- Free plans only.
- Never change the live database without approval. Never put secrets in the repo.
- Every release: run the Playwright checks on desktop and a 390px phone (no console errors, no sideways scroll, no broken files). Commit as Claude with the session trailer. Push to main, then check on saglobal.org.
