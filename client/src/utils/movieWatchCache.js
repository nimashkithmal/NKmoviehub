const CACHE_PREFIX = 'movie-watch:';
const CACHE_TTL_MS = 15 * 60 * 1000;

export const readMovieWatchCache = (id) => {
  if (!id) return null;
  try {
    const raw = sessionStorage.getItem(`${CACHE_PREFIX}${id}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.data || Date.now() - parsed.ts > CACHE_TTL_MS) {
      sessionStorage.removeItem(`${CACHE_PREFIX}${id}`);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
};

export const writeMovieWatchCache = (id, data) => {
  if (!id || !data) return;
  try {
    sessionStorage.setItem(
      `${CACHE_PREFIX}${id}`,
      JSON.stringify({ ts: Date.now(), data })
    );
  } catch {
    // Ignore quota errors
  }
};
