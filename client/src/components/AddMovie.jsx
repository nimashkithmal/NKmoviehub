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
    downloadUrl: '',
    imdbRating: 0,
    imageFile: null
  });
  const [imagePreview, setImagePreview] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleRatingChange = (rating) => {
    setFormData(prev => ({
      ...prev,
      rating: parseInt(rating)
    }));
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
    
    if (!formData.imageFile) {
      setError('Please select an image');
      return;
    }

    if (formData.imdbRating < 0 || formData.imdbRating > 10) {
      setError('IMDB rating must be between 0 and 10');
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
        hasDownloadUrl: !!requestData.downloadUrl,
        hasRating: requestData.rating !== undefined,
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
        alert('Movie added successfully!');
        navigate('/admin');
      } else {
        setError(result.message || 'Failed to add movie');
      }
    } catch (err) {
      console.error('Error adding movie:', err);
      setError('Failed to add movie. Please try again.');
    } finally {
      setLoading(false);
    }
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
      downloadUrl: '',
      imdbRating: 0,
      imageFile: null
    });
    setImagePreview(null);
    setError('');
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
              />
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
              />
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
                  className="rating-number-input"
                />
                <div className="rating-display">
                  <span className="rating-label">IMDB Rating: </span>
                  <span className="rating-value">{formData.imdbRating}/10</span>
                </div>
              </div>
            </div>
          </div>

          <div className="form-row">
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
              />
              <small>URL where users can watch the movie</small>
            </div>

            <div className="form-group">
              <label htmlFor="downloadUrl">Movie Download URL *</label>
              <input
                type="url"
                id="downloadUrl"
                name="downloadUrl"
                value={formData.downloadUrl}
                onChange={handleInputChange}
                placeholder="https://example.com/download/movie"
                required
              />
              <small>URL where users can download the movie</small>
            </div>
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
            />
            <small className="char-count">
              {formData.description.length}/1000 characters
            </small>
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
            />
            <small>Max size: 5MB. Supported formats: JPG, PNG, GIF</small>
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