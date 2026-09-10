/**
 * Scrape https://www.2embed.skin when api.2embed.cc is Cloudflare-blocked.
 * Uses skin HTML only (no themoviedb.org calls) — TMDB ids come from skin detail pages.
 */
const https = require('https');
const fetch = require('node-fetch');

const SKIN_ORIGIN = 'https://www.2embed.skin';
const CACHE_TTL_MS = 15 * 60 * 1000;
const DETAIL_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

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

const listCache = {
  trendingMovie: { cards: null, at: 0 },
  libraryMovie: { cards: null, at: 0 },
  trendingTv: { cards: null, at: 0 }
};

/** @type {Map<string, { row: object|null, at: number }>} */
const detailCache = new Map();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchSkinHtml(path) {
  const url = path.startsWith('http') ? path : `${SKIN_ORIGIN}${path}`;
  const response = await fetch(url, {
    agent: skinTlsAgent,
    headers: SKIN_HEADERS,
    timeout: 30000
  });
  if (!response.ok) throw new Error(`skin HTTP ${response.status}`);
  const html = await response.text();
  if (/Just a moment|cf-browser-verification|Attention Required|Web Filter Violation/i.test(
    html.slice(0, 800)
  )) {
    throw new Error('skin Cloudflare challenge');
  }
  return html;
}

function cleanSkinTitle(title = '') {
  return String(title)
    .replace(/\s*\((?:English|Eng|CAM|HD|TS|HC|Dubbed)\)\s*$/i, '')
    .trim();
}

function parseSkinMovieCards(html = '') {
  const byId = new Map();
  const re = /href="\/movie\/(tt\d+)"([^>]*)>/gi;
  let match;
  while ((match = re.exec(html))) {
    const imdbId = match[1];
    if (!imdbId) continue;
    const attrs = match[2] || '';
    const titleAttr = (attrs.match(/\btitle="([^"]*)"/i) || [])[1] || '';
    const title = cleanSkinTitle(titleAttr);
    const prev = byId.get(imdbId);
    if (!prev) {
      byId.set(imdbId, { imdbId, title });
    } else if (!prev.title && title) {
      prev.title = title;
    }
  }
  return [...byId.values()];
}

function parseSkinTvCards(html = '') {
  const byId = new Map();
  const re = /href="\/(?:tv|tvshow|series)\/(tt\d+)"([^>]*)>/gi;
  let match;
  while ((match = re.exec(html))) {
    const imdbId = match[1];
    if (!imdbId) continue;
    const attrs = match[2] || '';
    const titleAttr = (attrs.match(/\btitle="([^"]*)"/i) || [])[1] || '';
    const title = cleanSkinTitle(titleAttr);
    const prev = byId.get(imdbId);
    if (!prev) {
      byId.set(imdbId, { imdbId, title });
    } else if (!prev.title && title) {
      prev.title = title;
    }
  }
  return [...byId.values()];
}

function grabDetailField(html, label) {
  const re = new RegExp(
    `<span class="type">${label.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}<\\/span>\\s*([^<\\n]+)`,
    'i'
  );
  const match = html.match(re);
  return match ? String(match[1]).trim() : '';
}

/**
 * Parse movie/TV detail page on 2embed.skin into an API-like search row.
 */
function parseSkinDetailHtml(html = '', kind = 'movie') {
  const imdbId =
    grabDetailField(html, 'IMDB ID:') ||
    (html.match(/\b(tt\d{7,})\b/) || [])[1] ||
    '';
  const tmdbId = grabDetailField(html, 'TMDB ID:');
  if (!tmdbId) return null;

  const titleMatch =
    html.match(/<h2[^>]*class="heading-name"[^>]*>\s*<a[^>]*>([^<]+)/i) ||
    html.match(/<title>\s*([^-<(]+)/i);
  const title = cleanSkinTitle(titleMatch ? titleMatch[1] : '');
  const yearMatch =
    html.match(/<title>[^(]*\((\d{4})\)/i) ||
    html.match(/\b(19\d{2}|20\d{2})\b/);
  const year = yearMatch ? yearMatch[1] : '';
  const posterMatch = html.match(
    /class="film-poster"[^>]*>\s*<img[^>]+src="([^"]+)"/i
  );
  const poster = posterMatch ? posterMatch[1] : '';
  const overviewMatch = html.match(
    /class="description"[^>]*>([\s\S]*?)<\/div>/i
  );
  const overview = overviewMatch
    ? overviewMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    : '';

  const release = year ? `${year}-01-01` : '';
  if (kind === 'tvshow') {
    return {
      name: title,
      title,
      first_air_date: release,
      first_air_year: year,
      year,
      status: 'Released',
      tmdb_id: Number(tmdbId) || tmdbId,
      imdb_id: imdbId,
      poster,
      plot: overview,
      overview,
      vote_average: 0,
      vote_count: 0,
      source: '2embed.skin'
    };
  }

  return {
    title,
    name: title,
    year,
    release_date: release,
    status: 'Released',
    tmdb_id: Number(tmdbId) || tmdbId,
    imdb_id: imdbId,
    poster,
    plot: overview,
    overview,
    vote_average: 0,
    vote_count: 0,
    source: '2embed.skin'
  };
}

