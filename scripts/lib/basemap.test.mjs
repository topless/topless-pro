import { describe, expect, it } from 'vitest';
import { decodeRing, encodeRing, project, QUANTUM, tileBounds, tileId, tileIndex, unproject } from '../../shared/basemap.mjs';
import { buildTiles, clipRing, topologyRings } from './basemap.mjs';

const square = (west, south, east, north) => [
  [west, south], [east, south], [east, north], [west, north], [west, south],
];

describe('projection', () => {
  it('round-trips through the unit square and clamps the poles', () => {
    const [u, v] = project(23.7, 37.9);
    const [longitude, latitude] = unproject(u, v);
    expect(longitude).toBeCloseTo(23.7, 9);
    expect(latitude).toBeCloseTo(37.9, 9);
    expect(project(0, 0)).toEqual([0.5, 0.5]);
    expect(project(-180, 90)[1]).toBeCloseTo(0, 9);
    expect(project(180, -90)[1]).toBeCloseTo(1, 9);
  });
});

describe('ring encoding', () => {
  it('delta-encodes on the grid, drops the closing point and decodes back within one cell', () => {
    const ring = [[20, 36], [24, 36], [24, 40], [20, 40], [20, 36]];
    const encoded = encodeRing(ring);
    expect(encoded).toHaveLength(8);
    const decoded = decodeRing(encoded);
    for (let i = 0; i < 4; i += 1) {
      const [u, v] = project(ring[i][0], ring[i][1]);
      expect(Math.abs(decoded[i * 2] - u)).toBeLessThan(1 / QUANTUM);
      expect(Math.abs(decoded[i * 2 + 1] - v)).toBeLessThan(1 / QUANTUM);
    }
  });

  it('collapses rings smaller than a grid cell to null', () => {
    const tiny = 1e-7;
    expect(encodeRing([[20, 36], [20 + tiny, 36], [20, 36 + tiny], [20, 36]])).toBeNull();
  });
});

describe('clipRing', () => {
  it('keeps rings inside the rectangle and discards rings outside it', () => {
    const inside = square(21, 37, 22, 38);
    expect(clipRing(inside, [20, 36, 24, 40])).toEqual(inside);
    expect(clipRing(square(30, 37, 31, 38), [20, 36, 24, 40])).toEqual([]);
  });

  it('cuts a ring that straddles an edge along that edge', () => {
    const clipped = clipRing(square(22, 37, 26, 38), [20, 36, 24, 40]);
    expect(clipped.every(([x]) => x <= 24)).toBe(true);
    expect(clipped.some(([x]) => x === 24)).toBe(true);
    expect(Math.min(...clipped.map(([x]) => x))).toBe(22);
  });

  it('turns a ring that surrounds the rectangle into the rectangle', () => {
    const clipped = clipRing(square(0, 0, 50, 50), [20, 36, 24, 40]);
    expect(clipped).toHaveLength(4);
    expect(new Set(clipped.map(([x]) => x))).toEqual(new Set([20, 24]));
    expect(new Set(clipped.map(([, y]) => y))).toEqual(new Set([36, 40]));
  });
});

describe('tiles', () => {
  it('addresses the four-degree grid from the south-west corner', () => {
    expect(tileIndex(20.1, 36.5)).toEqual([50, 31]);
    expect(tileBounds(50, 31)).toEqual([20, 34, 24, 38]);
    expect(tileId(50, 31)).toBe('50_31');
    // The far edges belong to the last tile rather than a non-existent next one.
    expect(tileIndex(180, 90)).toEqual([89, 44]);
  });

  it('produces tiles only where a coastline vertex falls', () => {
    // An island entirely inside one tile, and a continent that covers that tile's
    // eastern neighbour without having a vertex there.
    const island = square(21, 35, 22, 36);
    const continent = square(23, 30, 60, 60);
    const tiles = buildTiles([island, continent]);
    expect(tiles.has('50_31')).toBe(true);
    expect(tiles.get('50_31')).toHaveLength(2);
    expect(tiles.has('51_31')).toBe(false);
    expect(tiles.has('50_30')).toBe(true);
    for (const id of tiles.keys()) expect(id).toMatch(/^\d+_\d+$/);
  });
});

describe('topologyRings', () => {
  it('decodes quantised arcs, reverses negative references and joins shared end points', () => {
    const topology = {
      transform: { scale: [1, 1], translate: [10, 20] },
      arcs: [
        [[0, 0], [2, 0]],
        [[2, 0], [0, 2], [-2, 0]],
      ],
      objects: {
        land: {
          geometries: [
            { type: 'Polygon', arcs: [[0, 1]] },
            { type: 'MultiPolygon', arcs: [[[~1, ~0]]] },
          ],
        },
      },
    };
    const [forward, backward] = topologyRings(topology);
    expect(forward).toEqual([[10, 20], [12, 20], [12, 22], [10, 22]]);
    expect(backward).toEqual([[10, 22], [12, 22], [12, 20], [10, 20]]);
  });
});
