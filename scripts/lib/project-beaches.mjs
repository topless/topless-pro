// Projection of candidate records (data/**/beaches.json) into D1 statements, and the
// comparison of that projection with what a database currently holds.
//
// Deliberately free of filesystem and process access: the workerd tests import this
// module and execute exactly the SQL the importer ships, and the plan script uses the
// same comparison the deploy job prints before an import.

// Fields that must be filled before a candidate can be projected into D1.
// slug and name are hard-validated separately: they may never be null.
export const REQUIRED_D1_FIELDS = [
  'latitude',
  'longitude',
  'dressCode',
  'recognition',
  'confidence',
];

// Single source of truth for the projected columns: name in D1 paired with how its
// value derives from a candidate record. The slug is the primary key.
const COLUMNS = [
  ['slug', (scope, beach) => beach.slug],
  ['name', (scope, beach) => beach.name],
  ['country_code', (scope) => scope.countryCode],
  ['country_name', (scope) => scope.countryName],
  ['region', (scope) => scope.region],
  ['municipality', (scope, beach) => beach.municipality ?? null],
  ['latitude', (scope, beach) => beach.latitude],
  ['longitude', (scope, beach) => beach.longitude],
  ['dress_code', (scope, beach) => beach.dressCode],
  ['recognition', (scope, beach) => beach.recognition],
  ['confidence', (scope, beach) => beach.confidence],
  ['summary', (scope, beach) => beach.summary],
  ['facilities_json', (scope, beach) => JSON.stringify(beach.facilities)],
  ['source_url', (scope, beach) => beach.sourceUrl],
  ['last_verified_at', (scope, beach) => beach.lastVerifiedAt],
  ['published', (scope, beach) => (beach.published ? 1 : 0)],
];
export const COLUMN_NAMES = COLUMNS.map(([name]) => name);
const UPDATE_COLUMNS = COLUMN_NAMES.filter((name) => name !== 'slug');

// D1 rejects any single statement over 100,000 bytes. Chunks are measured in exact UTF-8
// bytes but capped at half that to leave headroom, since the import endpoint's own
// accounting is not documented. A single row larger than the limit still has to become
// its own chunk, which is what assertStatementSize catches.
export const MAX_STATEMENT_BYTES = 100_000;
const STATEMENT_BYTE_BUDGET = 50_000;

const encoder = new TextEncoder();

function byteLength(text) {
  return encoder.encode(text).length;
}

function isComplete(beach) {
  return REQUIRED_D1_FIELDS.every((field) => beach[field] !== null && beach[field] !== undefined);
}

function projectRow(scope, beach) {
  const row = {};
  for (const [name, value] of COLUMNS) {
    row[name] = value(scope, beach);
  }
  return row;
}

function sqlValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

/**
 * Walks every candidate file. Complete candidates become rows; incomplete ones are
 * listed as drafts. `slugs` holds every slug in data/, drafts included, because a
 * published row whose record is temporarily incomplete must not be unpublished.
 * A record without a slug is refused outright: a NULL inside the unpublish list would
 * silently turn that statement into a no-op.
 */
export function collectCandidates(files) {
  const rows = [];
  const drafts = [];
  const slugs = [];

  for (const { path, data } of files) {
    for (const beach of data.beaches) {
      if (typeof beach.slug !== 'string' || beach.slug === '') {
        throw new Error(`${path}: a candidate without a slug cannot be projected`);
      }
      slugs.push(beach.slug);
      if (isComplete(beach)) {
        rows.push(projectRow(data.scope, beach));
      } else {
        drafts.push(`${path}:${beach.slug}`);
      }
    }
  }

  return { rows, drafts, slugs };
}

function renderRow(row) {
  return `  (${COLUMN_NAMES.map((name) => sqlValue(row[name])).join(', ')})`;
}

function assertStatementSize(statement, what) {
  const size = byteLength(statement);
  if (size > MAX_STATEMENT_BYTES) {
    throw new Error(
      `${what} is ${size} bytes, over D1's ${MAX_STATEMENT_BYTES}-byte statement limit`,
    );
  }
}

function renderInsert(renderedRows) {
  // Rows whose content is unchanged are left alone, so updated_at (and the sitemap
  // lastmod derived from it) only moves when something about the beach changed.
  // IS NOT compares NULLs the way an editor expects.
  return [
    'INSERT INTO beaches (',
    `  ${COLUMN_NAMES.join(',\n  ')}`,
    ') VALUES',
    renderedRows.join(',\n'),
    'ON CONFLICT(slug) DO UPDATE SET',
    UPDATE_COLUMNS.map((name) => `  ${name} = excluded.${name}`).join(',\n') + ',',
    '  updated_at = CURRENT_TIMESTAMP',
    `WHERE ${UPDATE_COLUMNS.map((name) => `beaches.${name} IS NOT excluded.${name}`).join('\n   OR ')};`,
  ].join('\n');
}

