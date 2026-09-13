import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import {
  loadDetail,
  loadTile,
  loadWorld,
  peekDetail,
  peekTile,
  peekWorld,
  tileRect,
  tilesInView,
  type Layer,
} from '../lib/basemap';
import {
  clampView,
  clusterPoints,
  DETAIL_ZOOM,
  fitBounds,
  panBy,
  TILE_ZOOM,
  toScreen,
  viewportBounds,
  worldSize,
  zoomAround,
  type MapView,
  type Point,
  type Size,
} from '../lib/map-view';

// A self-contained map: coastlines on a canvas, one focusable button per beach (or per
// group of beaches) above it, and the usual gestures. It draws only what has arrived and
// requests nothing from any host but this one.

export interface MapMarker extends Point {
  slug: string;
  /** The accessible name of the pin. */
  label: string;
}

export type ViewChangeReason = 'fit' | 'gesture' | 'cluster';

interface Props {
  markers: readonly MapMarker[];
  /** null until the first fit, which the map performs itself. */
  view: MapView | null;
  onViewChange: (view: MapView, reason: ViewChangeReason) => void;
  selectedSlug: string | null;
  onSelect: (slug: string | null) => void;
  /** Overlays such as the selected beach's card. */
  children?: ReactNode;
}

interface PointerState {
  x: number;
  y: number;
  startX: number;
  startY: number;
}

interface Colours {
  sea: string;
  land: string;
}

const DRAG_THRESHOLD_PX = 4;
const KEY_PAN_PX = 80;
const WHEEL_ZOOM_PER_PX = 0.002;
const PINCH_WHEEL_ZOOM_PER_PX = 0.01;

