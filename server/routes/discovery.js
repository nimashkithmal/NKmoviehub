const express = require('express');
const Movie = require('../models/Movie');
const TVShow = require('../models/TVShow');
const {
  extractTmdbId,
  extractTvTmdbId,
  fetchTrendingResults,
  orderDocsByTrending,
  pickNowPlayingIds,
  pickTopRatedIds
} = require('../utils/trendingPopular');

const router = express.Router();

const hydrateMovies = async (orderedIds, limit = 20) => {
  const pageIds = orderedIds.slice(0, limit);
  if (!pageIds.length) return [];
  const found = await Movie.find({
    _id: { $in: pageIds },
    status: 'active'
  })
    .select('-__v')
    .lean();
  const byId = new Map(found.map((m) => [String(m._id), m]));
  return pageIds.map((id) => byId.get(String(id))).filter(Boolean);
};

const hydrateTVShows = async (orderedIds, limit = 20) => {
  const pageIds = orderedIds.slice(0, limit);
  if (!pageIds.length) return [];
  const found = await TVShow.find({
    _id: { $in: pageIds },
    status: 'active'
  })
    .select('-__v')
    .lean();
  const byId = new Map(found.map((s) => [String(s._id), s]));
  return pageIds.map((id) => byId.get(String(id))).filter(Boolean);
};

const matchMovieIds = async (tmdbIds) => {
  if (!tmdbIds.length) return [];
  const candidates = await Movie.find({ status: 'active' })
    .select('_id movieUrl')
    .lean();
  return orderDocsByTrending(candidates, tmdbIds, (doc) =>
    extractTmdbId(doc.movieUrl)
  ).map((doc) => doc._id);
};

const matchTvIds = async (tmdbIds) => {
  if (!tmdbIds.length) return [];
  const candidates = await TVShow.find({ status: 'active' })
    .select('_id showUrl episodes.episodeUrl')
    .lean();
  return orderDocsByTrending(candidates, tmdbIds, extractTvTmdbId).map(
    (doc) => doc._id
  );
};

// @route   GET /api/discovery/home
// @desc    Live home rows from 2embed trending (matched to local catalog)
// @access  Public
router.get('/home', async (req, res) => {
  try {
    const limit = Math.min(30, Math.max(8, parseInt(req.query.limit, 10) || 20));

    // One movie + one TV trending request (sequential via shared queue), page 1 only.
    const weekMovies = await fetchTrendingResults('movie', 'week', 1);
    const weekTv = await fetchTrendingResults('tv', 'week', 1);

    const trendingIds = weekMovies
      .map((r) => (r?.tmdb_id != null ? String(r.tmdb_id) : ''))
      .filter(Boolean);

    const nowPlayingIds = pickNowPlayingIds(weekMovies, {
      days: 75,
      limit: 60
    });

    const topRatedIds = pickTopRatedIds(weekMovies, {
      limit: 60,
      minVotes: 20
    });

    const trendingTvIds = weekTv
      .map((r) => (r?.tmdb_id != null ? String(r.tmdb_id) : ''))
      .filter(Boolean);

    let trendingMovieIds = await matchMovieIds(trendingIds);
    let nowPlayingMovieIds = await matchMovieIds(nowPlayingIds);
    let topRatedMovieIds = await matchMovieIds(topRatedIds);
    let trendingShowIds = await matchTvIds(trendingTvIds);

    // If external trending is unavailable, fall back to local catalog order.
    if (!trendingMovieIds.length) {
      const fallbackMovies = await Movie.find({ status: 'active' })
        .sort({ imdbRating: -1, year: -1, createdAt: -1 })
        .select('_id')
        .limit(limit)
        .lean();
      trendingMovieIds = fallbackMovies.map((m) => m._id);
      nowPlayingMovieIds = trendingMovieIds;
      topRatedMovieIds = trendingMovieIds;
    }

    if (!trendingShowIds.length) {
      const fallbackShows = await TVShow.find({ status: 'active' })
        .sort({ imdbRating: -1, year: -1, createdAt: -1 })
        .select('_id')
        .limit(limit)
        .lean();
      trendingShowIds = fallbackShows.map((s) => s._id);
    }

    const [trendingNow, nowPlaying, topRatedMovies, trendingTVShows] =
      await Promise.all([
        hydrateMovies(trendingMovieIds, limit),
        hydrateMovies(nowPlayingMovieIds, limit),
        hydrateMovies(topRatedMovieIds, limit),
        hydrateTVShows(trendingShowIds, limit)
      ]);

    res.json({
      success: true,
      data: {
        trendingNow,
        nowPlaying,
        trendingTVShows,
        topRatedMovies,
        meta: {
          source: weekMovies.length || weekTv.length ? 'live' : 'catalog',
          refreshedAt: new Date().toISOString(),
          cacheMinutes: 15
        }
      }
    });
  } catch (error) {
    console.error('Discovery home error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while loading home discovery'
    });
  }
});

module.exports = router;
