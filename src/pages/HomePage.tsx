import { useEffect, useMemo, useState } from 'react';
import { BeachCard } from '../components/BeachCard';
import { getBeaches } from '../lib/api';
import { dressCodeLabels } from '../lib/labels';
import { foldSearchText } from '../lib/search';
import type { Beach, DressCode } from '../types';

const filters: Array<DressCode | 'all'> = [
  'all',
  'swimwear-required',
  'topless-permitted',
  'clothing-optional',
  'nudity-permitted',
  'unknown',
];

export function HomePage() {
  const [beaches, setBeaches] = useState<Beach[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<DressCode | 'all'>('all');
  const [error, setError] = useState('');
  const [directoryStatus, setDirectoryStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let active = true;

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

  const visibleBeaches = useMemo(() => {
    const needle = foldSearchText(query.trim());
    return beaches.filter((beach) => {
      const matchesFilter = filter === 'all' || beach.dressCode === filter;
      const haystack = foldSearchText([beach.name, beach.municipality, beach.region, beach.countryName].filter(Boolean).join(' '));
      return matchesFilter && (!needle || haystack.includes(needle));
    });
  }, [beaches, filter, query]);

  return (
    <>
      <section className="hero">
        <p className="eyebrow">A practical beach directory</p>
        <h1>Know what to wear.<br />Know where you’re welcome.</h1>
        <p className="hero-copy">Clear, community-maintained clothing guidance for beaches worldwide.</p>
        <label className="search-box">
          <span>Search beaches, cities or countries</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try Mykonos, Geneva or France" />
        </label>
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
                : `${visibleBeaches.length} result${visibleBeaches.length === 1 ? '' : 's'}`}
          </span>
        </div>

        <div className="filter-row" aria-label="Filter by clothing guidance">
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

        {error && <p className="error">{error}</p>}
        {directoryStatus === 'loading' && <p className="directory-status" role="status">Checking the latest directory…</p>}
        <div className="beach-grid">
          {visibleBeaches.map((beach) => <BeachCard beach={beach} key={beach.id} />)}
        </div>
        {directoryStatus === 'ready' && beaches.length === 0 && (
          <section className="launch-state" aria-labelledby="launch-state-title">
            <div className="launch-state-copy">
              <p className="eyebrow">Directory in verification</p>
              <h3 id="launch-state-title">The first beach guides are being checked.</h3>
              <p>We’re confirming current rules, local practice and reliable sources before publishing each listing.</p>
              <p className="launch-status"><span aria-hidden="true" />No beaches are published yet</p>
            </div>
            <div className="guidance-key">
              <p className="guidance-key-title">Every listing will give one clear answer</p>
              <ul>
                <li><span className="guidance-marker badge-swimwear-required" aria-hidden="true" />Swimwear required</li>
                <li><span className="guidance-marker badge-topless-permitted" aria-hidden="true" />Topless permitted</li>
                <li><span className="guidance-marker badge-clothing-optional" aria-hidden="true" />Clothing optional</li>
                <li><span className="guidance-marker badge-nudity-permitted" aria-hidden="true" />Nudity permitted</li>
                <li><span className="guidance-marker badge-unknown" aria-hidden="true" />Unknown or disputed</li>
              </ul>
              <p className="guidance-note">Official rules stay separate from tolerated custom, and conflicting reports are marked as disputed.</p>
            </div>
          </section>
        )}
        {directoryStatus === 'ready' && beaches.length > 0 && visibleBeaches.length === 0 && <p className="empty-state">No beaches match those filters yet.</p>}
      </section>
    </>
  );
}
