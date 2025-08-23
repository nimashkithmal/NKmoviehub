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
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setMovies(result.data.movies);
      } else {
        throw new Error(result.message || 'Failed to fetch movies');
      }
    } catch (err) {
      console.error('Error fetching movies:', err);
      setError(err.message);
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
    fetchMovies();
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

        alert(result.message);
      } else {
        const errorData = await response.json();
        alert(errorData.message || 'Failed to rate movie');
      }
    } catch (err) {
      console.error('Error rating movie:', err);
      alert('Failed to rate movie. Please try again.');
    } finally {
      setRatingLoading(prev => ({ ...prev, [movieId]: false }));
    }
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
            <div className="filter-row">
              <input
                type="text"
                placeholder="Search movies by title, description, or genre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              <select
                value={selectedGenre}
                onChange={(e) => setSelectedGenre(e.target.value)}
                className="filter-select"
              >
                <option value="">All Genres</option>
                {genres.map(genre => (
                  <option key={genre} value={genre}>{genre}</option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="filter-select"
              >
                <option value="">All Years</option>
                {years.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <button type="submit" className="btn btn-primary">
                Search
              </button>
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={clearFilters}
              >
                Clear
              </button>
            </div>
          </form>
        </div>

        {/* Movies Display */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <h3>Loading movies...</h3>
            <p>Please wait while we fetch the latest movies.</p>
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '50px', color: '#dc3545' }}>
            <h3>Error loading movies</h3>
            <p>{error}</p>
            <button 
              className="btn btn-primary"
              onClick={fetchMovies}
              style={{ marginTop: '20px' }}
            >
              Try Again
            </button>
          </div>
        ) : movies.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px', color: '#6c757d' }}>
            <h3>No movies found</h3>
            <p>{searchTerm || selectedGenre || selectedYear ? 'Try adjusting your search terms.' : 'No movies have been added yet.'}</p>
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