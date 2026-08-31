import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Collections.css';
import './CastCollection.css';

const PAGE_SIZE = 48;

const CastCollection = () => {
  const navigate = useNavigate();
  const [people, setPeople] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sort, setSort] = useState('popular');
  const [selectedSlug, setSelectedSlug] = useState(null);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/cast/status');
      const result = await response.json();
      if (result.success) {
        setStatus(result.data);
      }
    } catch (err) {
      console.error('Cast status error:', err);
    }
  }, []);

  const loadPeople = useCallback(async ({ page = 1, append = false } = {}) => {
    try {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        sort
      });
      if (debouncedSearch) params.set('q', debouncedSearch);

      const response = await fetch(`/api/cast?${params.toString()}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Failed to load cast collection');
      }

      const nextItems = result.data.items || [];
      setPeople((current) => (append ? [...current, ...nextItems] : nextItems));
      setPagination(result.data.pagination || { page: 1, pages: 1, total: 0 });
    } catch (err) {
      console.error('Cast list error:', err);
      setError(err.message || 'Failed to load cast collection');
      if (!append) setPeople([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [debouncedSearch, sort]);

  useEffect(() => {
    loadPeople({ page: 1, append: false });
  }, [loadPeople]);

  useEffect(() => {
    loadStatus();
    const timer = setInterval(loadStatus, 4000);
    return () => clearInterval(timer);
  }, [loadStatus]);

  useEffect(() => {
    if (!selectedSlug) {
      setSelectedPerson(null);
      return undefined;
    }

    let cancelled = false;

    const loadDetail = async () => {
      try {
        setDetailLoading(true);
        const response = await fetch(`/api/cast/${encodeURIComponent(selectedSlug)}`);
        const result = await response.json();
        if (!cancelled) {
          if (result.success) {
            setSelectedPerson(result.data);
          } else {
            setSelectedPerson(null);
          }
        }
      } catch (err) {
        if (!cancelled) setSelectedPerson(null);
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    };

    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedSlug]);

  const indexingLabel = useMemo(() => {
    if (!status?.running) return null;
    const indexed = status.indexedTitles || status.processed || 0;
    const total = status.totalTitles || status.total || 0;
    const percent = total > 0 ? Math.round((indexed / total) * 100) : 0;
    return `Building cast index… ${indexed.toLocaleString()} / ${total.toLocaleString()} (${percent}%)`;
  }, [status]);

  const openPerson = (slug) => {
    setSelectedSlug(slug);
  };

  const closePerson = () => {
    setSelectedSlug(null);
  };

  const openTitle = (credit) => {
    if (!credit?.entityId) return;
    navigate(credit.type === 'tvshow' ? `/tvshow/${credit.entityId}` : `/movie/${credit.entityId}`);
  };

  const hasMore = pagination.page < pagination.pages;

  return (
    <div className="collections-page cast-collection-page">
      <div className="collections-shell">
        <header className="collections-header">
          <p className="collections-eyebrow">Browse by talent</p>
          <h1>Cast Collection</h1>
          <p className="collections-lead">
            Explore movies and TV shows by cast and directors from our full catalog.
          </p>
        </header>

        <div className="cast-toolbar">
          <label className="cast-search">
            <span className="sr-only">Search cast</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search actors, actresses, directors…"
              autoComplete="off"
            />
          </label>

          <div className="cast-sort">
            <button
              type="button"
              className={sort === 'popular' ? 'is-active' : ''}
              onClick={() => setSort('popular')}
            >
              Most titles
            </button>
            <button
              type="button"
              className={sort === 'name' ? 'is-active' : ''}
              onClick={() => setSort('name')}
            >
              A–Z
            </button>
          </div>
        </div>

        {indexingLabel && (
          <div className="cast-index-progress" role="status">
            <div className="cast-index-progress-bar">
              <span style={{ width: `${status.percent || 0}%` }} />
            </div>
            <p>{indexingLabel}</p>
            {status.currentTitle ? <small>Now indexing: {status.currentTitle}</small> : null}
          </div>
        )}

        {status && !status.running && status.people > 0 && (
          <p className="cast-stats-line">
            {status.people.toLocaleString()} people across{' '}
            {status.indexedTitles.toLocaleString()} titles
          </p>
        )}

        {loading && !people.length ? (
          <div className="collections-empty">
            <p>Loading cast collection…</p>
          </div>
        ) : error ? (
          <div className="collections-empty">
            <p>{error}</p>
          </div>
        ) : !people.length ? (
          <div className="collections-empty">
            <p>
              {status?.running
                ? 'Cast collection is being built. This may take a while on first load.'
                : debouncedSearch
                  ? `No cast found for “${debouncedSearch}”.`
                  : 'No cast indexed yet. Please check back shortly.'}
            </p>
          </div>
        ) : (
          <>
            <div className="cast-grid">
              {people.map((person) => (
                <button
                  key={person.slug}
                  type="button"
                  className={`cast-card${selectedSlug === person.slug ? ' is-active' : ''}`}
                  onClick={() => openPerson(person.slug)}
                >
                  <span className="cast-card-photo">
                    {person.profile ? (
                      <img src={person.profile} alt={person.name} loading="lazy" />
                    ) : (
                      <span aria-hidden="true">👤</span>
                    )}
                  </span>
                  <span className="cast-card-body">
                    <span className="cast-card-name">{person.name}</span>
                    <span className="cast-card-count">
                      {person.creditCount} {person.creditCount === 1 ? 'title' : 'titles'}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            {hasMore && (
              <div className="cast-load-more">
                <button
                  type="button"
                  onClick={() => loadPeople({ page: pagination.page + 1, append: true })}
                  disabled={loadingMore}
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {selectedSlug && (
        <div className="cast-detail-overlay" role="presentation" onClick={closePerson}>
          <aside
            className="cast-detail-panel"
            role="dialog"
            aria-modal="true"
            aria-label={selectedPerson?.name || 'Cast member'}
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className="cast-detail-close" onClick={closePerson} aria-label="Close">
              ×
            </button>

            {detailLoading || !selectedPerson ? (
              <div className="cast-detail-loading">Loading…</div>
            ) : (
              <>
                <header className="cast-detail-header">
                  <div className="cast-detail-photo">
                    {selectedPerson.profile ? (
                      <img src={selectedPerson.profile} alt={selectedPerson.name} />
                    ) : (
                      <span aria-hidden="true">👤</span>
                    )}
                  </div>
                  <div>
                    <h2>{selectedPerson.name}</h2>
                    <p>{selectedPerson.creditCount} titles in catalog</p>
                  </div>
                </header>

                <div className="cast-detail-credits">
                  {selectedPerson.credits.map((credit) => (
                    <button
                      key={`${credit.type}-${credit.entityId}-${credit.character}`}
                      type="button"
                      className="cast-credit-card"
                      onClick={() => openTitle(credit)}
                    >
                      <span className="cast-credit-poster">
                        {credit.imageUrl ? (
                          <img src={credit.imageUrl} alt={credit.title} loading="lazy" />
                        ) : (
                          <span aria-hidden="true">🎬</span>
                        )}
                      </span>
                      <span className="cast-credit-meta">
                        <span className="cast-credit-title">{credit.title}</span>
                        <span className="cast-credit-sub">
                          {credit.type === 'tvshow' ? 'TV Show' : 'Movie'}
                          {credit.year ? ` · ${credit.year}` : ''}
                        </span>
                        {credit.character ? (
                          <span className="cast-credit-role">{credit.character}</span>
                        ) : null}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
};

export default CastCollection;
