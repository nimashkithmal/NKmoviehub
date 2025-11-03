import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../components/Navbar.css';

const Header = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const [activeDropdown, setActiveDropdown] = useState(null);
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
  const currentType = urlParams.get('type');


  // Create categories array
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
    }
  ], []);

  const handleCategoryClick = (category) => {
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
  };


  return (
    <>
      <header className="movie-header">
        <div className="header-container">
          {categories.map((category, index) => (
            <div key={index} className="header-category-wrapper">
              <button
                className={`header-category ${activeDropdown === category.text ? 'active' : ''} ${
                  (category.text === 'ALL MOVIES' && !currentType) ||
                  (category.text === 'TV SHOWS' && currentType === 'tvshows') ? 'has-filter' : ''
                }`}
                onClick={() => handleCategoryClick(category)}
              >
                <span className="category-icon">{category.icon}</span>
                <span className="category-text">{category.text}</span>
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
