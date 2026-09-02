import React, { useState, useEffect, useCallback } from 'react';
import { getMoviePlaceholder, handleImageError } from '../utils/placeholderImage';
import './PendingTitlesManagement.css';

const API_URL = '/api/sync';

const detectTypeFromQuery = (query = '') => {
  if (/\btv\s*(series|show)\b/i.test(query)) return 'tvshow';
  if (/\bmovie\b/i.test(query)) return 'movie';
  return '';
};

const buildApprovalForm = (item) => ({
  title: item.title || '',
  year: item.year || new Date().getFullYear(),
  description: item.description || '',
  genre: item.genre || '',
  imdbRating: Number(item.imdbRating || 0),
  posterUrl: item.posterUrl || '',
  backdropUrl: item.backdropUrl || '',
  trailerUrl: item.trailerUrl || '',
  tagline: item.tagline || '',
  director: item.director || '',
  language: item.language || '',
  releaseDate: item.releaseDate || '',
  runtime: item.runtime ?? '',
  releaseStatus: item.releaseStatus || '',
  catalogStatus: item.catalogStatus === 'coming_soon' ? 'coming_soon' : 'active',
  movieUrl:
    item.type === 'movie'
      ? `https://www.2embed.cc/embed/${item.tmdbId}`
      : '',
  tmdbId: item.tmdbId || ''
});

