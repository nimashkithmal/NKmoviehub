const express = require('express');
const Movie = require('../models/Movie');
const TVShow = require('../models/TVShow');
const {
  extractTmdbId,
  extractTvTmdbId,
  fetchTrendingResults,
  pickNowPlayingIds
} = require('../utils/trendingPopular');
const { fetchNowPlayingTmdbIds } = require('../utils/tmdb');
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
  // Newest row: keep fresh additions even if IMDb is a placeholder 10.
  const pool = poolAll;
  const qualityPool = poolAll.filter((doc) => !isCatalogJunk(doc));
  const shows = filterPublicItems(fallbackShows)
    .filter((doc) => hasPoster(doc))
    .slice(0, limit);

  // Newest on the site first — matches what users expect while 2embed is blocked.
  const trendingNow = takeUniqueDocs(pool, limit);

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

    // Sequential 2embed windows — day/month feed Now Playing + Top Rated with fresh titles.
    const weekMovies = await fetchTrendingResults('movie', 'week', 2);
    const dayMovies = await fetchTrendingResults('movie', 'day', 1);
    const monthMovies = await fetchTrendingResults('movie', 'month', 1);
    const weekTv = await fetchTrendingResults('tv', 'week', 1);
    const [movieMap, tvMap] = await Promise.all([getMovieTmdbMap(), getTvTmdbMap()]);

    const mergeRows = (...lists) => {
      const seen = new Set();
      const out = [];
      for (const list of lists) {
        for (const row of list || []) {
          const id = row?.tmdb_id != null ? String(row.tmdb_id) : '';
          if (!id || seen.has(id)) continue;
          seen.add(id);
          out.push(row);
        }
      }
      return out;
    };

    const combinedMovies = mergeRows(dayMovies, weekMovies, monthMovies);

    const trendingIds = weekMovies
      .map((r) => (r?.tmdb_id != null ? String(r.tmdb_id) : ''))
      .filter(Boolean);

    // Prefer official TMDB theatrical now_playing, then 2embed recent releases.
    let nowPlayingIds = await fetchNowPlayingTmdbIds({
      pages: 2,
      limit: 80,
      language: 'en-US'
    });
    const usedTmdbNowPlaying = nowPlayingIds.length > 0;

    if (nowPlayingIds.length < 12) {
      const fromEmbed = pickNowPlayingIds(combinedMovies, {
        days: 150,
        limit: 80
      });
      const seen = new Set(nowPlayingIds);
      for (const id of fromEmbed) {
        if (seen.has(id)) continue;
        seen.add(id);
        nowPlayingIds.push(id);
        if (nowPlayingIds.length >= 40) break;
      }
    }
    if (nowPlayingIds.length < 12) {
      const dayIds = dayMovies
        .map((r) => (r?.tmdb_id != null ? String(r.tmdb_id) : ''))
        .filter(Boolean);
      const seen = new Set(nowPlayingIds);
      for (const id of dayIds) {
        if (seen.has(id)) continue;
        seen.add(id);
        nowPlayingIds.push(id);
        if (nowPlayingIds.length >= 40) break;
      }
    }

    const trendingTvIds = weekTv
      .map((r) => (r?.tmdb_id != null ? String(r.tmdb_id) : ''))
      .filter(Boolean);

    let trendingMovieIds = matchIdsFromMap(trendingIds, movieMap);
    let nowPlayingMovieIds = matchIdsFromMap(nowPlayingIds, movieMap);
    let trendingShowIds = matchIdsFromMap(trendingTvIds, tvMap);

    // Fill thin Now Playing from week trending only when TMDB now_playing was empty.
    const fillThin = (target, sourceIds) => {
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
    if (!usedTmdbNowPlaying) {
      nowPlayingMovieIds = fillThin(nowPlayingMovieIds, trendingMovieIds);
    } else if (nowPlayingMovieIds.length < Math.min(8, limit)) {
      // TMDB list is authoritative; only top up with recent theatrical catalog matches.
      const embedIds = matchIdsFromMap(
        pickNowPlayingIds(combinedMovies, { days: 150, limit: 80 }),
        movieMap
      );
      nowPlayingMovieIds = fillThin(nowPlayingMovieIds, embedIds);
    }

    if (!trendingMovieIds.length) {
      // 2embed trending is often blocked — serve quality catalog without caching
      // a weak payload for the full live TTL.
      const data = await buildLocalFallback(limit);
      return res.json({ success: true, data });
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
        loadTopRatedFromCatalog(limit),
        hydrateTVShows(trendingShowIds, limit)
      ]);

    const data = {
      trendingNow: filterPublicItems(trendingNow),
      nowPlaying: filterPublicItems(nowPlaying),
      trendingTVShows: filterPublicItems(trendingTVShows),
      topRatedMovies: filterPublicItems(topRatedMovies),
      meta: {
        source: weekMovies.length || weekTv.length ? 'live' : 'catalog',
        nowPlayingSource: usedTmdbNowPlaying ? 'tmdb' : 'embed',
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
