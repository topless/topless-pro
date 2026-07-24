import { useEffect, useMemo, useState } from 'react';
import { BeachCard } from '../components/BeachCard';
import { getBeaches } from '../lib/api';
import { dressCodeLabels } from '../lib/labels';
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

  useEffect(() => {
    getBeaches().then(setBeaches).catch(() => setError('We could not load the directory. Please try again.'));
  }, []);

  const visibleBeaches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return beaches.filter((beach) => {
      const matchesFilter = filter === 'all' || beach.dressCode === filter;
      const haystack = [beach.name, beach.municipality, beach.region, beach.countryName].filter(Boolean).join(' ').toLowerCase();
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
          <span>{visibleBeaches.length} result{visibleBeaches.length === 1 ? '' : 's'}</span>
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
        <div className="beach-grid">
          {visibleBeaches.map((beach) => <BeachCard beach={beach} key={beach.id} />)}
        </div>
        {!error && beaches.length > 0 && visibleBeaches.length === 0 && <p className="empty-state">No beaches match those filters yet.</p>}
      </section>
    </>
  );
}
