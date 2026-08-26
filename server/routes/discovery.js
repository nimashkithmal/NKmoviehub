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

    const [weekMovies, dayMovies, monthMovies, weekTv] = await Promise.all([
      fetchTrendingResults('movie', 'week', 6),
      fetchTrendingResults('movie', 'day', 4),
      fetchTrendingResults('movie', 'month', 6),
      fetchTrendingResults('tv', 'week', 6)
    ]);

    const trendingIds = weekMovies
      .map((r) => (r?.tmdb_id != null ? String(r.tmdb_id) : ''))
      .filter(Boolean);

    // Recent theatrical releases from day+week trending
    const nowPlayingSource = [...dayMovies, ...weekMovies];
    const nowPlayingSeen = new Set();
    const nowPlayingMerged = [];
    for (const row of nowPlayingSource) {
      const id = row?.tmdb_id != null ? String(row.tmdb_id) : '';
      if (!id || nowPlayingSeen.has(id)) continue;
      nowPlayingSeen.add(id);
      nowPlayingMerged.push(row);
    }
    const nowPlayingIds = pickNowPlayingIds(nowPlayingMerged, {
      days: 75,
      limit: 60
    });

    // Top rated from week+month trending by vote_average
    const ratedSource = [...weekMovies, ...monthMovies];
    const ratedSeen = new Set();
    const ratedMerged = [];
    for (const row of ratedSource) {
      const id = row?.tmdb_id != null ? String(row.tmdb_id) : '';
      if (!id || ratedSeen.has(id)) continue;
      ratedSeen.add(id);
      ratedMerged.push(row);
    }
    const topRatedIds = pickTopRatedIds(ratedMerged, {
      limit: 60,
      minVotes: 20
    });

    const trendingTvIds = weekTv
      .map((r) => (r?.tmdb_id != null ? String(r.tmdb_id) : ''))
      .filter(Boolean);

    const [trendingMovieIds, nowPlayingMovieIds, topRatedMovieIds, trendingShowIds] =
      await Promise.all([
        matchMovieIds(trendingIds),
        matchMovieIds(nowPlayingIds),
        matchMovieIds(topRatedIds),
        matchTvIds(trendingTvIds)
      ]);

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
          source: '2embed',
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
