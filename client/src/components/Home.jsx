import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import Header from './Header';

const Home = () => {
  const { isAuthenticated, token } = useAuth();
  const location = useLocation();
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
  const [currentSlide, setCurrentSlide] = useState(0);

  // Slideshow images - movie-related wallpapers
  const slideshowImages = [
    'https://c4.wallpaperflare.com/wallpaper/884/965/115/movies-flash-superman-wonder-woman-wallpaper-preview.jpg',
    'https://images5.alphacoders.com/840/840870.jpg',
    'https://wallpapercave.com/wp/wp2592669.jpg',
    'https://wallup.net/wp-content/uploads/2019/09/06/297529-legend-of-the-seeker-models-tabrett-bethell-cara-mason-748x421.jpg',
    'https://www.syfy.com/sites/syfy/files/styles/hero_image__large__computer__alt_1_5x/public/2021/01/legends-of-tomorrow.jpg',
    'https://www.chromethemer.com/wallpapers/chromebook-wallpapers/images/960/marvel-logo-chromebook-wallpaper.jpg',
    'https://wallpapers.com/images/high/4k-avengers-infinity-war-whole-cast-gx5riyd6eqklm4hf.webp',
    'https://4kwallpapers.com/images/walls/thumbs_3t/11941.jpg',
    'https://www.pixelstalk.net/wp-content/uploads/2016/01/Harry-Potter-7-Wallpaper-HD-Free.jpg'
  ];

  // Handle URL parameters from navbar search
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const searchParam = params.get('search');
    const genreParam = params.get('genre');
    const yearParam = params.get('year');
    
    if (searchParam) setSearchTerm(searchParam);
    if (genreParam) setSelectedGenre(genreParam);
    if (yearParam) setSelectedYear(yearParam);
  }, [location.search]);

  // Auto-advance slideshow
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slideshowImages.length);
    }, 5000); // Change slide every 5 seconds

    return () => clearInterval(interval);
  }, [slideshowImages.length]);

  // Manual slide navigation
  const goToSlide = (index) => {
    setCurrentSlide(index);
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slideshowImages.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slideshowImages.length) % slideshowImages.length);
  };

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

  const handleSearch = useCallback((e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      fetchMovies();
    }
  }, [searchTerm, fetchMovies]);

  // Add loading state for search
  const [isSearching, setIsSearching] = useState(false);

  // Update fetchMovies to show search loading state
  const fetchMoviesWithLoading = useCallback(async () => {
    if (searchTerm.trim() || selectedGenre || selectedYear) {
      setIsSearching(true);
    }
    
    try {
      await fetchMovies();
    } finally {
      setIsSearching(false);
    }
  }, [searchTerm, selectedGenre, selectedYear, fetchMovies]);

  // Immediate search for short terms (1-2 characters)
  useEffect(() => {
    if (searchTerm.trim().length <= 2 && searchTerm.trim()) {
      fetchMovies();
    }
  }, [searchTerm]);

  // Auto-search when search term or filters change (for longer terms)
  useEffect(() => {
    if (searchTerm.trim().length > 2) {
      const timeoutId = setTimeout(() => {
        fetchMovies();
      }, 200); // Very short delay for longer terms

      return () => clearTimeout(timeoutId);
    }
  }, [searchTerm, selectedGenre, selectedYear]);

  // Immediate search for genre and year changes
  useEffect(() => {
    if (selectedGenre || selectedYear) {
      fetchMovies();
    }
  }, [selectedGenre, selectedYear]);

  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setSelectedGenre('');
    setSelectedYear('');
    // Clear URL parameters
    window.history.pushState({}, '', '/');
  }, []);

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
      {/* Header Navigation */}
      <Header />
      
      {/* Movie Browsing Section */}
      <div className="card">
        {/* Slideshow Wallpaper */}
        <div className="slideshow-container">
          <div className="slideshow-wrapper">
            {slideshowImages.map((image, index) => (
              <div
                key={index}
                className={`slide ${index === currentSlide ? 'active' : ''}`}
                style={{
                  backgroundImage: `url(${image})`,
                  transform: `translateX(${(index - currentSlide) * 100}%)`
                }}
              />
            ))}
          </div>
          
          {/* Text Overlay */}
          <div className="slideshow-overlay">
            <div className="slideshow-content">
              <h3>🎬 Welcome to NK Movie Hub</h3>
              <p>Discover thousands of amazing films from every genre, era, and culture</p>
              <div className="slideshow-features">
                <span className="feature-tag">✨ Latest Releases</span>
                <span className="feature-tag">🎭 All Genres</span>
                <span className="feature-tag">⭐ User Ratings</span>
              </div>
              
              
            </div>
          </div>
          
          {/* Navigation Arrows */}
          <button className="slideshow-nav prev" onClick={prevSlide}>
            ‹
          </button>
          <button className="slideshow-nav next" onClick={nextSlide}>
            ›
          </button>
          
          {/* Slide Indicators */}
          <div className="slide-indicators">
            {slideshowImages.map((_, index) => (
              <button
                key={index}
                className={`indicator ${index === currentSlide ? 'active' : ''}`}
                onClick={() => goToSlide(index)}
              />
            ))}
          </div>
        </div>
        <h2>Browse Movies</h2>
        
        {/* Filter Summary */}
        {(searchTerm || selectedGenre || selectedYear) && (
          <div className="filter-summary-display">
            <div className="active-filters">
              {searchTerm && (
                <span className="filter-tag">
                  🔍 Search: {searchTerm}
                  <button 
                    className="remove-filter-btn"
                    onClick={() => {
                      setSearchTerm('');
                      const params = new URLSearchParams(location.search);
                      params.delete('search');
                      window.history.pushState({}, '', params.toString() ? `/?${params.toString()}` : '/');
                    }}
                  >
                    ×
                  </button>
                </span>
              )}
              {selectedGenre && (
                <span className="filter-tag">
                  🎭 Genre: {selectedGenre}
                  <button 
                    className="remove-filter-btn"
                    onClick={() => {
                      setSelectedGenre('');
                      const params = new URLSearchParams(location.search);
                      params.delete('genre');
                      window.history.pushState({}, '', params.toString() ? `/?${params.toString()}` : '/');
                    }}
                  >
                    ×
                  </button>
                </span>
              )}
              {selectedYear && (
                <span className="filter-tag">
                  📅 Year: {selectedYear}
                  <button 
                    className="remove-filter-btn"
                    onClick={() => {
                      setSelectedYear('');
                      const params = new URLSearchParams(location.search);
                      params.delete('year');
                      window.history.pushState({}, '', params.toString() ? `/?${params.toString()}` : '/');
                    }}
                  >
                    ×
                  </button>
                </span>
              )}
            </div>
            <button 
              className="clear-all-filters-btn"
              onClick={clearFilters}
            >
              ✕ Clear All
            </button>
          </div>
        )}

        {/* Search Status Indicator */}
        {isSearching && (
          <div className="search-status-home">
            <span className="search-indicator-home">🔍 Searching...</span>
          </div>
        )}

        {/* Movies Display */}
        <div id="movies-section">
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
                Refresh Movies
              </button>
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
                      {isAuthenticated ? (
                        <>
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
                        </>
                      ) : (
                        <>
                          <button 
                            className="btn btn-primary watch-btn"
                            onClick={() => showNotification('Please login to watch movies', 'warning')}
                          >
                            🎬 Watch Movie
                          </button>
                          <button 
                            className="btn btn-secondary download-btn"
                            onClick={() => showNotification('Please login to download movies', 'warning')}
                          >
                            ⬇️ Download
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home; 