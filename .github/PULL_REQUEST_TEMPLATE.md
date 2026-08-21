## What changes

<!-- One or two sentences. For data changes, name the beaches. -->

## Evidence checklist (for changes under `data/`)

- [ ] Every `sourceUrl` supports the **dress-code claim**, not just the beach's existence — no map pins, no link shorteners.
- [ ] `recognition` and `confidence` say no more than the source does: `high` only with a supporting source; local knowledge without a citable source is at most `medium`; second-hand reports are `low`.
- [ ] `clothing-optional` only where nude and clothed use mix across the **whole** beach; a nude end or cove is `nudity-permitted`.
- [ ] Every published listing has a `sourceUrl`, a `summary` written to the style guide in `data/README.md`, and `lastVerifiedAt` set to the day the source was checked.
- [ ] Slugs are unchanged (a renamed slug is a new beach) and `npm run data:validate` passes.
- [ ] I agree that what I contribute may be published under CC BY 4.0 (`data/LICENSE.md`), edited, without naming me.

## What merging does

Merging to `main` deploys: schema migrations, then the data import (the plan appears in the job summary), then the Worker.