export function BeachMap({ markers, view, onViewChange, selectedSlug, onSelect, children }: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [arrivals, setArrivals] = useState(0);
  const pointers = useRef(new Map<number, PointerState>());
  const gesture = useRef({ dragged: false, pinchDistance: 0 });
  // Event handlers registered once read the latest props and size from here.
  const latest = useRef({ view, size, onViewChange });
  useLayoutEffect(() => {
    latest.current = { view, size, onViewChange };
  });

  // The frame's size drives the canvas backing store and every screen position.
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const measure = () => {
      const rect = frame.getBoundingClientRect();
      setSize((current) => (
        current.width === rect.width && current.height === rect.height ? current : { width: rect.width, height: rect.height }
      ));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  // The first view shows everything the page put on the map.
  useEffect(() => {
    if (view !== null || size.width === 0) return;
    onViewChange(fitBounds(markers, size), 'fit');
  }, [view, size, markers, onViewChange]);

  // Ask for the coastline files this view needs; each arrival redraws.
  useEffect(() => {
    if (view === null || size.width === 0) return;
    const arrived = () => setArrivals((count) => count + 1);
    const ignore = () => {};
    const world = peekWorld();
    if (!world) loadWorld().then(arrived, ignore);
    if (view.zoom >= DETAIL_ZOOM && !peekDetail()) loadDetail().then(arrived, ignore);
    if (view.zoom >= TILE_ZOOM && world) {
      for (const id of tilesInView(viewportBounds(view, size), world.tiles)) {
        if (!peekTile(id)) loadTile(id).then(arrived, ignore);
      }
    }
  }, [view, size, arrivals]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    if (!canvas || !frame || view === null || size.width === 0) return;
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(size.width * ratio);
    const height = Math.round(size.height * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const context = canvas.getContext('2d');
    if (!context) return;
    const styles = getComputedStyle(frame);
    drawBasemap(context, view, size, ratio, {
      sea: styles.getPropertyValue('--map-sea').trim() || '#cfe0dc',
      land: styles.getPropertyValue('--map-land').trim() || '#f7f4ea',
    });
  }, [view, size, arrivals]);

  const apply = useCallback((next: MapView, reason: ViewChangeReason = 'gesture') => {
    const { size: currentSize, onViewChange: change } = latest.current;
    change(clampView(next, currentSize), reason);
  }, []);

  const zoomBy = useCallback((delta: number) => {
    const { view: current, size: currentSize } = latest.current;
    if (current === null) return;
    apply(zoomAround(current, currentSize, currentSize.width / 2, currentSize.height / 2, current.zoom + delta));
  }, [apply]);

  // The wheel listener must be able to prevent the page from scrolling, so it is not passive.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const onWheel = (event: WheelEvent) => {
      const current = latest.current.view;
      if (current === null) return;
      event.preventDefault();
      const rect = frame.getBoundingClientRect();
      const pixels = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * 16 : event.deltaY;
      // Trackpad pinches arrive as ctrl+wheel with small deltas.
      const delta = Math.max(-1, Math.min(1, -pixels * (event.ctrlKey ? PINCH_WHEEL_ZOOM_PER_PX : WHEEL_ZOOM_PER_PX)));
      apply(zoomAround(current, latest.current.size, event.clientX - rect.left, event.clientY - rect.top, current.zoom + delta));
    };
    frame.addEventListener('wheel', onWheel, { passive: false });
    return () => frame.removeEventListener('wheel', onWheel);
  }, [apply]);

  function localPoint(clientX: number, clientY: number): [number, number] {
    const rect = frameRef.current?.getBoundingClientRect();
    return rect ? [clientX - rect.left, clientY - rect.top] : [clientX, clientY];
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
    });
    if (pointers.current.size === 1) gesture.current.dragged = false;
    gesture.current.pinchDistance = 0;
  }

  function capture(frame: HTMLDivElement, pointerId: number) {
    try {
      frame.setPointerCapture(pointerId);
    } catch {
      // The pointer may already be gone; the gesture just ends.
    }
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const pointer = pointers.current.get(event.pointerId);
    const current = latest.current.view;
    if (!pointer || current === null) return;
    const previous = { x: pointer.x, y: pointer.y };
    pointer.x = event.clientX;
    pointer.y = event.clientY;

    if (pointers.current.size === 1) {
      if (!gesture.current.dragged) {
        if (Math.hypot(pointer.x - pointer.startX, pointer.y - pointer.startY) < DRAG_THRESHOLD_PX) return;
        gesture.current.dragged = true;
        capture(event.currentTarget, event.pointerId);
      }
      apply(panBy(current, pointer.x - previous.x, pointer.y - previous.y));
      return;
    }

    // Two fingers: zoom by the change in their distance, pan by the movement of their midpoint.
    const [a, b] = [...pointers.current.values()];
    const other = a === pointer ? b : a;
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    const [midX, midY] = localPoint((a.x + b.x) / 2, (a.y + b.y) / 2);
    const [previousMidX, previousMidY] = localPoint((previous.x + other.x) / 2, (previous.y + other.y) / 2);
    let next = current;
    if (gesture.current.pinchDistance > 0 && distance > 0) {
      next = zoomAround(next, latest.current.size, midX, midY, next.zoom + Math.log2(distance / gesture.current.pinchDistance));
    }
    next = panBy(next, midX - previousMidX, midY - previousMidY);
    gesture.current.pinchDistance = distance;
    if (!gesture.current.dragged) {
      gesture.current.dragged = true;
      for (const id of pointers.current.keys()) capture(event.currentTarget, id);
    }
    apply(next);
  }

  function onPointerEnd(event: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    gesture.current.pinchDistance = 0;
    // A finger that stays down continues as a pan from where it is now.
    for (const pointer of pointers.current.values()) {
      pointer.startX = pointer.x;
      pointer.startY = pointer.y;
    }
    // The click that follows a drag is not a selection; the flag outlives it by one task.
    if (pointers.current.size === 0 && gesture.current.dragged) {
      setTimeout(() => {
        gesture.current.dragged = false;
      }, 0);
    }
  }

  function onFrameClick(event: MouseEvent<HTMLDivElement>) {
    if (gesture.current.dragged) return;
    if ((event.target as HTMLElement).closest('button, a, .map-overlay')) return;
    onSelect(null);
  }

  function onDoubleClick(event: MouseEvent<HTMLDivElement>) {
    const current = latest.current.view;
    if (current === null || (event.target as HTMLElement).closest('button, a, .map-overlay')) return;
    const [x, y] = localPoint(event.clientX, event.clientY);
    apply(zoomAround(current, latest.current.size, x, y, current.zoom + 1));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    const current = latest.current.view;
    if (current === null) return;
    switch (event.key) {
      case 'ArrowLeft': apply(panBy(current, KEY_PAN_PX, 0)); break;
      case 'ArrowRight': apply(panBy(current, -KEY_PAN_PX, 0)); break;
      case 'ArrowUp': apply(panBy(current, 0, KEY_PAN_PX)); break;
      case 'ArrowDown': apply(panBy(current, 0, -KEY_PAN_PX)); break;
      case '+': case '=': zoomBy(1); break;
      case '-': case '_': zoomBy(-1); break;
      default: return;
    }
    event.preventDefault();
  }

  const clusters = view !== null && size.width > 0 ? clusterPoints(markers, view, size) : [];

  return (
    <div
      ref={frameRef}
      className="map-frame"
      role="application"
      aria-label="Map of listed beaches. Drag or use the arrow keys to move; scroll, pinch or press plus and minus to zoom."
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onClick={onFrameClick}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
    >
      <canvas ref={canvasRef} aria-hidden="true" />
      <div className="map-pins">
        {clusters.map((cluster) => {
          const style = { transform: `translate(${cluster.x}px, ${cluster.y}px)` };
          if (cluster.items.length === 1) {
            const [marker] = cluster.items;
            const selected = marker.slug === selectedSlug;
            return (
              <button
                key={marker.slug}
                type="button"
                className={selected ? 'map-pin is-selected' : 'map-pin'}
                style={style}
                aria-label={marker.label}
                aria-pressed={selected}
                onClick={() => {
                  if (gesture.current.dragged) return;
                  onSelect(selected ? null : marker.slug);
                }}
              />
            );
          }
          const count = cluster.items.length;
          return (
            <button
              key={`${cluster.items[0].slug}+${count}`}
              type="button"
              className="map-pin map-pin-cluster"
              // Where groups overlap, the larger one is the one to see and to reach.
              style={{ ...style, zIndex: count }}
              aria-label={`${count} beaches here — zoom in`}
              onClick={() => {
                if (gesture.current.dragged || view === null) return;
                const fitted = fitBounds(cluster.items, latest.current.size, 80);
                apply({ ...fitted, zoom: Math.max(fitted.zoom, view.zoom + 1) }, 'cluster');
              }}
            >
              {count}
            </button>
          );
        })}
      </div>
      <div className="map-controls">
        <button type="button" aria-label="Zoom in" onClick={() => zoomBy(1)}>+</button>
        <button type="button" aria-label="Zoom out" onClick={() => zoomBy(-1)}>−</button>
      </div>
      <p className="map-credit">Coastlines: Natural Earth</p>
      {children && <div className="map-overlay">{children}</div>}
    </div>
  );
}

