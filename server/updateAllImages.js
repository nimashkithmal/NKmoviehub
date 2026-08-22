const mongoose = require('mongoose');
const Movie = require('./models/Movie');
const TVShow = require('./models/TVShow');
require('dotenv').config({ path: './config.env' });
const { generatePlaceholderImage } = require('./utils/placeholderImage');
const { movieImageMap, tvShowImageMap } = require('./utils/posterLibrary');

// Helper function to generate better quality image URL
// Using TMDB CDN format or high-quality placeholder service
const getBetterImageUrl = (title, year, type = 'movie') => {
  // Remove special characters and format title for URL
  const cleanTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  // Using a high-quality placeholder service with movie/TV show specific styling
  // You can replace these with actual TMDB URLs if you have TMDB IDs
  const colors = {
    'movie': {
      'action': 'FF6B35',
      'sci-fi': '0F0F23',
      'crime': '1A0F0F',
      'drama': '2D1B1B',
      'thriller': '1A1A1A',
      'adventure': '2D4A2D',
      'western': '8B4513',
      'animation': '4A90E2',
      'war': '8B0000',
      'horror': '8B0000',
      'comedy': 'FFD700',
      'fantasy': '6A5ACD'
    },
    'tvshow': {
      'action': '006400',
      'comedy': 'FF6B9D',
      'fantasy': '8B0000',
      'reality tv': 'FF1493',
      'thriller': '4682B4',
      'drama': '2D1B1B',
      'sci-fi': '0000FF'
    }
  };
  
  const genre = title.toLowerCase();
  let color = '4A90E2'; // default blue
  
  // Try to match genre based on title or use default
  if (genre.includes('action') || genre.includes('arrow') || genre.includes('legend')) {
    color = type === 'movie' ? colors.movie.action : colors.tvshow.action;
  } else if (genre.includes('comedy') || genre.includes('sex education')) {
    color = type === 'movie' ? colors.movie.comedy : colors.tvshow.comedy;
  } else if (genre.includes('fantasy') || genre.includes('game of thrones') || genre.includes('witcher') || genre.includes('dragon') || genre.includes('seeker')) {
    color = type === 'movie' ? colors.movie.fantasy : colors.tvshow.fantasy;
  } else if (genre.includes('thriller') || genre.includes('farazi')) {
    color = type === 'movie' ? colors.movie.thriller : colors.tvshow.thriller;
  } else if (genre.includes('sci-fi') || genre.includes('matrix') || genre.includes('inception') || genre.includes('interstellar')) {
    color = type === 'movie' ? colors.movie['sci-fi'] : colors.tvshow['sci-fi'];
  } else if (genre.includes('crime') || genre.includes('godfather') || genre.includes('pulp') || genre.includes('goodfellas')) {
    color = colors.movie.crime;
  } else if (genre.includes('drama')) {
    color = colors.movie.drama;
  } else if (genre.includes('horror')) {
    color = colors.movie.horror;
  } else if (genre.includes('reality') || genre.includes('baddies')) {
    color = colors.tvshow['reality tv'];
  }
  
  // Locally generated SVG poster - no external placeholder service to go down
  return generatePlaceholderImage(500, 750, `${title.substring(0, 30)} (${year})`, color, 'ffffff');
};

const updateAllImages = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    console.log('\n📽️  Updating Movie Images...\n');
    
    // Update all movies
    const movies = await Movie.find({});
    let moviesUpdated = 0;
    let moviesSkipped = 0;

    for (const movie of movies) {
      const newImageUrl = movieImageMap[movie.title] || getBetterImageUrl(movie.title, movie.year, 'movie');
      
      if (movie.imageUrl === newImageUrl) {
        console.log(`⏭️  Skipped: ${movie.title} (already has good image)`);
        moviesSkipped++;
        continue;
      }

      movie.imageUrl = newImageUrl;
      await movie.save();
      console.log(`✅ Updated: ${movie.title}`);
      moviesUpdated++;
    }

    console.log(`\n📺 Updating TV Show Images...\n`);
    
    // Update all TV shows
    const tvShows = await TVShow.find({});
    let tvShowsUpdated = 0;
    let tvShowsSkipped = 0;

    for (const tvShow of tvShows) {
      const newImageUrl = tvShowImageMap[tvShow.title] || getBetterImageUrl(tvShow.title, tvShow.year, 'tvshow');
      
      if (tvShow.imageUrl === newImageUrl) {
        console.log(`⏭️  Skipped: ${tvShow.title} (already has good image)`);
        tvShowsSkipped++;
        continue;
      }

      tvShow.imageUrl = newImageUrl;
      await tvShow.save();
      console.log(`✅ Updated: ${tvShow.title}`);
      tvShowsUpdated++;
    }

    // Display summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 IMAGE UPDATE SUMMARY');
    console.log('='.repeat(60));
    console.log(`\n🎬 Movies:`);
    console.log(`   ✅ Updated: ${moviesUpdated}`);
    console.log(`   ⏭️  Skipped: ${moviesSkipped}`);
    console.log(`   📊 Total: ${movies.length}`);
    
    console.log(`\n📺 TV Shows:`);
    console.log(`   ✅ Updated: ${tvShowsUpdated}`);
    console.log(`   ⏭️  Skipped: ${tvShowsSkipped}`);
    console.log(`   📊 Total: ${tvShows.length}`);
    
    console.log(`\n✨ Total Updated: ${moviesUpdated + tvShowsUpdated}`);
    console.log('\n🎉 All images updated successfully!');
    console.log('🌐 View your updated content at: http://localhost:3000');
    
  } catch (error) {
    console.error('❌ Error updating images:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

// Run the update function
updateAllImages();

