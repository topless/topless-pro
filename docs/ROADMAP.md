# Roadmap

The plan for the phase after the signage redesign (August 2026). It covers four areas —
getting editorial data into production, taking information from the public, a map, and the
supporting work a one-editor directory needs — as fourteen milestones in three waves. Each
milestone is one pull request or a few, and names the gate that must be true before it starts.

Status legend: `[x]` shipped · `[ ]` not started · `[~]` in progress.

## Decisions taken

These shaped the sequence; each was a choice with a stated default, and the default was taken.

1. **Account tier.** Assumed Workers Free (7-day D1 Time Travel, 100k requests/day). Stay on
   Free until the interactive map forces Paid.
2. **Deploy host.** GitHub Actions: the pipeline is versioned in the repo and the production
   diff is printed where the pull request lives. The Cloudflare token is a `production`
   environment secret bound only on the wrangler steps. Workers Builds remains the alternative
   if holding no secret in GitHub matters more.
3. **Review of generated SQL.** Merging to `main` is the review: the PR diff is the `data/`
   change, CI validates it, and the deploy job prints the field-level production diff before
   applying it. A required reviewer on the environment can add a second click later.
4. **Schema 0002 now, while production is empty.** `beaches` loses the redundant `id` column;
   `corrections` becomes `submissions` with review fields. Later it would be a data migration.
5. **Data licence.** `data/` is CC BY 4.0; code stays MIT. Added before the first outside PR.
6. **Public input.** Structured forms stored in D1 (EU jurisdiction, purged after 90 days),
   mirrored once a day — minus the email — as issues in a private inbox repository that serves
   as the moderation queue. Acceptance still goes through a `data/` PR and the validator.
   Turnstile is held until spam is observed; it would be the site's first third-party script.
7. **Map order.** Provider-neutral "open in" links → pre-rendered static locator images →
   interactive MapLibre map with self-hosted tiles at roughly 50 published beaches across three
   areas (when R2 is enabled and the account moves to Paid). Third-party tile hosts are out
   under the privacy stance.
8. **Measurement.** Workers Logs only (already on, three-day retention). The About page is
   corrected to say so. Analytics Engine waits for a written list of decisions it would change.
9. **Pilot success.** Publish whichever Sithonia candidates meet the evidence policy; never
   relax the policy to reach seven.

## Wave 1 — make production real

- [x] **M0 · Ship what exists.** Deploy `main`; pin `@types/node` to the Node line in `.nvmrc`
  and move `.nvmrc` to a release the toolchain supports; group Dependabot's dev bumps; state
  `workers_dev`/`preview_urls` intent in `wrangler.jsonc`; fix README drift; this file.
- [ ] **M1 · Schema 0002 as the union.** Recreate `beaches` keyed on `slug` with a
  `(published, country_code, region)` index; replace `corrections` with `submissions`
  (`kind`, `status`, `reviewed_at`, `resolution`, `github_issue`, nullable `email`); the
  existing free-text form writes into it unchanged. Fixtures gain a `published = 0` row so the
  Worker's published filters are finally tested. *Gate: decision 4; before any production import.*
- [ ] **M2 · Make the importer production-safe.** No `BEGIN`/`COMMIT` wrapper (the remote
  import path rejects it); INSERTs chunked by byte budget under D1's 100 KB statement cap;
  changed-only upsert so `updated_at` and the sitemap `lastmod` move only on real change;
  beaches that leave `data/` are unpublished, never deleted; generator refactored into
  importable functions with a workerd test that executes its SQL twice; a plan/diff script;
  `data:status`; a JSON Schema for editor autocomplete; validator gains slug length and
  no-future-date checks; `data/README.md` corrected. *Gate: M1.*
- [ ] **M3 · Source and publish the Sithonia pilot.** Summary style guide and sourcing
  checklist first; `data/LICENSE` (CC BY 4.0) and a PR template with the evidence checklist;
  then a source for each candidate's dress-code claim, a summary and a date, publishing only
  where the policy holds. Research-bound; a partial result is expected. *Gate: decisions 5, 9.*
