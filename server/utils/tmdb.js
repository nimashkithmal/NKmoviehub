/**
 * Lightweight TMDB v3 client (now playing, trending, etc.).
 * Auth: TMDB_API_KEY (query) and/or TMDB_ACCESS_TOKEN / TMDB_READ_ACCESS_TOKEN (Bearer).
 */
const fetch = require('node-fetch');

const TMDB_API = 'https://api.themoviedb.org/3';
const CACHE_TTL_MS = 15 * 60 * 1000;
const STALE_TTL_MS = 6 * 60 * 60 * 1000;

const cache = {
  nowPlaying: { ids: [], at: 0 }
};

function getTmdbAuth() {
  const apiKey = String(process.env.TMDB_API_KEY || '').trim();
  const token = String(
    process.env.TMDB_ACCESS_TOKEN ||
      process.env.TMDB_READ_ACCESS_TOKEN ||
      ''
  ).trim();
  return { apiKey, token };
}

function hasTmdbAuth() {
  const { apiKey, token } = getTmdbAuth();
  return Boolean(apiKey || token);
}

async function fetchTmdbJson(pathname, query = {}) {
  const { apiKey, token } = getTmdbAuth();
  if (!apiKey && !token) {
    throw new Error('TMDB_API_KEY or TMDB_ACCESS_TOKEN not configured');
  }

  const url = new URL(
    `${TMDB_API}${pathname.startsWith('/') ? pathname : `/${pathname}`}`
  );
  for (const [key, value] of Object.entries(query)) {
    if (value == null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  if (apiKey) url.searchParams.set('api_key', apiKey);

  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(url.toString(), {
    headers,
    timeout: 20000
  });
  if (!response.ok) {
    throw new Error(`TMDB HTTP ${response.status}`);
  }
  return response.json();
}

function mapTmdbRowToEmbedShape(row = {}, kind = 'movie') {
  const release =
    kind === 'tv'
      ? String(row.first_air_date || '').trim()
      : String(row.release_date || '').trim();
  return {
    title: row.title || row.name || '',
    name: row.name || row.title || '',
    year: release.slice(0, 4) || '',
    status: 'released',
    release_date: release,
    tmdb_id: row.id,
    vote_average: row.vote_average,
    vote_count: row.vote_count,
    poster: row.poster_path
      ? `https://image.tmdb.org/t/p/w500${row.poster_path}`
      : '',
    original_language: row.original_language || ''
  };
}

/**
 * Trending rows shaped like 2embed results (tmdb_id, title, votes…).
 * Used when api.2embed.cc trending is blocked (HTTP 403).
 */
async function fetchTmdbTrendingRows(
  kind = 'movie',
  timeWindow = 'week',
  { pages = 1, language = 'en-US' } = {}
) {
  if (!hasTmdbAuth()) return [];

  const isTv = kind === 'tv';
  const window = timeWindow === 'day' ? 'day' : 'week';
  const maxPages = Math.max(1, Math.min(3, pages));
  const rows = [];
  const seen = new Set();

  try {
    for (let page = 1; page <= maxPages; page += 1) {
      let data;
      if (timeWindow === 'month' && !isTv) {
        data = await fetchTmdbJson('/movie/popular', { language, page });
      } else {
        data = await fetchTmdbJson(
          `/trending/${isTv ? 'tv' : 'movie'}/${window}`,
          { language, page }
        );
      }

      for (const row of data?.results || []) {
        const id = row?.id != null ? String(row.id) : '';
        if (!id || seen.has(id)) continue;
        seen.add(id);
        rows.push(mapTmdbRowToEmbedShape(row, isTv ? 'tv' : 'movie'));
      }

      if (page >= (Number(data?.total_pages) || 1)) break;
    }
  } catch (err) {
    console.warn('TMDB trending unavailable:', err.message || err);
    return [];
  }

  return rows;
}

/**
 * Ordered TMDB movie ids currently in theatres.
 * https://api.themoviedb.org/3/movie/now_playing
 */
async function fetchNowPlayingTmdbIds({
  pages = 2,
  limit = 40,
  language = 'en-US',
  region = ''
} = {}) {
  const now = Date.now();
  const hit = cache.nowPlaying;
  if (hit.ids.length && now - hit.at < CACHE_TTL_MS) {
    return hit.ids.slice(0, limit);
  }

  if (!hasTmdbAuth()) {
    return hit.ids.length && now - hit.at < STALE_TTL_MS
      ? hit.ids.slice(0, limit)
      : [];
  }

  try {
    const ids = [];
    const seen = new Set();
    const maxPages = Math.max(1, Math.min(5, pages));

    for (let page = 1; page <= maxPages; page += 1) {
      const data = await fetchTmdbJson('/movie/now_playing', {
        language,
        page,
        ...(region ? { region } : {})
      });
      for (const row of data?.results || []) {
        const id = row?.id != null ? String(row.id) : '';
        if (!id || seen.has(id)) continue;
        seen.add(id);
        ids.push(id);
        if (ids.length >= limit) break;
      }
      if (ids.length >= limit) break;
      if (page >= (Number(data?.total_pages) || 1)) break;
    }

    if (ids.length) {
      cache.nowPlaying = { ids, at: Date.now() };
      return ids.slice(0, limit);
    }
  } catch (err) {
    console.warn('TMDB now_playing unavailable:', err.message || err);
  }

  return hit.ids.length && now - hit.at < STALE_TTL_MS
    ? hit.ids.slice(0, limit)
    : [];
}

module.exports = {
  hasTmdbAuth,
  fetchTmdbJson,
  fetchTmdbTrendingRows,
  fetchNowPlayingTmdbIds
};