/**
 * The statements that bring D1 in line with data/: chunked upserts for every complete
 * candidate, then one UPDATE that unpublishes rows whose slug is no longer in data/.
 * Nothing is ever deleted by the importer; a listing that should disappear is
 * unpublished here and removed by hand once its reports are resolved.
 */
export function renderImportStatements(files) {
  const { rows, slugs } = collectCandidates(files);
  if (rows.length === 0) {
    throw new Error('No complete beach records found');
  }

  const statements = [];
  let chunk = [];
  for (const row of rows) {
    const rendered = renderRow(row);
    if (chunk.length > 0 && byteLength(renderInsert([...chunk, rendered])) > STATEMENT_BYTE_BUDGET) {
      statements.push(renderInsert(chunk));
      chunk = [];
    }
    chunk.push(rendered);
  }
  statements.push(renderInsert(chunk));
  statements.forEach((statement, index) => assertStatementSize(statement, `INSERT chunk ${index + 1}`));

  const unpublish = [
    'UPDATE beaches SET published = 0, updated_at = CURRENT_TIMESTAMP',
    'WHERE published = 1',
    `  AND slug NOT IN (${slugs.map(sqlValue).join(', ')});`,
  ].join('\n');
  // One statement must name every slug in data/; at a few thousand beaches this
  // needs a staging table instead. Fail loudly rather than unpublish the wrong rows.
  assertStatementSize(unpublish, 'The unpublish statement');
  statements.push(unpublish);

  return statements;
}

/**
 * The file handed to `wrangler d1 execute --file`. No transaction wrapper: the remote
 * import endpoint rejects BEGIN/COMMIT and applies the whole file atomically itself
 * (the local path strips them, which is how the wrapper went unnoticed).
 */
export function composeImportSql(statements) {
  return `-- Generated from data/**/beaches.json. Do not edit by hand.\n\n${statements.join('\n\n')}\n`;
}

/**
 * Compares the projection of data/ with the rows a database holds. `existing` rows
 * carry the D1 column names and D1's values (NULL as null, published as 0/1). Drafts
 * are reported but never counted as orphans.
 */
export function diffProjection(files, existing) {
  const { rows, drafts, slugs } = collectCandidates(files);
  const known = new Set(slugs);
  const current = new Map(existing.map((row) => [row.slug, row]));

  const added = [];
  const changed = [];
  const unchanged = [];

  for (const row of rows) {
    const before = current.get(row.slug);
    if (!before) {
      added.push({ slug: row.slug, published: row.published === 1 });
      continue;
    }
    const fields = UPDATE_COLUMNS
      .filter((column) => before[column] !== row[column])
      .map((column) => ({ column, before: before[column], after: row[column] }));
    if (fields.length === 0) {
      unchanged.push(row.slug);
    } else {
      changed.push({ slug: row.slug, fields });
    }
  }

  const orphaned = existing
    .filter((row) => row.published === 1 && !known.has(row.slug))
    .map((row) => row.slug)
    .sort();

  return { added, changed, unchanged, orphaned, drafts };
}

function describeValue(value) {
  if (value === null) return '—';
  const text = String(value);
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}

/** Markdown summary of a diff, for a terminal or a CI job summary. */
export function renderPlan(diff, { pendingReports = new Map(), target = 'D1' } = {}) {
  const lines = [`## Beach import plan (${target})`, ''];

  lines.push(`- **New:** ${diff.added.length}`);
  for (const item of diff.added) {
    lines.push(`  - \`${item.slug}\`${item.published ? ' (published)' : ' (unpublished)'}`);
  }
  lines.push(`- **Changed:** ${diff.changed.length}`);
  for (const item of diff.changed) {
    lines.push(`  - \`${item.slug}\``);
    for (const field of item.fields) {
      lines.push(`    - ${field.column}: ${describeValue(field.before)} → ${describeValue(field.after)}`);
    }
  }
  lines.push(`- **Unchanged:** ${diff.unchanged.length}`);
  lines.push(`- **Will unpublish (no longer in data/):** ${diff.orphaned.length}`);
  for (const slug of diff.orphaned) {
    const pending = pendingReports.get(slug) ?? 0;
    lines.push(`  - \`${slug}\`${pending > 0 ? ` — ${pending} pending report(s)` : ''}`);
  }
  lines.push(`- **Drafts skipped (incomplete):** ${diff.drafts.length}`);
  for (const draft of diff.drafts) {
    lines.push(`  - ${draft}`);
  }

  return `${lines.join('\n')}\n`;
}
