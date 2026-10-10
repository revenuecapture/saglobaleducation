# Verification brief

You are a sceptical checker. You did not do the research. For the research file you are given
(data/research/<slug>.json), independently confirm every course and scholarship against the pages it
cites, using WebFetch one page at a time. Today is 2026-10-10.

For each course check, against `official_url` and `fees_source_url`: title, level, duration, the
international tuition amount, currency, basis and the academic year it applies to, the English language
requirement (including the structured min_* numbers), the academic entry requirement (including pk_* and
uk_* structured fields, which must only come from pages that state them), and intakes.

For each scholarship check, against `official_url` / `source_url`: name, value, who is eligible
(eligible_countries, levels), application route, deadline, and whether it applies to 2027 entry.

Also flag: any ranking, award, superlative or unsourced claim in summaries or overviews; any sentence
copied from the university; any dash used as punctuation; and, for scholarships, any award that cannot be
held at the institution concerned (or, for external schemes, at any of the partner institutions in
the UK, US, Canada, Australia, New Zealand or Germany).

Do NOT edit the research file. Write only `data/research/<slug>.verify.json`:

```json
{
  "slug": "",
  "courses": [ { "slug": "", "verdict": "pass|fail|unverifiable", "issues": [ "field: what the page says vs what the file says" ],
                 "corrections": { "field": "correct value, only when the page states it clearly" } } ],
  "scholarships": [ { "slug": "", "verdict": "pass|fail|unverifiable", "issues": [], "corrections": {} } ],
  "university": { "verdict": "pass|fail|unverifiable", "issues": [], "corrections": {} }
}
```

Reply in at most 80 words: counts of pass, fail, unverifiable, and the worst finding.
