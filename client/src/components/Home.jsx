import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from './Header';
import MovieGrid from './MovieGrid';
import TVShowGrid from './TVShowGrid';
import ContactSection from './ContactSection';
import './MovieGrid.css';

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
  const [showGenrePanel, setShowGenrePanel] = useState(false);
  const [showYearPanel, setShowYearPanel] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [contentType, setContentType] = useState('movies'); // 'movies' or 'tvshows'
  const [availableGenres, setAvailableGenres] = useState([]);
  const [availableYears, setAvailableYears] = useState([]);
  const [filtersLoading, setFiltersLoading] = useState(false);

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
    const typeParam = params.get('type');
    
    // Always update the states based on URL parameters
    setSearchTerm(searchParam || '');
    setSelectedGenre(genreParam || '');
    setSelectedYear(yearParam || '');
    setContentType(typeParam === 'tvshows' ? 'tvshows' : 'movies');
    
    // Scroll to movies section if genre/year filter is applied (helps when navigating from other pages)
    if (genreParam || yearParam) {
      setTimeout(() => {
        const moviesSection = document.getElementById('movies-section');
        if (moviesSection) {
          moviesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 500);
    }
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

  // Fetch available genres and years based on content type
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        setFiltersLoading(true);
        const apiEndpoint = contentType === 'tvshows' 
          ? 'http://localhost:5001/api/tvshows/filters'
          : 'http://localhost:5001/api/movies/filters';
        
        const response = await fetch(apiEndpoint);
        const result = await response.json();
        
        if (result.success) {
          setAvailableGenres(result.data.genres || []);
          setAvailableYears(result.data.years || []);
        }
      } catch (error) {
        console.error('Error fetching filters:', error);
        setAvailableGenres([]);
        setAvailableYears([]);
      } finally {
        setFiltersLoading(false);
      }
    };

    fetchFilters();
  }, [contentType]);

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

  // Handle genre selection
  const handleGenreSelect = (genre) => {
    const params = new URLSearchParams(location.search);
    
    if (selectedGenre === genre) {
      // Toggle off - remove genre
      params.delete('genre');
    } else {
      // Set new genre
      params.set('genre', genre);
      params.delete('search'); // Clear search when selecting genre
    }
    
    // Preserve type parameter
    if (contentType === 'tvshows') {
      params.set('type', 'tvshows');
    } else {
      params.delete('type');
    }
    
    const queryString = params.toString();
    navigate(queryString ? `/?${queryString}` : '/', { replace: true });
    setShowGenrePanel(false);
  };

  // Handle year selection
  const handleYearSelect = (year) => {
    const params = new URLSearchParams(location.search);
    
    if (selectedYear === year.toString()) {
      // Toggle off - remove year
      params.delete('year');
    } else {
      // Set new year
      params.set('year', year);
      params.delete('search'); // Clear search when selecting year
    }
    
    // Preserve type parameter
    if (contentType === 'tvshows') {
      params.set('type', 'tvshows');
    } else {
      params.delete('type');
    }
    
    const queryString = params.toString();
    navigate(queryString ? `/?${queryString}` : '/', { replace: true });
    setShowYearPanel(false);
  };

  // Fetch movies from backend
  const fetchMovies = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      let url = 'http://localhost:5001/api/movies?limit=1000';
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

  // Fetch TV shows from backend
  const fetchTVShows = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      let url = 'http://localhost:5001/api/tvshows?limit=1000';
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
        setTVShows(result.data.tvShows);
      } else {
        throw new Error(result.message || 'Failed to fetch TV shows');
      }
    } catch (err) {
      console.error('Error fetching TV shows:', err);
      setError(err.message || 'Failed to load TV shows. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedGenre, selectedYear]);

  // Unified fetch effect - handles all filter changes including initial load
  useEffect(() => {
    // Debounce for search terms longer than 2 characters
    if (searchTerm.trim().length > 2) {
      const timeoutId = setTimeout(() => {
        if (contentType === 'tvshows') {
          fetchTVShows();
        } else {
          fetchMovies();
        }
      }, 300);

      return () => clearTimeout(timeoutId);
    } else {
      // Immediate fetch for genre/year changes, short search terms, or initial load
      if (contentType === 'tvshows') {
        fetchTVShows();
      } else {
        fetchMovies();
      }
    }
  }, [contentType, selectedGenre, selectedYear, searchTerm, fetchMovies, fetchTVShows]);

  const clearFilters = useCallback(() => {
    // Use navigate instead of pushState to properly trigger React Router updates
    navigate('/', { replace: true });
  }, [navigate]);


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
        
        {/* Browse Header with Filters */}
        <div className="browse-header-with-filters">
          <h2>{contentType === 'tvshows' ? 'Browse TV Shows' : 'Browse Movies'}</h2>
          
          {/* Genre and Year Filter Buttons */}
          <div className="inline-filters-container">
            {/* Genre Filter */}
            <div className="filter-select-group">
              <button
                className={`filter-button ${selectedGenre ? 'active' : ''}`}
                onClick={() => {
                  setShowGenrePanel(!showGenrePanel);
                  setShowYearPanel(false);
                }}
              >
                <span className="filter-icon">🎭</span>
                <span className="filter-text">
                  {selectedGenre || 'All Genres'}
                </span>
                {selectedGenre && <span className="filter-indicator">●</span>}
              </button>
              
              {showGenrePanel && (
                <div className="filter-dropdown">
                  <div className="filter-dropdown-header">
                    <span>Select Genre</span>
                    <button 
                      className="filter-close-btn"
                      onClick={() => setShowGenrePanel(false)}
                    >
                      ×
                    </button>
                  </div>
                  <div className="filter-options">
                    {filtersLoading ? (
                      <div className="filter-loading">Loading...</div>
                    ) : availableGenres.length > 0 ? (
                      availableGenres.map((genre, index) => (
                        <button
                          key={index}
                          className={`filter-option ${selectedGenre === genre ? 'selected' : ''}`}
                          onClick={() => handleGenreSelect(genre)}
                        >
                          {genre}
                        </button>
                      ))
                    ) : (
                      <div className="filter-empty">No genres available</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Year Filter */}
            <div className="filter-select-group">
              <button
                className={`filter-button ${selectedYear ? 'active' : ''}`}
                onClick={() => {
                  setShowYearPanel(!showYearPanel);
                  setShowGenrePanel(false);
                }}
              >
                <span className="filter-icon">📅</span>
                <span className="filter-text">
                  {selectedYear || 'All Years'}
                </span>
                {selectedYear && <span className="filter-indicator">●</span>}
              </button>
              
              {showYearPanel && (
                <div className="filter-dropdown">
                  <div className="filter-dropdown-header">
                    <span>Select Year</span>
                    <button 
                      className="filter-close-btn"
                      onClick={() => setShowYearPanel(false)}
                    >
                      ×
                    </button>
                  </div>
                  <div className="filter-options year-options">
                    {filtersLoading ? (
                      <div className="filter-loading">Loading...</div>
                    ) : availableYears.length > 0 ? (
                      availableYears.map((year, index) => (
                        <button
                          key={index}
                          className={`filter-option ${selectedYear === year.toString() ? 'selected' : ''}`}
                          onClick={() => handleYearSelect(year)}
                        >
                          {year}
                        </button>
                      ))
                    ) : (
                      <div className="filter-empty">No years available</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
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
                      const params = new URLSearchParams(location.search);
                      params.delete('search');
                      const queryString = params.toString();
                      navigate(queryString ? `/?${queryString}` : '/', { replace: true });
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
                      const params = new URLSearchParams(location.search);
                      params.delete('genre');
                      const queryString = params.toString();
                      navigate(queryString ? `/?${queryString}` : '/', { replace: true });
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
                      const params = new URLSearchParams(location.search);
                      params.delete('year');
                      const queryString = params.toString();
                      navigate(queryString ? `/?${queryString}` : '/', { replace: true });
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


        {/* Content Display */}
        <div id="movies-section">
          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <h3>Loading {contentType === 'tvshows' ? 'TV shows' : 'movies'}...</h3>
              <p>Please wait while we fetch the latest {contentType === 'tvshows' ? 'TV shows' : 'movies'} from our collection.</p>
            </div>
          ) : error ? (
            <div className="error-state">
              <h3>Error loading {contentType === 'tvshows' ? 'TV shows' : 'movies'}</h3>
              <p>{error}</p>
              <button 
                className="btn btn-primary"
                onClick={contentType === 'tvshows' ? fetchTVShows : fetchMovies}
              >
                Refresh {contentType === 'tvshows' ? 'TV Shows' : 'Movies'}
              </button>
            </div>
          ) : contentType === 'tvshows' ? (
            <TVShowGrid tvShows={tvShows} searchTerm={searchTerm} />
          ) : (
            <MovieGrid 
              movies={movies}
              onRateMovie={handleRateMovie}
              userRatings={userRatings}
              ratingLoading={ratingLoading}
              isAuthenticated={isAuthenticated}
              showNotification={showNotification}
              searchTerm={searchTerm}
            />
          )}
        </div>
      </div>
      
      {/* Contact Us Section */}
      <ContactSection />
    </div>
  );
};

export default Home; 