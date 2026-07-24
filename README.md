# topless.pro

A mobile-first directory describing beach clothing requirements while keeping official rules separate from tolerated or community-reported customs.

The directory uses five clothing classifications:

- Swimwear required
- Topless permitted
- Clothing optional
- Nudity permitted
- Unknown

Each record also carries a recognition level (`official`, `tolerated`, `community-reported`, or `disputed`) and a confidence level.

> The seed records are demonstrations, not production-quality legal or travel guidance. Verify every classification with authoritative sources before launch.

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
npm run dev
```

Local migrations and development use Wrangler's local Miniflare state. They do not modify a remote D1 database.

## Validate

```bash
npm run check
npm test
npm run build
npm audit
```

`npm test` runs both React/jsdom tests and Worker/D1 integration tests in the Cloudflare Workers runtime.

## Cloudflare configuration

Create the D1 database only when ready to configure Cloudflare:

```bash
npx wrangler login
npx wrangler d1 create topless-pro-db
```

Copy the returned database ID into `wrangler.jsonc`. The committed `REPLACE_WITH_D1_DATABASE_ID` value intentionally prevents an accidental production deployment.

The correction rate limiter uses namespace ID `1001`, which is a project-defined positive integer. Change it before deployment if that identifier is already used for another rate limiter in the same Cloudflare account.

After reviewing the configuration, remote migrations and deployment are explicit operations:

```bash
npm run db:migrate:remote
npm run deploy
```

## Connect topless.pro

After the first approved Worker deployment, open the Cloudflare dashboard, select the `topless-pro` Worker, then add `topless.pro` and optionally `www.topless.pro` as custom domains.

## Suggested next steps

1. Replace demonstration data with verified records and authoritative sources.
2. Add protected moderation endpoints and an editorial audit trail.
3. Add Turnstile if the rate limiter and honeypot do not sufficiently control spam.
4. Add map browsing once the directory has enough reliable entries.
