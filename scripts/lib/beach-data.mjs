import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

export { REQUIRED_D1_FIELDS } from './project-beaches.mjs';

export const DATA_ROOT = path.join(process.cwd(), 'data');
export const SCHEMA_FILE = path.join(DATA_ROOT, 'beaches.schema.json');

export async function findBeachFiles(root = DATA_ROOT) {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name === 'beaches.json')
    .map((entry) => path.join(entry.parentPath, entry.name))
    .sort();
}

/** Every candidate file, parsed. `path` is repo-relative for messages; `file` is absolute. */
export async function loadBeachFiles(root = DATA_ROOT) {
  const files = await findBeachFiles(root);
  return Promise.all(files.map(async (file) => ({
    file,
    path: path.relative(process.cwd(), file).split(path.sep).join('/'),
    data: JSON.parse(await readFile(file, 'utf8')),
  })));
}
