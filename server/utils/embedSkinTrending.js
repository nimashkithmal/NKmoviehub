/**
 * Scrape https://www.2embed.skin trending HTML when api.2embed.cc is Cloudflare-blocked.
 * Skin pages return 200 with /movie/tt… links; we resolve IMDb → TMDB via TMDB /find.
 */
const https = require('https');
const fetch = require('node-fetch');
const { fetchTmdbJson, hasTmdbAuth } = require('./tmdb');

const SKIN_ORIGIN = 'https://www.2embed.skin';
const CACHE_TTL_MS = 15 * 60 * 1000;
const FIND_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const skinTlsAgent = new https.Agent({
  keepAlive: true,
  rejectUnauthorized: false,
  family: 4
});

const SKIN_HEADERS = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Referer: `${SKIN_ORIGIN}/`
};

const htmlCache = {
  movie: { html: '', at: 0 },
  tv: { html: '', at: 0 }
};

/** @type {Map<string, { row: object|null, at: number }>} */
const imdbFindCache = new Map();

async function fetchSkinHtml(path) {
  const url = path.startsWith('http') ? path : `${SKIN_ORIGIN}${path}`;
  const response = await fetch(url, {
    agent: skinTlsAgent,
    headers: SKIN_HEADERS,
    timeout: 30000
  });
  if (!response.ok) throw new Error(`skin HTTP ${response.status}`);
  const html = await response.text();
  if (/Just a moment|cf-browser-verification|Attention Required/i.test(html.slice(0, 800))) {
    throw new Error('skin Cloudflare challenge');
  }
  return html;
}

/**
 * Ordered unique IMDb ids + titles from 2embed.skin trending markup.
 */
function parseSkinMovieCards(html = '') {
  const rows = [];
  const seen = new Set();
  const re =
    /href="\/movie\/(tt\d+)"[^>]*?(?:title="([^"]*)")?[^>]*>/gi;
  let match;
  while ((match = re.exec(html))) {
    const imdbId = match[1];
    if (!imdbId || seen.has(imdbId)) continue;
    seen.add(imdbId);
    const titleRaw = String(match[2] || '')
      .replace(/\s*\((?:English|CAM|HD|TS|HC)\)\s*$/i, '')
      .trim();
    rows.push({ imdbId, title: titleRaw });
  }
  return rows;
}

function parseSkinTvCards(html = '') {
  const rows = [];
  const seen = new Set();
  const re =
    /href="\/(?:tv|tvshow|series)\/(tt\d+)"[^>]*?(?:title="([^"]*)")?[^>]*>/gi;
  let match;
  while ((match = re.exec(html))) {
    const imdbId = match[1];
    if (!imdbId || seen.has(imdbId)) continue;
    seen.add(imdbId);
    const titleRaw = String(match[2] || '')
      .replace(/\s*\((?:English|CAM|HD|TS|HC)\)\s*$/i, '')
      .trim();
    rows.push({ imdbId, title: titleRaw });
  }
  // Some skin builds only expose /movie/ even on TV pages — ignore those here.
  return rows;
}

async function resolveImdbToEmbedRow(imdbId, kind = 'movie', titleHint = '') {
  const cacheKey = `${kind}:${imdbId}`;
  const hit = imdbFindCache.get(cacheKey);
  if (hit && Date.now() - hit.at < FIND_CACHE_TTL_MS) {
    return hit.row;
  }

  if (!hasTmdbAuth()) {
    imdbFindCache.set(cacheKey, { row: null, at: Date.now() });
    return null;
  }

  try {
    const data = await fetchTmdbJson(`/find/${encodeURIComponent(imdbId)}`, {
      external_source: 'imdb_id'
    });
    const movie = data?.movie_results?.[0];
    const tv = data?.tv_results?.[0];
    const pick = kind === 'tv' ? tv || movie : movie || tv;
    if (!pick?.id) {
      imdbFindCache.set(cacheKey, { row: null, at: Date.now() });
      return null;
    }

    const isTv = Boolean(tv && (!movie || kind === 'tv'));
    const release = String(
      isTv ? pick.first_air_date || '' : pick.release_date || ''
    ).trim();
    const row = {
      title: pick.title || pick.name || titleHint || '',
      name: pick.name || pick.title || titleHint || '',
      year: release.slice(0, 4) || '',
      status: 'released',
      release_date: release,
      tmdb_id: pick.id,
      imdb_id: imdbId,
      vote_average: pick.vote_average,
      vote_count: pick.vote_count,
      poster: pick.poster_path
        ? `https://image.tmdb.org/t/p/w500${pick.poster_path}`
        : '',
      original_language: pick.original_language || '',
      source: '2embed.skin'
    };
    imdbFindCache.set(cacheKey, { row, at: Date.now() });
    return row;
  } catch {
    imdbFindCache.set(cacheKey, { row: null, at: Date.now() });
    return null;
  }
}

async function getSkinHtmlCached(kind = 'movie') {
  const key = kind === 'tv' ? 'tv' : 'movie';
  const hit = htmlCache[key];
  if (hit.html && Date.now() - hit.at < CACHE_TTL_MS) return hit.html;

  const path = kind === 'tv' ? '/trendingtv' : '/trending';
  const html = await fetchSkinHtml(path);
  htmlCache[key] = { html, at: Date.now() };
  return html;
}

/**
 * Trending rows from 2embed.skin (Cloudflare-safe HTML) resolved to TMDB ids.
 */
async function fetchSkinTrendingRows(kind = 'movie', { limit = 40 } = {}) {
  try {
    const html = await getSkinHtmlCached(kind);
    const cards =
      kind === 'tv' ? parseSkinTvCards(html) : parseSkinMovieCards(html);

    // trendingtv page currently mirrors movies on skin — fall back to movie cards
    // only for movie kind; for TV keep empty so caller can use TMDB TV trending.
    const list =
      kind === 'tv' && !cards.length ? [] : cards.slice(0, Math.max(limit * 2, 60));

    const rows = [];
    const seen = new Set();
    for (const card of list) {
      const row = await resolveImdbToEmbedRow(card.imdbId, kind, card.title);
      if (!row?.tmdb_id) continue;
      const id = String(row.tmdb_id);
      if (seen.has(id)) continue;
      seen.add(id);
      rows.push(row);
      if (rows.length >= limit) break;
    }
    return rows;
  } catch (err) {
    console.warn(
      `2embed.skin trending scrape failed (${kind}):`,
      err.message || err
    );
    return [];
  }
}

module.exports = {
  fetchSkinTrendingRows,
  parseSkinMovieCards,
  parseSkinTvCards,
  SKIN_ORIGIN
};