async function fetchSkinDetailByImdb(imdbId, kind = 'movie') {
  const id = String(imdbId || '').trim();
  if (!/^tt\d+$/i.test(id)) return null;

  const cacheKey = `${kind}:${id}`;
  const hit = detailCache.get(cacheKey);
  if (hit && Date.now() - hit.at < DETAIL_CACHE_TTL_MS) return hit.row;

  const path = kind === 'tvshow' ? `/tv/${id}` : `/movie/${id}`;
  try {
    const html = await fetchSkinHtml(path);
    const row = parseSkinDetailHtml(html, kind);
    detailCache.set(cacheKey, { row, at: Date.now() });
    return row;
  } catch (err) {
    console.warn(`2embed.skin detail failed (${path}):`, err.message || err);
    detailCache.set(cacheKey, { row: null, at: Date.now() });
    return null;
  }
}

async function getCachedCards(cacheKey, path, parser) {
  const hit = listCache[cacheKey];
  if (hit?.cards && Date.now() - hit.at < CACHE_TTL_MS) return hit.cards;
  const html = await fetchSkinHtml(path);
  const cards = parser(html);
  listCache[cacheKey] = { cards, at: Date.now() };
  return cards;
}

async function collectSkinCatalogCards(kind = 'movie') {
  if (kind === 'tvshow') {
    try {
      const cards = await getCachedCards(
        'trendingTv',
        '/trendingtv',
        parseSkinTvCards
      );
      if (cards.length) return cards;
    } catch {
      // trendingtv often mirrors movies; fall through
    }
    return [];
  }

  const [trending, library] = await Promise.all([
    getCachedCards('trendingMovie', '/trending', parseSkinMovieCards).catch(
      () => []
    ),
    getCachedCards('libraryMovie', '/library', parseSkinMovieCards).catch(
      () => []
    )
  ]);

  const seen = new Set();
  const out = [];
  for (const card of [...trending, ...library]) {
    if (!card?.imdbId || seen.has(card.imdbId)) continue;
    seen.add(card.imdbId);
    out.push(card);
  }
  return out;
}

const stripArticle = (value = '') =>
  String(value).trim().replace(/^(the|a|an)\s+/i, '').trim();

const titleKey = (value = '') => stripArticle(value).toLowerCase();

function scoreTitle(query, title) {
  const q = titleKey(query);
  const t = titleKey(title);
  if (!q || !t) return 0;
  if (t === q) return 100;
  if (t.startsWith(q) || q.startsWith(t)) return 85;
  if (t.includes(q) || q.includes(t)) return 70;
  return 0;
}

/**
 * Search 2embed.skin catalog pages by title (API-free).
 */
