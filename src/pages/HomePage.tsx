import { useCallback, useEffect, useMemo, useState } from 'react';
import { BeachCard } from '../components/BeachCard';
import { getBeaches } from '../lib/api';
import { useDocumentTitle } from '../lib/document-title';
import {
  DRESS_CODES,
  RECOGNITIONS,
  REPO_URL,
  SITE_DESCRIPTION,
  SITE_TITLE,
  dressCodeLabels,
  recognitionDescriptions,
  recognitionLabels,
} from '../lib/labels';
import { useRestoreScroll } from '../lib/scroll-memory';
import { foldSearchText } from '../lib/search';
import type { Beach, DressCode } from '../types';
const filters: Array<DressCode | 'all'> = ['all', ...DRESS_CODES];

export function HomePage() {
  useDocumentTitle(SITE_TITLE);

  const [beaches, setBeaches] = useState<Beach[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<DressCode | 'all'>('all');
  const [error, setError] = useState('');
  const [directoryStatus, setDirectoryStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = useCallback(() => {
    let active = true;
    setDirectoryStatus('loading');
    setError('');

    getBeaches()
      .then((result) => {
        if (!active) return;
        setBeaches(result);
        setDirectoryStatus('ready');
      })
      .catch(() => {
        if (!active) return;
        setError('We could not load the directory. Please try again.');
        setDirectoryStatus('error');
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => load(), [load]);

  const visibleBeaches = useMemo(() => {
    const needle = foldSearchText(query.trim());
    return beaches.filter((beach) => {
      const matchesFilter = filter === 'all' || beach.dressCode === filter;
      const haystack = foldSearchText([beach.name, beach.municipality, beach.region, beach.countryName].filter(Boolean).join(' '));
      return matchesFilter && (!needle || haystack.includes(needle));
    });
  }, [beaches, filter, query]);

  function clearFilters() {
    setFilter('all');
    setQuery('');
  }

  // Controls only exist once there is something to control: nothing while
  // loading (so the live empty site never flashes them) and nothing when the
  // directory is empty.
  const launchState = directoryStatus === 'ready' && beaches.length === 0;
  const showControls = directoryStatus === 'ready' && beaches.length > 0;
  const count = visibleBeaches.length;
  useRestoreScroll(directoryStatus !== 'loading');

  return (
    <>
      <section className="hero">
        <h1>Allowed, tolerated or just hearsay?</h1>
        <p className="hero-copy">{SITE_DESCRIPTION}</p>
        {showControls && (
          <label className="search-box">
            <span>Search by beach, town or country</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              enterKeyHint="search"
              autoCapitalize="none"
              autoComplete="off"
            />
          </label>
        )}
      </section>

      <section className="directory" aria-labelledby="directory-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Directory</p>
            <h2 id="directory-title">Explore beaches</h2>
          </div>
          <span aria-live="polite">
            {directoryStatus === 'loading'
              ? 'Loading directory'
              : directoryStatus === 'error'
                ? 'Directory unavailable'
                : showControls
                  ? `${count} ${count === 1 ? 'beach' : 'beaches'}`
                  : ''}
          </span>
        </div>

        {showControls && (
          <div className="filter-row" role="group" aria-label="Filter by what to wear">
            {filters.map((item) => (
              <button
                key={item}
                className={filter === item ? 'active' : ''}
                aria-pressed={filter === item}
                onClick={() => setFilter(item)}
              >
                {item === 'all' ? 'All beaches' : dressCodeLabels[item]}
              </button>
            ))}
          </div>
        )}

        {directoryStatus === 'error' && (
          <div className="error" role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => load()}>Try again</button>
          </div>
        )}
        {directoryStatus === 'loading' && <p className="directory-status" role="status">Checking the latest directory…</p>}
        {visibleBeaches.length > 0 && (
          <div className="beach-list">
            {visibleBeaches.map((beach) => <BeachCard beach={beach} key={beach.slug} />)}
          </div>
        )}
        {launchState && (
          <section className="launch-state" aria-labelledby="launch-state-title">
            <div className="launch-state-copy">
              <p className="eyebrow">Before launch</p>
              <h3 id="launch-state-title">A beach is listed only when we can show the evidence.</h3>
              <p>Every listing needs a source for its dress-code claim, a short summary and a last-checked date. The first listings — Sithonia, Chalkidiki, Greece — are being sourced now.</p>
              <p className="launch-status"><span aria-hidden="true" />No beaches are published yet</p>
              <p className="launch-next">
                Know a source for a beach? <a href={REPO_URL} rel="noreferrer">Suggest it on GitHub<span aria-hidden="true"> ↗</span></a>
              </p>
            </div>
            <div className="guidance-key">
              <p className="guidance-key-title">What to wear</p>
              <ul className="guidance-chips">
                {DRESS_CODES.map((code) => (
                  <li key={code}><span className={`chip chip-${code}`}>{dressCodeLabels[code]}</span></li>
                ))}
              </ul>
              <p className="guidance-key-title">How established it is</p>
              <ul>
                {RECOGNITIONS.map((level) => (
                  <li key={level}>
                    <span className={`recog recog-${level}`}>{recognitionLabels[level]}</span>
                    {' — '}
                    {recognitionDescriptions[level]}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}
        {directoryStatus === 'ready' && beaches.length > 0 && visibleBeaches.length === 0 && (
          <div className="empty-state">
            <p>No beaches match those filters yet.</p>
            <button type="button" onClick={clearFilters}>Show all beaches</button>
          </div>
        )}
      </section>
    </>
  );
}
