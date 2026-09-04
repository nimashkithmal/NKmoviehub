const Movie = require('../models/Movie');
const { extractTmdbId } = require('./trendingPopular');

const escapeRegex = (value = '') =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Prevent adding a movie that already exists by title+year or TMDB id in movieUrl. */
async function findExistingMovieDuplicate({ title, year, movieUrl }) {
  const trimmedTitle = String(title || '').trim();
  const numericYear = Number(year);
  if (!trimmedTitle || !Number.isFinite(numericYear)) return null;

  const byTitle = await Movie.findOne({
    title: { $regex: `^${escapeRegex(trimmedTitle)}$`, $options: 'i' },
    year: numericYear
  })
    .select('_id title year movieUrl status')
    .lean();

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
  findExistingMovieDuplicate
};
