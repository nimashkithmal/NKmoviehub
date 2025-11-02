import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const TVShowGrid = ({ tvShows }) => {
  const navigate = useNavigate();

  // Use provided TV shows or empty array
  const displayTVShows = tvShows && tvShows.length > 0 ? tvShows : [];

  return (
    <div className="movie-grid-container">
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
              {tvShow.imageUrl ? (
                <img src={tvShow.imageUrl} alt={tvShow.title} />
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
    </div>
  );
};

export default TVShowGrid;

