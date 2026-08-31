import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './BrowseShelf.css';

const SORT_OPTIONS = [
  { id: 'popular', label: 'Popular' },
  { id: 'latest', label: 'Newest' },
  { id: 'rated', label: 'Top rated' },
  { id: 'az', label: 'A – Z' }
];

const COLUMN_COUNT = 3;

const splitIntoColumns = (items, columnCount = COLUMN_COUNT) => {
  const columns = Array.from({ length: columnCount }, () => []);
  items.forEach((item, index) => {
    columns[index % columnCount].push(item);
  });
  return columns;
};

const ToolbarIcon = ({ type }) => {
  if (type === 'languages') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
      </svg>
    );
  }
  if (type === 'genres') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
        <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  );
};

const MegaColumns = ({ columns, renderItem }) => (
  <div className="browse-mega-columns">
    {columns.map((column, columnIndex) => (
      <div key={`col-${columnIndex}`} className="browse-mega-column">
        {column.map((item) => renderItem(item))}
      </div>
    ))}
  </div>
);

const BrowseCatalogToolbar = ({ contentType = 'movies', totalCount = 0, loading = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const toolbarRef = useRef(null);
  const [openMenu, setOpenMenu] = useState(null);
  const [filterOptions, setFilterOptions] = useState({
    genres: [],
    years: [],
    languages: []
  });
  const [filtersLoading, setFiltersLoading] = useState(false);

  const params = new URLSearchParams(location.search);
  const selectedGenre = params.get('genre') || '';
  const selectedYear = params.get('year') || '';
  const selectedLanguage = params.get('language') || '';
  const selectedSort = params.get('sort') || 'popular';

  useEffect(() => {
    let cancelled = false;

    const loadFilters = async () => {
      setFiltersLoading(true);
      try {
        const endpoint = contentType === 'tvshows' ? '/api/tvshows/filters' : '/api/movies/filters';
        const response = await fetch(endpoint);
        const result = await response.json();
        if (!cancelled && result.success) {
          setFilterOptions({
            genres: result.data.genres || [],
            years: result.data.years || [],
            languages: result.data.languages || []
          });
        }
      } catch (err) {
        console.error('Browse filters error:', err);
      } finally {
        if (!cancelled) setFiltersLoading(false);
      }
    };

    loadFilters();
    return () => {
      cancelled = true;
    };
  }, [contentType]);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!toolbarRef.current?.contains(event.target)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpenMenu(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const applyFilter = useCallback(
    (mutator) => {
      const next = new URLSearchParams(location.search);
      mutator(next);
      if (!next.get('sort')) next.set('sort', 'popular');
      if (contentType === 'tvshows') {
        next.set('type', 'tvshows');
        next.delete('browse');
      } else {
        next.delete('type');
        next.set('browse', '1');
      }
      setOpenMenu(null);
      navigate(`/?${next.toString()}`);
    },
    [navigate, location.search, contentType]
  );

  const languageItems = useMemo(() => {
    const items = filterOptions.languages.map((lang) => ({
      key: lang.id,
      label: lang.label,
      isActive: selectedLanguage === lang.id,
      onSelect: () =>
        applyFilter((p) => {
          p.set('language', lang.id);
          p.delete('search');
        })
    }));
    return items;
  }, [filterOptions.languages, selectedLanguage, applyFilter]);

  const genreItems = useMemo(() => {
    return filterOptions.genres.map((genre) => ({
      key: genre,
      label: genre,
      isActive: selectedGenre === genre,
      onSelect: () =>
        applyFilter((p) => {
          p.set('genre', genre);
          p.delete('search');
        })
    }));
  }, [filterOptions.genres, selectedGenre, applyFilter]);

  const yearItems = useMemo(() => {
    return (filterOptions.years || []).map((year) => ({
      key: String(year),
      label: String(year),
      isActive: selectedYear === String(year),
      onSelect: () =>
        applyFilter((p) => {
          p.set('year', String(year));
          p.delete('search');
        })
    }));
  }, [filterOptions.years, selectedYear, applyFilter]);

  const menus = [
    { id: 'languages', label: 'Languages', icon: 'languages', hasSelection: Boolean(selectedLanguage) },
    { id: 'genres', label: 'Genres', icon: 'genres', hasSelection: Boolean(selectedGenre) },
    { id: 'years', label: 'Years', icon: 'years', hasSelection: Boolean(selectedYear) }
  ];

  const renderMegaPanel = () => {
    if (!openMenu) return null;

    if (openMenu === 'languages') {
      if (filtersLoading) {
        return <p className="browse-mega-status">Loading languages…</p>;
      }
      return (
        <MegaColumns
          columns={splitIntoColumns(languageItems)}
          renderItem={(item) => (
            <button
              key={item.key}
              type="button"
              className={`browse-mega-link${item.isActive ? ' is-active' : ''}`}
              onClick={item.onSelect}
            >
              {item.label}
            </button>
          )}
        />
      );
    }

    if (openMenu === 'genres') {
      if (filtersLoading) {
        return <p className="browse-mega-status">Loading genres…</p>;
      }
      return (
        <MegaColumns
          columns={splitIntoColumns(genreItems)}
          renderItem={(item) => (
            <button
              key={item.key}
              type="button"
              className={`browse-mega-link${item.isActive ? ' is-active' : ''}`}
              onClick={item.onSelect}
            >
              {item.label}
            </button>
          )}
        />
      );
    }

    if (openMenu === 'years') {
      return (
        <MegaColumns
          columns={splitIntoColumns(yearItems)}
          renderItem={(item) => (
            <button
              key={item.key}
              type="button"
              className={`browse-mega-link${item.isActive ? ' is-active' : ''}`}
              onClick={item.onSelect}
            >
              {item.label}
            </button>
          )}
        />
      );
    }

    return null;
  };

  const countLabel = contentType === 'tvshows' ? 'TV shows' : 'Movies';

  return (
    <div className={`browse-catalog-toolbar${openMenu ? ' has-mega-open' : ''}`} ref={toolbarRef}>
      <div className="browse-toolbar-top">
        <div className="browse-filter-nav" aria-label="Catalog filters">
          {menus.map((menu) => (
            <button
              key={menu.id}
              type="button"
              className={`browse-filter-nav-btn${openMenu === menu.id ? ' is-open' : ''}${
                menu.hasSelection ? ' has-selection' : ''
              }`}
              aria-expanded={openMenu === menu.id}
              onClick={() => setOpenMenu((current) => (current === menu.id ? null : menu.id))}
            >
              <ToolbarIcon type={menu.icon} />
              <span>{menu.label}</span>
            </button>
          ))}
        </div>

        <p className="browse-result-count" aria-live="polite">
          {loading ? (
            <span className="browse-result-count-value">…</span>
          ) : (
            <>
              <span className="browse-result-count-value">{totalCount.toLocaleString()}</span>
              <span className="browse-result-count-label">{countLabel}</span>
            </>
          )}
        </p>
      </div>

      {openMenu && (
        <div className="browse-mega-panel" role="region" aria-label={`${openMenu} filter`}>
          {renderMegaPanel()}
        </div>
      )}

      <div className="browse-sort-row" aria-label="Sort catalog">
        <span className="browse-sort-label">Sort</span>
        {SORT_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`browse-sort-chip${selectedSort === option.id ? ' is-active' : ''}`}
            onClick={() =>
              applyFilter((p) => {
                if (option.id === 'popular') p.set('sort', 'popular');
                else p.set('sort', option.id);
              })
            }
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default BrowseCatalogToolbar;
