// Turns Natural Earth land polygons (as shipped by the world-atlas package, TopoJSON) into
// the site's basemap files: one world layer, one country-level layer and a grid of detail
// tiles for close zooms. Pure functions; build-basemap.mjs does the file I/O.
import { encodeRing, tileBounds, tileId, tileIndex, TILE_DEGREES } from '../../shared/basemap.mjs';

/** Every ring of a TopoJSON topology's `land` object as [longitude, latitude][] arrays. */
export function topologyRings(topology) {
  const { scale, translate } = topology.transform;
  const arcs = topology.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map(([dx, dy]) => {
      x += dx;
      y += dy;
      return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
    });
  });

  const rings = [];
  for (const geometry of topology.objects.land.geometries) {
    const polygons = geometry.type === 'MultiPolygon' ? geometry.arcs : [geometry.arcs];
    for (const polygon of polygons) {
      for (const ringArcs of polygon) {
        const ring = [];
        for (const index of ringArcs) {
          const arc = index < 0 ? arcs[~index].slice().reverse() : arcs[index];
          // Consecutive arcs share their end point.
          ring.push(...(ring.length ? arc.slice(1) : arc));
        }
        rings.push(ring);
      }
    }
  }
  return rings;
}

export function ringBounds(ring) {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [x, y] of ring) {
    if (x < west) west = x;
    if (x > east) east = x;
    if (y < south) south = y;
    if (y > north) north = y;
  }
  return [west, south, east, north];
}

function intersect(a, b, edge) {
  const [ax, ay] = a;
  const [bx, by] = b;
  if (edge.axis === 0) {
    const t = (edge.value - ax) / (bx - ax);
    return [edge.value, ay + t * (by - ay)];
  }
  const t = (edge.value - ay) / (by - ay);
  return [ax + t * (bx - ax), edge.value];
}

/**
 * Sutherland–Hodgman: clip a closed ring to a rectangle [west, south, east, north].
 * Returns [] when nothing is inside; a ring that surrounds the rectangle becomes the
 * rectangle itself. Concave rings can come back with zero-width slivers along the
 * rectangle's edges — harmless for filled rendering, which is all the tiles are for.
 */
export function clipRing(ring, [west, south, east, north]) {
  const edges = [
    { axis: 0, value: west, inside: (p) => p[0] >= west },
    { axis: 0, value: east, inside: (p) => p[0] <= east },
    { axis: 1, value: south, inside: (p) => p[1] >= south },
    { axis: 1, value: north, inside: (p) => p[1] <= north },
  ];
  let output = ring;
  for (const edge of edges) {
    if (output.length === 0) break;
    const input = output;
    output = [];
    let previous = input[input.length - 1];
    let previousInside = edge.inside(previous);
    for (const current of input) {
      const currentInside = edge.inside(current);
      if (currentInside) {
        if (!previousInside) output.push(intersect(previous, current, edge));
        output.push(current);
      } else if (previousInside) {
        output.push(intersect(previous, current, edge));
      }
      previous = current;
      previousInside = currentInside;
    }
  }
  return output.length >= 3 ? output : [];
}

/** Encode a whole layer, dropping rings below the grid's resolution. */
export function encodeLayer(rings) {
  return rings.map(encodeRing).filter((ring) => ring !== null);
}

/**
 * Cut rings into the detail grid. A tile is produced only where the coastline actually
 * runs — where at least one vertex falls inside it — so open sea and continental interiors
 * are left to the coarser layers, which show the same thing there. Tiles beyond the
 * projection's latitude limit are skipped.
 */
export function buildTiles(rings) {
  const columns = 360 / TILE_DEGREES;
  const rows = 180 / TILE_DEGREES;
  const touched = new Set();
  for (const ring of rings) {
    for (const [longitude, latitude] of ring) {
      const [column, row] = tileIndex(longitude, latitude);
      touched.add(tileId(column, row));
    }
  }

  const tiles = new Map();
  for (const ring of rings) {
    const [west, south, east, north] = ringBounds(ring);
    const [firstColumn, firstRow] = tileIndex(west, south);
    const [lastColumn, lastRow] = tileIndex(east, north);
    for (let row = firstRow; row <= lastRow && row < rows; row += 1) {
      const bounds = tileBounds(0, row);
      if (bounds[1] >= 86 || bounds[3] <= -86) continue;
      for (let column = firstColumn; column <= lastColumn && column < columns; column += 1) {
        const id = tileId(column, row);
        if (!touched.has(id)) continue;
        const clipped = clipRing(ring, tileBounds(column, row));
        if (clipped.length === 0) continue;
        const encoded = encodeRing(clipped);
        if (encoded === null) continue;
        if (!tiles.has(id)) tiles.set(id, []);
        tiles.get(id).push(encoded);
      }
    }
  }
  return tiles;
}
