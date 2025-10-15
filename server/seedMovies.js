const mongoose = require('mongoose');
const Movie = require('./models/Movie');
const User = require('./models/User');
require('dotenv').config({ path: './config.env' });

const sampleMovies = [
  {
    title: "The Dark Knight",
    year: 2008,
    description: "When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests of his ability to fight injustice.",
    genre: "Action",
    imageUrl: "https://via.placeholder.com/300x450/1a1a1a/ffffff?text=The+Dark+Knight",
    movieUrl: "https://www.imdb.com/title/tt0468569/",
    downloadUrl: "https://example.com/download/the-dark-knight",
    imdbRating: 9.0,
    averageRating: 9.2,
    totalRatings: 2847,
    status: "active"
  },
  {
    title: "Inception",
    year: 2010,
    description: "A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.",
    genre: "Sci-Fi",
    imageUrl: "https://via.placeholder.com/300x450/0f0f23/ffffff?text=Inception",
    movieUrl: "https://www.imdb.com/title/tt1375666/",
    downloadUrl: "https://example.com/download/inception",
    imdbRating: 8.8,
    averageRating: 8.9,
    totalRatings: 2156,
    status: "active"
  },
  {
    title: "Pulp Fiction",
    year: 1994,
    description: "The lives of two mob hitmen, a boxer, a gangster and his wife, and a pair of diner bandits intertwine in four tales of violence and redemption.",
    genre: "Crime",
    imageUrl: "https://via.placeholder.com/300x450/2d1b1b/ffffff?text=Pulp+Fiction",
    movieUrl: "https://www.imdb.com/title/tt0110912/",
    downloadUrl: "https://example.com/download/pulp-fiction",
    imdbRating: 8.9,
    averageRating: 9.1,
    totalRatings: 1892,
    status: "active"
  },
  {
    title: "The Shawshank Redemption",
    year: 1994,
    description: "Two imprisoned men bond over a number of years, finding solace and eventual redemption through acts of common decency.",
    genre: "Drama",
    imageUrl: "https://via.placeholder.com/300x450/1a2332/ffffff?text=Shawshank",
    movieUrl: "https://www.imdb.com/title/tt0111161/",
    downloadUrl: "https://example.com/download/shawshank-redemption",
    imdbRating: 9.3,
    averageRating: 9.4,
    totalRatings: 3245,
    status: "active"
  },
  {
    title: "The Godfather",
    year: 1972,
    description: "The aging patriarch of an organized crime dynasty transfers control of his clandestine empire to his reluctant son.",
    genre: "Crime",
    imageUrl: "https://via.placeholder.com/300x450/2c1810/ffffff?text=The+Godfather",
    movieUrl: "https://www.imdb.com/title/tt0068646/",
    downloadUrl: "https://example.com/download/the-godfather",
    imdbRating: 9.2,
    averageRating: 9.3,
    totalRatings: 1987,
    status: "active"
  },
  {
    title: "Forrest Gump",
    year: 1994,
    description: "The presidencies of Kennedy and Johnson, the Vietnam War, the Watergate scandal and other historical events unfold from the perspective of an Alabama man with an IQ of 75.",
    genre: "Drama",
    imageUrl: "https://via.placeholder.com/300x450/2d4a2d/ffffff?text=Forrest+Gump",
    movieUrl: "https://www.imdb.com/title/tt0109830/",
    downloadUrl: "https://example.com/download/forrest-gump",
    imdbRating: 8.8,
    averageRating: 8.9,
    totalRatings: 2156,
    status: "active"
  },
  {
    title: "The Matrix",
    year: 1999,
    description: "A computer hacker learns from mysterious rebels about the true nature of his reality and his role in the war against its controllers.",
    genre: "Sci-Fi",
    imageUrl: "https://via.placeholder.com/300x450/0d0d0d/00ff00?text=The+Matrix",
    movieUrl: "https://www.imdb.com/title/tt0133093/",
    downloadUrl: "https://example.com/download/the-matrix",
    imdbRating: 8.7,
    averageRating: 8.8,
    totalRatings: 1876,
    status: "active"
  },
  {
    title: "Goodfellas",
    year: 1990,
    description: "The story of Henry Hill and his life in the mob, covering his relationship with his wife Karen Hill and his mob partners Jimmy Conway and Tommy DeVito.",
    genre: "Crime",
    imageUrl: "https://via.placeholder.com/300x450/1a0f0f/ffffff?text=Goodfellas",
    movieUrl: "https://www.imdb.com/title/tt0099685/",
    downloadUrl: "https://example.com/download/goodfellas",
    imdbRating: 8.7,
    averageRating: 8.8,
    totalRatings: 1234,
    status: "active"
  },
  {
    title: "The Lord of the Rings: The Fellowship of the Ring",
    year: 2001,
    description: "A meek Hobbit from the Shire and eight companions set out on a journey to destroy the powerful One Ring and save Middle-earth from the Dark Lord Sauron.",
    genre: "Adventure",
    imageUrl: "https://via.placeholder.com/300x450/2d4a2d/ffffff?text=LOTR+FOTR",
    movieUrl: "https://www.imdb.com/title/tt0120737/",
    downloadUrl: "https://example.com/download/lotr-fellowship",
    imdbRating: 8.8,
    averageRating: 8.9,
    totalRatings: 2456,
    status: "active"
  },
  {
    title: "Fight Club",
    year: 1999,
    description: "An insomniac office worker and a devil-may-care soap maker form an underground fight club that evolves into much more.",
    genre: "Drama",
    imageUrl: "https://via.placeholder.com/300x450/2d1b1b/ffffff?text=Fight+Club",
    movieUrl: "https://www.imdb.com/title/tt0137523/",
    downloadUrl: "https://example.com/download/fight-club",
    imdbRating: 8.8,
    averageRating: 8.9,
    totalRatings: 1987,
    status: "active"
  },
  {
    title: "The Lord of the Rings: The Two Towers",
    year: 2002,
    description: "While Frodo and Sam edge closer to Mordor with the help of the shifty Gollum, the divided fellowship makes a stand against Sauron's new ally, Saruman.",
    genre: "Adventure",
    imageUrl: "https://via.placeholder.com/300x450/1a2d1a/ffffff?text=LOTR+TTO",
    movieUrl: "https://www.imdb.com/title/tt0167261/",
    downloadUrl: "https://example.com/download/lotr-two-towers",
    imdbRating: 8.7,
    averageRating: 8.8,
    totalRatings: 2234,
    status: "active"
  },
  {
    title: "The Lord of the Rings: The Return of the King",
    year: 2003,
    description: "Gandalf and Aragorn lead the World of Men against Sauron's army to draw his gaze from Frodo and Sam as they approach Mount Doom.",
    genre: "Adventure",
    imageUrl: "https://via.placeholder.com/300x450/0d1a0d/ffffff?text=LOTR+ROTK",
    movieUrl: "https://www.imdb.com/title/tt0167260/",
    downloadUrl: "https://example.com/download/lotr-return-king",
    imdbRating: 8.9,
    averageRating: 9.0,
    totalRatings: 2678,
    status: "active"
  },
  {
    title: "The Good, the Bad and the Ugly",
    year: 1966,
    description: "A bounty hunting scam joins two men in an uneasy alliance against a third in a race to find a fortune in gold buried in a remote cemetery.",
    genre: "Western",
    imageUrl: "https://via.placeholder.com/300x450/2d1b0d/ffffff?text=The+Good+Bad+Ugly",
    movieUrl: "https://www.imdb.com/title/tt0060196/",
    downloadUrl: "https://example.com/download/good-bad-ugly",
    imdbRating: 8.8,
    averageRating: 8.9,
    totalRatings: 876,
    status: "active"
  },
  {
    title: "12 Angry Men",
    year: 1957,
    description: "A jury holdout attempts to prevent a miscarriage of justice by forcing his colleagues to reconsider the evidence.",
    genre: "Drama",
    imageUrl: "https://via.placeholder.com/300x450/1a1a1a/ffffff?text=12+Angry+Men",
    movieUrl: "https://www.imdb.com/title/tt0050083/",
    downloadUrl: "https://example.com/download/12-angry-men",
    imdbRating: 9.0,
    averageRating: 9.1,
    totalRatings: 654,
    status: "active"
  },
  {
    title: "Schindler's List",
    year: 1993,
    description: "In German-occupied Poland during World War II, industrialist Oskar Schindler gradually becomes concerned for his Jewish workforce.",
    genre: "Drama",
    imageUrl: "https://via.placeholder.com/300x450/0d0d0d/ffffff?text=Schindler+List",
    movieUrl: "https://www.imdb.com/title/tt0108052/",
    downloadUrl: "https://example.com/download/schindlers-list",
    imdbRating: 8.9,
    averageRating: 9.0,
    totalRatings: 1456,
    status: "active"
  },
  {
    title: "The Dark Knight Rises",
    year: 2012,
    description: "Eight years after the Joker's reign of anarchy, Batman, with the help of the enigmatic Catwoman, is forced from his exile to save Gotham City.",
    genre: "Action",
    imageUrl: "https://via.placeholder.com/300x450/1a0d0d/ffffff?text=Dark+Knight+Rises",
    movieUrl: "https://www.imdb.com/title/tt1345836/",
    downloadUrl: "https://example.com/download/dark-knight-rises",
    imdbRating: 8.4,
    averageRating: 8.5,
    totalRatings: 1987,
    status: "active"
  },
  {
    title: "The Godfather Part II",
    year: 1974,
    description: "The early life and career of Vito Corleone in 1920s New York City is portrayed, while his son, Michael, expands and tightens his grip on the family crime syndicate.",
    genre: "Crime",
    imageUrl: "https://via.placeholder.com/300x450/1a0f0a/ffffff?text=Godfather+II",
    movieUrl: "https://www.imdb.com/title/tt0071562/",
    downloadUrl: "https://example.com/download/godfather-2",
    imdbRating: 9.0,
    averageRating: 9.1,
    totalRatings: 1234,
    status: "active"
  },
  {
    title: "Casablanca",
    year: 1942,
    description: "A cynical expatriate American cafe owner struggles to decide whether or not to help his former lover and her fugitive husband escape the Nazis in French Morocco.",
    genre: "Drama",
    imageUrl: "https://via.placeholder.com/300x450/2d1b0d/ffffff?text=Casablanca",
    movieUrl: "https://www.imdb.com/title/tt0034583/",
    downloadUrl: "https://example.com/download/casablanca",
    imdbRating: 8.5,
    averageRating: 8.6,
    totalRatings: 567,
    status: "active"
  },
  {
    title: "The Godfather Part III",
    year: 1990,
    description: "In the final installment of the Godfather trilogy, an aging Don Michael Corleone seeks to legitimize his crime family's power and finally make a business of it.",
    genre: "Crime",
    imageUrl: "https://via.placeholder.com/300x450/1a0f0a/ffffff?text=Godfather+III",
    movieUrl: "https://www.imdb.com/title/tt0099674/",
    downloadUrl: "https://example.com/download/godfather-3",
    imdbRating: 7.6,
    averageRating: 7.7,
    totalRatings: 789,
    status: "active"
  },
  {
    title: "The Silence of the Lambs",
    year: 1991,
    description: "A young F.B.I. cadet must receive the help of an incarcerated and manipulative cannibal killer to help catch another serial killer, a madman who skins his victims.",
    genre: "Thriller",
    imageUrl: "https://via.placeholder.com/300x450/2d1b1b/ffffff?text=Silence+of+Lambs",
    movieUrl: "https://www.imdb.com/title/tt0102926/",
    downloadUrl: "https://example.com/download/silence-lambs",
    imdbRating: 8.6,
    averageRating: 8.7,
    totalRatings: 1234,
    status: "active"
  },
  {
    title: "Saving Private Ryan",
    year: 1998,
    description: "Following the Normandy Landings, a group of U.S. soldiers go behind enemy lines to retrieve a paratrooper whose brothers have been killed in action.",
    genre: "War",
    imageUrl: "https://via.placeholder.com/300x450/1a2d1a/ffffff?text=Saving+Private+Ryan",
    movieUrl: "https://www.imdb.com/title/tt0120815/",
    downloadUrl: "https://example.com/download/saving-private-ryan",
    imdbRating: 8.6,
    averageRating: 8.7,
    totalRatings: 1456,
    status: "active"
  },
  {
    title: "The Green Mile",
    year: 1999,
    description: "The lives of guards on Death Row are affected by one of their charges: a black man accused of child murder and rape, yet who has a mysterious gift.",
    genre: "Drama",
    imageUrl: "https://via.placeholder.com/300x450/0d2d0d/ffffff?text=Green+Mile",
    movieUrl: "https://www.imdb.com/title/tt0120689/",
    downloadUrl: "https://example.com/download/green-mile",
    imdbRating: 8.6,
    averageRating: 8.7,
    totalRatings: 1234,
    status: "active"
  },
  {
    title: "The Departed",
    year: 2006,
    description: "An undercover cop and a mob informant both attempt to identify each other while infiltrating an Irish gang in South Boston.",
    genre: "Crime",
    imageUrl: "https://via.placeholder.com/300x450/1a0f0f/ffffff?text=The+Departed",
    movieUrl: "https://www.imdb.com/title/tt0407887/",
    downloadUrl: "https://example.com/download/the-departed",
    imdbRating: 8.5,
    averageRating: 8.6,
    totalRatings: 1456,
    status: "active"
  },
  {
    title: "Gladiator",
    year: 2000,
    description: "A former Roman General sets out to exact vengeance against the corrupt emperor who murdered his family and sent him into slavery.",
    genre: "Action",
    imageUrl: "https://via.placeholder.com/300x450/2d1b0d/ffffff?text=Gladiator",
    movieUrl: "https://www.imdb.com/title/tt0172495/",
    downloadUrl: "https://example.com/download/gladiator",
    imdbRating: 8.5,
    averageRating: 8.6,
    totalRatings: 1789,
    status: "active"
  },
  {
    title: "The Lion King",
    year: 1994,
    description: "Lion prince Simba and his father are targeted by his bitter uncle, who wants to ascend the throne himself.",
    genre: "Animation",
    imageUrl: "https://via.placeholder.com/300x450/2d4a2d/ffffff?text=Lion+King",
    movieUrl: "https://www.imdb.com/title/tt0110357/",
    downloadUrl: "https://example.com/download/lion-king",
    imdbRating: 8.5,
    averageRating: 8.6,
    totalRatings: 2345,
    status: "active"
  },
  {
    title: "Terminator 2: Judgment Day",
    year: 1991,
    description: "A cyborg, identical to the one who failed to kill Sarah Connor, must now protect her teenage son, John Connor, from a more advanced and powerful cyborg.",
    genre: "Sci-Fi",
    imageUrl: "https://via.placeholder.com/300x450/0d0d0d/ff0000?text=Terminator+2",
    movieUrl: "https://www.imdb.com/title/tt0103064/",
    downloadUrl: "https://example.com/download/terminator-2",
    imdbRating: 8.6,
    averageRating: 8.7,
    totalRatings: 1567,
    status: "active"
  },
  {
    title: "Back to the Future",
    year: 1985,
    description: "Marty McFly, a 17-year-old high school student, is accidentally sent thirty years into the past in a time-traveling DeLorean invented by his close friend, the maverick scientist Doc Brown.",
    genre: "Sci-Fi",
    imageUrl: "https://via.placeholder.com/300x450/0f0f23/ffffff?text=Back+to+Future",
    movieUrl: "https://www.imdb.com/title/tt0088763/",
    downloadUrl: "https://example.com/download/back-to-future",
    imdbRating: 8.5,
    averageRating: 8.6,
    totalRatings: 1234,
    status: "active"
  },
  {
    title: "The Prestige",
    year: 2006,
    description: "After a tragic accident, two stage magicians in 1890s London engage in a battle to create the ultimate illusion while sacrificing everything they have to outwit each other.",
    genre: "Thriller",
    imageUrl: "https://via.placeholder.com/300x450/1a1a1a/ffffff?text=The+Prestige",
    movieUrl: "https://www.imdb.com/title/tt0482571/",
    downloadUrl: "https://example.com/download/the-prestige",
    imdbRating: 8.5,
    averageRating: 8.6,
    totalRatings: 1234,
    status: "active"
  },
  {
    title: "The Usual Suspects",
    year: 1995,
    description: "A sole survivor tells of the twisty events leading up to a horrific gun battle on a boat, which began when five criminals met at a seemingly random police lineup.",
    genre: "Crime",
    imageUrl: "https://via.placeholder.com/300x450/2d1b1b/ffffff?text=Usual+Suspects",
    movieUrl: "https://www.imdb.com/title/tt0114814/",
    downloadUrl: "https://example.com/download/usual-suspects",
    imdbRating: 8.5,
    averageRating: 8.6,
    totalRatings: 987,
    status: "active"
  },
  {
    title: "Se7en",
    year: 1995,
    description: "Two detectives, a rookie and a veteran, hunt a serial killer who uses the seven deadly sins as his motives.",
    genre: "Thriller",
    imageUrl: "https://via.placeholder.com/300x450/0d0d0d/ffffff?text=Se7en",
    movieUrl: "https://www.imdb.com/title/tt0114369/",
    downloadUrl: "https://example.com/download/se7en",
    imdbRating: 8.6,
    averageRating: 8.7,
    totalRatings: 1234,
    status: "active"
  },
  {
    title: "The Sixth Sense",
    year: 1999,
    description: "A boy who communicates with spirits seeks the help of a disheartened child psychologist.",
    genre: "Thriller",
    imageUrl: "https://via.placeholder.com/300x450/1a0d0d/ffffff?text=Sixth+Sense",
    movieUrl: "https://www.imdb.com/title/tt0167404/",
    downloadUrl: "https://example.com/download/sixth-sense",
    imdbRating: 8.1,
    averageRating: 8.2,
    totalRatings: 1456,
    status: "active"
  },
  {
    title: "Toy Story",
    year: 1995,
    description: "A cowboy doll is profoundly threatened and jealous when a new spaceman figure supplants him as top toy in a boy's room.",
    genre: "Animation",
    imageUrl: "https://via.placeholder.com/300x450/2d4a2d/ffffff?text=Toy+Story",
    movieUrl: "https://www.imdb.com/title/tt0114709/",
    downloadUrl: "https://example.com/download/toy-story",
    imdbRating: 8.3,
    averageRating: 8.4,
    totalRatings: 2345,
    status: "active"
  },
  {
    title: "The Avengers",
    year: 2012,
    description: "Earth's mightiest heroes must come together and learn to fight as a team if they are going to stop the mischievous Loki and his alien army from enslaving humanity.",
    genre: "Action",
    imageUrl: "https://via.placeholder.com/300x450/1e3a8a/ffffff?text=The+Avengers",
    movieUrl: "https://www.imdb.com/title/tt0848228/",
    downloadUrl: "https://example.com/download/the-avengers",
    imdbRating: 8.0,
    averageRating: 8.2,
    totalRatings: 1856,
    status: "active"
  },
  {
    title: "Interstellar",
    year: 2014,
    description: "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival.",
    genre: "Sci-Fi",
    imageUrl: "https://via.placeholder.com/300x450/0f172a/ffffff?text=Interstellar",
    movieUrl: "https://www.imdb.com/title/tt0816692/",
    downloadUrl: "https://example.com/download/interstellar",
    imdbRating: 8.6,
    averageRating: 8.7,
    totalRatings: 2156,
    status: "active"
  },
  {
    title: "Joker",
    year: 2019,
    description: "During the 1980s, a failed stand-up comedian is driven insane and turns to a life of crime and chaos in Gotham City while becoming an infamous psychopathic crime figure.",
    genre: "Drama",
    imageUrl: "https://via.placeholder.com/300x450/7c2d12/ffffff?text=Joker",
    movieUrl: "https://www.imdb.com/title/tt7286456/",
    downloadUrl: "https://example.com/download/joker",
    imdbRating: 8.4,
    averageRating: 8.6,
    totalRatings: 1890,
    status: "active"
  },
  {
    title: "Spider-Man: Into the Spider-Verse",
    year: 2018,
    description: "Teen Miles Morales becomes Spider-Man of his reality, crossing his path with five counterparts from other dimensions to stop a threat for all realities.",
    genre: "Animation",
    imageUrl: "https://via.placeholder.com/300x450/8b5cf6/ffffff?text=Spider-Verse",
    movieUrl: "https://www.imdb.com/title/tt4633694/",
    downloadUrl: "https://example.com/download/spider-verse",
    imdbRating: 8.4,
    averageRating: 8.6,
    totalRatings: 1456,
    status: "active"
  },
  {
    title: "Test Horror Movie 2025",
    year: 2025,
    description: "A terrifying horror movie from the future that will scare you to death.",
    genre: "Horror",
    imageUrl: "https://via.placeholder.com/300x450/8b0000/ffffff?text=Horror+2025",
    movieUrl: "https://example.com/horror-2025",
    downloadUrl: "https://example.com/download/horror-2025",
    imdbRating: 8.5,
    averageRating: 8.7,
    totalRatings: 1234,
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