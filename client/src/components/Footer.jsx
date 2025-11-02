import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';

const Footer = () => {
  const location = useLocation();
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Check if we're on admin dashboard to hide footer
  const isAdminPage = location.pathname.startsWith('/admin');

  // Show scroll to top button when user scrolls down
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Scroll to top function
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  // Don't render footer on admin pages
  if (isAdminPage) {
    return null;
  }

  return (
    <>
      <footer className="website-footer">
        <div className="footer-container">
          <div className="footer-top">
            <div className="footer-logo-section">
              <Link to="/" className="navbar-brand footer-brand">
                <div className="navbar-logo footer-logo">
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
            </div>
          </div>
          
          <div className="footer-divider"></div>
          
          <div className="footer-bottom">
            <div className="footer-copyright">
              <div className="copyright-info">
                <p>NKMovieHUB</p>
                <p>Author: Nimash kithmal | Contact: qwe730375@gmail.com</p>
                <p>Established: 2024 | All Rights Reserved</p>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button 
          className="scroll-to-top-btn"
          onClick={scrollToTop}
          aria-label="Scroll to top"
        >
          <span className="scroll-arrow">↑</span>
        </button>
      )}
    </>
  );
};

export default Footer;
