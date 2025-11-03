import React from 'react';
import { useNavigate } from 'react-router-dom';

const TVShowGrid = ({ tvShows, searchTerm = '' }) => {
  const navigate = useNavigate();

  // Check if there's a search term and no results
  const hasSearchTerm = searchTerm && searchTerm.trim().length > 0;
  const hasTVShows = tvShows && tvShows.length > 0;
  const displayTVShows = hasTVShows ? tvShows : [];
  const showNoTVShowsMessage = hasSearchTerm && !hasTVShows;

  return (
    <div className="movie-grid-container">
      {showNoTVShowsMessage ? (
        <div className="no-movies-message">
          <div className="no-movies-icon">📺</div>
          <h3>No TV Show Available</h3>
          <p>Sorry, we couldn't find any TV show matching "{searchTerm}".</p>
          <p className="no-movies-suggestion">Please try a different search term or browse our collection.</p>
        </div>
      ) : (
        <div className="movie-grid">
          {displayTVShows.map((tvShow, index) => (
          <div 
            key={tvShow._id} 
            className="movie-poster-card"
            onClick={() => navigate(`/tvshow/${tvShow._id}`)}
            style={{ cursor: 'pointer', '--index': index }}
          >
            {/* TV Show Poster */}
            <div className="movie-poster">
              {tvShow.images && tvShow.images.length > 0 ? (
                <img 
                  src={tvShow.images[0]} 
                  alt={tvShow.title}
                  onError={(e) => {
                    e.target.style.display = 'none';
                    const placeholder = e.target.parentElement.querySelector('.movie-placeholder') || document.createElement('div');
                    placeholder.className = 'movie-placeholder';
                    placeholder.innerHTML = '<span>📺</span>';
                    if (!e.target.parentElement.querySelector('.movie-placeholder')) {
                      e.target.parentElement.appendChild(placeholder);
                    } else {
                      e.target.parentElement.querySelector('.movie-placeholder').style.display = 'flex';
                    }
                  }}
                />
              ) : tvShow.imageUrl ? (
                <img 
                  src={tvShow.imageUrl} 
                  alt={tvShow.title}
                  onError={(e) => {
                    e.target.style.display = 'none';
                    const placeholder = e.target.parentElement.querySelector('.movie-placeholder') || document.createElement('div');
                    placeholder.className = 'movie-placeholder';
                    placeholder.innerHTML = '<span>📺</span>';
                    if (!e.target.parentElement.querySelector('.movie-placeholder')) {
                      e.target.parentElement.appendChild(placeholder);
                    } else {
                      e.target.parentElement.querySelector('.movie-placeholder').style.display = 'flex';
                    }
                  }}
                />
              ) : (
                <div className="movie-placeholder">
                  <span>📺</span>
                </div>
              )}
            </div>
            
            {/* TV Show Info */}
            <div className="movie-info">
              <h3 className="movie-title-main">{tvShow.title}</h3>
              <div className="movie-year-main">{tvShow.year}</div>
              {tvShow.genre && (
                <div className="movie-genre-main">{tvShow.genre}</div>
              )}
              {tvShow.imdbRating && (
                <div className="movie-imdb-main">
                  📺 IMDB: {tvShow.imdbRating.toFixed(1)}/10
                </div>
              )}
            </div>
          </div>
        ))}
        </div>
      )}
    </div>
  );
};

export default TVShowGrid;

