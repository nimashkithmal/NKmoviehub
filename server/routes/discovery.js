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

const hasPoster = (doc = {}) =>
  Boolean(
    (doc.imageUrl && String(doc.imageUrl).trim()) ||
      (Array.isArray(doc.images) && doc.images.some(Boolean))
  );

/** Drop sync noise: perfect IMDb scores with no site engagement, missing art, etc. */
const isCatalogJunk = (doc = {}) => {
  if (!hasPoster(doc)) return true;
  const rating = Number(doc.imdbRating) || 0;
  const siteVotes = Number(doc.totalRatings) || 0;
  if (rating <= 0) return true;
  if (rating >= 9.7 && siteVotes === 0) return true;
  return false;
};

const isCredibleRating = (doc = {}) => {
  const rating = Number(doc.imdbRating) || 0;
  return rating >= 5.8 && rating <= 9.3;
};

const movieCardSelect =
  'title year description genre imageUrl images imdbRating averageRating totalRatings releaseDate createdAt status policyRestricted movieUrl matureContent';

/**
 * True “Top Rated” / all-time greats from the local 2embed-backed catalog.
 * 2embed only exposes trending lists — sorting those by vote_average surfaces
 * brand-new titles, not classics. Catalog also has sync junk (fake ~9.x scores,
 * concerts, docs), so those are filtered out here.
 */
const WEAK_TOP_RATED_TITLE =
  /live at|live in|concert|greatest (video )?hits|video hits|unplugged|\btour\b|festival|stand-?up|comedy special|behind the scenes|making of|karaoke|music video|tribute to|best of|video show|video capture|songs from|top \d+ cars|in space$/i;

/** Prefer recognizable theatrical titles over obscure sync noise with inflated scores. */
const TOP_RATED_TITLE_BOOST =
  /\b(lord of the rings|hobbit|interstellar|inception|the matrix|godfather|dark knight|pulp fiction|fight club|forrest gump|gladiator|avengers|spider-?man|star wars|harry potter|jurassic|terminator|alien\b|joker|parasite|whiplash|the prestige|the departed|goodfellas|shawshank|schindler|saving private|spirited away|princess mononoke|deadpool|iron man|batman|superman|wonder woman|justice league|john wick|mission:? impossible|indiana jones|back to the future|die hard|silence of the lambs|\bse7en\b|\bseven\b|django|mad max|blade runner|\bdune\b|oppenheimer|jaws|rocky|titanic|avatar|casablanca|psycho|vertigo|gone with the wind|12 angry men|good will hunting|the green mile|american history x|the usual suspects|no country for old men|there will be blood|the social network|la la land|get out|knives out|everything everywhere|top gun|guardians of the galaxy|black panther|doctor strange|captain america|thor\b|wolverine|x-men|fantastic four|transformers|pirates of the caribbean)\b/i;

const isWeakTopRatedGenre = (genre = '') => {
  const raw = String(genre || '').trim();
  if (/^documentary\b/i.test(raw)) return true;
  const parts = raw
    .split(/[,/|]/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  if (!parts.length) return false;
  return parts.every((part) =>
    /^(music|documentary|tv movie|reality)$/i.test(part)
  );
};

const isTopRatedCandidate = (doc = {}) => {
  if (isCatalogJunk(doc) || !isCredibleRating(doc) || !hasPoster(doc)) return false;
  const rating = Number(doc.imdbRating) || 0;
  const siteVotes = Number(doc.totalRatings) || 0;
  const year = Number(doc.year) || 0;
  const currentYear = new Date().getFullYear();
  // All-time row: skip current-year releases and obvious sync fluff.
  if (year >= currentYear || year < 1970) return false;
  if (doc.releaseDate) {
    const iso = String(doc.releaseDate).trim().match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
    const todayStr = new Date().toISOString().slice(0, 10);
    if (iso && iso > todayStr) return false;
  }
  if (siteVotes === 0 && rating >= 8.8) return false;
  if (rating < 7) return false;
  if (WEAK_TOP_RATED_TITLE.test(String(doc.title || ''))) return false;
  if (isWeakTopRatedGenre(doc.genre)) return false;
  return true;
};

const topRatedSortScore = (doc = {}) => {
  const rating = Number(doc.imdbRating) || 0;
  const boost = TOP_RATED_TITLE_BOOST.test(String(doc.title || '')) ? 100 : 0;
  const votes = Number(doc.totalRatings) || 0;
  return boost + rating + Math.min(votes, 50) / 100;
};

const loadTopRatedFromCatalog = async (limit) => {
  const currentYear = new Date().getFullYear();
  const docs = await Movie.find({
    status: 'active',
    policyRestricted: { $ne: true },
    year: { $lte: currentYear - 1, $gte: 1970 },
    $or: [
      { imdbRating: { $gte: 7, $lt: 8.8 } },
      { imdbRating: { $gte: 7, $lte: 9.3 }, totalRatings: { $gt: 0 } }
    ]
  })
    .sort({ imdbRating: -1, totalRatings: -1, year: -1 })
    .select(movieCardSelect)
    .limit(Math.max(limit * 20, 400))
    .lean();

  const ranked = filterPublicItems(docs)
    .filter(isTopRatedCandidate)
    .sort((a, b) => {
      const score = topRatedSortScore(b) - topRatedSortScore(a);
      if (score) return score;
      return String(a.title || '').localeCompare(String(b.title || ''));
    });

  return takeUniqueDocs(ranked, limit);
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
