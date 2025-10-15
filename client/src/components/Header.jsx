import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const Header = () => {
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [genres, setGenres] = useState([]);
  const [years, setYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get current filter parameters from URL
  const urlParams = new URLSearchParams(location.search);
  const currentGenre = urlParams.get('genre');
  const currentYear = urlParams.get('year');

  // Fetch genres and years from API
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        setLoading(true);
        const response = await fetch('http://localhost:5001/api/movies/filters');
        const result = await response.json();
        
        if (result.success) {
          setGenres(result.data.genres);
          setYears(result.data.years);
        }
      } catch (error) {
        console.error('Error fetching filters:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchFilters();
  }, []);

  const categories = [
    {
      icon: '🎬',
      text: 'ALL MOVIES',
      path: '/',
      dropdown: null
    },
    {
      icon: '📁',
      text: 'GENRES',
      path: '/genres',
      dropdown: {
        options: genres,
        columns: 3
      }
    },
    {
      icon: '📅',
      text: 'YEARS',
      path: '/years',
      dropdown: {
        options: years.map(year => year.toString()),
        columns: 4
      }
    }
  ];

  const handleCategoryClick = (category) => {
    if (category.dropdown) {
      setActiveDropdown(activeDropdown === category.text ? null : category.text);
    } else {
      // For ALL MOVIES, clear all filters and scroll to movies
      if (category.path === '/') {
        // Clear all filters by navigating to home without parameters
        navigate('/', { replace: true });
        
        // Scroll to movies section
        setTimeout(() => {
          const moviesSection = document.getElementById('movies-section');
          if (moviesSection) {
            moviesSection.scrollIntoView({ behavior: 'smooth' });
          }
        }, 100);
      }
      setActiveDropdown(null);
    }
  };

  const handleOptionClick = (option, category) => {
    console.log(`Selected: ${option} from ${category}`);
    
    // Navigate to home page with filter parameters
    const params = new URLSearchParams();
    
    if (category === 'GENRES') {
      params.append('genre', option);
    } else if (category === 'YEARS') {
      params.append('year', option);
    }
    
    // Navigate to home with filter parameters
    navigate(`/?${params.toString()}`);
    
    // Close dropdown
    setActiveDropdown(null);
  };

  return (
    <header className="movie-header">
      <div className="header-container">
        {categories.map((category, index) => (
          <div key={index} className="header-category-wrapper">
            <button
              className={`header-category ${activeDropdown === category.text ? 'active' : ''} ${
                (category.text === 'GENRES' && currentGenre) || 
                (category.text === 'YEARS' && currentYear) ? 'has-filter' : ''
              }`}
              onClick={() => handleCategoryClick(category)}
            >
              <span className="category-icon">{category.icon}</span>
              <span className="category-text">{category.text}</span>
              {category.text === 'GENRES' && currentGenre && (
                <span className="filter-indicator">●</span>
              )}
              {category.text === 'YEARS' && currentYear && (
                <span className="filter-indicator">●</span>
              )}
            </button>
            
            {activeDropdown === category.text && category.dropdown && (
              <div className="header-dropdown">
                <div className={`dropdown-content columns-${category.dropdown.columns}`}>
                  {loading ? (
                    <div className="dropdown-loading">Loading...</div>
                  ) : (
                    category.dropdown.options.map((option, optionIndex) => (
                      <button
                        key={optionIndex}
                        className="dropdown-option"
                        onClick={() => handleOptionClick(option, category.text)}
                      >
                        {option}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </header>
  );
};

export default Header;
