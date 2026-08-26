/**
 * Resolve 2embed trending order for Popular sort + home discovery rows.
 * Movies: https://api.2embed.cc/trending
 * TV:     https://api.2embed.cc/trendingtv
 */
const CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_TRENDING_PAGES = 8; // 8 * 20 = 160 titles

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

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
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

async function fetchTrendingResults(kind = 'movie', timeWindow = 'week', maxPages = MAX_TRENDING_PAGES) {
  const key = kind === 'tv' ? 'tv' : 'movie';
  const cacheKey = `${key}_${timeWindow}`;
  const now = Date.now();
  const hit = cache.results[cacheKey];
  if (hit?.rows?.length && now - hit.at < CACHE_TTL_MS) {
    return hit.rows;
  }

  const base =
    key === 'tv'
      ? 'https://api.2embed.cc/trendingtv'
      : 'https://api.2embed.cc/trending';

  const rows = [];
  const seen = new Set();

  let first;
  try {
    first = await fetchJson(`${base}?time_window=${timeWindow}&page=1`);
  } catch (err) {
    console.error(`2embed trending fetch failed (${cacheKey} page 1):`, err.message);
    return hit?.rows || [];
  }

  const pushRows = (list) => {
    for (const row of list || []) {
      const id = row?.tmdb_id != null ? String(row.tmdb_id) : '';
      if (!id || seen.has(id)) continue;
      seen.add(id);
      rows.push(row);
    }
  };

  pushRows(first?.results);

  const totalPages = Math.min(
    maxPages,
    Math.max(1, Number(first?.total_pages) || 1)
  );

  if (totalPages > 1) {
    const pages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
    const chunks = await Promise.all(
      pages.map(async (page) => {
        try {
          const data = await fetchJson(
            `${base}?time_window=${timeWindow}&page=${page}`
          );
          return Array.isArray(data?.results) ? data.results : [];
        } catch (err) {
          console.error(
            `2embed trending fetch failed (${cacheKey} page ${page}):`,
            err.message
          );
          return [];
        }
      })
    );
    for (const chunk of chunks) pushRows(chunk);
  }

  if (rows.length) {
    cache.results[cacheKey] = { rows, at: now };
    cache[key] = { ids: rows.map((r) => String(r.tmdb_id)), at: now };
  }

  return rows;
}

async function getTrendingTmdbIds(kind = 'movie') {
  const rows = await fetchTrendingResults(kind, 'week', MAX_TRENDING_PAGES);
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
  pickNowPlayingIds,
  pickTopRatedIds
};
