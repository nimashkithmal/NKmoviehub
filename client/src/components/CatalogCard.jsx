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

const truncate = (text, max = 90) => {
  if (!text) return '';
  const clean = String(text).trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).trim()}…`;
};

/**
 * Browse-page poster card: title + year under image, hover reveal for play/rating.
 */
const CatalogCard = ({ item, kind = 'movie', onClick }) => {
  const rating = getRating(item);
  const blurb = truncate(item.description || item.overview || '');

  return (
    <button
      type="button"
      className="catalog-card"
      onClick={onClick}
      aria-label={`Open ${item.title}`}
    >
      <div className="catalog-card-media">
        <img
          src={getPosterSrc(item)}
          alt={item.title}
          loading="lazy"
          onError={(e) => handleImageError(e, item.title)}
        />

        {kind === 'tvshow' && <span className="catalog-card-badge">TV</span>}

        <div className="catalog-card-overlay">
          {rating && (
            <span className="catalog-card-rating">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2l2.9 6.9L22 9.2l-5.5 4.8L18.2 22 12 18.3 5.8 22l1.7-8L2 9.2l7.1-.3L12 2z" />
              </svg>
              {rating}
            </span>
          )}

          {blurb && <p className="catalog-card-blurb">{blurb}</p>}

          <div className="catalog-card-actions">
            <span className="catalog-card-play">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
              Play
            </span>
            <span className="catalog-card-info" aria-hidden="true">
              i
            </span>
          </div>
        </div>
      </div>

      <div className="catalog-card-caption">
        <p className="catalog-card-title">{item.title}</p>
        <p className="catalog-card-year">{item.year || ''}</p>
      </div>
    </button>
  );
};

export default CatalogCard;
