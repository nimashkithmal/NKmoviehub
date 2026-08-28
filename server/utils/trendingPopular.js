/**
 * Resolve external trending order for Popular sort + home discovery rows.
 */
const CACHE_TTL_MS = 15 * 60 * 1000;
const STALE_TTL_MS = 6 * 60 * 60 * 1000; // serve old data up to 6h if API is down
const FETCH_TIMEOUT_MS = 30000;
const MAX_TRENDING_PAGES = 2; // 2 * 20 = 40 titles
const PAGE_DELAY_MS = 250;
const MAX_RETRIES = 2;

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
let fetchChain = Promise.resolve();

function logFetchIssue(cacheKey, message) {
  const now = Date.now();
  const last = lastErrorLog.get(cacheKey) || 0;
  if (now - last < 60_000) return;
  lastErrorLog.set(cacheKey, now);
  console.warn(`Trending unavailable (${cacheKey}): ${message}`);
}

function enqueueFetch(task) {
  const run = fetchChain.then(task, task);
  fetchChain = run.catch(() => {});
  return run;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  return enqueueFetch(async () => {
    let lastError = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (err) {
        lastError = err;
        if (attempt < MAX_RETRIES) {
          await sleep(400 * (attempt + 1));
        }
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError || new Error('fetch failed');
  });
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
      const data = await fetchJson(`${base}?time_window=${timeWindow}&page=${page}`);
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
    key === 'tv'
      ? 'https://api.2embed.cc/trendingtv'
      : 'https://api.2embed.cc/trending';

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

function pickNowPlayingIds(rows, { days = 60, limit = 40 } = {}) {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - days);

  return rows
    .filter((row) => {
      const status = String(row.status || '').toLowerCase();
      if (status && status !== 'released') return false;
      if (!row.release_date) return false;
      const d = new Date(row.release_date);
      if (Number.isNaN(d.getTime())) return false;
      return d >= cutoff && d <= today;
    })
    .map((row) => String(row.tmdb_id))
    .filter(Boolean)
    .slice(0, limit);
}

function pickTopRatedIds(rows, { limit = 40, minVotes = 50 } = {}) {
  return [...rows]
    .filter((row) => Number(row.vote_average) > 0)
    .filter((row) => Number(row.vote_count || 0) >= minVotes || !row.vote_count)
    .sort((a, b) => {
      const score =
        Number(b.vote_average || 0) - Number(a.vote_average || 0) ||
        Number(b.vote_count || 0) - Number(a.vote_count || 0);
      return score;
    })
    .map((row) => String(row.tmdb_id))
    .filter(Boolean)
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
