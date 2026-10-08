import React from 'react';
import { getMoviePlaceholder, handleImageError } from '../utils/placeholderImage';
import { getDisplayRating } from '../utils/rating';

const getPosterSrc = (item) => {
  if (item.images && item.images.length > 0) return item.images[0];
  if (item.imageUrl) return item.imageUrl;
  return getMoviePlaceholder(item.title || 'Poster');
};


/**
 * Compact Netflix/MovieAI-style poster used inside horizontal rows.
 */
const PosterCard = ({ item, onClick, badge }) => {
  const rating = getDisplayRating(item);

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
        {badge && <span className="poster-card-badge">{badge}</span>}
        {item.matureContent && (
          <span className="poster-card-mature" title="18+ — adults only">18+</span>
        )}
        <div className="poster-card-overlay">
          <span className={`poster-card-rating${rating ? '' : ' poster-card-rating-na'}`}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2l2.9 6.9L22 9.2l-5.5 4.8L18.2 22 12 18.3 5.8 22l1.7-8L2 9.2l7.1-.3L12 2z" />
            </svg>
            {rating || 'N/A'}
          </span>
          <div className="poster-card-actions">
            <span className="poster-card-play">
              {badge ? (
                badge
              ) : (
                <>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Play
                </>
              )}
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
