import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MoviePlayer from './MoviePlayer';
import './MovieDetail.css';

const TVShowDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, token } = useAuth();
  const [tvShow, setTVShow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  const [showPlayer, setShowPlayer] = useState(false);

  useEffect(() => {
    fetchTVShowDetails();
  }, [id]);

  const fetchTVShowDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`http://localhost:5001/api/tvshows/${id}`);
      
      if (!response.ok) {
        throw new Error('TV Show not found');
      }

      const result = await response.json();
      
      if (result.success) {
        setTVShow(result.data.tvShow);
      } else {
        throw new Error(result.message || 'Failed to fetch TV show');
      }
    } catch (err) {
      console.error('Error fetching TV show:', err);
      setError(err.message || 'Failed to load TV show. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleWatchEpisode = (episode) => {
    if (!isAuthenticated) {
      showNotification('Please login to watch episodes', 'warning');
      return;
    }
    
    // Create a movie-like object for the player
    const episodeMovie = {
      _id: `${tvShow._id}-ep${episode.episodeNumber}`,
      title: `${tvShow.title} - ${episode.episodeTitle || `Episode ${episode.episodeNumber}`}`,
      movieUrl: episode.episodeUrl,
      imageUrl: tvShow.imageUrl
    };
    
    setSelectedEpisode(episodeMovie);
    setShowPlayer(true);
  };

  const handleWatchShow = () => {
    if (!isAuthenticated) {
      showNotification('Please login to watch TV shows', 'warning');
      return;
    }
    
    if (tvShow.showUrl) {
      const episode = {
        _id: tvShow._id,
        title: tvShow.title,
        movieUrl: tvShow.showUrl,
        imageUrl: tvShow.imageUrl
      };
      setSelectedEpisode(episode);
      setShowPlayer(true);
    }
  };

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

  if (loading) {
    return (
      <div className="movie-detail-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <h3>Loading TV show details...</h3>
        </div>
      </div>
    );
  }

  if (error || !tvShow) {
    return (
      <div className="movie-detail-container">
        <div className="error-state">
          <h3>Error loading TV show</h3>
          <p>{error || 'TV Show not found'}</p>
          <button 
            className="btn btn-primary"
            onClick={() => navigate('/')}
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Helper function to group episodes by seasons
  // Try to detect season boundaries from episode URLs (e.g., s01e01, s02e01)
  const groupEpisodesBySeasons = (episodes, numberOfSeasons) => {
    if (!episodes || episodes.length === 0 || !numberOfSeasons || numberOfSeasons === 0) {
      return [];
    }

    const sortedEpisodes = [...episodes].sort((a, b) => a.episodeNumber - b.episodeNumber);
    
    // Try to detect season number from episode URLs
    const episodesBySeason = {};
    
    for (let i = 0; i < sortedEpisodes.length; i++) {
      const episode = sortedEpisodes[i];
      const url = episode.episodeUrl || '';
      
      // Try to extract season number from URL (e.g., s01e01, /s01/e01, season01, etc.)
      const seasonMatch = url.match(/[sS](\d{1,2})[eE]/) || 
                          url.match(/season[_\s-]?(\d{1,2})/i) ||
                          url.match(/\/s(\d{1,2})\//);
      
      let seasonNum = 1; // Default to season 1
      
      if (seasonMatch) {
        const detectedSeason = parseInt(seasonMatch[1]);
        if (detectedSeason >= 1 && detectedSeason <= numberOfSeasons) {
          seasonNum = detectedSeason;
        }
      }
      
      // If no season found in URL, try to calculate based on position
      // This is a fallback for evenly distributed episodes
      if (!seasonMatch && numberOfSeasons > 1) {
        const episodesPerSeason = Math.ceil(sortedEpisodes.length / numberOfSeasons);
        seasonNum = Math.floor(i / episodesPerSeason) + 1;
        if (seasonNum > numberOfSeasons) seasonNum = numberOfSeasons;
      }
      
      if (!episodesBySeason[seasonNum]) {
        episodesBySeason[seasonNum] = [];
      }
      episodesBySeason[seasonNum].push(episode);
    }
    
    // Convert to array format sorted by season number
    const seasons = [];
    for (let seasonNum = 1; seasonNum <= numberOfSeasons; seasonNum++) {
      if (episodesBySeason[seasonNum] && episodesBySeason[seasonNum].length > 0) {
        seasons.push({
          seasonNumber: seasonNum,
          episodes: episodesBySeason[seasonNum]
        });
      }
    }

    return seasons;
  };

  // Group episodes by seasons
  const numberOfSeasons = tvShow.numberOfSeasons || (tvShow.episodes && tvShow.episodes.length > 0 ? 1 : 0);
  const sortedEpisodes = tvShow.episodes && tvShow.episodes.length > 0 
    ? [...tvShow.episodes].sort((a, b) => a.episodeNumber - b.episodeNumber)
    : [];
  
  // Always group by seasons if we have episodes and numberOfSeasons is set
  const seasons = numberOfSeasons > 0 && sortedEpisodes.length > 0 
    ? groupEpisodesBySeasons(sortedEpisodes, numberOfSeasons)
    : [];

  return (
    <>
      {showPlayer && selectedEpisode && (
        <MoviePlayer 
          movie={selectedEpisode} 
          onClose={() => {
            setShowPlayer(false);
            setSelectedEpisode(null);
          }} 
        />
      )}
      
      <div className="movie-detail-container">
        <button 
          className="back-button"
          onClick={() => navigate(-1)}
        >
          ← Back
        </button>

        <div className="movie-detail-content">
          <div className="movie-detail-poster">
            {tvShow.imageUrl ? (
              <img src={tvShow.imageUrl} alt={tvShow.title} />
            ) : (
              <div className="movie-placeholder-large">
                <span>📺</span>
              </div>
            )}
          </div>

          <div className="movie-detail-info">
            <h1 className="movie-detail-title">{tvShow.title}</h1>
            
            <div className="movie-detail-meta">
              <div className="meta-item">
                <span className="meta-label">Year:</span>
                <span className="meta-value">{tvShow.year}</span>
              </div>
              {tvShow.genre && (
                <div className="meta-item">
                  <span className="meta-label">Genre:</span>
                  <span className="meta-value">{tvShow.genre}</span>
                </div>
              )}
              {tvShow.numberOfSeasons > 0 && (
                <div className="meta-item">
                  <span className="meta-label">Seasons:</span>
                  <span className="meta-value">{tvShow.numberOfSeasons}</span>
                </div>
              )}
              {tvShow.episodeCount > 0 && (
                <div className="meta-item">
                  <span className="meta-label">Episodes:</span>
                  <span className="meta-value">{tvShow.episodeCount}</span>
                </div>
              )}
            </div>

            {tvShow.description && (
              <div className="movie-detail-description">
                <h3>Description</h3>
                <p>{tvShow.description}</p>
              </div>
            )}

            <div className="movie-detail-ratings">
              <div className="rating-item">
                <span className="rating-label">📺 IMDB Rating:</span>
                <span className="rating-value">
                  {tvShow.imdbRating ? tvShow.imdbRating.toFixed(1) : 'N/A'}/10
                </span>
              </div>
            </div>

            {/* Episodes Section - Organized by Seasons */}
            {seasons.length > 0 ? (
              <div className="episodes-section" style={{ marginTop: '30px' }}>
                <h3 style={{ marginBottom: '20px' }}>
                  Episodes ({sortedEpisodes.length}) - {numberOfSeasons} Season{numberOfSeasons !== 1 ? 's' : ''}
                </h3>
                {seasons.map((season, seasonIndex) => (
                  <div 
                    key={seasonIndex} 
                    style={{ 
                      marginBottom: '40px',
                      padding: '20px',
                      border: '2px solid #007bff',
                      borderRadius: '12px',
                      backgroundColor: '#f8f9fa'
                    }}
                  >
                    <h4 style={{ 
                      margin: '0 0 20px 0', 
                      color: '#007bff', 
                      fontSize: '24px',
                      fontWeight: 'bold',
                      borderBottom: '2px solid #007bff',
                      paddingBottom: '10px'
                    }}>
                      Season {season.seasonNumber}
                      <span style={{ 
                        fontSize: '16px', 
                        color: '#666', 
                        fontWeight: 'normal',
                        marginLeft: '10px'
                      }}>
                        ({season.episodes.length} episode{season.episodes.length !== 1 ? 's' : ''})
                      </span>
                    </h4>
                    <div className="episodes-list" style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', 
                      gap: '15px' 
                    }}>
                      {season.episodes.map((episode, episodeIndex) => {
                        // Calculate season-relative episode number (Episode 1, 2, 3... within the season)
                        const seasonEpisodeNumber = episodeIndex + 1;
                        
                        return (
                          <div 
                            key={episodeIndex} 
                            className="episode-card"
                            style={{
                              padding: '15px',
                              border: '1px solid #ddd',
                              borderRadius: '8px',
                              cursor: isAuthenticated ? 'pointer' : 'not-allowed',
                              backgroundColor: '#fff',
                              transition: 'all 0.3s ease',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}
                            onClick={() => handleWatchEpisode(episode)}
                            onMouseEnter={(e) => {
                              if (isAuthenticated) {
                                e.currentTarget.style.backgroundColor = '#e9e9e9';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#fff';
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                            }}
                          >
                            <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#333' }}>
                              Episode {seasonEpisodeNumber}
                            </div>
                            <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                              Season {season.seasonNumber} Episode {seasonEpisodeNumber}
                            </div>
                            {episode.episodeTitle && (
                              <div style={{ fontSize: '13px', color: '#888', marginBottom: '8px', fontStyle: 'italic' }}>
                                {episode.episodeTitle}
                              </div>
                            )}
                            <div style={{ fontSize: '12px', color: '#999' }}>
                              {isAuthenticated ? 'Click to watch →' : 'Login to watch'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : sortedEpisodes.length > 0 ? (
              <div className="episodes-section" style={{ marginTop: '30px' }}>
                <h3 style={{ marginBottom: '20px' }}>Episodes ({sortedEpisodes.length})</h3>
                <div className="episodes-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px' }}>
                  {sortedEpisodes.map((episode, index) => (
                    <div 
                      key={index} 
                      className="episode-card"
                      style={{
                        padding: '15px',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        cursor: isAuthenticated ? 'pointer' : 'not-allowed',
                        backgroundColor: '#f9f9f9',
                        transition: 'all 0.3s ease'
                      }}
                      onClick={() => handleWatchEpisode(episode)}
                      onMouseEnter={(e) => {
                        if (isAuthenticated) {
                          e.currentTarget.style.backgroundColor = '#e9e9e9';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#f9f9f9';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#333' }}>
                        Episode {episode.episodeNumber}
                      </div>
                      {episode.episodeTitle && (
                        <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                          {episode.episodeTitle}
                        </div>
                      )}
                      <div style={{ fontSize: '12px', color: '#999' }}>
                        {isAuthenticated ? 'Click to watch →' : 'Login to watch'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : tvShow.showUrl ? (
              <div className="movie-detail-actions" style={{ marginTop: '30px' }}>
                {isAuthenticated ? (
                  <button 
                    className="btn btn-primary btn-large"
                    onClick={handleWatchShow}
                  >
                    📺 Watch TV Show
                  </button>
                ) : (
                  <button 
                    className="btn btn-primary btn-large"
                    onClick={() => showNotification('Please login to watch TV shows', 'warning')}
                  >
                    📺 Watch TV Show
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
};

export default TVShowDetail;

