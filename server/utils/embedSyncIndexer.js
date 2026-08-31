const fetch = require('node-fetch');
const Movie = require('../models/Movie');
const TVShow = require('../models/TVShow');
const PendingTitle = require('../models/PendingTitle');
const {
  fetchTrendingResults,
  extractTmdbId,
  extractTvTmdbId
} = require('./trendingPopular');
const { evaluateContentPolicy } = require('./contentPolicy');
const { isUpcomingDoc } = require('./comingSoon');

const EMBED_API = 'https://api.2embed.cc';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
const TMDB_BACKDROP_BASE = 'https://image.tmdb.org/t/p/w1280';
const FETCH_TIMEOUT_MS = 20000;
const REQUEST_GAP_MS = 100;
const CONCURRENCY = 5;
const TRENDING_PAGES = 5;
const AUTO_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;
const STARTUP_DELAY_MS = 2 * 60 * 1000;

const state = {
  running: false,
  total: 0,
  processed: 0,
  skipped: 0,
  failed: 0,
  added: 0,
  startedAt: null,
  finishedAt: null,
  currentTitle: '',
  lastQuery: '',
  lastType: '',
  lastSyncedTitle: '',
  lastSkipReason: '',
  lastSkipMessage: ''
};

let runChain = Promise.resolve();
let autoSyncTimer = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const resolveImageUrl = (path, base = TMDB_IMAGE_BASE) => {
  if (!path) return '';
  const raw = String(path).trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${base}${raw.startsWith('/') ? raw : `/${raw}`}`;
};

const yearFromEmbed = (data = {}) => {
  const date = data.release_date || data.first_air_date || '';
  const year = parseInt(String(date).slice(0, 4), 10);
  return Number.isFinite(year) ? year : new Date().getFullYear();
};

const genreFromEmbed = (data = {}) => {
  const genres = data.genres || [];
  if (!Array.isArray(genres) || !genres.length) return 'Drama';
  const first = genres[0];
  return typeof first === 'string' ? first : String(first.name || 'Drama').trim() || 'Drama';
};

const descriptionFromEmbed = (data = {}) => {
  const text = String(data.overview || data.description || data.tagline || '').trim();
  if (text.length >= 10) return text.slice(0, 1000);
  const title = String(data.title || data.name || 'Untitled').trim();
  return `${title} — discovered from 2embed trending.`.slice(0, 1000);
};

const directorFromEmbed = (data = {}) => {
  const crew = data.crew || data.cast_crew?.crew || [];
  const director = crew.find((person) => person.job === 'Director');
  return director?.name ? String(director.name).trim().slice(0, 200) : '';
};

const trailerFromEmbed = (data = {}) => {
  const trailer = data.trailer || data.trailers?.[0]?.key || '';
  if (!trailer) return '';
  if (String(trailer).includes('youtube')) return String(trailer).trim().slice(0, 500);
  return `https://www.youtube.com/embed/${String(trailer).trim()}`;
};

async function fetchEmbedJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function mapSearchRowToEmbedData(type, row = {}) {
  const genres = Array.isArray(row.genres)
    ? row.genres.map((genre) => (typeof genre === 'string' ? genre : genre?.name)).filter(Boolean)
    : [];

  if (type === 'tvshow') {
    return {
      name: row.name,
      overview: row.plot || row.overview,
      first_air_date: row.first_air_date,
      status: row.status,
      vote_average: row.vote_average,
      poster: row.poster,
      backdrops: row.backdrops,
      genres,
      trailer: row.trailer,
      original_language: row.original_language,
      imdb_id: row.imdb_id,
      number_of_seasons: row.number_of_seasons,
      number_of_episodes: row.number_of_episodes,
      crew: row.cast_crew?.crew
    };
  }

  return {
    title: row.title,
    overview: row.plot || row.overview,
    release_date: row.release_date,
    status: row.status,
    vote_average: row.vote_average,
    poster: row.poster,
    backdrops: row.backdrops,
    genres,
    trailer: row.trailer,
    original_language: row.original_language,
    imdb_id: row.imdb_id,
    runtime: row.runtime,
    crew: row.cast_crew?.crew
  };
}

