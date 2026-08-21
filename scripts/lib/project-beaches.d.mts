// Just enough of project-beaches.mjs for its one TypeScript consumer, test/import.test.ts.
// The Node scripts import the .mjs directly.

export interface BeachScope {
  countryCode: string;
  countryName: string;
  region: string;
  municipality: string;
}

export interface BeachCandidate {
  slug: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  dressCode: string | null;
  recognition: string | null;
  confidence: string | null;
  summary: string | null;
  facilities: string[];
  sourceUrl: string | null;
  lastVerifiedAt: string | null;
  published: boolean;
}

export interface BeachFile {
  path: string;
  data: {
    schemaVersion: number;
    scope: BeachScope;
    beaches: BeachCandidate[];
  };
}

export const MAX_STATEMENT_BYTES: number;
export function renderImportStatements(files: BeachFile[]): string[];
