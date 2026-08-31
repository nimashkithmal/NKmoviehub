import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ImageCropper from './ImageCropper';

const API_URL = '/api/banners';
const BANNER_WIDTH = 1920;
const BANNER_HEIGHT = 800;

/**
 * Admin: link a home banner to a movie or TV show.
 * Selecting a title auto-fills the wide banner (bannerUrl) from that title.
 */
const BannerManagement = ({ token, showNotification }) => {
  const [banners, setBanners] = useState([]);
  const [movies, setMovies] = useState([]);
  const [tvShows, setTVShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [editingBanner, setEditingBanner] = useState(null);
  const [linkType, setLinkType] = useState('movie'); // 'movie' | 'tvshow'
  const [linkedId, setLinkedId] = useState('');
  const [catalogQuery, setCatalogQuery] = useState('');
  const [imageFile, setImageFile] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [cropSource, setCropSource] = useState(null);
  const [cropLoading, setCropLoading] = useState(false);

  const authHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  }), [token]);

  const fetchBanners = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_URL}/admin`, { headers: authHeaders() });
      const result = await response.json();
      if (result.success) setBanners(result.data.banners);
      else setError(result.message || 'Failed to load banners');
    } catch (err) {
      console.error('Error fetching banners:', err);
      setError('Failed to load banners. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  const fetchCatalog = useCallback(async () => {
    const fetchAllPaginated = async (baseUrl, dataKey, pageLimit) => {
      const all = [];
      let page = 1;
      let totalPages = 1;

      while (page <= totalPages) {
        const response = await fetch(
          `${baseUrl}?page=${page}&limit=${pageLimit}`,
          { headers: authHeaders() }
        );
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message || `Failed to load ${dataKey}`);
        }
        all.push(...(result.data[dataKey] || []));
        totalPages = result.data.pagination?.totalPages || 1;
        page += 1;
      }

      return all;
    };

    const toPickerItem = (item) => ({
      _id: item._id,
      title: item.title,
      year: item.year,
      genre: item.genre,
      bannerUrl: item.bannerUrl,
      status: item.status,
      imdbRating: item.imdbRating
    });

    try {
      setCatalogLoading(true);
      const pickerResponse = await fetch(`${API_URL}/picker/catalog`, {
        headers: authHeaders()
      });

      if (pickerResponse.ok) {
        const pickerResult = await pickerResponse.json();
        if (pickerResult.success) {
          setMovies(pickerResult.data.movies || []);
          setTVShows(pickerResult.data.tvShows || []);
          return;
        }
      }

      const [allMovies, allTVShows] = await Promise.all([
        fetchAllPaginated('/api/movies/admin', 'movies', 100),
        fetchAllPaginated('/api/tvshows/admin', 'tvShows', 500)
      ]);

      setMovies(allMovies.map(toPickerItem));
      setTVShows(allTVShows.map(toPickerItem));
    } catch (err) {
      console.error('Error fetching catalog for banners:', err);
      setMovies([]);
      setTVShows([]);
      showNotification('Could not load movies/TV shows for the banner picker', 'error');
    } finally {
      setCatalogLoading(false);
    }
  }, [authHeaders, showNotification]);

  useEffect(() => {
    fetchBanners();
    fetchCatalog();
  }, [fetchBanners, fetchCatalog]);

  const resetForm = () => {
    setEditingBanner(null);
    setLinkType('movie');
    setLinkedId('');
    setCatalogQuery('');
    setImageFile('');
    setImagePreview('');
    setCropSource(null);
  };

  const selectedItem = useMemo(() => {
    if (!linkedId) return null;
    if (linkType === 'tvshow') return tvShows.find((t) => t._id === linkedId) || null;
    return movies.find((m) => m._id === linkedId) || null;
  }, [linkedId, linkType, movies, tvShows]);

  const filterByQuery = (items) => {
    const q = catalogQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const hay = `${item.title || ''} ${item.year || ''} ${item.genre || ''}`.toLowerCase();
      return hay.includes(q);
    });
  };

  const filteredMovies = useMemo(() => filterByQuery(movies), [movies, catalogQuery]);
  const filteredTVShows = useMemo(() => filterByQuery(tvShows), [tvShows, catalogQuery]);

  const getItemBannerUrl = (item) => {
    const url = String(item?.bannerUrl || '').trim();
    return url.startsWith('http') ? url : '';
  };

  const applyLinkedBanner = (item) => {
    const bannerUrl = getItemBannerUrl(item);
    if (bannerUrl) {
      setImageFile(bannerUrl);
      setImagePreview(bannerUrl);
      setCropSource(null);
      showNotification(`Wide banner loaded from ${item.title}`, 'success');
      return true;
    }
    setImageFile('');
    setImagePreview('');
    setCropSource(null);
    showNotification(
      `${item.title} has no wide banner yet. Upload one below or add it on the title first.`,
      'error'
    );
    return false;
  };

  const selectLink = (type, id) => {
    setLinkType(type);
    setLinkedId(id);
    const list = type === 'tvshow' ? tvShows : movies;
    const item = list.find((entry) => entry._id === id);
    if (item) applyLinkedBanner(item);
  };

  const handleEdit = (banner) => {
    setEditingBanner(banner);
    if (banner.tvShow?._id) {
      setLinkType('tvshow');
      setLinkedId(banner.tvShow._id);
    } else {
      setLinkType('movie');
      setLinkedId(banner.movie?._id || '');
    }
    setCatalogQuery('');
    setImageFile('');
    setImagePreview(banner.imageUrl || '');
    setCropSource(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showNotification('Please choose an image file', 'error');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showNotification('Image must be smaller than 10MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImageFile(reader.result);
      setImagePreview(reader.result);
      setCropSource(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropDone = (croppedDataUri) => {
    setImageFile(croppedDataUri);
    setImagePreview(croppedDataUri);
    setCropSource(null);
    showNotification(
      editingBanner
        ? 'New banner image ready. Save to update.'
        : 'Banner image ready. Pick a title and save.',
      'success'
    );
  };

  const openCropper = async () => {
    if (!imagePreview || cropLoading) return;

    if (imagePreview.startsWith('data:image/')) {
      setCropSource(imagePreview);
      return;
    }

    if (!imagePreview.startsWith('http')) {
      setCropSource(imagePreview);
      return;
    }

    try {
      setCropLoading(true);
      const response = await fetch(
        `${API_URL}/picker/image?url=${encodeURIComponent(imagePreview)}`,
        { headers: authHeaders() }
      );
      if (!response.ok) {
        throw new Error('Could not load image');
      }
      const blob = await response.blob();
      const dataUri = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      setCropSource(dataUri);
    } catch (err) {
      console.error('Error loading image for crop:', err);
      showNotification(
        'Could not load this image for cropping. Upload the banner file instead.',
        'error'
      );
    } finally {
      setCropLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const isEditing = Boolean(editingBanner);

    const bannerSource = imageFile || getItemBannerUrl(selectedItem);

    if (!isEditing && !bannerSource) {
      showNotification(
        'Select a title with a wide banner, or upload a banner image',
        'error'
      );
      return;
    }
    if (!linkedId) {
      showNotification('Please select a movie or TV show', 'error');
      return;
    }

    try {
      setSaving(true);

      const payload = {
        title: selectedItem?.title || ''
      };
      if (linkType === 'tvshow') {
        payload.tvShowId = linkedId;
      } else {
        payload.movieId = linkedId;
      }
      if (imageFile) payload.image = imageFile;
      else if (bannerSource) payload.image = bannerSource;

      const response = await fetch(
        isEditing ? `${API_URL}/${editingBanner._id}` : API_URL,
        {
          method: isEditing ? 'PUT' : 'POST',
          headers: authHeaders(),
          body: JSON.stringify(payload)
        }
      );
      const result = await response.json();

      if (result.success) {
        showNotification(result.message, 'success');
        resetForm();
        fetchBanners();
      } else {
        showNotification(result.message || 'Could not save the banner', 'error');
      }
    } catch (err) {
      console.error('Error saving banner:', err);
      showNotification('Failed to save the banner. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (banner) => {
    try {
      const response = await fetch(`${API_URL}/${banner._id}/status`, {
        method: 'PATCH',
        headers: authHeaders()
      });
      const result = await response.json();
      if (result.success) {
        showNotification(result.message, 'success');
        fetchBanners();
      } else {
        showNotification(result.message || 'Could not update the banner', 'error');
      }
    } catch (err) {
      console.error('Error toggling banner status:', err);
      showNotification('Failed to update the banner. Please try again.', 'error');
    }
  };

  const handleDelete = async (banner) => {
    if (!window.confirm('Delete this banner? The uploaded image is removed from Cloudinary too.')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/${banner._id}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      const result = await response.json();
      if (result.success) {
        showNotification(result.message, 'success');
        if (editingBanner && editingBanner._id === banner._id) resetForm();
        fetchBanners();
      } else {
        showNotification(result.message || 'Could not delete the banner', 'error');
      }
    } catch (err) {
      console.error('Error deleting banner:', err);
      showNotification('Failed to delete the banner. Please try again.', 'error');
    }
  };

  const handleMove = async (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= banners.length) return;

    const reordered = [...banners];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setBanners(reordered);

    try {
      const response = await fetch(`${API_URL}/reorder/all`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ order: reordered.map((b) => b._id) })
      });
      const result = await response.json();
      if (!result.success) {
        showNotification(result.message || 'Could not save the new order', 'error');
        fetchBanners();
      }
    } catch (err) {
      console.error('Error reordering banners:', err);
      showNotification('Failed to save the new order. Please try again.', 'error');
      fetchBanners();
    }
  };

  const linkedLabel = (banner) => {
    if (banner.movie?.title) {
      return `Movie · ${banner.movie.title}${banner.movie.year ? ` (${banner.movie.year})` : ''}`;
    }
    if (banner.tvShow?.title) {
      return `TV · ${banner.tvShow.title}${banner.tvShow.year ? ` (${banner.tvShow.year})` : ''}`;
    }
    return null;
  };

  const renderPickerList = (items, type) => (
    <div className="banner-picker-list">
      {catalogLoading ? (
        <div className="banner-picker-empty">Loading titles…</div>
      ) : items.length === 0 ? (
        <div className="banner-picker-empty">No matches</div>
      ) : (
        items.map((item) => {
          const active = linkType === type && linkedId === item._id;
          return (
            <button
              key={item._id}
              type="button"
              className={`banner-picker-item${active ? ' is-active' : ''}`}
              onClick={() => selectLink(type, item._id)}
            >
              <span className="banner-picker-item-title">{item.title}</span>
              <span className="banner-picker-item-meta">
                {[item.year, item.genre].filter(Boolean).join(' · ')}
              </span>
            </button>
          );
        })
      )}
    </div>
  );

  return (
    <div className="card">
      {cropSource && (
        <ImageCropper
          src={cropSource}
          outputWidth={BANNER_WIDTH}
          outputHeight={BANNER_HEIGHT}
          title="Crop the banner image"
          onDone={handleCropDone}
          onCancel={() => setCropSource(null)}
        />
      )}

      <div className="dashboard-header">
        <h2>Home Banner</h2>
        <p>
          Pick a movie or TV show — its wide banner is selected automatically.
          You can still upload or crop a custom image if you prefer.
        </p>
      </div>

      <h3 style={{ marginTop: '10px' }}>
        {editingBanner ? 'Edit Banner' : 'Add Banner'}
      </h3>

      {editingBanner && !editingBanner.movie && !editingBanner.tvShow && (
        <p style={{ color: '#fbbf24', marginBottom: '12px' }}>
          This banner has no linked title. Select a movie or TV show below and save.
        </p>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="banner-file">
            Banner Image {editingBanner ? '(optional)' : '(optional if title has a banner)'}
          </label>
          <input
            type="file"
            id="banner-file"
            accept="image/*"
            onChange={handleFileChange}
          />
          <small>
            {editingBanner
              ? 'Leave empty to keep the current banner, or pick a title to use its wide banner.'
              : `Select a title first to auto-fill, or upload wide artwork (${BANNER_WIDTH}×${BANNER_HEIGHT}).`}
          </small>
        </div>

        <div className="form-group">
          <label htmlFor="banner-catalog-search">Related title *</label>
          <input
            type="search"
            id="banner-catalog-search"
            value={catalogQuery}
            onChange={(e) => setCatalogQuery(e.target.value)}
            placeholder="Type to search movies or TV shows…"
          />
          <small>Search both lists, then click one item — its wide banner loads automatically.</small>
        </div>

        <div className="banner-picker-windows">
          <div className="banner-picker-window">
            <div className="banner-picker-window-head">
              Movies ({filteredMovies.length})
            </div>
            {renderPickerList(filteredMovies, 'movie')}
          </div>
          <div className="banner-picker-window">
            <div className="banner-picker-window-head">
              TV Shows ({filteredTVShows.length})
            </div>
            {renderPickerList(filteredTVShows, 'tvshow')}
          </div>
        </div>

        {selectedItem && (
          <div
            className="form-group"
            style={{
              marginTop: '14px',
              padding: '12px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.04)'
            }}
          >
            <strong style={{ display: 'block', marginBottom: '6px' }}>
              Hero will show ({linkType === 'tvshow' ? 'TV Show' : 'Movie'})
            </strong>
            <div>{selectedItem.title}</div>
            <div style={{ opacity: 0.75, fontSize: '0.9rem', marginTop: '4px' }}>
              {[selectedItem.year, selectedItem.genre, selectedItem.imdbRating != null ? `IMDb ${selectedItem.imdbRating}` : null]
                .filter(Boolean)
                .join(' · ')}
            </div>
            {selectedItem.description && (
              <p style={{ margin: '8px 0 0', opacity: 0.8, fontSize: '0.9rem' }}>
                {selectedItem.description.length > 160
                  ? `${selectedItem.description.slice(0, 160)}…`
                  : selectedItem.description}
              </p>
            )}
            {getItemBannerUrl(selectedItem) ? (
              <p style={{ margin: '8px 0 0', color: '#86efac', fontSize: '0.85rem' }}>
                Wide banner ready from this title
              </p>
            ) : (
              <p style={{ margin: '8px 0 0', color: '#fbbf24', fontSize: '0.85rem' }}>
                No wide banner on this title — upload one below
              </p>
            )}
          </div>
        )}

        {imagePreview && (
          <div className="form-group">
            <label>Banner preview</label>
            <img
              src={imagePreview}
              alt="Banner preview"
              style={{
                width: '100%',
                maxWidth: '520px',
                aspectRatio: '12 / 5',
                objectFit: 'cover',
                borderRadius: '8px',
                display: 'block'
              }}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={openCropper}
              disabled={cropLoading}
              style={{ marginTop: '10px' }}
            >
              {cropLoading ? 'Loading image…' : 'Crop & adjust'}
            </button>
          </div>
        )}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving
              ? 'Saving...'
              : editingBanner
                ? 'Update Banner'
                : 'Add Banner'}
          </button>
          {(editingBanner || imagePreview || linkedId) && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={resetForm}
              disabled={saving}
            >
              {editingBanner ? 'Cancel' : 'Clear'}
            </button>
          )}
        </div>
      </form>

      <h3 style={{ marginTop: '30px' }}>
        Current Banners {banners.length > 0 && `(${banners.length})`}
      </h3>

      {loading ? (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <h3>Loading banners...</h3>
        </div>
      ) : error ? (
        <div className="error-state">
          <h3>Error loading banners</h3>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={fetchBanners}>Retry</button>
        </div>
      ) : banners.length === 0 ? (
        <div className="empty-state">
          <h3>No banners yet</h3>
          <p>Add one above — image + movie or TV show.</p>
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Banner</th>
              <th>Linked Title</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {banners.map((banner, index) => (
              <tr key={banner._id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{index + 1}</span>
                    <button
                      type="button"
                      className="btn"
                      title="Move up"
                      onClick={() => handleMove(index, -1)}
                      disabled={index === 0}
                      style={{ padding: '2px 8px' }}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn"
                      title="Move down"
                      onClick={() => handleMove(index, 1)}
                      disabled={index === banners.length - 1}
                      style={{ padding: '2px 8px' }}
                    >
                      ↓
                    </button>
                  </div>
                </td>
                <td>
                  <img
                    src={banner.imageUrl}
                    alt={linkedLabel(banner) || `Banner ${index + 1}`}
                    style={{
                      width: '150px',
                      height: '63px',
                      objectFit: 'cover',
                      borderRadius: '4px',
                      display: 'block'
                    }}
                  />
                </td>
                <td>
                  {linkedLabel(banner) || (
                    <em style={{ color: '#999' }}>Title missing</em>
                  )}
                </td>
                <td>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    backgroundColor: banner.status === 'active' ? '#28a745' : '#6c757d',
                    color: 'white',
                    fontSize: '12px'
                  }}>
                    {banner.status}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleEdit(banner)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => handleToggleStatus(banner)}
                  >
                    {banner.status === 'active' ? 'Hide' : 'Show'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => handleDelete(banner)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <style>{`
        .banner-picker-windows {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 8px;
        }
        .banner-picker-window {
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 10px;
          overflow: hidden;
          background: rgba(0,0,0,0.25);
          min-height: 220px;
          display: flex;
          flex-direction: column;
        }
        .banner-picker-window-head {
          padding: 10px 12px;
          font-weight: 700;
          font-size: 0.85rem;
          border-bottom: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.04);
        }
        .banner-picker-list {
          overflow-y: auto;
          max-height: 260px;
          padding: 6px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .banner-picker-empty {
          padding: 18px 10px;
          text-align: center;
          opacity: 0.6;
          font-size: 0.9rem;
        }
        .banner-picker-item {
          text-align: left;
          border: 1px solid transparent;
          background: transparent;
          color: inherit;
          border-radius: 8px;
          padding: 8px 10px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .banner-picker-item:hover {
          background: rgba(255,255,255,0.06);
        }
        .banner-picker-item.is-active {
          background: rgba(229, 9, 20, 0.18);
          border-color: rgba(229, 9, 20, 0.55);
        }
        .banner-picker-item-title {
          font-weight: 600;
          font-size: 0.92rem;
        }
        .banner-picker-item-meta {
          font-size: 0.78rem;
          opacity: 0.7;
        }
        @media (max-width: 768px) {
          .banner-picker-windows {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default BannerManagement;
