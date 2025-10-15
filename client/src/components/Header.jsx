import React from 'react';

const Header = () => {
  const categories = [
    {
      icon: '🎬',
      text: 'ALL MOVIES',
      path: '/'
    },
    {
      icon: '📺',
      text: 'TV SHOWS',
      path: '/tv-shows'
    },
    {
      icon: '🌐',
      text: 'LANGUAGES',
      path: '/languages'
    },
    {
      icon: '📁',
      text: 'GENRES',
      path: '/genres'
    },
    {
      icon: '📅',
      text: 'YEARS',
      path: '/years'
    },
    {
      icon: '📚',
      text: 'COLLECTIONS',
      path: '/collections'
    }
  ];

  const handleCategoryClick = (path) => {
    // For now, we'll just scroll to the movies section for ALL MOVIES
    // In the future, this can be expanded to handle different routes
    if (path === '/') {
      const moviesSection = document.getElementById('movies-section');
      if (moviesSection) {
        moviesSection.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <header className="movie-header">
      <div className="header-container">
        {categories.map((category, index) => (
          <button
            key={index}
            className="header-category"
            onClick={() => handleCategoryClick(category.path)}
          >
            <span className="category-icon">{category.icon}</span>
            <span className="category-text">{category.text}</span>
          </button>
        ))}
      </div>
    </header>
  );
};

export default Header;
