const mongoose = require('mongoose');
const Movie = require('./models/Movie');
const TVShow = require('./models/TVShow');
require('dotenv').config({ path: './config.env' });

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
  
  // Using placeholder.com with better styling - creates a poster-like image
  const text = title.replace(/ /g, '+').substring(0, 30);
  return `https://via.placeholder.com/500x750/${color}/ffffff?text=${text}+(${year})`;
};

// Movie image mapping with better URLs
const movieImageMap = {
  "The Dark Knight": "https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
  "Inception": "https://image.tmdb.org/t/p/w500/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg",
  "Pulp Fiction": "https://image.tmdb.org/t/p/w500/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg",
  "The Shawshank Redemption": "https://image.tmdb.org/t/p/w500/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg",
  "The Godfather": "https://image.tmdb.org/t/p/w500/3bhkrj58Vtu7enYsRolD1fZdja1.jpg",
  "Forrest Gump": "https://image.tmdb.org/t/p/w500/arw2vcBveWOVZr6pxd9XTd1TdQa.jpg",
  "The Matrix": "https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
  "Goodfellas": "https://image.tmdb.org/t/p/w500/aKuFiU82s5ISJpGZp7YkIr3kCUd.jpg",
  "The Lord of the Rings: The Fellowship of the Ring": "https://image.tmdb.org/t/p/w500/6oom5QYQ2yQTMJIbnvbkBL9cHo6.jpg",
  "Fight Club": "https://image.tmdb.org/t/p/w500/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
  "The Lord of the Rings: The Two Towers": "https://image.tmdb.org/t/p/w500/5VTN0pR8gcqV3EPUHHfMGnJYN9L.jpg",
  "The Lord of the Rings: The Return of the King": "https://image.tmdb.org/t/p/w500/rCzpDGLbOoPwLjy3OAm5NUPOTrC.jpg",
  "The Good, the Bad and the Ugly": "https://image.tmdb.org/t/p/w500/bX2xnavhMYjWDoZp1VM6VnU1xwe.jpg",
  "12 Angry Men": "https://image.tmdb.org/t/p/w500/ppd84D2i9W8jXmsyInGyihiSyqz.jpg",
  "Schindler's List": "https://image.tmdb.org/t/p/w500/sF1U4EUQS8YHUYjNl3pMGNIQyr0.jpg",
  "The Dark Knight Rises": "https://image.tmdb.org/t/p/w500/85cWkCVftiVs0BVey6pxX8uNmLt.jpg",
  "The Godfather Part II": "https://image.tmdb.org/t/p/w500/hek3koDUyRQk7FIhPXsa6mT2Zc3.jpg",
  "Casablanca": "https://image.tmdb.org/t/p/w500/5K7cOHoay2mZusSLezBOY0Qxh8a.jpg",
  "The Godfather Part III": "https://image.tmdb.org/t/p/w500/lm3pQ2QoQ16pextRsmnUbG2onES.jpg",
  "The Silence of the Lambs": "https://image.tmdb.org/t/p/w500/uS9m8OBk1A8eM9I042bx8XXpqAq.jpg",
  "Saving Private Ryan": "https://image.tmdb.org/t/p/w500/uqx37cS8cpHg8U35f9U5I7rPEsI.jpg",
  "The Green Mile": "https://image.tmdb.org/t/p/w500/velWPhVMQeQKcxggNEU8YmIo52R.jpg",
  "The Departed": "https://image.tmdb.org/t/p/w500/nT97ifVT2J1yMQme7jHbB0nP5nz.jpg",
  "Gladiator": "https://image.tmdb.org/t/p/w500/ty8TGRuvJLPUmAR1H1nRIsgwvim.jpg",
  "The Lion King": "https://image.tmdb.org/t/p/w500/sKCr78MXSLixwmZ8DyJLrpMsd15.jpg",
  "Terminator 2: Judgment Day": "https://image.tmdb.org/t/p/w500/5M0j0B18abtBI5gi2RhfjjurTqb.jpg",
  "Back to the Future": "https://image.tmdb.org/t/p/w500/fNOH9f1aA7XRTzl1sAOx9iF553Q.jpg",
  "The Prestige": "https://image.tmdb.org/t/p/w500/5MXyQfz8xUP3dIFPTubhTsbFY6N.jpg",
  "The Usual Suspects": "https://image.tmdb.org/t/p/w500/qwy6SYVv5a4nfyaY9oTz1ZdEn3K.jpg",
  "Se7en": "https://image.tmdb.org/t/p/w500/69Sns8WoET6CfaYlIkHbla4l7nC.jpg",
  "The Sixth Sense": "https://image.tmdb.org/t/p/w500/isQy6o3m67Hs51vO2b23sq7KyNg.jpg",
  "Toy Story": "https://image.tmdb.org/t/p/w500/uXDfjJbdP4ijW5hWSBrPrlKpxab.jpg",
  "The Avengers": "https://image.tmdb.org/t/p/w500/RYMX2wcKCBAr24UyPD7xwmjaTn.jpg",
  "Interstellar": "https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
  "Joker": "https://image.tmdb.org/t/p/w500/udDclJoHjfjb8Ekgsd4FDteOkCU.jpg",
  "Spider-Man: Into the Spider-Verse": "https://image.tmdb.org/t/p/w500/iiZZdoQBEYBv6id8r7T1dGz2PmB.jpg",
  "Test Horror Movie 2025": "https://via.placeholder.com/500x750/8b0000/ffffff?text=Horror+2025"
};

// TV Show image mapping with better URLs
const tvShowImageMap = {
  "The Flash": "https://image.tmdb.org/t/p/w500/wHa6KOJAoNTFLFtp7wguUJKSnju.jpg",
  "Sex Education": "https://image.tmdb.org/t/p/w500/7JFLv7kAsn7Q3vMRlqTIY3EqMSk.jpg",
  "Arrow": "https://image.tmdb.org/t/p/w500/gKG5QGz5Ngf8fgWpBsWfhlLutJo.jpg",
  "House of the Dragon": "https://image.tmdb.org/t/p/w500/z2yahl2uefxDCl0nogcRBstwruJ.jpg",
  "Game of Thrones": "https://image.tmdb.org/t/p/w500/u3bZgnGQ9T01sWNhyveQz0wH0Hl.jpg",
  "Baddies of Hollywood": "https://via.placeholder.com/500x750/FF1493/ffffff?text=Baddies+of+Hollywood",
  "Farazi": "https://via.placeholder.com/500x750/4682B4/ffffff?text=Farazi",
  "Legend of the Seeker": "https://image.tmdb.org/t/p/w500/gj282P2piANJLvTADbTOOQ8OhxV.jpg",
  "Legends of Tomorrow": "https://image.tmdb.org/t/p/w500/8oI9Y2X4L7xqu4H0lRjwfp5ls8z.jpg",
  "The Witcher": "https://image.tmdb.org/t/p/w500/7vjaCdMw15FEbXyLQTVa04URsPm.jpg"
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

