const mongoose = require('mongoose');
const TVShow = require('./models/TVShow');
const User = require('./models/User');
require('dotenv').config({ path: './config.env' });

// The Flash TV Series (2014-2023) - All 9 seasons with episodes
const generateFlashEpisodes = () => {
  // Define all seasons with their episodes
  const seasons = [
    {
      seasonNumber: 1,
      episodes: [
        { title: "Pilot", url: "https://example.com/flash/s01e01" },
        { title: "Fastest Man Alive", url: "https://example.com/flash/s01e02" },
        { title: "Things You Can't Outrun", url: "https://example.com/flash/s01e03" },
        { title: "Going Rogue", url: "https://example.com/flash/s01e04" },
        { title: "Plastique", url: "https://example.com/flash/s01e05" },
        { title: "The Flash is Born", url: "https://example.com/flash/s01e06" },
        { title: "Power Outage", url: "https://example.com/flash/s01e07" },
        { title: "Flash vs. Arrow", url: "https://example.com/flash/s01e08" },
        { title: "The Man in the Yellow Suit", url: "https://example.com/flash/s01e09" },
        { title: "Revenge of the Rogues", url: "https://example.com/flash/s01e10" },
        { title: "The Sound and the Fury", url: "https://example.com/flash/s01e11" },
        { title: "Crazy for You", url: "https://example.com/flash/s01e12" },
        { title: "The Nuclear Man", url: "https://example.com/flash/s01e13" },
        { title: "Fallout", url: "https://example.com/flash/s01e14" },
        { title: "Out of Time", url: "https://example.com/flash/s01e15" },
        { title: "Rogue Time", url: "https://example.com/flash/s01e16" },
        { title: "Tricksters", url: "https://example.com/flash/s01e17" },
        { title: "All-Star Team Up", url: "https://example.com/flash/s01e18" },
        { title: "Who is Harrison Wells?", url: "https://example.com/flash/s01e19" },
        { title: "The Trap", url: "https://example.com/flash/s01e20" },
        { title: "Grodd Lives", url: "https://example.com/flash/s01e21" },
        { title: "Rogue Air", url: "https://example.com/flash/s01e22" },
        { title: "Fast Enough", url: "https://example.com/flash/s01e23" }
      ]
    },
    {
      seasonNumber: 2,
      episodes: [
        { title: "The Man Who Saved Central City", url: "https://example.com/flash/s02e01" },
        { title: "Flash of Two Worlds", url: "https://example.com/flash/s02e02" },
        { title: "Family of Rogues", url: "https://example.com/flash/s02e03" },
        { title: "The Fury of Firestorm", url: "https://example.com/flash/s02e04" },
        { title: "The Darkness and the Light", url: "https://example.com/flash/s02e05" },
        { title: "Enter Zoom", url: "https://example.com/flash/s02e06" },
        { title: "Gorilla Warfare", url: "https://example.com/flash/s02e07" },
        { title: "Legends of Today", url: "https://example.com/flash/s02e08" },
        { title: "Running to Stand Still", url: "https://example.com/flash/s02e09" },
        { title: "Potential Energy", url: "https://example.com/flash/s02e10" },
        { title: "The Reverse-Flash Returns", url: "https://example.com/flash/s02e11" },
        { title: "Fast Lane", url: "https://example.com/flash/s02e12" },
        { title: "Welcome to Earth-2", url: "https://example.com/flash/s02e13" },
        { title: "Escape from Earth-2", url: "https://example.com/flash/s02e14" },
        { title: "King Shark", url: "https://example.com/flash/s02e15" },
        { title: "Trajectory", url: "https://example.com/flash/s02e16" },
        { title: "Flash Back", url: "https://example.com/flash/s02e17" },
        { title: "Versus Zoom", url: "https://example.com/flash/s02e18" },
        { title: "Back to Normal", url: "https://example.com/flash/s02e19" },
        { title: "Rupture", url: "https://example.com/flash/s02e20" },
        { title: "The Runaway Dinosaur", url: "https://example.com/flash/s02e21" },
        { title: "Invincible", url: "https://example.com/flash/s02e22" },
        { title: "The Race of His Life", url: "https://example.com/flash/s02e23" }
      ]
    },
    {
      seasonNumber: 3,
      episodes: [
        { title: "Flashpoint", url: "https://example.com/flash/s03e01" },
        { title: "Paradox", url: "https://example.com/flash/s03e02" },
        { title: "Magenta", url: "https://example.com/flash/s03e03" },
        { title: "The New Rogues", url: "https://example.com/flash/s03e04" },
        { title: "Monster", url: "https://example.com/flash/s03e05" },
        { title: "Shade", url: "https://example.com/flash/s03e06" },
        { title: "Killer Frost", url: "https://example.com/flash/s03e07" },
        { title: "Invasion!", url: "https://example.com/flash/s03e08" },
        { title: "The Present", url: "https://example.com/flash/s03e09" },
        { title: "Borrowing Problems from the Future", url: "https://example.com/flash/s03e10" },
        { title: "Dead or Alive", url: "https://example.com/flash/s03e11" },
        { title: "Untouchable", url: "https://example.com/flash/s03e12" },
        { title: "Attack on Gorilla City", url: "https://example.com/flash/s03e13" },
        { title: "Attack on Central City", url: "https://example.com/flash/s03e14" },
        { title: "The Wrath of Savitar", url: "https://example.com/flash/s03e15" },
        { title: "Into the Speed Force", url: "https://example.com/flash/s03e16" },
        { title: "Duet", url: "https://example.com/flash/s03e17" },
        { title: "Abra Kadabra", url: "https://example.com/flash/s03e18" },
        { title: "The Once and Future Flash", url: "https://example.com/flash/s03e19" },
        { title: "I Know Who You Are", url: "https://example.com/flash/s03e20" },
        { title: "Cause and Effect", url: "https://example.com/flash/s03e21" },
        { title: "Infantino Street", url: "https://example.com/flash/s03e22" },
        { title: "Finish Line", url: "https://example.com/flash/s03e23" }
      ]
    },
    {
      seasonNumber: 4,
      episodes: [
        { title: "The Flash Reborn", url: "https://example.com/flash/s04e01" },
        { title: "Mixed Signals", url: "https://example.com/flash/s04e02" },
        { title: "Luck Be a Lady", url: "https://example.com/flash/s04e03" },
        { title: "Elongated Journey into Night", url: "https://example.com/flash/s04e04" },
        { title: "Girls Night Out", url: "https://example.com/flash/s04e05" },
        { title: "When Harry Met Harry...", url: "https://example.com/flash/s04e06" },
        { title: "Therefore I Am", url: "https://example.com/flash/s04e07" },
        { title: "Crisis on Earth-X, Part 3", url: "https://example.com/flash/s04e08" },
        { title: "Don't Run", url: "https://example.com/flash/s04e09" },
        { title: "The Trial of The Flash", url: "https://example.com/flash/s04e10" },
        { title: "The Elongated Knight Rises", url: "https://example.com/flash/s04e11" },
        { title: "Honey, I Shrunk Team Flash", url: "https://example.com/flash/s04e12" },
        { title: "True Colors", url: "https://example.com/flash/s04e13" },
        { title: "Subject 9", url: "https://example.com/flash/s04e14" },
        { title: "Enter Flashtime", url: "https://example.com/flash/s04e15" },
        { title: "Run, Iris, Run", url: "https://example.com/flash/s04e16" },
        { title: "Null and Annoyed", url: "https://example.com/flash/s04e17" },
        { title: "Lose Yourself", url: "https://example.com/flash/s04e18" },
        { title: "Fury Rogue", url: "https://example.com/flash/s04e19" },
        { title: "Therefore She Is", url: "https://example.com/flash/s04e20" },
        { title: "Harry and the Harrisons", url: "https://example.com/flash/s04e21" },
        { title: "Think Fast", url: "https://example.com/flash/s04e22" },
        { title: "We Are The Flash", url: "https://example.com/flash/s04e23" }
      ]
    },
    {
      seasonNumber: 5,
      episodes: [
        { title: "Nora", url: "https://example.com/flash/s05e01" },
        { title: "Blocked", url: "https://example.com/flash/s05e02" },
        { title: "The Death of Vibe", url: "https://example.com/flash/s05e03" },
        { title: "News Flash", url: "https://example.com/flash/s05e04" },
        { title: "All Doll'd Up", url: "https://example.com/flash/s05e05" },
        { title: "The Icicle Cometh", url: "https://example.com/flash/s05e06" },
        { title: "O Come, All Ye Thankful", url: "https://example.com/flash/s05e07" },
        { title: "What's Past is Prologue", url: "https://example.com/flash/s05e08" },
        { title: "Elseworlds, Part 1", url: "https://example.com/flash/s05e09" },
        { title: "The Flash & The Furious", url: "https://example.com/flash/s05e10" },
        { title: "Seeing Red", url: "https://example.com/flash/s05e11" },
        { title: "Memorabilia", url: "https://example.com/flash/s05e12" },
        { title: "Goldfaced", url: "https://example.com/flash/s05e13" },
        { title: "Cause and XS", url: "https://example.com/flash/s05e14" },
        { title: "King Shark vs. Gorilla Grodd", url: "https://example.com/flash/s05e15" },
        { title: "Failure is an Orphan", url: "https://example.com/flash/s05e16" },
        { title: "Time Bomb", url: "https://example.com/flash/s05e17" },
        { title: "Godspeed", url: "https://example.com/flash/s05e18" },
        { title: "Snow Pack", url: "https://example.com/flash/s05e19" },
        { title: "Gone Rogue", url: "https://example.com/flash/s05e20" },
        { title: "The Girl with the Red Lightning", url: "https://example.com/flash/s05e21" },
        { title: "Legacy", url: "https://example.com/flash/s05e22" }
      ]
    },
    {
      seasonNumber: 6,
      episodes: [
        { title: "Into the Void", url: "https://example.com/flash/s06e01" },
        { title: "A Flash of the Lightning", url: "https://example.com/flash/s06e02" },
        { title: "Dead Man Running", url: "https://example.com/flash/s06e03" },
        { title: "There Will Be Blood", url: "https://example.com/flash/s06e04" },
        { title: "Kiss Kiss Breach Breach", url: "https://example.com/flash/s06e05" },
        { title: "License to Elongate", url: "https://example.com/flash/s06e06" },
        { title: "The Last Temptation of Barry Allen, Pt. 1", url: "https://example.com/flash/s06e07" },
        { title: "The Last Temptation of Barry Allen, Pt. 2", url: "https://example.com/flash/s06e08" },
        { title: "Crisis on Infinite Earths: Part Three", url: "https://example.com/flash/s06e09" },
        { title: "Marathon", url: "https://example.com/flash/s06e10" },
        { title: "Love is a Battlefield", url: "https://example.com/flash/s06e11" },
        { title: "A Girl Named Sue", url: "https://example.com/flash/s06e12" },
        { title: "Grodd Friended Me", url: "https://example.com/flash/s06e13" },
        { title: "Death of the Speed Force", url: "https://example.com/flash/s06e14" },
        { title: "The Exorcism of Nash Wells", url: "https://example.com/flash/s06e15" },
        { title: "So Long and Goodnight", url: "https://example.com/flash/s06e16" },
        { title: "Liberation", url: "https://example.com/flash/s06e17" },
        { title: "Pay the Piper", url: "https://example.com/flash/s06e18" },
        { title: "Success is Assured", url: "https://example.com/flash/s06e19" }
      ]
    },
    {
      seasonNumber: 7,
      episodes: [
        { title: "All's Wells That Ends Wells", url: "https://example.com/flash/s07e01" },
        { title: "The Speed of Thought", url: "https://example.com/flash/s07e02" },
        { title: "Mother", url: "https://example.com/flash/s07e03" },
        { title: "Central City Strong", url: "https://example.com/flash/s07e04" },
        { title: "Fear Me", url: "https://example.com/flash/s07e05" },
        { title: "The One with the Nineties", url: "https://example.com/flash/s07e06" },
        { title: "Growing Pains", url: "https://example.com/flash/s07e07" },
        { title: "The People v. Killer Frost", url: "https://example.com/flash/s07e08" },
        { title: "Timeless", url: "https://example.com/flash/s07e09" },
        { title: "Family Matters, Part 1", url: "https://example.com/flash/s07e10" },
        { title: "Family Matters, Part 2", url: "https://example.com/flash/s07e11" },
        { title: "Good-Bye Vibrations", url: "https://example.com/flash/s07e12" },
        { title: "Masquerade", url: "https://example.com/flash/s07e13" },
        { title: "Rayo de Luz", url: "https://example.com/flash/s07e14" },
        { title: "Enemy at the Gates", url: "https://example.com/flash/s07e15" },
        { title: "P.O.W.", url: "https://example.com/flash/s07e16" },
        { title: "Heart of the Matter, Part 1", url: "https://example.com/flash/s07e17" },
        { title: "Heart of the Matter, Part 2", url: "https://example.com/flash/s07e18" }
      ]
    },
    {
      seasonNumber: 8,
      episodes: [
        { title: "Armageddon, Part 1", url: "https://example.com/flash/s08e01" },
        { title: "Armageddon, Part 2", url: "https://example.com/flash/s08e02" },
        { title: "Armageddon, Part 3", url: "https://example.com/flash/s08e03" },
        { title: "Armageddon, Part 4", url: "https://example.com/flash/s08e04" },
        { title: "Armageddon, Part 5", url: "https://example.com/flash/s08e05" },
        { title: "Impulsive Excessive Disorder", url: "https://example.com/flash/s08e06" },
        { title: "Lockdown", url: "https://example.com/flash/s08e07" },
        { title: "The Fire Next Time", url: "https://example.com/flash/s08e08" },
        { title: "Phantoms", url: "https://example.com/flash/s08e09" },
        { title: "Reckless", url: "https://example.com/flash/s08e10" },
        { title: "The Mask of the Red Death, Part 1", url: "https://example.com/flash/s08e11" },
        { title: "The Mask of the Red Death, Part 2", url: "https://example.com/flash/s08e12" },
        { title: "Death Falls", url: "https://example.com/flash/s08e13" },
        { title: "Funeral for a Friend", url: "https://example.com/flash/s08e14" },
        { title: "Into the Still Force", url: "https://example.com/flash/s08e15" },
        { title: "The Curious Case of Bartholomew Allen", url: "https://example.com/flash/s08e16" },
        { title: "Keep It Dark", url: "https://example.com/flash/s08e17" },
        { title: "The Man in the Yellow Tie", url: "https://example.com/flash/s08e18" },
        { title: "Negative, Part 1", url: "https://example.com/flash/s08e19" },
        { title: "Negative, Part 2", url: "https://example.com/flash/s08e20" }
      ]
    },
    {
      seasonNumber: 9,
      episodes: [
        { title: "Wednesday Ever After", url: "https://example.com/flash/s09e01" },
        { title: "Hear No Evil", url: "https://example.com/flash/s09e02" },
        { title: "Rogues of War", url: "https://example.com/flash/s09e03" },
        { title: "The Mask of the Red Death, Part 3", url: "https://example.com/flash/s09e04" },
        { title: "The Good, the Bad and the Lucky", url: "https://example.com/flash/s09e05" },
        { title: "I Know You", url: "https://example.com/flash/s09e06" },
        { title: "Wildest Dreams", url: "https://example.com/flash/s09e07" },
        { title: "Partners in Time", url: "https://example.com/flash/s09e08" },
        { title: "It's My Party and I'll Die If I Want To", url: "https://example.com/flash/s09e09" },
        { title: "A New World, Part 1: Reunions", url: "https://example.com/flash/s09e10" },
        { title: "A New World, Part 2: Reunions", url: "https://example.com/flash/s09e11" },
        { title: "A New World, Part 3: Finale", url: "https://example.com/flash/s09e12" },
        { title: "A New World, Part 4: Finale", url: "https://example.com/flash/s09e13" }
      ]
    }
  ];

  // Flatten all seasons into a single array with sequential episode numbers
  let globalEpisodeNumber = 1;
  const allEpisodes = [];

  seasons.forEach(season => {
    season.episodes.forEach(episode => {
      allEpisodes.push({
        episodeNumber: globalEpisodeNumber++,
        episodeUrl: episode.url,
        episodeTitle: episode.title
      });
    });
  });

  return allEpisodes;
};