async function fetchEmbedMetadata(type, tmdbId) {
  const path = type === 'tvshow' ? 'tv' : 'movie';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${EMBED_API}/${path}?tmdb_id=${encodeURIComponent(tmdbId)}`,
      { headers: { Accept: 'application/json' }, signal: controller.signal }
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function buildCatalogTmdbSets() {
  const [movies, shows] = await Promise.all([
    Movie.find({}).select('title year movieUrl status').lean(),
    TVShow.find({}).select('title year tmdbId showUrl episodes.episodeUrl status').lean()
  ]);

  const movieIds = new Set();
  const movieByTmdb = new Map();
  for (const doc of movies) {
    const id = extractTmdbId(doc.movieUrl);
    if (id) {
      movieIds.add(String(id));
      movieByTmdb.set(String(id), doc);
    }
  }

  const tvIds = new Set();
  const tvByTmdb = new Map();
  for (const doc of shows) {
    const id = extractTvTmdbId(doc) || String(doc.tmdbId || '').trim();
    if (id) {
      tvIds.add(String(id));
      tvByTmdb.set(String(id), doc);
    }
  }

  return { movieIds, tvIds, movieByTmdb, tvByTmdb };
}

const resolveCatalogStatus = (data = {}) => {
  const embedStatus = String(data.status || data.releaseStatus || '').trim().toLowerCase();
  if (/(upcoming|not[\s-]?released|planned|post production|in production)/i.test(embedStatus)) {
    return 'coming_soon';
  }

  const releaseDate = data.release_date || data.first_air_date || '';
  const year = yearFromEmbed(data);

  if (isUpcomingDoc({ releaseDate, year })) return 'coming_soon';
  return 'active';
};

function mapEmbedToPending(type, tmdbId, data = {}, source = 'trending') {
  const title = String(data.title || data.name || '').trim().slice(0, 100);
  if (!title) return null;

  const year = yearFromEmbed(data);
  const description = descriptionFromEmbed(data);
  const genre = genreFromEmbed(data);

  const policy = evaluateContentPolicy({ title, description, genre });
  if (policy.restricted) return null;

  const catalogStatus = resolveCatalogStatus(data);
  const releaseStatus = String(data.status || '').trim().slice(0, 80);

  return {
    type,
    tmdbId: String(tmdbId),
    imdbId: String(data.imdb_id || data.imdbId || '').trim(),
    title,
    year,
    description,
    genre,
    posterUrl: resolveImageUrl(data.poster || data.poster_path),
    backdropUrl: resolveImageUrl(
      (Array.isArray(data.backdrops) && data.backdrops[0]) || data.backdrop_path,
      TMDB_BACKDROP_BASE
    ),
    imdbRating: Math.min(10, Math.max(0, Number(data.vote_average) || 0)),
    releaseDate: String(data.release_date || data.first_air_date || '').slice(0, 40),
    trailerUrl: trailerFromEmbed(data),
    language: String(data.original_language || data.language || '').trim().slice(0, 80),
    director: directorFromEmbed(data),
    tagline: String(data.tagline || '').trim().slice(0, 300),
    runtime: Number.isFinite(Number(data.runtime)) ? Number(data.runtime) : null,
    numberOfSeasons: Math.max(1, Number(data.number_of_seasons) || 1),
    episodeCount: Math.max(0, Number(data.number_of_episodes) || 0),
    source,
    catalogStatus,
    releaseStatus
  };
}

async function upsertPending(doc) {
  const existing = await PendingTitle.findOne({
    type: doc.type,
    tmdbId: doc.tmdbId
  })
    .select('status')
    .lean();

  if (existing?.status === 'dismissed' || existing?.status === 'approved') {
    state.skipped += 1;
    return false;
  }

  const isNew = !existing;

  await PendingTitle.findOneAndUpdate(
    { type: doc.type, tmdbId: doc.tmdbId },
    {
      $set: doc,
      $setOnInsert: { status: 'pending', discoveredAt: new Date() }
    },
    { upsert: true, new: true }
  );

  if (isNew) state.added += 1;
  return true;
}

async function runPool(items, worker) {
  let index = 0;

  const runners = Array.from({ length: CONCURRENCY }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      const item = items[current];
      try {
        await worker(item);
      } catch (err) {
        state.failed += 1;
        console.warn(`Embed sync failed for ${item.type}:${item.tmdbId}:`, err.message);
      } finally {
        state.processed += 1;
        await sleep(REQUEST_GAP_MS);
      }
    }
  });

  await Promise.all(runners);
}

async function collectTrendingCandidates() {
  const [movieWeek, movieDay, tvWeek] = await Promise.all([
    fetchTrendingResults('movie', 'week', TRENDING_PAGES),
    fetchTrendingResults('movie', 'day', 2),
    fetchTrendingResults('tv', 'week', TRENDING_PAGES)
  ]);

  const seen = new Set();
  const candidates = [];

  const pushRows = (rows, type, source) => {
    for (const row of rows || []) {
      const tmdbId = row?.tmdb_id != null ? String(row.tmdb_id) : '';
      if (!tmdbId) continue;
      const key = `${type}:${tmdbId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({ type, tmdbId, source });
    }
  };

  pushRows(movieWeek, 'movie', 'trending_week');
  pushRows(movieDay, 'movie', 'trending_day');
  pushRows(tvWeek, 'tvshow', 'trending_week');

  return candidates;
}

