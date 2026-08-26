import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './CollectionManagement.css';

const API_URL = '/api/collections';

/**
 * Admin: create franchise collections and attach movies as a name list.
 */
const CollectionManagement = ({ token, showNotification }) => {
  const [collections, setCollections] = useState([]);
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [order, setOrder] = useState(0);
  const [status, setStatus] = useState('active');
  const [selectedIds, setSelectedIds] = useState([]);
  const [catalogQuery, setCatalogQuery] = useState('');

  const authHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  }), [token]);

  const fetchCollections = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_URL}/admin`, { headers: authHeaders() });
      const result = await response.json();
      if (result.success) setCollections(result.data.collections || []);
      else setError(result.message || 'Failed to load collections');
    } catch (err) {
      console.error('Error fetching collections:', err);
      setError('Failed to load collections. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  const fetchMovies = useCallback(async () => {
    try {
      const response = await fetch('/api/movies?limit=20000', { headers: authHeaders() });
      const result = await response.json();
      if (result.success) setMovies(result.data.movies || []);
    } catch (err) {
      console.error('Error fetching movies for collections:', err);
    }
  }, [authHeaders]);

  useEffect(() => {
    fetchCollections();
    fetchMovies();
  }, [fetchCollections, fetchMovies]);

  const resetForm = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setOrder(collections.length);
    setStatus('active');
    setSelectedIds([]);
    setCatalogQuery('');
  };

  const handleEdit = (collection) => {
    setEditing(collection);
    setName(collection.name || '');
    setDescription(collection.description || '');
    setOrder(collection.order ?? 0);
    setStatus(collection.status || 'active');
    setSelectedIds((collection.movies || []).map((m) => m._id || m));
    setCatalogQuery('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filteredMovies = useMemo(() => {
    const q = catalogQuery.trim().toLowerCase();
    const list = [...movies].sort((a, b) => (a.year || 0) - (b.year || 0) || a.title.localeCompare(b.title));
    if (!q) return list;
    return list.filter((m) => {
      const hay = `${m.title || ''} ${m.year || ''} ${m.genre || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [movies, catalogQuery]);

  const toggleMovie = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectedMoviesOrdered = useMemo(() => {
    const map = new Map(movies.map((m) => [m._id, m]));
    return selectedIds.map((id) => map.get(id)).filter(Boolean);
  }, [selectedIds, movies]);

  const moveSelected = (id, dir) => {
    setSelectedIds((prev) => {
      const idx = prev.indexOf(id);
      if (idx < 0) return prev;
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showNotification('Collection name is required', 'error');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: name.trim(),
        description: description.trim(),
        order: Number(order) || 0,
        status,
        movieIds: selectedIds
      };

      const url = editing ? `${API_URL}/${editing._id}` : API_URL;
      const method = editing ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });
      const result = await response.json();

      if (!result.success) {
        showNotification(result.message || 'Save failed', 'error');
        return;
      }

      showNotification(editing ? 'Collection updated' : 'Collection created', 'success');
      resetForm();
      fetchCollections();
    } catch (err) {
      console.error('Save collection error:', err);
      showNotification('Failed to save collection', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (collection) => {
    if (!window.confirm(`Delete collection "${collection.name}"?`)) return;
    try {
      const response = await fetch(`${API_URL}/${collection._id}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      const result = await response.json();
      if (!result.success) {
        showNotification(result.message || 'Delete failed', 'error');
        return;
      }
      showNotification('Collection deleted', 'success');
      if (editing?._id === collection._id) resetForm();
      fetchCollections();
    } catch (err) {
      console.error('Delete collection error:', err);
      showNotification('Failed to delete collection', 'error');
    }
  };

  if (loading) {
    return (
      <div className="cm-root">
        <div className="loading-state">
          <div className="loading-spinner" />
          <p>Loading collections...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cm-root">
      <header className="cm-hero">
        <div>
          <p className="cm-hero-kicker">Franchise shelves</p>
          <h2 className="cm-hero-title">{editing ? 'Edit Collection' : 'Add Collection'}</h2>
          <p className="cm-hero-copy">
            Group titles like Marvel Universe, DC Universe, Harry Potter, or Lord of the Rings.
            Public page shows names only — click opens the movie.
          </p>
        </div>
        {editing && (
          <button type="button" className="cm-ghost-btn" onClick={resetForm}>
            New collection
          </button>
        )}
      </header>

      {error && <div className="cm-alert">{error}</div>}

      <div className="cm-layout">
        <form onSubmit={handleSubmit} className="cm-panel cm-form">
          <div className="cm-panel-head">
            <h3>{editing ? 'Update details' : 'Collection details'}</h3>
          </div>

          <div className="form-group">
            <label htmlFor="collection-name">Name *</label>
            <input
              id="collection-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Marvel Universe"
              required
              maxLength={100}
            />
          </div>

          <div className="form-group">
            <label htmlFor="collection-desc">Description</label>
            <textarea
              id="collection-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Optional short note"
            />
          </div>

          <div className="cm-form-row">
            <div className="form-group">
              <label htmlFor="collection-order">Order</label>
              <input
                id="collection-order"
                type="number"
                min={0}
                value={order}
                onChange={(e) => setOrder(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="collection-status">Status</label>
              <select
                id="collection-status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="form-group cm-movies-block">
            <div className="cm-movies-label-row">
              <label>Movies in this collection</label>
              <span className="cm-count-pill">{selectedIds.length} selected</span>
            </div>

            {selectedMoviesOrdered.length > 0 && (
              <ul className="cm-selected-list">
                {selectedMoviesOrdered.map((m, idx) => (
                  <li key={m._id}>
                    <span className="cm-selected-title">
                      {m.title}{m.year ? ` (${m.year})` : ''}
                    </span>
                    <span className="cm-selected-actions">
                      <button type="button" aria-label="Move up" onClick={() => moveSelected(m._id, -1)} disabled={idx === 0}>↑</button>
                      <button type="button" aria-label="Move down" onClick={() => moveSelected(m._id, 1)} disabled={idx === selectedMoviesOrdered.length - 1}>↓</button>
                      <button type="button" className="cm-remove" onClick={() => toggleMovie(m._id)}>Remove</button>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="cm-search-wrap">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="m20 20-3.5-3.5" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
              <input
                type="search"
                value={catalogQuery}
                onChange={(e) => setCatalogQuery(e.target.value)}
                placeholder="Search movies to add…"
              />
            </div>

            <div className="cm-movie-picker">
              {filteredMovies.map((m) => {
                const checked = selectedIds.includes(m._id);
                return (
                  <label key={m._id} className={`cm-movie-option${checked ? ' is-on' : ''}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMovie(m._id)}
                    />
                    <span className="cm-movie-check" aria-hidden="true" />
                    <span className="cm-movie-text">
                      <strong>{m.title}</strong>
                      {m.year ? <em>({m.year})</em> : null}
                    </span>
                  </label>
                );
              })}
              {filteredMovies.length === 0 && (
                <p className="cm-picker-empty">No movies match this search.</p>
              )}
            </div>
          </div>

          <div className="cm-form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Update Collection' : 'Create Collection'}
            </button>
            {editing && (
              <button type="button" className="btn btn-secondary" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>
        </form>

        <section className="cm-panel cm-existing">
          <div className="cm-panel-head">
            <h3>Existing Collections</h3>
            <span className="cm-count-pill">{collections.length}</span>
          </div>

          {collections.length === 0 ? (
            <div className="cm-empty">
              <p>No collections yet.</p>
              <p>Start with Marvel Universe, DC Universe, Harry Potter…</p>
            </div>
          ) : (
            <div className="cm-cards">
              {collections.map((c) => {
                const movieNames = (c.movies || []).slice(0, 4);
                const extra = Math.max(0, (c.movies || []).length - movieNames.length);
                return (
                  <article key={c._id} className={`cm-card${editing?._id === c._id ? ' is-editing' : ''}`}>
                    <div className="cm-card-top">
                      <span className="cm-card-order">#{c.order}</span>
                      <span className={`cm-status cm-status-${c.status}`}>{c.status}</span>
                    </div>
                    <h4 className="cm-card-name">{c.name}</h4>
                    <p className="cm-card-meta">{(c.movies || []).length} movies</p>
                    {movieNames.length > 0 && (
                      <ul className="cm-card-preview">
                        {movieNames.map((m) => (
                          <li key={m._id || m}>
                            {m.title}{m.year ? ` (${m.year})` : ''}
                          </li>
                        ))}
                        {extra > 0 && <li className="cm-card-more">+{extra} more</li>}
                      </ul>
                    )}
                    <div className="cm-card-actions">
                      <button type="button" className="btn btn-sm btn-secondary" onClick={() => handleEdit(c)}>
                        Edit
                      </button>
                      <button type="button" className="btn btn-sm btn-danger" onClick={() => handleDelete(c)}>
                        Delete
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default CollectionManagement;
