import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

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