const searchRowTitle = (row, itemType) =>
  String(itemType === 'tvshow' ? row.name : row.title || '').trim();

const searchRowYear = (row, itemType) => {
  const raw =
    itemType === 'tvshow'
      ? row.first_air_year || row.first_air_date
      : row.year || row.release_date;
  const year = parseInt(String(raw || '').slice(0, 4), 10);
  return Number.isFinite(year) ? year : null;
};

/** Strip labels like "(TV Series 2016)" so 2embed search gets the real title. */
const normalizeSearchQuery = (raw = '') => {
  let query = String(raw).trim();
  let year = null;

  const parenMatch = query.match(/\(([^)]*)\)\s*$/);
  if (parenMatch) {
    const inner = parenMatch[1];
    const yearInParen = inner.match(/\b(19\d{2}|20\d{2})\b/);
    if (yearInParen) year = parseInt(yearInParen[1], 10);
    if (/tv\s*(series|show)/i.test(inner) || yearInParen) {
      query = query.replace(/\s*\([^)]*\)\s*$/, '').trim();
    }
  }

  const tailYear = query.match(/\s+(19\d{2}|20\d{2})\s*$/);
  if (tailYear) {
    year = parseInt(tailYear[1], 10);
    query = query.replace(/\s+(19\d{2}|20\d{2})\s*$/, '').trim();
  }

  query = query
    .replace(/\s*[-–—:]\s*(TV\s*(?:Series|Show)|Series|Show)\s*$/i, '')
    .replace(/\s+tv\s*(series|show)\s*$/i, '')
    .trim();

  return { query, year };
};

const stripLeadingArticle = (value = '') =>
  String(value).trim().replace(/^(the|a|an)\s+/i, '').trim();

const normalizeTitleKey = (value = '') => stripLeadingArticle(value).toLowerCase();

const buildSearchVariants = (query = '') => {
  const base = String(query || '').trim();
  if (!base) return [];

  const variants = [base];
  const stripped = stripLeadingArticle(base);
  if (stripped && stripped.toLowerCase() !== base.toLowerCase()) {
    variants.push(stripped);
  }
  return variants;
};

const titleMatchScore = (query, title, yearHint, rowYear) => {
  const qKey = normalizeTitleKey(query);
  const tKey = normalizeTitleKey(title);
  if (!qKey || !tKey) return 0;

  let score = 0;
  if (tKey === qKey) score = 100;
  else if (tKey.startsWith(qKey) || qKey.startsWith(tKey)) score = 85;
  else if (tKey.includes(qKey) || qKey.includes(tKey)) score = 70;
  else score = 20;

  if (yearHint && rowYear && Number(yearHint) === Number(rowYear)) score += 20;
  if (yearHint && rowYear && Number(yearHint) !== Number(rowYear)) score -= 25;

  return score;
};

async function fetchSearchPage(itemType, query) {
  const path = itemType === 'tvshow' ? 'searchtv' : 'search';
  const data = await fetchEmbedJson(
    `${EMBED_API}/${path}?q=${encodeURIComponent(query)}&page=1`
  );
  return data.results || [];
}

async function fetchSearchResults(itemType, query) {
  const variants = buildSearchVariants(query);
  const seen = new Set();
  const rows = [];

  for (const variant of variants) {
    const pageRows = await fetchSearchPage(itemType, variant);
    for (const row of pageRows) {
      const tmdbId = row?.tmdb_id != null ? String(row.tmdb_id) : '';
      if (!tmdbId || seen.has(tmdbId)) continue;
      seen.add(tmdbId);
      rows.push(row);
    }
    if (rows.length) break;
  }

  return rows;
}

async function collectSearchCandidates(query, typeFilter = '') {
  const raw = String(query || '').trim();
  if (!raw) return collectTrendingCandidates();

  const { query: normalized, year: yearHint } = normalizeSearchQuery(raw);
  if (!normalized) return [];

  const picks = [];

  if (!typeFilter || typeFilter === 'movie') {
    const rows = await fetchSearchResults('movie', normalized);
    for (const row of rows) {
      if (row?.tmdb_id == null) continue;
      picks.push({
        type: 'movie',
        tmdbId: String(row.tmdb_id),
        source: 'search',
        searchRow: row,
        score: titleMatchScore(
          normalized,
          searchRowTitle(row, 'movie'),
          yearHint,
          searchRowYear(row, 'movie')
        )
      });
    }
  }

  if (!typeFilter || typeFilter === 'tvshow') {
    const rows = await fetchSearchResults('tvshow', normalized);
    for (const row of rows) {
      if (row?.tmdb_id == null) continue;
      picks.push({
        type: 'tvshow',
        tmdbId: String(row.tmdb_id),
        source: 'search',
        searchRow: row,
        score: titleMatchScore(
          normalized,
          searchRowTitle(row, 'tvshow'),
          yearHint,
          searchRowYear(row, 'tvshow')
        )
      });
    }
  }

  if (!picks.length) return [];

  picks.sort((a, b) => b.score - a.score);
  const best = picks[0];
  return [
    {
      type: best.type,
      tmdbId: best.tmdbId,
      source: best.source,
      searchRow: best.searchRow
    }
  ];
}

