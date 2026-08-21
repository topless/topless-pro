import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { REQUIRED_D1_FIELDS, findBeachFiles } from './lib/beach-data.mjs';

const OUTPUT_FILE = path.join(process.cwd(), '.wrangler', 'imports', 'beaches.sql');

// Single source of truth for the projected columns: name in D1 paired with
// how its value derives from a candidate record. Meant to run via data:sql,
// which validates first.
const COLUMNS = [
  ['id', (scope, beach) => beach.slug],
  ['slug', (scope, beach) => beach.slug],
  ['name', (scope, beach) => beach.name],
  ['country_code', (scope) => scope.countryCode],
  ['country_name', (scope) => scope.countryName],
  ['region', (scope) => scope.region ?? null],
  ['municipality', (scope) => scope.municipality ?? null],
  ['latitude', (scope, beach) => beach.latitude],
  ['longitude', (scope, beach) => beach.longitude],
  ['dress_code', (scope, beach) => beach.dressCode],
  ['recognition', (scope, beach) => beach.recognition],
  ['confidence', (scope, beach) => beach.confidence],
  ['summary', (scope, beach) => beach.summary ?? null],
  ['facilities_json', (scope, beach) => JSON.stringify(beach.facilities ?? [])],
  ['source_url', (scope, beach) => beach.sourceUrl ?? null],
  ['last_verified_at', (scope, beach) => beach.lastVerifiedAt ?? null],
  ['published', (scope, beach) => beach.published ?? false],
];
const COLUMN_NAMES = COLUMNS.map(([name]) => name);
const UPDATE_COLUMNS = COLUMN_NAMES.filter((name) => name !== 'id' && name !== 'slug');

function sqlValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  return `'${String(value).replaceAll("'", "''")}'`;
}

function isComplete(beach) {
  return REQUIRED_D1_FIELDS.every((field) => beach[field] !== null && beach[field] !== undefined);
}

const files = await findBeachFiles();
const rows = [];
const skipped = [];

for (const file of files) {
  const data = JSON.parse(await readFile(file, 'utf8'));
  for (const beach of data.beaches) {
    if (isComplete(beach)) {
      rows.push(COLUMNS.map(([, value]) => sqlValue(value(data.scope, beach))));
    } else {
      skipped.push(`${path.relative(process.cwd(), file)}:${beach.slug ?? 'unknown'}`);
    }
  }
}

for (const draft of skipped) {
  console.log(`Skipping incomplete candidate ${draft}`);
}

if (rows.length === 0) {
  throw new Error('No complete beach records found');
}

const values = rows.map((row) => `  (${row.join(', ')})`).join(',\n');
const sql = `-- Generated from data/**/beaches.json. Do not edit by hand.
BEGIN TRANSACTION;

INSERT INTO beaches (
  ${COLUMN_NAMES.join(',\n  ')}
) VALUES
${values}
ON CONFLICT(slug) DO UPDATE SET
${UPDATE_COLUMNS.map((name) => `  ${name} = excluded.${name}`).join(',\n')},
  updated_at = CURRENT_TIMESTAMP;

COMMIT;
`;

await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
await writeFile(OUTPUT_FILE, sql, 'utf8');
console.log(`Generated ${path.relative(process.cwd(), OUTPUT_FILE)} with ${rows.length} beach record(s).`);
