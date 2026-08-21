# topless.pro

A mobile-first directory describing beach clothing requirements while keeping official rules separate from tolerated or community-reported customs.

The directory uses five clothing classifications:

- Swimwear required
- Topless permitted
- Clothing optional
- Nudity permitted
- Unknown

Each record also carries a recognition level (`official`, `tolerated`, `community-reported`, or `disputed`) and a confidence level.

## Architecture

- React and TypeScript single-page application built with Vite
- Hono API running on Cloudflare Workers
- Cloudflare D1 for beach records and correction submissions
- Cloudflare Static Assets binding for SPA routing
- Native Workers rate limiting and a form honeypot for correction submissions
- Vitest UI tests plus Worker/D1 integration tests running in `workerd`
- GitHub Actions validation

The Worker exposes:

- `GET /api/health`
- `GET /api/beaches`
- `GET /api/beaches/:slug`
- `POST /api/corrections`

## Requirements

- Node.js 22.21.0, as recorded in `.nvmrc`
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

`db:seed:local` is optional. It loads four clearly labelled demonstration records from
`fixtures/0001_demo_beaches.sql` so the directory can be exercised before verified data is
available.

Local migrations, optional fixtures, and development use Wrangler's local Miniflare state.
They do not modify a remote D1 database. Deployable migrations in `migrations/` contain schema
only; local/test fixtures are deliberately kept outside that directory.

If you ran the original demonstration migration before the fixtures were separated, its rows
remain in that existing local state. Remove only those four exact demo records (and their local
corrections) with:

```bash
npm run db:clear-demo:local
```

This cleanup command always targets local D1 state and is not a production migration.

## Research beach candidates

Editorial research is stored under `data/`, organized by country and locality. The first
pilot is `data/gr/chalkidiki/sithonia/beaches.json`.

The candidate format mirrors the existing D1 beach fields. Unknown required values stay
`null`, unpublished candidates are never imported automatically, and the validator reports
which values are still missing.

See `data/README.md` for the format and run:

```bash
npm run data:validate
```

To validate, generate idempotent SQL, and import complete candidates into local
D1 only:

```bash
npm run db:import:local
```

## Validate

```bash
npm run check
npm test
npm run build
npm audit
```

`npm test` runs both React/jsdom tests and Worker/D1 integration tests in the Cloudflare Workers runtime.

## Cloudflare configuration

`wrangler.jsonc` is wired to the production account: the committed D1 `database_id` is the
live database and the custom-domain routes point at `topless.pro`. There is no placeholder
guard any more — `npm run deploy` ships straight to production, so treat it as a production
action and run it only from a clean, reviewed `main`.

The correction rate limiter uses namespace ID `1001`, which is a project-defined positive integer. Change it before deployment if that identifier is already used for another rate limiter in the same Cloudflare account.

After reviewing the configuration, remote migrations and deployment are explicit operations:

```bash
npm run db:migrate:remote
npm run deploy
```

The remote migration command applies schema only. There is intentionally no remote seed command.

## Connect topless.pro

After the first approved Worker deployment, open the Cloudflare dashboard, select the `topless-pro` Worker, then add `topless.pro` and optionally `www.topless.pro` as custom domains.

## Suggested next steps

1. Research and import verified records with authoritative sources.
2. Add protected moderation endpoints and an editorial audit trail.
3. Add Turnstile if the rate limiter and honeypot do not sufficiently control spam.
4. Add map browsing once the directory has enough reliable entries.
