import { loadBeachFiles } from './lib/beach-data.mjs';
import { REQUIRED_D1_FIELDS } from './lib/project-beaches.mjs';

// The editor's checklist: for every candidate, what still stands between it and a
// published listing. Policy itself lives in validate-beach-data.mjs; this only reports.
const RECHECK_AFTER_DAYS = 365;
const DAY_MS = 86_400_000;
const PUBLISH_FIELDS = ['sourceUrl', 'summary', 'lastVerifiedAt'];

const files = await loadBeachFiles();
const now = Date.now();
let total = 0;
let published = 0;
let publishable = 0;

for (const { path, data } of files) {
  const { scope } = data;
  console.log(`\n${path} — ${[scope.municipality, scope.region, scope.countryName].filter(Boolean).join(', ')}`);
  for (const beach of data.beaches) {
    total += 1;
    const missingD1 = REQUIRED_D1_FIELDS.filter((field) => beach[field] === null || beach[field] === undefined);
    const missingToPublish = PUBLISH_FIELDS.filter((field) => !beach[field]);
    const notes = [];

    if (beach.published) {
      published += 1;
      notes.push('published');
    } else if (missingD1.length > 0) {
      notes.push(`draft — missing ${missingD1.join(', ')}`);
    } else if (missingToPublish.length > 0) {
      notes.push(`D1-ready — to publish, add ${missingToPublish.join(', ')}`);
    } else {
      publishable += 1;
      notes.push('meets the publishing bar — set published: true once reviewed');
    }

    if (beach.lastVerifiedAt) {
      const ageDays = Math.floor((now - Date.parse(`${beach.lastVerifiedAt}T00:00:00Z`)) / DAY_MS);
      if (ageDays > RECHECK_AFTER_DAYS) notes.push(`last verified ${ageDays} days ago — re-check`);
    }

    console.log(`  ${beach.slug.padEnd(32)} ${notes.join('; ')}`);
  }
}

console.log(
  `\n${total} candidate(s): ${published} published, ${publishable} publishable but unpublished, `
  + `${total - published - publishable} not yet publishable.`,
);
