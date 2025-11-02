import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MoviePlayer from './MoviePlayer';
import './MovieDetail.css';

const MovieDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, token } = useAuth();
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userRating, setUserRating] = useState(null);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  useEffect(() => {
    fetchMovieDetails();
    if (isAuthenticated) {
      fetchUserRating();
    }
    setSelectedImageIndex(0); // Reset image index when movie changes
  }, [id, isAuthenticated, token]);

  const fetchMovieDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`http://localhost:5001/api/movies/${id}`);
      
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

  const fetchUserRating = async () => {
    if (!isAuthenticated) return;
    
    try {
      const response = await fetch(`http://localhost:5001/api/movies/${id}/rating`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        setUserRating(result.data);
      }
    } catch (err) {
      console.error('Error fetching user rating:', err);
    }
  };

  const handleRateMovie = async (rating, review = '') => {
    if (!isAuthenticated) {
      showNotification('Please login to rate movies', 'warning');
      return;
    }
    
    try {
      setRatingLoading(true);
      
      const response = await fetch(`http://localhost:5001/api/movies/${id}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ rating, review })
      });

      if (response.ok) {
        const result = await response.json();
        setUserRating({
          rating,
          review,
          hasRated: true
        });
        setMovie(prev => ({
          ...prev,
          averageRating: result.data.movie.averageRating,
          totalRatings: result.data.movie.totalRatings
        }));
        showNotification(result.message || 'Rating submitted successfully!', 'success');
      } else {
        const errorData = await response.json();
        showNotification(errorData.message || 'Failed to rate movie', 'error');
      }
    } catch (err) {
      console.error('Error rating movie:', err);
      showNotification('Failed to rate movie. Please try again.', 'error');
    } finally {
      setRatingLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!movie || !movie.movieUrl) {
      showNotification('Movie URL not available', 'error');
      return;
    }

    if (!isAuthenticated) {
      showNotification('Please login to download movies', 'warning');
      return;
    }

    try {
      setDownloading(true);
      
      // Check if it's YouTube or Vimeo (can't download directly)
      if (movie.movieUrl.includes('youtube.com') || movie.movieUrl.includes('youtu.be') || movie.movieUrl.includes('vimeo.com')) {
        showNotification('Direct download is not available for YouTube or Vimeo videos', 'warning');
        setDownloading(false);
        return;
      }

      // Create download URL with token in query parameter (server will verify it)
      const downloadUrl = `http://localhost:5001/api/movies/${id}/download?token=${encodeURIComponent(token)}`;
      
      // Create a temporary anchor element and trigger download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${movie.title.replace(/[^a-z0-9]/gi, '_')}.mp4`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showNotification('Download started!', 'success');
      
      // Reset downloading state after a delay
      setTimeout(() => {
        setDownloading(false);
      }, 2000);

    } catch (err) {
      console.error('Error downloading movie:', err);
      showNotification(err.message || 'Failed to download movie. Please try again.', 'error');
      setDownloading(false);
    }
  };

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
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);
    
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    });
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
          <button 
            className="btn btn-primary"
            onClick={() => navigate('/')}
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {showPlayer && movie && (
        <MoviePlayer 
          movie={movie} 
          onClose={() => setShowPlayer(false)} 
        />
      )}
      
      <div className="movie-detail-container">
        <button 
          className="back-button"
          onClick={() => navigate(-1)}
        >
          ← Back
        </button>

      <div className="movie-detail-content">
        <div className="movie-detail-poster">
          {/* Image Gallery */}
          {movie.images && movie.images.length > 0 ? (
            <div className="movie-image-gallery">
              <div className="movie-main-image">
                <img 
                  src={movie.images[selectedImageIndex] || movie.images[0]} 
                  alt={movie.title}
                  onError={(e) => {
                    e.target.style.display = 'none';
                    const placeholder = e.target.parentElement.querySelector('.movie-placeholder-large') || document.createElement('div');
                    placeholder.className = 'movie-placeholder-large';
                    placeholder.innerHTML = '<span>🎬</span>';
                    if (!e.target.parentElement.querySelector('.movie-placeholder-large')) {
                      e.target.parentElement.appendChild(placeholder);
                    } else {
                      e.target.parentElement.querySelector('.movie-placeholder-large').style.display = 'flex';
                    }
                  }}
                />
              </div>
              {movie.images.length > 1 && (
                <div className="movie-image-thumbnails">
                  {movie.images.map((imageUrl, index) => (
                    <div 
                      key={index}
                      className={`thumbnail-item ${index === selectedImageIndex ? 'active' : ''}`}
                      onClick={() => setSelectedImageIndex(index)}
                    >
                      <img 
                        src={imageUrl} 
                        alt={`${movie.title} ${index + 1}`}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="150"%3E%3Crect width="100" height="150" fill="%231a1a1a"/%3E%3Ctext x="50" y="75" font-size="20" fill="white" text-anchor="middle" dominant-baseline="middle"%3E🎬%3C/text%3E%3C/svg%3E';
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : movie.imageUrl ? (
            <img 
              src={movie.imageUrl} 
              alt={movie.title}
              onError={(e) => {
                e.target.style.display = 'none';
                const placeholder = e.target.parentElement.querySelector('.movie-placeholder-large') || document.createElement('div');
                placeholder.className = 'movie-placeholder-large';
                placeholder.innerHTML = '<span>🎬</span>';
                if (!e.target.parentElement.querySelector('.movie-placeholder-large')) {
                  e.target.parentElement.appendChild(placeholder);
                } else {
                  e.target.parentElement.querySelector('.movie-placeholder-large').style.display = 'flex';
                }
              }}
            />
          ) : (
            <div className="movie-placeholder-large">
              <span>🎬</span>
            </div>
          )}
        </div>

        <div className="movie-detail-info">
          <h1 className="movie-detail-title">{movie.title}</h1>
          
          <div className="movie-detail-meta">
            <div className="meta-item">
              <span className="meta-label">Year:</span>
              <span className="meta-value">{movie.year}</span>
            </div>
            {movie.genre && (
              <div className="meta-item">
                <span className="meta-label">Genre:</span>
                <span className="meta-value">{movie.genre}</span>
              </div>
            )}
            {movie.releaseDate && (
              <div className="meta-item">
                <span className="meta-label">Release Date:</span>
                <span className="meta-value">{movie.releaseDate}</span>
              </div>
            )}
            {movie.source && (
              <div className="meta-item">
                <span className="meta-label">Source:</span>
                <span className="meta-value">{movie.source}</span>
              </div>
            )}
            {movie.subtitle && (
              <div className="meta-item">
                <span className="meta-label">Subtitle:</span>
                <span className="meta-value">{movie.subtitle}</span>
              </div>
            )}
          </div>

          {movie.description && (
            <div className="movie-detail-description">
              <h3>Description</h3>
              <p>{movie.description}</p>
            </div>
          )}

          <div className="movie-detail-ratings">
            <div className="rating-item">
              <span className="rating-label">🎬 IMDB Rating:</span>
              <span className="rating-value">
                {movie.imdbRating ? movie.imdbRating.toFixed(1) : 'N/A'}/10
              </span>
            </div>
            <div className="rating-item">
              <span className="rating-label">⭐ User Rating:</span>
              <span className="rating-value">
                {movie.averageRating ? movie.averageRating.toFixed(1) : '0.0'}/10
                <span className="rating-count">
                  ({movie.totalRatings || 0} ratings)
                </span>
              </span>
            </div>
          </div>

          {isAuthenticated && (
            <div className="movie-detail-rate-section">
              <h3>Rate this movie</h3>
              {userRating?.hasRated && (
                <p className="user-rating-note">
                  Your rating: {userRating.rating}/10
                </p>
              )}
              <div className="rating-stars-large">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(star => (
                  <button
                    key={star}
                    type="button"
                    className={`rating-star-large ${userRating?.rating >= star ? 'active' : ''}`}
                    onClick={() => handleRateMovie(star)}
                    disabled={ratingLoading}
                  >
                    {star}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="movie-detail-actions">
            {isAuthenticated ? (
              <>
                {movie.movieUrl && (
                  <>
                    <button 
                      className="btn btn-primary btn-large"
                      onClick={() => setShowPlayer(true)}
                    >
                      🎬 Watch Movie
                    </button>
                    {!movie.movieUrl.includes('youtube.com') && !movie.movieUrl.includes('youtu.be') && !movie.movieUrl.includes('vimeo.com') && (
                      <button 
                        className="btn btn-secondary btn-large"
                        onClick={handleDownload}
                        disabled={downloading}
                      >
                        {downloading ? '⬇️ Downloading...' : '⬇️ Download Movie'}
                      </button>
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                <button 
                  className="btn btn-primary btn-large"
                  onClick={() => showNotification('Please login to watch movies', 'warning')}
                >
                  🎬 Watch Movie
                </button>
                <button 
                  className="btn btn-secondary btn-large"
                  onClick={() => showNotification('Please login to download movies', 'warning')}
                >
                  ⬇️ Download Movie
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      </div>
    </>
  );
};

export default MovieDetail;

