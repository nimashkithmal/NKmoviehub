const express = require('express');
const Movie = require('../models/Movie');
const TVShow = require('../models/TVShow');
const {
  extractTmdbId,
  extractTvTmdbId
} = require('../utils/trendingPopular');
const {
  hasTmdbAuth,
  fetchPopularTmdbIds,
  fetchNowPlayingTmdbIds,
  fetchTopRatedTmdbIds,
  fetchTmdbAllTrendingEntries
} = require('../utils/tmdb');
const { filterPublicItems, applyPublicCatalogFilter } = require('../utils/contentPolicy');
const { getComingSoonCatalog } = require('../utils/comingSoon');
const {
  hasPoster,
  isCatalogJunk,
  isCredibleRating,
  buildTopRatedMongoFilter,
  rankTopRatedDocs
} = require('../utils/topRatedCatalog');

const router = express.Router();

const HOME_CACHE_TTL_MS = 10 * 60 * 1000;
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

/** Match TMDB all-trending entries to local movies + TV in TMDB order. */
const hydrateMixedTrending = async (entries = [], movieMap, tvMap, limit = 20) => {
  const movieIds = [];
  const tvIds = [];
  const plan = [];

  for (const entry of entries) {
    if (plan.length >= limit * 3) break;
    const tid = String(entry?.tmdbId || '');
    if (!tid) continue;
    if (entry.mediaType === 'movie') {
      const docId = movieMap.get(tid);
      if (!docId) continue;
      movieIds.push(docId);
      plan.push({ kind: 'movie', id: String(docId) });
    } else if (entry.mediaType === 'tv') {
      const docId = tvMap.get(tid);
      if (!docId) continue;
      tvIds.push(docId);
      plan.push({ kind: 'tvshow', id: String(docId) });
    }
  }

  const uniqueMovieIds = [...new Set(movieIds.map(String))];
  const uniqueTvIds = [...new Set(tvIds.map(String))];

  const [movies, shows] = await Promise.all([
    uniqueMovieIds.length
      ? Movie.find({
          _id: { $in: uniqueMovieIds },
          status: 'active',
          policyRestricted: { $ne: true }
        })
          .select('-__v')
          .lean()
      : [],
    uniqueTvIds.length
      ? TVShow.find({
          _id: { $in: uniqueTvIds },
          status: 'active',
          policyRestricted: { $ne: true }
        })
          .select('-__v')
          .lean()
      : []
  ]);

  const movieById = new Map(movies.map((m) => [String(m._id), m]));
  const tvById = new Map(shows.map((s) => [String(s._id), s]));
  const out = [];
  const seen = new Set();

  for (const step of plan) {
    if (out.length >= limit) break;
    const key = `${step.kind}:${step.id}`;
    if (seen.has(key)) continue;
    const doc = step.kind === 'movie' ? movieById.get(step.id) : tvById.get(step.id);
    if (!doc) continue;
    seen.add(key);
    out.push({ ...doc, _kind: step.kind });
  }

  return out;
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

const fillThin = (target, sourceIds, limit) => {
  if (target.length >= Math.min(10, limit)) return target;
  const seen = new Set(target.map(String));
  for (const id of sourceIds) {
    const key = String(id);
    if (seen.has(key)) continue;
    seen.add(key);
    target.push(id);
    if (target.length >= limit) break;
  }
  return target;
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

const takeUniqueDocs = (docs = [], limit = 20, excludeIds = null) => {
  const out = [];
  const seen = excludeIds || new Set();
  for (const doc of docs) {
    const key = String(doc._id);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(doc);
    if (out.length >= limit) break;
  }
  return out;
};

const movieCardSelect =
  'title year description genre imageUrl images imdbRating averageRating totalRatings releaseDate createdAt status policyRestricted movieUrl matureContent';

const loadTopRatedFromCatalog = async (limit) => {
  const docs = await Movie.find(buildTopRatedMongoFilter({
    status: 'active',
    policyRestricted: { $ne: true }
  }))
    .sort({ imdbRating: -1, totalRatings: -1, year: -1 })
    .select(movieCardSelect)
    .limit(Math.max(limit * 20, 400))
    .lean();

  return takeUniqueDocs(rankTopRatedDocs(filterPublicItems(docs)), limit);
};

const buildLocalFallback = async (limit) => {
  const baseFilter = { status: 'active', policyRestricted: { $ne: true } };
  const poolLimit = Math.max(limit * 25, 300);
  const currentYear = new Date().getFullYear();

  const [recentPool, fallbackShows, topRatedMovies] = await Promise.all([
    Movie.find(baseFilter)
      .sort({ createdAt: -1, year: -1 })
      .select(movieCardSelect)
      .limit(poolLimit)
      .lean(),
    TVShow.find(baseFilter)
      .sort({ createdAt: -1, imdbRating: -1, year: -1 })
      .select('-__v')
      .limit(Math.max(limit * 4, 40))
      .lean(),
    loadTopRatedFromCatalog(limit)
  ]);

  const poolAll = filterPublicItems(recentPool).filter(
    (doc) => hasPoster(doc) && (Number(doc.imdbRating) || 0) > 0
  );
  const pool = poolAll;
  const qualityPool = poolAll.filter((doc) => !isCatalogJunk(doc));
  const shows = filterPublicItems(fallbackShows)
    .filter((doc) => hasPoster(doc))
    .slice(0, limit)
    .map((doc) => ({ ...doc, _kind: 'tvshow' }));

  const trendingNow = takeUniqueDocs(pool, limit);
  const mixedFallback = [
    ...trendingNow.slice(0, Math.ceil(limit / 2)).map((doc) => ({ ...doc, _kind: 'movie' })),
    ...shows.slice(0, Math.floor(limit / 2))
  ].slice(0, limit);

  const used = new Set(trendingNow.map((doc) => String(doc._id)));
  const recentTheatrical = qualityPool.filter(
    (doc) =>
      Number(doc.year) >= currentYear - 2 &&
      Number(doc.year) <= currentYear + 1 &&
      isCredibleRating(doc)
  );
  let nowPlaying = takeUniqueDocs(recentTheatrical, limit, used);
  if (nowPlaying.length < Math.min(10, limit)) {
    nowPlaying = takeUniqueDocs(
      qualityPool.filter(
        (doc) => Number(doc.year) >= currentYear - 5 && isCredibleRating(doc)
      ),
      limit,
      used
    );
  }

  return {
    trendingNow,
    nowPlaying,
    topRatedMovies,
    trendingTVShows: shows,
    trendingToday: mixedFallback,
    trendingWeek: mixedFallback,
    meta: {
      source: 'catalog',
      popularSource: 'catalog',
      nowPlayingSource: 'catalog',
      topRatedSource: 'catalog',
      trendingSource: 'catalog',
      refreshedAt: new Date().toISOString(),
      cacheMinutes: 10
    }
  };
};

// @route   GET /api/discovery/home
// @desc    Live home rows from TMDB Popular / Now Playing / Top Rated (matched to local catalog)
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

    const [
      popularIds,
      nowPlayingIds,
      topRatedIds,
      trendingDayEntries,
      trendingWeekEntries,
      movieMap,
      tvMap
    ] = await Promise.all([
      fetchPopularTmdbIds({ pages: 3, limit: 80, language: 'en-US' }),
      fetchNowPlayingTmdbIds({ pages: 2, limit: 60, language: 'en-US' }),
      fetchTopRatedTmdbIds({ pages: 3, limit: 80, language: 'en-US' }),
      fetchTmdbAllTrendingEntries('day', { pages: 2, limit: 40, language: 'en-US' }),
      fetchTmdbAllTrendingEntries('week', { pages: 2, limit: 40, language: 'en-US' }),
      getMovieTmdbMap(),
      getTvTmdbMap()
    ]);

    let popularMovieIds = matchIdsFromMap(popularIds, movieMap);
    let nowPlayingMovieIds = matchIdsFromMap(nowPlayingIds, movieMap);
    let topRatedMovieIds = matchIdsFromMap(topRatedIds, movieMap);

    const usedTmdbPopular = popularIds.length > 0;
    const usedTmdbNowPlaying = nowPlayingIds.length > 0;
    const usedTmdbTopRated = topRatedIds.length > 0;
    const usedTmdbTrending =
      trendingDayEntries.length > 0 || trendingWeekEntries.length > 0;

    // If TMDB auth missing / empty, fall back to catalog rows.
    if (
      !hasTmdbAuth() ||
      (!usedTmdbPopular && !usedTmdbNowPlaying && !usedTmdbTopRated && !usedTmdbTrending)
    ) {
      const data = await buildLocalFallback(limit);
      return res.json({ success: true, data });
    }

    // Thin fills: Popular may borrow from Now Playing, but never the reverse —
    // Now Playing must stay a pure TMDB theatrical list.
    if (popularMovieIds.length < Math.min(8, limit)) {
      popularMovieIds = fillThin(popularMovieIds, nowPlayingMovieIds, limit);
    }

    const [
      trendingNow,
      nowPlaying,
      tmdbTopRated,
      catalogTopRated,
      trendingToday,
      trendingWeek
    ] = await Promise.all([
      hydrateMovies(popularMovieIds, limit),
      hydrateMovies(nowPlayingMovieIds, limit),
      hydrateMovies(topRatedMovieIds, limit),
      topRatedMovieIds.length >= Math.min(8, limit)
        ? Promise.resolve([])
        : loadTopRatedFromCatalog(limit),
      hydrateMixedTrending(trendingDayEntries, movieMap, tvMap, limit),
      hydrateMixedTrending(trendingWeekEntries, movieMap, tvMap, limit)
    ]);

    let topRatedMovies = filterPublicItems(tmdbTopRated);
    if (topRatedMovies.length < Math.min(8, limit)) {
      const seen = new Set(topRatedMovies.map((d) => String(d._id)));
      for (const doc of catalogTopRated) {
        const key = String(doc._id);
        if (seen.has(key)) continue;
        seen.add(key);
        topRatedMovies.push(doc);
        if (topRatedMovies.length >= limit) break;
      }
    }

    const trendingTodayPublic = filterPublicItems(trendingToday);
    const trendingWeekPublic = filterPublicItems(trendingWeek);
    // Back-compat for older clients that still read trendingTVShows
    const trendingTVShows = trendingWeekPublic.filter((item) => item._kind === 'tvshow');

    const data = {
      trendingNow: filterPublicItems(trendingNow),
      nowPlaying: filterPublicItems(nowPlaying),
      trendingToday: trendingTodayPublic,
      trendingWeek: trendingWeekPublic,
      trendingTVShows,
      topRatedMovies,
      meta: {
        source: 'tmdb',
        popularSource: usedTmdbPopular ? 'tmdb' : 'catalog',
        nowPlayingSource: usedTmdbNowPlaying ? 'tmdb' : 'catalog',
        topRatedSource: usedTmdbTopRated ? 'tmdb' : 'catalog',
        trendingSource: usedTmdbTrending ? 'tmdb' : 'catalog',
        refreshedAt: new Date().toISOString(),
        cacheMinutes: 10
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

// @route   GET /api/discovery/coming-soon
// @desc    Combined Coming Soon row for home (cached, lean)
// @access  Public
router.get('/coming-soon', async (req, res) => {
  try {
    const { movies, tvShows, fromCache, stale } = await getComingSoonCatalog({
      Movie,
      TVShow,
      applyPublicCatalogFilter,
      filterPublicItems,
      limit: 40
    });

    res.json({
      success: true,
      data: {
        movies,
        tvShows,
        meta: {
          fromCache: Boolean(fromCache),
          stale: Boolean(stale),
          refreshedAt: new Date().toISOString()
        }
      }
    });
  } catch (error) {
    console.error('Discovery coming soon error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while loading coming soon'
    });
  }
});

module.exports = router;
