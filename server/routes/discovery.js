const express = require('express');
const Movie = require('../models/Movie');
const TVShow = require('../models/TVShow');
const {
  extractTmdbId,
  extractTvTmdbId,
  fetchTrendingResults,
  pickNowPlayingIds,
  pickTopRatedIds
} = require('../utils/trendingPopular');
const { filterPublicItems } = require('../utils/contentPolicy');

const router = express.Router();

const HOME_CACHE_TTL_MS = 15 * 60 * 1000;
const TMDB_MAP_TTL_MS = 5 * 60 * 1000;

let homeResponseCache = { payload: null, at: 0 };
let movieTmdbMapCache = { map: null, at: 0 };
let tvTmdbMapCache = { map: null, at: 0 };

const hydrateMovies = async (orderedIds, limit = 20) => {
  const pageIds = orderedIds.slice(0, limit);
  if (!pageIds.length) return [];
  const found = await Movie.find({
    _id: { $in: pageIds },
    status: 'active',
    policyRestricted: { $ne: true }
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
    status: 'active',
    policyRestricted: { $ne: true }
  })
    .select('-__v')
    .lean();
  const byId = new Map(found.map((s) => [String(s._id), s]));
  return pageIds.map((id) => byId.get(String(id))).filter(Boolean);
};

const matchIdsFromMap = (tmdbIds, map) => {
  const out = [];
  const seen = new Set();
  for (const tid of tmdbIds) {
    const docId = map.get(String(tid));
    if (!docId) continue;
    const key = String(docId);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(docId);
  }
  return out;
};

const getMovieTmdbMap = async () => {
  const now = Date.now();
  if (movieTmdbMapCache.map && now - movieTmdbMapCache.at < TMDB_MAP_TTL_MS) {
    return movieTmdbMapCache.map;
  }

  const candidates = await Movie.find({ status: 'active', policyRestricted: { $ne: true } })
    .select('_id movieUrl')
    .lean();

  const map = new Map();
  for (const doc of candidates) {
    const tmdbId = extractTmdbId(doc.movieUrl);
    if (tmdbId) map.set(String(tmdbId), doc._id);
  }

  movieTmdbMapCache = { map, at: now };
  return map;
};

const getTvTmdbMap = async () => {
  const now = Date.now();
  if (tvTmdbMapCache.map && now - tvTmdbMapCache.at < TMDB_MAP_TTL_MS) {
    return tvTmdbMapCache.map;
  }

  const candidates = await TVShow.find({ status: 'active', policyRestricted: { $ne: true } })
    .select('_id showUrl episodes.episodeUrl')
    .lean();

  const map = new Map();
  for (const doc of candidates) {
    const tmdbId = extractTvTmdbId(doc);
    if (tmdbId) map.set(String(tmdbId), doc._id);
  }

  tvTmdbMapCache = { map, at: now };
  return map;
};

const buildLocalFallback = async (limit) => {
  const [fallbackMovies, fallbackShows] = await Promise.all([
    Movie.find({ status: 'active', policyRestricted: { $ne: true } })
      .sort({ imdbRating: -1, year: -1, createdAt: -1 })
      .select('-__v')
      .limit(limit)
      .lean(),
    TVShow.find({ status: 'active', policyRestricted: { $ne: true } })
      .sort({ imdbRating: -1, year: -1, createdAt: -1 })
      .select('-__v')
      .limit(limit)
      .lean()
  ]);

  const movies = filterPublicItems(fallbackMovies);
  const shows = filterPublicItems(fallbackShows);

  return {
    trendingNow: movies,
    nowPlaying: movies.slice(0, Math.min(limit, movies.length)),
    topRatedMovies: movies,
    trendingTVShows: shows,
    meta: {
      source: 'catalog',
      refreshedAt: new Date().toISOString(),
      cacheMinutes: 15
    }
  };
};

// @route   GET /api/discovery/home
// @desc    Live home rows from 2embed trending (matched to local catalog)
// @access  Public
router.get('/home', async (req, res) => {
  try {
    const limit = Math.min(30, Math.max(8, parseInt(req.query.limit, 10) || 20));
    const now = Date.now();
    const fast = req.query.fast === '1' || req.query.fast === 'true';

    if (fast) {
      const data = await buildLocalFallback(limit);
      return res.json({ success: true, data });
    }

    if (homeResponseCache.payload && now - homeResponseCache.at < HOME_CACHE_TTL_MS) {
      return res.json(homeResponseCache.payload);
    }

    const [weekMovies, weekTv, movieMap, tvMap] = await Promise.all([
      fetchTrendingResults('movie', 'week', 1),
      fetchTrendingResults('tv', 'week', 1),
      getMovieTmdbMap(),
      getTvTmdbMap()
    ]);

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

    let trendingMovieIds = matchIdsFromMap(trendingIds, movieMap);
    let nowPlayingMovieIds = matchIdsFromMap(nowPlayingIds, movieMap);
    let topRatedMovieIds = matchIdsFromMap(topRatedIds, movieMap);
    let trendingShowIds = matchIdsFromMap(trendingTvIds, tvMap);

    if (!trendingMovieIds.length) {
      const data = await buildLocalFallback(limit);
      const payload = { success: true, data };
      homeResponseCache = { payload, at: Date.now() };
      return res.json(payload);
    }

    if (!trendingShowIds.length) {
      const fallbackShows = await TVShow.find({ status: 'active', policyRestricted: { $ne: true } })
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

    const data = {
      trendingNow: filterPublicItems(trendingNow),
      nowPlaying: filterPublicItems(nowPlaying),
      trendingTVShows: filterPublicItems(trendingTVShows),
      topRatedMovies: filterPublicItems(topRatedMovies),
      meta: {
        source: weekMovies.length || weekTv.length ? 'live' : 'catalog',
        refreshedAt: new Date().toISOString(),
        cacheMinutes: 15
      }
    };

    const payload = { success: true, data };
    homeResponseCache = { payload, at: Date.now() };
    res.json(payload);
  } catch (error) {
    console.error('Discovery home error:', error);
    try {
      const limit = Math.min(30, Math.max(8, parseInt(req.query.limit, 10) || 20));
      const data = await buildLocalFallback(limit);
      return res.json({ success: true, data });
    } catch (fallbackError) {
      console.error('Discovery home fallback error:', fallbackError);
    }
    res.status(500).json({
      success: false,
      message: 'Server error while loading home discovery'
    });
  }
});

module.exports = router;
