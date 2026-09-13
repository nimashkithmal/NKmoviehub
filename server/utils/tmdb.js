/**
 * Lightweight TMDB v3 client (now playing, trending, etc.).
 * Auth: TMDB_API_KEY (query) and/or TMDB_ACCESS_TOKEN / TMDB_READ_ACCESS_TOKEN (Bearer).
 */
const fetch = require('node-fetch');

const TMDB_API = 'https://api.themoviedb.org/3';
/** Keep lists fresh — home client refreshes on a similar cadence. */
const CACHE_TTL_MS = 10 * 60 * 1000;
const STALE_TTL_MS = 6 * 60 * 60 * 1000;

const cache = {
  nowPlaying: { ids: [], at: 0 },
  popular: { ids: [], at: 0 },
  topRated: { ids: [], at: 0 }
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
    original_language: row.original_language || '',
    adult: row.adult === true
  };
}

/**
 * Ordered TMDB movie ids from list endpoints (popular / now_playing / top_rated).
 * Skips adult titles. Cached briefly so home + browse stay live.
 */
async function fetchTmdbMovieListIds(
  pathname,
  cacheKey,
  {
    pages = 2,
    limit = 40,
    language = 'en-US',
    region = '',
    extraQuery = {},
    /** Keep only titles whose release_date falls in this theatrical window. */
    theatricalWindow = null
  } = {}
) {
  const now = Date.now();
  const hit = cache[cacheKey] || { ids: [], at: 0 };
  if (hit.ids.length && now - hit.at < CACHE_TTL_MS) {
    return hit.ids.slice(0, limit);
  }

  if (!hasTmdbAuth()) {
    return hit.ids.length && now - hit.at < STALE_TTL_MS
      ? hit.ids.slice(0, limit)
      : [];
  }

  const inTheatricalWindow = (releaseDate) => {
    if (!theatricalWindow) return true;
    const iso = String(releaseDate || '').trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
    const release = Date.parse(`${iso}T00:00:00Z`);
    if (!Number.isFinite(release)) return false;
    const pastDays = Math.max(0, Number(theatricalWindow.pastDays) || 90);
    const futureDays = Math.max(0, Number(theatricalWindow.futureDays) || 45);
    const today = Date.now();
    const min = today - pastDays * 24 * 60 * 60 * 1000;
    const max = today + futureDays * 24 * 60 * 60 * 1000;
    return release >= min && release <= max;
  };

  try {
    const ids = [];
    const seen = new Set();
    const maxPages = Math.max(1, Math.min(5, pages));

    for (let page = 1; page <= maxPages; page += 1) {
      const data = await fetchTmdbJson(pathname, {
        language,
        page,
        ...(region ? { region } : {}),
        ...extraQuery
      });
      for (const row of data?.results || []) {
        if (row?.adult === true) continue;
        if (!inTheatricalWindow(row.release_date)) continue;
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
      cache[cacheKey] = { ids, at: Date.now() };
      return ids.slice(0, limit);
    }
  } catch (err) {
    console.warn(`TMDB ${pathname} unavailable:`, err.message || err);
  }

  return hit.ids.length && now - hit.at < STALE_TTL_MS
    ? hit.ids.slice(0, limit)
    : [];
}

/** https://www.themoviedb.org/movie — /movie/popular */
async function fetchPopularTmdbIds(options = {}) {
  return fetchTmdbMovieListIds('/movie/popular', 'popular', {
    pages: 3,
    limit: 80,
    ...options
  });
}

/**
 * https://www.themoviedb.org/movie/now-playing — /movie/now_playing
 * Region US + recent theatrical window so re-releases / catalog noise drop out.
 */
async function fetchNowPlayingTmdbIds(options = {}) {
  const {
    theatricalWindow = { pastDays: 75, futureDays: 50 },
    ...rest
  } = options;
  return fetchTmdbMovieListIds('/movie/now_playing', 'nowPlaying', {
    pages: 2,
    limit: 40,
    region: 'US',
    theatricalWindow,
    ...rest
  });
}

/** https://www.themoviedb.org/movie/top-rated — /movie/top_rated */
async function fetchTopRatedTmdbIds(options = {}) {
  return fetchTmdbMovieListIds('/movie/top_rated', 'topRated', {
    pages: 3,
    limit: 80,
    ...options
  });
}

/**
 * TMDB homepage Trending (all media) — Today / This Week.
 * https://api.themoviedb.org/3/trending/all/{day|week}
 * @returns {Promise<Array<{ tmdbId: string, mediaType: 'movie'|'tv' }>>}
 */
async function fetchTmdbAllTrendingEntries(
  timeWindow = 'day',
  { pages = 2, limit = 40, language = 'en-US' } = {}
) {
  if (!hasTmdbAuth()) return [];

  const window = timeWindow === 'week' ? 'week' : 'day';
  const cacheKey = `trending_all_${window}`;
  if (!cache[cacheKey]) cache[cacheKey] = { ids: [], at: 0 };
  const hit = cache[cacheKey];
  const now = Date.now();
  if (Array.isArray(hit.entries) && hit.entries.length && now - hit.at < CACHE_TTL_MS) {
    return hit.entries.slice(0, limit);
  }

  try {
    const entries = [];
    const seen = new Set();
    const maxPages = Math.max(1, Math.min(3, pages));

    for (let page = 1; page <= maxPages; page += 1) {
      const data = await fetchTmdbJson(`/trending/all/${window}`, {
        language,
        page
      });
      for (const row of data?.results || []) {
        if (row?.adult === true) continue;
        const mediaType = row?.media_type === 'tv' ? 'tv' : row?.media_type === 'movie' ? 'movie' : '';
        if (!mediaType) continue;
        const tmdbId = row?.id != null ? String(row.id) : '';
        if (!tmdbId || seen.has(`${mediaType}:${tmdbId}`)) continue;
        seen.add(`${mediaType}:${tmdbId}`);
        entries.push({ tmdbId, mediaType });
        if (entries.length >= limit) break;
      }
      if (entries.length >= limit) break;
      if (page >= (Number(data?.total_pages) || 1)) break;
    }

    if (entries.length) {
      cache[cacheKey] = { entries, at: Date.now() };
      return entries.slice(0, limit);
    }
  } catch (err) {
    console.warn(`TMDB trending/all/${window} unavailable:`, err.message || err);
  }

  return Array.isArray(hit.entries) && hit.entries.length && now - hit.at < STALE_TTL_MS
    ? hit.entries.slice(0, limit)
    : [];
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
 * Title → IMDb ids via TMDB search (used only to look up 2embed.skin detail pages
 * when api.2embed.cc search is blocked and the title is not on skin trending/library).
 */
async function searchTmdbForImdbIds(
  kind = 'movie',
  query = '',
  { limit = 5, language = 'en-US' } = {}
) {
  if (!hasTmdbAuth()) return [];
  const q = String(query || '').trim();
  if (!q) return [];

  const isTv = kind === 'tv' || kind === 'tvshow';
  const searchPath = isTv ? '/search/tv' : '/search/movie';
  const detailPath = isTv ? '/tv' : '/movie';

  try {
    const data = await fetchTmdbJson(searchPath, {
      query: q,
      language,
      include_adult: 'false',
      page: 1
    });
    const results = Array.isArray(data?.results) ? data.results : [];
    const out = [];
    const seen = new Set();

    for (const row of results.slice(0, Math.max(1, Math.min(8, limit * 2)))) {
      const tmdbId = row?.id != null ? String(row.id) : '';
      if (!tmdbId || seen.has(tmdbId)) continue;
      seen.add(tmdbId);

      let imdbId = '';
      try {
        const ext = await fetchTmdbJson(`${detailPath}/${tmdbId}/external_ids`);
        imdbId = String(ext?.imdb_id || '').trim();
      } catch {
        continue;
      }
      if (!/^tt\d+$/i.test(imdbId)) continue;

      const release = isTv
        ? String(row.first_air_date || '').trim()
        : String(row.release_date || '').trim();

      out.push({
        tmdbId,
        imdbId,
        title: String(row.title || row.name || '').trim(),
        year: release.slice(0, 4) || '',
        mediaType: isTv ? 'tvshow' : 'movie'
      });
      if (out.length >= limit) break;
    }

    return out;
  } catch (err) {
    console.warn('TMDB title→IMDb lookup failed:', err.message || err);
    return [];
  }
}

module.exports = {
  hasTmdbAuth,
  fetchTmdbJson,
  fetchTmdbTrendingRows,
  fetchTmdbMovieListIds,
  fetchPopularTmdbIds,
  fetchNowPlayingTmdbIds,
  fetchTopRatedTmdbIds,
  fetchTmdbAllTrendingEntries,
  searchTmdbForImdbIds
};
