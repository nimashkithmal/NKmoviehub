/**
 * Move coming_soon titles to active once their release date has passed.
 */

const COMING_SOON_CACHE_TTL_MS = 3 * 60 * 1000;
const COMING_SOON_STALE_TTL_MS = 30 * 60 * 1000;
const PROMOTE_INTERVAL_MS = 10 * 60 * 1000;
const COMING_SOON_CARD_SELECT =
  'title year releaseDate imageUrl images imdbRating averageRating matureContent status genre language';

let comingSoonCache = { at: 0, movies: null, tvShows: null };
let lastPromoteAt = 0;
let promoteInFlight = false;

function isReleased(doc, todayArg) {
  const today = todayArg instanceof Date ? todayArg : new Date();
  const todayStr = today.toISOString().slice(0, 10);

  if (doc.releaseDate) {
    const raw = String(doc.releaseDate).trim();
    const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
    if (iso) return iso <= todayStr;

    const parsed = Date.parse(raw);
    if (!Number.isNaN(parsed)) {
      return parsed <= today.getTime();
    }
  }

  // No exact date: treat past calendar years as already released
  const year = Number(doc.year);
  if (Number.isFinite(year) && year > 1900 && year < today.getFullYear()) {
    return true;
  }

  return false;
}

function releaseSortKey(doc) {
  if (doc.releaseDate) {
    const iso = String(doc.releaseDate).trim().match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
    if (iso) return iso;
    const parsed = Date.parse(doc.releaseDate);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  }
  if (doc.year) return `${doc.year}-12-31`;
  return '9999-12-31';
}

function isUpcomingDoc(doc, todayArg) {
  const today = todayArg instanceof Date ? todayArg : new Date();
  const todayStr = today.toISOString().slice(0, 10);

  if (doc.releaseDate) {
    const iso = String(doc.releaseDate).trim().match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
    if (iso) return iso > todayStr;
    const parsed = Date.parse(doc.releaseDate);
    if (!Number.isNaN(parsed)) return parsed > today.getTime();
  }

  const year = Number(doc.year);
  if (Number.isFinite(year) && year > today.getFullYear()) return true;

  return false;
}

async function promoteReleasedComingSoon(Model) {
  const docs = await Model.find({ status: 'coming_soon' })
    .select('_id releaseDate year')
    .lean();

  const ids = docs.filter((doc) => isReleased(doc)).map((doc) => doc._id);
  if (!ids.length) return 0;

  await Model.updateMany(
    { _id: { $in: ids } },
    { $set: { status: 'active' } }
  );
  return ids.length;
}

function sortComingSoon(docs) {
  return [...docs].sort((a, b) => {
    const ka = releaseSortKey(a);
    const kb = releaseSortKey(b);
    if (ka !== kb) return ka.localeCompare(kb);
    return String(a.title || '').localeCompare(String(b.title || ''));
  });
}

/** Public Coming Soon list: only titles still truly upcoming. */
function filterUpcomingOnly(docs) {
  return sortComingSoon(docs.filter((doc) => isUpcomingDoc(doc)));
}

function scheduleComingSoonPromote(Movie, TVShow) {
  const now = Date.now();
  if (promoteInFlight || now - lastPromoteAt < PROMOTE_INTERVAL_MS) return;
  promoteInFlight = true;
  lastPromoteAt = now;
  Promise.all([
    promoteReleasedComingSoon(Movie),
    promoteReleasedComingSoon(TVShow)
  ])
    .then((counts) => {
      if ((counts[0] || 0) + (counts[1] || 0) > 0) {
        comingSoonCache = { at: 0, movies: null, tvShows: null };
      }
    })
    .catch((err) => {
      console.error('Coming soon promote error:', err.message || err);
    })
    .finally(() => {
      promoteInFlight = false;
    });
}

/**
 * Fast path for home Coming Soon: short TTL cache, lean fields, promote in background.
 */
async function getComingSoonCatalog({
  Movie,
  TVShow,
  applyPublicCatalogFilter,
  filterPublicItems,
  limit = 40
}) {
  const now = Date.now();
  const age = comingSoonCache.at ? now - comingSoonCache.at : Number.POSITIVE_INFINITY;
  if (comingSoonCache.at && age < COMING_SOON_CACHE_TTL_MS) {
    scheduleComingSoonPromote(Movie, TVShow);
    return {
      movies: comingSoonCache.movies || [],
      tvShows: comingSoonCache.tvShows || [],
      fromCache: true
    };
  }

  scheduleComingSoonPromote(Movie, TVShow);

  try {
    const movieFilter = applyPublicCatalogFilter
      ? applyPublicCatalogFilter({ status: 'coming_soon' })
      : { status: 'coming_soon' };
    const tvFilter = applyPublicCatalogFilter
      ? applyPublicCatalogFilter({ status: 'coming_soon' })
      : { status: 'coming_soon' };

    const [movieDocs, tvDocs] = await Promise.all([
      Movie.find(movieFilter).select(COMING_SOON_CARD_SELECT).lean(),
      TVShow.find(tvFilter).select(COMING_SOON_CARD_SELECT).lean()
    ]);

    let movies = filterUpcomingOnly(movieDocs);
    let tvShows = filterUpcomingOnly(tvDocs);
    if (typeof filterPublicItems === 'function') {
      movies = filterPublicItems(movies);
      tvShows = filterPublicItems(tvShows);
    }
    movies = movies.slice(0, limit);
    tvShows = tvShows.slice(0, limit);

    comingSoonCache = { at: Date.now(), movies, tvShows };
    return { movies, tvShows, fromCache: false };
  } catch (err) {
    if (comingSoonCache.at && age < COMING_SOON_STALE_TTL_MS) {
      console.warn(
        'Coming soon catalog falling back to stale cache:',
        err.message || err
      );
      return {
        movies: comingSoonCache.movies || [],
        tvShows: comingSoonCache.tvShows || [],
        fromCache: true,
        stale: true
      };
    }
    throw err;
  }
}

function invalidateComingSoonCache() {
  comingSoonCache = { at: 0, movies: null, tvShows: null };
}

module.exports = {
  isReleased,
  isUpcomingDoc,
  releaseSortKey,
  promoteReleasedComingSoon,
  sortComingSoon,
  filterUpcomingOnly,
  getComingSoonCatalog,
  invalidateComingSoonCache,
  scheduleComingSoonPromote
};
