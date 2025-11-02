import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AddTVShow = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    year: new Date().getFullYear(),
    description: '',
    genre: '',
    showUrl: '',
    imdbRating: 0,
    imageFiles: [],
    numberOfSeasons: 0
  });
  const [seasons, setSeasons] = useState([]); // Array of { seasonNumber, episodeCount, episodes: [...] }
  const [imagePreviews, setImagePreviews] = useState([]);
  const [validationErrors, setValidationErrors] = useState({});

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear validation error for this field
    if (validationErrors[name]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.title.trim()) {
      errors.title = 'Title is required';
    } else if (formData.title.trim().length < 2) {
      errors.title = 'Title must be at least 2 characters long';
    } else if (formData.title.trim().length > 100) {
      errors.title = 'Title cannot exceed 100 characters';
    }
    
    if (!formData.description.trim()) {
      errors.description = 'Description is required';
    } else if (formData.description.trim().length < 10) {
      errors.description = 'Description must be at least 10 characters long';
    } else if (formData.description.trim().length > 1000) {
      errors.description = 'Description cannot exceed 1000 characters';
    }
    
    if (!formData.genre) {
      errors.genre = 'Genre is required';
    }
    
    // Check if we have any episodes across all seasons
    const allEpisodes = seasons.flatMap(season => season.episodes || []);
    const hasEpisodes = allEpisodes.length > 0 && allEpisodes.some(ep => ep.episodeUrl && ep.episodeUrl.trim() !== '');
    
    if (!hasEpisodes) {
      if (!formData.showUrl.trim()) {
        errors.showUrl = 'Either TV Show URL or at least one episode URL is required';
      } else if (!isValidUrl(formData.showUrl)) {
        errors.showUrl = 'Please enter a valid URL';
      }
    } else {
      // Validate all episode URLs if episodes are provided
      seasons.forEach((season, seasonIndex) => {
        if (season.episodes && season.episodes.length > 0) {
          season.episodes.forEach((ep, epIndex) => {
            if (!ep.episodeUrl || !ep.episodeUrl.trim()) {
              errors[`season${seasonIndex + 1}_episode${epIndex + 1}`] = `Season ${season.seasonNumber} Episode ${epIndex + 1} URL is required`;
            } else if (!isValidUrl(ep.episodeUrl)) {
              errors[`season${seasonIndex + 1}_episode${epIndex + 1}`] = `Season ${season.seasonNumber} Episode ${epIndex + 1} URL is invalid`;
            }
          });
        }
      });
    }
    
    if (formData.imdbRating < 0 || formData.imdbRating > 10) {
      errors.imdbRating = 'IMDB rating must be between 0 and 10';
    }
    
    if (!formData.imageFiles || formData.imageFiles.length === 0) {
      errors.imageFiles = 'At least one TV show poster is required';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle number of seasons change
  const handleSeasonsChange = (e) => {
    const numSeasons = parseInt(e.target.value) || 0;
    setFormData(prev => ({ ...prev, numberOfSeasons: numSeasons }));
    
    // Initialize seasons array
    const newSeasons = [];
    for (let i = 1; i <= numSeasons; i++) {
      newSeasons.push({
        seasonNumber: i,
        episodeCount: 0,
        episodes: []
      });
    }
    setSeasons(newSeasons);
  };

  // Handle episode count change for a specific season
  const handleSeasonEpisodeCountChange = (seasonIndex, episodeCount) => {
    const count = parseInt(episodeCount) || 0;
    const updatedSeasons = [...seasons];
    updatedSeasons[seasonIndex] = {
      ...updatedSeasons[seasonIndex],
      episodeCount: count,
      episodes: []
    };
    
    // Initialize episodes for this season
    for (let i = 1; i <= count; i++) {
      updatedSeasons[seasonIndex].episodes.push({
        episodeNumber: i,
        episodeUrl: '',
        episodeTitle: `Season ${updatedSeasons[seasonIndex].seasonNumber} Episode ${i}`
      });
    }
    
    setSeasons(updatedSeasons);
  };

  // Handle episode change for a specific season and episode
  const handleEpisodeChange = (seasonIndex, episodeIndex, field, value) => {
    const updatedSeasons = [...seasons];
    updatedSeasons[seasonIndex].episodes[episodeIndex] = {
      ...updatedSeasons[seasonIndex].episodes[episodeIndex],
      [field]: value
    };
    setSeasons(updatedSeasons);
    
    // Clear validation error for this episode
    const errorKey = `season${seasonIndex + 1}_episode${episodeIndex + 1}`;
    if (validationErrors[errorKey]) {
      setValidationErrors(prev => ({
        ...prev,
        [errorKey]: null
      }));
    }
  };

  const isValidUrl = (string) => {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  };

  const getFieldError = (fieldName) => {
    return validationErrors[fieldName];
  };

  const isFieldValid = (fieldName) => {
    return !validationErrors[fieldName];
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validFiles = [];
    const newPreviews = [];

    files.forEach((file) => {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError(`File ${file.name} is not a valid image file`);
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError(`Image ${file.name} size should be less than 5MB`);
        return;
      }

      validFiles.push(file);

      // Create preview
      const reader = new FileReader();
      reader.onload = () => {
        newPreviews.push(reader.result);
        if (newPreviews.length === validFiles.length) {
          setImagePreviews(prev => [...prev, ...newPreviews]);
        }
      };
      reader.readAsDataURL(file);
    });

    if (validFiles.length > 0) {
      setFormData(prev => ({
        ...prev,
        imageFiles: [...prev.imageFiles, ...validFiles]
      }));
      setError('');
    }
  };

  const removeImage = (index) => {
    setFormData(prev => ({
      ...prev,
      imageFiles: prev.imageFiles.filter((_, i) => i !== index)
    }));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate form before submission
    if (!validateForm()) {
      showNotification('Please fix the validation errors before submitting', 'error');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Convert all images to base64 for Cloudinary upload
      const base64Images = await Promise.all(
        formData.imageFiles.map(file => convertImageToBase64(file))
      );
      
      // Flatten all episodes from all seasons into a single array with sequential episode numbers
      let globalEpisodeNumber = 1;
      const episodesData = [];
      
      seasons.forEach((season) => {
        if (season.episodes && season.episodes.length > 0) {
          season.episodes.forEach((ep) => {
            if (ep && ep.episodeUrl && ep.episodeUrl.trim() !== '') {
              episodesData.push({
                episodeNumber: globalEpisodeNumber++,
                episodeUrl: ep.episodeUrl.trim(),
                episodeTitle: (ep.episodeTitle && ep.episodeTitle.trim()) || `Episode ${globalEpisodeNumber - 1}`
              });
            }
          });
        }
      });
      
      console.log('📺 Frontend - seasons state:', JSON.stringify(seasons, null, 2));
      console.log('📺 Frontend - episodesData after flattening:', JSON.stringify(episodesData, null, 2));
      console.log('📺 Frontend - episodesData length:', episodesData.length);
      
      const requestData = {
        title: formData.title,
        year: formData.year,
        description: formData.description,
        genre: formData.genre,
        imdbRating: formData.imdbRating,
        imageFiles: base64Images, // Send array of base64 images
        numberOfSeasons: formData.numberOfSeasons || (seasons.length > 0 ? seasons.length : 1)
      };
      
      // Always include episodes array (even if empty) and episodeCount
      requestData.episodes = episodesData.length > 0 ? episodesData : [];
      requestData.episodeCount = episodesData.length > 0 ? episodesData.length : (parseInt(formData.episodeCount) || 0);
      
      // Add showUrl if provided
      if (formData.showUrl && formData.showUrl.trim()) {
        requestData.showUrl = formData.showUrl.trim();
      }
      
      console.log('📺 Frontend - Final requestData.episodes:', JSON.stringify(requestData.episodes, null, 2));
      console.log('📺 Frontend - Final requestData.episodeCount:', requestData.episodeCount);
      
      console.log('📺 Frontend - requestData being sent:', JSON.stringify({
        ...requestData,
        imageFile: '[BASE64_IMAGE]'
      }, null, 2));
      
      const response = await fetch('http://localhost:5001/api/tvshows', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      const result = await response.json();

      if (!response.ok) {
        // Handle validation errors
        if (result.errors && Array.isArray(result.errors)) {
          const validationErrorsObj = {};
          result.errors.forEach(err => {
            const field = err.path || err.param || err.field || 'general';
            validationErrorsObj[field] = err.msg || err.message || 'Validation error';
          });
          setValidationErrors(prev => ({ ...prev, ...validationErrorsObj }));
          const errorMsg = result.message || 'Please fix the validation errors';
          setError(errorMsg);
          showNotification(errorMsg, 'error');
        } else {
          setError(result.message || 'Failed to add TV show');
          showNotification(result.message || 'Failed to add TV show', 'error');
        }
        return;
      }

      if (result.success) {
        showNotification('TV Show added successfully!', 'success');
        setTimeout(() => {
          navigate('/admin');
        }, 1500);
      } else {
        setError(result.message || 'Failed to add TV show');
        showNotification(result.message || 'Failed to add TV show', 'error');
      }
    } catch (err) {
      console.error('Error adding TV show:', err);
      const errorMessage = 'Failed to add TV show. Please try again.';
      setError(errorMessage);
      showNotification(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Notification system
  const showNotification = (message, type = 'info') => {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-message">${message}</span>
        <button class="notification-close">×</button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);
    
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    });
  };

  const convertImageToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  const resetForm = () => {
    setFormData({
      title: '',
      year: new Date().getFullYear(),
      description: '',
      genre: '',
      showUrl: '',
      imdbRating: 0,
      imageFiles: [],
      numberOfSeasons: 0
    });
    setSeasons([]);
    setImagePreviews([]);
    setError('');
    setValidationErrors({});
  };

  return (
    <div className="add-movie-container">
      <div className="card">
        <div className="form-header">
          <h1>Add New TV Show</h1>
          <p>Fill in the details below to add a new TV show to the collection</p>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="movie-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="title">TV Show Title *</label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Enter TV show title"
                required
                minLength="2"
                maxLength="100"
                className={getFieldError('title') ? 'form-error' : isFieldValid('title') ? 'form-valid' : ''}
              />
              {getFieldError('title') && (
                <small className="error-message">{getFieldError('title')}</small>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="year">Release Year *</label>
              <input
                type="number"
                id="year"
                name="year"
                value={formData.year}
                onChange={handleInputChange}
                min="1900"
                max={new Date().getFullYear() + 5}
                required
                className={getFieldError('year') ? 'form-error' : isFieldValid('year') ? 'form-valid' : ''}
              />
              {getFieldError('year') && (
                <small className="error-message">{getFieldError('year')}</small>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="genre">Genre *</label>
              <select
                id="genre"
                name="genre"
                value={formData.genre}
                onChange={handleInputChange}
                required
                className={getFieldError('genre') ? 'form-error' : isFieldValid('genre') ? 'form-valid' : ''}
              >
                <option value="">Select Genre</option>
                <option value="Action">Action</option>
                <option value="Adventure">Adventure</option>
                <option value="Animation">Animation</option>
                <option value="Comedy">Comedy</option>
                <option value="Crime">Crime</option>
                <option value="Documentary">Documentary</option>
                <option value="Drama">Drama</option>
                <option value="Family">Family</option>
                <option value="Fantasy">Fantasy</option>
                <option value="Horror">Horror</option>
                <option value="Mystery">Mystery</option>
                <option value="Romance">Romance</option>
                <option value="Sci-Fi">Sci-Fi</option>
                <option value="Thriller">Thriller</option>
                <option value="War">War</option>
                <option value="Western">Western</option>
              </select>
              {getFieldError('genre') && (
                <small className="error-message">{getFieldError('genre')}</small>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="imdbRating">IMDB Rating (0-10) *</label>
              <div className="rating-input">
                <input
                  type="number"
                  id="imdbRating"
                  name="imdbRating"
                  value={formData.imdbRating}
                  onChange={handleInputChange}
                  min="0"
                  max="10"
                  step="0.1"
                  required
                  className={`rating-number-input ${getFieldError('imdbRating') ? 'form-error' : isFieldValid('imdbRating') ? 'form-valid' : ''}`}
                />
                <div className="rating-display">
                  <span className="rating-label">IMDB Rating: </span>
                  <span className="rating-value">{formData.imdbRating}/10</span>
                </div>
              </div>
              {getFieldError('imdbRating') && (
                <small className="error-message">{getFieldError('imdbRating')}</small>
              )}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="numberOfSeasons">Number of Seasons</label>
            <input
              type="number"
              id="numberOfSeasons"
              name="numberOfSeasons"
              value={formData.numberOfSeasons || ''}
              onChange={handleSeasonsChange}
              min="0"
              placeholder="Enter number of seasons (e.g., 5)"
              className={getFieldError('numberOfSeasons') ? 'form-error' : ''}
            />
            <small>Enter the number of seasons. Leave 0 if using single URL below.</small>
            {getFieldError('numberOfSeasons') && (
              <small className="error-message">{getFieldError('numberOfSeasons')}</small>
            )}
          </div>

          {seasons.length > 0 && (
            <div className="form-group">
              <label>Seasons and Episodes *</label>
              <div style={{ marginTop: '10px' }}>
                {seasons.map((season, seasonIndex) => (
                  <div 
                    key={seasonIndex} 
                    style={{ 
                      marginBottom: '20px', 
                      padding: '15px', 
                      border: '2px solid #007bff', 
                      borderRadius: '8px',
                      backgroundColor: '#f8f9fa'
                    }}
                  >
                    <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <h3 style={{ margin: 0, color: '#007bff' }}>Season {season.seasonNumber}</h3>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '14px', marginRight: '10px' }}>
                          Number of Episodes:
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={season.episodeCount || ''}
                          onChange={(e) => handleSeasonEpisodeCountChange(seasonIndex, e.target.value)}
                          placeholder="e.g., 10"
                          style={{ 
                            padding: '6px 10px', 
                            border: '1px solid #ccc', 
                            borderRadius: '4px',
                            width: '100px'
                          }}
                        />
                      </div>
                    </div>

                    {season.episodes && season.episodes.length > 0 && (
                      <div style={{ marginTop: '15px' }}>
                        {season.episodes.map((episode, episodeIndex) => (
                          <div 
                            key={episodeIndex} 
                            style={{ 
                              marginBottom: '12px', 
                              padding: '10px', 
                              border: '1px solid #ddd', 
                              borderRadius: '5px',
                              backgroundColor: '#fff'
                            }}
                          >
                            <div style={{ marginBottom: '8px', fontWeight: '600', color: '#555' }}>
                              Season {season.seasonNumber} - Episode {episode.episodeNumber}
                            </div>
                            <input
                              type="text"
                              placeholder={`Episode Title (optional)`}
                              value={episode.episodeTitle || ''}
                              onChange={(e) => handleEpisodeChange(seasonIndex, episodeIndex, 'episodeTitle', e.target.value)}
                              style={{ 
                                width: '100%', 
                                marginBottom: '8px', 
                                padding: '8px', 
                                border: '1px solid #ccc', 
                                borderRadius: '4px' 
                              }}
                            />
                            <input
                              type="url"
                              placeholder={`Episode URL *`}
                              value={episode.episodeUrl || ''}
                              onChange={(e) => handleEpisodeChange(seasonIndex, episodeIndex, 'episodeUrl', e.target.value)}
                              required
                              className={getFieldError(`season${seasonIndex + 1}_episode${episodeIndex + 1}`) ? 'form-error' : ''}
                              style={{ 
                                width: '100%', 
                                padding: '8px', 
                                border: '1px solid #ccc', 
                                borderRadius: '4px' 
                              }}
                            />
                            {getFieldError(`season${seasonIndex + 1}_episode${episodeIndex + 1}`) && (
                              <small className="error-message" style={{ display: 'block', marginTop: '5px' }}>
                                {getFieldError(`season${seasonIndex + 1}_episode${episodeIndex + 1}`)}
                              </small>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="showUrl">
              TV Show URL (Watch) {seasons.length === 0 ? '*' : '(Optional - use if no episodes)'}
            </label>
            <input
              type="url"
              id="showUrl"
              name="showUrl"
              value={formData.showUrl}
              onChange={handleInputChange}
              placeholder="https://example.com/watch/tvshow"
              required={seasons.length === 0}
              className={getFieldError('showUrl') ? 'form-error' : isFieldValid('showUrl') ? 'form-valid' : ''}
            />
            <small>
              {seasons.length === 0 
                ? 'URL where users can watch the TV show'
                : 'Single URL for the TV show (if not using individual episode URLs above)'}
            </small>
            {getFieldError('showUrl') && (
              <small className="error-message">{getFieldError('showUrl')}</small>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="description">Description *</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Enter TV show description..."
              required
              minLength="10"
              maxLength="1000"
              rows="4"
              className={getFieldError('description') ? 'form-error' : isFieldValid('description') ? 'form-valid' : ''}
            />
            <small className="char-count">
              {formData.description.length}/1000 characters
            </small>
            {getFieldError('description') && (
              <small className="error-message">{getFieldError('description')}</small>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="imageFiles">TV Show Posters *</label>
            <input
              type="file"
              id="imageFiles"
              name="imageFiles"
              onChange={handleImageChange}
              accept="image/*"
              multiple
              required
              className={getFieldError('imageFiles') ? 'form-error' : isFieldValid('imageFiles') ? 'form-valid' : ''}
            />
            <small>Max size per image: 5MB. Supported formats: JPG, PNG, GIF. You can select multiple images.</small>
            {getFieldError('imageFiles') && (
              <small className="error-message">{getFieldError('imageFiles')}</small>
            )}
          </div>

          {imagePreviews.length > 0 && (
            <div className="image-preview-section">
              <h4>Image Previews ({imagePreviews.length}):</h4>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', 
                gap: '15px',
                marginTop: '15px'
              }}>
                {imagePreviews.map((preview, index) => (
                  <div key={index} style={{ position: 'relative' }}>
                    <img 
                      src={preview} 
                      alt={`Preview ${index + 1}`} 
                      style={{ 
                        width: '100%', 
                        height: '225px', 
                        objectFit: 'cover',
                        borderRadius: '8px',
                        border: '2px solid #ddd'
                      }} 
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      style={{
                        position: 'absolute',
                        top: '5px',
                        right: '5px',
                        background: 'red',
                        color: 'white',
                        border: 'none',
                        borderRadius: '50%',
                        width: '25px',
                        height: '25px',
                        cursor: 'pointer',
                        fontSize: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="form-actions">
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Adding TV Show...' : 'Add TV Show'}
            </button>
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={resetForm}
              disabled={loading}
            >
              Reset Form
            </button>
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={() => navigate('/admin')}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddTVShow;

