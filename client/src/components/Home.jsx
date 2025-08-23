import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const Home = () => {
  const { isAuthenticated, token } = useAuth();
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [userRatings, setUserRatings] = useState({});
  const [ratingLoading, setRatingLoading] = useState({});
  const [showGenrePanel, setShowGenrePanel] = useState(false);
  const [showYearPanel, setShowYearPanel] = useState(false);

  // Close panels when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showGenrePanel && !event.target.closest('.filter-select-group')) {
        setShowGenrePanel(false);
      }
      if (showYearPanel && !event.target.closest('.filter-select-group')) {
        setShowYearPanel(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showGenrePanel, showYearPanel]);

  // Fetch movies from backend
  const fetchMovies = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      let url = 'http://localhost:5001/api/movies?limit=20';
      if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
      if (selectedGenre) url += `&genre=${encodeURIComponent(selectedGenre)}`;
      if (selectedYear) url += `&year=${selectedYear}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setMovies(result.data.movies);
      } else {
        throw new Error(result.message || 'Failed to fetch movies');
      }
    } catch (err) {
      console.error('Error fetching movies:', err);
      setError(err.message || 'Failed to load movies. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedGenre, selectedYear]);

  // Fetch movies on component mount and when filters change
  useEffect(() => {
    fetchMovies();
  }, [fetchMovies]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      fetchMovies();
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedGenre('');
    setSelectedYear('');
  };

  const genres = [
    'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary',
    'Drama', 'Family', 'Fantasy', 'Horror', 'Mystery', 'Romance',
    'Sci-Fi', 'Thriller', 'War', 'Western'
  ];

  const years = Array.from({ length: 30 }, (_, i) => new Date().getFullYear() - i);

  // Fetch user ratings for movies
  const fetchUserRatings = useCallback(async () => {
    if (!isAuthenticated) return;
    
    try {
      const ratingPromises = movies.map(async (movie) => {
        try {
          const response = await fetch(`http://localhost:5001/api/movies/${movie._id}/rating`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
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
      ratings.forEach(rating => {
        ratingsMap[rating.movieId] = rating;
      });
      setUserRatings(ratingsMap);
    } catch (err) {
      console.error('Error fetching user ratings:', err);
    }
  }, [movies, isAuthenticated, token]);

  // Handle movie rating
  const handleRateMovie = async (movieId, rating, review = '') => {
    if (!isAuthenticated) return;
    
    try {
      setRatingLoading(prev => ({ ...prev, [movieId]: true }));
      
      const response = await fetch(`http://localhost:5001/api/movies/${movieId}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ rating, review })
      });

      if (response.ok) {
        const result = await response.json();
        
        // Update local state
        setUserRatings(prev => ({
          ...prev,
          [movieId]: {
            movieId,
            rating,
            review,
            hasRated: true
          }
        }));

        // Update movie in the list with new average rating
        setMovies(prev => prev.map(movie => 
          movie._id === movieId 
            ? { ...movie, averageRating: result.data.movie.averageRating, totalRatings: result.data.movie.totalRatings }
            : movie
        ));

        // Show success message
        const successMessage = result.message || 'Rating submitted successfully!';
        showNotification(successMessage, 'success');
      } else {
        const errorData = await response.json();
        const errorMessage = errorData.message || 'Failed to rate movie';
        showNotification(errorMessage, 'error');
      }
    } catch (err) {
      console.error('Error rating movie:', err);
      showNotification('Failed to rate movie. Please try again.', 'error');
    } finally {
      setRatingLoading(prev => ({ ...prev, [movieId]: false }));
    }
  };

  // Notification system
  const showNotification = (message, type = 'info') => {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-message">${message}</span>
        <button class="notification-close">×</button>
      </div>
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);
    
    // Close button functionality
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    });
  };

  // Fetch user ratings when movies change
  useEffect(() => {
    if (movies.length > 0 && isAuthenticated) {
      fetchUserRatings();
    }
  }, [movies, isAuthenticated, token, fetchUserRatings]);

  return (
    <div>
      
      {/* Movie Browsing Section */}
      <div className="card">
        <h2>Browse Movies</h2>
        
        {/* Search and Filters */}
        <div className="movie-filters">
          <form onSubmit={handleSearch} className="search-form">
            {/* Search Bar */}
            <div className="search-section">
              <div className="search-input-wrapper">
                <input
                  type="text"
                  placeholder="Search movies by title, description, or genre..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
                <button type="submit" className="search-btn">
                  🔍 Search
                </button>
              </div>
            </div>

            {/* Filter Controls */}
            <div className="filter-controls">
              {/* Genre Select */}
              <div className="filter-select-group">
                <label className="filter-label">Genre</label>
                <div className="select-button-wrapper">
                  <button
                    type="button"
                    className={`select-button ${selectedGenre ? 'has-selection' : ''}`}
                    onClick={() => setShowGenrePanel(!showGenrePanel)}
                  >
                    <span className="select-button-text">
                      {selectedGenre || 'All Genres'}
                    </span>
                    <span className={`select-arrow ${showGenrePanel ? 'rotated' : ''}`}>
                      ▼
                    </span>
                  </button>
                  
                  {showGenrePanel && (
                    <div className="select-panel genre-panel">
                      <div className="panel-header">
                        <h4>Select Genre</h4>
                        <button
                          type="button"
                          className="close-panel-btn"
                          onClick={() => setShowGenrePanel(false)}
                        >
                          ×
                        </button>
                      </div>
                      <div className="panel-options">
                        <button
                          type="button"
                          className={`panel-option ${selectedGenre === '' ? 'selected' : ''}`}
                          onClick={() => {
                            setSelectedGenre('');
                            setShowGenrePanel(false);
                          }}
                        >
                          All Genres
                        </button>
                        {genres.map(genre => (
                          <button
                            key={genre}
                            type="button"
                            className={`panel-option ${selectedGenre === genre ? 'selected' : ''}`}
                            onClick={() => {
                              setSelectedGenre(genre);
                              setShowGenrePanel(false);
                            }}
                          >
                            {genre}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Year Select */}
              <div className="filter-select-group">
                <label className="filter-label">Release Year</label>
                <div className="select-button-wrapper">
                  <button
                    type="button"
                    className={`select-button ${selectedYear ? 'has-selection' : ''}`}
                    onClick={() => setShowYearPanel(!showYearPanel)}
                  >
                    <span className="select-button-text">
                      {selectedYear || 'All Years'}
                    </span>
                    <span className={`select-arrow ${showYearPanel ? 'rotated' : ''}`}>
                      ▼
                    </span>
                  </button>
                  
                  {showYearPanel && (
                    <div className="select-panel year-panel">
                      <div className="panel-header">
                        <h4>Select Year</h4>
                        <button
                          type="button"
                          className="close-panel-btn"
                          onClick={() => setShowYearPanel(false)}
                        >
                          ×
                        </button>
                      </div>
                      <div className="panel-options">
                        <button
                          type="button"
                          className={`panel-option ${selectedYear === '' ? 'selected' : ''}`}
                          onClick={() => {
                            setSelectedYear('');
                            setShowYearPanel(false);
                          }}
                        >
                          All Years
                        </button>
                        {years.map(year => (
                          <button
                            key={year}
                            type="button"
                            className={`panel-option ${selectedYear === year ? 'selected' : ''}`}
                            onClick={() => {
                              setSelectedYear(year);
                              setShowYearPanel(false);
                            }}
                          >
                            {year}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="filter-actions">
              <button 
                type="button" 
                className="btn btn-secondary clear-btn"
                onClick={clearFilters}
              >
                🗑️ Clear All Filters
              </button>
              <div className="filter-summary">
                {searchTerm && <span className="filter-tag">Search: {searchTerm}</span>}
                {selectedGenre && <span className="filter-tag">Genre: {selectedGenre}</span>}
                {selectedYear && <span className="filter-tag">Year: {selectedYear}</span>}
              </div>
            </div>
          </form>
        </div>

        {/* Movies Display */}
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <h3>Loading movies...</h3>
            <p>Please wait while we fetch the latest movies from our collection.</p>
          </div>
        ) : error ? (
          <div className="error-state">
            <h3>Error loading movies</h3>
            <p>{error}</p>
            <button 
              className="btn btn-primary"
              onClick={fetchMovies}
            >
              Try Again
            </button>
          </div>
        ) : movies.length === 0 ? (
          <div className="empty-state">
            <h3>No movies found</h3>
            <p>{searchTerm || selectedGenre || selectedYear ? 'Try adjusting your search terms or filters.' : 'No movies have been added to the collection yet.'}</p>
            {!searchTerm && !selectedGenre && !selectedYear && (
              <button 
                className="btn btn-primary"
                onClick={fetchMovies}
              >
                Refresh Movies
              </button>
            )}
          </div>
        ) : (
          <div className="movies-grid">
            {movies.map(movie => (
              <div key={movie._id} className="movie-card">
                <div className="movie-image">
                  {movie.imageUrl ? (
                    <img src={movie.imageUrl} alt={movie.title} />
                  ) : (
                    <div className="movie-placeholder">
                      <span>🎬</span>
                    </div>
                  )}
                </div>
                <div className="movie-info">
                  <h3>{movie.title}</h3>
                  <div className="movie-meta">
                    <span className="movie-year">{movie.year}</span>
                    <span className="movie-genre">{movie.genre}</span>
                    <div className="movie-rating-info">
                      <div className="rating-row">
                        <span className="movie-rating imdb-rating">
                          🎬 IMDB: {movie.imdbRating ? movie.imdbRating.toFixed(1) : '0.0'}/10
                        </span>
                        <span className="movie-rating user-rating">
                          ⭐ Users: {movie.averageRating ? movie.averageRating.toFixed(1) : '0.0'}/10
                        </span>
                      </div>
                      <span className="rating-count">
                        ({movie.totalRatings || 0} user ratings)
                      </span>
                    </div>
                  </div>
                  <p className="movie-description">
                    {movie.description.length > 100 
                      ? movie.description.substring(0, 100) + '...' 
                      : movie.description
                    }
                  </p>
                  
                  {/* Rating Section */}
                  {isAuthenticated && (
                    <div className="movie-rating-section">
                      <div className="rating-stars">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(star => (
                          <button
                            key={star}
                            type="button"
                            className={`rating-star ${userRatings[movie._id]?.rating >= star ? 'active' : ''}`}
                            onClick={() => handleRateMovie(movie._id, star)}
                            disabled={ratingLoading[movie._id]}
                          >
                            {star}
                          </button>
                        ))}
                      </div>
                      {userRatings[movie._id]?.hasRated && (
                        <div className="user-rating">
                          <small>Your rating: {userRatings[movie._id].rating}/10</small>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="movie-actions">
                    <a 
                      href={movie.movieUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="btn btn-primary watch-btn"
                    >
                      🎬 Watch Movie
                    </a>
                    <a 
                      href={movie.downloadUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="btn btn-secondary download-btn"
                    >
                      ⬇️ Download
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Home; 