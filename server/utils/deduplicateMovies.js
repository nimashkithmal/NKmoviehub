const mongoose = require('mongoose');
const Movie = require('../models/Movie');
const Rating = require('../models/Rating');
const Collection = require('../models/Collection');
const Banner = require('../models/Banner');
const MovieQuestion = require('../models/MovieQuestion');
const Notification = require('../models/Notification');
const CastTitleCache = require('../models/CastTitleCache');
const { extractTmdbId } = require('./trendingPopular');

const escapeRegex = (value = '') =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeTitle = (title = '') => String(title).trim().toLowerCase();

const movieKey = (movie = {}) => `${normalizeTitle(movie.title)}::${Number(movie.year) || 0}`;

const scoreMovie = (movie = {}) => {
  let score = 0;
  score += (movie.totalRatings || 0) * 100;
  score += Number(movie.averageRating) || 0;
  if (movie.bannerUrl) score += 20;
  if (movie.trailerUrl) score += 10;
  if (Array.isArray(movie.images) && movie.images.length > 1) score += 5;
  if (String(movie.description || '').length > 80) score += 2;
  if (movie.status === 'active') score += 3;
  if (movie.status === 'coming_soon') score += 2;
  return score;
};

const pickKeeper = (movies = []) => {
  const sorted = [...movies].sort((a, b) => {
    const scoreDiff = scoreMovie(b) - scoreMovie(a);
    if (scoreDiff !== 0) return scoreDiff;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
  return sorted[0];
};

async function findDuplicateGroups() {
  const grouped = await Movie.aggregate([
    {
      $group: {
        _id: {
          title: { $toLower: { $trim: { input: '$title' } } },
          year: '$year'
        },
        count: { $sum: 1 },
        ids: { $push: '$_id' }
      }
    },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1, '_id.title': 1 } }
  ]);

  const groups = [];
  for (const group of grouped) {
    const movies = await Movie.find({ _id: { $in: group.ids } }).lean();
    groups.push({
      key: `${group._id.title}::${group._id.year}`,
      title: movies[0]?.title || group._id.title,
      year: group._id.year,
      movies
    });
  }

  return groups;
}

async function reassignMovieReferences(keeperId, duplicateId) {
  const keeper = String(keeperId);
  const duplicate = String(duplicateId);

  const duplicateRatings = await Rating.find({ movie: duplicateId }).lean();
  for (const rating of duplicateRatings) {
    const conflict = await Rating.findOne({ user: rating.user, movie: keeperId }).lean();
    if (conflict) {
      await Rating.deleteOne({ _id: rating._id });
      continue;
    }
    await Rating.updateOne({ _id: rating._id }, { $set: { movie: keeperId } });
  }

  const collections = await Collection.find({ movies: duplicateId }).select('_id movies').lean();
  for (const collection of collections) {
    const nextMovies = (collection.movies || [])
      .map((id) => (String(id) === duplicate ? keeperId : id))
      .filter((id, index, arr) => arr.findIndex((item) => String(item) === String(id)) === index);
    await Collection.updateOne({ _id: collection._id }, { $set: { movies: nextMovies } });
  }

  await Banner.updateMany({ movie: duplicateId }, { $set: { movie: keeperId } });
  await MovieQuestion.updateMany({ movie: duplicateId }, { $set: { movie: keeperId } });
  await Notification.updateMany({ movie: duplicateId }, { $set: { movie: keeperId } });
  await CastTitleCache.deleteOne({ entityId: duplicateId, type: 'movie' });
}

async function mergeMovieFields(keeper, duplicate) {
  const updates = {};

  if (!keeper.bannerUrl && duplicate.bannerUrl) updates.bannerUrl = duplicate.bannerUrl;
  if (!keeper.trailerUrl && duplicate.trailerUrl) updates.trailerUrl = duplicate.trailerUrl;
  if (!keeper.director && duplicate.director) updates.director = duplicate.director;
  if (!keeper.language && duplicate.language) updates.language = duplicate.language;
  if (!keeper.tagline && duplicate.tagline) updates.tagline = duplicate.tagline;
  if (!keeper.releaseDate && duplicate.releaseDate) updates.releaseDate = duplicate.releaseDate;
  if (!keeper.runtime && duplicate.runtime) updates.runtime = duplicate.runtime;
  if (!keeper.budget && duplicate.budget) updates.budget = duplicate.budget;
  if (!keeper.revenue && duplicate.revenue) updates.revenue = duplicate.revenue;

  const keeperImages = new Set(keeper.images || []);
  (duplicate.images || []).forEach((url) => keeperImages.add(url));
  if (keeperImages.size > (keeper.images || []).length) {
    updates.images = Array.from(keeperImages);
  }

  if (Object.keys(updates).length) {
    await Movie.updateOne({ _id: keeper._id }, { $set: updates });
  }
}

async function deduplicateMovies({ dryRun = false } = {}) {
  const groups = await findDuplicateGroups();
  const summary = {
    dryRun,
    groups: groups.length,
    removed: 0,
    kept: [],
    removedTitles: []
  };

  for (const group of groups) {
    const keeper = pickKeeper(group.movies);
    const duplicates = group.movies.filter((movie) => String(movie._id) !== String(keeper._id));

    summary.kept.push({
      title: keeper.title,
      year: keeper.year,
      id: keeper._id
    });

    for (const duplicate of duplicates) {
      summary.removedTitles.push({
        title: duplicate.title,
        year: duplicate.year,
        id: duplicate._id,
        keptId: keeper._id
      });

      if (dryRun) continue;

      await reassignMovieReferences(keeper._id, duplicate._id);
      await mergeMovieFields(keeper, duplicate);
      await Movie.deleteOne({ _id: duplicate._id });
      summary.removed += 1;
    }
  }

  if (!dryRun) {
    const keeperDocs = await Movie.find({
      _id: { $in: summary.kept.map((item) => item.id) }
    });
    for (const movie of keeperDocs) {
      await movie.updateAverageRating();
    }
  }

  return summary;
}

async function findExistingMovieDuplicate({ title, year, movieUrl }) {
  const trimmedTitle = String(title || '').trim();
  const numericYear = Number(year);
  if (!trimmedTitle || !Number.isFinite(numericYear)) return null;

  const byTitle = await Movie.findOne({
    title: { $regex: `^${escapeRegex(trimmedTitle)}$`, $options: 'i' },
    year: numericYear
  }).select('_id title year movieUrl status').lean();

  if (byTitle) return byTitle;

  const tmdbId = extractTmdbId(movieUrl);
  if (!tmdbId) return null;

  const candidates = await Movie.find({
    movieUrl: { $regex: String(tmdbId) }
  })
    .select('_id title year movieUrl status')
    .lean();

  return (
    candidates.find((movie) => extractTmdbId(movie.movieUrl) === tmdbId) || null
  );
}

module.exports = {
  deduplicateMovies,
  findDuplicateGroups,
  findExistingMovieDuplicate,
  movieKey,
  normalizeTitle,
  pickKeeper
};
