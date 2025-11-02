const mongoose = require('mongoose');
const TVShow = require('./models/TVShow');
const User = require('./models/User');
require('dotenv').config({ path: './config.env' });

// TV Shows to add
const tvShowsToAdd = [
  {
    title: "Sex Education",
    year: 2019,
    description: "A teenage boy with a sex therapist mother teams up with a high school classmate to set up an underground sex therapy clinic at school.",
    genre: "Comedy",
    imageUrl: "https://image.tmdb.org/t/p/w500/7JFLv7kAsn7Q3vMRlqTIY3EqMSk.jpg",
    showUrl: "https://example.com/sex-education/s01e01",
    episodeCount: 32,
    numberOfSeasons: 4,
    episodes: [], // Will be populated with basic episode structure
    imdbRating: 8.3,
    averageRating: 8.5,
    totalRatings: 1500
  },
  {
    title: "Arrow",
    year: 2012,
    description: "Spoiled billionaire playboy Oliver Queen is missing and presumed dead when his yacht is lost at sea. He returns five years later a changed man, determined to clean up the city as a hooded vigilante armed with a bow.",
    genre: "Action",
    imageUrl: "https://image.tmdb.org/t/p/w500/gKG5QGz5Ngf8fgWpBsWfhlLutJo.jpg",
    showUrl: "https://example.com/arrow/s01e01",
    episodeCount: 170,
    numberOfSeasons: 8,
    episodes: [],
    imdbRating: 7.5,
    averageRating: 7.8,
    totalRatings: 8500
  },
  {
    title: "House of the Dragon",
    year: 2022,
    description: "An internal succession war within House Targaryen at the height of its power, 172 years before the birth of Daenerys Targaryen.",
    genre: "Fantasy",
    imageUrl: "https://image.tmdb.org/t/p/w500/z2yahl2uefxDCl0nogcRBstwruJ.jpg",
    showUrl: "https://example.com/house-of-the-dragon/s01e01",
    episodeCount: 10,
    numberOfSeasons: 1,
    episodes: [],
    imdbRating: 8.5,
    averageRating: 8.7,
    totalRatings: 4500
  },
  {
    title: "Game of Thrones",
    year: 2011,
    description: "Nine noble families fight for control over the lands of Westeros, while an ancient enemy returns after being dormant for millennia.",
    genre: "Fantasy",
    imageUrl: "https://image.tmdb.org/t/p/w500/u3bZgnGQ9T01sWNhyveQz0wH0Hl.jpg",
    showUrl: "https://example.com/game-of-thrones/s01e01",
    episodeCount: 73,
    numberOfSeasons: 8,
    episodes: [],
    imdbRating: 9.2,
    averageRating: 9.3,
    totalRatings: 25000
  },
  {
    title: "Baddies of Hollywood",
    year: 2023,
    description: "A reality series following a group of strong, independent women in Hollywood as they navigate the entertainment industry and build their empires.",
    genre: "Reality TV",
    imageUrl: "https://via.placeholder.com/500x750/FF1493/ffffff?text=Baddies+of+Hollywood",
    showUrl: "https://example.com/baddies-hollywood/s01e01",
    episodeCount: 12,
    numberOfSeasons: 1,
    episodes: [],
    imdbRating: 6.5,
    averageRating: 6.8,
    totalRatings: 800
  },
  {
    title: "Farazi",
    year: 2022,
    description: "A gripping thriller series following a detective investigating mysterious cases in a small town where nothing is as it seems.",
    genre: "Thriller",
    imageUrl: "https://via.placeholder.com/500x750/4682B4/ffffff?text=Farazi",
    showUrl: "https://example.com/farazi/s01e01",
    episodeCount: 8,
    numberOfSeasons: 1,
    episodes: [],
    imdbRating: 7.8,
    averageRating: 8.0,
    totalRatings: 1200
  },
  {
    title: "Legend of the Seeker",
    year: 2008,
    description: "After the mysterious murder of his father, a son's search for answers begins a momentous fight against tyranny.",
    genre: "Fantasy",
    imageUrl: "https://image.tmdb.org/t/p/w500/gj282P2piANJLvTADbTOOQ8OhxV.jpg",
    showUrl: "https://example.com/legend-seeker/s01e01",
    episodeCount: 44,
    numberOfSeasons: 2,
    episodes: [],
    imdbRating: 7.6,
    averageRating: 7.8,
    totalRatings: 3200
  },
  {
    title: "Legends of Tomorrow",
    year: 2016,
    description: "A team of superheroes travels through time to save the world from various threats and prevent the destruction of time itself.",
    genre: "Action",
    imageUrl: "https://image.tmdb.org/t/p/w500/8oI9Y2X4L7xqu4H0lRjwfp5ls8z.jpg",
    showUrl: "https://example.com/legends-tomorrow/s01e01",
    episodeCount: 110,
    numberOfSeasons: 7,
    episodes: [],
    imdbRating: 6.9,
    averageRating: 7.2,
    totalRatings: 5200
  },
  {
    title: "The Witcher",
    year: 2019,
    description: "Geralt of Rivia, a mutated monster-hunter for hire, journeys toward his destiny in a turbulent world where people often prove more wicked than beasts.",
    genre: "Fantasy",
    imageUrl: "https://image.tmdb.org/t/p/w500/7vjaCdMw15FEbXyLQTVa04URsPm.jpg",
    showUrl: "https://example.com/witcher/s01e01",
    episodeCount: 24,
    numberOfSeasons: 3,
    episodes: [],
    imdbRating: 8.2,
    averageRating: 8.4,
    totalRatings: 6500
  }
];

