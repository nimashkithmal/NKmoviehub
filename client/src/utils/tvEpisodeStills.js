const CACHE_PREFIX = 'tv-stills:';
const CACHE_TTL_MS = 60 * 60 * 1000;

const cacheKey = (tmdbId, season) => `${CACHE_PREFIX}${tmdbId}:${season}`;

const readCache = (tmdbId, season) => {
  try {
    const raw = sessionStorage.getItem(cacheKey(tmdbId, season));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.stills || Date.now() - parsed.ts > CACHE_TTL_MS) {
      sessionStorage.removeItem(cacheKey(tmdbId, season));
      return null;
    }
    return parsed.stills;
  } catch {
    return null;
  }
};

const writeCache = (tmdbId, season, stills) => {
  try {
    sessionStorage.setItem(
      cacheKey(tmdbId, season),
      JSON.stringify({ ts: Date.now(), stills })
    );
  } catch {
    // Ignore quota errors
  }
};

export const fetchSeasonEpisodeStills = async (tmdbId, season) => {
  if (!tmdbId || !season) return {};

  const cached = readCache(tmdbId, season);
  if (cached) return cached;

  try {
    const response = await fetch(
      `/api/embed/season?tmdb_id=${encodeURIComponent(tmdbId)}&season=${season}`
    );
    if (!response.ok) return {};
    const result = await response.json();
    const stills = {};
    for (const ep of result.data?.episodes || []) {
      if (ep.episodeNumber > 0 && ep.still) {
        stills[ep.episodeNumber] = ep.still;
      }
    }
    writeCache(tmdbId, season, stills);
    return stills;
  } catch {
    return {};
  }
};

export const getEpisodeStillUrl = (stills, episodeNumber, fallback = '') => {
  if (!episodeNumber) return fallback;
  return stills?.[episodeNumber] || fallback;
};
