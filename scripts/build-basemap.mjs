// Generates public/basemap/ from Natural Earth land polygons (public domain), as packaged
// by world-atlas. Output is not committed: `prebuild` and `predev` run this, and it is a
// no-op while the recorded source version and format match. `--force` regenerates.
import { createRequire } from 'node:module';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { buildTiles, encodeLayer, topologyRings } from './lib/basemap.mjs';

const require = createRequire(import.meta.url);
const FORMAT = 1;
// The version segment is the format's; the page fetches BASEMAP_PATH (src/lib/basemap.ts)
// and the Worker caches everything under /basemap/ for a month, so a format change bumps both.
const OUTPUT_ROOT = path.join(process.cwd(), 'public', 'basemap');
const OUTPUT_DIR = path.join(OUTPUT_ROOT, `v${FORMAT}`);
const worldAtlasVersion = require('world-atlas/package.json').version;
const meta = {
  format: FORMAT,
  source: `Natural Earth land, via world-atlas ${worldAtlasVersion}`,
  licence: 'Natural Earth data is in the public domain',
};

const force = process.argv.includes('--force');
if (!force) {
  try {
    const existing = JSON.parse(await readFile(path.join(OUTPUT_DIR, 'world.json'), 'utf8'));
    if (existing.meta?.format === meta.format && existing.meta?.source === meta.source) {
      console.log(`Basemap is current (${meta.source}).`);
      process.exit(0);
    }
  } catch {
    // Missing or unreadable: regenerate.
  }
}

const started = Date.now();
await rm(OUTPUT_ROOT, { recursive: true, force: true });
await mkdir(path.join(OUTPUT_DIR, 'tiles'), { recursive: true });

const tiles = buildTiles(topologyRings(require('world-atlas/land-10m.json')));
let tileBytes = 0;
for (const [id, rings] of tiles) {
  const body = JSON.stringify({ rings });
  tileBytes += body.length;
  await writeFile(path.join(OUTPUT_DIR, 'tiles', `${id}.json`), body, 'utf8');
}

const world = JSON.stringify({
  meta,
  rings: encodeLayer(topologyRings(require('world-atlas/land-110m.json'))),
  tiles: [...tiles.keys()].sort(),
});
await writeFile(path.join(OUTPUT_DIR, 'world.json'), world, 'utf8');

const detail = JSON.stringify({ rings: encodeLayer(topologyRings(require('world-atlas/land-50m.json'))) });
await writeFile(path.join(OUTPUT_DIR, 'detail.json'), detail, 'utf8');

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log(
  `Generated ${path.relative(process.cwd(), OUTPUT_DIR)} in ${((Date.now() - started) / 1000).toFixed(1)}s: `
  + `world ${kb(world.length)}, detail ${kb(detail.length)}, ${tiles.size} tiles ${kb(tileBytes)} (${meta.source}).`,
);
