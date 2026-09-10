/**
 * Lightweight TMDB v3 client (now playing, etc.).
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

  const url = new URL(`${TMDB_API}${pathname.startsWith('/') ? pathname : `/${pathname}`}`);
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
  fetchNowPlayingTmdbIds
};
