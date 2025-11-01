import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AddMovie = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    year: new Date().getFullYear(),
    description: '',
    genre: '',
    movieUrl: '',
    imdbRating: 0,
    imageFile: null
  });
  const [imagePreview, setImagePreview] = useState(null);
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
    
    if (!formData.movieUrl.trim()) {
      errors.movieUrl = 'Movie URL is required';
    } else if (!isValidUrl(formData.movieUrl)) {
      errors.movieUrl = 'Please enter a valid URL';
    }
    
    if (formData.imdbRating < 0 || formData.imdbRating > 10) {
      errors.imdbRating = 'IMDB rating must be between 0 and 10';
    }
    
    if (!formData.imageFile) {
      errors.imageFile = 'Movie poster is required';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
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
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size should be less than 5MB');
        return;
      }

      setFormData(prev => ({
        ...prev,
        imageFile: file
      }));

      // Create preview
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
      setError('');
    }
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
      // Convert image to base64 for Cloudinary upload
      const base64Image = await convertImageToBase64(formData.imageFile);
      
      const requestData = {
        ...formData,
        imageFile: base64Image
      };
      
      console.log('Sending movie data:', {
        title: requestData.title,
        year: requestData.year,
        genre: requestData.genre,
        hasImageFile: !!requestData.imageFile,
        imageFileLength: requestData.imageFile ? requestData.imageFile.length : 0,
        hasImdbRating: requestData.imdbRating !== undefined,
        token: token ? 'Present' : 'Missing'
      });
      
      const response = await fetch('http://localhost:5001/api/movies', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      const result = await response.json();
      console.log('Response data:', result);

      if (result.success) {
        showNotification('Movie added successfully!', 'success');
        setTimeout(() => {
          navigate('/admin');
        }, 1500);
      } else {
        setError(result.message || 'Failed to add movie');
        showNotification(result.message || 'Failed to add movie', 'error');
      }
    } catch (err) {
      console.error('Error adding movie:', err);
      const errorMessage = 'Failed to add movie. Please try again.';
      setError(errorMessage);
      showNotification(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Notification system
  const showNotification = (message, type = 'info') => {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-message">${message}</span>
        <button class="notification-close">×</button>
      </div>
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);
    
    // Close button functionality
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
      movieUrl: '',
      imdbRating: 0,
      imageFile: null
    });
    setImagePreview(null);
    setError('');
    setValidationErrors({});
  };

  return (
    <div className="add-movie-container">
      <div className="card">
        <div className="form-header">
          <h1>Add New Movie</h1>
          <p>Fill in the details below to add a new movie to the collection</p>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="movie-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="title">Movie Title *</label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="Enter movie title"
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
            <label htmlFor="movieUrl">Movie URL (Watch) *</label>
            <input
              type="url"
              id="movieUrl"
              name="movieUrl"
              value={formData.movieUrl}
              onChange={handleInputChange}
              placeholder="https://example.com/watch/movie"
              required
              className={getFieldError('movieUrl') ? 'form-error' : isFieldValid('movieUrl') ? 'form-valid' : ''}
            />
            <small>URL where users can watch the movie</small>
            {getFieldError('movieUrl') && (
              <small className="error-message">{getFieldError('movieUrl')}</small>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="description">Description *</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Enter movie description..."
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
            <label htmlFor="imageFile">Movie Poster *</label>
            <input
              type="file"
              id="imageFile"
              name="imageFile"
              onChange={handleImageChange}
              accept="image/*"
              required
              className={getFieldError('imageFile') ? 'form-error' : isFieldValid('imageFile') ? 'form-valid' : ''}
            />
            <small>Max size: 5MB. Supported formats: JPG, PNG, GIF</small>
            {getFieldError('imageFile') && (
              <small className="error-message">{getFieldError('imageFile')}</small>
            )}
          </div>

          {imagePreview && (
            <div className="image-preview">
              <h4>Image Preview:</h4>
              <img 
                src={imagePreview} 
                alt="Preview" 
                style={{ 
                  maxWidth: '200px', 
                  maxHeight: '300px', 
                  objectFit: 'cover',
                  borderRadius: '8px',
                  border: '2px solid #ddd'
                }} 
              />
            </div>
          )}

          <div className="form-actions">
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Adding Movie...' : 'Add Movie'}
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

export default AddMovie; 