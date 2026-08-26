import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { APP_VERSION } from '../version';
import './Navbar.css';

const Navbar = () => {
  const { user, isAuthenticated, logout, token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const searchInputRef = useRef(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState({});
  const [replyingId, setReplyingId] = useState(null);
  const [expandedNotifId, setExpandedNotifId] = useState(null);

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

  const fetchUnreadCount = useCallback(async () => {
    if (!isAdmin || !token) return;
    try {
      const response = await fetch('/api/notifications/unread-count', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setUnreadCount(result.data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Unread notifications error:', err);
    }
  }, [isAdmin, token]);

  const fetchNotifications = useCallback(async () => {
    if (!isAdmin || !token) return;
    setNotifLoading(true);
    try {
      const response = await fetch('/api/notifications?limit=20', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setNotifications(result.data.notifications || []);
        setUnreadCount(result.data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Notifications fetch error:', err);
    } finally {
      setNotifLoading(false);
    }
  }, [isAdmin, token]);

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
      setNotifOpen(false);
      setNotifications([]);
      setUnreadCount(0);
      return undefined;
    }

    fetchUnreadCount();
    const timer = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(timer);
  }, [isAdmin, fetchUnreadCount]);

  useEffect(() => {
    if (!isAdmin) return undefined;

    const onPointerDown = (event) => {
      if (!event.target.closest('.nav-account')) {
        setAccountOpen(false);
      }
      if (!event.target.closest('.nav-notifications')) {
        setNotifOpen(false);
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
    setNotifOpen(false);
    navigate('/');
  };

  const toggleNotifications = async () => {
    const next = !notifOpen;
    setNotifOpen(next);
    setAccountOpen(false);
    if (next) {
      await fetchNotifications();
    }
  };

  const markOneRead = async (notification) => {
    if (!token || notification.read) return;
    try {
      const response = await fetch(`/api/notifications/${notification._id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setNotifications((prev) =>
          prev.map((n) => (n._id === notification._id ? { ...n, read: true } : n))
        );
        setUnreadCount(result.data.unreadCount ?? Math.max(0, unreadCount - 1));
      }
    } catch (err) {
      console.error('Mark notification read error:', err);
    }
  };

  const markAllRead = async () => {
    if (!token || unreadCount === 0) return;
    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Mark all read error:', err);
    }
  };

  const openNotification = async (notification) => {
    await markOneRead(notification);
    setExpandedNotifId((prev) =>
      prev === notification._id ? null : notification._id
    );
  };

  const submitReply = async (notification) => {
    const movieId = notification.movie?._id || notification.movie;
    const questionId = notification.question?._id || notification.question;
    const answer = String(replyDrafts[notification._id] || '').trim();
    if (!token || !movieId || !questionId || !answer) return;

    setReplyingId(notification._id);
    try {
      const response = await fetch(`/api/movies/${movieId}/questions/${questionId}/reply`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ answer })
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to reply');
      }

      setNotifications((prev) =>
        prev.map((n) =>
          n._id === notification._id
            ? {
                ...n,
                read: true,
                replied: true,
                question: result.data.question
                  ? { ...n.question, ...result.data.question }
                  : n.question
              }
            : n
        )
      );
      setReplyDrafts((prev) => ({ ...prev, [notification._id]: '' }));
      setUnreadCount((count) => Math.max(0, count - (notification.read ? 0 : 1)));
    } catch (err) {
      console.error('Reply error:', err);
      alert(err.message || 'Could not post reply');
    } finally {
      setReplyingId(null);
    }
  };

  const goToMovieFromNotif = (notification) => {
    setNotifOpen(false);
    const movieId = notification.movie?._id || notification.movie;
    if (movieId) navigate(`/movie/${movieId}`);
  };

  const formatNotifTime = (value) => {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString();
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
            <>
              <div className="nav-notifications">
                <button
                  type="button"
                  className="nav-notif-toggle"
                  aria-label="Admin notifications"
                  aria-expanded={notifOpen}
                  onClick={toggleNotifications}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="nav-notif-badge">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="nav-notif-menu">
                    <div className="nav-notif-header">
                      <span>Notifications</span>
                      {unreadCount > 0 && (
                        <button type="button" onClick={markAllRead}>
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="nav-notif-list">
                      {notifLoading && (
                        <div className="nav-notif-empty">Loading...</div>
                      )}
                      {!notifLoading && notifications.length === 0 && (
                        <div className="nav-notif-empty">No notifications yet</div>
                      )}
                      {!notifLoading &&
                        notifications.map((n) => {
                          const isExpanded = expandedNotifId === n._id;
                          const alreadyReplied =
                            n.replied || Boolean(n.question?.answer);
                          return (
                            <div
                              key={n._id}
                              className={`nav-notif-item${n.read ? '' : ' is-unread'}${
                                isExpanded ? ' is-expanded' : ''
                              }`}
                            >
                              <button
                                type="button"
                                className="nav-notif-main"
                                onClick={() => openNotification(n)}
                              >
                                <div className="nav-notif-title">{n.title}</div>
                                <div className="nav-notif-msg">{n.message}</div>
                                <div className="nav-notif-meta">
                                  {alreadyReplied ? 'Replied' : 'Needs reply'}
                                  {n.createdAt ? ` · ${formatNotifTime(n.createdAt)}` : ''}
                                </div>
                              </button>

                              {isExpanded && (
                                <div className="nav-notif-reply">
                                  {alreadyReplied ? (
                                    <p className="nav-notif-answer">
                                      {n.question?.answer || 'Reply already posted.'}
                                    </p>
                                  ) : (
                                    <>
                                      <textarea
                                        value={replyDrafts[n._id] || ''}
                                        onChange={(e) =>
                                          setReplyDrafts((prev) => ({
                                            ...prev,
                                            [n._id]: e.target.value
                                          }))
                                        }
                                        placeholder="Write your reply..."
                                        rows={3}
                                      />
                                      <button
                                        type="button"
                                        className="nav-notif-reply-btn"
                                        disabled={
                                          replyingId === n._id ||
                                          !String(replyDrafts[n._id] || '').trim()
                                        }
                                        onClick={() => submitReply(n)}
                                      >
                                        {replyingId === n._id ? 'Posting...' : 'Reply'}
                                      </button>
                                    </>
                                  )}
                                  <button
                                    type="button"
                                    className="nav-notif-open-movie"
                                    onClick={() => goToMovieFromNotif(n)}
                                  >
                                    Open movie page
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              <div className="nav-account">
                <button
                  type="button"
                  className="nav-account-toggle"
                  aria-label="Admin account menu"
                  aria-expanded={accountOpen}
                  onClick={() => {
                    setAccountOpen((open) => !open);
                    setNotifOpen(false);
                  }}
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
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