async function runIndexer(options = {}) {
  if (state.running) return;

  state.running = true;
  state.total = 0;
  state.processed = 0;
  state.skipped = 0;
  state.failed = 0;
  state.added = 0;
  state.startedAt = new Date();
  state.finishedAt = null;
  state.currentTitle = '';
  const query = String(options.query || '').trim();
  const typeFilter =
    options.type === 'movie' || options.type === 'tvshow' ? options.type : '';
  state.lastQuery = query;
  state.lastType = typeFilter;
  state.lastSyncedTitle = '';
  state.lastSkipReason = '';
  state.lastSkipMessage = '';

  try {
    const [candidates, catalog] = await Promise.all([
      query ? collectSearchCandidates(query, typeFilter) : collectTrendingCandidates(),
      buildCatalogTmdbSets()
    ]);
    state.total = candidates.length;

    if (!candidates.length) {
      state.lastSkipReason = 'not_found';
      state.lastSkipMessage = query
        ? `No match on 2embed for "${query}". Try a shorter name (e.g. without "The").`
        : '';
      console.log(
        query
          ? `ℹ️ 2embed found no match for "${query}"`
          : 'ℹ️ 2embed sync found no candidates'
      );
      return;
    }

    await runPool(candidates, async ({ type, tmdbId, source, searchRow }) => {
      const inCatalog =
        type === 'movie'
          ? catalog.movieIds.has(String(tmdbId))
          : catalog.tvIds.has(String(tmdbId));
      if (inCatalog) {
        const existing =
          type === 'movie'
            ? catalog.movieByTmdb.get(String(tmdbId))
            : catalog.tvByTmdb.get(String(tmdbId));
        const statusLabel =
          existing?.status === 'coming_soon'
            ? 'Coming Soon'
            : existing?.status === 'inactive'
              ? 'Inactive'
              : 'Active';
        state.skipped += 1;
        state.lastSkipReason = 'already_in_catalog';
        state.lastSkipMessage = `${existing?.title || 'This title'} is already in your catalog (${statusLabel}).`;
        state.currentTitle = existing?.title || state.currentTitle;
        return;
      }

      const data = searchRow
        ? mapSearchRowToEmbedData(type, searchRow)
        : await fetchEmbedMetadata(type, tmdbId);
      const pending = mapEmbedToPending(type, tmdbId, data, source);
      if (!pending) {
        state.skipped += 1;
        return;
      }

      state.currentTitle = pending.title;
      if (query) state.lastSyncedTitle = pending.title;
      await upsertPending(pending);
    });

    console.log(
      `✅ 2embed sync finished: ${state.added} new pending, ${state.skipped} skipped, ${state.failed} failed`
    );
  } catch (err) {
    console.error('2embed sync job error:', err.message);
  } finally {
    state.running = false;
    state.finishedAt = new Date();
    state.currentTitle = '';
  }
}

function startEmbedSyncIndexer() {
  if (autoSyncTimer) return;

  setTimeout(() => {
    runChain = runChain.then(runIndexer).catch(() => {});
  }, STARTUP_DELAY_MS);

  autoSyncTimer = setInterval(() => {
    runChain = runChain.then(runIndexer).catch(() => {});
  }, AUTO_SYNC_INTERVAL_MS);

  console.log('📡 2embed auto-sync scheduled (first run in 2 min, then every 6 hours)');
}

function triggerEmbedSync(options = {}) {
  const query = String(options.query || '').trim();
  const type =
    options.type === 'movie' || options.type === 'tvshow' ? options.type : '';
  runChain = runChain.then(() => runIndexer({ query, type })).catch(() => {});
  return { queued: true, query, type };
}

function getEmbedSyncStatus() {
  return {
    running: state.running,
    total: state.total,
    processed: state.processed,
    skipped: state.skipped,
    failed: state.failed,
    added: state.added,
    startedAt: state.startedAt,
    finishedAt: state.finishedAt,
    currentTitle: state.currentTitle,
    lastQuery: state.lastQuery,
    lastType: state.lastType,
    lastSyncedTitle: state.lastSyncedTitle,
    lastSkipReason: state.lastSkipReason,
    lastSkipMessage: state.lastSkipMessage
  };
}

module.exports = {
  startEmbedSyncIndexer,
  triggerEmbedSync,
  getEmbedSyncStatus,
  mapEmbedToPending,
  fetchEmbedMetadata
};
