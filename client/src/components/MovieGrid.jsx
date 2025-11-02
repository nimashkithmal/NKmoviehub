import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MoviePlayer from './MoviePlayer';
import { getMoviePlaceholder, handleImageError } from '../utils/placeholderImage';

const MovieGrid = ({ movies, onRateMovie, userRatings, ratingLoading, isAuthenticated, showNotification }) => {
  const navigate = useNavigate();
  const [selectedMovie, setSelectedMovie] = useState(null);
  // 30 New Movies Collection
  const sampleMovies = [
    {
      _id: '1',
      title: 'The Dark Knight',
      year: 2008,
      description: 'When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests of his ability to fight injustice.',
      imageUrl: 'https://via.placeholder.com/300x450/1a1a1a/ffffff?text=The+Dark+Knight',
      genre: 'Action',
      source: 'BluRay English',
      subtitle: 'Sinhala Subtitles',
      releaseDate: 'Jul. 18, 2008',
      imdbRating: 9.0,
      averageRating: 9.2,
      totalRatings: 2847
    },
    {
      _id: '2',
      title: 'Inception',
      year: 2010,
      description: 'A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.',
      imageUrl: 'https://via.placeholder.com/300x450/0f0f23/ffffff?text=Inception',
      genre: 'Sci-Fi',
      source: 'BluRay English',
      subtitle: 'Sinhala Subtitles',
      releaseDate: 'Jul. 16, 2010',
      imdbRating: 8.8,
      averageRating: 8.9,
      totalRatings: 2156
    },
    {
      _id: '3',
      title: 'Pulp Fiction',
      year: 1994,
      description: 'The lives of two mob hitmen, a boxer, a gangster and his wife, and a pair of diner bandits intertwine in four tales of violence and redemption.',
      imageUrl: 'https://via.placeholder.com/300x450/2d1b1b/ffffff?text=Pulp+Fiction',
      genre: 'Crime',
      source: 'BluRay English',
      subtitle: 'Sinhala Subtitles',
      releaseDate: 'Oct. 14, 1994',
      imdbRating: 8.9,
      averageRating: 9.1,
      totalRatings: 1892
    },
    {
      _id: '4',
      title: 'The Shawshank Redemption',
      year: 1994,
      description: 'Two imprisoned men bond over a number of years, finding solace and eventual redemption through acts of common decency.',
      imageUrl: 'https://via.placeholder.com/300x450/1a2332/ffffff?text=Shawshank',
      genre: 'Drama',
      source: 'BluRay English',
      subtitle: 'Sinhala Subtitles',
      releaseDate: 'Sep. 23, 1994',
      imdbRating: 9.3,
      averageRating: 9.4,
      totalRatings: 3245
    },
    {
      _id: '5',
      title: 'The Godfather',
      year: 1972,
      description: 'The aging patriarch of an organized crime dynasty transfers control of his clandestine empire to his reluctant son.',
      imageUrl: 'https://via.placeholder.com/300x450/2c1810/ffffff?text=The+Godfather',
      genre: 'Crime',
      source: 'BluRay English',
      subtitle: 'Sinhala Subtitles',
      releaseDate: 'Mar. 24, 1972',
      imdbRating: 9.2,
      averageRating: 9.3,
      totalRatings: 1987
    },
    {
      _id: '6',
      title: 'Forrest Gump',
      year: 1994,
      description: 'The presidencies of Kennedy and Johnson, the Vietnam War, the Watergate scandal and other historical events unfold from the perspective of an Alabama man with an IQ of 75.',
      imageUrl: 'https://via.placeholder.com/300x450/2d4a2d/ffffff?text=Forrest+Gump',
      genre: 'Drama',
      source: 'BluRay English',
      subtitle: 'Sinhala Subtitles',
      releaseDate: 'Jul. 6, 1994',
      imdbRating: 8.8,
      averageRating: 8.9,
      totalRatings: 2156
    },
    {
      _id: '7',
      title: 'The Matrix',
      year: 1999,
      description: 'A computer hacker learns from mysterious rebels about the true nature of his reality and his role in the war against its controllers.',
      imageUrl: 'https://via.placeholder.com/300x450/0d0d0d/00ff00?text=The+Matrix',
      genre: 'Sci-Fi',
      source: 'BluRay English',
      subtitle: 'Sinhala Subtitles',
      releaseDate: 'Mar. 31, 1999',
      imdbRating: 8.7,
      averageRating: 8.8,
      totalRatings: 1876
    },
    {
      _id: '8',
      title: 'Goodfellas',
      year: 1990,
      description: 'The story of Henry Hill and his life in the mob, covering his relationship with his wife Karen Hill and his mob partners Jimmy Conway and Tommy DeVito.',
      imageUrl: 'https://via.placeholder.com/300x450/1a0f0f/ffffff?text=Goodfellas',
      genre: 'Crime',
      source: 'BluRay English',
      subtitle: 'Sinhala Subtitles',
      releaseDate: 'Sep. 19, 1990',
      imdbRating: 8.7,
      averageRating: 8.8,
      totalRatings: 1234
    },
    {
      _id: '9',
      title: 'The Lord of the Rings: The Fellowship of the Ring',
      year: 2001,
      description: 'A meek Hobbit from the Shire and eight companions set out on a journey to destroy the powerful One Ring and save Middle-earth from the Dark Lord Sauron.',
      imageUrl: 'https://via.placeholder.com/300x450/2d4a2d/ffffff?text=LOTR+FOTR',
      genre: 'Adventure',
      source: 'BluRay English',
      subtitle: 'Sinhala Subtitles',
      releaseDate: 'Dec. 19, 2001',
      imdbRating: 8.8,
      averageRating: 8.9,
      totalRatings: 2456
    },
    {
      _id: '10',
      title: 'Fight Club',
      year: 1999,
      description: 'An insomniac office worker and a devil-may-care soap maker form an underground fight club that evolves into much more.',
      imageUrl: 'https://via.placeholder.com/300x450/2d1b1b/ffffff?text=Fight+Club',
      genre: 'Drama',
      source: 'BluRay English',
      subtitle: 'Sinhala Subtitles',
      releaseDate: 'Oct. 15, 1999',
      imdbRating: 8.8,
      averageRating: 8.9,
      totalRatings: 1987
    },
    {
      _id: '11',
      title: 'The Lord of the Rings: The Two Towers',
      year: 2002,
      description: 'While Frodo and Sam edge closer to Mordor with the help of the shifty Gollum, the divided fellowship makes a stand against Sauron\'s new ally, Saruman.',
      imageUrl: 'https://via.placeholder.com/300x450/1a2d1a/ffffff?text=LOTR+TTO',
      genre: 'Adventure',
      source: 'BluRay English',
      subtitle: 'Sinhala Subtitles',
      releaseDate: 'Dec. 18, 2002',
      imdbRating: 8.7,
      averageRating: 8.8,
      totalRatings: 2234
    },
    {
      _id: '12',
      title: 'The Lord of the Rings: The Return of the King',
      year: 2003,
      description: 'Gandalf and Aragorn lead the World of Men against Sauron\'s army to draw his gaze from Frodo and Sam as they approach Mount Doom.',
      imageUrl: 'https://via.placeholder.com/300x450/0d1a0d/ffffff?text=LOTR+ROTK',
      genre: 'Adventure',
      source: 'BluRay English',
      subtitle: 'Sinhala Subtitles',
      releaseDate: 'Dec. 17, 2003',
      imdbRating: 8.9,
      averageRating: 9.0,
      totalRatings: 2678
    },
    {
      _id: '13',
      title: 'The Good, the Bad and the Ugly',
      year: 1966,
      description: 'A bounty hunting scam joins two men in an uneasy alliance against a third in a race to find a fortune in gold buried in a remote cemetery.',
      imageUrl: 'https://via.placeholder.com/300x450/2d1b0d/ffffff?text=The+Good+Bad+Ugly',
      genre: 'Western',
      source: 'BluRay English',
      subtitle: 'Sinhala Subtitles',
      releaseDate: 'Dec. 23, 1966',
      imdbRating: 8.8,
      averageRating: 8.9,
      totalRatings: 876
    },
    {
      _id: '14',
      title: '12 Angry Men',
      year: 1957,
      description: 'A jury holdout attempts to prevent a miscarriage of justice by forcing his colleagues to reconsider the evidence.',
      imageUrl: 'https://via.placeholder.com/300x450/1a1a1a/ffffff?text=12+Angry+Men',
      genre: 'Drama',
      source: 'BluRay English',
      subtitle: 'Sinhala Subtitles',
      releaseDate: 'Apr. 10, 1957',
      imdbRating: 9.0,
      averageRating: 9.1,
      totalRatings: 654
    },
    {
      _id: '15',
      title: 'Schindler\'s List',
      year: 1993,
      description: 'In German-occupied Poland during World War II, industrialist Oskar Schindler gradually becomes concerned for his Jewish workforce.',
      imageUrl: 'https://via.placeholder.com/300x450/0d0d0d/ffffff?text=Schindler+List',
      genre: 'Drama',
      source: 'BluRay English',
      subtitle: 'Sinhala Subtitles',
      releaseDate: 'Dec. 15, 1993',
      imdbRating: 8.9,
      averageRating: 9.0,
      totalRatings: 1456
    },
    {
      _id: '16',
      title: 'The Dark Knight Rises',
      year: 2012,
      description: 'Eight years after the Joker\'s reign of anarchy, Batman, with the help of the enigmatic Catwoman, is forced from his exile to save Gotham City.',
      imageUrl: 'https://via.placeholder.com/300x450/1a0d0d/ffffff?text=Dark+Knight+Rises',
      genre: 'Action',
      source: 'BluRay English',
      subtitle: 'Sinhala Subtitles',
      releaseDate: 'Jul. 20, 2012',
      imdbRating: 8.4,
      averageRating: 8.5,
      totalRatings: 1987
    },
    {
      _id: '17',
      title: 'Pulp Fiction',
      year: 1994,
      description: 'The lives of two mob hitmen, a boxer, a gangster and his wife, and a pair of diner bandits intertwine in four tales of violence and redemption.',
      imageUrl: 'https://via.placeholder.com/300x450/2d1b1b/ffffff?text=Pulp+Fiction',
      genre: 'Crime',
      source: 'BluRay English',
      subtitle: 'Sinhala Subtitles',
      releaseDate: 'Oct. 14, 1994',
      imdbRating: 8.9,
      averageRating: 9.1,
      totalRatings: 1892
    },
    {
      _id: '18',
      title: 'The Godfather Part II',
      year: 1974,
      description: 'The early life and career of Vito Corleone in 1920s New York City is portrayed, while his son, Michael, expands and tightens his grip on the family crime syndicate.',
      imageUrl: 'https://via.placeholder.com/300x450/1a0f0a/ffffff?text=Godfather+II',
      genre: 'Crime',
      source: 'BluRay English',
      subtitle: 'Sinhala Subtitles',
      releaseDate: 'Dec. 20, 1974',
      imdbRating: 9.0,
      averageRating: 9.1,
      totalRatings: 1234
    },
    {
      _id: '19',
      title: 'The Lord of the Rings: The Fellowship of the Ring',
      year: 2001,
      description: 'A meek Hobbit from the Shire and eight companions set out on a journey to destroy the powerful One Ring and save Middle-earth from the Dark Lord Sauron.',
      imageUrl: 'https://via.placeholder.com/300x450/2d4a2d/ffffff?text=LOTR+FOTR',
      genre: 'Adventure',
      source: 'BluRay English',
      subtitle: 'Sinhala Subtitles',
      releaseDate: 'Dec. 19, 2001',
      imdbRating: 8.8,
      averageRating: 8.9,
      totalRatings: 2456
    },
    {
      _id: '20',
      title: 'Forrest Gump',
      year: 1994,
      description: 'The presidencies of Kennedy and Johnson, the Vietnam War, the Watergate scandal and other historical events unfold from the perspective of an Alabama man with an IQ of 75.',
      imageUrl: 'https://via.placeholder.com/300x450/2d4a2d/ffffff?text=Forrest+Gump',
      genre: 'Drama',
      source: 'BluRay English',
      subtitle: 'Sinhala Subtitles',
      releaseDate: 'Jul. 6, 1994',
      imdbRating: 8.8,
      averageRating: 8.9,
      totalRatings: 2156
    },
    {
      _id: '21',
      title: 'The Matrix',
      year: 1999,
      description: 'A computer hacker learns from mysterious rebels about the true nature of his reality and his role in the war against its controllers.',
      imageUrl: 'https://via.placeholder.com/300x450/0d0d0d/00ff00?text=The+Matrix',
      genre: 'Sci-Fi',
      source: 'BluRay English',
      subtitle: 'Sinhala Subtitles',
      releaseDate: 'Mar. 31, 1999',
      imdbRating: 8.7,
      averageRating: 8.8,
      totalRatings: 1876
    },
    {
      _id: '22',
      title: 'Goodfellas',
      year: 1990,
      description: 'The story of Henry Hill and his life in the mob, covering his relationship with his wife Karen Hill and his mob partners Jimmy Conway and Tommy DeVito.',
      imageUrl: 'https://via.placeholder.com/300x450/1a0f0f/ffffff?text=Goodfellas',
      genre: 'Crime',
      source: 'BluRay English',
      subtitle: 'Sinhala Subtitles',
      releaseDate: 'Sep. 19, 1990',
      imdbRating: 8.7,
      averageRating: 8.8,
      totalRatings: 1234
    },
    {
      _id: '23',
      title: 'The Lord of the Rings: The Two Towers',
      year: 2002,
      description: 'While Frodo and Sam edge closer to Mordor with the help of the shifty Gollum, the divided fellowship makes a stand against Sauron\'s new ally, Saruman.',
      imageUrl: 'https://via.placeholder.com/300x450/1a2d1a/ffffff?text=LOTR+TTO',
      genre: 'Adventure',
      source: 'BluRay English',
      subtitle: 'Sinhala Subtitles',
      releaseDate: 'Dec. 18, 2002',
      imdbRating: 8.7,
      averageRating: 8.8,
      totalRatings: 2234
    },
    {
      _id: '24',
      title: 'The Lord of the Rings: The Return of the King',
      year: 2003,
      description: 'Gandalf and Aragorn lead the World of Men against Sauron\'s army to draw his gaze from Frodo and Sam as they approach Mount Doom.',
      imageUrl: 'https://via.placeholder.com/300x450/0d1a0d/ffffff?text=LOTR+ROTK',
      genre: 'Adventure',
      source: 'BluRay English',
      subtitle: 'Sinhala Subtitles',
      releaseDate: 'Dec. 17, 2003',
      imdbRating: 8.9,
      averageRating: 9.0,
      totalRatings: 2678
    },
    {
      _id: '25',
      title: 'The Good, the Bad and the Ugly',
      year: 1966,
      description: 'A bounty hunting scam joins two men in an uneasy alliance against a third in a race to find a fortune in gold buried in a remote cemetery.',
      imageUrl: 'https://via.placeholder.com/300x450/2d1b0d/ffffff?text=The+Good+Bad+Ugly',
      genre: 'Western',
      source: 'BluRay English',
      subtitle: 'Sinhala Subtitles',
      releaseDate: 'Dec. 23, 1966',
      imdbRating: 8.8,
      averageRating: 8.9,
      totalRatings: 876
    },
    {
      _id: '26',
      title: '12 Angry Men',
      year: 1957,
      description: 'A jury holdout attempts to prevent a miscarriage of justice by forcing his colleagues to reconsider the evidence.',
      imageUrl: 'https://via.placeholder.com/300x450/1a1a1a/ffffff?text=12+Angry+Men',
      genre: 'Drama',
      source: 'BluRay English',
      subtitle: 'Sinhala Subtitles',
      releaseDate: 'Apr. 10, 1957',
      imdbRating: 9.0,
      averageRating: 9.1,
      totalRatings: 654
    },
    {
      _id: '27',
      title: 'Schindler\'s List',
      year: 1993,
      description: 'In German-occupied Poland during World War II, industrialist Oskar Schindler gradually becomes concerned for his Jewish workforce.',
      imageUrl: 'https://via.placeholder.com/300x450/0d0d0d/ffffff?text=Schindler+List',
      genre: 'Drama',
      source: 'BluRay English',
      subtitle: 'Sinhala Subtitles',
      releaseDate: 'Dec. 15, 1993',
      imdbRating: 8.9,
      averageRating: 9.0,
      totalRatings: 1456
    },
    {
      _id: '28',
      title: 'The Dark Knight Rises',
      year: 2012,
      description: 'Eight years after the Joker\'s reign of anarchy, Batman, with the help of the enigmatic Catwoman, is forced from his exile to save Gotham City.',
      imageUrl: 'https://via.placeholder.com/300x450/1a0d0d/ffffff?text=Dark+Knight+Rises',
      genre: 'Action',
      source: 'BluRay English',
      subtitle: 'Sinhala Subtitles',
      releaseDate: 'Jul. 20, 2012',
      imdbRating: 8.4,
      averageRating: 8.5,
      totalRatings: 1987
    },
    {
      _id: '29',
      title: 'Pulp Fiction',
      year: 1994,
      description: 'The lives of two mob hitmen, a boxer, a gangster and his wife, and a pair of diner bandits intertwine in four tales of violence and redemption.',
      imageUrl: 'https://via.placeholder.com/300x450/2d1b1b/ffffff?text=Pulp+Fiction',
      genre: 'Crime',
      source: 'BluRay English',
      subtitle: 'Sinhala Subtitles',
      releaseDate: 'Oct. 14, 1994',
      imdbRating: 8.9,
      averageRating: 9.1,
      totalRatings: 1892
    },
    {
      _id: '30',
      title: 'The Godfather Part II',
      year: 1974,
      description: 'The early life and career of Vito Corleone in 1920s New York City is portrayed, while his son, Michael, expands and tightens his grip on the family crime syndicate.',
      imageUrl: 'https://via.placeholder.com/300x450/1a0f0a/ffffff?text=Godfather+II',
      genre: 'Crime',
      source: 'BluRay English',
      subtitle: 'Sinhala Subtitles',
      releaseDate: 'Dec. 20, 1974',
      imdbRating: 9.0,
      averageRating: 9.1,
      totalRatings: 1234
    }
  ];

  // Use sample movies if no movies provided
  const displayMovies = movies && movies.length > 0 ? movies : sampleMovies;

  return (
    <>
      {selectedMovie && (
        <MoviePlayer 
          movie={selectedMovie} 
          onClose={() => setSelectedMovie(null)} 
        />
      )}
      
      <div className="movie-grid-container">
        <div className="movie-grid">
        {displayMovies.map((movie, index) => (
          <div 
            key={movie._id} 
            className="movie-poster-card"
            onClick={() => navigate(`/movie/${movie._id}`)}
            style={{ cursor: 'pointer', '--index': index }}
          >
            {/* Movie Poster */}
            <div className="movie-poster">
              {movie.images && movie.images.length > 0 ? (
                <img 
                  src={movie.images[0]} 
                  alt={movie.title}
                  onError={(e) => handleImageError(e, movie.title)}
                />
              ) : movie.imageUrl ? (
                <img 
                  src={movie.imageUrl} 
                  alt={movie.title}
                  onError={(e) => handleImageError(e, movie.title)}
                />
              ) : (
                <img 
                  src={getMoviePlaceholder(movie.title)} 
                  alt={movie.title}
                  className="movie-placeholder-img"
                />
              )}
              
            </div>
            
            {/* Movie Info */}
            <div className="movie-info">
              <h3 className="movie-title-main">{movie.title}</h3>
              <div className="movie-year-main">{movie.year}</div>
              {movie.genre && (
                <div className="movie-genre-main">{movie.genre}</div>
              )}
              {movie.imdbRating && (
                <div className="movie-imdb-main">
                  🎬 IMDB: {movie.imdbRating.toFixed(1)}/10
                </div>
              )}
            </div>
          </div>
        ))}
        </div>
      </div>
    </>
  );
};

export default MovieGrid;
