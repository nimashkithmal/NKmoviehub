import React, { useState, useEffect, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import MoviePlayer from './MoviePlayer';
import { getMoviePlaceholder, handleImageError } from '../utils/placeholderImage';
import './MovieDetail.css';

const FAV_KEY = 'nk_favorite_movies';

const readFavorites = () => {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

const extractEmbedIds = (url = '') => {
  const tmdb =
    url.match(/2embed\.[^/]+\/embed\/(\d+)/i)?.[1] ||
    url.match(/2embed\.[^/]+\/movie\/(\d+)/i)?.[1] ||
    null;
  const imdb = url.match(/2embed\.[^/]+\/embed\/(tt\d+)/i)?.[1] || null;
  return { tmdb, imdb };
};

const formatMoney = (value) => {
  const n = Number(value) || 0;
  if (n <= 0) return null;
  if (n >= 1e6) return `$${Math.round(n / 1e6)}M`;
  if (n >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${n}`;
};

const formatRuntime = (minutes) => {
  const m = Number(minutes) || 0;
  if (m <= 0) return null;
  const h = Math.floor(m / 60);
  const mins = m % 60;
  if (h <= 0) return `${mins}m`;
  return mins ? `${h}h ${mins}m` : `${h}h`;
};

const formatDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const languageLabel = (code) => {
  if (!code) return null;
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) || code;
  } catch {
    return code;
  }
};

const MovieDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [movie, setMovie] = useState(null);
  const [extras, setExtras] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [askMessage, setAskMessage] = useState('');
  const [askSending, setAskSending] = useState(false);
  const [askStatus, setAskStatus] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchMovieDetails();
    fetchQuestions();
    setExtras(null);
    setShowTrailer(false);
    setChatOpen(false);
    setAskMessage('');
    setAskStatus({ type: '', text: '' });
    setIsFavorite(readFavorites().includes(id));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!chatOpen || !id) return undefined;
    const timer = setInterval(fetchQuestions, 15000);
    return () => clearInterval(timer);
  }, [chatOpen, id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!movie?.movieUrl) return undefined;

    const { tmdb, imdb } = extractEmbedIds(movie.movieUrl);
    if (!tmdb && !imdb) return undefined;

    const controller = new AbortController();
    const loadExtras = async () => {
      try {
        const query = tmdb ? `tmdb_id=${tmdb}` : `imdb_id=${imdb}`;
        const response = await fetch(`https://api.2embed.cc/movie?${query}`, {
          signal: controller.signal
        });
        if (!response.ok) return;
        const data = await response.json();
        if (data && !data.error) setExtras(data);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Error fetching movie extras:', err);
        }
      }
    };

    loadExtras();
    return () => controller.abort();
  }, [movie?.movieUrl]);

  const fetchMovieDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/movies/${id}`);

      if (!response.ok) {
        throw new Error('Movie not found');
      }

      const result = await response.json();

      if (result.success) {
        setMovie(result.data.movie);
      } else {
        throw new Error(result.message || 'Failed to fetch movie');
      }
    } catch (err) {
      console.error('Error fetching movie:', err);
      setError(err.message || 'Failed to load movie. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchQuestions = async () => {
    try {
      const response = await fetch(`/api/movies/${id}/questions`);
      const result = await response.json();
      if (result.success) {
        setQuestions(result.data.questions || []);
      }
    } catch (err) {
      console.error('Error fetching questions:', err);
    }
  };

  const posterSrc = useMemo(() => {
    if (!movie) return '';
    if (extras?.poster) return extras.poster;
    if (movie.images?.length) return movie.images[0];
    if (movie.imageUrl?.startsWith('http')) return movie.imageUrl;
    return getMoviePlaceholder(movie.title, 400, 600);
  }, [movie, extras]);

  const backdropSrc = useMemo(() => {
    if (!movie) return '';
    if (movie.bannerUrl) return movie.bannerUrl;
    if (extras?.backdrops?.length) return extras.backdrops[0];
    return posterSrc;
  }, [movie, extras, posterSrc]);

  const genreList = useMemo(() => {
    if (Array.isArray(extras?.genres) && extras.genres.length) {
      return extras.genres.map((g) => String(g).trim()).filter(Boolean);
    }
    if (!movie?.genre) return [];
    return movie.genre.split(/[,|/]/).map((g) => g.trim()).filter(Boolean);
  }, [movie, extras]);

  const directors = useMemo(() => {
    if (movie?.director?.trim()) return [movie.director.trim()];
    const crew = extras?.crew || extras?.cast_crew?.crew || [];
    return crew.filter((c) => c.job === 'Director').map((c) => c.name).filter(Boolean);
  }, [movie, extras]);

  const cast = useMemo(() => {
    const list = extras?.cast || extras?.cast_crew?.cast || [];
    return list.slice(0, 12);
  }, [extras]);

  const trailerUrl = movie?.trailerUrl || extras?.trailer || null;
  const overview = extras?.overview || movie?.description || '';
  const tagline = movie?.tagline || extras?.tagline || '';
  const runtimeLabel = formatRuntime(movie?.runtime ?? extras?.runtime);
  const releaseLabel =
    formatDate(movie?.releaseDate || extras?.release_date) || movie?.year || null;
  const language =
    (movie?.language && String(movie.language).trim()) ||
    languageLabel(extras?.original_language);
  const budget = formatMoney(movie?.budget ?? extras?.budget);
  const revenue = formatMoney(movie?.revenue ?? extras?.revenue);
  const statusLabel =
    movie?.status === 'coming_soon'
      ? 'Coming Soon'
      : movie?.releaseStatus ||
        extras?.status ||
        (movie?.status === 'active' ? 'Released' : movie?.status);

  const toggleFavorite = () => {
    const next = new Set(readFavorites());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    localStorage.setItem(FAV_KEY, JSON.stringify(Array.from(next)));
    setIsFavorite(next.has(id));
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    const shareData = {
      title: movie?.title || 'NK Movie Hub',
      text: movie?.title ? `Watch ${movie.title} on NK Movie Hub` : 'NK Movie Hub',
      url: shareUrl
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // ignore cancel / clipboard failures
    }
  };

  const handleAskSubmit = async (e) => {
    e.preventDefault();
    const message = askMessage.trim();
    if (!message) {
      setAskStatus({ type: 'error', text: 'Type a question first.' });
      return;
    }

    setAskSending(true);
    setAskStatus({ type: '', text: '' });
    try {
      const response = await fetch(`/api/movies/${id}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to send question');
      }
      if (result.data?.question) {
        setQuestions((prev) => [...prev, result.data.question]);
      } else {
        await fetchQuestions();
      }
      setAskMessage('');
      setAskStatus({ type: 'success', text: '' });
    } catch (err) {
      setAskStatus({
        type: 'error',
        text: err.message || 'Could not send your question. Try again.'
      });
    } finally {
      setAskSending(false);
    }
  };

  if (loading) {
    return (
      <div className="movie-detail-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <h3>Loading movie details...</h3>
        </div>
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="movie-detail-container">
        <div className="error-state">
          <h3>Error loading movie</h3>
          <p>{error || 'Movie not found'}</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const imdb = Number(movie.imdbRating) || Number(extras?.vote_average) || 0;
  const userAvg = Number(movie.averageRating) || 0;
  const ratingValue = imdb || userAvg;

  const detailItems = [
    directors.length ? { label: 'Director', value: directors.join(', ') } : null,
    directors.length ? { label: '', value: '', spacer: true } : null,
    statusLabel ? { label: 'Status', value: statusLabel } : null,
    language ? { label: 'Language', value: language } : null,
    budget ? { label: 'Budget', value: budget } : null,
    revenue ? { label: 'Revenue', value: revenue } : null
  ].filter((item) => item && (item.spacer || item.value));

  return (
    <>
      {showPlayer && movie && (
        <MoviePlayer movie={movie} onClose={() => setShowPlayer(false)} />
      )}

      {showTrailer && trailerUrl && (
        <div className="md-trailer-overlay" onClick={() => setShowTrailer(false)}>
          <div className="md-trailer-modal" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="md-trailer-close"
              onClick={() => setShowTrailer(false)}
              aria-label="Close trailer"
            >
              ×
            </button>
            <iframe
              title={`${movie.title} trailer`}
              src={`${trailerUrl}${trailerUrl.includes('?') ? '&' : '?'}autoplay=1`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}

      <div className="md-page">
        <section className="md-hero" aria-hidden="true">
          <img className="md-hero-img" src={backdropSrc} alt="" />
          <div className="md-hero-fade" />
        </section>

        <header className="md-topbar">
          <button
            type="button"
            className="md-icon-btn"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
            </svg>
          </button>

          <Link to="/" className="md-brand" aria-label="NK Movie Hub home">
            NK Movie Hub
          </Link>

          <div className="md-topbar-actions">
            <button
              type="button"
              className={`md-icon-btn${isFavorite ? ' is-active' : ''}`}
              onClick={toggleFavorite}
              aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              aria-pressed={isFavorite}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d={
                    isFavorite
                      ? 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z'
                      : 'M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z'
                  }
                />
              </svg>
            </button>
            <button
              type="button"
              className="md-icon-btn"
              onClick={handleShare}
              aria-label="Share"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z" />
              </svg>
            </button>
          </div>
        </header>

        <section className="md-body">
          <div className="md-body-inner">
            <div className="md-poster-col">
              <div className="md-poster">
                <img
                  src={posterSrc}
                  alt={movie.title}
                  onError={(e) => handleImageError(e, movie.title)}
                />
              </div>
            </div>

            <div className="md-copy">
              <h1 className="md-title">{movie.title}</h1>
              {tagline && <p className="md-tagline">{tagline}</p>}

              <div className="md-meta-row">
                {ratingValue > 0 && (
                  <span className="md-meta-item">
                    <svg className="md-meta-star" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 2l2.9 6.9L22 9.2l-5.5 4.8L18.2 22 12 18.3 5.8 22l1.7-8L2 9.2l7.1-.3L12 2z" />
                    </svg>
                    {Number(ratingValue).toFixed(1)}
                    {movie.totalRatings > 0 ? ` (${movie.totalRatings.toLocaleString()})` : ''}
                  </span>
                )}
                {releaseLabel && (
                  <span className="md-meta-item">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z" />
                    </svg>
                    {releaseLabel}
                  </span>
                )}
                {runtimeLabel && (
                  <span className="md-meta-item">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
                    </svg>
                    {runtimeLabel}
                  </span>
                )}
              </div>

              {genreList.length > 0 && (
                <div className="md-genres">
                  {genreList.map((g) => (
                    <span key={g} className="md-genre-pill">
                      {g}
                    </span>
                  ))}
                </div>
              )}

              <div className="md-actions">
                {movie.status === 'coming_soon' ? (
                  <button
                    type="button"
                    className="md-btn md-btn-coming-soon"
                    disabled
                    aria-disabled="true"
                  >
                    Coming Soon
                  </button>
                ) : (
                  movie.movieUrl && (
                    <button
                      type="button"
                      className="md-btn md-btn-primary"
                      onClick={() => setShowPlayer(true)}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      Watch Now
                    </button>
                  )
                )}
                {trailerUrl && (
                  <button
                    type="button"
                    className="md-btn md-btn-secondary"
                    onClick={() => setShowTrailer(true)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    Watch Trailer
                  </button>
                )}
              </div>
            </div>
          </div>

          {overview && (
            <div className="md-overview">
              <h2 className="md-section-title">Overview</h2>
              <p>{overview}</p>
            </div>
          )}

          <div className="md-ask-wrap">
            {!chatOpen ? (
              <div className="md-ask-card">
                <div className="md-ask-card-main">
                  <div className="md-ask-card-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="md-ask-card-title">Ask About This Movie</h2>
                    <p className="md-ask-card-sub">
                      Ask anything about this movie — themes, characters, trivia...
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="md-ask-start"
                  onClick={() => setChatOpen(true)}
                >
                  Start Chat
                </button>
              </div>
            ) : (
              <div className="md-ask-panel">
                <div className="md-ask-panel-head">
                  <div className="md-ask-panel-title">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <span>Ask About This Movie</span>
                  </div>
                  <button
                    type="button"
                    className="md-ask-hide"
                    onClick={() => setChatOpen(false)}
                  >
                    Hide
                  </button>
                </div>

                <div className="md-ask-thread">
                  {questions.length === 0 ? (
                    <p className="md-ask-empty">Ask anything — themes, characters, trivia...</p>
                  ) : (
                    questions.map((q) => (
                      <div key={q._id} className="md-ask-qa">
                        <div className="md-ask-q">
                          <span className="md-ask-bubble-label">Q</span>
                          <p>{q.question}</p>
                        </div>
                        {q.answer ? (
                          <div className="md-ask-a">
                            <span className="md-ask-bubble-label">A</span>
                            <p>{q.answer}</p>
                          </div>
                        ) : (
                          <div className="md-ask-pending">Waiting for admin reply...</div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <form className="md-ask-compose" onSubmit={handleAskSubmit}>
                  <input
                    type="text"
                    value={askMessage}
                    onChange={(e) => setAskMessage(e.target.value)}
                    placeholder="Ask about the movie..."
                    maxLength={2000}
                    disabled={askSending}
                  />
                  <button
                    type="submit"
                    className="md-ask-send"
                    disabled={askSending || !askMessage.trim()}
                    aria-label="Send question"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                  </button>
                </form>
                {askStatus.text && (
                  <p className={`md-ask-status is-${askStatus.type}`}>{askStatus.text}</p>
                )}
              </div>
            )}
          </div>

          {detailItems.length > 0 && (
            <div className="md-facts">
              {detailItems.map((item, index) =>
                item.spacer ? (
                  <div key={`spacer-${index}`} className="md-fact md-fact-spacer" aria-hidden="true" />
                ) : (
                  <div key={item.label} className="md-fact">
                    <span className="md-fact-label">{item.label}</span>
                    <span className="md-fact-value">{item.value}</span>
                  </div>
                )
              )}
            </div>
          )}

          {cast.length > 0 && (
            <div className="md-cast">
              <h2 className="md-section-title">Cast</h2>
              <div className="md-cast-grid">
                {cast.map((person) => (
                  <article key={`${person.name}-${person.character}`} className="md-cast-card">
                    <div className="md-cast-photo">
                      {person.profile ? (
                        <img src={person.profile} alt={person.name} loading="lazy" />
                      ) : (
                        <span aria-hidden="true">👤</span>
                      )}
                    </div>
                    <h3 className="md-cast-name">{person.name}</h3>
                    {person.character && (
                      <p className="md-cast-role">{person.character}</p>
                    )}
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
};

export default MovieDetail;
