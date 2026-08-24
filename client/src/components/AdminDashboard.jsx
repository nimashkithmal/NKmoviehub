import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import ContactManagement from './ContactManagement';
import AdminManagement from './AdminManagement';
import BannerManagement from './BannerManagement';
import CollectionManagement from './CollectionManagement';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [movies, setMovies] = useState([]);
  const [tvShows, setTVShows] = useState([]);
  const [moviesLoading, setMoviesLoading] = useState(false);
  const [tvShowsLoading, setTVShowsLoading] = useState(false);
  const [moviesError, setMoviesError] = useState(null);
  const [tvShowsError, setTVShowsError] = useState(null);
  const [movieSearchTerm, setMovieSearchTerm] = useState('');
  const [tvShowSearchTerm, setTVShowSearchTerm] = useState('');
  const [editingMovie, setEditingMovie] = useState(null);
  const [editingTVShow, setEditingTVShow] = useState(null);
  const [movieFormData, setMovieFormData] = useState({
    title: '',
    year: new Date().getFullYear(),
    description: '',
    genre: '',
    movieUrl: '',
    imdbRating: 0
  });
  const [movieImageFiles, setMovieImageFiles] = useState([]);
  const [movieImagePreviews, setMovieImagePreviews] = useState([]);
  const [movieBannerFile, setMovieBannerFile] = useState(null);
  const [movieBannerPreview, setMovieBannerPreview] = useState('');
  const [movieClearBanner, setMovieClearBanner] = useState(false);
  const [tvShowFormData, setTVShowFormData] = useState({
    title: '',
    year: new Date().getFullYear(),
    description: '',
    genre: '',
    showUrl: '',
    imdbRating: 0,
    episodeCount: 0,
    numberOfSeasons: 0
  });
  const [tvShowImageFiles, setTVShowImageFiles] = useState([]);
  const [tvShowImagePreviews, setTVShowImagePreviews] = useState([]);
  const [tvShowBannerFile, setTVShowBannerFile] = useState(null);
  const [tvShowBannerPreview, setTVShowBannerPreview] = useState('');
  const [tvShowClearBanner, setTVShowClearBanner] = useState(false);
  const [tvShowEpisodes, setTVShowEpisodes] = useState([]);
  const [tvShowSeasons, setTVShowSeasons] = useState([]);
  const [movieStats, setMovieStats] = useState({
    totalMovies: 0,
    activeMovies: 0,
    averageRating: 0,
    newMoviesThisMonth: 0
  });
  const [tvShowStats, setTVShowStats] = useState({
    totalTVShows: 0,
    activeTVShows: 0,
    averageRating: 0,
    newTVShowsThisMonth: 0
  });
  const [activeTab, setActiveTab] = useState('admins'); // 'admins', 'movies', 'tvshows', 'banners', 'collections', or 'contacts'

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

  // Fetch movies from backend
  const fetchMovies = useCallback(async () => {
    try {
      setMoviesLoading(true);
      setMoviesError(null);
      
      const response = await fetch('/api/movies/admin?limit=1000', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setMovies(result.data.movies);
        
        // Calculate movie stats
        const totalMovies = result.data.movies.length;
        const activeMovies = result.data.movies.filter(m => m.status === 'active').length;
        const averageImdbRating = result.data.movies.reduce((sum, m) => sum + m.imdbRating, 0) / totalMovies || 0;
        const newMoviesThisMonth = result.data.movies.filter(m => {
          const movieDate = new Date(m.createdAt);
          const now = new Date();
          return movieDate.getMonth() === now.getMonth() && movieDate.getFullYear() === now.getFullYear();
        }).length;

        setMovieStats({
          totalMovies,
          activeMovies,
          averageRating: Math.round(averageImdbRating * 10) / 10,
          newMoviesThisMonth
        });
      } else {
        throw new Error(result.message || 'Failed to fetch movies');
      }
    } catch (err) {
      console.error('Error fetching movies:', err);
      setMoviesError(err.message);
    } finally {
      setMoviesLoading(false);
    }
  }, [token]);

  // Fetch TV shows from backend
  const fetchTVShows = useCallback(async () => {
    try {
      setTVShowsLoading(true);
      setTVShowsError(null);
      
      const response = await fetch('/api/tvshows/admin?limit=1000', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setTVShows(result.data.tvShows);
        
        // Calculate TV show stats
        const totalTVShows = result.data.tvShows.length;
        const activeTVShows = result.data.tvShows.filter(t => t.status === 'active').length;
        const averageImdbRating = result.data.tvShows.reduce((sum, t) => sum + t.imdbRating, 0) / totalTVShows || 0;
        const newTVShowsThisMonth = result.data.tvShows.filter(t => {
          const tvShowDate = new Date(t.createdAt);
          const now = new Date();
          return tvShowDate.getMonth() === now.getMonth() && tvShowDate.getFullYear() === now.getFullYear();
        }).length;

        setTVShowStats({
          totalTVShows,
          activeTVShows,
          averageRating: Math.round(averageImdbRating * 10) / 10,
          newTVShowsThisMonth
        });
      } else {
        throw new Error(result.message || 'Failed to fetch TV shows');
      }
    } catch (err) {
      console.error('Error fetching TV shows:', err);
      setTVShowsError(err.message);
    } finally {
      setTVShowsLoading(false);
    }
  }, [token]);

  // Fetch data on component mount
  useEffect(() => {
    if (token) {
      fetchMovies();
      fetchTVShows();
    }
  }, [token, fetchMovies, fetchTVShows]);

  // Movie management functions

  const handleEditMovie = (movie) => {
    setEditingMovie(movie);
    setMovieFormData({
      title: movie.title || '',
      year: movie.year || new Date().getFullYear(),
      description: movie.description || '',
      genre: movie.genre || '',
      movieUrl: movie.movieUrl || '',
      imdbRating: movie.imdbRating || 0
    });
    // Gallery posters only — never include the detail banner
    const gallery = (movie.images && movie.images.length > 0)
      ? movie.images.filter((url) => url && url !== movie.bannerUrl)
      : (movie.imageUrl && movie.imageUrl !== movie.bannerUrl ? [movie.imageUrl] : []);
    setMovieImagePreviews(gallery);
    setMovieImageFiles([]);
    setMovieBannerPreview(movie.bannerUrl || '');
    setMovieBannerFile(null);
    setMovieClearBanner(false);
  };

  const handleUpdateMovie = async () => {
    if (!movieFormData.title || !movieFormData.description || !movieFormData.genre || !movieFormData.movieUrl) {
      showNotification('Please fill in all required fields', 'error');
      return;
    }

    try {
      const updateData = {
        title: movieFormData.title,
        year: movieFormData.year,
        description: movieFormData.description,
        genre: movieFormData.genre,
        movieUrl: movieFormData.movieUrl
      };
      
      // Always include imdbRating in the update
      // Get the current value from form data
      const ratingValue = movieFormData.imdbRating;
      let ratingToSend;
      
      // Determine what rating value to send
      if (ratingValue === undefined || ratingValue === null || ratingValue === '') {
        // If empty/invalid, keep existing value
        ratingToSend = editingMovie?.imdbRating ?? 0;
      } else {
        // Try to parse as number
        const parsedRating = parseFloat(ratingValue);
        if (!isNaN(parsedRating) && parsedRating >= 0 && parsedRating <= 10) {
          ratingToSend = parsedRating;
        } else {
          // Invalid number, keep existing value
          ratingToSend = editingMovie?.imdbRating ?? 0;
        }
      }
      
      // Always include imdbRating in update (even if 0)
      updateData.imdbRating = ratingToSend;
      
      console.log('IMDB Rating update:', {
        formValue: ratingValue,
        sending: ratingToSend,
        existing: editingMovie?.imdbRating,
        type: typeof ratingToSend
      });
      
      // Handle image updates
      // If new images are added, convert them to base64
      if (movieImageFiles.length > 0) {
        const base64Images = await Promise.all(
          movieImageFiles.map(file => convertImageToBase64(file))
        );
        updateData.imageFiles = base64Images;
      }
      
      // If images were removed (previews changed), send the updated images array
      if (movieImagePreviews.length > 0 && editingMovie && (editingMovie.images || editingMovie.imageUrl)) {
        // Compare existing images with previews to detect removals
        const existingImageUrls = editingMovie.images || (editingMovie.imageUrl ? [editingMovie.imageUrl] : []);
        const remainingUrls = movieImagePreviews.filter(preview => 
          typeof preview === 'string' && preview.startsWith('http')
        );
        // Always send the updated images array if previews differ from existing
        if (remainingUrls.length > 0) {
          updateData.images = remainingUrls;
        } else if (existingImageUrls.length > 0 && remainingUrls.length === 0) {
          // If all images were removed
          updateData.images = [];
        }
      } else if (movieImagePreviews.length === 0 && editingMovie && (editingMovie.images || editingMovie.imageUrl)) {
        // All images were removed
        updateData.images = [];
      }

      if (movieClearBanner) {
        updateData.clearBanner = true;
      } else if (movieBannerFile) {
        updateData.bannerFile = await convertImageToBase64(movieBannerFile);
      }
      
      console.log('Updating movie with data:', updateData);
      console.log('IMDB Rating in updateData:', updateData.imdbRating, 'Type:', typeof updateData.imdbRating);
      
      const response = await fetch(`/api/movies/${editingMovie._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update movie');
      }

      const result = await response.json();
      
      if (result.success) {
        await fetchMovies();
        setEditingMovie(null);
        setMovieFormData({
          title: '',
          year: new Date().getFullYear(),
          description: '',
          genre: '',
          movieUrl: '',
          imdbRating: 0
        });
        setMovieImageFiles([]);
        setMovieImagePreviews([]);
        setMovieBannerFile(null);
        setMovieBannerPreview('');
        setMovieClearBanner(false);
        showNotification('Movie updated successfully!', 'success');
      }
    } catch (err) {
      console.error('Error updating movie:', err);
      showNotification(`Error updating movie: ${err.message}`, 'error');
    }
  };

  const handleMovieBannerChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showNotification('Please select a valid image file', 'error');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      showNotification('Banner image should be less than 8MB', 'error');
      return;
    }
    setMovieBannerFile(file);
    setMovieClearBanner(false);
    const reader = new FileReader();
    reader.onload = () => setMovieBannerPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const clearMovieBanner = () => {
    setMovieBannerFile(null);
    setMovieBannerPreview('');
    setMovieClearBanner(true);
  };

  const handleMovieImageChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validFiles = [];
    const newPreviews = [];

    files.forEach((file) => {
      if (!file.type.startsWith('image/')) {
        showNotification(`File ${file.name} is not a valid image file`, 'error');
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        showNotification(`Image ${file.name} size should be less than 5MB`, 'error');
        return;
      }

      validFiles.push(file);

      const reader = new FileReader();
      reader.onload = () => {
        newPreviews.push(reader.result);
        if (newPreviews.length === validFiles.length) {
          setMovieImagePreviews(prev => [...prev, ...newPreviews]);
        }
      };
      reader.readAsDataURL(file);
    });

    if (validFiles.length > 0) {
      setMovieImageFiles(prev => [...prev, ...validFiles]);
    }
  };

  const removeMovieImage = (index) => {
    // If index is in existing images (from database), we need to handle differently
    const existingCount = editingMovie?.images?.length || (editingMovie?.imageUrl ? 1 : 0);
    if (index < existingCount) {
      // Removing existing image - we'll mark it for removal by not including it in the update
      // For now, just remove from preview
      setMovieImagePreviews(prev => prev.filter((_, i) => i !== index));
    } else {
      // Removing newly added file
      const fileIndex = index - existingCount;
      setMovieImageFiles(prev => prev.filter((_, i) => i !== fileIndex));
      setMovieImagePreviews(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleDeleteMovie = async (movieId) => {
    if (window.confirm('Are you sure you want to delete this movie?')) {
      try {
        const response = await fetch(`/api/movies/${movieId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to delete movie');
        }

        const result = await response.json();
        
        if (result.success) {
          await fetchMovies();
          showNotification('Movie deleted successfully!', 'success');
        }
      } catch (err) {
        console.error('Error deleting movie:', err);
        showNotification(`Error deleting movie: ${err.message}`, 'error');
      }
    }
  };

  const handleToggleMovieStatus = async (movieId, status) => {
    try {
      const response = await fetch(`/api/movies/${movieId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update movie status');
      }

      const result = await response.json();
      
      if (result.success) {
        await fetchMovies();
        showNotification(`Movie status updated successfully!`, 'success');
      }
    } catch (err) {
      console.error('Error updating movie status:', err);
      showNotification(`Error updating movie status: ${err.message}`, 'error');
    }
  };

  const handleUpdateAdminFields = async (movieId, imdbRating, imageFile, imageFiles) => {
    try {
      const updateData = {};
      if (imdbRating !== null && imdbRating !== undefined) updateData.imdbRating = imdbRating;
      if (imageFiles && Array.isArray(imageFiles) && imageFiles.length > 0) {
        updateData.imageFiles = imageFiles;
      } else if (imageFile !== null && imageFile !== undefined) {
        updateData.imageFile = imageFile; // Backward compatibility
      }
      
      console.log('Sending update data:', {
        movieId,
        hasImdbRating: imdbRating !== null && imdbRating !== undefined,
        hasImageFile: imageFile !== null && imageFile !== undefined,
        hasImageFiles: imageFiles && Array.isArray(imageFiles) && imageFiles.length > 0,
        imageFilesCount: imageFiles ? imageFiles.length : 0
      });

      const response = await fetch(`/api/movies/${movieId}/update-admin-fields`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Response error:', errorData);
        throw new Error(errorData.message || 'Failed to update movie');
      }

      const result = await response.json();
      console.log('Response result:', result);
      
      if (result.success) {
        // Only refresh movies list for non-image updates to avoid double refresh
        if (!imageFile && (!imageFiles || imageFiles.length === 0)) {
          await fetchMovies();
        }
        showNotification('Movie updated successfully!', 'success');
      }
      return result; // Return the result for the handleImageUpdate function
    } catch (err) {
      console.error('Error updating movie:', err);
      showNotification(`Error updating movie: ${err.message}`, 'error');
      return { success: false, message: err.message }; // Return a failure result
    }
  };

  const handleImageUpdate = async (movieId) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true; // Allow multiple files
    
    input.onchange = async (event) => {
      const files = Array.from(event.target.files || []);
      if (files.length === 0) return;

      const validFiles = [];
      for (const file of files) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          showNotification(`File ${file.name} is not a valid image file`, 'error');
          continue;
        }
        
        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          showNotification(`Image ${file.name} size should be less than 5MB`, 'error');
          continue;
        }
        
        validFiles.push(file);
      }

      if (validFiles.length === 0) {
        showNotification('No valid image files selected', 'error');
        return;
      }

      try {
        // Show loading state
        const updateBtn = document.querySelector(`[data-movie-id="${movieId}"] .update-image-btn`);
        if (updateBtn) {
          updateBtn.textContent = `🔄 Uploading ${validFiles.length} image(s)...`;
          updateBtn.disabled = true;
        }

        // Convert all images to base64
        const base64Images = await Promise.all(
          validFiles.map(file => convertImageToBase64(file))
        );
        console.log(`Base64 images created: ${base64Images.length} images`);
        
        // Update the movie images
        console.log('Calling handleUpdateAdminFields with images...');
        const result = await handleUpdateAdminFields(movieId, undefined, undefined, base64Images);
        console.log('Result from handleUpdateAdminFields:', result);
        
        if (result && result.success) {
          // Refresh the movies list to show the updated images
          console.log('Image update successful, refreshing movies list...');
          await fetchMovies();
          showNotification(`${validFiles.length} image(s) updated successfully!`, 'success');
        } else {
          const errorMsg = result?.message || 'Failed to update images. Please try again.';
          console.error('Image update failed:', errorMsg);
          showNotification(`Failed to update images: ${errorMsg}`, 'error');
        }
      } catch (error) {
        console.error('Error processing images:', error);
        showNotification('Failed to process images. Please try again.', 'error');
      } finally {
        // Reset button state
        const updateBtn = document.querySelector(`[data-movie-id="${movieId}"] .update-image-btn`);
        if (updateBtn) {
          updateBtn.textContent = '🖼️ Update Images';
          updateBtn.disabled = false;
        }
      }
    };
    
    input.click();
  };

  const convertImageToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  const filteredMovies = movies.filter(movie =>
    movie.title.toLowerCase().includes(movieSearchTerm.toLowerCase()) ||
    movie.year.toString().includes(movieSearchTerm) ||
    movie.genre.toLowerCase().includes(movieSearchTerm.toLowerCase())
  );

  const filteredTVShows = tvShows.filter(tvShow =>
    tvShow.title.toLowerCase().includes(tvShowSearchTerm.toLowerCase()) ||
    tvShow.year.toString().includes(tvShowSearchTerm) ||
    tvShow.genre.toLowerCase().includes(tvShowSearchTerm.toLowerCase())
  );

  // TV Show management functions
  // Helper function to group episodes into seasons
  const groupEpisodesBySeasons = (episodes, numberOfSeasons) => {
    if (!episodes || episodes.length === 0 || !numberOfSeasons || numberOfSeasons === 0) {
      return [];
    }

    const sortedEpisodes = [...episodes].sort((a, b) => a.episodeNumber - b.episodeNumber);
    const episodesPerSeason = Math.ceil(sortedEpisodes.length / numberOfSeasons);
    const seasons = [];

    for (let seasonNum = 1; seasonNum <= numberOfSeasons; seasonNum++) {
      const startIdx = (seasonNum - 1) * episodesPerSeason;
      const endIdx = Math.min(startIdx + episodesPerSeason, sortedEpisodes.length);
      const seasonEpisodes = sortedEpisodes.slice(startIdx, endIdx);

      seasons.push({
        seasonNumber: seasonNum,
        episodeCount: seasonEpisodes.length,
        episodes: seasonEpisodes.map(ep => ({
          episodeNumber: ep.episodeNumber,
          episodeUrl: ep.episodeUrl || '',
          episodeTitle: ep.episodeTitle || ''
        }))
      });
    }

    return seasons;
  };

  const handleEditTVShow = (tvShow) => {
    setEditingTVShow(tvShow);
    const numberOfSeasons = tvShow.numberOfSeasons || 1;
    const episodeCount = tvShow.episodeCount || (tvShow.episodes && tvShow.episodes.length) || 0;
    
    setTVShowFormData({
      title: tvShow.title || '',
      year: tvShow.year || new Date().getFullYear(),
      description: tvShow.description || '',
      genre: tvShow.genre || '',
      showUrl: tvShow.showUrl || '',
      imdbRating: tvShow.imdbRating || 0,
      episodeCount: episodeCount,
      numberOfSeasons: numberOfSeasons
    });
    
    // Gallery posters only — never include the detail banner
    const gallery = (tvShow.images && tvShow.images.length > 0)
      ? tvShow.images.filter((url) => url && url !== tvShow.bannerUrl)
      : (tvShow.imageUrl && tvShow.imageUrl !== tvShow.bannerUrl ? [tvShow.imageUrl] : []);
    setTVShowImagePreviews(gallery);
    setTVShowImageFiles([]);
    setTVShowBannerPreview(tvShow.bannerUrl || '');
    setTVShowBannerFile(null);
    setTVShowClearBanner(false);
    
    // Group episodes by seasons
    if (tvShow.episodes && tvShow.episodes.length > 0 && numberOfSeasons > 0) {
      const seasons = groupEpisodesBySeasons(tvShow.episodes, numberOfSeasons);
      setTVShowSeasons(seasons);
      // Also keep flat episodes array for backward compatibility
      setTVShowEpisodes(tvShow.episodes.map(ep => ({
        episodeNumber: ep.episodeNumber || 0,
        episodeUrl: ep.episodeUrl || '',
        episodeTitle: ep.episodeTitle || ''
      })));
    } else {
      setTVShowSeasons([]);
      setTVShowEpisodes([]);
    }
  };

  // Handle number of seasons change
  const handleTVShowSeasonsChange = (e) => {
    const numSeasons = parseInt(e.target.value) || 0;
    setTVShowFormData(prev => ({ ...prev, numberOfSeasons: numSeasons }));
    
    // Re-group existing episodes into new season structure
    if (numSeasons > 0 && tvShowEpisodes.length > 0) {
      const seasons = groupEpisodesBySeasons(tvShowEpisodes, numSeasons);
      setTVShowSeasons(seasons);
    } else {
      setTVShowSeasons([]);
    }
  };

  // Handle episode count change for a specific season
  const handleTVShowSeasonEpisodeCountChange = (seasonIndex, episodeCount) => {
    const count = parseInt(episodeCount) || 0;
    const updatedSeasons = [...tvShowSeasons];
    updatedSeasons[seasonIndex] = {
      ...updatedSeasons[seasonIndex],
      episodeCount: count,
      episodes: []
    };
    
    // Initialize episodes for this season
    const globalStartNumber = updatedSeasons.slice(0, seasonIndex).reduce((sum, s) => sum + s.episodeCount, 0) + 1;
    for (let i = 1; i <= count; i++) {
      const existingEp = updatedSeasons[seasonIndex].episodes.find(ep => ep.episodeNumber === globalStartNumber + i - 1);
      if (existingEp) {
        updatedSeasons[seasonIndex].episodes.push(existingEp);
      } else {
        updatedSeasons[seasonIndex].episodes.push({
          episodeNumber: globalStartNumber + i - 1,
          episodeUrl: '',
          episodeTitle: `Season ${updatedSeasons[seasonIndex].seasonNumber} Episode ${i}`
        });
      }
    }
    
    setTVShowSeasons(updatedSeasons);
    // Update flat episodes array
    const allEpisodes = updatedSeasons.flatMap(s => s.episodes).sort((a, b) => a.episodeNumber - b.episodeNumber);
    setTVShowEpisodes(allEpisodes);
  };

  // Handle episode change for a specific season and episode
  const handleTVShowSeasonEpisodeChange = (seasonIndex, episodeIndex, field, value) => {
    const updatedSeasons = [...tvShowSeasons];
    updatedSeasons[seasonIndex].episodes[episodeIndex] = {
      ...updatedSeasons[seasonIndex].episodes[episodeIndex],
      [field]: value
    };
    setTVShowSeasons(updatedSeasons);
    // Update flat episodes array
    const allEpisodes = updatedSeasons.flatMap(s => s.episodes).sort((a, b) => a.episodeNumber - b.episodeNumber);
    setTVShowEpisodes(allEpisodes);
  };

  const handleUpdateTVShow = async () => {
    // Flatten seasons back to episodes array
    const allEpisodes = tvShowSeasons.flatMap(season => season.episodes || []).sort((a, b) => a.episodeNumber - b.episodeNumber);
    const hasEpisodes = allEpisodes.length > 0 && allEpisodes.some(ep => ep.episodeUrl && ep.episodeUrl.trim() !== '');
    
    if (!tvShowFormData.title || !tvShowFormData.description || !tvShowFormData.genre) {
      showNotification('Please fill in all required fields', 'error');
      return;
    }

    if (!hasEpisodes && !tvShowFormData.showUrl) {
      showNotification('Either TV Show URL or at least one episode URL is required', 'error');
      return;
    }

    if (!editingTVShow || !editingTVShow._id) {
      showNotification('No TV show selected for editing', 'error');
      return;
    }

    try {
      // Prepare episodes data from seasons
      const episodesData = allEpisodes.filter(ep => ep.episodeUrl && ep.episodeUrl.trim() !== '');
      
      const updateData = {
        ...tvShowFormData,
        numberOfSeasons: tvShowFormData.numberOfSeasons || 1,
        episodes: episodesData.length > 0 ? episodesData : undefined,
        episodeCount: episodesData.length > 0 ? episodesData.length : tvShowFormData.episodeCount
      };
      
      // If new images are added, convert them to base64
      if (tvShowImageFiles.length > 0) {
        const base64Images = await Promise.all(
          tvShowImageFiles.map(file => convertImageToBase64(file))
        );
        updateData.imageFiles = base64Images;
      }
      
      // If images were removed (previews changed), send the updated images array
      if (tvShowImagePreviews.length > 0 && editingTVShow.images) {
        // Compare existing images with previews to detect removals
        const existingImageUrls = editingTVShow.images || (editingTVShow.imageUrl ? [editingTVShow.imageUrl] : []);
        const remainingUrls = tvShowImagePreviews.filter(preview => 
          typeof preview === 'string' && preview.startsWith('http')
        );
        if (remainingUrls.length !== existingImageUrls.length) {
          updateData.images = remainingUrls;
        }
      }

      if (tvShowClearBanner) {
        updateData.clearBanner = true;
      } else if (tvShowBannerFile) {
        updateData.bannerFile = await convertImageToBase64(tvShowBannerFile);
      }

      // Remove showUrl if episodes are provided and showUrl is empty
      if (episodesData.length > 0 && !tvShowFormData.showUrl.trim()) {
        delete updateData.showUrl;
      }
      
      console.log('Updating TV show:', editingTVShow._id, updateData);
      
      const response = await fetch(`/api/tvshows/${editingTVShow._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      console.log('Update response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        console.error('Update error data:', errorData);
        throw new Error(errorData.message || `Failed to update TV show: ${response.status}`);
      }

      const result = await response.json();
      console.log('Update result:', result);
      
      if (result.success) {
        await fetchTVShows();
        setEditingTVShow(null);
        setTVShowFormData({
          title: '',
          year: new Date().getFullYear(),
          description: '',
          genre: '',
          showUrl: '',
          imdbRating: 0,
          episodeCount: 0,
          numberOfSeasons: 0
        });
        setTVShowEpisodes([]);
        setTVShowSeasons([]);
        setTVShowImageFiles([]);
        setTVShowImagePreviews([]);
        setTVShowBannerFile(null);
        setTVShowBannerPreview('');
        setTVShowClearBanner(false);
        showNotification('TV Show updated successfully!', 'success');
      } else {
        throw new Error(result.message || 'Update failed');
      }
    } catch (err) {
      console.error('Error updating TV show:', err);
      showNotification(`Error updating TV show: ${err.message}`, 'error');
    }
  };

  const handleTVShowBannerChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showNotification('Please select a valid image file', 'error');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      showNotification('Banner image should be less than 8MB', 'error');
      return;
    }
    setTVShowBannerFile(file);
    setTVShowClearBanner(false);
    const reader = new FileReader();
    reader.onload = () => setTVShowBannerPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const clearTVShowBanner = () => {
    setTVShowBannerFile(null);
    setTVShowBannerPreview('');
    setTVShowClearBanner(true);
  };

  const handleDeleteTVShow = async (tvShowId) => {
    if (window.confirm('Are you sure you want to delete this TV show?')) {
      try {
        const response = await fetch(`/api/tvshows/${tvShowId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to delete TV show');
        }

        const result = await response.json();
        
        if (result.success) {
          await fetchTVShows();
          showNotification('TV Show deleted successfully!', 'success');
        }
      } catch (err) {
        console.error('Error deleting TV show:', err);
        showNotification(`Error deleting TV show: ${err.message}`, 'error');
      }
    }
  };

  const handleToggleTVShowStatus = async (tvShowId, status) => {
    try {
      const response = await fetch(`/api/tvshows/${tvShowId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update TV show status');
      }

      const result = await response.json();
      
      if (result.success) {
        await fetchTVShows();
        showNotification(`TV Show status updated successfully!`, 'success');
      }
    } catch (err) {
      console.error('Error updating TV show status:', err);
      showNotification(`Error updating TV show status: ${err.message}`, 'error');
    }
  };

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <h1>Admin Dashboard</h1>
        <p>Welcome back, {user?.name}!</p>
      </div>

      {/* Tab Navigation */}
      <div className="dashboard-tabs">
        <button
          className={`tab-button ${activeTab === 'admins' ? 'active' : ''}`}
          onClick={() => setActiveTab('admins')}
        >
          Administration
        </button>
        <button
          className={`tab-button ${activeTab === 'movies' ? 'active' : ''}`}
          onClick={() => setActiveTab('movies')}
        >
          Movie Management
        </button>
        <button 
          className={`tab-button ${activeTab === 'tvshows' ? 'active' : ''}`}
          onClick={() => setActiveTab('tvshows')}
        >
          TV Show Management
        </button>
        <button
          className={`tab-button ${activeTab === 'banners' ? 'active' : ''}`}
          onClick={() => setActiveTab('banners')}
        >
          Home Banner
        </button>
        <button
          className={`tab-button ${activeTab === 'collections' ? 'active' : ''}`}
          onClick={() => setActiveTab('collections')}
        >
          Collections
        </button>
        <button 
          className={`tab-button ${activeTab === 'contacts' ? 'active' : ''}`}
          onClick={() => setActiveTab('contacts')}
        >
          Contact Management
        </button>
      </div>

      {/* Statistics Cards */}
      {activeTab !== 'banners' && activeTab !== 'admins' && activeTab !== 'contacts' && activeTab !== 'collections' && (
      <div className="dashboard-stats">
        {activeTab === 'tvshows' ? (
          <>
            <div className="stat-card">
              <h3>{tvShowStats.totalTVShows}</h3>
              <p>Total TV Shows</p>
            </div>
            <div className="stat-card">
              <h3>{tvShowStats.activeTVShows}</h3>
              <p>Active TV Shows</p>
            </div>
            <div className="stat-card">
              <h3>{tvShowStats.averageRating}</h3>
              <p>Avg Rating</p>
            </div>
            <div className="stat-card">
              <h3>{tvShowStats.newTVShowsThisMonth}</h3>
              <p>New This Month</p>
            </div>
          </>
        ) : (
          <>
            <div className="stat-card">
              <h3>{movieStats.totalMovies}</h3>
              <p>Total Movies</p>
            </div>
            <div className="stat-card">
              <h3>{movieStats.activeMovies}</h3>
              <p>Active Movies</p>
            </div>
            <div className="stat-card">
              <h3>{movieStats.averageRating}</h3>
              <p>Avg Rating</p>
            </div>
            <div className="stat-card">
              <h3>{movieStats.newMoviesThisMonth}</h3>
              <p>New This Month</p>
            </div>
          </>
        )}
      </div>
      )}

      {/* Movie Management Section */}
      {activeTab === 'movies' && (
        <div className="card">
          <div className="dashboard-header">
            <h2>Movie Management</h2>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                className="btn btn-primary"
                onClick={() => navigate('/add-movie')}
              >
                Add New Movie
              </button>
            </div>
          </div>

          <div className="search-bar">
            <input
              type="text"
              placeholder="Search movies by title, year, or genre..."
              value={movieSearchTerm}
              onChange={(e) => setMovieSearchTerm(e.target.value)}
            />
          </div>

          <div className="user-actions">
            <button 
              className="btn btn-secondary"
              onClick={() => setMovieSearchTerm('')}
            >
              Clear Search
            </button>
            <button 
              className="btn btn-secondary"
              onClick={fetchMovies}
            >
              Refresh
            </button>
          </div>

          {moviesLoading ? (
            <div className="loading-state">
              <h3>Loading movies...</h3>
              <p>Please wait while we fetch the latest movie data.</p>
            </div>
          ) : moviesError ? (
            <div className="error-state">
              <h3>Error loading movies</h3>
              <p>{moviesError}</p>
              <button 
                className="btn btn-primary"
                onClick={fetchMovies}
              >
                Try Again
              </button>
            </div>
          ) : filteredMovies.length === 0 ? (
            <div className="empty-state">
              <h3>No movies found</h3>
              <p>{movieSearchTerm ? 'Try adjusting your search terms.' : 'No movies have been added yet.'}</p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Title</th>
                  <th>Year</th>
                  <th>Genre</th>
                  <th>IMDB Rating</th>
                  <th>User Rating</th>
                  <th>Status</th>
                  <th>Added By</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovies.map(movie => (
                  <tr key={movie._id} data-movie-id={movie._id}>
                    <td>
                      {movie.images && movie.images.length > 0 ? (
                        <img 
                          src={movie.images[0]} 
                          alt={movie.title}
                          className="movie-thumbnail"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="150"%3E%3Crect width="100" height="150" fill="%231a1a1a"/%3E%3Ctext x="50" y="75" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle"%3E🎬%3C/text%3E%3C/svg%3E';
                          }}
                        />
                      ) : movie.imageUrl ? (
                        <img 
                          src={movie.imageUrl} 
                          alt={movie.title}
                          className="movie-thumbnail"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="150"%3E%3Crect width="100" height="150" fill="%231a1a1a"/%3E%3Ctext x="50" y="75" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle"%3E🎬%3C/text%3E%3C/svg%3E';
                          }}
                        />
                      ) : (
                        <div style={{ width: '80px', height: '120px', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '24px' }}>
                          🎬
                        </div>
                      )}
                    </td>
                    <td>
                      <div>
                        <strong>{movie.title}</strong>
                        <br />
                        <small style={{ color: '#6c757d' }}>
                          {movie.description.length > 50 
                            ? movie.description.substring(0, 50) + '...' 
                            : movie.description
                          }
                        </small>
                      </div>
                    </td>
                    <td>{movie.year}</td>
                    <td>
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '4px', 
                        backgroundColor: '#17a2b8',
                        color: 'white',
                        fontSize: '12px'
                      }}>
                        {movie.genre}
                      </span>
                    </td>
                    <td>
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '4px', 
                        backgroundColor: movie.imdbRating >= 7 ? '#28a745' : movie.imdbRating >= 5 ? '#ffc107' : '#dc3545',
                        color: 'white',
                        fontSize: '12px'
                      }}>
                        {movie.imdbRating}/10
                      </span>
                    </td>
                    <td>
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '4px', 
                        backgroundColor: movie.averageRating >= 7 ? '#28a745' : movie.averageRating >= 5 ? '#ffc107' : '#dc3545',
                        color: 'white',
                        fontSize: '12px'
                      }}>
                        {movie.averageRating ? movie.averageRating.toFixed(1) : '0.0'}/10
                      </span>
                      <br />
                      <small style={{ fontSize: '10px', color: '#6c757d' }}>
                        ({movie.totalRatings || 0} ratings)
                      </small>
                    </td>
                    <td>
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '4px', 
                        backgroundColor:
                          movie.status === 'active'
                            ? '#28a745'
                            : movie.status === 'coming_soon'
                              ? '#e50914'
                              : '#6c757d',
                        color: 'white',
                        fontSize: '12px'
                      }}>
                        {movie.status === 'coming_soon' ? 'coming soon' : movie.status}
                      </span>
                    </td>
                    <td>{movie.addedBy?.name || 'Unknown'}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-table"
                          onClick={() => handleEditMovie(movie)}
                        >
                          Edit
                        </button>
                        <select
                          className={`status-select status-select--${movie.status || 'active'}`}
                          value={movie.status || 'active'}
                          onChange={(e) => handleToggleMovieStatus(movie._id, e.target.value)}
                          aria-label={`Status for ${movie.title}`}
                        >
                          <option value="active">Active</option>
                          <option value="coming_soon">Coming Soon</option>
                          <option value="inactive">Inactive</option>
                        </select>
                        <button
                          type="button"
                          className="btn btn-secondary btn-table"
                          onClick={() => handleDeleteMovie(movie._id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* TV Show Management Section */}
      {activeTab === 'tvshows' && (
        <div className="card">
          <div className="dashboard-header">
            <h2>TV Show Management</h2>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                className="btn btn-primary"
                onClick={() => navigate('/add-tvshow')}
              >
                Add New TV Show
              </button>
            </div>
          </div>

          <div className="search-bar">
            <input
              type="text"
              placeholder="Search TV shows by title, year, or genre..."
              value={tvShowSearchTerm}
              onChange={(e) => setTVShowSearchTerm(e.target.value)}
            />
          </div>

          <div className="user-actions">
            <button 
              className="btn btn-secondary"
              onClick={() => setTVShowSearchTerm('')}
            >
              Clear Search
            </button>
            <button 
              className="btn btn-secondary"
              onClick={fetchTVShows}
            >
              Refresh
            </button>
          </div>

          {tvShowsLoading ? (
            <div className="loading-state">
              <h3>Loading TV shows...</h3>
              <p>Please wait while we fetch the latest TV show data.</p>
            </div>
          ) : tvShowsError ? (
            <div className="error-state">
              <h3>Error loading TV shows</h3>
              <p>{tvShowsError}</p>
              <button 
                className="btn btn-primary"
                onClick={fetchTVShows}
              >
                Try Again
              </button>
            </div>
          ) : filteredTVShows.length === 0 ? (
            <div className="empty-state">
              <h3>No TV shows found</h3>
              <p>{tvShowSearchTerm ? 'Try adjusting your search terms.' : 'No TV shows have been added yet.'}</p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Title</th>
                  <th>Year</th>
                  <th>Genre</th>
                  <th>IMDB Rating</th>
                  <th>Status</th>
                  <th>Added By</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTVShows.map(tvShow => (
                  <tr key={tvShow._id}>
                    <td>
                      {tvShow.images && tvShow.images.length > 0 ? (
                        <img 
                          src={tvShow.images[0]} 
                          alt={tvShow.title}
                          className="movie-thumbnail"
                          style={{ width: '80px', height: '120px', objectFit: 'cover' }}
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="150"%3E%3Crect width="100" height="150" fill="%231a1a1a"/%3E%3Ctext x="50" y="75" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle"%3E📺%3C/text%3E%3C/svg%3E';
                          }}
                        />
                      ) : tvShow.imageUrl ? (
                        <img 
                          src={tvShow.imageUrl} 
                          alt={tvShow.title}
                          className="movie-thumbnail"
                          style={{ width: '80px', height: '120px', objectFit: 'cover' }}
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="150"%3E%3Crect width="100" height="150" fill="%231a1a1a"/%3E%3Ctext x="50" y="75" font-size="24" fill="white" text-anchor="middle" dominant-baseline="middle"%3E📺%3C/text%3E%3C/svg%3E';
                          }}
                        />
                      ) : (
                        <div style={{ width: '80px', height: '120px', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '24px' }}>
                          📺
                        </div>
                      )}
                    </td>
                    <td>
                      <div>
                        <strong>{tvShow.title}</strong>
                        <br />
                        <small style={{ color: '#6c757d' }}>
                          {tvShow.description.length > 50 
                            ? tvShow.description.substring(0, 50) + '...' 
                            : tvShow.description
                          }
                        </small>
                      </div>
                    </td>
                    <td>{tvShow.year}</td>
                    <td>
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '4px', 
                        backgroundColor: '#17a2b8',
                        color: 'white',
                        fontSize: '12px'
                      }}>
                        {tvShow.genre}
                      </span>
                    </td>
                    <td>
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '4px', 
                        backgroundColor: tvShow.imdbRating >= 7 ? '#28a745' : tvShow.imdbRating >= 5 ? '#ffc107' : '#dc3545',
                        color: 'white',
                        fontSize: '12px'
                      }}>
                        {tvShow.imdbRating}/10
                      </span>
                    </td>
                    <td>
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '4px', 
                        backgroundColor:
                          tvShow.status === 'active'
                            ? '#28a745'
                            : tvShow.status === 'coming_soon'
                              ? '#e50914'
                              : '#6c757d',
                        color: 'white',
                        fontSize: '12px'
                      }}>
                        {tvShow.status === 'coming_soon' ? 'coming soon' : tvShow.status}
                      </span>
                    </td>
                    <td>{tvShow.addedBy?.name || 'Unknown'}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-table"
                          onClick={() => handleEditTVShow(tvShow)}
                        >
                          Edit
                        </button>
                        <select
                          className={`status-select status-select--${tvShow.status || 'active'}`}
                          value={tvShow.status || 'active'}
                          onChange={(e) => handleToggleTVShowStatus(tvShow._id, e.target.value)}
                          aria-label={`Status for ${tvShow.title}`}
                        >
                          <option value="active">Active</option>
                          <option value="coming_soon">Coming Soon</option>
                          <option value="inactive">Inactive</option>
                        </select>
                        <button
                          type="button"
                          className="btn btn-secondary btn-table"
                          onClick={() => handleDeleteTVShow(tvShow._id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Edit Movie Modal */}
      {editingMovie && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Edit Movie</h3>
              <button 
                className="close-btn"
                onClick={() => setEditingMovie(null)}
              >
                ×
              </button>
            </div>
            <div className="form-group">
              <label>Title</label>
              <input
                type="text"
                value={movieFormData.title}
                onChange={(e) => setMovieFormData({...movieFormData, title: e.target.value})}
                placeholder="Enter movie title"
              />
            </div>
            <div className="form-group">
              <label>Year</label>
              <input
                type="number"
                value={movieFormData.year || ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? new Date().getFullYear() : parseInt(e.target.value) || new Date().getFullYear();
                  setMovieFormData({...movieFormData, year: val});
                }}
                min="1900"
                max={new Date().getFullYear() + 5}
              />
            </div>
            <div className="form-group">
              <label>Genre</label>
              <select
                value={movieFormData.genre}
                onChange={(e) => setMovieFormData({...movieFormData, genre: e.target.value})}
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}
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
              <label>Movie URL</label>
              <input
                type="url"
                value={movieFormData.movieUrl}
                onChange={(e) => setMovieFormData({...movieFormData, movieUrl: e.target.value})}
                placeholder="https://example.com/movie"
              />
            </div>
            <div className="form-group">
              <label>IMDB Rating (0-10)</label>
              <input
                type="number"
                value={movieFormData.imdbRating !== undefined && movieFormData.imdbRating !== null && movieFormData.imdbRating !== '' 
                  ? movieFormData.imdbRating 
                  : ''}
                onChange={(e) => {
                  const inputVal = e.target.value;
                  // Allow empty temporarily while typing, but parse valid numbers immediately
                  if (inputVal === '') {
                    setMovieFormData({...movieFormData, imdbRating: ''});
                  } else {
                    const numVal = parseFloat(inputVal);
                    // Only update if it's a valid number in range
                    if (!isNaN(numVal) && numVal >= 0 && numVal <= 10) {
                      setMovieFormData({...movieFormData, imdbRating: numVal});
                    }
                  }
                }}
                onBlur={(e) => {
                  // On blur, ensure we have a valid number
                  const inputVal = e.target.value;
                  if (inputVal === '' || isNaN(parseFloat(inputVal))) {
                    // Reset to existing value if empty/invalid
                    setMovieFormData({...movieFormData, imdbRating: editingMovie?.imdbRating || 0});
                  } else {
                    const numVal = parseFloat(inputVal);
                    if (!isNaN(numVal) && numVal >= 0 && numVal <= 10) {
                      setMovieFormData({...movieFormData, imdbRating: numVal});
                    } else {
                      // Invalid range, reset to existing
                      setMovieFormData({...movieFormData, imdbRating: editingMovie?.imdbRating || 0});
                    }
                  }
                }}
                min="0"
                max="10"
                step="0.1"
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                value={movieFormData.description}
                onChange={(e) => setMovieFormData({...movieFormData, description: e.target.value})}
                placeholder="Enter movie description..."
                rows="4"
              />
            </div>
            <div className="form-group">
              <label>Detail Page Banner (wide image)</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleMovieBannerChange}
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}
              />
              <small>Shown as the backdrop on the movie page. Not added to the poster gallery.</small>
              {movieBannerPreview && !movieClearBanner && (
                <div style={{ marginTop: '10px', position: 'relative', maxWidth: '420px' }}>
                  <img
                    src={movieBannerPreview}
                    alt="Detail banner preview"
                    style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #444' }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ marginTop: '8px', padding: '5px 10px', fontSize: '12px' }}
                    onClick={clearMovieBanner}
                  >
                    Remove Banner
                  </button>
                </div>
              )}
            </div>
            <div className="form-group">
              <label>Add More Images (Optional)</label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleMovieImageChange}
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}
              />
              <small>Select one or more poster images to add to the movie. Max 5MB per image.</small>
            </div>
            {movieImagePreviews.length > 0 && (
              <div className="form-group">
                <label>Current Images ({movieImagePreviews.length})</label>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', 
                  gap: '10px',
                  marginTop: '10px'
                }}>
                  {movieImagePreviews.map((preview, index) => (
                    <div key={index} style={{ position: 'relative' }}>
                      <img 
                        src={preview} 
                        alt={`Preview ${index + 1}`} 
                        style={{ 
                          width: '100%', 
                          height: '150px', 
                          objectFit: 'cover',
                          borderRadius: '5px',
                          border: '2px solid #ddd'
                        }} 
                      />
                      <button
                        type="button"
                        onClick={() => removeMovieImage(index)}
                        style={{
                          position: 'absolute',
                          top: '5px',
                          right: '5px',
                          background: 'red',
                          color: 'white',
                          border: 'none',
                          borderRadius: '50%',
                          width: '20px',
                          height: '20px',
                          cursor: 'pointer',
                          fontSize: '14px',
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
                className="btn btn-primary"
                onClick={handleUpdateMovie}
              >
                Update Movie
              </button>
              <button 
                className="btn btn-secondary"
                onClick={() => {
                  setEditingMovie(null);
                  setMovieImageFiles([]);
                  setMovieImagePreviews([]);
                  setMovieBannerFile(null);
                  setMovieBannerPreview('');
                  setMovieClearBanner(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit TV Show Modal */}
      {editingTVShow && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Edit TV Show</h3>
              <button 
                className="close-btn"
                onClick={() => setEditingTVShow(null)}
              >
                ×
              </button>
            </div>
            <div className="form-group">
              <label>Title</label>
              <input
                type="text"
                value={tvShowFormData.title}
                onChange={(e) => setTVShowFormData({...tvShowFormData, title: e.target.value})}
                placeholder="Enter TV show title"
              />
            </div>
            <div className="form-group">
              <label>Year</label>
              <input
                type="number"
                value={tvShowFormData.year || ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? new Date().getFullYear() : parseInt(e.target.value) || new Date().getFullYear();
                  setTVShowFormData({...tvShowFormData, year: val});
                }}
                min="1900"
                max={new Date().getFullYear() + 5}
              />
            </div>
            <div className="form-group">
              <label>Genre</label>
              <select
                value={tvShowFormData.genre}
                onChange={(e) => setTVShowFormData({...tvShowFormData, genre: e.target.value})}
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}
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
              <label>Number of Seasons</label>
              <input
                type="number"
                value={tvShowFormData.numberOfSeasons || ''}
                onChange={handleTVShowSeasonsChange}
                min="0"
                placeholder="Enter number of seasons"
              />
              <small>Enter the number of seasons this TV show has.</small>
            </div>

            {tvShowSeasons.length > 0 && (
              <div className="form-group">
                <label>Seasons and Episodes</label>
                <div style={{ marginTop: '10px', maxHeight: '400px', overflowY: 'auto' }}>
                  {tvShowSeasons.map((season, seasonIndex) => (
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
                        <h4 style={{ margin: 0, color: '#007bff' }}>Season {season.seasonNumber}</h4>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '14px', marginRight: '10px' }}>
                            Episodes:
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={season.episodeCount || ''}
                            onChange={(e) => handleTVShowSeasonEpisodeCountChange(seasonIndex, e.target.value)}
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
                                onChange={(e) => handleTVShowSeasonEpisodeChange(seasonIndex, episodeIndex, 'episodeTitle', e.target.value)}
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
                                onChange={(e) => handleTVShowSeasonEpisodeChange(seasonIndex, episodeIndex, 'episodeUrl', e.target.value)}
                                style={{ 
                                  width: '100%', 
                                  padding: '8px', 
                                  border: '1px solid #ccc', 
                                  borderRadius: '4px' 
                                }}
                              />
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
              <label>
                TV Show URL (Watch) {tvShowSeasons.length === 0 ? '*' : '(Optional - use if no episodes)'}
              </label>
              <input
                type="url"
                value={tvShowFormData.showUrl || ''}
                onChange={(e) => setTVShowFormData({...tvShowFormData, showUrl: e.target.value})}
                placeholder="https://example.com/tvshow"
              />
              <small>
                {tvShowSeasons.length === 0 
                  ? 'URL where users can watch the TV show'
                  : 'Single URL for the TV show (if not using individual episode URLs above)'}
              </small>
            </div>
            <div className="form-group">
              <label>IMDB Rating (0-10)</label>
              <input
                type="number"
                value={tvShowFormData.imdbRating || ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                  setTVShowFormData({...tvShowFormData, imdbRating: val});
                }}
                min="0"
                max="10"
                step="0.1"
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                value={tvShowFormData.description}
                onChange={(e) => setTVShowFormData({...tvShowFormData, description: e.target.value})}
                placeholder="Enter TV show description..."
                rows="4"
              />
            </div>
            <div className="form-group">
              <label>Detail Page Banner (wide image)</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleTVShowBannerChange}
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}
              />
              <small>Shown as the backdrop on the TV show page. Not added to the poster gallery.</small>
              {tvShowBannerPreview && !tvShowClearBanner && (
                <div style={{ marginTop: '10px', position: 'relative', maxWidth: '420px' }}>
                  <img
                    src={tvShowBannerPreview}
                    alt="Detail banner preview"
                    style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #444' }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ marginTop: '8px', padding: '5px 10px', fontSize: '12px' }}
                    onClick={clearTVShowBanner}
                  >
                    Remove Banner
                  </button>
                </div>
              )}
            </div>
            <div className="form-group">
              <label>Add More Images (Optional)</label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length === 0) return;

                  const validFiles = [];
                  const newPreviews = [];

                  files.forEach((file) => {
                    if (!file.type.startsWith('image/')) {
                      showNotification(`File ${file.name} is not a valid image file`, 'error');
                      return;
                    }
                    
                    if (file.size > 5 * 1024 * 1024) {
                      showNotification(`Image ${file.name} size should be less than 5MB`, 'error');
                      return;
                    }

                    validFiles.push(file);

                    const reader = new FileReader();
                    reader.onload = () => {
                      newPreviews.push(reader.result);
                      if (newPreviews.length === validFiles.length) {
                        setTVShowImagePreviews(prev => [...prev, ...newPreviews]);
                      }
                    };
                    reader.readAsDataURL(file);
                  });

                  if (validFiles.length > 0) {
                    setTVShowImageFiles(prev => [...prev, ...validFiles]);
                  }
                }}
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}
              />
              <small>Select one or more poster images to add to the TV show. Max 5MB per image.</small>
            </div>
            {tvShowImagePreviews.length > 0 && (
              <div className="form-group">
                <label>Current Images ({tvShowImagePreviews.length})</label>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', 
                  gap: '10px',
                  marginTop: '10px'
                }}>
                  {tvShowImagePreviews.map((preview, index) => (
                    <div key={index} style={{ position: 'relative' }}>
                      <img 
                        src={preview} 
                        alt={`Preview ${index + 1}`} 
                        style={{ 
                          width: '100%', 
                          height: '150px', 
                          objectFit: 'cover',
                          borderRadius: '5px',
                          border: '2px solid #ddd'
                        }} 
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setTVShowImagePreviews(prev => prev.filter((_, i) => i !== index));
                          // If it's a newly added file, remove from files array too
                          const existingCount = editingTVShow?.images?.length || (editingTVShow?.imageUrl ? 1 : 0);
                          if (index >= existingCount) {
                            const fileIndex = index - existingCount;
                            setTVShowImageFiles(prev => prev.filter((_, i) => i !== fileIndex));
                          }
                        }}
                        style={{
                          position: 'absolute',
                          top: '5px',
                          right: '5px',
                          background: 'red',
                          color: 'white',
                          border: 'none',
                          borderRadius: '50%',
                          width: '20px',
                          height: '20px',
                          cursor: 'pointer',
                          fontSize: '14px',
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
                className="btn btn-primary"
                onClick={handleUpdateTVShow}
              >
                Update TV Show
              </button>
              <button 
                className="btn btn-secondary"
                onClick={() => {
                  setEditingTVShow(null);
                  setTVShowImageFiles([]);
                  setTVShowImagePreviews([]);
                  setTVShowBannerFile(null);
                  setTVShowBannerPreview('');
                  setTVShowClearBanner(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Management Section */}
      {activeTab === 'admins' && (
        <AdminManagement token={token} />
      )}

      {/* Home Page Banner Section */}
      {activeTab === 'banners' && (
        <BannerManagement
          token={token}
          showNotification={showNotification}
        />
      )}

      {/* Collections Section */}
      {activeTab === 'collections' && (
        <CollectionManagement
          token={token}
          showNotification={showNotification}
        />
      )}

      {/* Contact Management Section */}
      {activeTab === 'contacts' && (
        <ContactManagement />
      )}
    </div>
  );
};

export default AdminDashboard; 