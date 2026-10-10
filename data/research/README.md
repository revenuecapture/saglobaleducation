# Research files

One file per institution (`<slug>.json`), plus `_schemes.json` (government and foundation awards) and
`_destinations.json` (post-study work rules). Each has an independent check in `<slug>.verify.json`.
`_exclusions.json` lists awards left out of the finder and any checker verdicts overridden, with reasons.

Pushing changes here runs the "Import research drafts" job, which loads them into Supabase as
unpublished drafts. Nothing appears on the website until a reviewer publishes it.
Briefs for the researchers and checkers are in `../prompts/`.
