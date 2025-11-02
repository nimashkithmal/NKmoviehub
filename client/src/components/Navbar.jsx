import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Track if search is from user input or URL update
  const [isUserTyping, setIsUserTyping] = useState(false);

  // Check if we're on home page - define this before useEffects that use it
  const isHomePage = location.pathname === '/';

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

  return (
    <nav className={`navbar ${isScrolled ? 'scrolled' : ''}`}>
      <div className="navbar-container">
        {/* Brand/Logo */}
        <Link to="/" className="navbar-brand">
          <div className="navbar-logo">
            <div className="logo-main-section">
              <span className="logo-primary">NK</span>
              <span className="logo-secondary">Movie</span>
              <div className="logo-hub-container">
                <div className="logo-play-button">
                  <span className="play-icon">▶</span>
                </div>
                <span className="logo-accent">HUB</span>
              </div>
            </div>
            <div className="logo-subtitle-section">
              <span className="subtitle-underline"></span>
              <span className="logo-subtitle">Entertainment Platform</span>
            </div>
          </div>
        </Link>

        {/* Search Bar */}
        <div className="navbar-search">
          <div className={`search-wrapper ${isSearching ? 'searching' : ''}`}>
            <input
              type="text"
              placeholder="Search movies and TV shows..."
              value={searchTerm}
              onChange={(e) => {
                setIsUserTyping(true);
                setSearchTerm(e.target.value);
                if (!isHomePage) {
                  const params = new URLSearchParams();
                  if (e.target.value.trim()) {
                    params.append('search', e.target.value.trim());
                  }
                  navigate(`/?${params.toString()}`);
                }
              }}
              className="search-input"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setIsUserTyping(true);
                  handleSearchWithLoading();
                }
              }}
            />
            <button 
              type="button" 
              className="search-button"
              onClick={() => {
                if (isHomePage) {
                  handleSearchWithLoading();
                } else {
                  const params = new URLSearchParams();
                  if (searchTerm.trim()) {
                    params.append('search', searchTerm.trim());
                  }
                  navigate(`/?${params.toString()}`);
                }
              }}
            >
              {isSearching ? (
                <span className="search-spinner">⏳</span>
              ) : (
                <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.35-4.35"></path>
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 