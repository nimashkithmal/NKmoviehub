import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MoviePlayer from './MoviePlayer';
import { getMoviePlaceholder, handleImageError } from '../utils/placeholderImage';
import './MovieDetail.css';

const MovieDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  useEffect(() => {
    fetchMovieDetails();
    setSelectedImageIndex(0);
  }, [id]);

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

  // Poster gallery only — never include the detail banner
  const galleryImages = useMemo(() => {
    if (!movie) return [];
    const banner = movie.bannerUrl || '';
    if (movie.images?.length) {
      return movie.images.filter((url) => url && url !== banner);
    }
    if (movie.imageUrl && movie.imageUrl !== banner) return [movie.imageUrl];
    return [];
  }, [movie]);

  const posterSrc = useMemo(() => {
    if (!movie) return '';
    if (galleryImages.length) return galleryImages[selectedImageIndex] || galleryImages[0];
    if (movie.imageUrl?.startsWith('http')) return movie.imageUrl;
    return getMoviePlaceholder(movie.title, 400, 600);
  }, [movie, galleryImages, selectedImageIndex]);

  const backdropSrc = useMemo(() => {
    if (!movie) return '';
    if (movie.bannerUrl) return movie.bannerUrl;
    return posterSrc;
  }, [movie, posterSrc]);

  const genreList = useMemo(() => {
    if (!movie?.genre) return [];
    return movie.genre.split(/[,|/]/).map((g) => g.trim()).filter(Boolean);
  }, [movie]);

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

  const imdb = Number(movie.imdbRating) || 0;
  const userAvg = Number(movie.averageRating) || 0;
  const ratingValue = imdb || userAvg;

  return (
    <>
      {showPlayer && movie && (
        <MoviePlayer movie={movie} onClose={() => setShowPlayer(false)} />
      )}

      <div className="md-page">
        <section className="md-hero" aria-hidden="true">
          <img className="md-hero-img" src={backdropSrc} alt="" />
          <div className="md-hero-fade" />
        </section>

        <button
          type="button"
          className="md-icon-btn md-back"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
          </svg>
        </button>

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

              {galleryImages.length > 1 && (
                <div className="md-thumbs">
                  {galleryImages.map((imageUrl, index) => (
                    <button
                      key={imageUrl + index}
                      type="button"
                      className={`md-thumb${index === selectedImageIndex ? ' is-active' : ''}`}
                      onClick={() => setSelectedImageIndex(index)}
                    >
                      <img
                        src={imageUrl}
                        alt={`${movie.title} ${index + 1}`}
                        onError={(e) => handleImageError(e, `${movie.title} ${index + 1}`)}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="md-copy">
              <h1 className="md-title">{movie.title}</h1>

              <div className="md-meta-row">
                {ratingValue > 0 && (
                  <span className="md-meta-item">
                    <svg className="md-meta-star" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 2l2.9 6.9L22 9.2l-5.5 4.8L18.2 22 12 18.3 5.8 22l1.7-8L2 9.2l7.1-.3L12 2z" />
                    </svg>
                    {ratingValue.toFixed(1)}
                    {movie.totalRatings > 0 ? ` (${movie.totalRatings.toLocaleString()})` : ''}
                  </span>
                )}
                {movie.year && (
                  <span className="md-meta-item">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z" />
                    </svg>
                    {movie.year}
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

              {movie.description && (
                <div className="md-overview">
                  <h2 className="md-overview-title">Overview</h2>
                  <p>{movie.description}</p>
                </div>
              )}
            </div>

            {movie.movieUrl && (
              <aside className="md-side">
                <button
                  type="button"
                  className="md-watch-hero"
                  onClick={() => setShowPlayer(true)}
                >
                  <span className="md-watch-hero-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                  <span className="md-watch-hero-label">Watch Now</span>
                </button>
              </aside>
            )}
          </div>
        </section>
      </div>
    </>
  );
};

export default MovieDetail;
