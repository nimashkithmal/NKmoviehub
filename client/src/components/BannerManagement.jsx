import React, { useState, useEffect, useCallback } from 'react';

const API_URL = '/api/banners';

/**
 * Home page banner section of the admin dashboard.
 *
 * Uploaded files are sent as data URIs; the server pushes them to Cloudinary
 * and stores only the resulting URL, so nothing is kept locally.
 */
const BannerManagement = ({ token, showNotification }) => {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [editingBanner, setEditingBanner] = useState(null);
  const [title, setTitle] = useState('');
  const [imageFile, setImageFile] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [imageUrlInput, setImageUrlInput] = useState('');

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

      if (result.success) {
        setBanners(result.data.banners);
      } else {
        setError(result.message || 'Failed to load banners');
      }
    } catch (err) {
      console.error('Error fetching banners:', err);
      setError('Failed to load banners. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    fetchBanners();
  }, [fetchBanners]);

  const resetForm = () => {
    setEditingBanner(null);
    setTitle('');
    setImageFile('');
    setImagePreview('');
    setImageUrlInput('');
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showNotification('Please choose an image file', 'error');
      return;
    }

    // 10MB keeps the base64 payload inside the server's request limit
    if (file.size > 10 * 1024 * 1024) {
      showNotification('Image must be smaller than 10MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImageFile(reader.result);
      setImagePreview(reader.result);
      setImageUrlInput('');
    };
    reader.readAsDataURL(file);
  };

  const handleUrlChange = (e) => {
    const value = e.target.value;
    setImageUrlInput(value);
    setImageFile('');
    setImagePreview(value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const image = imageFile || imageUrlInput.trim();

    if (!image && !editingBanner) {
      showNotification('Please choose an image file or paste an image URL', 'error');
      return;
    }

    try {
      setSaving(true);

      const isEditing = Boolean(editingBanner);
      const response = await fetch(
        isEditing ? `${API_URL}/${editingBanner._id}` : API_URL,
        {
          method: isEditing ? 'PUT' : 'POST',
          headers: authHeaders(),
          body: JSON.stringify(image ? { image, title } : { title })
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

  const handleEdit = (banner) => {
    setEditingBanner(banner);
    setTitle(banner.title || '');
    setImageFile('');
    setImageUrlInput('');
    setImagePreview(banner.imageUrl);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    if (!window.confirm('Delete this slide? The image is removed from Cloudinary too.')) {
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

  // Moving a slide swaps it with its neighbour, then saves the whole order
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

  return (
    <div className="card">
      <div className="dashboard-header">
        <h2>Home Page Banner</h2>
        <p>
          These slides make up the slideshow on the home page. Images are stored
          in Cloudinary under the home page banner folder.
        </p>
      </div>

      <h3 style={{ marginTop: '10px' }}>
        {editingBanner ? 'Edit Slide' : 'Add Slide'}
      </h3>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="banner-file">Banner Image</label>
          <input
            type="file"
            id="banner-file"
            accept="image/*"
            onChange={handleFileChange}
          />
          <small>Wide images work best; they are resized to 1920×800</small>
        </div>

        <div className="form-group">
          <label htmlFor="banner-url" className="optional">Or Image URL</label>
          <input
            type="text"
            id="banner-url"
            value={imageUrlInput}
            onChange={handleUrlChange}
            placeholder="https://example.com/wallpaper.jpg"
          />
          <small>Used when no file is chosen; the image is copied into Cloudinary</small>
        </div>

        <div className="form-group">
          <label htmlFor="banner-title" className="optional">Title</label>
          <input
            type="text"
            id="banner-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="A label to help you recognise this slide"
          />
        </div>

        {imagePreview && (
          <div className="form-group">
            <label>Preview</label>
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
          </div>
        )}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving
              ? 'Saving...'
              : editingBanner ? 'Update Slide' : 'Add Slide'}
          </button>
          {editingBanner && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={resetForm}
              disabled={saving}
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <h3 style={{ marginTop: '30px' }}>
        Current Slides {banners.length > 0 && `(${banners.length})`}
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
          <h3>No slides yet</h3>
          <p>Add one above and it appears on the home page straight away.</p>
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Image</th>
              <th>Title</th>
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
                    alt={banner.title || `Slide ${index + 1}`}
                    style={{
                      width: '150px',
                      height: '63px',
                      objectFit: 'cover',
                      borderRadius: '4px',
                      display: 'block'
                    }}
                  />
                </td>
                <td>{banner.title || <em style={{ color: '#999' }}>Untitled</em>}</td>
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
    </div>
  );
};

export default BannerManagement;
