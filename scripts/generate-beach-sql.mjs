import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DATA_ROOT = path.join(process.cwd(), 'data');
const OUTPUT_FILE = path.join(process.cwd(), '.wrangler', 'imports', 'beaches.sql');
const REQUIRED_FIELDS = [
  'slug',
  'name',
  'latitude',
  'longitude',
  'dressCode',
  'recognition',
  'confidence',
];

async function findBeachFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findBeachFiles(entryPath));
    } else if (entry.isFile() && entry.name === 'beaches.json') {
      files.push(entryPath);
    }
  }

  return files.sort();
}

function sqlValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Cannot write a non-finite number to SQL');
    return String(value);
  }
  if (typeof value === 'boolean') return value ? '1' : '0';
  return `'${String(value).replaceAll("'", "''")}'`;
}

function isComplete(beach) {
  return REQUIRED_FIELDS.every((field) => beach[field] !== null && beach[field] !== undefined);
}

function beachRow(scope, beach) {
  return [
    beach.slug,
    beach.slug,
    beach.name,
    scope.countryCode,
    scope.countryName,
    scope.region ?? null,
    scope.municipality ?? null,
    beach.latitude,
    beach.longitude,
    beach.dressCode,
    beach.recognition,
    beach.confidence,
    beach.summary ?? null,
    JSON.stringify(beach.facilities ?? []),
    beach.sourceUrl ?? null,
    beach.lastVerifiedAt ?? null,
    beach.published ?? false,
  ].map(sqlValue);
}

const files = await findBeachFiles(DATA_ROOT);
const rows = [];
const skipped = [];

for (const file of files) {
  const data = JSON.parse(await readFile(file, 'utf8'));
  for (const beach of data.beaches) {
    if (isComplete(beach)) {
      rows.push(beachRow(data.scope, beach));
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
  id,
  slug,
  name,
  country_code,
  country_name,
  region,
  municipality,
  latitude,
  longitude,
  dress_code,
  recognition,
  confidence,
  summary,
  facilities_json,
  source_url,
  last_verified_at,
  published
) VALUES
${values}
ON CONFLICT(slug) DO UPDATE SET
  name = excluded.name,
  country_code = excluded.country_code,
  country_name = excluded.country_name,
  region = excluded.region,
  municipality = excluded.municipality,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  dress_code = excluded.dress_code,
  recognition = excluded.recognition,
  confidence = excluded.confidence,
  summary = excluded.summary,
  facilities_json = excluded.facilities_json,
  source_url = excluded.source_url,
  last_verified_at = excluded.last_verified_at,
  published = excluded.published,
  updated_at = CURRENT_TIMESTAMP;

COMMIT;
`;

await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
await writeFile(OUTPUT_FILE, sql, 'utf8');
console.log(`Generated ${path.relative(process.cwd(), OUTPUT_FILE)} with ${rows.length} beach record(s).`);
