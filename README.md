# topless.pro

A mobile-first directory describing beach clothing requirements while keeping official rules separate from tolerated or community-reported customs.

The directory uses five clothing classifications, shown to visitors as:

- Swimwear expected
- Topless accepted
- Clothing optional
- Nudity accepted
- Unknown

Each record also carries a recognition level (`official`, `tolerated`, `community-reported`, or
`disputed` — shown as Official, Local custom, Unconfirmed report, Disputed) and a confidence
level. Display labels and their one-line definitions live in `src/lib/labels.ts`; the keys in
`data/` and D1 never change.

## Architecture

- React and TypeScript single-page application built with Vite
- Hono API running on Cloudflare Workers
- Cloudflare D1 for beach records and correction submissions
- Cloudflare Static Assets binding for SPA routing
- Native Workers rate limiting and a form honeypot for correction submissions
- Worker-injected page metadata: per-route titles, descriptions, canonical URLs,
  OpenGraph tags, and schema.org `Beach` JSON-LD, plus honest 404s with `noindex`
  for unknown paths and unpublished beaches
- Security headers on every response (HSTS, nosniff, frame denial, no-referrer,
  restrictive Permissions-Policy) and a strict CSP outside local development
- Vitest tests for the editorial scripts (Node) and the UI (jsdom), plus Worker/D1 integration tests running in `workerd`
- GitHub Actions validation, including `npm audit` at high severity

The Worker exposes:

- `GET /api/health`
- `GET /api/beaches`
- `GET /api/beaches/:slug`
- `POST /api/corrections`
- `GET /robots.txt` and `GET /sitemap.xml` (generated from published listings)

## Requirements

- The Node.js release recorded in `.nvmrc` (currently 22.23.2)
- npm 10 or later

Using `nvm`:

```bash
nvm use
```

## Run locally

```bash
npm ci
npm run typegen
npm run db:migrate:local
npm run db:seed:local
npm run dev
```

`db:seed:local` is optional. It loads five clearly labelled demonstration records from
`fixtures/0001_demo_beaches.sql` (one of them unpublished) so the directory can be exercised
before verified data is available.

Local migrations, optional fixtures, and development use Wrangler's local Miniflare state.
They do not modify a remote D1 database. Deployable migrations in `migrations/` contain schema
only; local/test fixtures are deliberately kept outside that directory.

Seeded demo records stay in local state (migrations apply once, and the importer unpublishes
rows missing from `data/` but never deletes them). Remove the five fixture records, and any
local submissions filed against them, with:

```bash
npm run db:clear-demo:local
```

This cleanup command always targets local D1 state and is not a production migration.

## Research beach candidates

Editorial research lives under `data/`, organized by country and locality; the format,
evidence policy, and workflow are documented in `data/README.md`. `npm run data:status`
lists what each candidate still needs before it can be published. The one command to
validate, generate SQL, and import complete candidates into local D1:

```bash
npm run db:import:local
```

`npm run db:plan:remote` shows what the same import would change in production without
touching it; `npm run db:import:remote` applies it — Wrangler asks for confirmation only when
stdout is a terminal; from CI or with output piped it applies immediately after the plan.

## Validate

```bash
npm run check
npm test
npm run build
npm audit
```

`npm test` runs the Node tests for the editorial scripts, the React/jsdom tests, and the Worker/D1 integration tests in the Cloudflare Workers runtime.

## Deploying

Merging to `main` deploys. `.github/workflows/deploy.yml` runs check, tests and build, then —
with the Cloudflare token bound only on the wrangler steps — applies schema migrations, prints
the data-import plan to the job summary together with the D1 Time Travel bookmark to restore
to, imports the data only when the plan shows changes, deploys the Worker and smoke-checks
the live site. One deploy runs at a time. `wrangler.jsonc` is wired to the production
account: the committed D1 `database_id` is the live database and the custom-domain routes
point at `topless.pro`.

One-time setup:

1. Create a Cloudflare API token (My Profile → API Tokens → Create Token): start from the
   **Edit Cloudflare Workers** template, add **Account → D1 → Edit**, restrict it to this
   account and the `topless.pro` zone, set an expiry and note it. If the first run fails on
   the custom-domain routes, add **Zone → DNS → Edit** for the zone.
2. In the GitHub repository, Settings → Environments → `production`: add the secrets
   `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` (the account ID is on the Workers
   overview page).
3. Run the workflow once by hand (Actions → Deploy → Run workflow) and read the job summary.

Branch protection on `main` requires a pull request and the `validate` check, so the
pipeline only ever sees reviewed, green commits.

Rehearsal: `npm run db:rehearse:preview` applies the migrations and runs the *real* remote
import path against the preview database (`preview_database_id`), which is the one thing
local Miniflare cannot reproduce. Use it after changing the importer or a migration.

One-off for the first pipeline run: migration 0002 recreates the tables and is not compatible
with the Worker deployed before it, so between the migration step and the deploy step (about
a minute, on a site with no listings) `/api/beaches` and beach pages answer 500; once 0002 is
applied there is no rolling back to an earlier Worker — roll forward. From 0003 on, migrations
are additive and the normal order holds.

Rollback: a bad Worker release → `npx wrangler rollback`; bad data → revert the pull request
(the importer projects the previous state back on the next deploy); a disaster →
`npx wrangler d1 time-travel restore DB --bookmark=…` with the bookmark from the job summary
(whole database; 7 days back on the Free plan). Because old Worker versions may be rolled back
to, schema migrations are **additive only** from 0003 on.

Backup: `npm run db:backup:remote` writes both tables as JSON to the gitignored `backups/`
directory on this machine, without the report email column. Beaches are rebuildable from
`data/`; reports are the state that exists nowhere else.

Break-glass, from a clean reviewed `main` only:

```bash
npm run db:migrate:remote
npm run db:import:remote
npm run deploy
```

The correction rate limiter uses namespace ID `1001`, a project-defined positive integer; change it before deployment if that identifier is already used for another rate limiter in the same Cloudflare account.

## Custom domains

`wrangler.jsonc` declares `topless.pro` and `www.topless.pro` as custom-domain routes, so
`wrangler deploy` creates the DNS records and certificates itself; nothing has to be added in
the dashboard. `workers_dev` and `preview_urls` are off, so the custom domain is the only host.

## Post-deploy check

Cloudflare can serve a zone-managed robots.txt (the "content signals" feature) in
front of the Worker. After deploying, fetch `https://topless.pro/robots.txt` and
confirm the `Sitemap:` line from the Worker survives; if the managed file replaces
it, disable the managed robots.txt in the Cloudflare dashboard.

## Roadmap

The sequenced plan for the next phase — production data pipeline, public submissions, maps and
the supporting work — lives in [`docs/ROADMAP.md`](docs/ROADMAP.md), together with the
decisions that shaped it and the status of each milestone.
