const mongoose = require('mongoose');
const Movie = require('./models/Movie');
const TVShow = require('./models/TVShow');
require('dotenv').config({ path: './config.env' });

const migrateImagesToArray = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    console.log('\n📽️  Migrating Movie Images...\n');
    
    // Migrate movies
    const movies = await Movie.find({});
    let moviesUpdated = 0;

    for (const movie of movies) {
      let needsUpdate = false;
      
      // If images array doesn't exist or is empty, but imageUrl exists, add it to images
      if ((!movie.images || movie.images.length === 0) && movie.imageUrl) {
        movie.images = [movie.imageUrl];
        needsUpdate = true;
      } else if (movie.images && movie.images.length > 0) {
        // Ensure imageUrl is set to the first image if not set
        if (!movie.imageUrl && movie.images[0]) {
          movie.imageUrl = movie.images[0];
          needsUpdate = true;
        }
        // Ensure imageUrl is in images array if not already
        if (movie.imageUrl && !movie.images.includes(movie.imageUrl)) {
          movie.images.unshift(movie.imageUrl);
          needsUpdate = true;
        }
      }
      
      if (needsUpdate) {
        await movie.save();
        console.log(`✅ Updated: ${movie.title} - ${movie.images.length} image(s)`);
        moviesUpdated++;
      }
    }

    console.log(`\n📺 Migrating TV Show Images...\n`);
    
    // Migrate TV shows
    const tvShows = await TVShow.find({});
    let tvShowsUpdated = 0;

    for (const tvShow of tvShows) {
      let needsUpdate = false;
      
      // If images array doesn't exist or is empty, but imageUrl exists, add it to images
      if ((!tvShow.images || tvShow.images.length === 0) && tvShow.imageUrl) {
        tvShow.images = [tvShow.imageUrl];
        needsUpdate = true;
      } else if (tvShow.images && tvShow.images.length > 0) {
        // Ensure imageUrl is set to the first image if not set
        if (!tvShow.imageUrl && tvShow.images[0]) {
          tvShow.imageUrl = tvShow.images[0];
          needsUpdate = true;
        }
        // Ensure imageUrl is in images array if not already
        if (tvShow.imageUrl && !tvShow.images.includes(tvShow.imageUrl)) {
          tvShow.images.unshift(tvShow.imageUrl);
          needsUpdate = true;
        }
      }
      
      if (needsUpdate) {
        await tvShow.save();
        console.log(`✅ Updated: ${tvShow.title} - ${tvShow.images.length} image(s)`);
        tvShowsUpdated++;
      }
    }

    // Display summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`\n🎬 Movies:`);
    console.log(`   ✅ Updated: ${moviesUpdated}`);
    console.log(`   📊 Total: ${movies.length}`);
    
    console.log(`\n📺 TV Shows:`);
    console.log(`   ✅ Updated: ${tvShowsUpdated}`);
    console.log(`   📊 Total: ${tvShows.length}`);
    
    console.log('\n🎉 Image migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Error migrating images:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

// Run the migration
migrateImagesToArray();

