// Types for project-beaches.mjs, so the workerd tests and any TypeScript caller see the
// same shapes the Node scripts work with.

export interface BeachScope {
  countryCode: string;
  countryName: string;
  region?: string | null;
  municipality?: string | null;
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

export type ProjectedRow = Record<string, string | number | null>;

export interface ProjectionDiff {
  added: Array<{ slug: string; published: boolean }>;
  changed: Array<{ slug: string; fields: Array<{ column: string; before: unknown; after: unknown }> }>;
  unchanged: string[];
  orphaned: string[];
  drafts: string[];
}

export const REQUIRED_D1_FIELDS: readonly string[];
export const COLUMN_NAMES: readonly string[];
export const UPDATE_COLUMNS: readonly string[];
export const MAX_STATEMENT_BYTES: number;
export const DEFAULT_STATEMENT_BYTE_BUDGET: number;

export function isComplete(beach: BeachCandidate): boolean;
export function projectRow(scope: BeachScope, beach: BeachCandidate): ProjectedRow;
export function sqlValue(value: unknown): string;
export function collectCandidates(files: BeachFile[]): { rows: ProjectedRow[]; drafts: string[]; slugs: string[] };
export function renderImportStatements(files: BeachFile[], options?: { byteBudget?: number }): string[];
export function composeImportSql(statements: string[]): string;
export function renderImportSql(files: BeachFile[], options?: { byteBudget?: number }): string;
export function diffProjection(files: BeachFile[], existing: Array<Record<string, unknown>>): ProjectionDiff;
export function renderPlan(diff: ProjectionDiff, options?: { pendingReports?: Map<string, number>; target?: string }): string;
