import React from 'react';
import { getMoviePlaceholder, handleImageError } from '../utils/placeholderImage';

const getPosterSrc = (item) => {
  if (item.images && item.images.length > 0) return item.images[0];
  if (item.imageUrl) return item.imageUrl;
  return getMoviePlaceholder(item.title || 'Poster');
};

const getRating = (item) => {
  const value = item.imdbRating ?? item.averageRating;
  if (value == null || Number.isNaN(Number(value))) return null;
  return Number(value).toFixed(1);
};

/**
 * Compact Netflix/MovieAI-style poster used inside horizontal rows.
 */
const PosterCard = ({ item, onClick }) => {
  const rating = getRating(item);

  return (
    <button
      type="button"
      className="poster-card"
      onClick={onClick}
      aria-label={`Open ${item.title}`}
    >
      <div className="poster-card-media">
        <img
          src={getPosterSrc(item)}
          alt={item.title}
          loading="lazy"
          onError={(e) => handleImageError(e, item.title)}
        />
        <div className="poster-card-overlay">
          {rating && (
            <span className="poster-card-rating">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2l2.9 6.9L22 9.2l-5.5 4.8L18.2 22 12 18.3 5.8 22l1.7-8L2 9.2l7.1-.3L12 2z" />
              </svg>
              {rating}
            </span>
          )}
          <div className="poster-card-actions">
            <span className="poster-card-play">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
              Play
            </span>
          </div>
        </div>
      </div>

      <div className="poster-card-caption">
        <p className="poster-card-title">{item.title}</p>
        <p className="poster-card-sub">{item.year || ''}</p>
      </div>
    </button>
  );
};

export default PosterCard;
