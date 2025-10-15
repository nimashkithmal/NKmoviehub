import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);


  // Add search loading state
  const [isSearching, setIsSearching] = useState(false);

  // Update handleSearch to show loading state
  const handleSearchWithLoading = useCallback(() => {
    if (searchTerm.trim()) {
      setIsSearching(true);
      
      // Navigate to home with search parameters
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.append('search', searchTerm.trim());
      
      navigate(`/?${params.toString()}`);
      setIsSearchExpanded(false);
      
      // Reset loading state after navigation
      setTimeout(() => setIsSearching(false), 1000);
    }
  }, [searchTerm, navigate]);

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


  // Handle search submission (for manual button click)
  const handleSearch = useCallback(() => {
    if (searchTerm.trim()) {
      // Navigate to home with search parameters
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.append('search', searchTerm.trim());
      
      navigate(`/?${params.toString()}`);
      setIsSearchExpanded(false);
    }
  }, [searchTerm, navigate]);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchTerm('');
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
            <div className="brand-text">
              <span className="brand-nk">NK</span>
              <span className="brand-movie">Movie</span>
              <span className="brand-hub">HUB</span>
            </div>
            <div className="brand-tagline">YOUR ULTIMATE MOVIE DESTINATION</div>
            <div className="brand-logo-badge">
              <span className="brand-logo-text">NK</span>
              <div className="brand-logo-dots">
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="dot"></span>
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

              {/* Clear Search Button */}
              {searchTerm && (
                <div className="navbar-filter-controls">
                  <button
                    type="button"
                    className="navbar-clear-btn"
                    onClick={clearSearch}
                  >
                    ✕ Clear
                  </button>
                </div>
              )}
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
          <li>
            <button className="navbar-icon-btn" aria-label="Movie Hub">
              <span className="navbar-icon">🎬</span>
            </button>
          </li>
        </ul>
      </div>
    </nav>
  );
};

export default Navbar; 