import React, { useState, useEffect, useMemo } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { getMoviePlaceholder, handleImageError } from '../utils/placeholderImage';
import { trackContentView, trackWatchClick } from '../utils/analytics';
import { setDetailPageMeta } from '../utils/seo';
import { toTrailerEmbedUrl } from '../utils/trailerUrl';
import { getTvShowTmdbId } from '../utils/tvEpisodes';
import { goBackOr, withReturnPath } from '../utils/navigation';
import './MovieDetail.css';

const formatDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
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

const TVShowDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [tvShow, setTVShow] = useState(null);
  const [extras, setExtras] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showTrailer, setShowTrailer] = useState(false);

  useEffect(() => {
    fetchTVShowDetails();
    setExtras(null);
    setShowTrailer(false);
  }, [id]);

  useEffect(() => {
    if (!tvShow?._id) return;
    setDetailPageMeta({
      title: tvShow.year ? `${tvShow.title} (${tvShow.year})` : tvShow.title,
      description: tvShow.description,
      image: tvShow.bannerUrl || tvShow.imageUrl,
      pathname: `/tvshow/${id}`,
      type: 'video.tv_show'
    });
    trackContentView({
      contentType: 'tv_show',
      itemId: tvShow._id,
      itemName: tvShow.title
    });
  }, [tvShow?._id, tvShow?.title, tvShow?.year, tvShow?.description, tvShow?.bannerUrl, tvShow?.imageUrl, id]);

  useEffect(() => {
    const tmdbId = tvShow ? getTvShowTmdbId(tvShow) : null;
    if (!tmdbId) return undefined;

    const controller = new AbortController();
    const loadExtras = async () => {
      try {
        const response = await fetch(`/api/embed/tv?tmdb_id=${tmdbId}`, {
          signal: controller.signal
        });
        if (!response.ok) return;
        const data = await response.json();
        if (data && !data.error) setExtras(data);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Error fetching TV extras:', err);
        }
      }
    };

    loadExtras();
    return () => controller.abort();
  }, [tvShow]);

  const fetchTVShowDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/tvshows/${id}`);
      if (!response.ok) throw new Error('TV Show not found');
      const result = await response.json();
      if (!result.success) throw new Error(result.message || 'Failed to fetch TV show');
      setTVShow(result.data.tvShow);
    } catch (err) {
      console.error('Error fetching TV show:', err);
      setError(err.message || 'Failed to load TV show. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const cast = useMemo(() => {
    const list = extras?.cast || extras?.cast_crew?.cast || [];
    return list.slice(0, 12);
  }, [extras]);

  const posterSrc = useMemo(() => {
    if (!tvShow) return '';
    if (extras?.poster) return extras.poster;
    if (tvShow.images?.length) return tvShow.images[0];
    if (tvShow.imageUrl?.startsWith('http')) return tvShow.imageUrl;
    return getMoviePlaceholder(tvShow.title || 'TV Show', 400, 600);
  }, [tvShow, extras]);

  const backdropSrc = useMemo(() => {
    if (!tvShow) return '';
    if (tvShow.bannerUrl) return tvShow.bannerUrl;
    if (extras?.backdrops?.length) return extras.backdrops[0];
    return posterSrc;
  }, [tvShow, extras, posterSrc]);

  if (loading) {
    return (
      <div className="movie-detail-container">
        <div className="loading-state">
          <div className="loading-spinner" />
          <h3>Loading TV show details...</h3>
        </div>
      </div>
    );
  }

  if (error || !tvShow) {
    return (
      <div className="movie-detail-container">
        <div className="error-state">
          <h3>Error loading TV show</h3>
          <p>{error || 'TV Show not found'}</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/')}>
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const tagline = tvShow.tagline || extras?.tagline || '';
  const overview = extras?.overview || tvShow.description || '';
  const trailerUrl = tvShow.trailerUrl || extras?.trailer || '';
  const ratingValue = Number(tvShow.imdbRating) || Number(extras?.vote_average) || 0;
  const releaseLabel = formatDate(tvShow.releaseDate) || tvShow.year || null;
  const language =
    (tvShow.language && String(tvShow.language).trim()) ||
    languageLabel(extras?.original_language);
  const statusLabel =
    tvShow.status === 'coming_soon'
      ? 'Coming Soon'
      : tvShow.releaseStatus ||
        extras?.status ||
        (tvShow.status === 'active' ? 'Returning Series' : tvShow.status);
  const genreList = (tvShow.genre || '')
    .split(',')
    .map((g) => g.trim())
    .filter(Boolean);
  const canWatch =
    tvShow.status !== 'coming_soon' &&
    (tvShow.showUrl || (tvShow.episodes && tvShow.episodes.length > 0));

  const metaPills = [
    tvShow.numberOfSeasons > 0 ? `${tvShow.numberOfSeasons} Season${tvShow.numberOfSeasons !== 1 ? 's' : ''}` : null,
    tvShow.episodeCount > 0 ? `${tvShow.episodeCount} Episodes` : null,
    statusLabel,
    ...genreList
  ].filter(Boolean);

  const detailItems = [
    tvShow.director ? { label: 'Created By', value: tvShow.director } : null,
    statusLabel ? { label: 'Status', value: statusLabel } : null,
    language ? { label: 'Language', value: language } : null,
    releaseLabel ? { label: 'First Aired', value: releaseLabel } : null
  ].filter(Boolean);

  const handleWatchNow = () => {
    trackWatchClick({
      contentType: 'tv_show',
      itemId: tvShow._id,
      itemName: tvShow.title
    });
    navigate(`/watch/tv/${id}?season=1&episode=1`, withReturnPath(location));
  };

  const handleBack = () => {
    goBackOr(navigate, location, '/?type=tvshows');
  };

  return (
    <>
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
              title={`${tvShow.title} trailer`}
              src={toTrailerEmbedUrl(trailerUrl)}
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
            onClick={handleBack}
            aria-label="Go back"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
            </svg>
          </button>

          <Link to="/" className="md-brand" aria-label="NK Movie Hub home">
            NK Movie Hub
          </Link>

          <div className="md-topbar-actions" />
        </header>

        <section className="md-body">
          <div className="md-body-inner">
            <div className="md-poster-col">
              <div className="md-poster md-poster-tv">
                <span className="md-poster-badge">TV SHOW</span>
                <img
                  src={posterSrc}
                  alt={tvShow.title}
                  onError={(e) => handleImageError(e, tvShow.title)}
                />
              </div>
            </div>

            <div className="md-copy">
              <h1 className="md-title">
                {tvShow.title}
                {tvShow.matureContent && (
                  <span className="mature-badge" title="Mature content — 18+">18+</span>
                )}
              </h1>
              {tagline && <p className="md-tagline">{tagline}</p>}

              <div className="md-meta-row">
                {ratingValue > 0 && (
                  <span className="md-meta-item">
                    <svg className="md-meta-star" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 2l2.9 6.9L22 9.2l-5.5 4.8L18.2 22 12 18.3 5.8 22l1.7-8L2 9.2l7.1-.3L12 2z" />
                    </svg>
                    {Number(ratingValue).toFixed(1)}
                    {tvShow.totalRatings > 0 ? ` (${tvShow.totalRatings.toLocaleString()})` : ''}
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
              </div>

              {metaPills.length > 0 && (
                <div className="md-genres">
                  {metaPills.map((pill) => (
                    <span key={pill} className="md-genre-pill">
                      {pill}
                    </span>
                  ))}
                </div>
              )}

              <div className="md-actions">
                {tvShow.status === 'coming_soon' ? (
                  <button type="button" className="md-btn md-btn-coming-soon" disabled>
                    Coming Soon
                  </button>
                ) : (
                  canWatch && (
                    <button type="button" className="md-btn md-btn-primary" onClick={handleWatchNow}>
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
              {detailItems.map((item) => (
                <div key={item.label} className="md-fact">
                  <span className="md-fact-label">{item.label}</span>
                  <span className="md-fact-value">{item.value}</span>
                </div>
              ))}
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
                    {person.character && <p className="md-cast-role">{person.character}</p>}
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

export default TVShowDetail;
