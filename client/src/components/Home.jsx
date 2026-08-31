import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import MovieGrid from './MovieGrid';
import TVShowGrid from './TVShowGrid';
import ContactSection from './ContactSection';
import ContentRow from './ContentRow';
import PosterCard from './PosterCard';
import { getMoviePlaceholder, handleImageError } from '../utils/placeholderImage';
import { buildMoviesUrl, buildTVShowsUrl } from '../utils/fetchAllPaged';
import { withReturnPath } from '../utils/navigation';
import './MovieGrid.css';
import './HomeDiscovery.css';
import './BrowseShelf.css';

const PAGE_SIZE = 20;
/** Server batch size — UI still shows PAGE_SIZE; next batch loads when you leave this window. */
const BATCH_SIZE = 500;
const DISCOVERY_CACHE_KEY = 'nk-home-discovery-v1';
const DISCOVERY_CACHE_TTL_MS = 15 * 60 * 1000;

const readDiscoveryCache = () => {
  try {
    const raw = sessionStorage.getItem(DISCOVERY_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.data || Date.now() - parsed.at > DISCOVERY_CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
};

const writeDiscoveryCache = (data) => {
  try {
    sessionStorage.setItem(
      DISCOVERY_CACHE_KEY,
      JSON.stringify({ at: Date.now(), data })
    );
  } catch {
    // Ignore quota / private mode errors
  }
};

const applyDiscoveryRows = (data, setters) => {
  const {
    setTrendingNow,
    setNowPlaying,
    setTopRatedMovies,
    setTrendingTVShows,
    setMovies,
    setTVShows
  } = setters;
  setTrendingNow(data.trendingNow || []);
  setNowPlaying(data.nowPlaying || []);
  setTopRatedMovies(data.topRatedMovies || []);
  setTrendingTVShows(data.trendingTVShows || []);
  setMovies(data.trendingNow || []);
  setTVShows(data.trendingTVShows || []);
};

const hasDiscoveryRows = (data) =>
  Boolean(
    data &&
      ((data.trendingNow && data.trendingNow.length > 0) ||
        (data.nowPlaying && data.nowPlaying.length > 0) ||
        (data.topRatedMovies && data.topRatedMovies.length > 0) ||
        (data.trendingTVShows && data.trendingTVShows.length > 0))
  );

const getItemImage = (item) => {
  if (item?.images?.length) return item.images[0];
  if (item?.imageUrl) return item.imageUrl;
  return null;
};

const batchIndexForPage = (page) =>
  Math.floor(((Math.max(1, page) - 1) * PAGE_SIZE) / BATCH_SIZE);

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
  const [comingSoonOnly, setComingSoonOnly] = useState(false);
  const [userRatings, setUserRatings] = useState({});
  const [ratingLoading, setRatingLoading] = useState({});
  const [contentType, setContentType] = useState('movies');
  const [availableGenres, setAvailableGenres] = useState([]);
  const [availableYears, setAvailableYears] = useState([]);
  const [filtersLoading, setFiltersLoading] = useState(false);
  const [homeBanners, setHomeBanners] = useState([]);
  const [comingSoonItems, setComingSoonItems] = useState([]);
  const [comingSoonLoading, setComingSoonLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [heroReady, setHeroReady] = useState(false);
  const [forceBrowse, setForceBrowse] = useState(false);
  const [sortBy, setSortBy] = useState('latest'); // popular | latest | rated | az
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [topRatedMovies, setTopRatedMovies] = useState([]);
  const [trendingNow, setTrendingNow] = useState([]);
  const [nowPlaying, setNowPlaying] = useState([]);
  const [trendingTVShows, setTrendingTVShows] = useState([]);
  const [discoveryRefreshing, setDiscoveryRefreshing] = useState(false);
  const [loadedBatchIndex, setLoadedBatchIndex] = useState(-1);
  const batchCacheRef = useRef(new Map());
  const catalogQueryKeyRef = useRef('');

  const hasActiveFilters = Boolean(searchTerm || selectedGenre || selectedYear || comingSoonOnly);
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
        setComingSoonLoading(true);
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
        setComingSoonItems(
          [...movies, ...shows].sort((a, b) => {
            const key = (item) => {
              if (item.releaseDate) {
                const iso = String(item.releaseDate).match(/^(\d{4}-\d{2}-\d{2})/);
                if (iso) return iso[1];
                const t = Date.parse(item.releaseDate);
                if (!Number.isNaN(t)) return new Date(t).toISOString().slice(0, 10);
              }
              if (item.year) return `${item.year}-12-31`;
              return '9999-12-31';
            };
            const diff = key(a).localeCompare(key(b));
            if (diff !== 0) return diff;
            return String(a.title || '').localeCompare(String(b.title || ''));
          })
        );
      } catch (err) {
        console.error('Error fetching coming soon:', err);
      } finally {
        setComingSoonLoading(false);
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
    setComingSoonOnly(params.get('category') === 'coming-soon');
    setContentType(params.get('type') === 'tvshows' ? 'tvshows' : 'movies');
    setForceBrowse(params.get('browse') === '1');
    const sortParam = params.get('sort');
    if (sortParam === 'popular' || sortParam === 'rated' || sortParam === 'az' || sortParam === 'latest') {
      setSortBy(sortParam);
    }
    setCurrentPage(1);

    if (
      params.get('genre') ||
      params.get('year') ||
      params.get('search') ||
      params.get('type') === 'tvshows' ||
      params.get('browse') === '1' ||
      params.get('category') === 'coming-soon'
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

  const handleComingSoonSelect = (enabled) => {
    buildBrowseParams((params) => {
      if (!enabled || comingSoonOnly) params.delete('category');
      else {
        params.set('category', 'coming-soon');
        params.delete('search');
      }
    });
  };

  const openComingSoonCategory = () => {
    navigate('/?browse=1&category=coming-soon');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const switchContentType = (nextType) => {
    if (nextType === 'tvshows') navigate('/?type=tvshows');
    else navigate('/?browse=1');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const catalogQueryKey = useMemo(
    () =>
      [
        contentType,
        searchTerm.trim(),
        selectedGenre,
        selectedYear,
        comingSoonOnly ? 'coming-soon' : '',
        sortBy
      ].join('|'),
    [contentType, searchTerm, selectedGenre, selectedYear, comingSoonOnly, sortBy]
  );

  const applyBatchToState = useCallback(
    (batchIndex, items, total) => {
      if (contentType === 'tvshows') setTVShows(items);
      else setMovies(items);
      setLoadedBatchIndex(batchIndex);
      setCatalogTotal(total);
      setTotalPages(Math.max(1, Math.ceil(total / PAGE_SIZE)));
    },
    [contentType]
  );

  const fetchCatalogBatch = useCallback(
    async (batchIndex, { signal, silent = false } = {}) => {
      if (batchIndex < 0) return null;

      const cacheKey = `${catalogQueryKey}#${batchIndex}`;
      const cached = batchCacheRef.current.get(cacheKey);
      if (cached) {
        if (!silent) applyBatchToState(batchIndex, cached.items, cached.total);
        return cached;
      }

      if (!silent) {
        setLoading(true);
        setError(null);
      }

      const buildUrl = contentType === 'tvshows' ? buildTVShowsUrl : buildMoviesUrl;
      const listKey = contentType === 'tvshows' ? 'tvShows' : 'movies';
      const totalKey = contentType === 'tvshows' ? 'totalTVShows' : 'totalMovies';

      const response = await fetch(
        buildUrl({
          page: batchIndex + 1,
          limit: BATCH_SIZE,
          search: searchTerm,
          genre: selectedGenre,
          year: selectedYear,
          sort: sortBy,
          status: comingSoonOnly ? 'coming_soon' : ''
        }),
        signal ? { signal } : undefined
      );
      const result = await response.json();
      if (!result.success) {
        throw new Error(
          result.message ||
            (contentType === 'tvshows' ? 'Failed to load TV shows' : 'Failed to load movies')
        );
      }

      const items = result.data?.[listKey] || [];
      const total = Number(result.data?.pagination?.[totalKey]) || 0;
      const payload = { items, total };
      batchCacheRef.current.set(cacheKey, payload);

      if (!silent) applyBatchToState(batchIndex, items, total);
      return payload;
    },
    [
      catalogQueryKey,
      contentType,
      searchTerm,
      selectedGenre,
      selectedYear,
      comingSoonOnly,
      sortBy,
      applyBatchToState
    ]
  );

  // Discovery: show cached/local rows immediately, then refresh live trending in background
  useEffect(() => {
    if (!isDiscoveryMode) return undefined;

    let cancelled = false;
    const controller = new AbortController();
    const setters = {
      setTrendingNow,
      setNowPlaying,
      setTopRatedMovies,
      setTrendingTVShows,
      setMovies,
      setTVShows
    };

    const cached = readDiscoveryCache();
    if (hasDiscoveryRows(cached)) {
      applyDiscoveryRows(cached, setters);
      setLoading(false);
    } else {
      setLoading(true);
    }

    const loadFastDiscovery = async () => {
      try {
        const response = await fetch('/api/discovery/home?limit=20&fast=1', {
          signal: controller.signal
        });
        const result = await response.json();
        if (!result.success || cancelled) return;
        if (!hasDiscoveryRows(result.data)) return;
        applyDiscoveryRows(result.data, setters);
        writeDiscoveryCache(result.data);
      } catch (err) {
        if (err.name === 'AbortError' || cancelled) return;
        console.error('Error loading fast discovery catalog:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const loadLiveDiscovery = async ({ showRefresh = false } = {}) => {
      if (showRefresh) setDiscoveryRefreshing(true);
      try {
        const response = await fetch('/api/discovery/home?limit=20', {
          signal: controller.signal
        });
        const result = await response.json();
        if (!result.success || cancelled) return;
        applyDiscoveryRows(result.data, setters);
        writeDiscoveryCache(result.data);
      } catch (err) {
        if (err.name === 'AbortError' || cancelled) return;
        console.error('Error loading live discovery catalog:', err);
        if (!hasDiscoveryRows(cached)) {
          setError('Failed to load the catalog.');
        }
      } finally {
        if (!cancelled) {
          setDiscoveryRefreshing(false);
          setLoading(false);
        }
      }
    };

    const bootstrapDiscovery = async () => {
      await loadFastDiscovery();
      if (!cancelled) {
        await loadLiveDiscovery({ showRefresh: hasDiscoveryRows(readDiscoveryCache()) });
      }
    };

    bootstrapDiscovery();
    const refreshId = setInterval(() => loadLiveDiscovery({ showRefresh: true }), 10 * 60 * 1000);

    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(refreshId);
    };
  }, [isDiscoveryMode]);

  // Browse: 500-item batches, 20 shown per UI page.
  useEffect(() => {
    if (isDiscoveryMode) return undefined;

    if (catalogQueryKeyRef.current !== catalogQueryKey) {
      catalogQueryKeyRef.current = catalogQueryKey;
      batchCacheRef.current.clear();
      setLoadedBatchIndex(-1);
      setLoading(true);
      setError(null);
      if (contentType === 'tvshows') setTVShows([]);
      else setMovies([]);
    }

    const controller = new AbortController();
    const batchIndex = batchIndexForPage(currentPage);
    const delay = searchTerm.trim().length > 2 ? 300 : 0;

    const timeoutId = setTimeout(async () => {
      try {
        const cacheKey = `${catalogQueryKey}#${batchIndex}`;
        if (!batchCacheRef.current.has(cacheKey)) {
          setLoading(true);
          setError(null);
        }

        const payload = await fetchCatalogBatch(batchIndex, {
          signal: controller.signal
        });

        // Prefetch next 500 so the following ~25 UI pages stay instant
        if (payload && (batchIndex + 1) * BATCH_SIZE < payload.total) {
          fetchCatalogBatch(batchIndex + 1, {
            signal: controller.signal,
            silent: true
          }).catch(() => {});
        }
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('Error fetching catalog batch:', err);
        setError(err.message || 'Failed to load catalog. Please try again.');
        if (contentType === 'tvshows') setTVShows([]);
        else setMovies([]);
        setLoadedBatchIndex(batchIndexForPage(currentPage));
        setCatalogTotal(0);
        setTotalPages(1);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, delay);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [isDiscoveryMode, catalogQueryKey, currentPage, searchTerm, fetchCatalogBatch, contentType]);

  const clearFilters = useCallback(() => {
    if (contentType === 'tvshows') navigate('/?type=tvshows', { replace: true });
    else navigate('/?browse=1', { replace: true });
  }, [navigate, contentType]);

  const fetchUserRatings = useCallback(async () => {
    if (!isAuthenticated || contentType === 'tvshows') return;
    const start = ((currentPage - 1) * PAGE_SIZE) % BATCH_SIZE;
    const visible = movies.slice(start, start + PAGE_SIZE);
    if (visible.length === 0) return;
    try {
      const ratingPromises = visible.map(async (movie) => {
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
      setUserRatings((prev) => ({ ...prev, ...ratingsMap }));
    } catch (err) {
      console.error('Error fetching user ratings:', err);
    }
  }, [movies, currentPage, isAuthenticated, token, contentType]);

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

  const catalogItems = contentType === 'tvshows' ? tvShows : movies;
  const catalogCount = catalogTotal;

  // Slice the current 500-batch into a 20-item UI page (instant when batch is cached)
  const pagedItems = useMemo(() => {
    if (isDiscoveryMode) return catalogItems;
    const neededBatch = batchIndexForPage(currentPage);
    if (loadedBatchIndex !== neededBatch) return [];
    const start = ((currentPage - 1) * PAGE_SIZE) % BATCH_SIZE;
    return catalogItems.slice(start, start + PAGE_SIZE);
  }, [isDiscoveryMode, catalogItems, currentPage, loadedBatchIndex]);

  const catalogWaitingForBatch =
    !isDiscoveryMode && loadedBatchIndex !== batchIndexForPage(currentPage);

  // Keep current page in range when totals shrink (e.g. after filtering)
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

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
    const pool = [...trendingNow, ...nowPlaying, ...topRatedMovies, ...movies];
    const withImages = pool.filter((m) => getItemImage(m));
    if (withImages.length === 0) return movies.find((m) => getItemImage(m)) || movies[0] || null;
    return withImages[Math.min(2, withImages.length - 1)];
  }, [trendingNow, nowPlaying, topRatedMovies, movies]);

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
    navigate(
      heroIsTV
        ? `/tvshow/${heroContentId}`
        : `/movie/${heroContentId}`,
      heroIsTV ? withReturnPath(location) : undefined
    );
  };

  const hasDiscoveryContent =
    trendingNow.length > 0 ||
    nowPlaying.length > 0 ||
    topRatedMovies.length > 0 ||
    trendingTVShows.length > 0;

  const openBrowseMovies = () => navigate('/?browse=1');

  const renderDiscovery = () => (
    <div className="home-discovery">
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
            <nav className="home-categories" aria-label="Browse categories">
              <button
                type="button"
                className="home-category-chip is-active"
                onClick={openComingSoonCategory}
              >
                Coming Soon
              </button>
              <button
                type="button"
                className="home-category-chip"
                onClick={() => navigate('/?browse=1&sort=popular')}
              >
                Trending
              </button>
              <button
                type="button"
                className="home-category-chip"
                onClick={() => navigate('/?browse=1&sort=rated')}
              >
                Top Rated
              </button>
              <button
                type="button"
                className="home-category-chip"
                onClick={() => navigate('/?type=tvshows&sort=popular')}
              >
                TV Shows
              </button>
            </nav>

            {(comingSoonLoading || comingSoonItems.length > 0) && (
              <ContentRow
                title="Coming Soon"
                subtitle="Upcoming releases — nearest first"
                onViewAll={openComingSoonCategory}
              >
                {comingSoonLoading && comingSoonItems.length === 0 ? (
                  <div className="home-row-loading">Loading upcoming titles…</div>
                ) : (
                  comingSoonItems.map((item) => (
                    <PosterCard
                      key={`${item._kind}-${item._id}`}
                      item={item}
                      badge="Coming Soon"
                      onClick={() =>
                        navigate(
                          item._kind === 'tvshow' ? `/tvshow/${item._id}` : `/movie/${item._id}`,
                          item._kind === 'tvshow' ? withReturnPath(location) : undefined
                        )
                      }
                    />
                  ))
                )}
              </ContentRow>
            )}

            {loading && !hasDiscoveryContent ? (
              <div className="home-row-skeletons" aria-hidden="true">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={`discovery-skeleton-${index}`} className="home-row-skeleton-card" />
                ))}
              </div>
            ) : (
              <>
                {discoveryRefreshing && hasDiscoveryContent && (
                  <p className="home-row-refresh-note">Updating trending picks…</p>
                )}
                {trendingNow.length > 0 && (
                  <ContentRow
                    title="Trending Now"
                    subtitle="Most popular this week"
                    onViewAll={() => navigate('/?browse=1&sort=popular')}
                  >
                    {trendingNow.map((movie) => (
                      <PosterCard
                        key={movie._id}
                        item={movie}
                        onClick={() => navigate(`/movie/${movie._id}`)}
                      />
                    ))}
                  </ContentRow>
                )}

                {nowPlaying.length > 0 && (
                  <ContentRow
                    title="Now Playing"
                    subtitle="In theaters now"
                    onViewAll={() => navigate('/?browse=1&sort=popular')}
                  >
                    {nowPlaying.map((movie) => (
                      <PosterCard
                        key={movie._id}
                        item={movie}
                        onClick={() => navigate(`/movie/${movie._id}`)}
                      />
                    ))}
                  </ContentRow>
                )}

                {trendingTVShows.length > 0 && (
                  <ContentRow
                    title="Trending TV Shows"
                    subtitle="Most watched series this week"
                    onViewAll={() => navigate('/?type=tvshows&sort=popular')}
                  >
                    {trendingTVShows.map((show) => (
                      <PosterCard
                        key={show._id}
                        item={show}
                        kind="tvshow"
                        onClick={() =>
                          navigate(`/tvshow/${show._id}`, withReturnPath(location))
                        }
                      />
                    ))}
                  </ContentRow>
                )}

                {topRatedMovies.length > 0 && (
                  <ContentRow
                    title="Top Rated Movies"
                    subtitle="Critically acclaimed all-time greats"
                    onViewAll={() => navigate('/?browse=1&sort=rated')}
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
              </>
            )}

            {error && (
              <div className="error-state" style={{ padding: '2rem' }}>
                <p>{error}</p>
              </div>
            )}
          </div>
        </>
    </div>
  );

  const renderBrowse = () => {
    const filterCount = [selectedGenre, selectedYear, comingSoonOnly || null].filter(Boolean).length;

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
            {comingSoonOnly ? ' · Coming Soon' : ''}
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

          {(searchTerm || selectedGenre || selectedYear || comingSoonOnly) && (
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
          { id: 'popular', label: 'Popular' },
          { id: 'latest', label: 'Newest' },
          { id: 'rated', label: 'Top rated' },
          { id: 'az', label: 'A – Z' }
        ].map((option) => (
          <button
            key={option.id}
            type="button"
            className={`browse-sort-chip${sortBy === option.id ? ' is-active' : ''}`}
            onClick={() => {
              setSortBy(option.id);
              setCurrentPage(1);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className={`browse-filters-panel${filtersOpen ? ' is-open' : ''}`}>
        <div className="browse-filters-grid">
          <div className="browse-filters-block">
            <h3 className="browse-filters-heading">Categories</h3>
            <div className="browse-filters-chips">
              <button
                type="button"
                className={`browse-chip${comingSoonOnly ? ' is-active' : ''}`}
                onClick={() => handleComingSoonSelect(true)}
              >
                Coming Soon
              </button>
            </div>
          </div>

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

      {(searchTerm || selectedGenre || selectedYear || comingSoonOnly) && (
        <div className="browse-active-note">
          {searchTerm && <span>Search: {searchTerm}</span>}
          {comingSoonOnly && <span>Category: Coming Soon</span>}
          {selectedGenre && <span>Genre: {selectedGenre}</span>}
          {selectedYear && <span>Year: {selectedYear}</span>}
        </div>
      )}

      <div id="movies-section" className="browse-shelf-body">
        {loading || catalogWaitingForBatch ? (
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
              onClick={() =>
                fetchCatalogBatch(batchIndexForPage(currentPage)).catch((err) => {
                  setError(err.message || 'Failed to load catalog. Please try again.');
                })
              }
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
