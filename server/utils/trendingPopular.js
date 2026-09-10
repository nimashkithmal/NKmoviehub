/**
 * Resolve external trending order for Popular sort + home discovery rows.
 */
const { EMBED_API, fetchEmbedJson } = require('./embedHttp');

const CACHE_TTL_MS = 15 * 60 * 1000;
const STALE_TTL_MS = 6 * 60 * 60 * 1000; // serve old data up to 6h if API is down
const MAX_TRENDING_PAGES = 2; // 2 * 20 = 40 titles
const PAGE_DELAY_MS = 400;

const cache = {
  movie: { ids: [], at: 0 },
  tv: { ids: [], at: 0 },
  results: {
    movie_week: { rows: [], at: 0 },
    movie_day: { rows: [], at: 0 },
    movie_month: { rows: [], at: 0 },
    tv_week: { rows: [], at: 0 }
  }
};

const inFlight = new Map();
const lastErrorLog = new Map();

function logFetchIssue(cacheKey, message) {
  const now = Date.now();
  const last = lastErrorLog.get(cacheKey) || 0;
  if (now - last < 60_000) return;
  lastErrorLog.set(cacheKey, now);
  console.warn(`Trending unavailable (${cacheKey}): ${message}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractTmdbId(url = '') {
  const raw = String(url || '');
  return (
    raw.match(/2embed\.[^/]+\/embed\/(\d+)/i)?.[1] ||
    raw.match(/2embed\.[^/]+\/movie\/(\d+)/i)?.[1] ||
    raw.match(/2embed\.[^/]+\/embedtv(?:full)?\/(\d+)/i)?.[1] ||
    null
  );
}

function extractTvTmdbId(show) {
  if (!show) return null;
  const fromShow = extractTmdbId(show.showUrl);
  if (fromShow) return fromShow;
  const ep = Array.isArray(show.episodes)
    ? show.episodes.find((e) => e && e.episodeUrl)
    : null;
  return extractTmdbId(ep?.episodeUrl);
}

function pushUniqueRows(rows, list, seen) {
  for (const row of list || []) {
    const id = row?.tmdb_id != null ? String(row.tmdb_id) : '';
    if (!id || seen.has(id)) continue;
    seen.add(id);
    rows.push(row);
  }
}

async function loadTrendingPages(base, timeWindow, maxPages, cacheKey) {
  const rows = [];
  const seen = new Set();
  const pages = Math.max(1, Math.min(maxPages, MAX_TRENDING_PAGES));

  for (let page = 1; page <= pages; page += 1) {
    try {
      const data = await fetchEmbedJson(
        `${base}?time_window=${encodeURIComponent(timeWindow)}&page=${page}`
      );
      pushUniqueRows(rows, data?.results, seen);
      if (page >= (Number(data?.total_pages) || 1)) break;
      if (page < pages) await sleep(PAGE_DELAY_MS);
    } catch (err) {
      if (page === 1) {
        logFetchIssue(cacheKey, err.message);
        return null;
      }
      break;
    }
  }

  return rows;
}

function getCachedRows(cacheKey, now = Date.now()) {
  const hit = cache.results[cacheKey];
  if (!hit?.rows?.length) return { rows: [], fresh: false, stale: false };
  const age = now - hit.at;
  return {
    rows: hit.rows,
    fresh: age < CACHE_TTL_MS,
    stale: age < STALE_TTL_MS
  };
}

function storeRows(cacheKey, key, rows) {
  if (!rows?.length) return;
  cache.results[cacheKey] = { rows, at: Date.now() };
  cache[key] = { ids: rows.map((r) => String(r.tmdb_id)), at: Date.now() };
}

async function refreshTrending(cacheKey, key, base, timeWindow, maxPages) {
  const rows = await loadTrendingPages(base, timeWindow, maxPages, cacheKey);
  if (rows?.length) {
    storeRows(cacheKey, key, rows);
    return rows;
  }
  const cached = getCachedRows(cacheKey);
  return cached.stale ? cached.rows : [];
}

async function fetchTrendingResults(kind = 'movie', timeWindow = 'week', maxPages = 1) {
  const key = kind === 'tv' ? 'tv' : 'movie';
  const cacheKey = `${key}_${timeWindow}`;
  const now = Date.now();
  const cached = getCachedRows(cacheKey, now);

  if (cached.fresh) {
    return cached.rows;
  }

  if (inFlight.has(cacheKey)) {
    return inFlight.get(cacheKey);
  }

  const base =
    key === 'tv' ? `${EMBED_API}/trendingtv` : `${EMBED_API}/trending`;

  const promise = refreshTrending(cacheKey, key, base, timeWindow, maxPages);

  inFlight.set(cacheKey, promise);
  try {
    const rows = await promise;
    if (rows.length) return rows;
    return cached.stale ? cached.rows : [];
  } finally {
    inFlight.delete(cacheKey);
  }
}

async function getTrendingTmdbIds(kind = 'movie', maxPages = MAX_TRENDING_PAGES) {
  const rows = await fetchTrendingResults(kind, 'week', maxPages);
  return rows
    .map((r) => (r?.tmdb_id != null ? String(r.tmdb_id) : ''))
    .filter(Boolean);
}

function orderDocsByTrending(docs, trendingIds, getTmdbId) {
  const rank = new Map(trendingIds.map((id, index) => [String(id), index]));
  return docs
    .map((doc) => {
      const tmdbId = getTmdbId(doc);
      const index = tmdbId != null ? rank.get(String(tmdbId)) : undefined;
      return { doc, index: Number.isInteger(index) ? index : null };
    })
    .filter((row) => row.index != null)
    .sort((a, b) => a.index - b.index)
    .map((row) => row.doc);
}

/** Trending matches first, then the rest of the catalog by rating/year. */
function orderDocsTrendingFirst(docs, trendingIds, getTmdbId) {
  const rank = new Map(trendingIds.map((id, index) => [String(id), index]));
  const trending = [];
  const rest = [];

  for (const doc of docs) {
    const tmdbId = getTmdbId(doc);
    const index = tmdbId != null ? rank.get(String(tmdbId)) : undefined;
    if (Number.isInteger(index)) {
      trending.push({ doc, index });
    } else {
      rest.push(doc);
    }
  }

  trending.sort((a, b) => a.index - b.index);
  rest.sort((a, b) => {
    const score =
      (Number(b.imdbRating) || 0) - (Number(a.imdbRating) || 0) ||
      (Number(b.averageRating) || 0) - (Number(a.averageRating) || 0) ||
      (Number(b.year) || 0) - (Number(a.year) || 0);
    if (score !== 0) return score;
    return String(a.title || '').localeCompare(String(b.title || ''));
  });

  return [...trending.map((row) => row.doc), ...rest];
}

function pickNowPlayingIds(rows, { days = 120, limit = 40 } = {}) {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - days);
  // Allow titles releasing within the next 2 weeks (still “in theaters / new”).
  const upcomingCap = new Date(today);
  upcomingCap.setDate(upcomingCap.getDate() + 14);

  const seen = new Set();
  const out = [];

  for (const row of rows || []) {
    const id = row?.tmdb_id != null ? String(row.tmdb_id) : '';
    if (!id || seen.has(id)) continue;

    const status = String(row.status || '').toLowerCase();
    if (status && !/(released|post production|in production)/i.test(status) && status !== 'rumored') {
      // keep released / empty; skip clearly cancelled
      if (/(cancelled|canceled)/i.test(status)) continue;
    }

    if (!row.release_date) continue;
    const d = new Date(row.release_date);
    if (Number.isNaN(d.getTime())) continue;
    if (d < cutoff || d > upcomingCap) continue;

    seen.add(id);
    out.push(id);
    if (out.length >= limit) break;
  }

  return out;
}

function pickTopRatedIds(rows, { limit = 40, minVotes = 5 } = {}) {
  const seen = new Set();
  return [...(rows || [])]
    .filter((row) => Number(row.vote_average) >= 6)
    .filter((row) => {
      const votes = Number(row.vote_count || 0);
      return votes >= minVotes || !row.vote_count;
    })
    .sort((a, b) => {
      const score =
        Number(b.vote_average || 0) - Number(a.vote_average || 0) ||
        Number(b.vote_count || 0) - Number(a.vote_count || 0);
      return score;
    })
    .map((row) => String(row.tmdb_id))
    .filter((id) => {
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .slice(0, limit);
}

module.exports = {
  extractTmdbId,
  extractTvTmdbId,
  fetchTrendingResults,
  getTrendingTmdbIds,
  orderDocsByTrending,
  orderDocsTrendingFirst,
  pickNowPlayingIds,
  pickTopRatedIds
};
