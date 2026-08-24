import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { APP_VERSION } from '../version';
import './Navbar.css';

const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const searchInputRef = useRef(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const isAdmin = Boolean(isAuthenticated && user?.role === 'admin');

  const params = new URLSearchParams(location.search);
  const typeParam = params.get('type');
  const browseParam = params.get('browse');
  const hasBrowseFilters = Boolean(
    params.get('search') || params.get('genre') || params.get('year') || browseParam === '1'
  );

  const isHomeActive =
    location.pathname === '/' && typeParam !== 'tvshows' && !hasBrowseFilters;
  const isMoviesActive =
    location.pathname.startsWith('/movie') ||
    (location.pathname === '/' && typeParam !== 'tvshows' && hasBrowseFilters);
  const isTVShowsActive =
    location.pathname.startsWith('/tvshow') ||
    (location.pathname === '/' && typeParam === 'tvshows');
  const isCollectionsActive = location.pathname.startsWith('/collections');

  const isHomePage = location.pathname === '/';

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const searchParam = params.get('search') || '';
    setSearchTerm(searchParam);
    if (searchParam) setSearchOpen(true);
  }, [location.search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus();
    }
  }, [searchOpen]);

  useEffect(() => {
    if (!isAdmin) {
      setAccountOpen(false);
      return undefined;
    }

    const onPointerDown = (event) => {
      if (!event.target.closest('.nav-account')) {
        setAccountOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [isAdmin]);

  const submitSearch = useCallback(() => {
    const value = searchTerm.trim();
    if (!value) {
      navigate(typeParam === 'tvshows' ? '/?type=tvshows' : '/');
      return;
    }
    const next = new URLSearchParams();
    next.set('search', value);
    if (typeParam === 'tvshows') next.set('type', 'tvshows');
    navigate(`/?${next.toString()}`);
  }, [searchTerm, navigate, typeParam]);

  const goHome = () => {
    navigate('/');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goMovies = () => {
    navigate('/?browse=1');
  };

  const goTVShows = () => {
    navigate('/?type=tvshows');
  };

  const goCollections = () => {
    navigate('/collections');
  };

  const handleLogout = () => {
    logout();
    setAccountOpen(false);
    navigate('/');
  };

  return (
    <nav
      className={`navbar ${isScrolled ? 'scrolled' : ''} ${
        isHomePage && !isScrolled ? 'navbar-hero' : ''
      }`}
    >
      <div className="navbar-container">
        <div className="nav-left">
          <Link to="/" className="navbar-brand" aria-label="NK Movie Hub home">
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
                <span className="logo-subtitle">Entertainment Platform</span>
                <span className="subtitle-underline" aria-hidden="true"></span>
              </div>
            </div>
          </Link>
        </div>

        <div className="nav-center" role="navigation" aria-label="Primary">
          <button
            type="button"
            className={`nav-link ${isHomeActive ? 'is-active' : ''}`}
            onClick={goHome}
          >
            Home
          </button>
          <button
            type="button"
            className={`nav-link ${isMoviesActive ? 'is-active' : ''}`}
            onClick={goMovies}
          >
            Movies
          </button>
          <button
            type="button"
            className={`nav-link ${isTVShowsActive ? 'is-active' : ''}`}
            onClick={goTVShows}
          >
            TV Shows
          </button>
          <button
            type="button"
            className={`nav-link ${isCollectionsActive ? 'is-active' : ''}`}
            onClick={goCollections}
          >
            Collections
          </button>
        </div>

        <div className="nav-right">
          <div className={`nav-search ${searchOpen ? 'is-open' : ''}`}>
            <button
              type="button"
              className="nav-search-toggle"
              aria-label={searchOpen ? 'Close search' : 'Open search'}
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen((open) => !open)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </button>

            {searchOpen && (
              <form
                className="nav-search-panel"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitSearch();
                }}
              >
                <input
                  ref={searchInputRef}
                  type="search"
                  className="nav-search-input"
                  placeholder="Search movies and TV shows..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setSearchOpen(false);
                  }}
                />
                <button type="submit" className="nav-search-go" aria-label="Search">
                  Go
                </button>
              </form>
            )}
          </div>

          {isAdmin && (
            <div className="nav-account">
              <button
                type="button"
                className="nav-account-toggle"
                aria-label="Admin account menu"
                aria-expanded={accountOpen}
                onClick={() => setAccountOpen((open) => !open)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" />
                </svg>
              </button>

              {accountOpen && (
                <div className="nav-account-menu">
                  <div className="nav-account-label">{user?.name || 'Admin'}</div>
                  <Link to="/admin" onClick={() => setAccountOpen(false)}>
                    Admin Dashboard
                  </Link>
                  <Link to="/add-movie" onClick={() => setAccountOpen(false)}>
                    Add Movie
                  </Link>
                  <Link to="/add-tvshow" onClick={() => setAccountOpen(false)}>
                    Add TV Show
                  </Link>
                  <button type="button" onClick={handleLogout}>
                    Logout
                  </button>
                  <div className="nav-account-version">v{APP_VERSION}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
