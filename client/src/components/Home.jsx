import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import MovieGrid from './MovieGrid';
import TVShowGrid from './TVShowGrid';
import ContactSection from './ContactSection';
import ContentRow from './ContentRow';
import PosterCard from './PosterCard';
import { getMoviePlaceholder, handleImageError } from '../utils/placeholderImage';
import './MovieGrid.css';
import './HomeDiscovery.css';
import './BrowseShelf.css';

const getItemImage = (item) => {
  if (item?.images?.length) return item.images[0];
  if (item?.imageUrl) return item.imageUrl;
  return null;
};

const Home = () => {
  const { isAuthenticated, token } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [movies, setMovies] = useState([]);
  const [tvShows, setTVShows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [userRatings, setUserRatings] = useState({});
  const [ratingLoading, setRatingLoading] = useState({});
  const [contentType, setContentType] = useState('movies');
  const [availableGenres, setAvailableGenres] = useState([]);
  const [availableYears, setAvailableYears] = useState([]);
  const [filtersLoading, setFiltersLoading] = useState(false);
  const [homeBanners, setHomeBanners] = useState([]);
  const [comingSoonItems, setComingSoonItems] = useState([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [heroReady, setHeroReady] = useState(false);
  const [forceBrowse, setForceBrowse] = useState(false);
  const [sortBy, setSortBy] = useState('latest'); // latest | rated | az
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  const hasActiveFilters = Boolean(searchTerm || selectedGenre || selectedYear);
  const isDiscoveryMode = !hasActiveFilters && contentType === 'movies' && !forceBrowse;

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const response = await fetch('/api/banners');
        const result = await response.json();
        if (result.success) {
          const banners = (result.data.banners || []).filter((b) => b.imageUrl);
          setHomeBanners(banners);
        }
      } catch (err) {
        console.error('Error fetching banners:', err);
      }
    };

    const fetchComingSoon = async () => {
      try {
        const [moviesRes, tvRes] = await Promise.all([
          fetch('/api/movies/coming-soon'),
          fetch('/api/tvshows/coming-soon')
        ]);
        const moviesJson = await moviesRes.json();
        const tvJson = await tvRes.json();
        const movies = moviesJson.success
          ? (moviesJson.data.movies || []).map((m) => ({ ...m, _kind: 'movie' }))
          : [];
        const shows = tvJson.success
          ? (tvJson.data.tvShows || []).map((t) => ({ ...t, _kind: 'tvshow' }))
          : [];
        setComingSoonItems([...movies, ...shows].sort((a, b) => (a.year || 0) - (b.year || 0)));
      } catch (err) {
        console.error('Error fetching coming soon:', err);
      }
    };

    fetchBanners();
    fetchComingSoon();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearchTerm(params.get('search') || '');
    setSelectedGenre(params.get('genre') || '');
    setSelectedYear(params.get('year') || '');
    setContentType(params.get('type') === 'tvshows' ? 'tvshows' : 'movies');
    setForceBrowse(params.get('browse') === '1');

    if (
      params.get('genre') ||
      params.get('year') ||
      params.get('search') ||
      params.get('type') === 'tvshows' ||
      params.get('browse') === '1'
    ) {
      setTimeout(() => {
        document.getElementById('movies-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 400);
    }
  }, [location.search]);

  useEffect(() => {
    if (homeBanners.length === 0) return undefined;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % homeBanners.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [homeBanners.length]);

  useEffect(() => {
    const fetchFilters = async () => {
      try {
        setFiltersLoading(true);
        const apiEndpoint = contentType === 'tvshows' ? '/api/tvshows/filters' : '/api/movies/filters';
        const response = await fetch(apiEndpoint);
        const result = await response.json();
        if (result.success) {
          setAvailableGenres(result.data.genres || []);
          setAvailableYears(result.data.years || []);
        }
      } catch (err) {
        console.error('Error fetching filters:', err);
        setAvailableGenres([]);
        setAvailableYears([]);
      } finally {
        setFiltersLoading(false);
      }
    };

    fetchFilters();
  }, [contentType]);

  const buildBrowseParams = useCallback(
    (mutator) => {
      const params = new URLSearchParams(location.search);
      mutator(params);
      if (contentType === 'tvshows') {
        params.set('type', 'tvshows');
        params.delete('browse');
      } else {
        params.delete('type');
        params.set('browse', '1');
      }
      const queryString = params.toString();
      navigate(queryString ? `/?${queryString}` : '/?browse=1', { replace: true });
    },
    [navigate, location.search, contentType]
  );

  const handleGenreSelect = (genre) => {
    buildBrowseParams((params) => {
      if (!genre || selectedGenre === genre) params.delete('genre');
      else {
        params.set('genre', genre);
        params.delete('search');
      }
    });
  };

  const handleYearSelect = (year) => {
    buildBrowseParams((params) => {
      const value = year == null ? '' : String(year);
      if (!value || selectedYear === value) params.delete('year');
      else {
        params.set('year', value);
        params.delete('search');
      }
    });
  };

  const switchContentType = (nextType) => {
    if (nextType === 'tvshows') navigate('/?type=tvshows');
    else navigate('/?browse=1');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const fetchMovies = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      let url = '/api/movies?limit=1000';
      if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
      if (selectedGenre) url += `&genre=${encodeURIComponent(selectedGenre)}`;
      if (selectedYear) url += `&year=${selectedYear}`;
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      if (result.success) setMovies(result.data.movies);
      else throw new Error(result.message || 'Failed to fetch movies');
    } catch (err) {
      console.error('Error fetching movies:', err);
      setError(err.message || 'Failed to load movies. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedGenre, selectedYear]);

  const fetchTVShows = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      let url = '/api/tvshows?limit=1000';
      if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
      if (selectedGenre) url += `&genre=${encodeURIComponent(selectedGenre)}`;
      if (selectedYear) url += `&year=${selectedYear}`;
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      if (result.success) setTVShows(result.data.tvShows);
      else throw new Error(result.message || 'Failed to fetch TV shows');
    } catch (err) {
      console.error('Error fetching TV shows:', err);
      setError(err.message || 'Failed to load TV shows. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedGenre, selectedYear]);

  // Discovery home needs both catalogs; browse mode fetches the active type only
  useEffect(() => {
    if (isDiscoveryMode) {
      const load = async () => {
        setLoading(true);
        setError(null);
        try {
          const [moviesRes, tvRes] = await Promise.all([
            fetch('/api/movies?limit=1000'),
            fetch('/api/tvshows?limit=1000')
          ]);
          const moviesJson = await moviesRes.json();
          const tvJson = await tvRes.json();
          if (moviesJson.success) setMovies(moviesJson.data.movies || []);
          if (tvJson.success) setTVShows(tvJson.data.tvShows || []);
        } catch (err) {
          console.error('Error loading discovery catalog:', err);
          setError('Failed to load the catalog.');
        } finally {
          setLoading(false);
        }
      };
      load();
      return undefined;
    }

    if (searchTerm.trim().length > 2) {
      const timeoutId = setTimeout(() => {
        if (contentType === 'tvshows') fetchTVShows();
        else fetchMovies();
      }, 300);
      return () => clearTimeout(timeoutId);
    }

    if (contentType === 'tvshows') fetchTVShows();
    else fetchMovies();
    return undefined;
  }, [isDiscoveryMode, contentType, selectedGenre, selectedYear, searchTerm, fetchMovies, fetchTVShows]);

  const clearFilters = useCallback(() => {
    if (contentType === 'tvshows') navigate('/?type=tvshows', { replace: true });
    else navigate('/?browse=1', { replace: true });
  }, [navigate, contentType]);

  const fetchUserRatings = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const ratingPromises = movies.map(async (movie) => {
        try {
          const response = await fetch(`/api/movies/${movie._id}/rating`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (response.ok) {
            const result = await response.json();
            return { movieId: movie._id, ...result.data };
          }
        } catch (err) {
          console.error(`Error fetching rating for movie ${movie._id}:`, err);
        }
        return { movieId: movie._id, rating: null, review: '', hasRated: false };
      });

      const ratings = await Promise.all(ratingPromises);
      const ratingsMap = {};
      ratings.forEach((rating) => {
        ratingsMap[rating.movieId] = rating;
      });
      setUserRatings(ratingsMap);
    } catch (err) {
      console.error('Error fetching user ratings:', err);
    }
  }, [movies, isAuthenticated, token]);

  const showNotification = (message, type = 'info') => {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-message">${message}</span>
        <button class="notification-close">×</button>
      </div>
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.parentNode?.removeChild(notification), 5000);
    notification.querySelector('.notification-close').addEventListener('click', () => {
      notification.parentNode?.removeChild(notification);
    });
  };

  const handleRateMovie = async (movieId, rating, review = '') => {
    if (!isAuthenticated) return;
    try {
      setRatingLoading((prev) => ({ ...prev, [movieId]: true }));
      const response = await fetch(`/api/movies/${movieId}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ rating, review })
      });

      if (response.ok) {
        const result = await response.json();
        setUserRatings((prev) => ({
          ...prev,
          [movieId]: { movieId, rating, review, hasRated: true }
        }));
        setMovies((prev) =>
          prev.map((movie) =>
            movie._id === movieId
              ? {
                  ...movie,
                  averageRating: result.data.movie.averageRating,
                  totalRatings: result.data.movie.totalRatings
                }
              : movie
          )
        );
        showNotification(result.message || 'Rating submitted successfully!', 'success');
      } else {
        const errorData = await response.json();
        showNotification(errorData.message || 'Failed to rate movie', 'error');
      }
    } catch (err) {
      console.error('Error rating movie:', err);
      showNotification('Failed to rate movie. Please try again.', 'error');
    } finally {
      setRatingLoading((prev) => ({ ...prev, [movieId]: false }));
    }
  };

  useEffect(() => {
    if (movies.length > 0 && isAuthenticated && !isDiscoveryMode) {
      fetchUserRatings();
    }
  }, [movies, isAuthenticated, token, fetchUserRatings, isDiscoveryMode]);

  const latestMovies = useMemo(() => movies.slice(0, 20), [movies]);

  const topRatedMovies = useMemo(() => {
    return [...movies]
      .sort((a, b) => (b.imdbRating || b.averageRating || 0) - (a.imdbRating || a.averageRating || 0))
      .slice(0, 20);
  }, [movies]);

  const latestTVShows = useMemo(() => tvShows.slice(0, 20), [tvShows]);

  const sortCatalog = useCallback((items) => {
    const list = [...items];
    if (sortBy === 'rated') {
      return list.sort(
        (a, b) => (b.imdbRating || b.averageRating || 0) - (a.imdbRating || a.averageRating || 0)
      );
    }
    if (sortBy === 'az') {
      return list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    }
    // latest — API already returns newest first; keep stable
    return list;
  }, [sortBy]);

  const browsedMovies = useMemo(() => sortCatalog(movies), [movies, sortCatalog]);
  const browsedTVShows = useMemo(() => sortCatalog(tvShows), [tvShows, sortCatalog]);

  const catalogItems = contentType === 'tvshows' ? browsedTVShows : browsedMovies;
  const catalogCount = catalogItems.length;
  const totalPages = Math.max(1, Math.ceil(catalogCount / PAGE_SIZE));

  // Reset to page 1 whenever the catalog context changes
  useEffect(() => {
    setCurrentPage(1);
  }, [contentType, selectedGenre, selectedYear, searchTerm, sortBy]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const pagedItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return catalogItems.slice(start, start + PAGE_SIZE);
  }, [catalogItems, currentPage]);

  const pageNumbers = useMemo(() => {
    const pages = [];
    const windowSize = 5;
    let start = Math.max(1, currentPage - Math.floor(windowSize / 2));
    let end = Math.min(totalPages, start + windowSize - 1);
    start = Math.max(1, end - windowSize + 1);
    for (let i = start; i <= end; i += 1) pages.push(i);
    return pages;
  }, [currentPage, totalPages]);

  const goToPage = (page) => {
    const next = Math.min(totalPages, Math.max(1, page));
    setCurrentPage(next);
    document.getElementById('movies-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const featuredMovie = useMemo(() => {
    const withImages = topRatedMovies.filter((m) => getItemImage(m));
    if (withImages.length === 0) return movies.find((m) => getItemImage(m)) || movies[0] || null;
    return withImages[Math.min(2, withImages.length - 1)];
  }, [topRatedMovies, movies]);

  // Active hero slide: banner artwork + linked movie/TV details (never poster)
  const activeBanner = homeBanners[currentSlide] || null;
  const heroContent = activeBanner?.movie || activeBanner?.tvShow || featuredMovie;
  const heroIsTV = Boolean(activeBanner?.tvShow && !activeBanner?.movie);

  const heroImage =
    activeBanner?.imageUrl ||
    getItemImage(featuredMovie) ||
    getMoviePlaceholder(featuredMovie?.title || 'NK Movie Hub', 1280, 720);

  const heroTitle = heroContent?.title || activeBanner?.title || 'NK Movie Hub';
  const heroDesc =
    heroContent?.description ||
    'Discover movies and TV shows from every genre — stream your next favourite tonight.';
  const heroRating = heroContent
    ? Number(heroContent.imdbRating ?? heroContent.averageRating)
    : null;
  const heroYear = heroContent?.year;
  const heroGenre = heroContent?.genre;
  const heroContentId = heroContent?._id;
  const openHeroContent = () => {
    if (!heroContentId) {
      openBrowseMovies();
      return;
    }
    navigate(heroIsTV ? `/tvshow/${heroContentId}` : `/movie/${heroContentId}`);
  };

  const openBrowseMovies = () => navigate('/?browse=1');

  const renderDiscovery = () => (
    <div className="home-discovery">
      {loading && movies.length === 0 ? (
        <div className="home-discovery-loading">
          <div className="home-discovery-spinner" />
          <p>Loading...</p>
        </div>
      ) : (
        <>
          <section className="home-hero">
            <div className="home-hero-media">
              {homeBanners.length > 0 ? (
                homeBanners.map((banner, index) => (
                  <div
                    key={banner._id || banner.imageUrl + index}
                    className={`home-hero-slide${index === currentSlide ? ' is-visible' : ''}`}
                    style={{ backgroundImage: `url(${banner.imageUrl})` }}
                  />
                ))
              ) : (
                <img
                  src={heroImage}
                  alt={heroTitle}
                  className={heroReady ? 'is-visible' : ''}
                  onLoad={() => setHeroReady(true)}
                  onError={(e) => {
                    handleImageError(e, heroTitle);
                    setHeroReady(true);
                  }}
                />
              )}
            </div>
            <div className="home-hero-gradient-x" />
            <div className="home-hero-gradient-y" />

            <div className="home-hero-body">
              <div className="home-hero-copy">
                <div className="home-hero-meta">
                  {heroRating > 0 && (
                    <span className="home-hero-rating">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 2l2.9 6.9L22 9.2l-5.5 4.8L18.2 22 12 18.3 5.8 22l1.7-8L2 9.2l7.1-.3L12 2z" />
                      </svg>
                      {heroRating.toFixed(1)}
                    </span>
                  )}
                  {heroYear && (
                    <>
                      <span className="home-hero-dot">·</span>
                      <span className="home-hero-year">{heroYear}</span>
                    </>
                  )}
                  {heroGenre && (
                    <>
                      <span className="home-hero-dot">·</span>
                      <span className="home-hero-genre">{heroGenre}</span>
                    </>
                  )}
                </div>

                <h1 className="home-hero-title">{heroTitle}</h1>
                <p className="home-hero-desc">{heroDesc}</p>

                <div className="home-hero-actions">
                  <button
                    type="button"
                    className="home-hero-btn home-hero-btn-primary"
                    onClick={openHeroContent}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    Watch Now
                  </button>
                  <button
                    type="button"
                    className="home-hero-btn home-hero-btn-secondary"
                    onClick={openHeroContent}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 16v-4M12 8h.01" />
                    </svg>
                    More Info
                  </button>
                </div>
              </div>
            </div>

            {homeBanners.length > 1 && (
              <div className="home-hero-indicators">
                {homeBanners.map((banner, index) => (
                  <button
                    key={banner._id || index}
                    type="button"
                    className={index === currentSlide ? 'is-active' : ''}
                    aria-label={`Go to slide ${index + 1}`}
                    onClick={() => setCurrentSlide(index)}
                  />
                ))}
              </div>
            )}
          </section>

          <div className="home-rows" id="browse-anchor">
            {comingSoonItems.length > 0 && (
              <ContentRow
                title="Coming Soon"
                subtitle="Titles arriving on NK Movie Hub"
              >
                {comingSoonItems.map((item) => (
                  <PosterCard
                    key={`${item._kind}-${item._id}`}
                    item={item}
                    badge="Coming Soon"
                    onClick={() =>
                      navigate(
                        item._kind === 'tvshow' ? `/tvshow/${item._id}` : `/movie/${item._id}`
                      )
                    }
                  />
                ))}
              </ContentRow>
            )}

            {latestMovies.length > 0 && (
              <ContentRow
                title="Trending Now"
                subtitle="Fresh titles from the catalog"
                onViewAll={openBrowseMovies}
              >
                {latestMovies.map((movie) => (
                  <PosterCard
                    key={movie._id}
                    item={movie}
                    onClick={() => navigate(`/movie/${movie._id}`)}
                  />
                ))}
              </ContentRow>
            )}

            {topRatedMovies.length > 0 && (
              <ContentRow
                title="Top Rated Movies"
                subtitle="Highest IMDb scores on NK Movie Hub"
                onViewAll={openBrowseMovies}
              >
                {topRatedMovies.map((movie) => (
                  <PosterCard
                    key={movie._id}
                    item={movie}
                    onClick={() => navigate(`/movie/${movie._id}`)}
                  />
                ))}
              </ContentRow>
            )}

            {latestTVShows.length > 0 && (
              <ContentRow
                title="TV Shows"
                subtitle="Series ready to binge"
                onViewAll={() => navigate('/?type=tvshows')}
              >
                {latestTVShows.map((show) => (
                  <PosterCard
                    key={show._id}
                    item={show}
                    kind="tvshow"
                    onClick={() => navigate(`/tvshow/${show._id}`)}
                  />
                ))}
              </ContentRow>
            )}

            {error && (
              <div className="error-state" style={{ padding: '2rem' }}>
                <p>{error}</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );

  const renderBrowse = () => {
    const filterCount = [selectedGenre, selectedYear].filter(Boolean).length;

    return (
    <div className="browse-shelf">
      <div className="browse-shelf-top">
        <div>
          <p className="browse-shelf-meta browse-shelf-meta-solo">
            <strong>{loading ? '…' : catalogCount}</strong>
            {contentType === 'tvshows' ? ' series' : ' titles'}
            {!loading && catalogCount > 0 && (
              <>
                {' '}
                · Page {currentPage} of {totalPages}
              </>
            )}
            {selectedGenre ? ` · ${selectedGenre}` : ''}
            {selectedYear ? ` · ${selectedYear}` : ''}
            {searchTerm ? ` · “${searchTerm}”` : ''}
          </p>
        </div>

        <div className="browse-shelf-actions">
          <button
            type="button"
            className={`browse-filters-btn${filtersOpen ? ' is-open' : ''}${filterCount ? ' has-active' : ''}`}
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4 6h16M7 12h10M10 18h4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            Filters
            {filterCount > 0 && <span className="browse-filters-count">{filterCount}</span>}
          </button>

          {(searchTerm || selectedGenre || selectedYear) && (
            <button type="button" className="browse-shelf-clear" onClick={clearFilters}>
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="browse-type-tabs" role="tablist" aria-label="Catalog type">
        <button
          type="button"
          role="tab"
          aria-selected={contentType === 'movies'}
          className={`browse-type-tab${contentType === 'movies' ? ' is-active' : ''}`}
          onClick={() => switchContentType('movies')}
        >
          Movies
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={contentType === 'tvshows'}
          className={`browse-type-tab${contentType === 'tvshows' ? ' is-active' : ''}`}
          onClick={() => switchContentType('tvshows')}
        >
          TV Shows
        </button>
      </div>

      <div className="browse-sort-row" aria-label="Sort catalog">
        <span className="browse-sort-label">Sort</span>
        {[
          { id: 'latest', label: 'Newest' },
          { id: 'rated', label: 'Top rated' },
          { id: 'az', label: 'A – Z' }
        ].map((option) => (
          <button
            key={option.id}
            type="button"
            className={`browse-sort-chip${sortBy === option.id ? ' is-active' : ''}`}
            onClick={() => setSortBy(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className={`browse-filters-panel${filtersOpen ? ' is-open' : ''}`}>
        <div className="browse-filters-grid">
          <div className="browse-filters-block">
            <h3 className="browse-filters-heading">Genres</h3>
            <div className="browse-filters-chips">
              <button
                type="button"
                className={`browse-chip${!selectedGenre ? ' is-active' : ''}`}
                onClick={() => handleGenreSelect('')}
              >
                All
              </button>
              {filtersLoading ? (
                <span className="browse-chip">Loading…</span>
              ) : (
                availableGenres.map((genre) => (
                  <button
                    key={genre}
                    type="button"
                    className={`browse-chip${selectedGenre === genre ? ' is-active' : ''}`}
                    onClick={() => handleGenreSelect(genre)}
                  >
                    {genre}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="browse-filters-block">
            <h3 className="browse-filters-heading">Year</h3>
            <div className="browse-filters-chips">
              <button
                type="button"
                className={`browse-chip${!selectedYear ? ' is-active' : ''}`}
                onClick={() => handleYearSelect(null)}
              >
                Any
              </button>
              {availableYears.map((year) => (
                <button
                  key={year}
                  type="button"
                  className={`browse-chip${selectedYear === year.toString() ? ' is-active' : ''}`}
                  onClick={() => handleYearSelect(year)}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {(searchTerm || selectedGenre || selectedYear) && (
        <div className="browse-active-note">
          {searchTerm && <span>Search: {searchTerm}</span>}
          {selectedGenre && <span>Genre: {selectedGenre}</span>}
          {selectedYear && <span>Year: {selectedYear}</span>}
        </div>
      )}

      <div id="movies-section" className="browse-shelf-body">
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner" />
            <h3>Loading {contentType === 'tvshows' ? 'TV shows' : 'movies'}...</h3>
          </div>
        ) : error ? (
          <div className="error-state">
            <h3>Could not load the catalog</h3>
            <p>{error}</p>
            <button
              className="btn btn-primary"
              onClick={contentType === 'tvshows' ? fetchTVShows : fetchMovies}
            >
              Try again
            </button>
          </div>
        ) : contentType === 'tvshows' ? (
          <TVShowGrid
            tvShows={pagedItems}
            searchTerm={searchTerm}
            selectedGenre={selectedGenre}
            selectedYear={selectedYear}
          />
        ) : (
          <MovieGrid
            movies={pagedItems}
            searchTerm={searchTerm}
            selectedGenre={selectedGenre}
            selectedYear={selectedYear}
          />
        )}

        {!loading && !error && catalogCount > PAGE_SIZE && (
          <nav className="browse-pagination" aria-label="Catalog pages">
            <button
              type="button"
              className="browse-page-btn"
              disabled={currentPage <= 1}
              onClick={() => goToPage(currentPage - 1)}
            >
              Prev
            </button>

            {pageNumbers[0] > 1 && (
              <>
                <button type="button" className="browse-page-btn" onClick={() => goToPage(1)}>
                  1
                </button>
                {pageNumbers[0] > 2 && <span className="browse-page-ellipsis">…</span>}
              </>
            )}

            {pageNumbers.map((page) => (
              <button
                key={page}
                type="button"
                className={`browse-page-btn${page === currentPage ? ' is-active' : ''}`}
                aria-current={page === currentPage ? 'page' : undefined}
                onClick={() => goToPage(page)}
              >
                {page}
              </button>
            ))}

            {pageNumbers[pageNumbers.length - 1] < totalPages && (
              <>
                {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
                  <span className="browse-page-ellipsis">…</span>
                )}
                <button
                  type="button"
                  className="browse-page-btn"
                  onClick={() => goToPage(totalPages)}
                >
                  {totalPages}
                </button>
              </>
            )}

            <button
              type="button"
              className="browse-page-btn browse-page-next"
              disabled={currentPage >= totalPages}
              onClick={() => goToPage(currentPage + 1)}
            >
              Next
            </button>
          </nav>
        )}
      </div>
    </div>
    );
  };

  return (
    <div>
      {isDiscoveryMode ? renderDiscovery() : renderBrowse()}
      <ContactSection />
    </div>
  );
};

export default Home;
