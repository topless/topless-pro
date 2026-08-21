import { readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

export const DATA_ROOT = path.join(process.cwd(), 'data');

// Fields that must be filled before a candidate can be projected into D1.
// slug and name are hard-validated separately: they may never be null.
export const REQUIRED_D1_FIELDS = [
  'latitude',
  'longitude',
  'dressCode',
  'recognition',
  'confidence',
];

export async function findBeachFiles(root = DATA_ROOT) {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name === 'beaches.json')
    .map((entry) => path.join(entry.parentPath, entry.name))
    .sort();
}
