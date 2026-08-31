import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Collections.css';

const COLLECTION_CATEGORIES = [
  { id: 'superhero_action', label: 'Superhero / Action' },
  { id: 'fantasy_adventure', label: 'Fantasy / Adventure' },
  { id: 'sci_fi', label: 'Sci-Fi' },
  { id: 'action_franchises', label: 'Action Franchises' },
  { id: 'horror_thriller', label: 'Horror / Thriller' }
];

const formatReleaseLabel = (movie) => {
  const raw = String(movie?.releaseDate || '').trim();
  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) {
    const parsed = new Date(`${iso[1]}T12:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
  }
  if (raw) return raw.slice(0, 40);
  return movie?.year ? String(movie.year) : '';
};

const COLLECTION_THEMES = [
  {
    match: /marvel/i,
    short: 'MCU',
    tagline: 'Infinity Saga & beyond',
    gradient: 'linear-gradient(145deg, #7f1d1d 0%, #450a0a 48%, #1a0505 100%)',
    accent: '#f87171',
    glow: 'rgba(248, 113, 113, 0.22)'
  },
  {
    match: /\bdc\b|dc universe/i,
    short: 'DC',
    tagline: 'Heroes of the multiverse',
    gradient: 'linear-gradient(145deg, #1e3a8a 0%, #172554 48%, #0a0f1f 100%)',
    accent: '#60a5fa',
    glow: 'rgba(96, 165, 250, 0.22)'
  },
  {
    match: /harry|potter/i,
    short: 'HP',
    tagline: 'The wizarding world',
    gradient: 'linear-gradient(145deg, #78350f 0%, #451a03 48%, #1c0f02 100%)',
    accent: '#fbbf24',
    glow: 'rgba(251, 191, 36, 0.22)'
  },
  {
    match: /x-men/i,
    short: 'XM',
    tagline: 'Mutants united',
    gradient: 'linear-gradient(145deg, #1d4ed8 0%, #1e3a8a 48%, #0c1633 100%)',
    accent: '#93c5fd',
    glow: 'rgba(147, 197, 253, 0.22)'
  },
  {
    match: /spider/i,
    short: 'SM',
    tagline: 'Your friendly neighborhood hero',
    gradient: 'linear-gradient(145deg, #b91c1c 0%, #7f1d1d 48%, #2a0a0a 100%)',
    accent: '#f87171',
    glow: 'rgba(248, 113, 113, 0.22)'
  },
  {
    match: /dark knight/i,
    short: 'DK',
    tagline: 'The Batman trilogy',
    gradient: 'linear-gradient(145deg, #111827 0%, #030712 48%, #000000 100%)',
    accent: '#9ca3af',
    glow: 'rgba(156, 163, 175, 0.2)'
  },
  {
    match: /transformers/i,
    short: 'TF',
    tagline: 'Robots in disguise',
    gradient: 'linear-gradient(145deg, #c2410c 0%, #7c2d12 48%, #1f1008 100%)',
    accent: '#fb923c',
    glow: 'rgba(251, 146, 60, 0.22)'
  },
  {
    match: /middle-earth|lord of the rings|hobbit/i,
    short: 'LOTR',
    tagline: 'One ring to rule them all',
    gradient: 'linear-gradient(145deg, #166534 0%, #14532d 48%, #052e16 100%)',
    accent: '#4ade80',
    glow: 'rgba(74, 222, 128, 0.2)'
  },
  {
    match: /narnia/i,
    short: 'NC',
    tagline: 'Beyond the wardrobe',
    gradient: 'linear-gradient(145deg, #0e7490 0%, #155e75 48%, #082f49 100%)',
    accent: '#67e8f9',
    glow: 'rgba(103, 232, 249, 0.2)'
  },
  {
    match: /pirates/i,
    short: 'PT',
    tagline: 'Tales from the high seas',
    gradient: 'linear-gradient(145deg, #854d0e 0%, #713f12 48%, #291f0a 100%)',
    accent: '#fcd34d',
    glow: 'rgba(252, 211, 77, 0.2)'
  },
  {
    match: /fantastic beasts/i,
    short: 'FB',
    tagline: 'Before Harry Potter',
    gradient: 'linear-gradient(145deg, #5b21b6 0%, #4c1d95 48%, #1e1035 100%)',
    accent: '#c4b5fd',
    glow: 'rgba(196, 181, 253, 0.22)'
  }
];

const DEFAULT_THEME = {
  short: 'SET',
  tagline: 'Curated franchise list',
  gradient: 'linear-gradient(145deg, #4c1d95 0%, #2e1065 48%, #120524 100%)',
  accent: '#c4b5fd',
  glow: 'rgba(196, 181, 253, 0.22)'
};

const getCollectionTheme = (name = '') => {
  const key = String(name);
  return COLLECTION_THEMES.find((theme) => theme.match.test(key)) || DEFAULT_THEME;
};

const ChevronIcon = ({ open }) => (
  <svg
    className={`collection-chevron${open ? ' is-open' : ''}`}
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M6 9l6 6 6-6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M5 12h14M13 6l6 6-6 6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Collections = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const panelRef = useRef(null);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');

  useEffect(() => {
    setActiveId(null);
  }, [activeCategory]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/collections');
        const result = await response.json();
        if (result.success) {
          setCollections(result.data.collections || []);
        } else {
          setError(result.message || 'Failed to load collections');
        }
      } catch (err) {
        console.error('Collections fetch error:', err);
        setError('Failed to load collections. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const pick = new URLSearchParams(location.search).get('pick');
    if (pick && collections.some((item) => item._id === pick)) {
      setActiveId(pick);
    }
  }, [location.search, collections]);

  const activeCollection = collections.find((item) => item._id === activeId) || null;
  const activeMovies = (activeCollection?.movies || []).filter(Boolean);
  const activeTheme = getCollectionTheme(activeCollection?.name);

  const groupedCollections = useMemo(() => {
    const buckets = new Map(COLLECTION_CATEGORIES.map((cat) => [cat.id, []]));
    collections.forEach((collection) => {
      const key = collection.category || 'action_franchises';
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(collection);
    });
    return COLLECTION_CATEGORIES
      .map((cat) => ({
        ...cat,
        items: (buckets.get(cat.id) || []).sort((a, b) => (a.order || 0) - (b.order || 0))
      }))
      .filter((group) => group.items.length > 0);
  }, [collections]);

  const visibleGroups = useMemo(() => {
    if (activeCategory === 'all') return groupedCollections;
    return groupedCollections.filter((group) => group.id === activeCategory);
  }, [groupedCollections, activeCategory]);

  const renderCollectionCard = (collection) => {
    const movies = (collection.movies || []).filter(Boolean);
    const isActive = activeId === collection._id;
    const theme = getCollectionTheme(collection.name);

    return (
      <button
        key={collection._id}
        type="button"
        role="tab"
        aria-selected={isActive}
        className={`collection-pick${isActive ? ' is-active' : ''}`}
        style={{
          '--pick-accent': theme.accent,
          '--pick-glow': theme.glow,
          '--pick-gradient': theme.gradient
        }}
        onClick={() => selectCollection(collection._id)}
      >
        <span className="collection-pick-bg" aria-hidden="true" />
        <span className="collection-pick-content">
          <span className="collection-pick-badge">{theme.short}</span>
          <span className="collection-pick-title">{collection.name}</span>
          <span className="collection-pick-tagline">{theme.tagline}</span>
          <span className="collection-pick-count">
            {movies.length} {movies.length === 1 ? 'title' : 'titles'}
          </span>
        </span>
        <span className="collection-pick-footer">
          <span>{isActive ? 'Viewing' : 'View list'}</span>
          <ChevronIcon open={isActive} />
        </span>
      </button>
    );
  };
  const selectCollection = (id) => {
    setActiveId((current) => {
      const next = current === id ? null : id;
      if (next) {
        window.requestAnimationFrame(() => {
          panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="collections-page">
        <div className="collections-shell">
          <header className="collections-header">
            <div className="collections-skeleton collections-skeleton-title" />
            <div className="collections-skeleton collections-skeleton-subtitle" />
          </header>
          <div className="collections-picker">
            {[1, 2, 3].map((item) => (
              <div key={item} className="collections-skeleton collections-skeleton-card" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="collections-page">
        <div className="collections-empty">
          <h1>Collections</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="collections-page">
      <div className="collections-shell">
        <header className="collections-header">
          <p className="collections-eyebrow">Franchise hubs</p>
          <h1>Collections</h1>
          <p className="collections-lead">
            Browse by category — click a collection to open its movie list.
          </p>
        </header>

        {collections.length === 0 ? (
          <div className="collections-empty">
            <p>No collections yet. Check back soon.</p>
          </div>
        ) : (
          <>
            <div className="collections-category-nav" role="tablist" aria-label="Collection categories">
              <button
                type="button"
                role="tab"
                aria-selected={activeCategory === 'all'}
                className={`collections-category-chip${activeCategory === 'all' ? ' is-active' : ''}`}
                onClick={() => setActiveCategory('all')}
              >
                All
              </button>
              {groupedCollections.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  role="tab"
                  aria-selected={activeCategory === group.id}
                  className={`collections-category-chip${activeCategory === group.id ? ' is-active' : ''}`}
                  onClick={() => setActiveCategory(group.id)}
                >
                  {group.label}
                  <span className="collections-category-count">{group.items.length}</span>
                </button>
              ))}
            </div>

            {visibleGroups.map((group) => (
              <section key={group.id} className="collections-category-section">
                {activeCategory === 'all' ? (
                  <header className="collections-category-head">
                    <h2>{group.label}</h2>
                    <span>{group.items.length} collections</span>
                  </header>
                ) : null}
                <div className="collections-picker" role="tablist" aria-label={group.label}>
                  {group.items.map((collection) => renderCollectionCard(collection))}
                </div>
              </section>
            ))}

            {activeCollection ? (
              <section
                ref={panelRef}
                className="collection-panel"
                style={{
                  '--panel-accent': activeTheme.accent,
                  '--panel-glow': activeTheme.glow
                }}
                aria-live="polite"
              >
                <div className="collection-panel-head">
                  <div>
                    <p className="collection-panel-label">Now viewing</p>
                    <h2>{activeCollection.name}</h2>
                    {activeCollection.description ? (
                      <p className="collection-panel-desc">{activeCollection.description}</p>
                    ) : null}
                  </div>
                  <div className="collection-panel-actions">
                    <div className="collection-panel-stat">
                      <span className="collection-panel-stat-value">{activeMovies.length}</span>
                      <span className="collection-panel-stat-label">Titles</span>
                    </div>
                    <button
                      type="button"
                      className="collection-panel-close"
                      onClick={() => setActiveId(null)}
                      aria-label="Close list"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {activeMovies.length === 0 ? (
                  <p className="collection-empty-note">No movies in this collection yet.</p>
                ) : (
                  <ol className="collection-movie-list">
                    {activeMovies.map((movie, index) => {
                      const release = formatReleaseLabel(movie);
                      return (
                        <li key={movie._id}>
                          <button
                            type="button"
                            className="collection-movie-row"
                            onClick={() => navigate(`/movie/${movie._id}`)}
                          >
                            <span className="collection-movie-index">
                              {String(index + 1).padStart(2, '0')}
                            </span>
                            <span className="collection-movie-main">
                              <span className="collection-movie-title">{movie.title}</span>
                              {release ? (
                                <span className="collection-movie-date">{release}</span>
                              ) : null}
                            </span>
                            <span className="collection-movie-end">
                              {movie.status === 'coming_soon' ? (
                                <span className="collection-movie-badge">Coming Soon</span>
                              ) : null}
                              <span className="collection-movie-arrow">
                                <ArrowIcon />
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
};

export default Collections;
