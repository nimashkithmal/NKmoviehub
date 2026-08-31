import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import CatalogCard from './CatalogCard';
import { withReturnPath } from '../utils/navigation';
import './CatalogGrid.css';

const TVShowGrid = ({
  tvShows,
  searchTerm = '',
  selectedGenre = '',
  selectedYear = '',
  selectedLanguage = ''
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const hasSearchTerm = searchTerm && searchTerm.trim().length > 0;
  const hasGenreFilter = selectedGenre && selectedGenre.trim().length > 0;
  const hasYearFilter = selectedYear && selectedYear.trim().length > 0;
  const hasLanguageFilter = selectedLanguage && selectedLanguage.trim().length > 0;
  const hasActiveFilters = hasSearchTerm || hasGenreFilter || hasYearFilter || hasLanguageFilter;
  const hasTVShows = tvShows && tvShows.length > 0;

  return (
    <div className="catalog-grid-wrap">
      {!hasTVShows ? (
        <div className="no-movies-message">
          <h3>No TV Shows Available</h3>
          <p>
            {hasActiveFilters
              ? 'Nothing matched these filters. Try another language, genre, or year.'
              : 'No TV shows in the catalog yet.'}
          </p>
        </div>
      ) : (
        <div className="catalog-grid">
          {tvShows.map((tvShow) => (
            <CatalogCard
              key={tvShow._id}
              item={tvShow}
              kind="tvshow"
              onClick={() => navigate(`/tvshow/${tvShow._id}`, withReturnPath(location))}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default TVShowGrid;
