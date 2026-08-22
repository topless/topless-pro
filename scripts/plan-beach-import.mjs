import { execFileSync } from 'node:child_process';
import { appendFile } from 'node:fs/promises';
import process from 'node:process';
import { loadBeachFiles } from './lib/beach-data.mjs';
import { COLUMN_NAMES, diffProjection, renderPlan } from './lib/project-beaches.mjs';

// Prints what importing data/ would change in a D1 database, without touching it:
// new, changed (field by field), unchanged, rows that would be unpublished because
// their slug left data/ (with their pending report counts), and drafts skipped.
// Reads only beach rows and report counts — never a report's text or email.

const args = new Set(process.argv.slice(2));
const TARGETS = {
  '--local': { flags: ['--local'], label: 'local' },
  '--preview': { flags: ['--remote', '--preview'], label: 'preview' },
  '--remote': { flags: ['--remote'], label: 'production' },
};
const target = Object.keys(TARGETS).find((flag) => args.has(flag));
if (!target) {
  console.error('Usage: node scripts/plan-beach-import.mjs --local | --preview | --remote');
  process.exit(2);
}

function query(sql) {
  const output = execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', 'DB', ...TARGETS[target].flags, '--json', '--command', sql],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
  );
  const [first] = JSON.parse(output);
  return first.results;
}

const files = await loadBeachFiles();
const existing = query(`SELECT ${COLUMN_NAMES.join(', ')}, updated_at FROM beaches`);
const pendingReports = new Map(
  query(
    "SELECT beach_slug, count(*) AS n FROM submissions WHERE status = 'pending' AND beach_slug IS NOT NULL GROUP BY beach_slug",
  ).map((row) => [row.beach_slug, row.n]),
);

const diff = diffProjection(files, existing);
const plan = renderPlan(diff, { pendingReports, target: TARGETS[target].label });
process.stdout.write(plan);
if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, plan);
}
// Lets the deploy job skip the import when there is nothing to change.
if (process.env.GITHUB_OUTPUT) {
  const changes = diff.added.length + diff.changed.length + diff.orphaned.length;
  await appendFile(process.env.GITHUB_OUTPUT, `changes=${changes}\n`);
}