- [ ] **M4 · One deploy path.** `deploy.yml` on push to `main`: check → migrate → plan →
  import → deploy, token bound at step level, `concurrency: production`, branch protection on
  `main`; one rehearsal against a `preview_database_id`; additive-only migration rule;
  `db:backup:remote` that excludes emails; import runbook. *Gate: decisions 1–3, M2.*
- [ ] **M5 · Privacy paragraph v1, smoke check, legal lines.** About discloses Workers Logs
  and traces, names the licence and a takedown contact; one disclaimer line under the answer
  block; a daily smoke workflow (health, home, sitemap, the `Sitemap:` line in robots.txt, and a
  POST to a smoke slug); decide whether `/api/` is crawlable. *Gate: decision 8.*
- [ ] **M6 · Quick wins.** Provider-neutral location links (Apple, Google, OpenStreetMap,
  `geo:`); a per-listing GitHub history link; static OpenGraph images per dress code; a GitHub
  issue form for suggesting a beach or a source, replacing the bare repository link in the
  launch state; tidy the duplicated live region on Home and cache the beach list in the client.

## Wave 2 — after the pilot is live

- [ ] **M7 · Moderation you can use.** `submissions:pending|show|resolve|purge` scripts that
  never print the email column; retention stated on About (rows purged 90 days after review,
  email kept until resolved); a "Handling a report" section in `data/README.md`.
  *Gate: the first real report.*
- [ ] **M8 · Country and region landing pages.** `/greece`, `/greece/chalkidiki` with name
  slugs frozen in each file's `scope` and enforced by the validator; `?country=&region=` on
  the API; injected meta, `ItemList` JSON-LD, sitemap entries; Cache API on the list and
  sitemap responses. *Gate: pilot published and indexed.*
- [ ] **M9 · Structured submissions and the GitHub inbox.** One `POST /api/submissions` for
  "suggest a beach" (`/suggest`) and "report a change" (beach page), phrased as questions;
  the evidence field reuses the validator's map-pin rule from one shared module; cheap abuse
  caps; a daily cron mirrors to the private inbox repo with an explicit `User-Agent`; copy
  names GitHub as a processor. *Gate: decision 6; measured traffic or the first real report.*
- [ ] **M10 · Static locator images.** A local render step from a small PMTiles extract,
  images committed like generated SQL; also `og:image` and the no-JS fallback.
  *Gate: ≥ 10 published beaches or a second area; a one-hour native-render spike.*
- [ ] **M11 · Open data and a versioned API.** `/api/v1` with CORS on GET, `ETag`, Cache API,
  rate limiting; GeoJSON and CSV downloads; "Reuse this data" on About. *Gate: M8.*

## Wave 3 — at scale

- [ ] **M12 · Analytics Engine counting.** Worker-side, no script, no IP; monthly export
  because retention is three months; disclosure in the same PR.
  *Gate: a written list of the decisions the numbers would change.*
- [ ] **M13 · The interactive map.** MapLibre loaded only behind a Map control; Protomaps
  PMTiles in an EU R2 bucket served tile-by-tile through the Worker with Cache API; glyphs and
  sprites self-hosted; CSP gains `worker-src 'self'` and `blob:` in `img-src`; CI size check
  on both chunks; tile-route log hygiene. *Gate: ~50 beaches across three areas; R2 enabled;
  Workers Paid.*

## Deferred, with the trigger that reopens each

RSS (a reader asks) · i18n (a Greek- or German-speaking contributor maintains summaries) ·
"near me" (more than 100 listings in one country; one-shot, in-browser) · evidence photos
(signs only, editor-taken, private bucket) · API pagination (~300 rows) · print card ·
in-page change history. Never: Cloudflare Web Analytics (third-party script), dynamic
OpenGraph images, a CHANGELOG file, terms of service.

## How the plan was made

Five design studies — one per area plus a codebase audit — were each reviewed by an
adversarial skeptic that verified their claims against the repository, the installed wrangler
source, local SQLite and workerd reproductions, live checks and current Cloudflare, GitHub,
OSM, MapLibre and Protomaps documentation; eleven claims were refuted and corrected. A
completeness critic then resolved the conflicts between the five and proposed the sequence.