async function searchSkinByTitle(kind = 'movie', query = '', { limit = 8 } = {}) {
  const q = String(query || '').trim();
  if (!q) return [];

  const imdbMatch = q.match(/\b(tt\d{7,})\b/i);
  if (imdbMatch) {
    const row = await fetchSkinDetailByImdb(imdbMatch[1], kind);
    return row ? [row] : [];
  }

  const cards = await collectSkinCatalogCards(kind);
  let ranked = cards
    .map((card) => ({
      ...card,
      score: scoreTitle(q, card.title)
    }))
    .filter((card) => card.score >= 70)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limit);

  // If titles were missing on list pages, still try IMDb ids that appear with
  // the query text nearby in raw HTML (handled via score on empty = 0).
  if (!ranked.length) {
    const loose = cards.filter((card) => {
      const t = titleKey(card.title);
      const qk = titleKey(q);
      return t && qk && (t.includes(qk) || qk.includes(t));
    });
    ranked = loose
      .map((card) => ({ ...card, score: 60 }))
      .slice(0, limit);
  }

  const rows = [];
  const seen = new Set();
  for (const card of ranked) {
    const row = await fetchSkinDetailByImdb(card.imdbId, kind);
    await sleep(120);
    if (!row?.tmdb_id) continue;
    const id = String(row.tmdb_id);
    if (seen.has(id)) continue;
    seen.add(id);
    if (!row.title && card.title) row.title = card.title;
    if (!row.name && card.title) row.name = card.title;
    rows.push(row);
  }
  if (rows.length) return rows;

  // Title not on trending/library — resolve IMDb via TMDB, then require a live
  // 2embed.skin /movie|tv/tt… page (still syncing from 2embed, not TMDB catalog).
  try {
    const { searchTmdbForImdbIds } = require('./tmdb');
    const hints = await searchTmdbForImdbIds(kind, q, { limit });
    const scored = hints
      .map((hint) => ({ ...hint, score: scoreTitle(q, hint.title) }))
      .filter((hint) => hint.score >= 70)
      .sort((a, b) => b.score - a.score);

    for (const hint of scored) {
      const row = await fetchSkinDetailByImdb(hint.imdbId, kind);
      await sleep(120);
      if (!row?.tmdb_id) continue;
      const id = String(row.tmdb_id);
      if (seen.has(id)) continue;
      seen.add(id);
      if (!row.title && hint.title) row.title = hint.title;
      if (!row.name && hint.title) row.name = hint.title;
      rows.push(row);
      if (rows.length >= limit) break;
    }
  } catch (err) {
    console.warn(`2embed.skin TMDB-assisted search failed (${kind}):`, err.message || err);
  }

  return rows;
}

/**
 * Trending rows from 2embed.skin.
 * Home discovery may use TMDB /find for speed; sync search uses skin detail only.
 */
async function fetchSkinTrendingRows(
  kind = 'movie',
  { limit = 40, allowTmdbFind = true } = {}
) {
  try {
    const cards = await collectSkinCatalogCards(
      kind === 'tv' ? 'tvshow' : 'movie'
    );
    if (!cards.length) return [];

    let resolveWithTmdb = null;
    if (allowTmdbFind) {
      try {
        const tmdb = require('./tmdb');
        if (tmdb.hasTmdbAuth()) {
          resolveWithTmdb = async (imdbId, titleHint) => {
            const data = await tmdb.fetchTmdbJson(
              `/find/${encodeURIComponent(imdbId)}`,
              { external_source: 'imdb_id' }
            );
            const movie = data?.movie_results?.[0];
            const tv = data?.tv_results?.[0];
            const pick =
              kind === 'tv' || kind === 'tvshow' ? tv || movie : movie || tv;
            if (!pick?.id) return null;
            const isTv = Boolean(tv && (kind === 'tv' || kind === 'tvshow' || !movie));
            const release = String(
              isTv ? pick.first_air_date || '' : pick.release_date || ''
            ).trim();
            return {
              title: pick.title || pick.name || titleHint || '',
              name: pick.name || pick.title || titleHint || '',
              year: release.slice(0, 4) || '',
              status: 'released',
              release_date: release,
              first_air_date: isTv ? release : undefined,
              tmdb_id: pick.id,
              imdb_id: imdbId,
              vote_average: pick.vote_average,
              vote_count: pick.vote_count,
              poster: pick.poster_path
                ? `https://image.tmdb.org/t/p/w500${pick.poster_path}`
                : '',
              source: '2embed.skin'
            };
          };
        }
      } catch {
        resolveWithTmdb = null;
      }
    }

    const rows = [];
    const seen = new Set();
    const itemKind = kind === 'tv' || kind === 'tvshow' ? 'tvshow' : 'movie';
    for (const card of cards.slice(0, Math.max(limit * 2, 40))) {
      let row = null;
      if (resolveWithTmdb) {
        try {
          row = await resolveWithTmdb(card.imdbId, card.title);
        } catch {
          row = null;
        }
      }
      if (!row) {
        row = await fetchSkinDetailByImdb(card.imdbId, itemKind);
        await sleep(80);
      }
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
  SKIN_ORIGIN,
  fetchSkinHtml,
  parseSkinMovieCards,
  parseSkinTvCards,
  parseSkinDetailHtml,
  fetchSkinDetailByImdb,
  searchSkinByTitle,
  fetchSkinTrendingRows,
  collectSkinCatalogCards
};