// Helper function to generate basic episode structure
const generateBasicEpisodes = (title, episodeCount) => {
  const episodes = [];
  for (let i = 1; i <= episodeCount; i++) {
    episodes.push({
      episodeNumber: i,
      episodeUrl: `https://example.com/${title.toLowerCase().replace(/\s+/g, '-')}/ep${i}`,
      episodeTitle: `Episode ${i}`
    });
  }
  return episodes;
};

const seedNewTVShows = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get admin user for adding TV shows
    const adminUser = await User.findOne({ email: 'admin@gmail.com' });
    if (!adminUser) {
      console.log('❌ Admin user not found. Please run seedDatabase.js first.');
      process.exit(1);
    }

    console.log(`\n📺 Starting to add ${tvShowsToAdd.length} TV shows...\n`);

    const addedShows = [];
    const skippedShows = [];

    for (const showData of tvShowsToAdd) {
      // Check if show already exists
      const existingShow = await TVShow.findOne({ title: showData.title });
      if (existingShow) {
        console.log(`⚠️  "${showData.title}" already exists. Skipping...`);
        skippedShows.push(showData.title);
        continue;
      }

      // Generate episodes
      const episodes = generateBasicEpisodes(showData.title, showData.episodeCount);
      
      // Create TV show
      const tvShow = new TVShow({
        ...showData,
        episodes: episodes,
        addedBy: adminUser._id
      });

      await tvShow.save();
      addedShows.push({
        title: showData.title,
        year: showData.year,
        genre: showData.genre,
        seasons: showData.numberOfSeasons,
        episodes: showData.episodeCount
      });

      console.log(`✅ Added: ${showData.title} (${showData.year}) - ${showData.genre}`);
    }

    // Display summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SEEDING SUMMARY');
    console.log('='.repeat(60));
    console.log(`\n✅ Successfully added: ${addedShows.length} TV shows`);
    
    if (addedShows.length > 0) {
      console.log('\n📺 Added TV Shows:');
      addedShows.forEach((show, index) => {
        console.log(`   ${index + 1}. ${show.title} (${show.year})`);
        console.log(`      • Genre: ${show.genre}`);
        console.log(`      • Seasons: ${show.seasons} | Episodes: ${show.episodes}`);
      });
    }

    if (skippedShows.length > 0) {
      console.log(`\n⚠️  Skipped (already exist): ${skippedShows.length} TV shows`);
      skippedShows.forEach((title, index) => {
        console.log(`   ${index + 1}. ${title}`);
      });
    }

    console.log('\n🎉 TV Shows seeding completed successfully!');
    console.log('🌐 You can now view the TV shows at: http://localhost:3000');
    
  } catch (error) {
    console.error('❌ Error seeding TV shows:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

// Run the seeding function
seedNewTVShows();

