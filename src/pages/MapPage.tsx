import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { project } from '../../shared/basemap.mjs';
import { BeachMap, type MapMarker, type ViewChangeReason } from '../components/BeachMap';
import { getBeaches } from '../lib/api';
import { useDocumentTitle } from '../lib/document-title';
import { DRESS_CODES, MAP_TITLE, dressCodeLabels, formatBeachLocation, recognitionLabels } from '../lib/labels';
import { viewAt, viewFromParams, viewToParams, type MapView } from '../lib/map-view';
import type { Beach, DressCode } from '../types';

const filters: Array<DressCode | 'all'> = ['all', ...DRESS_CODES];

function isDressCode(value: string | null): value is DressCode {
  return DRESS_CODES.includes(value as DressCode);
}

// The address bar carries the state worth sharing: the view (z, lat, lon), the filter
// (dress=) and the selected beach (beach=). It is read once, when the page opens, and
// rewritten in place as the visitor moves, so Back never has to step through every pan.
export function MapPage() {
  useDocumentTitle(MAP_TITLE);
  const [params, setParams] = useSearchParams();
  const setParamsRef = useRef(setParams);
  useEffect(() => {
    setParamsRef.current = setParams;
  }, [setParams]);
  const opened = useRef({ view: viewFromParams(params), beach: params.get('beach'), dress: params.get('dress') });

  const [beaches, setBeaches] = useState<Beach[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [filter, setFilter] = useState<DressCode | 'all'>(isDressCode(opened.current.dress) ? opened.current.dress : 'all');
  const [selectedSlug, setSelectedSlug] = useState<string | null>(opened.current.beach);
  const [view, setView] = useState<MapView | null>(opened.current.view);
  const moved = useRef(false);

  const load = useCallback((fresh = false) => {
    let active = true;
    setStatus('loading');
    getBeaches({ fresh })
      .then((result) => {
        if (!active) return;
        setBeaches(result);
        setStatus('ready');
        // A link to one beach opens on that beach, unless the link also says where to look.
        const { beach, view: linkedView } = opened.current;
        if (beach && linkedView === null) {
          const target = result.find((item) => item.slug === beach);
          if (target) setView((current) => current ?? viewAt(target.longitude, target.latitude));
        }
      })
      .catch(() => {
        if (active) setStatus('error');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => load(), [load]);

  const visible = useMemo(
    () => (filter === 'all' ? beaches : beaches.filter((beach) => beach.dressCode === filter)),
    [beaches, filter],
  );
  const markers = useMemo<MapMarker[]>(() => visible.map((beach) => {
    const [u, v] = project(beach.longitude, beach.latitude);
    return {
      slug: beach.slug,
      u,
      v,
      label: `${beach.name}, ${formatBeachLocation(beach)} — ${dressCodeLabels[beach.dressCode]}`,
    };
  }), [visible]);
  const selected = selectedSlug === null ? null : visible.find((beach) => beach.slug === selectedSlug) ?? null;

  const updateParams = useCallback((mutate: (next: URLSearchParams) => void) => {
    setParamsRef.current((previous) => {
      const next = new URLSearchParams(previous);
      mutate(next);
      return next;
    }, { replace: true });
  }, []);

  const onViewChange = useCallback((next: MapView, reason: ViewChangeReason) => {
    setView(next);
    if (reason !== 'fit') moved.current = true;
  }, []);

  // The view reaches the address bar a moment after the gesture, not on every frame of it.
  useEffect(() => {
    if (view === null || !moved.current) return;
    const timer = setTimeout(() => updateParams((next) => {
      for (const [name, value] of Object.entries(viewToParams(view))) next.set(name, value);
    }), 300);
    return () => clearTimeout(timer);
  }, [view, updateParams]);

  function choose(code: DressCode | 'all') {
    setFilter(code);
    updateParams((next) => {
      if (code === 'all') next.delete('dress');
      else next.set('dress', code);
    });
  }

  function select(slug: string | null) {
    setSelectedSlug(slug);
    updateParams((next) => {
      if (slug === null) next.delete('beach');
      else next.set('beach', slug);
    });
  }

  const count = markers.length;

  return (
    <section className="map-page" aria-labelledby="map-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Map</p>
          <h1 id="map-title">Where the listed beaches are</h1>
        </div>
        <span>
          {status === 'loading'
            ? 'Loading directory'
            : status === 'error'
              ? 'Directory unavailable'
              : `${count} ${count === 1 ? 'beach' : 'beaches'} shown`}
        </span>
      </div>
      <p className="map-intro">
        Each dot is a published listing, placed to within about a kilometre. A number is a group of listings: zoom in, or select it, to separate them. Open a listing for its sources and exact map links.
      </p>

      {status === 'ready' && beaches.length > 0 && (
        <div className="filter-row" role="group" aria-label="Filter by what to wear">
          {filters.map((item) => (
            <button
              key={item}
              type="button"
              className={filter === item ? 'active' : ''}
              aria-pressed={filter === item}
              onClick={() => choose(item)}
            >
              {item === 'all' ? 'All beaches' : dressCodeLabels[item]}
            </button>
          ))}
        </div>
      )}

      {status === 'error' && (
        <div className="error" role="alert">
          <p>We could not load the directory. Please try again.</p>
          <button type="button" onClick={() => load(true)}>Try again</button>
        </div>
      )}
      {status === 'loading' && <p className="directory-status" role="status">Checking the latest directory…</p>}
      {status === 'ready' && (
        <BeachMap markers={markers} view={view} onViewChange={onViewChange} selectedSlug={selectedSlug} onSelect={select}>
          {selected && (
            <aside className="map-card" aria-label="Selected beach">
              <button type="button" className="map-card-close" aria-label="Close" onClick={() => select(null)}>×</button>
              <p className="eyebrow">{formatBeachLocation(selected)}</p>
              <h2>{selected.name}</h2>
              <p className="provenance">
                <span className={`chip chip-${selected.dressCode}`}>{dressCodeLabels[selected.dressCode]}</span>
                <span className={`recog recog-${selected.recognition}`}>{recognitionLabels[selected.recognition]}</span>
              </p>
              <Link className="map-card-link" to={`/beaches/${selected.slug}`}>Open the listing<span aria-hidden="true"> →</span></Link>
            </aside>
          )}
        </BeachMap>
      )}
      {status === 'ready' && beaches.length === 0 && (
        <p className="directory-status">No beaches are published yet.</p>
      )}
    </section>
  );
}