const seedFlashTVShow = async () => {
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

    // Check if The Flash already exists
    const existingFlash = await TVShow.findOne({ title: 'The Flash' });
    if (existingFlash) {
      console.log('⚠️  The Flash already exists in database. Deleting old entry...');
      await TVShow.deleteOne({ _id: existingFlash._id });
    }

    // Generate all episodes
    const episodes = generateFlashEpisodes();

    // Create The Flash TV show
    const theFlash = new TVShow({
      title: "The Flash",
      year: 2014,
      description: "After being struck by lightning, Barry Allen wakes up from his coma to discover he's been given the power of super speed, becoming the Flash. He fights crime in Central City alongside other metahumans as a member of Team Flash, facing numerous villains including the Reverse-Flash, Zoom, Savitar, and others.",
      genre: "Action",
      imageUrl: "https://via.placeholder.com/300x450/ff6600/ffffff?text=The+Flash",
      showUrl: "https://example.com/flash/s01e01",
      episodeCount: episodes.length,
      numberOfSeasons: 9,
      episodes: episodes,
      imdbRating: 7.6,
      averageRating: 8.0,
      totalRatings: 3420,
      status: "active",
      addedBy: adminUser._id
    });

    await theFlash.save();
    console.log(`✅ Successfully added The Flash TV series to the database`);
    console.log(`   • Title: The Flash`);
    console.log(`   • Year: 2014`);
    console.log(`   • Genre: Action`);
    console.log(`   • Seasons: 9`);
    console.log(`   • Total Episodes: ${episodes.length}`);
    console.log(`   • IMDB Rating: 7.6/10`);
    
    // Display season breakdown
    console.log('\n📺 Season Breakdown:');
    const seasonCounts = [23, 23, 23, 23, 22, 19, 18, 20, 13];
    seasonCounts.forEach((count, index) => {
      console.log(`   Season ${index + 1}: ${count} episodes`);
    });

    console.log('\n🎉 The Flash seeding completed successfully!');
    console.log('🌐 You can now view The Flash at: http://localhost:3000');
    
  } catch (error) {
    console.error('❌ Error seeding The Flash:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

// Run the seeding function
seedFlashTVShow();

