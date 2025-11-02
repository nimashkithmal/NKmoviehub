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
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
    setIsMobileMenuOpen(false);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <nav className={`navbar ${isScrolled ? 'scrolled' : ''}`}>
      <div className="navbar-container">
        {/* Brand/Logo */}
        <Link to="/" className="navbar-brand" onClick={closeMobileMenu}>
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


        {/* Menu Toggle Button */}
        <div className="menu-toggle-wrapper">
          <button 
            className={`mobile-menu-toggle ${isMobileMenuOpen ? 'active' : ''}`}
            onClick={toggleMobileMenu}
            aria-label="Toggle menu"
            aria-expanded={isMobileMenuOpen}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </div>

      {/* Popup Menu Modal */}
      {isMobileMenuOpen && (
        <>
          <div 
            className="mobile-menu-overlay"
            onClick={closeMobileMenu}
          ></div>
          <div className="menu-toggle-wrapper">
            <div className="mobile-popup-menu">
              <div className="mobile-popup-header">
                <h3>Menu</h3>
                <button 
                  className="mobile-popup-close"
                  onClick={closeMobileMenu}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <div className="mobile-popup-content">
          {/* Mobile Search */}
          <div className="mobile-search">
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
                    closeMobileMenu();
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
                  closeMobileMenu();
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

          {/* Mobile Nav Links */}
          <ul className="mobile-nav-links">
            <li>
              <Link 
                to="/" 
                className={location.pathname === '/' ? 'active' : ''}
                onClick={closeMobileMenu}
              >
                <span className="nav-icon">🏠</span>
                <span>Home</span>
              </Link>
            </li>
            {!isAuthenticated ? (
              <>
                <li>
                  <Link 
                    to="/login" 
                    className={location.pathname === '/login' ? 'active' : ''}
                    onClick={closeMobileMenu}
                  >
                    <span className="nav-icon">🔐</span>
                    <span>Login</span>
                  </Link>
                </li>
                <li>
                  <Link 
                    to="/register" 
                    className={`nav-btn-primary ${location.pathname === '/register' ? 'active' : ''}`}
                    onClick={closeMobileMenu}
                  >
                    <span className="nav-icon">✨</span>
                    <span>Sign Up</span>
                  </Link>
                </li>
              </>
            ) : (
              <>
                <li className="mobile-user-info">
                  <div className="user-profile">
                    <span className="user-avatar">👤</span>
                    <div>
                      <div className="user-name-mobile">{user?.name}</div>
                      <div className="user-role-mobile">{user?.role === 'admin' ? 'Administrator' : 'User'}</div>
                    </div>
                  </div>
                </li>
                {user?.role === 'admin' && (
                  <>
                    <li>
                      <Link 
                        to="/admin" 
                        className={`admin-nav-link ${location.pathname === '/admin' ? 'active' : ''}`}
                        onClick={closeMobileMenu}
                      >
                        <span className="nav-icon">⚙️</span>
                        <span>Admin Dashboard</span>
                      </Link>
                    </li>
                    <li>
                      <Link 
                        to="/add-movie" 
                        className={`admin-nav-link ${location.pathname === '/add-movie' ? 'active' : ''}`}
                        onClick={closeMobileMenu}
                      >
                        <span className="nav-icon">➕</span>
                        <span>Add Movie</span>
                      </Link>
                    </li>
                    <li>
                      <Link 
                        to="/add-tvshow" 
                        className={`admin-nav-link ${location.pathname === '/add-tvshow' ? 'active' : ''}`}
                        onClick={closeMobileMenu}
                      >
                        <span className="nav-icon">📺</span>
                        <span>Add TV Show</span>
                      </Link>
                    </li>
                  </>
                )}
                <li>
                  <button onClick={handleLogout} className="nav-btn-secondary mobile-logout">
                    <span className="nav-icon">🚪</span>
                    <span>Logout</span>
                  </button>
                </li>
              </>
            )}
          </ul>
              </div>
            </div>
          </div>
        </>
      )}
    </nav>
  );
};

export default Navbar; 