import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

// Writes the production tables as JSON to backups/<timestamp>/ on this machine.
// Beaches are rebuildable from data/; submissions are the state that exists nowhere
// else. The email column is deliberately left out — a backup must not become a second
// place where a reporter's address lives. backups/ is gitignored; never upload it.
const TABLES = {
  beaches: 'SELECT * FROM beaches',
  submissions: 'SELECT id, kind, beach_slug, message, status, reviewed_at, resolution, github_issue, created_at FROM submissions',
};

function query(sql) {
  const output = execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', 'DB', '--remote', '--json', '--command', sql],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
  );
  const [first] = JSON.parse(output);
  return first.results;
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const directory = path.join(process.cwd(), 'backups', stamp);
await mkdir(directory, { recursive: true });

for (const [table, sql] of Object.entries(TABLES)) {
  const rows = query(sql);
  await writeFile(path.join(directory, `${table}.json`), `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
  console.log(`${table}: ${rows.length} row(s)`);
}
console.log(`Written to ${path.relative(process.cwd(), directory)}/`);
