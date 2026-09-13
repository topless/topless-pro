import { afterEach, describe, expect, it, vi } from 'vitest';
import { encodeRing, project } from '../../shared/basemap.mjs';
import { loadTile, loadWorld, peekWorld, resetBasemapCache, tileRect, tilesInView } from './basemap';

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: () => Promise.resolve(body) } as Response;
}

describe('basemap loader', () => {
  afterEach(() => {
    resetBasemapCache();
    vi.unstubAllGlobals();
  });

  it('fetches a layer once, decodes its rings with bounds and remembers which tiles exist', async () => {
    const square = encodeRing([[20, 36], [24, 36], [24, 40], [20, 40], [20, 36]]);
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ rings: [square], tiles: ['50_31'] }));
    vi.stubGlobal('fetch', fetchMock);

    expect(peekWorld()).toBeUndefined();
    const [world, again] = await Promise.all([loadWorld(), loadWorld()]);
    expect(again).toBe(world);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/basemap/v1/world.json');
    expect(peekWorld()).toBe(world);
    expect(world.tiles).toEqual(new Set(['50_31']));

    const [ring] = world.rings;
    expect(ring.points).toHaveLength(8);
    const [west, north] = project(20, 40);
    const [east, south] = project(24, 36);
    expect(ring.bounds[0]).toBeCloseTo(west, 5);
    expect(ring.bounds[1]).toBeCloseTo(north, 5);
    expect(ring.bounds[2]).toBeCloseTo(east, 5);
    expect(ring.bounds[3]).toBeCloseTo(south, 5);
  });

  it('does not cache a failed load', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(null, false))
      .mockResolvedValueOnce(jsonResponse({ rings: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(loadTile('50_31')).rejects.toThrow('Unable to load basemap tiles/50_31.json');
    await expect(loadTile('50_31')).resolves.toEqual({ rings: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('lists the existing tiles under a viewport and places a tile on the plane', () => {
    const available = new Set(['50_31', '50_32', '51_31', '70_10']);
    const [u0, v0] = project(20.5, 41.5);
    const [u1, v1] = project(23.5, 34.5);
    expect(tilesInView([u0, v0, u1, v1], available).sort()).toEqual(['50_31', '50_32']);

    const rect = tileRect('50_31');
    const [west, north] = project(20, 38);
    const [east, south] = project(24, 34);
    expect(rect[0]).toBeCloseTo(west);
    expect(rect[1]).toBeCloseTo(north);
    expect(rect[2]).toBeCloseTo(east);
    expect(rect[3]).toBeCloseTo(south);
  });
});