const PendingTitlesManagement = ({ token, showNotification }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [exactMatch, setExactMatch] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0
  });
  const [actionId, setActionId] = useState(null);
  const [approvingId, setApprovingId] = useState(null);
  const [approvalForm, setApprovalForm] = useState(null);
  const [episodePreview, setEpisodePreview] = useState(null);
  const [episodePreviewLoading, setEpisodePreviewLoading] = useState(false);
  const [episodePreviewError, setEpisodePreviewError] = useState('');

  const authHeaders = useCallback(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }),
    [token]
  );

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/status`, { headers: authHeaders() });
      const result = await response.json();
      if (result.success) setSyncStatus(result.data);
    } catch (err) {
      console.error('Sync status error:', err);
    }
  }, [authHeaders]);

  const fetchPending = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: '30' });
      if (typeFilter !== 'all') params.set('type', typeFilter);
      if (activeSearch) {
        params.set('q', activeSearch);
        if (exactMatch) params.set('exact', '1');
      }
      const response = await fetch(`${API_URL}/pending?${params}`, { headers: authHeaders() });
      const result = await response.json();
      if (result.success) {
        setItems(result.data.items || []);
        setPagination(result.data.pagination || { currentPage: 1, totalPages: 1, totalItems: 0 });
      } else {
        showNotification?.(result.message || 'Failed to load new titles', 'error');
      }
    } catch (err) {
      console.error('Fetch pending error:', err);
      showNotification?.('Failed to load new titles', 'error');
    } finally {
      setLoading(false);
    }
  }, [authHeaders, page, typeFilter, activeSearch, exactMatch, showNotification]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  useEffect(() => {
    if (!syncStatus?.running && syncStatus?.lastSyncedTitle) {
      setActiveSearch(syncStatus.lastSyncedTitle);
      setExactMatch(true);
      setPage(1);
    }
  }, [syncStatus?.running, syncStatus?.lastSyncedTitle]);

  useEffect(() => {
    if (!syncStatus?.running) return undefined;
    const interval = setInterval(() => {
      fetchStatus();
      fetchPending();
    }, 8000);
    return () => clearInterval(interval);
  }, [syncStatus?.running, fetchStatus, fetchPending]);

  const runSync = async () => {
    const query = searchTerm.trim();
    const detectedType = detectTypeFromQuery(query);
    const type =
      typeFilter === 'tvshow'
        ? 'tvshow'
        : typeFilter === 'movie'
          ? 'movie'
          : detectedType;

    try {
      const response = await fetch(`${API_URL}/run`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ q: query, type })
      });
      const result = await response.json();
      if (result.success) {
        if (query) {
          setExactMatch(true);
          setPage(1);
          if (detectedType === 'tvshow' && typeFilter === 'all') {
            setTypeFilter('tvshow');
          }
          showNotification?.(
            type === 'tvshow' || typeFilter === 'tvshow'
              ? `Searching TV series "${query}" on 2embed…`
              : `Syncing "${query}" from 2embed…`,
            'success'
          );
        } else {
          setActiveSearch('');
          setExactMatch(false);
          showNotification?.('Fetching all trending titles from 2embed…', 'success');
        }
        setSyncStatus(result.data);
      } else {
        showNotification?.(result.message || 'Sync failed to start', 'error');
      }
    } catch (err) {
      showNotification?.('Sync failed to start', 'error');
    }
  };

  const clearSearch = () => {
    setSearchTerm('');
    setActiveSearch('');
    setExactMatch(false);
    setPage(1);
  };

  const fetchEpisodePreview = useCallback(async (pendingId) => {
    setEpisodePreviewLoading(true);
    setEpisodePreviewError('');
    try {
      const response = await fetch(`${API_URL}/pending/${pendingId}/episodes-preview`, {
        headers: authHeaders()
      });
      const result = await response.json();
      if (result.success) {
        setEpisodePreview(result.data);
      } else {
        setEpisodePreview(null);
        setEpisodePreviewError(result.message || 'Failed to sync episodes from 2embed');
      }
    } catch (err) {
      console.error('Episode preview error:', err);
      setEpisodePreview(null);
      setEpisodePreviewError('Failed to sync episodes from 2embed');
    } finally {
      setEpisodePreviewLoading(false);
    }
  }, [authHeaders]);

  const openApproval = (item) => {
    setApprovingId(item._id);
    setApprovalForm(buildApprovalForm(item));
    setEpisodePreview(null);
    setEpisodePreviewError('');
    if (item.type === 'tvshow') {
      fetchEpisodePreview(item._id);
    }
  };

  const closeApproval = () => {
    setApprovingId(null);
    setApprovalForm(null);
    setEpisodePreview(null);
    setEpisodePreviewError('');
    setEpisodePreviewLoading(false);
  };

  const handleApprovalChange = (field, value) => {
    setApprovalForm((prev) => ({ ...prev, [field]: value }));
  };

  const submitApproval = async (id) => {
    if (!approvalForm) return;
    setActionId(id);
    try {
      const response = await fetch(`${API_URL}/pending/${id}/approve`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          ...approvalForm,
          year: parseInt(approvalForm.year, 10),
          imdbRating: parseFloat(approvalForm.imdbRating) || 0,
          runtime: approvalForm.runtime === '' ? null : parseInt(approvalForm.runtime, 10)
        })
      });
      const result = await response.json();
      if (result.success) {
        showNotification?.(result.message, 'success');
        closeApproval();
        fetchPending();
      } else {
        showNotification?.(result.message || 'Failed to approve title', 'error');
      }
    } catch (err) {
      showNotification?.('Failed to approve title', 'error');
    } finally {
      setActionId(null);
    }
  };

  const dismissItem = async (id) => {
    setActionId(id);
    try {
      const response = await fetch(`${API_URL}/pending/${id}/dismiss`, {
        method: 'POST',
        headers: authHeaders()
      });
      const result = await response.json();
      if (result.success) {
        showNotification?.('Title dismissed', 'success');
        fetchPending();
      } else {
        showNotification?.(result.message || 'Failed to dismiss', 'error');
      }
    } catch (err) {
      showNotification?.('Failed to dismiss', 'error');
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="pending-titles card">
      <div className="pending-titles-header">
        <div>
          <h2>New from 2embed</h2>
          <p className="pending-titles-sub">
            Type a TV series name, click the <strong>TV Series</strong> filter, then Sync Now. Seasons and episodes load automatically.
          </p>
        </div>
        <div className="pending-titles-actions">
          <input
            type="text"
            className="pending-search-inline"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') runSync();
            }}
            placeholder="e.g. Breaking Bad or W (TV Series 2016)"
            aria-label="Title to sync"
          />
          <button type="button" className="btn btn-primary" onClick={runSync} disabled={syncStatus?.running}>
            {syncStatus?.running ? 'Syncing…' : 'Sync Now'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={fetchPending}>
            Refresh
          </button>
          {(searchTerm || activeSearch) && (
            <button type="button" className="btn btn-secondary" onClick={clearSearch}>
              Clear
            </button>
          )}
        </div>
      </div>

      {syncStatus?.running && (
        <div className="pending-sync-status">
          {syncStatus.lastQuery
            ? `Syncing "${syncStatus.lastQuery}"…`
            : 'Syncing all trending titles…'}{' '}
          {syncStatus.processed}/{syncStatus.total}
          {syncStatus.currentTitle ? ` — ${syncStatus.currentTitle}` : ''}
        </div>
      )}

      {!syncStatus?.running && syncStatus?.finishedAt && (
        <div
          className={`pending-sync-status ${
            syncStatus.added > 0
              ? 'pending-sync-status--done'
              : syncStatus.lastSkipReason === 'already_in_catalog'
                ? 'pending-sync-status--info'
                : syncStatus.lastSkipReason === 'dismissed'
                  ? 'pending-sync-status--info'
                  : syncStatus.lastSkipReason === 'not_found'
                    ? 'pending-sync-status--warn'
                    : 'pending-sync-status--done'
          }`}
        >
          {syncStatus.lastSkipMessage ? (
            <>{syncStatus.lastSkipMessage}</>
          ) : (
            <>
              Last sync
              {syncStatus.lastQuery ? ` for "${syncStatus.lastQuery}"` : ''}: {syncStatus.added} new ·{' '}
              {syncStatus.skipped} skipped · {syncStatus.failed} failed
            </>
          )}
        </div>
      )}

      <div className="pending-filters">
        <button
          type="button"
          className={`pending-filter-chip ${typeFilter === 'all' ? 'active' : ''}`}
          onClick={() => { setTypeFilter('all'); setPage(1); }}
        >
          All
        </button>
        <button
          type="button"
          className={`pending-filter-chip ${typeFilter === 'movie' ? 'active' : ''}`}
          onClick={() => { setTypeFilter('movie'); setPage(1); }}
        >
          Movies
        </button>
        <button
          type="button"
          className={`pending-filter-chip ${typeFilter === 'tvshow' ? 'active' : ''}`}
          onClick={() => { setTypeFilter('tvshow'); setPage(1); }}
        >
          TV Series
        </button>
        {typeFilter === 'tvshow' && (
          <span className="admin-page-meta">TV series search only</span>
        )}
        <span className="admin-page-meta">
          {pagination.totalItems} pending
          {activeSearch ? ` · showing "${activeSearch}"` : ''}
        </span>
      </div>

      {loading ? (
        <div className="loading-state">
          <h3>Loading new titles…</h3>
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <h3>No new titles right now</h3>
          <p>
            {activeSearch
              ? `No result for "${activeSearch}". Check the name and try Sync Now again.`
              : 'Click Sync Now to fetch all trending titles, or type one name first.'}
          </p>
        </div>
      ) : (
        <div className="pending-grid">
          {items.map((item) => (
            <article
              key={item._id}
              className={`pending-card ${approvingId === item._id ? 'pending-card--review' : ''}`}
            >
              <div className="pending-card-poster">
                <img
                  src={item.posterUrl || getMoviePlaceholder(item.title, 200, 300)}
                  alt={item.title}
                  onError={handleImageError}
                />
                <span className={`pending-type-badge pending-type-badge--${item.type}`}>
                  {item.type === 'tvshow' ? 'TV' : 'Movie'}
                </span>
                {item.catalogStatus === 'coming_soon' && (
                  <span className="pending-coming-soon-badge">Coming Soon</span>
                )}
              </div>
              <div className="pending-card-body">
                <h3>{item.title}</h3>
                <p className="pending-card-meta">
                  {item.year} · {item.genre} · ★ {Number(item.imdbRating || 0).toFixed(1)}
                  {item.type === 'tvshow' && item.episodeCount > 0 && (
                    <>
                      {' '}
                      · {item.numberOfSeasons || 1} season
                      {(item.numberOfSeasons || 1) !== 1 ? 's' : ''} · {item.episodeCount} ep
                      {item.episodeCount !== 1 ? 's' : ''}
                    </>
                  )}
                </p>
                <p className="pending-card-desc">{item.description}</p>
                {approvingId !== item._id && (
                  <div className="pending-card-buttons">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={actionId === item._id}
                      onClick={() => openApproval(item)}
                    >
                      Add to Site
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={actionId === item._id}
                      onClick={() => dismissItem(item._id)}
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>

              {approvingId === item._id && approvalForm && (
                <div className="pending-approval-panel">
                  <h4>Review &amp; approve — edit if needed, then add to site</h4>
                  {item.type === 'tvshow' && (
                    <div className="pending-episodes-preview pending-approval-full">
                      <div className="pending-episodes-preview-header">
                        <div>
                          <h5>Episodes from 2embed</h5>
                          <p className="pending-episodes-preview-hint">
                            All seasons and episodes sync here before you add to site.
                          </p>
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={episodePreviewLoading}
                          onClick={() => fetchEpisodePreview(item._id)}
                        >
                          {episodePreviewLoading ? 'Syncing…' : 'Sync Episodes'}
                        </button>
                      </div>

                      {episodePreviewLoading && (
                        <p className="pending-episodes-status">Fetching seasons &amp; episodes from 2embed…</p>
                      )}

                      {episodePreviewError && !episodePreviewLoading && (
                        <p className="pending-episodes-error">{episodePreviewError}</p>
                      )}

                      {episodePreview && !episodePreviewLoading && (
                        <>
                          <p className="pending-episodes-summary">
                            <strong>{episodePreview.numberOfSeasons}</strong> season
                            {episodePreview.numberOfSeasons !== 1 ? 's' : ''} ·{' '}
                            <strong>{episodePreview.episodeCount}</strong> episode
                            {episodePreview.episodeCount !== 1 ? 's' : ''}
                          </p>
                          <ul className="pending-episodes-seasons">
                            {(episodePreview.seasons || []).map((season) => (
                              <li key={season.seasonNumber}>
                                <span>Season {season.seasonNumber}</span>
                                <span>{season.episodeCount} ep{season.episodeCount !== 1 ? 's' : ''}</span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                  )}
                  <div className="pending-approval-grid">
                    <label>
                      Title
                      <input
                        type="text"
                        value={approvalForm.title}
                        onChange={(e) => handleApprovalChange('title', e.target.value)}
                      />
                    </label>
                    <label>
                      Year
                      <input
                        type="number"
                        value={approvalForm.year}
                        onChange={(e) => handleApprovalChange('year', e.target.value)}
                      />
                    </label>
                    <label>
                      Genre
                      <input
                        type="text"
                        value={approvalForm.genre}
                        onChange={(e) => handleApprovalChange('genre', e.target.value)}
                      />
                    </label>
                    <label>
                      IMDB Rating
                      <input
                        type="number"
                        min="0"
                        max="10"
                        step="0.1"
                        value={approvalForm.imdbRating}
                        onChange={(e) => handleApprovalChange('imdbRating', e.target.value)}
                      />
                    </label>
                    <label>
                      Site status
                      <select
                        value={approvalForm.catalogStatus}
                        onChange={(e) => handleApprovalChange('catalogStatus', e.target.value)}
                      >
                        <option value="active">Active (live now)</option>
                        <option value="coming_soon">Coming Soon</option>
                      </select>
                    </label>
                    <label>
                      Release date
                      <input
                        type="text"
                        value={approvalForm.releaseDate}
                        onChange={(e) => handleApprovalChange('releaseDate', e.target.value)}
                        placeholder="YYYY-MM-DD"
                      />
                    </label>
                    <label>
                      Language
                      <input
                        type="text"
                        value={approvalForm.language}
                        onChange={(e) => handleApprovalChange('language', e.target.value)}
                      />
                    </label>
                    <label>
                      Director
                      <input
                        type="text"
                        value={approvalForm.director}
                        onChange={(e) => handleApprovalChange('director', e.target.value)}
                      />
                    </label>
                    {item.type === 'movie' && (
                      <label className="pending-approval-span2">
                        Movie URL (2embed)
                        <input
                          type="url"
                          value={approvalForm.movieUrl}
                          onChange={(e) => handleApprovalChange('movieUrl', e.target.value)}
                        />
                      </label>
                    )}
                    {item.type === 'tvshow' && (
                      <label>
                        TMDB ID
                        <input
                          type="text"
                          value={approvalForm.tmdbId}
                          onChange={(e) => handleApprovalChange('tmdbId', e.target.value)}
                        />
                      </label>
                    )}
                    <label className="pending-approval-span2">
                      Poster URL
                      <input
                        type="url"
                        value={approvalForm.posterUrl}
                        onChange={(e) => handleApprovalChange('posterUrl', e.target.value)}
                      />
                    </label>
                    <label className="pending-approval-span2">
                      Backdrop URL
                      <input
                        type="url"
                        value={approvalForm.backdropUrl}
                        onChange={(e) => handleApprovalChange('backdropUrl', e.target.value)}
                      />
                    </label>
                    <label className="pending-approval-span2">
                      Trailer URL
                      <input
                        type="url"
                        value={approvalForm.trailerUrl}
                        onChange={(e) => handleApprovalChange('trailerUrl', e.target.value)}
                      />
                    </label>
                    <label className="pending-approval-full">
                      Description
                      <textarea
                        rows={4}
                        value={approvalForm.description}
                        onChange={(e) => handleApprovalChange('description', e.target.value)}
                      />
                    </label>
                  </div>
                  <div className="pending-approval-actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={
                        actionId === item._id ||
                        (item.type === 'tvshow' && (episodePreviewLoading || !episodePreview))
                      }
                      onClick={() => submitApproval(item._id)}
                    >
                      {actionId === item._id
                        ? 'Approving…'
                        : item.type === 'tvshow' && episodePreview
                          ? `Approve — ${episodePreview.numberOfSeasons} seasons, ${episodePreview.episodeCount} eps`
                          : 'Approve & Add to Site'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={actionId === item._id}
                      onClick={closeApproval}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="pending-pagination">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span>
            Page {pagination.currentPage} of {pagination.totalPages}
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default PendingTitlesManagement;
