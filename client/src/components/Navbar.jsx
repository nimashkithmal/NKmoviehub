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
  const [isSearching, setIsSearching] = useState(false);

  // Track if search is from user input or URL update
  const [isUserTyping, setIsUserTyping] = useState(false);

  // Check if we're on home page - define this before useEffects that use it
  const isHomePage = location.pathname === '/';

  // Initialize search term from URL parameters
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const searchParam = params.get('search') || '';
    if (searchParam !== searchTerm) {
      setIsUserTyping(false); // Mark as URL update, not user typing
      setSearchTerm(searchParam);
    }
  }, [location.search]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update handleSearch to show loading state
  const handleSearchWithLoading = useCallback(() => {
    if (searchTerm.trim()) {
      setIsSearching(true);
      
      // Navigate to home with search parameters
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.append('search', searchTerm.trim());
      
      // Preserve type parameter if it exists
      const currentParams = new URLSearchParams(location.search);
      const currentType = currentParams.get('type');
      if (currentType) {
        params.append('type', currentType);
      }
      
      navigate(`/?${params.toString()}`);
      setIsSearchExpanded(false);
      
      // Reset loading state after navigation
      setTimeout(() => setIsSearching(false), 1000);
    } else {
      // If search is cleared, navigate to home and preserve type
      const params = new URLSearchParams();
      const currentParams = new URLSearchParams(location.search);
      const currentType = currentParams.get('type');
      if (currentType) {
        params.append('type', currentType);
      }
      navigate(`/?${params.toString()}`);
    }
  }, [searchTerm, navigate, location.search]);

  // Immediate search for short terms (1-2 characters) - only when user is typing
  useEffect(() => {
    if (isUserTyping && searchTerm.trim().length <= 2 && searchTerm.trim() && isHomePage) {
      handleSearchWithLoading();
    }
  }, [searchTerm, handleSearchWithLoading, isUserTyping, isHomePage]);

  // Auto-search when search term changes (for longer terms) - only when user is typing
  useEffect(() => {
    if (isUserTyping && searchTerm.trim().length > 2 && isHomePage) {
      const timeoutId = setTimeout(() => {
        handleSearchWithLoading();
      }, 300); // Short delay for longer terms

      return () => clearTimeout(timeoutId);
    }
  }, [searchTerm, handleSearchWithLoading, isUserTyping, isHomePage]);


  // Handle search submission (for manual button click)
  const handleSearch = useCallback(() => {
    if (searchTerm.trim()) {
      // Navigate to home with search parameters
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.append('search', searchTerm.trim());
      
      // Preserve type parameter if it exists
      const currentParams = new URLSearchParams(location.search);
      const currentType = currentParams.get('type');
      if (currentType) {
        params.append('type', currentType);
      }
      
      navigate(`/?${params.toString()}`);
      setIsSearchExpanded(false);
    }
  }, [searchTerm, navigate, location.search]);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchTerm('');
    // Preserve type parameter when clearing search
    const params = new URLSearchParams();
    const currentParams = new URLSearchParams(location.search);
    const currentType = currentParams.get('type');
    if (currentType) {
      params.append('type', currentType);
    }
    navigate(`/?${params.toString()}`);
  }, [navigate, location.search]);

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
        <div className="navbar-search-section">
          <div className="navbar-search-form">
            {/* Search Bar */}
            <div className={`navbar-search-wrapper ${isSearching ? 'searching' : ''}`}>
              <input
                type="text"
                placeholder="Search movies and TV shows..."
                value={searchTerm}
                onChange={(e) => {
                  setIsUserTyping(true); // Mark as user typing
                  setSearchTerm(e.target.value);
                  // Navigate to home if not already there when typing
                  if (!isHomePage) {
                    const params = new URLSearchParams();
                    if (e.target.value.trim()) {
                      params.append('search', e.target.value.trim());
                    }
                    const currentParams = new URLSearchParams(location.search);
                    const currentType = currentParams.get('type');
                    if (currentType) {
                      params.append('type', currentType);
                    }
                    navigate(`/?${params.toString()}`);
                  }
                }}
                className="navbar-search-input"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setIsUserTyping(true);
                    handleSearchWithLoading();
                  }
                }}
              />
              <button 
                type="button" 
                className="navbar-search-btn"
                onClick={() => {
                  if (isHomePage) {
                    handleSearchWithLoading();
                  } else {
                    // Navigate to home with search
                    const params = new URLSearchParams();
                    if (searchTerm.trim()) {
                      params.append('search', searchTerm.trim());
                    }
                    navigate(`/?${params.toString()}`);
                  }
                }}
              >
                {isSearching ? '⏳' : '🔍'}
              </button>
            </div>
            
            {/* Search Status Indicator */}
            {isSearching && isHomePage && (
              <div className="search-status">
                <span className="search-indicator">🔍 Searching...</span>
              </div>
            )}

            {/* Clear Search Button */}
            {searchTerm && isHomePage && (
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
                  <li>
                    <Link to="/add-tvshow" className="admin-link">Add TV Show</Link>
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