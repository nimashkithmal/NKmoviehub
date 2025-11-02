import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import ContactManagement from './ContactManagement';

const AdminDashboard = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [movies, setMovies] = useState([]);
  const [tvShows, setTVShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [moviesLoading, setMoviesLoading] = useState(false);
  const [tvShowsLoading, setTVShowsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [moviesError, setMoviesError] = useState(null);
  const [tvShowsError, setTVShowsError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [movieSearchTerm, setMovieSearchTerm] = useState('');
  const [tvShowSearchTerm, setTVShowSearchTerm] = useState('');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editingMovie, setEditingMovie] = useState(null);
  const [editingTVShow, setEditingTVShow] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user'
  });
  const [movieFormData, setMovieFormData] = useState({
    title: '',
    year: new Date().getFullYear(),
    description: '',
    genre: '',
    movieUrl: '',
    imdbRating: 0
  });
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
  const [tvShowEpisodes, setTVShowEpisodes] = useState([]);
  const [tvShowSeasons, setTVShowSeasons] = useState([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    adminUsers: 0,
    newUsersThisMonth: 0
  });
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
  const [activeTab, setActiveTab] = useState('users'); // 'users', 'movies', 'tvshows', or 'contacts'

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

  // Fetch users from backend
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('http://localhost:5001/api/users', {
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
        setUsers(result.data.users);
        
        // Calculate stats
        const totalUsers = result.data.users.length;
        const activeUsers = result.data.users.filter(u => u.status === 'active').length;
        const adminUsers = result.data.users.filter(u => u.role === 'admin').length;
        const newUsersThisMonth = result.data.users.filter(u => {
          const userDate = new Date(u.createdAt);
          const now = new Date();
          return userDate.getMonth() === now.getMonth() && userDate.getFullYear() === now.getFullYear();
        }).length;

        setStats({
          totalUsers,
          activeUsers,
          adminUsers,
          newUsersThisMonth
        });
      } else {
        throw new Error(result.message || 'Failed to fetch users');
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Fetch movies from backend
  const fetchMovies = useCallback(async () => {
    try {
      setMoviesLoading(true);
      setMoviesError(null);
      
      const response = await fetch('http://localhost:5001/api/movies/admin?limit=1000', {
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
      
      const response = await fetch('http://localhost:5001/api/tvshows/admin?limit=1000', {
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
      fetchUsers();
      fetchMovies();
      fetchTVShows();
    }
  }, [token, fetchUsers, fetchMovies, fetchTVShows]);

  const handleAddUser = async () => {
    if (!formData.name || !formData.email || !formData.password) {
      showNotification('Please fill in all fields', 'error');
      return;
    }

    try {
      const response = await fetch('http://localhost:5001/api/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create user');
      }

      const result = await response.json();
      
      if (result.success) {
        // Refresh users list
        await fetchUsers();
        setFormData({ name: '', email: '', password: '', role: 'user' });
        setShowAddUserModal(false);
        showNotification('User created successfully!', 'success');
      }
    } catch (err) {
      console.error('Error creating user:', err);
      showNotification(`Error creating user: ${err.message}`, 'error');
    }
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role
    });
  };

  const handleUpdateUser = async () => {
    if (!formData.name || !formData.email) {
      showNotification('Please fill in all fields', 'error');
      return;
    }

    try {
      const updateData = {
        name: formData.name,
        email: formData.email,
        role: formData.role
      };

      const response = await fetch(`http://localhost:5001/api/users/${editingUser._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update user');
      }

      const result = await response.json();
      
      if (result.success) {
        // Refresh users list
        await fetchUsers();
        setEditingUser(null);
        setFormData({ name: '', email: '', password: '', role: 'user' });
        showNotification('User updated successfully!', 'success');
      }
    } catch (err) {
      console.error('Error updating user:', err);
      showNotification(`Error updating user: ${err.message}`, 'error');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      try {
        const response = await fetch(`http://localhost:5001/api/users/${userId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to delete user');
        }

        const result = await response.json();
        
        if (result.success) {
          // Refresh users list
          await fetchUsers();
          showNotification('User deleted successfully!', 'success');
        }
      } catch (err) {
        console.error('Error deleting user:', err);
        showNotification(`Error deleting user: ${err.message}`, 'error');
      }
    }
  };

  const handleToggleUserStatus = async (userId) => {
    try {
      const response = await fetch(`http://localhost:5001/api/users/${userId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update user status');
      }

      const result = await response.json();
      
      if (result.success) {
        // Refresh users list
        await fetchUsers();
        showNotification(`User status updated successfully!`, 'success');
      }
    } catch (err) {
      console.error('Error updating user status:', err);
      showNotification(`Error updating user status: ${err.message}`, 'error');
    }
  };

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
  };

  const handleUpdateMovie = async () => {
    if (!movieFormData.title || !movieFormData.description || !movieFormData.genre || !movieFormData.movieUrl) {
      showNotification('Please fill in all required fields', 'error');
      return;
    }

    try {
      const response = await fetch(`http://localhost:5001/api/movies/${editingMovie._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(movieFormData)
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
        showNotification('Movie updated successfully!', 'success');
      }
    } catch (err) {
      console.error('Error updating movie:', err);
      showNotification(`Error updating movie: ${err.message}`, 'error');
    }
  };

  const handleDeleteMovie = async (movieId) => {
    if (window.confirm('Are you sure you want to delete this movie?')) {
      try {
        const response = await fetch(`http://localhost:5001/api/movies/${movieId}`, {
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

  const handleToggleMovieStatus = async (movieId) => {
    try {
      const response = await fetch(`http://localhost:5001/api/movies/${movieId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
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

  const handleUpdateAdminFields = async (movieId, imdbRating, imageFile) => {
    try {
      const updateData = {};
      if (imdbRating !== null && imdbRating !== undefined) updateData.imdbRating = imdbRating;
      if (imageFile !== null && imageFile !== undefined) updateData.imageFile = imageFile;
      
      console.log('Sending update data:', {
        movieId,
        hasImdbRating: imdbRating !== null && imdbRating !== undefined,
        hasImageFile: imageFile !== null && imageFile !== undefined,
        imageFileLength: imageFile ? imageFile.length : 0
      });

      const response = await fetch(`http://localhost:5001/api/movies/${movieId}/update-admin-fields`, {
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
        if (!imageFile) {
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
    
    input.onchange = async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      // Validate file type
      if (!file.type.startsWith('image/')) {
        showNotification('Please select a valid image file', 'error');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        showNotification('Image size should be less than 5MB', 'error');
        return;
      }

      try {
        // Show loading state
        const updateBtn = document.querySelector(`[data-movie-id="${movieId}"] .update-image-btn`);
        if (updateBtn) {
          updateBtn.textContent = '🔄 Uploading...';
          updateBtn.disabled = true;
        }

        // Convert to base64
        const base64Image = await convertImageToBase64(file);
        console.log('Base64 image created, length:', base64Image.length);
        console.log('Base64 starts with data:image/:', base64Image.startsWith('data:image/'));
        
        // Update the movie image
        console.log('Calling handleUpdateAdminFields with image...');
        const result = await handleUpdateAdminFields(movieId, undefined, base64Image);
        console.log('Result from handleUpdateAdminFields:', result);
        
        if (result && result.success) {
          // Refresh the movies list to show the updated image
          console.log('Image update successful, refreshing movies list...');
          await fetchMovies();
          showNotification('Image updated successfully!', 'success');
        } else {
          const errorMsg = result?.message || 'Failed to update image. Please try again.';
          console.error('Image update failed:', errorMsg);
          showNotification(`Failed to update image: ${errorMsg}`, 'error');
        }
      } catch (error) {
        console.error('Error processing image:', error);
        showNotification('Failed to process image. Please try again.', 'error');
      } finally {
        // Reset button state
        const updateBtn = document.querySelector(`[data-movie-id="${movieId}"] .update-image-btn`);
        if (updateBtn) {
          updateBtn.textContent = '📷 Update';
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

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

      // Remove showUrl if episodes are provided and showUrl is empty
      if (episodesData.length > 0 && !tvShowFormData.showUrl.trim()) {
        delete updateData.showUrl;
      }
      
      console.log('Updating TV show:', editingTVShow._id, updateData);
      
      const response = await fetch(`http://localhost:5001/api/tvshows/${editingTVShow._id}`, {
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
        showNotification('TV Show updated successfully!', 'success');
      } else {
        throw new Error(result.message || 'Update failed');
      }
    } catch (err) {
      console.error('Error updating TV show:', err);
      showNotification(`Error updating TV show: ${err.message}`, 'error');
    }
  };

  const handleDeleteTVShow = async (tvShowId) => {
    if (window.confirm('Are you sure you want to delete this TV show?')) {
      try {
        const response = await fetch(`http://localhost:5001/api/tvshows/${tvShowId}`, {
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

  const handleToggleTVShowStatus = async (tvShowId) => {
    try {
      const response = await fetch(`http://localhost:5001/api/tvshows/${tvShowId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
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

  if (loading) {
    return (
      <div className="card">
        <div className="loading-state">
          <h3>Loading users...</h3>
          <p>Please wait while we fetch the latest user data.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="error-state">
          <h3>Error loading users</h3>
          <p>{error}</p>
          <button 
            className="btn btn-primary"
            onClick={fetchUsers}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="dashboard-header">
        <h1>Admin Dashboard</h1>
        <p>Welcome back, {user?.name}!</p>
      </div>

      {/* Tab Navigation */}
      <div className="dashboard-tabs">
        <button 
          className={`tab-button ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          User Management
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
          className={`tab-button ${activeTab === 'contacts' ? 'active' : ''}`}
          onClick={() => setActiveTab('contacts')}
        >
          Contact Management
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="dashboard-stats">
        {activeTab === 'users' ? (
          <>
            <div className="stat-card">
              <h3>{stats.totalUsers}</h3>
              <p>Total Users</p>
            </div>
            <div className="stat-card">
              <h3>{stats.activeUsers}</h3>
              <p>Active Users</p>
            </div>
            <div className="stat-card">
              <h3>{stats.adminUsers}</h3>
              <p>Admin Users</p>
            </div>
            <div className="stat-card">
              <h3>{stats.newUsersThisMonth}</h3>
              <p>New This Month</p>
            </div>
          </>
        ) : activeTab === 'tvshows' ? (
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

      {/* User Management Section */}
      {activeTab === 'users' && (
        <div className="card">
          <div className="dashboard-header">
            <h2>User Management</h2>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                className="btn btn-primary"
                onClick={() => setShowAddUserModal(true)}
              >
                Add New User
              </button>
            </div>
          </div>

          <div className="search-bar">
            <input
              type="text"
              placeholder="Search users by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="user-actions">
            <button 
              className="btn btn-secondary"
              onClick={() => setSearchTerm('')}
            >
              Clear Search
            </button>
            <button 
              className="btn btn-secondary"
              onClick={fetchUsers}
            >
              Refresh
            </button>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="empty-state">
              <h3>No users found</h3>
              <p>{searchTerm ? 'Try adjusting your search terms.' : 'No users have been registered yet.'}</p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => (
                  <tr key={user._id}>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '4px', 
                        backgroundColor: user.role === 'admin' ? '#dc3545' : '#28a745',
                        color: 'white',
                        fontSize: '12px'
                      }}>
                        {user.role}
                      </span>
                    </td>
                    <td>
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '4px', 
                        backgroundColor: user.status === 'active' ? '#28a745' : '#6c757d',
                        color: 'white',
                        fontSize: '12px'
                      }}>
                        {user.status}
                      </span>
                    </td>
                    <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button 
                          className="btn btn-secondary"
                          style={{ padding: '5px 10px', fontSize: '12px' }}
                          onClick={() => handleEditUser(user)}
                        >
                          Edit
                        </button>
                        <button 
                          className="btn btn-secondary"
                          style={{ padding: '5px 10px', fontSize: '12px' }}
                          onClick={() => handleToggleUserStatus(user._id)}
                        >
                          {user.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button 
                          className="btn btn-secondary"
                          style={{ padding: '5px 10px', fontSize: '12px' }}
                          onClick={() => handleDeleteUser(user._id)}
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
                      <div className="movie-image-update">
                        <img 
                          src={movie.imageUrl} 
                          alt={movie.title}
                          className="movie-thumbnail"
                        />
                        <button 
                          className="update-image-btn"
                          data-movie-id={movie._id}
                          onClick={() => handleImageUpdate(movie._id)}
                        >
                          📷 Update
                        </button>
                      </div>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ 
                          padding: '4px 8px', 
                          borderRadius: '4px', 
                          backgroundColor: movie.imdbRating >= 7 ? '#28a745' : movie.imdbRating >= 5 ? '#ffc107' : '#dc3545',
                          color: 'white',
                          fontSize: '12px'
                        }}>
                          {movie.imdbRating}/10
                        </span>
                        <button 
                          className="btn btn-secondary"
                          style={{ padding: '2px 6px', fontSize: '10px' }}
                          onClick={() => {
                            const newRating = prompt('Enter new IMDB rating (0-10):', movie.imdbRating);
                            if (newRating !== null && !isNaN(newRating) && newRating >= 0 && newRating <= 10) {
                              handleUpdateAdminFields(movie._id, parseFloat(newRating));
                            }
                          }}
                        >
                          Edit
                        </button>
                      </div>
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
                        backgroundColor: movie.status === 'active' ? '#28a745' : '#6c757d',
                        color: 'white',
                        fontSize: '12px'
                      }}>
                        {movie.status}
                      </span>
                    </td>
                    <td>{movie.addedBy?.name || 'Unknown'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button 
                          className="btn btn-secondary"
                          style={{ padding: '5px 10px', fontSize: '12px' }}
                          onClick={() => handleEditMovie(movie)}
                        >
                          Edit
                        </button>
                        <button 
                          className="btn btn-secondary"
                          style={{ padding: '5px 10px', fontSize: '12px' }}
                          onClick={() => handleToggleMovieStatus(movie._id)}
                        >
                          {movie.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button 
                          className="btn btn-secondary"
                          style={{ padding: '5px 10px', fontSize: '12px' }}
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
                      <img 
                        src={tvShow.imageUrl} 
                        alt={tvShow.title}
                        className="movie-thumbnail"
                        style={{ width: '80px', height: '120px', objectFit: 'cover' }}
                      />
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
                        backgroundColor: tvShow.status === 'active' ? '#28a745' : '#6c757d',
                        color: 'white',
                        fontSize: '12px'
                      }}>
                        {tvShow.status}
                      </span>
                    </td>
                    <td>{tvShow.addedBy?.name || 'Unknown'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button 
                          className="btn btn-secondary"
                          style={{ padding: '5px 10px', fontSize: '12px' }}
                          onClick={() => handleEditTVShow(tvShow)}
                        >
                          Edit
                        </button>
                        <button 
                          className="btn btn-secondary"
                          style={{ padding: '5px 10px', fontSize: '12px' }}
                          onClick={() => handleToggleTVShowStatus(tvShow._id)}
                        >
                          {tvShow.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button 
                          className="btn btn-secondary"
                          style={{ padding: '5px 10px', fontSize: '12px' }}
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

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Add New User</h3>
              <button 
                className="close-btn"
                onClick={() => setShowAddUserModal(false)}
              >
                ×
              </button>
            </div>
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="Enter user name"
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                placeholder="Enter user email"
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                placeholder="Enter user password"
              />
            </div>
            <div className="form-group">
              <label>Role</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({...formData, role: e.target.value})}
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="form-actions">
              <button 
                className="btn btn-primary"
                onClick={handleAddUser}
              >
                Add User
              </button>
              <button 
                className="btn btn-secondary"
                onClick={() => setShowAddUserModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Edit User</h3>
              <button 
                className="close-btn"
                onClick={() => setEditingUser(null)}
              >
                ×
              </button>
            </div>
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="Enter user name"
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                placeholder="Enter user email"
              />
            </div>
            <div className="form-group">
              <label>Role</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({...formData, role: e.target.value})}
                style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="form-actions">
              <button 
                className="btn btn-primary"
                onClick={handleUpdateUser}
              >
                Update User
              </button>
              <button 
                className="btn btn-secondary"
                onClick={() => setEditingUser(null)}
              >
                Cancel
              </button>
            </div>
          </div>
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
                value={movieFormData.imdbRating || ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                  setMovieFormData({...movieFormData, imdbRating: val});
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
            <div className="form-actions">
              <button 
                className="btn btn-primary"
                onClick={handleUpdateMovie}
              >
                Update Movie
              </button>
              <button 
                className="btn btn-secondary"
                onClick={() => setEditingMovie(null)}
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
            <div className="form-actions">
              <button 
                className="btn btn-primary"
                onClick={handleUpdateTVShow}
              >
                Update TV Show
              </button>
              <button 
                className="btn btn-secondary"
                onClick={() => setEditingTVShow(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contact Management Section */}
      {activeTab === 'contacts' && (
        <ContactManagement />
      )}
    </div>
  );
};

export default AdminDashboard; 