import React from 'react';
import { useNavigate } from 'react-router-dom';
import CatalogCard from './CatalogCard';
import './CatalogGrid.css';

const MovieGrid = ({
  movies,
  searchTerm = '',
  selectedGenre = '',
  selectedYear = ''
}) => {
  const navigate = useNavigate();

  const hasSearchTerm = searchTerm && searchTerm.trim().length > 0;
  const hasGenreFilter = selectedGenre && selectedGenre.trim().length > 0;
  const hasYearFilter = selectedYear && selectedYear.trim().length > 0;
  const hasActiveFilters = hasSearchTerm || hasGenreFilter || hasYearFilter;
  const hasMovies = movies && movies.length > 0;

  return (
    <div className="catalog-grid-wrap">
      {!hasMovies ? (
        <div className="no-movies-message">
          <h3>No Movies Available</h3>
          <p>
            {hasActiveFilters
              ? 'Nothing matched these filters. Try another genre or year.'
              : 'No movies in the catalog yet.'}
          </p>
        </div>
      ) : (
        <div className="catalog-grid">
          {movies.map((movie) => (
            <CatalogCard
              key={movie._id}
              item={movie}
              kind="movie"
              onClick={() => navigate(`/movie/${movie._id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default MovieGrid;
