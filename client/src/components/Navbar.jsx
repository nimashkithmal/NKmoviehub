import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [showGenrePanel, setShowGenrePanel] = useState(false);
  const [showYearPanel, setShowYearPanel] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  // Available genres and years
  const genres = ['Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 'Drama', 'Family', 'Fantasy', 'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller', 'War', 'Western'];
  const years = Array.from({ length: 30 }, (_, i) => new Date().getFullYear() - i);

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

  // Add search loading state
  const [isSearching, setIsSearching] = useState(false);

  // Update handleSearch to show loading state
  const handleSearchWithLoading = useCallback(() => {
    if (searchTerm.trim() || selectedGenre || selectedYear) {
      setIsSearching(true);
      
      // Navigate to home with search parameters
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.append('search', searchTerm.trim());
      if (selectedGenre) params.append('genre', selectedGenre);
      if (selectedYear) params.append('year', selectedYear);
      
      navigate(`/?${params.toString()}`);
      setIsSearchExpanded(false);
      
      // Reset loading state after navigation
      setTimeout(() => setIsSearching(false), 1000);
    }
  }, [searchTerm, selectedGenre, selectedYear, navigate]);

  // Immediate search for short terms (1-2 characters)
  useEffect(() => {
    if (searchTerm.trim().length <= 2 && searchTerm.trim()) {
      handleSearchWithLoading();
    }
  }, [searchTerm, handleSearchWithLoading]);

  // Auto-search when search term changes (for longer terms)
  useEffect(() => {
    if (searchTerm.trim().length > 2) {
      const timeoutId = setTimeout(() => {
        handleSearchWithLoading();
      }, 300); // Short delay for longer terms

      return () => clearTimeout(timeoutId);
    }
  }, [searchTerm, handleSearchWithLoading]);

  // Immediate search for genre and year changes
  useEffect(() => {
    if (selectedGenre || selectedYear) {
      handleSearchWithLoading();
    }
  }, [selectedGenre, selectedYear, handleSearchWithLoading]);

  // Handle search submission (for manual button click)
  const handleSearch = useCallback(() => {
    if (searchTerm.trim() || selectedGenre || selectedYear) {
      // Navigate to home with search parameters
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.append('search', searchTerm.trim());
      if (selectedGenre) params.append('genre', selectedGenre);
      if (selectedYear) params.append('year', selectedYear);
      
      navigate(`/?${params.toString()}`);
      setIsSearchExpanded(false);
    }
  }, [searchTerm, selectedGenre, selectedYear, navigate]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setSelectedGenre('');
    setSelectedYear('');
    setShowGenrePanel(false);
    setShowYearPanel(false);
    navigate('/');
  }, [navigate]);

  // Check if we're on home page to show search
  const isHomePage = location.pathname === '/';

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="navbar">
      <div className="container">
        <Link to="/" className="navbar-brand">
          <div className="brand-container">
            <div className="logo-icon">
              <div className="logo-circle">
                <span className="logo-movie">🎬</span>
              </div>
            </div>
            <div className="brand-text">
              <span className="brand-main">NKMovieHUB</span>
              <span className="brand-tagline">Your Ultimate Movie Destination</span>
              <div className="brand-logo-badge">
                <span className="brand-logo-text">NK</span>
                <div className="brand-logo-dots">
                  <span className="dot"></span>
                  <span className="dot"></span>
                  <span className="dot"></span>
                </div>
              </div>
            </div>
          </div>
        </Link>

        {/* Search and Filters Section */}
        {isHomePage && (
          <div className="navbar-search-section">
            <div className="navbar-search-form">
              {/* Search Bar */}
              <div className={`navbar-search-wrapper ${isSearching ? 'searching' : ''}`}>
                <input
                  type="text"
                  placeholder="Search movies..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="navbar-search-input"
                />
                <button 
                  type="button" 
                  className="navbar-search-btn"
                  onClick={handleSearchWithLoading}
                >
                  {isSearching ? '⏳' : '🔍'}
                </button>
              </div>
              
              {/* Search Status Indicator */}
              {isSearching && (
                <div className="search-status">
                  <span className="search-indicator">🔍 Searching...</span>
                </div>
              )}

              {/* Filter Controls */}
              <div className="navbar-filter-controls">
                {/* Genre Select */}
                <div className="filter-select-group">
                  <button
                    type="button"
                    className={`navbar-filter-btn ${selectedGenre ? 'has-selection' : ''}`}
                    onClick={() => setShowGenrePanel(!showGenrePanel)}
                  >
                    <span className="filter-btn-text">
                      {selectedGenre || 'Genre'}
                    </span>
                    <span className={`filter-arrow ${showGenrePanel ? 'rotated' : ''}`}>
                      ▼
                    </span>
                  </button>
                  
                  {showGenrePanel && (
                    <div className="navbar-select-panel genre-panel">
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

                {/* Year Select */}
                <div className="filter-select-group">
                  <button
                    type="button"
                    className={`navbar-filter-btn ${selectedYear ? 'has-selection' : ''}`}
                    onClick={() => setShowYearPanel(!showYearPanel)}
                  >
                    <span className="filter-btn-text">
                      {selectedYear || 'Year'}
                    </span>
                    <span className={`filter-arrow ${showYearPanel ? 'rotated' : ''}`}>
                      ▼
                    </span>
                  </button>
                  
                  {showYearPanel && (
                    <div className="navbar-select-panel year-panel">
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

                {/* Clear Filters Button */}
                {(searchTerm || selectedGenre || selectedYear) && (
                  <button
                    type="button"
                    className="navbar-clear-btn"
                    onClick={clearFilters}
                  >
                    ✕ Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <ul className="navbar-nav">
          <li>
            <Link to="/">Home</Link>
          </li>
          {!isAuthenticated ? (
            <>
              <li>
                <Link to="/login">Login</Link>
              </li>
              <li>
                <Link to="/register">Register</Link>
              </li>
            </>
          ) : (
            <>
              <li>
                <span className="user-welcome">Welcome, {user?.name}!</span>
              </li>
              {user?.role === 'admin' && (
                <>
                  <li>
                    <Link to="/admin" className="admin-link">Admin Dashboard</Link>
                  </li>
                  <li>
                    <Link to="/add-movie" className="admin-link">Add Movie</Link>
                  </li>
                </>
              )}
              <li>
                <button 
                  onClick={handleLogout}
                  className="btn btn-secondary logout-btn"
                >
                  Logout
                </button>
              </li>
            </>
          )}
        </ul>
      </div>
    </nav>
  );
};

export default Navbar; 