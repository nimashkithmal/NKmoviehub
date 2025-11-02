import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../components/Navbar.css';

const Header = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [genres, setGenres] = useState([]);
  const [years, setYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
    if (activeDropdown) setActiveDropdown(null);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const handleLogout = () => {
    logout();
    closeMobileMenu();
    navigate('/');
  };
  
  // Get current filter parameters from URL
  const urlParams = new URLSearchParams(location.search);
  const currentGenre = urlParams.get('genre');
  const currentYear = urlParams.get('year');
  const currentType = urlParams.get('type');

  // Fetch genres and years from API
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        setLoading(true);
        // Fetch filters based on current type (movies or tvshows)
        const apiEndpoint = currentType === 'tvshows' 
          ? 'http://localhost:5001/api/tvshows/filters'
          : 'http://localhost:5001/api/movies/filters';
        
        const response = await fetch(apiEndpoint);
        const result = await response.json();
        
        if (result.success) {
          setGenres(result.data.genres || []);
          setYears(result.data.years || []);
        }
      } catch (error) {
        console.error('Error fetching filters:', error);
        setGenres([]);
        setYears([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFilters();
  }, [currentType]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!activeDropdown) return;

    const handleClickOutside = (event) => {
      const target = event.target;
      const isInsideDropdown = target.closest('.header-dropdown');
      const isInsideCategory = target.closest('.header-category-wrapper');
      
      if (!isInsideDropdown && !isInsideCategory) {
        setActiveDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeDropdown]);

  // Create categories array that updates when genres/years change
  const categories = useMemo(() => [
    {
      icon: '🎬',
      text: 'ALL MOVIES',
      path: '/',
      dropdown: null
    },
    {
      icon: '📺',
      text: 'TV SHOWS',
      path: '/?type=tvshows',
      dropdown: null
    },
    {
      icon: '📞',
      text: 'CONTACT US',
      path: '/#contact',
      dropdown: null
    },
    {
      icon: '📁',
      text: 'GENRES',
      path: '/genres',
      dropdown: {
        options: genres && genres.length > 0 ? genres : [],
        columns: 3
      }
    },
    {
      icon: '📅',
      text: 'YEARS',
      path: '/years',
      dropdown: {
        options: years && years.length > 0 ? years.map(year => year.toString()) : [],
        columns: 4
      }
    }
  ], [genres, years]);

  const handleCategoryClick = (category) => {
    if (category.dropdown) {
      setActiveDropdown(activeDropdown === category.text ? null : category.text);
    } else {
      // For ALL MOVIES, clear all filters and scroll to movies
      if (category.path === '/') {
        // Clear all filters by navigating to home without parameters
        navigate('/', { replace: true });
        
        // Scroll to movies section
        setTimeout(() => {
          const moviesSection = document.getElementById('movies-section');
          if (moviesSection) {
            moviesSection.scrollIntoView({ behavior: 'smooth' });
          }
        }, 100);
      } else if (category.path === '/?type=tvshows') {
        // Navigate to TV shows page
        navigate('/?type=tvshows', { replace: true });
        
        // Scroll to content section
        setTimeout(() => {
          const moviesSection = document.getElementById('movies-section');
          if (moviesSection) {
            moviesSection.scrollIntoView({ behavior: 'smooth' });
          }
        }, 100);
      } else if (category.path === '/#contact') {
        // Navigate to home and scroll to contact section
        navigate('/');
        setTimeout(() => {
          const contactSection = document.getElementById('contact');
          if (contactSection) {
            contactSection.scrollIntoView({ behavior: 'smooth' });
          }
        }, 100);
      }
      setActiveDropdown(null);
    }
  };

  const handleOptionClick = (option, category) => {
    console.log(`Selected: ${option} from ${category}`);
    
    // Navigate to home page with filter parameters
    const params = new URLSearchParams();
    
    // Preserve the type parameter if it exists
    if (currentType) {
      params.append('type', currentType);
    }
    
    if (category === 'GENRES') {
      params.append('genre', option);
    } else if (category === 'YEARS') {
      params.append('year', option);
    }
    
    // Navigate to home with filter parameters
    navigate(`/?${params.toString()}`);
    
    // Close dropdown
    setActiveDropdown(null);
    
    // Scroll to content section after navigation
    setTimeout(() => {
      const moviesSection = document.getElementById('movies-section');
      if (moviesSection) {
        moviesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        // Fallback: scroll to top if section not found
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 100);
  };

  return (
    <>
      <header className="movie-header">
        <div className="header-container">
          {categories.map((category, index) => (
            <div key={index} className="header-category-wrapper">
              <button
                className={`header-category ${activeDropdown === category.text ? 'active' : ''} ${
                  (category.text === 'GENRES' && currentGenre) || 
                  (category.text === 'YEARS' && currentYear) ||
                  (category.text === 'ALL MOVIES' && !currentType) ||
                  (category.text === 'TV SHOWS' && currentType === 'tvshows') ? 'has-filter' : ''
                }`}
                onClick={() => handleCategoryClick(category)}
              >
                <span className="category-icon">{category.icon}</span>
                <span className="category-text">{category.text}</span>
                {category.text === 'GENRES' && currentGenre && (
                  <span className="filter-indicator">●</span>
                )}
                {category.text === 'YEARS' && currentYear && (
                  <span className="filter-indicator">●</span>
                )}
                {(category.text === 'ALL MOVIES' && !currentType) && (
                  <span className="filter-indicator">●</span>
                )}
                {(category.text === 'TV SHOWS' && currentType === 'tvshows') && (
                  <span className="filter-indicator">●</span>
                )}
              </button>
            </div>
          ))}

          {/* Mobile Menu Toggle Button */}
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
      </header>

      {/* Popup Modal for Genres/Years */}
      {activeDropdown && categories.find(cat => cat.text === activeDropdown)?.dropdown && (
        <>
          <div 
            className="header-popup-overlay"
            onClick={() => setActiveDropdown(null)}
          ></div>
          <div className="header-popup">
            <div className="header-popup-header">
              <h3>{activeDropdown}</h3>
              <button 
                className="header-popup-close"
                onClick={() => setActiveDropdown(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className={`header-popup-content columns-${categories.find(cat => cat.text === activeDropdown)?.dropdown.columns || 3}`}>
              {loading ? (
                <div className="popup-loading">Loading...</div>
              ) : categories.find(cat => cat.text === activeDropdown)?.dropdown.options && categories.find(cat => cat.text === activeDropdown)?.dropdown.options.length > 0 ? (
                categories.find(cat => cat.text === activeDropdown)?.dropdown.options.map((option, optionIndex) => (
                  <button
                    key={optionIndex}
                    className={`popup-option ${
                      (activeDropdown === 'GENRES' && currentGenre === option) ||
                      (activeDropdown === 'YEARS' && currentYear === option.toString())
                        ? 'active' : ''
                    }`}
                    onClick={() => handleOptionClick(option, activeDropdown)}
                  >
                    {option}
                  </button>
                ))
              ) : (
                <div className="popup-loading">No options available</div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Mobile Popup Menu Modal */}
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
    </>
  );
};

export default Header;
