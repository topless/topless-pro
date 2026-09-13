import { project, unproject } from '../../shared/basemap.mjs';

// The map's camera: a centre on the unit-square Mercator plane (u east, v south) and a
// fractional zoom on the usual 256-pixel-tile scale, so zoom 1 shows the world 512 px wide.
export interface MapView {
  u: number;
  v: number;
  zoom: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  u: number;
  v: number;
}

export const TILE_PX = 256;
export const MIN_ZOOM = 1;
/** Positions are good to about a kilometre and the coastline data to a few hundred metres; closer would only look wrong. */
export const MAX_ZOOM = 11;
/** How close a single beach is shown. */
export const FOCUS_ZOOM = 10;
/** From here the country-level coastline replaces the world outline … */
export const DETAIL_ZOOM = 4;
/** … and from here the detail tiles are drawn over it. */
export const TILE_ZOOM = 6;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function worldSize(zoom: number): number {
  return TILE_PX * 2 ** zoom;
}

export function toScreen(view: MapView, size: Size, u: number, v: number): [number, number] {
  const scale = worldSize(view.zoom);
  return [(u - view.u) * scale + size.width / 2, (v - view.v) * scale + size.height / 2];
}

export function fromScreen(view: MapView, size: Size, x: number, y: number): [number, number] {
  const scale = worldSize(view.zoom);
  return [view.u + (x - size.width / 2) / scale, view.v + (y - size.height / 2) / scale];
}

/** The visible plane as [west, north, east, south] in unit coordinates. */
export function viewportBounds(view: MapView, size: Size): [number, number, number, number] {
  const [u0, v0] = fromScreen(view, size, 0, 0);
  const [u1, v1] = fromScreen(view, size, size.width, size.height);
  return [u0, v0, u1, v1];
}

/** Keep the zoom in range and the world on screen; a world narrower than the frame is centred. */
export function clampView(view: MapView, size: Size): MapView {
  const zoom = clamp(view.zoom, MIN_ZOOM, MAX_ZOOM);
  const scale = worldSize(zoom);
  const halfWidth = size.width / 2 / scale;
  const halfHeight = size.height / 2 / scale;
  return {
    u: scale <= size.width ? 0.5 : clamp(view.u, halfWidth, 1 - halfWidth),
    v: scale <= size.height ? 0.5 : clamp(view.v, halfHeight, 1 - halfHeight),
    zoom,
  };
}

export function panBy(view: MapView, dx: number, dy: number): MapView {
  const scale = worldSize(view.zoom);
  return { u: view.u - dx / scale, v: view.v - dy / scale, zoom: view.zoom };
}

/** Change zoom while the plane point under screen position (x, y) stays put. */
export function zoomAround(view: MapView, size: Size, x: number, y: number, zoom: number): MapView {
  const target = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
  const [pu, pv] = fromScreen(view, size, x, y);
  const scale = worldSize(target);
  return {
    u: pu - (x - size.width / 2) / scale,
    v: pv - (y - size.height / 2) / scale,
    zoom: target,
  };
}

/** The view that shows every point with some breathing room; one point (or none) gets a sensible fixed zoom. */
export function fitBounds(points: readonly Point[], size: Size, padding = 48): MapView {
  if (points.length === 0) return clampView({ u: 0.5, v: 0.5, zoom: MIN_ZOOM }, size);

  let u0 = Infinity;
  let v0 = Infinity;
  let u1 = -Infinity;
  let v1 = -Infinity;
  for (const point of points) {
    if (point.u < u0) u0 = point.u;
    if (point.u > u1) u1 = point.u;
    if (point.v < v0) v0 = point.v;
    if (point.v > v1) v1 = point.v;
  }

  const width = Math.max(size.width - 2 * padding, 1);
  const height = Math.max(size.height - 2 * padding, 1);
  const zoom = Math.log2(Math.min(width / ((u1 - u0) * TILE_PX), height / ((v1 - v0) * TILE_PX)));
  return clampView({
    u: (u0 + u1) / 2,
    v: (v0 + v1) / 2,
    zoom: Number.isFinite(zoom) ? Math.min(zoom, FOCUS_ZOOM) : FOCUS_ZOOM,
  }, size);
}

export function viewAt(longitude: number, latitude: number, zoom = FOCUS_ZOOM): MapView {
  const [u, v] = project(longitude, latitude);
  return { u, v, zoom };
}

// The view in a URL, as three plain query parameters (z, lat, lon) at a precision that
// survives a round trip without producing a visibly different picture.
export function viewToParams(view: MapView): { z: string; lat: string; lon: string } {
  const [longitude, latitude] = unproject(view.u, view.v);
  return { z: view.zoom.toFixed(2), lat: latitude.toFixed(4), lon: longitude.toFixed(4) };
}

export function viewFromParams(params: { get(name: string): string | null }): MapView | null {
  const raw = [params.get('z'), params.get('lat'), params.get('lon')];
  if (raw.some((value) => value === null || value === '')) return null;
  const [zoom, latitude, longitude] = raw.map(Number);
  if (![zoom, latitude, longitude].every(Number.isFinite)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return viewAt(longitude, latitude, clamp(zoom, MIN_ZOOM, MAX_ZOOM));
}

export interface Cluster<T extends Point> {
  x: number;
  y: number;
  items: T[];
}

/**
 * Group points that would draw on top of each other into clusters, in screen space. The grid
 * is anchored to the plane at the current whole zoom, so panning never reshuffles clusters.
 * Points outside the frame (plus a margin) are dropped. At the maximum zoom nothing can be
 * split further, so what is left of a cluster fans out around its centre instead.
 */
export function clusterPoints<T extends Point>(
  points: readonly T[],
  view: MapView,
  size: Size,
  cellPx = 44,
  marginPx = 44,
): Cluster<T>[] {
  const scale = worldSize(view.zoom);
  const gridScale = worldSize(Math.floor(view.zoom));
  const cells = new Map<string, { x: number; y: number; items: T[] }>();

  for (const point of points) {
    const x = (point.u - view.u) * scale + size.width / 2;
    const y = (point.v - view.v) * scale + size.height / 2;
    if (x < -marginPx || y < -marginPx || x > size.width + marginPx || y > size.height + marginPx) continue;
    const key = `${Math.floor((point.u * gridScale) / cellPx)}:${Math.floor((point.v * gridScale) / cellPx)}`;
    const cell = cells.get(key);
    if (cell) {
      cell.x += x;
      cell.y += y;
      cell.items.push(point);
    } else {
      cells.set(key, { x, y, items: [point] });
    }
  }

  const atMaxZoom = view.zoom >= MAX_ZOOM - 1e-9;
  const clusters: Cluster<T>[] = [];
  for (const cell of cells.values()) {
    const x = cell.x / cell.items.length;
    const y = cell.y / cell.items.length;
    if (atMaxZoom && cell.items.length > 1) {
      const radius = 14 + 3 * cell.items.length;
      cell.items.forEach((item, index) => {
        const angle = (2 * Math.PI * index) / cell.items.length - Math.PI / 2;
        clusters.push({ x: x + radius * Math.cos(angle), y: y + radius * Math.sin(angle), items: [item] });
      });
    } else {
      clusters.push({ x, y, items: cell.items });
    }
  }
  return clusters;
}
