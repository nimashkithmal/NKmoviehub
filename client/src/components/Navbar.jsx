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
          NKMovieHUB
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
              {user?.role === 'admin' && (
                <li>
                  <Link to="/admin">Admin Dashboard</Link>
                </li>
              )}
              <li>
                <span>Welcome, {user?.name}!</span>
              </li>
              <li>
                <button 
                  onClick={handleLogout}
                  className="btn btn-secondary"
                  style={{ padding: '5px 15px', fontSize: '14px' }}
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