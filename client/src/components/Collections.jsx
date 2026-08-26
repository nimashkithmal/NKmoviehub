import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Collections.css';

/**
 * Public collections page — franchise headers + name-only movie lists.
 */
const Collections = () => {
  const navigate = useNavigate();
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/collections');
        const result = await response.json();
        if (result.success) {
          setCollections(result.data.collections || []);
        } else {
          setError(result.message || 'Failed to load collections');
        }
      } catch (err) {
        console.error('Collections fetch error:', err);
        setError('Failed to load collections. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="collections-page">
        <div className="collections-loading">
          <div className="loading-spinner" />
          <p>Loading collections…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="collections-page">
        <div className="collections-empty">
          <h1>Collections</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="collections-page">
      <header className="collections-header">
        <h1>Collections</h1>
        <p>Browse movies by universe and franchise.</p>
      </header>

      {collections.length === 0 ? (
        <div className="collections-empty">
          <p>No collections yet. Check back soon.</p>
        </div>
      ) : (
        <div className="collections-list">
          {collections.map((collection) => {
            const movies = (collection.movies || []).filter(Boolean);
            return (
              <section key={collection._id} className="collection-block">
                <h2 className="collection-name">{collection.name}</h2>
                {collection.description ? (
                  <p className="collection-desc">{collection.description}</p>
                ) : null}
                {movies.length === 0 ? (
                  <p className="collection-empty-note">No movies in this collection yet.</p>
                ) : (
                  <ul className="collection-movie-names">
                    {movies.map((movie) => (
                      <li key={movie._id}>
                        <button
                          type="button"
                          className="collection-movie-link"
                          onClick={() => navigate(`/movie/${movie._id}`)}
                        >
                          {movie.title}
                          {movie.year ? ` (${movie.year})` : ''}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Collections;
