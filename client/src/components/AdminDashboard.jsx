import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [moviesLoading, setMoviesLoading] = useState(false);
  const [error, setError] = useState(null);
  const [moviesError, setMoviesError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [movieSearchTerm, setMovieSearchTerm] = useState('');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editingMovie, setEditingMovie] = useState(null);
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
    downloadUrl: '',
    rating: 0
  });
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
  const [activeTab, setActiveTab] = useState('users'); // 'users' or 'movies'

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
      
      const response = await fetch('http://localhost:5001/api/movies/admin', {
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
        const averageRating = result.data.movies.reduce((sum, m) => sum + m.rating, 0) / totalMovies || 0;
        const newMoviesThisMonth = result.data.movies.filter(m => {
          const movieDate = new Date(m.createdAt);
          const now = new Date();
          return movieDate.getMonth() === now.getMonth() && movieDate.getFullYear() === now.getFullYear();
        }).length;

        setMovieStats({
          totalMovies,
          activeMovies,
          averageRating: Math.round(averageRating * 10) / 10,
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

  // Fetch data on component mount
  useEffect(() => {
    if (token) {
      fetchUsers();
      fetchMovies();
    }
  }, [token, fetchUsers, fetchMovies]);

  const handleAddUser = async () => {
    if (!formData.name || !formData.email || !formData.password) {
      alert('Please fill in all fields');
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
        alert('User created successfully!');
      }
    } catch (err) {
      console.error('Error creating user:', err);
      alert(`Error creating user: ${err.message}`);
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
      alert('Please fill in all fields');
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
        alert('User updated successfully!');
      }
    } catch (err) {
      console.error('Error updating user:', err);
      alert(`Error updating user: ${err.message}`);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
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
          alert('User deleted successfully!');
        }
      } catch (err) {
        console.error('Error deleting user:', err);
        alert(`Error deleting user: ${err.message}`);
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
        alert(`User status updated successfully!`);
      }
    } catch (err) {
      console.error('Error updating user status:', err);
      alert(`Error updating user status: ${err.message}`);
    }
  };

  // Movie management functions

  const handleEditMovie = (movie) => {
    setEditingMovie(movie);
    setMovieFormData({
      title: movie.title,
      year: movie.year,
      description: movie.description,
      genre: movie.genre,
      movieUrl: movie.movieUrl,
      downloadUrl: movie.downloadUrl,
      rating: movie.rating
    });
  };

  const handleUpdateMovie = async () => {
    if (!movieFormData.title || !movieFormData.description || !movieFormData.genre || !movieFormData.movieUrl) {
      alert('Please fill in all required fields');
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
          downloadUrl: '',
          rating: 0
        });
        alert('Movie updated successfully!');
      }
    } catch (err) {
      console.error('Error updating movie:', err);
      alert(`Error updating movie: ${err.message}`);
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
          alert('Movie deleted successfully!');
        }
      } catch (err) {
        console.error('Error deleting movie:', err);
        alert(`Error deleting movie: ${err.message}`);
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
        alert(`Movie status updated successfully!`);
      }
    } catch (err) {
      console.error('Error updating movie status:', err);
      alert(`Error updating movie status: ${err.message}`);
    }
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

  if (loading) {
    return (
      <div className="card">
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <h3>Loading users...</h3>
          <p>Please wait while we fetch the latest user data.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div style={{ textAlign: 'center', padding: '50px', color: '#dc3545' }}>
          <h3>Error loading users</h3>
          <p>{error}</p>
          <button 
            className="btn btn-primary"
            onClick={fetchUsers}
            style={{ marginTop: '20px' }}
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
            <div style={{ textAlign: 'center', padding: '50px', color: '#6c757d' }}>
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
            <div style={{ textAlign: 'center', padding: '50px' }}>
              <h3>Loading movies...</h3>
              <p>Please wait while we fetch the latest movie data.</p>
            </div>
          ) : moviesError ? (
            <div style={{ textAlign: 'center', padding: '50px', color: '#dc3545' }}>
              <h3>Error loading movies</h3>
              <p>{moviesError}</p>
              <button 
                className="btn btn-primary"
                onClick={fetchMovies}
                style={{ marginTop: '20px' }}
              >
                Try Again
              </button>
            </div>
          ) : filteredMovies.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px', color: '#6c757d' }}>
              <h3>No movies found</h3>
              <p>{movieSearchTerm ? 'Try adjusting your search terms.' : 'No movies have been added yet.'}</p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Year</th>
                  <th>Genre</th>
                  <th>Rating</th>
                  <th>Download URL</th>
                  <th>Status</th>
                  <th>Added By</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovies.map(movie => (
                  <tr key={movie._id}>
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
                        backgroundColor: movie.rating >= 7 ? '#28a745' : movie.rating >= 5 ? '#ffc107' : '#dc3545',
                        color: 'white',
                        fontSize: '12px'
                      }}>
                        {movie.rating}/10
                      </span>
                    </td>
                    <td>
                      <a 
                        href={movie.downloadUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ 
                          color: '#007bff', 
                          textDecoration: 'none',
                          fontSize: '12px',
                          wordBreak: 'break-all'
                        }}
                      >
                        {movie.downloadUrl ? 'Download Link' : 'N/A'}
                      </a>
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
                value={movieFormData.year}
                onChange={(e) => setMovieFormData({...movieFormData, year: parseInt(e.target.value)})}
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
              <label>Download URL</label>
              <input
                type="url"
                value={movieFormData.downloadUrl}
                onChange={(e) => setMovieFormData({...movieFormData, downloadUrl: e.target.value})}
                placeholder="https://example.com/download"
              />
            </div>
            <div className="form-group">
              <label>Rating (0-10)</label>
              <input
                type="number"
                value={movieFormData.rating}
                onChange={(e) => setMovieFormData({...movieFormData, rating: parseInt(e.target.value)})}
                min="0"
                max="10"
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
    </div>
  );
};

export default AdminDashboard; 