function drawBasemap(context: CanvasRenderingContext2D, view: MapView, size: Size, ratio: number, colours: Colours): void {
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.fillStyle = colours.sea;
  context.fillRect(0, 0, size.width, size.height);

  const bounds = viewportBounds(view, size);
  const base = (view.zoom >= DETAIL_ZOOM ? peekDetail() : undefined) ?? peekWorld();
  if (!base) return;
  context.fillStyle = colours.land;
  fillLayer(context, base, view, size, bounds);

  const world = peekWorld();
  if (view.zoom < TILE_ZOOM || !world) return;
  // Inside a detail tile the picture is the tile's alone: sea first, then its land.
  for (const id of tilesInView(bounds, world.tiles)) {
    const tile = peekTile(id);
    if (!tile) continue;
    const [u0, v0, u1, v1] = tileRect(id);
    const [x0, y0] = toScreen(view, size, u0, v0);
    const [x1, y1] = toScreen(view, size, u1, v1);
    context.save();
    context.beginPath();
    context.rect(x0, y0, x1 - x0, y1 - y0);
    context.clip();
    context.fillStyle = colours.sea;
    context.fillRect(x0, y0, x1 - x0, y1 - y0);
    context.fillStyle = colours.land;
    fillLayer(context, tile, view, size, bounds);
    context.restore();
  }
}

function fillLayer(
  context: CanvasRenderingContext2D,
  layer: Layer,
  view: MapView,
  size: Size,
  [west, north, east, south]: readonly [number, number, number, number],
): void {
  const scale = worldSize(view.zoom);
  const offsetX = size.width / 2 - view.u * scale;
  const offsetY = size.height / 2 - view.v * scale;
  context.beginPath();
  for (const ring of layer.rings) {
    const [ringWest, ringNorth, ringEast, ringSouth] = ring.bounds;
    if (ringEast < west || ringWest > east || ringSouth < north || ringNorth > south) continue;
    const points = ring.points;
    context.moveTo(points[0] * scale + offsetX, points[1] * scale + offsetY);
    for (let i = 2; i < points.length; i += 2) {
      context.lineTo(points[i] * scale + offsetX, points[i + 1] * scale + offsetY);
    }
    context.closePath();
  }
  // Even-odd so that lakes and inland seas, which are holes in the land rings, stay water.
  context.fill('evenodd');
}
