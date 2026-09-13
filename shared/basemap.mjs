// The basemap wire format, shared by the generator (scripts/build-basemap.mjs, Node) and
// the map page (browser). Coordinates are Web Mercator on the unit square — u east, v south,
// both in [0, 1] — so the page draws with one multiply per axis and never projects at
// draw time. Rings are stored as flat, delta-encoded integers on a fixed grid.

export const MAX_LATITUDE = 85.05112878;
/** Grid cells per unit-square side: about 38 m at the equator, finer than the data. */
export const QUANTUM = 1 << 20;

const RADIANS = Math.PI / 180;
const DEGREES = 180 / Math.PI;

/** Longitude/latitude in degrees → unit-square Mercator [u, v]. Latitude is clamped to the projection's limit. */
export function project(longitude, latitude) {
  const phi = Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, latitude)) * RADIANS;
  return [
    (longitude + 180) / 360,
    (1 - Math.log(Math.tan(Math.PI / 4 + phi / 2)) / Math.PI) / 2,
  ];
}

/** Unit-square Mercator [u, v] → longitude/latitude in degrees. */
export function unproject(u, v) {
  return [u * 360 - 180, (2 * Math.atan(Math.exp(Math.PI * (1 - 2 * v))) - Math.PI / 2) * DEGREES];
}

/**
 * Encode one closed ring of [longitude, latitude] pairs. The closing point and consecutive
 * duplicates on the grid are dropped; rings with fewer than three distinct grid points
 * (below the resolution of the grid) encode to null.
 */
export function encodeRing(ring) {
  const out = [];
  let previousX = 0;
  let previousY = 0;
  let firstX = 0;
  let firstY = 0;
  let count = 0;
  for (const [longitude, latitude] of ring) {
    const [u, v] = project(longitude, latitude);
    const x = Math.round(u * QUANTUM);
    const y = Math.round(v * QUANTUM);
    if (count > 0 && x === previousX && y === previousY) continue;
    if (count === 0) {
      firstX = x;
      firstY = y;
    }
    out.push(x - previousX, y - previousY);
    previousX = x;
    previousY = y;
    count += 1;
  }
  // Drop an explicit closing point; the consumer closes the ring itself.
  if (count > 1 && previousX === firstX && previousY === firstY) {
    out.length -= 2;
    count -= 1;
  }
  return count >= 3 ? out : null;
}

/** Decode an encoded ring into unit-square coordinates: [u0, v0, u1, v1, …]. */
export function decodeRing(encoded) {
  const points = new Float64Array(encoded.length);
  let x = 0;
  let y = 0;
  for (let i = 0; i < encoded.length; i += 2) {
    x += encoded[i];
    y += encoded[i + 1];
    points[i] = x / QUANTUM;
    points[i + 1] = y / QUANTUM;
  }
  return points;
}

/** Detail tiles are this many degrees on a side, aligned to -180° / -90°. */
export const TILE_DEGREES = 4;

/** Column/row of the detail tile containing a longitude/latitude. */
export function tileIndex(longitude, latitude) {
  return [
    Math.min(Math.floor((longitude + 180) / TILE_DEGREES), 360 / TILE_DEGREES - 1),
    Math.min(Math.floor((latitude + 90) / TILE_DEGREES), 180 / TILE_DEGREES - 1),
  ];
}

export function tileId(column, row) {
  return `${column}_${row}`;
}

/** The tile's extent as [west, south, east, north] in degrees. */
export function tileBounds(column, row) {
  const west = -180 + column * TILE_DEGREES;
  const south = -90 + row * TILE_DEGREES;
  return [west, south, west + TILE_DEGREES, south + TILE_DEGREES];
}
