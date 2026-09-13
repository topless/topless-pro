import { describe, expect, it } from 'vitest';
import { project } from '../../shared/basemap.mjs';
import {
  clampView,
  clusterPoints,
  fitBounds,
  FOCUS_ZOOM,
  fromScreen,
  MAX_ZOOM,
  MIN_ZOOM,
  panBy,
  toScreen,
  viewAt,
  viewFromParams,
  viewToParams,
  zoomAround,
} from './map-view';

const size = { width: 800, height: 600 };

describe('map view', () => {
  it('maps the centre to the middle of the frame and inverts', () => {
    const view = viewAt(23.7, 37.9, 7);
    expect(toScreen(view, size, view.u, view.v)).toEqual([400, 300]);
    const [u, v] = fromScreen(view, size, 100, 50);
    expect(toScreen(view, size, u, v).map((n) => Math.round(n))).toEqual([100, 50]);
  });

  it('pans by screen pixels', () => {
    const view = { u: 0.5, v: 0.5, zoom: 1 }; // world is 512 px wide
    const panned = panBy(view, 128, -64);
    expect(panned.u).toBeCloseTo(0.25);
    expect(panned.v).toBeCloseTo(0.625);
  });

  it('keeps the point under the cursor fixed while zooming', () => {
    const view = viewAt(23.7, 37.9, 6);
    const [u, v] = fromScreen(view, size, 650, 120);
    const zoomed = zoomAround(view, size, 650, 120, 8);
    const [x, y] = toScreen(zoomed, size, u, v);
    expect(x).toBeCloseTo(650);
    expect(y).toBeCloseTo(120);
    expect(zoomed.zoom).toBe(8);
  });

  it('clamps the zoom and keeps the world inside the frame', () => {
    expect(clampView({ u: 0.5, v: 0.5, zoom: 40 }, size).zoom).toBe(MAX_ZOOM);
    expect(clampView({ u: 0.5, v: 0.5, zoom: -3 }, size).zoom).toBe(MIN_ZOOM);
    // A 512 px world in an 800 px frame is centred rather than dragged around.
    expect(clampView({ u: 0.1, v: 0.5, zoom: 1 }, size).u).toBe(0.5);
    // A 2048 px world cannot be dragged past its edge.
    const edge = clampView({ u: 0.01, v: 0.99, zoom: 3 }, size);
    expect(edge.u).toBeCloseTo(400 / 2048);
    expect(edge.v).toBeCloseTo(1 - 300 / 2048);
  });

  it('fits a set of points and gives one point a fixed close zoom', () => {
    const points = [project(19, 35), project(29, 42)].map(([u, v]) => ({ u, v }));
    const fitted = fitBounds(points, size);
    for (const point of points) {
      const [x, y] = toScreen(fitted, size, point.u, point.v);
      expect(x).toBeGreaterThanOrEqual(48);
      expect(x).toBeLessThanOrEqual(752);
      expect(y).toBeGreaterThanOrEqual(48);
      expect(y).toBeLessThanOrEqual(552);
    }
    expect(fitBounds([points[0]], size).zoom).toBe(FOCUS_ZOOM);
    expect(fitBounds([], size)).toEqual({ u: 0.5, v: 0.5, zoom: MIN_ZOOM });
  });

  it('round-trips the view through query parameters and rejects nonsense', () => {
    const view = viewAt(23.7271, 37.9838, 7.25);
    const params = viewToParams(view);
    expect(params).toEqual({ z: '7.25', lat: '37.9838', lon: '23.7271' });
    const parsed = viewFromParams(new URLSearchParams(params));
    expect(parsed?.zoom).toBe(7.25);
    expect(parsed?.u).toBeCloseTo(view.u, 6);
    expect(parsed?.v).toBeCloseTo(view.v, 6);
    expect(viewFromParams(new URLSearchParams(''))).toBeNull();
    expect(viewFromParams(new URLSearchParams('z=7&lat=abc&lon=1'))).toBeNull();
    expect(viewFromParams(new URLSearchParams('z=7&lat=91&lon=0'))).toBeNull();
    expect(viewFromParams(new URLSearchParams('z=99&lat=37.9&lon=23.7'))?.zoom).toBe(MAX_ZOOM);
  });
});

describe('clusterPoints', () => {
  const near = [
    { slug: 'a', ...pointAt(23.70, 37.90) },
    { slug: 'b', ...pointAt(23.71, 37.91) },
  ];
  const far = { slug: 'c', ...pointAt(25.5, 36.4) };

  function pointAt(longitude: number, latitude: number) {
    const [u, v] = project(longitude, latitude);
    return { u, v };
  }

  it('merges neighbours when zoomed out and separates them when zoomed in', () => {
    const wide = viewAt(24.5, 37.2, 6);
    const clusters = clusterPoints([...near, far], wide, size);
    expect(clusters).toHaveLength(2);
    expect(clusters.find((c) => c.items.length === 2)?.items.map((i) => i.slug).sort()).toEqual(['a', 'b']);

    const close = viewAt(23.705, 37.905, MAX_ZOOM);
    expect(clusterPoints(near, close, size)).toHaveLength(2);
  });

  it('drops points well outside the frame', () => {
    const view = viewAt(23.7, 37.9, 9);
    expect(clusterPoints([...near, far], view, size).flatMap((c) => c.items.map((i) => i.slug)).sort()).toEqual(['a', 'b']);
  });

  it('fans out points that still coincide at the maximum zoom', () => {
    const same = [{ slug: 'x', ...pointAt(23.7, 37.9) }, { slug: 'y', ...pointAt(23.7, 37.9) }];
    const view = viewAt(23.7, 37.9, MAX_ZOOM);
    const clusters = clusterPoints(same, view, size);
    expect(clusters).toHaveLength(2);
    expect(Math.hypot(clusters[0].x - clusters[1].x, clusters[0].y - clusters[1].y)).toBeGreaterThan(10);
  });
});
