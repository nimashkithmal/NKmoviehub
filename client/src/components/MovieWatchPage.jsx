import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { getMoviePlaceholder, handleImageError } from '../utils/placeholderImage';
import { trackWatchClick } from '../utils/analytics';
import { setDetailPageMeta } from '../utils/seo';
import { buildEmbedSourcesFromUrl, getEmbedPlayableUrl } from '../utils/embedSources';
import { goBackOr } from '../utils/navigation';
import { readMovieWatchCache, writeMovieWatchCache } from '../utils/movieWatchCache';
import './TVWatchPage.css';
import './MovieWatchPage.css';

const PLAYER_LOADING_TIMEOUT_MS = 10000;
const PRECONNECT_HOSTS = [
  'https://www.2embed.cc',
  'https://vidsrc.to',
  'https://vidsrc.me',
  'https://image.tmdb.org'
];

const MovieWatchPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSourceId, setActiveSourceId] = useState('server-1');
  const [playerLoading, setPlayerLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  const trackedMovieRef = useRef('');
  const preconnectedRef = useRef(false);
  const lastEmbedUrlRef = useRef('');

  useEffect(() => {
    if (preconnectedRef.current) return;
    preconnectedRef.current = true;
    PRECONNECT_HOSTS.forEach((href) => {
      if (document.querySelector(`link[rel="preconnect"][href="${href}"]`)) return;
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = href;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    const applyMovie = (data) => {
      if (!cancelled && data) {
        setMovie(data);
        setLoading(false);
      }
    };

    const cached = readMovieWatchCache(id);
    if (cached) {
      applyMovie(cached);
    } else {
      setLoading(true);
    }

    const fetchMovie = async () => {
      try {
        setError(null);
        let response = await fetch(`/api/movies/${id}/watch`);
        if (!response.ok && response.status === 404) {
          response = await fetch(`/api/movies/${id}`);
        }
        if (!response.ok) throw new Error('Movie not found');
        const result = await response.json();
        if (!result.success) throw new Error(result.message || 'Failed to load movie');
        const payload = result.data.movie;
        writeMovieWatchCache(id, payload);
        applyMovie(payload);
      } catch (err) {
        if (!cancelled && !cached) {
          setError(err.message || 'Failed to load movie');
          setLoading(false);
        }
      }
    };

    fetchMovie();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const embedSources = useMemo(() => {
    if (!movie?.movieUrl) return [];
    const sources = buildEmbedSourcesFromUrl(movie.movieUrl);
    if (sources.length) return sources;
    const playable = getEmbedPlayableUrl(movie.movieUrl) || movie.movieUrl;
    return playable ? [{ id: 'server-1', label: 'Server 1', url: playable }] : [];
  }, [movie]);

  const activeSource = useMemo(() => {
    if (!embedSources.length) return null;
    return embedSources.find((source) => source.id === activeSourceId) || embedSources[0];
  }, [embedSources, activeSourceId]);

  const embedUrl = activeSource?.url || '';

  useEffect(() => {
    if (!embedSources.length) return;
    const hasActive = embedSources.some((source) => source.id === activeSourceId);
    if (!hasActive) {
      setActiveSourceId(embedSources[0].id);
      return;
    }
    if (embedUrl && embedUrl !== lastEmbedUrlRef.current) {
      lastEmbedUrlRef.current = embedUrl;
      setPlayerLoading(true);
    }
  }, [embedSources, activeSourceId, embedUrl]);

  useEffect(() => {
    if (!playerLoading) return undefined;
    const timeoutId = window.setTimeout(() => {
      setPlayerLoading(false);
    }, PLAYER_LOADING_TIMEOUT_MS);
    return () => window.clearTimeout(timeoutId);
  }, [playerLoading, embedUrl, activeSourceId]);

  useEffect(() => {
    if (!movie?._id) return;
    setDetailPageMeta({
      title: `${movie.title} — Watch`,
      description: movie.description,
      image: movie.bannerUrl || movie.imageUrl,
      pathname: `/watch/movie/${id}`,
      type: 'video.movie'
    });
    if (trackedMovieRef.current === movie._id) return;
    trackedMovieRef.current = movie._id;
    trackWatchClick({
      contentType: 'movie',
      itemId: movie._id,
      itemName: movie.title
    });
  }, [
    movie?._id,
    movie?.title,
    movie?.description,
    movie?.bannerUrl,
    movie?.imageUrl,
    id
  ]);

  const handleBack = () => {
    goBackOr(navigate, location, `/movie/${id}`);
  };

  const switchSource = (source) => {
    if (!source || source.id === activeSourceId) return;
    setActiveSourceId(source.id);
    setPlayerLoading(true);
  };

  const reloadPlayer = () => {
    setPlayerLoading(true);
    setReloadToken((value) => value + 1);
  };

  if (loading && !movie) {
    return (
      <div className="tv-watch-page movie-watch-page">
        <div className="tv-watch-loading">
          <div className="loading-spinner" />
          <p>Loading movie…</p>
        </div>
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="tv-watch-page movie-watch-page">
        <div className="tv-watch-error">
          <h2>Unable to load movie</h2>
          <p>{error || 'Movie not found'}</p>
          <button type="button" className="tv-watch-back-btn" onClick={() => navigate('/')}>
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (movie.status === 'coming_soon') {
    return (
      <div className="tv-watch-page movie-watch-page">
        <div className="tv-watch-error">
          <h2>{movie.title}</h2>
          <p>This movie is coming soon.</p>
          <button type="button" className="tv-watch-back-btn" onClick={handleBack}>
            Back to details
          </button>
        </div>
      </div>
    );
  }

  const posterSrc =
    movie.imageUrl || movie.images?.[0] || getMoviePlaceholder(movie.title);
  const ratingValue = Number(movie.imdbRating) || 0;
  return (
    <div className="tv-watch-page movie-watch-page">
      <header className="tv-watch-topbar">
        <button type="button" className="tv-watch-back-btn" onClick={handleBack}>
          ← Back
        </button>

        <div className="tv-watch-topbar-center">
          <h1>{movie.title}</h1>
          <p>
            {movie.year || ''}
            {movie.genre ? ` · ${movie.genre}` : ''}
          </p>
        </div>

        <div className="tv-watch-topbar-right">
          {embedSources.length > 1 && (
            <label className="tv-watch-server-select">
              <span>Server:</span>
              <select
                value={activeSourceId}
                onChange={(e) => {
                  const source = embedSources.find((s) => s.id === e.target.value);
                  if (source) switchSource(source);
                }}
              >
                {embedSources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            className="tv-watch-refresh-btn"
            onClick={reloadPlayer}
            aria-label="Reload player"
          >
            ↻
          </button>
        </div>
      </header>

      <main className="movie-watch-main">
        <div className="tv-watch-player-shell">
          {playerLoading && embedUrl && (
            <div className="tv-watch-player-loading">
              <div className="loading-spinner" />
              <p>Loading player…</p>
            </div>
          )}

          {!embedUrl ? (
            <div className="tv-watch-player-empty">
              <p>No playable stream found for this movie.</p>
            </div>
          ) : (
            <iframe
              key={`${activeSourceId}-${reloadToken}`}
              title={`${movie.title} player`}
              src={embedUrl}
              className={`tv-watch-iframe${playerLoading ? ' is-loading' : ''}`}
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              onLoad={() => setPlayerLoading(false)}
            />
          )}
        </div>

        <div className="tv-watch-show-bar">
          <div>
            <h2>{movie.title}</h2>
            <p>
              {movie.year || ''}
              {ratingValue > 0 && (
                <>
                  {' '}
                  · ★ {ratingValue.toFixed(1)}
                </>
              )}
              {movie.runtime ? ` · ${movie.runtime} min` : ''}
            </p>
          </div>
          <button type="button" className="tv-watch-details-btn" onClick={handleBack}>
            View Details
          </button>
        </div>

        <article className="tv-watch-episode-card movie-watch-info-card">
          <img
            src={posterSrc}
            alt=""
            onError={(e) => handleImageError(e, movie.title)}
          />
          <div>
            <h3>{movie.title}</h3>
            <p>{movie.description}</p>
          </div>
        </article>

        {embedSources.length > 0 && (
          <div className="tv-watch-server-panel">
            <p className="tv-watch-server-try">Try another server:</p>
            <div className="tv-watch-server-list">
              {embedSources.map((source) => (
                <button
                  key={source.id}
                  type="button"
                  className={`tv-watch-server-btn${
                    activeSourceId === source.id ? ' is-active' : ''
                  }`}
                  onClick={() => switchSource(source)}
                >
                  {activeSourceId === source.id ? '★ ' : ''}
                  {source.label}
                </button>
              ))}
            </div>
            <p className="tv-watch-server-tip">
              If a server doesn&apos;t load, try another.{' '}
              <span className="tv-watch-server-tip-alert">
                Install uBlock Origin to block ads.
              </span>
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default MovieWatchPage;
