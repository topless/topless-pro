import { decodeRing, project, tileBounds, tileIndex, unproject } from '../../shared/basemap.mjs';

// Loads the coastline files that scripts/build-basemap.mjs generates into public/basemap/.
// Everything is fetched from this origin, decoded once and kept for the page's lifetime; the
// map component asks synchronously (peek…) for whatever has arrived and draws that.
export const BASEMAP_PATH = '/basemap/v1';

export interface Ring {
  /** [u0, v0, u1, v1, …] on the unit-square Mercator plane. */
  points: Float64Array;
  /** [west, north, east, south] in unit coordinates, for culling. */
  bounds: [number, number, number, number];
}

export interface Layer {
  rings: Ring[];
}

export interface World extends Layer {
  /** Ids of the detail tiles that exist. */
  tiles: Set<string>;
}

interface EncodedLayer {
  rings: number[][];
  tiles?: string[];
}

const loaded = new Map<string, Layer>();
const pending = new Map<string, Promise<Layer>>();

function decodeLayer(file: EncodedLayer): Layer {
  const rings = file.rings.map((encoded): Ring => {
    const points = decodeRing(encoded);
    let west = Infinity;
    let north = Infinity;
    let east = -Infinity;
    let south = -Infinity;
    for (let i = 0; i < points.length; i += 2) {
      const u = points[i];
      const v = points[i + 1];
      if (u < west) west = u;
      if (u > east) east = u;
      if (v < north) north = v;
      if (v > south) south = v;
    }
    return { points, bounds: [west, north, east, south] };
  });
  return { rings };
}

function load(name: string): Promise<Layer> {
  const ready = loaded.get(name);
  if (ready) return Promise.resolve(ready);
  const inFlight = pending.get(name);
  if (inFlight) return inFlight;

  const request = fetch(`${BASEMAP_PATH}/${name}`)
    .then(async (response) => {
      if (!response.ok) throw new Error(`Unable to load basemap ${name}`);
      const file = (await response.json()) as EncodedLayer;
      const layer = decodeLayer(file);
      if (file.tiles) (layer as World).tiles = new Set(file.tiles);
      loaded.set(name, layer);
      return layer;
    })
    .finally(() => {
      pending.delete(name);
    });
  pending.set(name, request);
  return request;
}

export const loadWorld = (): Promise<World> => load('world.json') as Promise<World>;
export const peekWorld = (): World | undefined => loaded.get('world.json') as World | undefined;
export const loadDetail = (): Promise<Layer> => load('detail.json');
export const peekDetail = (): Layer | undefined => loaded.get('detail.json');
export const loadTile = (id: string): Promise<Layer> => load(`tiles/${id}.json`);
export const peekTile = (id: string): Layer | undefined => loaded.get(`tiles/${id}.json`);

/** Ids of the existing detail tiles that intersect a viewport given as [west, north, east, south]. */
export function tilesInView([u0, v0, u1, v1]: readonly [number, number, number, number], available: Set<string>): string[] {
  const [west, south] = unproject(Math.max(u0, 0), Math.min(v1, 1));
  const [east, north] = unproject(Math.min(u1, 1), Math.max(v0, 0));
  const [firstColumn, firstRow] = tileIndex(west, south);
  const [lastColumn, lastRow] = tileIndex(east, north);
  const ids: string[] = [];
  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      const id = `${column}_${row}`;
      if (available.has(id)) ids.push(id);
    }
  }
  return ids;
}

/** A tile's extent as [west, north, east, south] in unit coordinates. */
export function tileRect(id: string): [number, number, number, number] {
  const [column, row] = id.split('_').map(Number);
  const [west, south, east, north] = tileBounds(column, row);
  const [u0, v0] = project(west, north);
  const [u1, v1] = project(east, south);
  return [u0, v0, u1, v1];
}

/** Test hook. */
export function resetBasemapCache(): void {
  loaded.clear();
  pending.clear();
}
