import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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

const formatMessageDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
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
  const [questions, setQuestions] = useState([]);
  const [askMessage, setAskMessage] = useState('');
  const [askName, setAskName] = useState('');
  const [askEmail, setAskEmail] = useState('');
  const [askSending, setAskSending] = useState(false);
  const [askStatus, setAskStatus] = useState({ type: '', text: '' });
  const chatThreadRef = useRef(null);

  useEffect(() => {
    fetchMovieDetails();
    setExtras(null);
    setShowTrailer(false);
    setQuestions([]);
    setAskMessage('');
    setAskName('');
    setAskEmail('');
    setAskStatus({ type: '', text: '' });
    setIsFavorite(readFavorites().includes(id));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchQuestions = useCallback(async () => {
    if (!id) return;
    try {
      const response = await fetch(`/api/movies/${id}/questions`);
      const result = await response.json();
      if (result.success) {
        setQuestions(result.data.questions || []);
      }
    } catch (err) {
      console.error('Error fetching questions:', err);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return undefined;
    fetchQuestions();
    const timer = setInterval(fetchQuestions, 15000);
    return () => clearInterval(timer);
  }, [id, fetchQuestions]);

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

  const chatMessages = useMemo(() => {
    const items = [];
    for (const q of questions) {
      items.push({
        id: `${q._id}-q`,
        role: 'user',
        text: q.question,
        at: q.createdAt
      });
      if (q.answer) {
        items.push({
          id: `${q._id}-a`,
          role: 'admin',
          text: q.answer,
          at: q.answeredAt || q.createdAt
        });
      }
    }
    return items;
  }, [questions]);

  useEffect(() => {
    if (!chatThreadRef.current) return;
    chatThreadRef.current.scrollTop = chatThreadRef.current.scrollHeight;
  }, [chatMessages]);

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

  const openSocialShare = (platform) => {
    const shareUrl = window.location.href;
    const title = movie?.title ? `Watch ${movie.title} on NK Movie Hub` : 'NK Movie Hub';
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedTitle = encodeURIComponent(title);

    const urls = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`${title} ${shareUrl}`)}`,
      pinterest: `https://pinterest.com/pin/create/button/?url=${encodedUrl}&description=${encodedTitle}`,
      tumblr: `https://www.tumblr.com/share/link?url=${encodedUrl}&name=${encodedTitle}`
    };

    const target = urls[platform];
    if (!target) return;
    window.open(target, '_blank', 'noopener,noreferrer,width=640,height=480');
  };

  const handleAskSubmit = async (e) => {
    e.preventDefault();
    const message = askMessage.trim();
    if (!message) {
      setAskStatus({ type: 'error', text: 'Write a comment first.' });
      return;
    }

    setAskSending(true);
    setAskStatus({ type: '', text: '' });
    try {
      const response = await fetch(`/api/movies/${id}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          fromName: askName.trim(),
          fromEmail: askEmail.trim()
        })
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

          <div className="md-comments-wrap">
            <h2 className="md-section-title">Comments</h2>

            <form className="md-comments-form" onSubmit={handleAskSubmit}>
              <textarea
                className="md-comments-textarea"
                value={askMessage}
                onChange={(e) => setAskMessage(e.target.value)}
                placeholder="Write a comment.."
                rows={5}
                maxLength={2000}
                disabled={askSending}
              />
              <div className="md-comments-fields">
                <input
                  type="text"
                  value={askName}
                  onChange={(e) => setAskName(e.target.value)}
                  placeholder="Display Name"
                  maxLength={100}
                  disabled={askSending}
                />
                <input
                  type="email"
                  value={askEmail}
                  onChange={(e) => setAskEmail(e.target.value)}
                  placeholder="Email Address"
                  maxLength={120}
                  disabled={askSending}
                />
              </div>
              <div className="md-comments-actions">
                <button
                  type="submit"
                  className="md-comments-submit"
                  disabled={askSending || !askMessage.trim()}
                >
                  {askSending ? 'Posting…' : 'Post comment'}
                </button>
              </div>
              {askStatus.text && (
                <p className={`md-ask-status is-${askStatus.type}`}>{askStatus.text}</p>
              )}
            </form>

            <div className="md-ask-feed" ref={chatThreadRef}>
              {chatMessages.length === 0 ? (
                <p className="md-ask-empty">No comments yet. Be the first to comment.</p>
              ) : (
                chatMessages.map((msg) => (
                  <article key={msg.id} className={`md-msg-item is-${msg.role}`}>
                    <div className="md-msg-avatar" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v1.2h19.2v-1.2c0-3.2-6.4-4.8-9.6-4.8z" />
                      </svg>
                    </div>
                    <div className="md-msg-body">
                      <div className="md-msg-meta">
                        {msg.role === 'admin' && (
                          <span className="md-msg-author">NK Movie Hub</span>
                        )}
                        <time dateTime={msg.at}>{formatMessageDate(msg.at)}</time>
                      </div>
                      <p className="md-msg-text">{msg.text}</p>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>

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

          <div className="md-share-bar">
            <div className="md-share-label">
              <span>Share</span>
            </div>
            <div className="md-share-buttons">
              <button
                type="button"
                className="md-share-btn is-facebook"
                onClick={() => openSocialShare('facebook')}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M14 8.5V6.8c0-.7.5-1.3 1.2-1.3H17V3h-2.4C12.8 3 12 4.8 12 6.5V8.5H9v2.3h3V18h3v-7.2h2.5l.5-2.3H15z" />
                </svg>
                Facebook
              </button>
              <button
                type="button"
                className="md-share-btn is-twitter"
                onClick={() => openSocialShare('twitter')}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20.2 4.2c-.7.3-1.4.5-2.2.6.8-.5 1.3-1.2 1.6-2.1-.7.4-1.5.7-2.4.9C16.9 2.8 16 2.4 15 2.4c-2.1 0-3.8 1.7-3.8 3.8 0 .3 0 .6.1.9-3.1-.2-5.9-1.7-7.7-4-.3.6-.5 1.2-.5 1.9 0 1.3.7 2.5 1.7 3.2-.6 0-1.2-.2-1.7-.5v.1c0 1.8 1.3 3.4 3 3.7-.3.1-.7.1-1 .1-.2 0-.5 0-.7-.1.5 1.5 1.9 2.6 3.6 2.6-1.3 1-3 1.6-4.8 1.6-.3 0-.6 0-.9-.1 1.7 1.1 3.7 1.7 5.9 1.7 7.1 0 11-5.9 11-11v-.5c.8-.5 1.4-1.2 2-2z" />
                </svg>
                Twitter
              </button>
              <button
                type="button"
                className="md-share-btn is-icon is-whatsapp"
                onClick={() => openSocialShare('whatsapp')}
                aria-label="Share on WhatsApp"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M17.5 13.4c-.3-.1-1.6-.8-1.9-.9-.3-.1-.5-.1-.7.2-.2.3-.8 1-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.4-2.3-1.4-.8-.7-1.4-1.6-1.6-1.9-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.2.1-.3 0-.5-.1-.2-.7-1.7-1-2.3-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.7.3-.2.3-1 1-1 2.4s1 2.8 1.1 3c.1.2 2 3 4.8 4.2.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.6-.7 1.8-1.3.2-.6.2-1.2.2-1.3-.1-.1-.3-.2-.6-.3z" />
                  <path d="M12 2C6.5 2 2 6.1 2 11.2c0 2 .6 3.9 1.6 5.5L2 22l5.5-1.5c1.5.8 3.2 1.3 4.9 1.3 5.5 0 10-4.1 10-9.2S17.5 2 12 2zm0 16.8c-1.5 0-3-.4-4.3-1.2l-.3-.2-3.2.9.9-3.1-.2-.3c-.9-1.3-1.4-2.8-1.4-4.4 0-4.3 3.9-7.8 8.7-7.8s8.7 3.5 8.7 7.8-3.9 7.8-8.7 7.8z" />
                </svg>
              </button>
              <button
                type="button"
                className="md-share-btn is-icon is-pinterest"
                onClick={() => openSocialShare('pinterest')}
                aria-label="Share on Pinterest"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2C6.5 2 2 6.5 2 12c0 4.1 2.5 7.6 6 9.2-.1-.8-.1-2 .2-3 .2-.9 1.5-5.8 1.5-5.8s-.4-.8-.4-2c0-1.9 1.1-3.3 2.5-3.3 1.2 0 1.7.9 1.7 2 0 1.2-.8 3-1.2 4.7-.3 1.4.7 2.6 2.1 2.6 2.5 0 4.4-2.6 4.4-6.4 0-3.3-2.4-5.6-5.8-5.6-4 0-6.3 3-6.3 6.1 0 1.2.5 2.5 1.1 3.2.1.1.1.2.1.3l-.4 1.7c-.1.4-.3.5-.7.3-2.6-1.2-4.2-5-4.2-8 0-6.5 4.7-12.5 13.6-12.5 7.1 0 12.7 5.1 12.7 11.9 0 7.1-4.5 12.8-10.7 12.8-2.1 0-4.1-1.1-4.8-2.4l-1.3 5c-.5 1.9-1.8 4.3-2.7 5.8.6.2 1.3.3 2 .3 5.5 0 10-4.5 10-10S17.5 2 12 2z" />
                </svg>
              </button>
              <button
                type="button"
                className="md-share-btn is-icon is-tumblr"
                onClick={() => openSocialShare('tumblr')}
                aria-label="Share on Tumblr"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M14.7 17.3V20c-1.4.7-2.6 1-3.8 1-3.7 0-5.4-2.1-5.4-6.2V8.3H3.5V5.4c2.4-.8 3.5-2.7 3.7-5.2h3.1v4.2h4.1v3.4h-4.1v6.1c0 1.5.7 2.2 2.1 2.2.8 0 1.6-.2 2.4-.6z" />
                </svg>
              </button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

export default MovieDetail;
