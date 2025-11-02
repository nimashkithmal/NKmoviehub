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
    imageUrl: "https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
    movieUrl: "https://www.imdb.com/title/tt0468569/",
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
    imageUrl: "https://image.tmdb.org/t/p/w500/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg",
    movieUrl: "https://www.imdb.com/title/tt1375666/",
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
    imageUrl: "https://image.tmdb.org/t/p/w500/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg",
    movieUrl: "https://www.imdb.com/title/tt0110912/",
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
    imageUrl: "https://image.tmdb.org/t/p/w500/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg",
    movieUrl: "https://www.imdb.com/title/tt0111161/",
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
    imageUrl: "https://image.tmdb.org/t/p/w500/3bhkrj58Vtu7enYsRolD1fZdja1.jpg",
    movieUrl: "https://www.imdb.com/title/tt0068646/",
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
    imageUrl: "https://image.tmdb.org/t/p/w500/arw2vcBveWOVZr6pxd9XTd1TdQa.jpg",
    movieUrl: "https://www.imdb.com/title/tt0109830/",
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
    imageUrl: "https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
    movieUrl: "https://www.imdb.com/title/tt0133093/",
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
    imageUrl: "https://image.tmdb.org/t/p/w500/aKuFiU82s5ISJpGZp7YkIr3kCUd.jpg",
    movieUrl: "https://www.imdb.com/title/tt0099685/",
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
    imageUrl: "https://image.tmdb.org/t/p/w500/6oom5QYQ2yQTMJIbnvbkBL9cHo6.jpg",
    movieUrl: "https://www.imdb.com/title/tt0120737/",
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
    imageUrl: "https://image.tmdb.org/t/p/w500/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
    movieUrl: "https://www.imdb.com/title/tt0137523/",
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
    imageUrl: "https://image.tmdb.org/t/p/w500/5VTN0pR8gcqV3EPUHHfMGnJYN9L.jpg",
    movieUrl: "https://www.imdb.com/title/tt0167261/",
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
    imageUrl: "https://image.tmdb.org/t/p/w500/rCzpDGLbOoPwLjy3OAm5NUPOTrC.jpg",
    movieUrl: "https://www.imdb.com/title/tt0167260/",
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
    imageUrl: "https://image.tmdb.org/t/p/w500/bX2xnavhMYjWDoZp1VM6VnU1xwe.jpg",
    movieUrl: "https://www.imdb.com/title/tt0060196/",
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
    imageUrl: "https://image.tmdb.org/t/p/w500/ppd84D2i9W8jXmsyInGyihiSyqz.jpg",
    movieUrl: "https://www.imdb.com/title/tt0050083/",
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
    imageUrl: "https://image.tmdb.org/t/p/w500/sF1U4EUQS8YHUYjNl3pMGNIQyr0.jpg",
    movieUrl: "https://www.imdb.com/title/tt0108052/",
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
    imageUrl: "https://image.tmdb.org/t/p/w500/85cWkCVftiVs0BVey6pxX8uNmLt.jpg",
    movieUrl: "https://www.imdb.com/title/tt1345836/",
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
    imageUrl: "https://image.tmdb.org/t/p/w500/hek3koDUyRQk7FIhPXsa6mT2Zc3.jpg",
    movieUrl: "https://www.imdb.com/title/tt0071562/",
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
    imageUrl: "https://image.tmdb.org/t/p/w500/5K7cOHoay2mZusSLezBOY0Qxh8a.jpg",
    movieUrl: "https://www.imdb.com/title/tt0034583/",
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
    imageUrl: "https://image.tmdb.org/t/p/w500/lm3pQ2QoQ16pextRsmnUbG2onES.jpg",
    movieUrl: "https://www.imdb.com/title/tt0099674/",
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
    imageUrl: "https://image.tmdb.org/t/p/w500/uS9m8OBk1A8eM9I042bx8XXpqAq.jpg",
    movieUrl: "https://www.imdb.com/title/tt0102926/",
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
    imageUrl: "https://image.tmdb.org/t/p/w500/uqx37cS8cpHg8U35f9U5I7rPEsI.jpg",
    movieUrl: "https://www.imdb.com/title/tt0120815/",
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
    imageUrl: "https://image.tmdb.org/t/p/w500/velWPhVMQeQKcxggNEU8YmIo52R.jpg",
    movieUrl: "https://www.imdb.com/title/tt0120689/",
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
    imageUrl: "https://image.tmdb.org/t/p/w500/nT97ifVT2J1yMQme7jHbB0nP5nz.jpg",
    movieUrl: "https://www.imdb.com/title/tt0407887/",
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
    imageUrl: "https://image.tmdb.org/t/p/w500/ty8TGRuvJLPUmAR1H1nRIsgwvim.jpg",
    movieUrl: "https://www.imdb.com/title/tt0172495/",
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
    imageUrl: "https://image.tmdb.org/t/p/w500/sKCr78MXSLixwmZ8DyJLrpMsd15.jpg",
    movieUrl: "https://www.imdb.com/title/tt0110357/",
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
    imageUrl: "https://image.tmdb.org/t/p/w500/5M0j0B18abtBI5gi2RhfjjurTqb.jpg",
    movieUrl: "https://www.imdb.com/title/tt0103064/",
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
    imageUrl: "https://image.tmdb.org/t/p/w500/fNOH9f1aA7XRTzl1sAOx9iF553Q.jpg",
    movieUrl: "https://www.imdb.com/title/tt0088763/",
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
    imageUrl: "https://image.tmdb.org/t/p/w500/5MXyQfz8xUP3dIFPTubhTsbFY6N.jpg",
    movieUrl: "https://www.imdb.com/title/tt0482571/",
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
    imageUrl: "https://image.tmdb.org/t/p/w500/qwy6SYVv5a4nfyaY9oTz1ZdEn3K.jpg",
    movieUrl: "https://www.imdb.com/title/tt0114814/",
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
    imageUrl: "https://image.tmdb.org/t/p/w500/69Sns8WoET6CfaYlIkHbla4l7nC.jpg",
    movieUrl: "https://www.imdb.com/title/tt0114369/",
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
    imageUrl: "https://image.tmdb.org/t/p/w500/isQy6o3m67Hs51vO2b23sq7KyNg.jpg",
    movieUrl: "https://www.imdb.com/title/tt0167404/",
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
    imageUrl: "https://image.tmdb.org/t/p/w500/uXDfjJbdP4ijW5hWSBrPrlKpxab.jpg",
    movieUrl: "https://www.imdb.com/title/tt0114709/",
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
    imageUrl: "https://image.tmdb.org/t/p/w500/RYMX2wcKCBAr24UyPD7xwmjaTn.jpg",
    movieUrl: "https://www.imdb.com/title/tt0848228/",
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
    imageUrl: "https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
    movieUrl: "https://www.imdb.com/title/tt0816692/",
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
    imageUrl: "https://image.tmdb.org/t/p/w500/udDclJoHjfjb8Ekgsd4FDteOkCU.jpg",
    movieUrl: "https://www.imdb.com/title/tt7286456/",
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
    imageUrl: "https://image.tmdb.org/t/p/w500/iiZZdoQBEYBv6id8r7T1dGz2PmB.jpg",
    movieUrl: "https://www.imdb.com/title/tt4633694/",
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
    imageUrl: "https://via.placeholder.com/500x750/8b0000/ffffff?text=Horror+2025",
    movieUrl: "https://example.com/horror-2025",
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