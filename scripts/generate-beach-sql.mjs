import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { loadBeachFiles } from './lib/beach-data.mjs';
import { collectCandidates, composeImportSql, renderImportStatements } from './lib/project-beaches.mjs';

// Meant to run via data:sql, which validates first. The projection itself lives in
// lib/project-beaches.mjs so the tests execute the same statements this file writes.
const OUTPUT_FILE = path.join(process.cwd(), '.wrangler', 'imports', 'beaches.sql');

const files = await loadBeachFiles();
const { rows, drafts } = collectCandidates(files);
for (const draft of drafts) {
  console.log(`Skipping incomplete candidate ${draft}`);
}

const statements = renderImportStatements(files);
await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
await writeFile(OUTPUT_FILE, composeImportSql(statements), 'utf8');
console.log(
  `Generated ${path.relative(process.cwd(), OUTPUT_FILE)} with ${rows.length} beach record(s) `
  + `in ${statements.length} statement(s).`,
);
