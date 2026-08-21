import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import {
  MAX_STATEMENT_BYTES,
  renderImportStatements,
  type BeachCandidate,
  type BeachFile,
} from '../scripts/lib/project-beaches.mjs';

// The importer's SQL, executed against the real schema in workerd. Storage is isolated
// per test, so each one starts from the migrations plus the demo fixtures.

const scope = { countryCode: 'GR', countryName: 'Greece', region: 'Chalkidiki', municipality: 'Sithonia' };

function candidate(overrides: Partial<BeachCandidate> = {}): BeachCandidate {
  return {
    slug: 'kavourotrypes',
    name: 'Kavourotrypes',
    latitude: 40.1265909,
    longitude: 23.9693838,
    dressCode: 'nudity-permitted',
    recognition: 'tolerated',
    confidence: 'medium',
    summary: 'Nude bathing is accepted in the small coves at the southern end.',
    facilities: [],
    sourceUrl: 'https://example.org/kavourotrypes-rules',
    lastVerifiedAt: '2026-08-01',
    published: true,
    ...overrides,
  };
}

function file(beaches: BeachCandidate[]): BeachFile {
  return { path: 'data/gr/chalkidiki/sithonia/beaches.json', data: { schemaVersion: 1, scope, beaches } };
}

async function runImport(files: BeachFile[]): Promise<string[]> {
  const statements = renderImportStatements(files);
  await env.DB.batch(statements.map((statement) => env.DB.prepare(statement)));
  return statements;
}

interface StoredBeach {
  slug: string;
  region: string | null;
  summary: string | null;
  published: number;
  updated_at: string;
}

function stored(slug: string): Promise<StoredBeach | null> {
  return env.DB.prepare('SELECT slug, region, summary, published, updated_at FROM beaches WHERE slug = ?')
    .bind(slug)
    .first<StoredBeach>();
}

describe('beach import SQL', () => {
  it('inserts complete candidates with the scope applied and leaves drafts out', async () => {
    const statements = await runImport([
      file([candidate(), candidate({ slug: 'draft-cove', name: 'Draft Cove', dressCode: null })]),
    ]);

    expect(statements.some((statement) => /BEGIN|COMMIT/i.test(statement))).toBe(false);
    const row = await stored('kavourotrypes');
    expect(row).toMatchObject({ region: 'Chalkidiki', published: 1 });
    expect(await stored('draft-cove')).toBeNull();
  });

  it('is idempotent: an identical re-import leaves updated_at alone, a change moves it', async () => {
    await runImport([file([candidate()])]);
    await env.DB.prepare("UPDATE beaches SET updated_at = '2000-01-01 00:00:00' WHERE slug = 'kavourotrypes'").run();

    await runImport([file([candidate()])]);
    expect((await stored('kavourotrypes'))?.updated_at).toBe('2000-01-01 00:00:00');

    await runImport([file([candidate({ summary: 'The coves are signposted now.' })])]);
    const changed = await stored('kavourotrypes');
    expect(changed?.summary).toBe('The coves are signposted now.');
    expect(changed?.updated_at).not.toBe('2000-01-01 00:00:00');
  });

  it('unpublishes rows that left data/, keeps drafts published, and never deletes', async () => {
    await env.DB.prepare(
      "INSERT INTO beaches (slug, name, country_code, country_name, latitude, longitude, dress_code, recognition, confidence, published) VALUES ('draft-cove', 'Draft Cove', 'GR', 'Greece', 40, 23, 'unknown', 'disputed', 'low', 1)",
    ).run();

    await runImport([
      file([candidate(), candidate({ slug: 'draft-cove', name: 'Draft Cove', dressCode: null })]),
    ]);

    // A fixture listing that is not in data/ is unpublished but still present.
    expect((await stored('paradise-beach-mykonos'))?.published).toBe(0);
    // A draft's slug is in data/, so its existing row is left published.
    expect((await stored('draft-cove'))?.published).toBe(1);
    expect((await stored('kavourotrypes'))?.published).toBe(1);
  });

  it('splits a large import into statements under the D1 limit', async () => {
    const beaches = Array.from({ length: 400 }, (_, index) => candidate({
      slug: `cove-${index}`,
      name: `Παραλία ${index}`,
      summary: 'Μια μεγάλη περίληψη για να πιάσει χώρο. '.repeat(8),
    }));

    const statements = await runImport([file(beaches)]);
    const inserts = statements.filter((statement) => statement.startsWith('INSERT'));
    expect(inserts.length).toBeGreaterThan(1);
    for (const statement of statements) {
      expect(new TextEncoder().encode(statement).length).toBeLessThan(MAX_STATEMENT_BYTES);
    }

    const count = await env.DB.prepare("SELECT count(*) AS count FROM beaches WHERE slug LIKE 'cove-%'").first<number>('count');
    expect(count).toBe(400);
  });
});
