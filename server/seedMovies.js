const mongoose = require('mongoose');
const Movie = require('./models/Movie');
const User = require('./models/User');
require('dotenv').config({ path: './config.env' });

const sampleMovies = [
  {
    title: "The Shawshank Redemption",
    year: 1994,
    description: "Two imprisoned men bond over a number of years, finding solace and eventual redemption through acts of common decency.",
    genre: "Drama",
    imageUrl: "https://images.unsplash.com/photo-1489599832527-2f113c0cd765?w=500&h=750&fit=crop",
    movieUrl: "https://www.imdb.com/title/tt0111161/",
    averageRating: 9.3,
    totalRatings: 1250,
    status: "active"
  },
  {
    title: "The Godfather",
    year: 1972,
    description: "The aging patriarch of an organized crime dynasty transfers control of his clandestine empire to his reluctant son.",
    genre: "Crime",
    imageUrl: "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=500&h=750&fit=crop",
    movieUrl: "https://www.imdb.com/title/tt0068646/",
    averageRating: 9.2,
    totalRatings: 980,
    status: "active"
  },
  {
    title: "Pulp Fiction",
    year: 1994,
    description: "The lives of two mob hitmen, a boxer, a gangster and his wife, and a pair of diner bandits intertwine in four tales of violence and redemption.",
    genre: "Crime",
    imageUrl: "https://images.unsplash.com/photo-1489599832527-2f113c0cd765?w=500&h=750&fit=crop",
    movieUrl: "https://www.imdb.com/title/tt0110912/",
    averageRating: 8.9,
    totalRatings: 750,
    status: "active"
  },
  {
    title: "The Dark Knight",
    year: 2008,
    description: "When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests of his ability to fight injustice.",
    genre: "Action",
    imageUrl: "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=500&h=750&fit=crop",
    movieUrl: "https://www.imdb.com/title/tt0468569/",
    averageRating: 9.0,
    totalRatings: 1100,
    status: "active"
  },
  {
    title: "Forrest Gump",
    year: 1994,
    description: "The presidencies of Kennedy and Johnson, the Vietnam War, the Watergate scandal and other historical events unfold from the perspective of an Alabama man with an IQ of 75.",
    genre: "Drama",
    imageUrl: "https://images.unsplash.com/photo-1489599832527-2f113c0cd765?w=500&h=750&fit=crop",
    movieUrl: "https://www.imdb.com/title/tt0109830/",
    averageRating: 8.8,
    totalRatings: 650,
    status: "active"
  },
  {
    title: "Inception",
    year: 2010,
    description: "A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.",
    genre: "Sci-Fi",
    imageUrl: "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=500&h=750&fit=crop",
    movieUrl: "https://www.imdb.com/title/tt1375666/",
    averageRating: 8.8,
    totalRatings: 600,
    status: "active"
  }
];

const seedMovies = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get admin user for adding movies
    const adminUser = await User.findOne({ email: 'admin@gmail.com' });
    if (!adminUser) {
      console.log('❌ Admin user not found. Please run seedDatabase.js first.');
      process.exit(1);
    }

    // Clear existing movies
    await Movie.deleteMany({});
    console.log('🗑️  Cleared existing movies');

    // Add sample movies with admin user as addedBy
    const moviesWithUser = sampleMovies.map(movie => ({
      ...movie,
      addedBy: adminUser._id
    }));

    const createdMovies = await Movie.insertMany(moviesWithUser);
    console.log(`✅ Added ${createdMovies.length} sample movies to the database`);

    // Display added movies
    console.log('\n📽️  Sample Movies Added:');
    createdMovies.forEach(movie => {
      console.log(`   • ${movie.title} (${movie.year}) - ${movie.genre}`);
    });

    console.log('\n🎉 Movie seeding completed successfully!');
    console.log('🌐 You can now view movies at: http://localhost:3000');
    
  } catch (error) {
    console.error('❌ Error seeding movies:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

// Run the seeding function
seedMovies(); 