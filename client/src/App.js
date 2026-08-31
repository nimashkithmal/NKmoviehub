import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './components/Home';
import Login from './components/Login';
import ForgotPassword from './components/ForgotPassword';
import AdminDashboard from './components/AdminDashboard';
import AddMovie from './components/AddMovie';
import AddTVShow from './components/AddTVShow';
import MovieDetail from './components/MovieDetail';
import TVShowDetail from './components/TVShowDetail';
import TVWatchPage from './components/TVWatchPage';
import Collections from './components/Collections';
import CastCollection from './components/CastCollection';
import LegalPage, { ContactPage } from './components/LegalPage';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider, useAuth } from './context/AuthContext';
import { trackPageView } from './utils/analytics';
import { updatePageSeo } from './utils/seo';
import './App.css';

// Protected Route component
const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (adminOnly && user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  
  return children;
};

const AppShell = () => {
  const location = useLocation();
  const isDetailPage =
    location.pathname.startsWith('/movie/') ||
    location.pathname.startsWith('/tvshow/') ||
    location.pathname.startsWith('/watch/');
  const isFullBleedMain =
    isDetailPage || location.pathname === '/collections' || location.pathname === '/cast-collection';

  useEffect(() => {
    updatePageSeo(location.pathname);
    trackPageView(location.pathname + location.search, document.title);
  }, [location.pathname, location.search]);

  return (
    <div className={`App${isDetailPage ? ' is-detail-page' : ''}`}>
      {!isDetailPage && <Navbar />}
      <main className={`container${isFullBleedMain ? ' container-detail' : ''}`}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/collections" element={<Collections />} />
          <Route path="/cast-collection" element={<CastCollection />} />
          <Route path="/about" element={<LegalPage slug="about" />} />
          <Route path="/privacy" element={<LegalPage slug="privacy" />} />
          <Route path="/terms" element={<LegalPage slug="terms" />} />
          <Route path="/dmca" element={<LegalPage slug="dmca" />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/movie/:id" element={<MovieDetail />} />
          <Route path="/tvshow/:id" element={<TVShowDetail />} />
          <Route path="/watch/tv/:id" element={<TVWatchPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute adminOnly={true}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/add-movie"
            element={
              <ProtectedRoute adminOnly={true}>
                <AddMovie />
              </ProtectedRoute>
            }
          />
          <Route
            path="/add-tvshow"
            element={
              <ProtectedRoute adminOnly={true}>
                <AddTVShow />
              </ProtectedRoute>
            }
          />
          {/* Anything else, /register included, belongs on the public site */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!isDetailPage && <Footer />}
    </div>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true
          }}
        >
          <AppShell />
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App; 