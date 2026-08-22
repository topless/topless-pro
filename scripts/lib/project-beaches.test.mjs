import { describe, expect, it } from 'vitest';
import {
  diffProjection,
  renderImportStatements,
  renderPlan,
} from './project-beaches.mjs';

const scope = { countryCode: 'GR', countryName: 'Greece', region: 'Chalkidiki', municipality: 'Sithonia' };

function candidate(overrides = {}) {
  return {
    slug: 'sarti',
    name: 'Sarti',
    latitude: 40.0894624,
    longitude: 23.9791046,
    dressCode: 'topless-permitted',
    recognition: 'tolerated',
    confidence: 'medium',
    summary: null,
    facilities: [],
    sourceUrl: null,
    lastVerifiedAt: null,
    published: false,
    ...overrides,
  };
}

function file(beaches) {
  return { path: 'data/gr/chalkidiki/sithonia/beaches.json', data: { schemaVersion: 1, scope, beaches } };
}

function existingRow(overrides = {}) {
  return {
    slug: 'sarti',
    name: 'Sarti',
    country_code: 'GR',
    country_name: 'Greece',
    region: 'Chalkidiki',
    municipality: 'Sithonia',
    latitude: 40.0894624,
    longitude: 23.9791046,
    dress_code: 'topless-permitted',
    recognition: 'tolerated',
    confidence: 'medium',
    summary: null,
    facilities_json: '[]',
    source_url: null,
    last_verified_at: null,
    published: 0,
    updated_at: '2026-08-01 00:00:00',
    ...overrides,
  };
}

describe('renderImportStatements', () => {
  it('refuses to produce a file with nothing to import', () => {
    expect(() => renderImportStatements([file([candidate({ latitude: null })])])).toThrow('No complete beach records');
  });

  it('refuses a candidate without a slug rather than emitting a NULL in the unpublish list', () => {
    const beaches = [candidate(), { ...candidate({ name: 'No slug' }), slug: undefined }];
    expect(() => renderImportStatements([file(beaches)])).toThrow('without a slug');
  });
});

describe('diffProjection', () => {
  it('classifies rows as added, changed, unchanged or orphaned', () => {
    const diff = diffProjection(
      [file([
        candidate(),
        candidate({ slug: 'toroni', name: 'Toroni', dressCode: 'clothing-optional', published: true, summary: 'Mixed use.', sourceUrl: 'https://example.org/t', lastVerifiedAt: '2026-08-01' }),
        candidate({ slug: 'new-cove', name: 'New Cove' }),
        candidate({ slug: 'draft', name: 'Draft', confidence: null }),
      ])],
      [
        existingRow(),
        existingRow({ slug: 'toroni', name: 'Toroni', dress_code: 'clothing-optional' }),
        existingRow({ slug: 'gone', name: 'Gone', published: 1 }),
        existingRow({ slug: 'gone-but-unpublished', name: 'Gone', published: 0 }),
        existingRow({ slug: 'draft', name: 'Draft', published: 1 }),
      ],
    );

    expect(diff.unchanged).toEqual(['sarti']);
    expect(diff.added).toEqual([{ slug: 'new-cove', published: false }]);
    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0].slug).toBe('toroni');
    expect(diff.changed[0].fields.map((field) => field.column).sort()).toEqual(
      ['last_verified_at', 'published', 'source_url', 'summary'],
    );
    expect(diff.orphaned).toEqual(['gone']);
    expect(diff.drafts).toEqual(['data/gr/chalkidiki/sithonia/beaches.json:draft']);
  });
});

describe('renderPlan', () => {
  it('lists counts, field changes and pending reports on rows to be unpublished', () => {
    const plan = renderPlan({
      added: [{ slug: 'new-cove', published: false }],
      changed: [{ slug: 'toroni', fields: [{ column: 'published', before: 0, after: 1 }] }],
      unchanged: ['sarti'],
      orphaned: ['gone'],
      drafts: [],
    }, { pendingReports: new Map([['gone', 2]]), target: 'production' });

    expect(plan).toContain('## Beach import plan (production)');
    expect(plan).toContain('- **New:** 1\n  - `new-cove` (unpublished)');
    expect(plan).toContain('- published: 0 → 1');
    expect(plan).toContain('- `gone` — 2 pending report(s)');
    expect(plan).toContain('- **Unchanged:** 1');
  });
});
