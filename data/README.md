# Beach candidate data

Candidate data is organized by country and locality:

```text
data/<country-code>/<region>/<municipality>/beaches.json
```

Each file starts with `"$schema": "../../../beaches.schema.json"` so an editor can
autocomplete field names and enum values and flag typos as you type. The schema is a
convenience; the rules below are enforced by `scripts/validate-beach-data.mjs`.

The file shape stays close to the `beaches` D1 table. Shared location fields
live once under `scope`; the importer copies them to each D1 row.

## Fields

`scope` needs all four of `countryCode` (ISO 3166-1 alpha-2, matching the country
folder), `countryName`, `region` and `municipality` — they are the folder names.

The D1 schema requires these values for every imported beach:

- `slug` — the beach's only identity: the URL, the database key and the value
  reports refer to. **Slugs are permanent.** Editing a slug does not rename a
  listing; it creates a new beach and the importer unpublishes the old one.
- `name`
- `countryCode` and `countryName` — taken from `scope`
- `latitude` and `longitude`
- `dressCode`
- `recognition`
- `confidence`

The database provides defaults for `facilities`, `published`, `createdAt`, and
`updatedAt`. `summary`, `sourceUrl`, and `lastVerifiedAt` are optional in D1 but
required to publish (see below).

During research, unknown required values are `null` and `published` stays
`false`. A candidate is D1-ready once these five fields are filled:

- `latitude`
- `longitude`
- `dressCode`
- `recognition`
- `confidence`

`dressCode` describes the practical clothing expectation:

- `swimwear-required` — swimwear is expected; topless or nude use should not be
  relied on.
- `topless-permitted` — women sunbathing topless is accepted across the beach;
  full nudity is not.
- `clothing-optional` — nude and clothed use mix across the whole beach, and
  neither stands out. Use this only when the mix covers the whole beach.
- `nudity-permitted` — nude bathing is accepted in a recognisable part of the
  beach (an end, a cove, beyond a marker) while the rest is ordinary swimwear
  use.
- `unknown` — there is not enough information to classify the beach.

`recognition` describes the standing of that dress-code practice:

- `official` — supported by current law, signage, or an authoritative
  designation.
- `tolerated` — not formally designated, but consistently accepted in local
  practice.
- `community-reported` — reported by visitors or contributors, without enough
  evidence to call it established local practice.
- `disputed` — current sources or observations conflict.

`confidence` describes confidence in the selected `dressCode`, not confidence
in the beach's identity:

- `high` — recent, specific, and well-supported.
- `medium` — credible but limited, informal, or not recently reconfirmed.
- `low` — tentative, old, vague, or based on a single weak report.

## Evidence policy

`sourceUrl` must point at evidence for the **dress-code claim**, not merely for the
beach's existence. Acceptable sources include municipal or port-authority pages,
posted signage (photographed and hosted somewhere linkable), operator websites that
state a policy, or established naturist-organisation listings. Map pins — Google, Apple, Bing, and
OpenStreetMap map links, and `goo.gl` shorteners — identify a place, not a norm;
the validator rejects them in `sourceUrl`.

Confidence is capped by evidence:

- `high` requires a `sourceUrl` that supports the claim.
- Personal observation or local knowledge without a citable source is at most
  `medium` (credible but informal), and second-hand reports are `low`.

Publishing has a stricter bar than D1-readiness. `published: true` additionally
requires:

- `sourceUrl` — the claim must be supported;
- `summary` — visitors need context, not just a badge;
- `lastVerifiedAt` — the date the claim was last checked (never in the future).

The validator enforces all of the above, and `npm run check` runs it, so CI fails
on any candidate that breaks policy.

## Validation and status

```bash
npm run data:validate
npm run data:status
```

The validator rejects malformed data and lists the D1-required fields still
missing from each candidate. `data:status` is the editor's checklist: for every
candidate it says whether it is a draft, D1-ready, publishable or published, which
of `sourceUrl`, `summary` and `lastVerifiedAt` still stand between it and
publication, and when a listing was last verified more than a year ago.
Candidate files are never imported automatically.

## Local D1 import

Generate the import SQL and apply it to local D1:

```bash
npm run db:import:local
```

The generated SQL is written under the gitignored `.wrangler/` directory. It is the
same file production receives, and it does three things:

- upserts every complete candidate, keyed on the slug, touching a row's `updatedAt`
  (and so the sitemap's `lastmod`) only when something about the beach actually
  changed;
- unpublishes any row whose slug is no longer in `data/` — the importer never
  deletes, so a listing that should disappear is unpublished here and removed by
  hand once its reports are resolved;
- leaves incomplete candidates (drafts) out of the upsert while still counting their
  slugs, so a published row whose record is temporarily incomplete is not unpublished.

The candidate's `published` value is preserved; new research records remain
unpublished by default. Inspect the local rows with:

```bash
npm run db:verify:local
```

## Production import

```bash
npm run db:plan:remote
```

prints what importing `data/` would change in production without touching it: new
rows, changed rows field by field, unchanged rows, rows that would be unpublished
(with the number of pending reports on each) and drafts skipped. It reads beach rows
and report counts only — never a report's text or email.

```bash
npm run db:import:remote
```

runs the same plan and then applies the generated SQL after Wrangler's confirmation
prompt. The remote import is atomic: if it fails part-way, the database returns to
its previous state and the command can be retried. Once the deploy pipeline lands
(roadmap milestone M4) merging to `main` runs these steps from CI, and the manual
command remains as the break-glass path.
